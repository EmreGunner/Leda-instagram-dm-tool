/**
 * Scraping Accounts CRUD API
 * GET /api/scraping/accounts - List accounts
 * POST /api/scraping/accounts - Add single account manually
 * PATCH /api/scraping/accounts - Update account
 * DELETE /api/scraping/accounts - Delete account
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger as baseLogger } from '@/lib/logger';

// GET - List scraping accounts for workspace
export async function GET(request: NextRequest) {
    const logger = baseLogger.child({ endpoint: '/api/scraping/accounts', method: 'GET' });

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's workspace
        const { data: userData } = await supabase
            .from('users')
            .select('workspace_id')
            .eq('supabase_auth_id', user.id)
            .single();

        if (!userData?.workspace_id) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        // Parse query params
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // pending, approved, rejected
        const is_tracked = searchParams.get('is_tracked');
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');

        logger.info('Fetching scraping accounts', {
            workspace_id: userData.workspace_id,
            status,
            limit,
            offset,
        });

        // Build query
        let query = supabase
            .from('scraping_accounts')
            .select('*', { count: 'exact' })
            .eq('workspace_id', userData.workspace_id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('validation_status', status);
        }

        if (is_tracked !== null) {
            query = query.eq('is_tracked', is_tracked === 'true');
        }

        const { data, error, count } = await query;

        if (error) {
            logger.error('Error fetching accounts', { error });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        logger.info('Accounts fetched', { count });

        return NextResponse.json({
            success: true,
            accounts: data,
            total: count,
            limit,
            offset,
        });

    } catch (error) {
        logger.error('Error in GET /api/scraping/accounts', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Add single account manually
export async function POST(request: NextRequest) {
    const logger = baseLogger.child({ endpoint: '/api/scraping/accounts', method: 'POST' });

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: userData } = await supabase
            .from('users')
            .select('id, workspace_id')
            .eq('supabase_auth_id', user.id)
            .single();

        if (!userData?.workspace_id) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const body = await request.json();
        const { username, tags, notes, priority } = body;

        if (!username) {
            return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        logger.info('Adding scraping account manually', {
            workspace_id: userData.workspace_id,
            username,
            added_by: userData.id,
        });

        // Check if already exists
        const { data: existing } = await supabase
            .from('scraping_accounts')
            .select('id')
            .eq('workspace_id', userData.workspace_id)
            .eq('username', username.toLowerCase().trim())
            .single();

        if (existing) {
            return NextResponse.json(
                { error: 'Account already exists', account_id: existing.id },
                { status: 409 }
            );
        }

        // Insert new account
        const { data, error } = await supabase
            .from('scraping_accounts')
            .insert({
                workspace_id: userData.workspace_id,
                username: username.toLowerCase().trim(),
                tags: tags || [],
                notes: notes || null,
                scraping_priority: priority || 0,
                added_via: 'manual',
                added_by: userData.id,
                validation_status: 'pending',
                is_validated: false,
            })
            .select()
            .single();

        if (error) {
            logger.error('Error inserting account', { error });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        logger.info('Account added successfully', { account_id: data.id, username });

        return NextResponse.json({
            success: true,
            account: data,
        });

    } catch (error) {
        logger.error('Error in POST /api/scraping/accounts', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH - Update account (validation, priority, etc.)
export async function PATCH(request: NextRequest) {
    const logger = baseLogger.child({ endpoint: '/api/scraping/accounts', method: 'PATCH' });

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: userData } = await supabase
            .from('users')
            .select('id, workspace_id')
            .eq('supabase_auth_id', user.id)
            .single();

        if (!userData?.workspace_id) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const body = await request.json();
        const { account_id, validation_status, is_tracked, scraping_priority, tags, notes } = body;

        if (!account_id) {
            return NextResponse.json({ error: 'account_id is required' }, { status: 400 });
        }

        logger.info('Updating scraping account', {
            workspace_id: userData.workspace_id,
            account_id,
            validation_status,
        });

        // Build update object
        const updates: any = {};

        if (validation_status !== undefined) {
            updates.validation_status = validation_status;
            updates.is_validated = validation_status === 'approved';
            if (validation_status === 'approved') {
                updates.validated_by = userData.id;
                updates.validated_at = new Date().toISOString();
            }
        }

        if (is_tracked !== undefined) updates.is_tracked = is_tracked;
        if (scraping_priority !== undefined) updates.scraping_priority = scraping_priority;
        if (tags !== undefined) updates.tags = tags;
        if (notes !== undefined) updates.notes = notes;

        // Update account
        const { data, error } = await supabase
            .from('scraping_accounts')
            .update(updates)
            .eq('id', account_id)
            .eq('workspace_id', userData.workspace_id) // Ensure workspace isolation
            .select()
            .single();

        if (error) {
            logger.error('Error updating account', { error });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        logger.info('Account updated successfully', { account_id });

        return NextResponse.json({
            success: true,
            account: data,
        });

    } catch (error) {
        logger.error('Error in PATCH /api/scraping/accounts', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Delete account
export async function DELETE(request: NextRequest) {
    const logger = baseLogger.child({ endpoint: '/api/scraping/accounts', method: 'DELETE' });

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: userData } = await supabase
            .from('users')
            .select('workspace_id')
            .eq('supabase_auth_id', user.id)
            .single();

        if (!userData?.workspace_id) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const account_id = searchParams.get('id');

        if (!account_id) {
            return NextResponse.json({ error: 'account_id is required' }, { status: 400 });
        }

        logger.info('Deleting scraping account', {
            workspace_id: userData.workspace_id,
            account_id,
        });

        const { error } = await supabase
            .from('scraping_accounts')
            .delete()
            .eq('id', account_id)
            .eq('workspace_id', userData.workspace_id); // Ensure workspace isolation

        if (error) {
            logger.error('Error deleting account', { error });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        logger.info('Account deleted successfully', { account_id });

        return NextResponse.json({
            success: true,
            message: 'Account deleted',
        });

    } catch (error) {
        logger.error('Error in DELETE /api/scraping/accounts', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
