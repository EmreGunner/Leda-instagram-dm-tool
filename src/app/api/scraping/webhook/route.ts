/**
 * Universal Webhook Endpoint for Scraping Accounts
 * POST /api/scraping/webhook
 * 
 * Receives Instagram accounts from multiple sources:
 * - Apify Instagram Search Scraper
 * - CSV imports
 * - n8n/Zapier workflows
 * - Direct API calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger as baseLogger } from '@/lib/logger';
import type { WebhookRequest, WebhookResponse, InstagramAccountInput } from '@/types/scraping';

// Simple API key validation (in production, use proper auth)
function validateApiKey(request: NextRequest): boolean {
    const apiKey = request.headers.get('x-api-key');
    const envApiKey = process.env.SCRAPING_WEBHOOK_API_KEY;

    // If no API key is set in env, allow all requests (for development)
    if (!envApiKey) {
        return true;
    }

    return apiKey === envApiKey;
}

export async function POST(request: NextRequest) {
    const logger = baseLogger.child({ endpoint: '/api/scraping/webhook' });
    logger.info('Webhook request received');

    try {
        // 1. Validate API key
        if (!validateApiKey(request)) {
            logger.warn('Invalid API key');
            return NextResponse.json(
                { success: false, error: 'Invalid API key' },
                { status: 401 }
            );
        }

        // 2. Parse and validate request body
        const body: WebhookRequest = await request.json();
        logger.debug('Request body parsed', { source: body.source, accountCount: body.accounts?.length });

        const { source, workspace_id, accounts, metadata } = body;

        if (!workspace_id) {
            logger.error('Missing workspace_id');
            return NextResponse.json(
                { success: false, error: 'workspace_id is required' },
                { status: 400 }
            );
        }

        if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
            logger.error('Invalid accounts array');
            return NextResponse.json(
                { success: false, error: 'accounts array is required and must not be empty' },
                { status: 400 }
            );
        }

        if (accounts.length > 1000) {
            logger.error('Too many accounts in batch', { count: accounts.length });
            return NextResponse.json(
                { success: false, error: 'Maximum 1000 accounts per request' },
                { status: 400 }
            );
        }

        // 3. Initialize Supabase
        const supabase = await createClient();

        // 4. Verify workspace access (optional - depends on auth strategy)
        // For webhook, we trust the workspace_id if API key is valid
        const { data: workspace, error: workspaceError } = await supabase
            .from('workspaces')
            .select('id')
            .eq('id', workspace_id)
            .single();

        if (workspaceError || !workspace) {
            logger.error('Workspace not found', { workspace_id, error: workspaceError });
            return NextResponse.json(
                { success: false, error: 'Workspace not found' },
                { status: 404 }
            );
        }

        logger.info('Processing accounts', {
            workspace_id,
            source,
            count: accounts.length,
            batch_id: metadata?.batch_id
        });

        // 5. Process each account
        const results = {
            inserted: 0,
            updated: 0,
            duplicates: 0,
            errors: 0,
            accounts: [] as WebhookResponse['accounts'],
        };

        for (const accountInput of accounts) {
            try {
                // Validate required field
                if (!accountInput.username) {
                    logger.warn('Account missing username, skipping', accountInput);
                    results.errors++;
                    results.accounts?.push({
                        username: 'unknown',
                        id: '',
                        status: 'error',
                        error: 'Username is required',
                    });
                    continue;
                }

                // Map input to database format
                const accountData = {
                    workspace_id,
                    username: accountInput.username.toLowerCase().trim(),
                    full_name: accountInput.full_name || null,
                    biography: accountInput.biography || null,
                    follower_count: accountInput.follower_count || null,
                    following_count: accountInput.following_count || null,
                    post_count: accountInput.post_count || null,
                    is_verified: accountInput.is_verified || false,
                    is_private: accountInput.is_private || false,
                    profile_pic_url: accountInput.profile_pic_url || null,
                    account_type: 'real_estate_agency',
                    tags: [...(metadata?.tags || []), ...(accountInput.tags || [])],
                    added_via: source,
                    scraping_priority: metadata?.priority || 0,
                    validation_status: metadata?.auto_validate ? 'approved' : 'pending',
                    is_validated: metadata?.auto_validate || false,
                    updated_at: new Date().toISOString(),
                };

                // Check if account already exists
                const { data: existing } = await supabase
                    .from('scraping_accounts')
                    .select('id, username, is_validated')
                    .eq('username', accountData.username)
                    .eq('workspace_id', workspace_id)
                    .single();

                if (existing) {
                    // Update existing account
                    const { data: updated, error: updateError } = await supabase
                        .from('scraping_accounts')
                        .update({
                            full_name: accountData.full_name,
                            biography: accountData.biography,
                            follower_count: accountData.follower_count,
                            following_count: accountData.following_count,
                            post_count: accountData.post_count,
                            is_verified: accountData.is_verified,
                            is_private: accountData.is_private,
                            profile_pic_url: accountData.profile_pic_url,
                            tags: accountData.tags,
                            updated_at: accountData.updated_at,
                        })
                        .eq('id', existing.id)
                        .select('id, username')
                        .single();

                    if (updateError) {
                        logger.error('Error updating account', { username: accountData.username, error: updateError });
                        results.errors++;
                        results.accounts?.push({
                            username: accountData.username,
                            id: existing.id,
                            status: 'error',
                            error: updateError.message,
                        });
                    } else {
                        results.updated++;
                        results.accounts?.push({
                            username: updated.username,
                            id: updated.id,
                            status: 'updated',
                        });
                        logger.debug('Account updated', { username: updated.username, id: updated.id });
                    }
                } else {
                    // Insert new account
                    const { data: inserted, error: insertError } = await supabase
                        .from('scraping_accounts')
                        .insert(accountData)
                        .select('id, username')
                        .single();

                    if (insertError) {
                        // Check if it's a duplicate (race condition)
                        if (insertError.code === '23505') {
                            results.duplicates++;
                            logger.debug('Duplicate account (race condition)', { username: accountData.username });
                        } else {
                            logger.error('Error inserting account', { username: accountData.username, error: insertError });
                            results.errors++;
                        }
                        results.accounts?.push({
                            username: accountData.username,
                            id: '',
                            status: 'error',
                            error: insertError.message,
                        });
                    } else {
                        results.inserted++;
                        results.accounts?.push({
                            username: inserted.username,
                            id: inserted.id,
                            status: 'inserted',
                        });
                        logger.info('Account inserted', { username: inserted.username, id: inserted.id });
                    }
                }
            } catch (accountError) {
                logger.error('Error processing account', { account: accountInput, error: accountError });
                results.errors++;
                results.accounts?.push({
                    username: accountInput.username || 'unknown',
                    id: '',
                    status: 'error',
                    error: accountError instanceof Error ? accountError.message : 'Unknown error',
                });
            }
        }

        // 6. Log final results
        logger.info('Webhook processing complete', {
            workspace_id,
            source,
            batch_id: metadata?.batch_id,
            results: {
                inserted: results.inserted,
                updated: results.updated,
                duplicates: results.duplicates,
                errors: results.errors,
            },
        });

        // 7. Return response
        const response: WebhookResponse = {
            success: true,
            inserted: results.inserted,
            updated: results.updated,
            duplicates: results.duplicates,
            errors: results.errors,
            accounts: results.accounts,
        };

        return NextResponse.json(response, { status: 200 });

    } catch (error) {
        logger.error('Webhook error', { error });
        return NextResponse.json(
            {
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

// GET method to return endpoint documentation
export async function GET() {
    return NextResponse.json({
        endpoint: '/api/scraping/webhook',
        method: 'POST',
        description: 'Universal webhook for receiving Instagram accounts from multiple sources',
        authentication: 'X-API-Key header',
        sources: ['apify', 'csv', 'manual', 'zapier', 'n8n', 'api'],
        request_example: {
            source: 'apify',
            workspace_id: 'ws_abc123',
            accounts: [
                {
                    username: 'istanbulluxuryhomes',
                    full_name: 'Istanbul Luxury Homes',
                    follower_count: 45200,
                },
            ],
            metadata: {
                batch_id: 'apify_run_xyz789',
                tags: ['luxury', 'istanbul'],
                auto_validate: false,
            },
        },
        response_example: {
            success: true,
            inserted: 1,
            updated: 0,
            duplicates: 0,
            errors: 0,
            accounts: [
                {
                    username: 'istanbulluxuryhomes',
                    id: '123e4567-e89b-12d3-a456-426614174000',
                    status: 'inserted',
                },
            ],
        },
    });
}
