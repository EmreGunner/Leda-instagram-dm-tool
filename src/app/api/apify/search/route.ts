import { NextRequest, NextResponse } from 'next/server';
import { apifyService } from '@/lib/server/apify/service';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(options: NextRequest) {
    try {
        const body = await options.json();
        const { searchTerms, searchType = 'user', limit = 50, action, runId, datasetId, offset = 0 } = body;

        if (!searchTerms && !runId) {
            return NextResponse.json({ error: 'Search terms or runId required' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch user's workspace
        let { data: userData, error: userError } = await supabase
            .from('users')
            .select('workspace_id')
            .eq('supabase_auth_id', user.id)
            .maybeSingle();

        // Fallback to email if not found by Auth ID
        if (!userData && user.email) {
            const { data: userDataByEmail } = await supabase
                .from('users')
                .select('workspace_id')
                .eq('email', user.email)
                .maybeSingle();

            if (userDataByEmail) {
                userData = userDataByEmail;
                userError = null;
            }
        }

        if (userError || !userData) {
            return NextResponse.json({ error: 'User profile not found. Please checks your database sync.' }, { status: 404 });
        }

        const workspaceId = userData.workspace_id;

        // --- ACTION: START ---
        if (action === 'start') {
            // Ensure searchTerms is a comma-separated string for Apify
            const termsStr = Array.isArray(searchTerms) ? searchTerms.join(',') : searchTerms;
            const run = await apifyService.startSearch(termsStr, limit);
            return NextResponse.json({
                success: true,
                runId: run.data.id,
                datasetId: run.data.defaultDatasetId,
                status: run.data.status
            });
        }

        // --- ACTION: POLL ---
        if (action === 'poll') {
            if (!runId || !datasetId) {
                return NextResponse.json({ error: 'Missing runId or datasetId for poll' }, { status: 400 });
            }

            const runStatus = await apifyService.getRun(runId);
            const status = runStatus.status;

            // Fetch new items since offset
            // Typically fetch a batch, e.g. 50?
            // The frontend should ask for items starting from 'offset'.
            // Apify API offset is 0-indexed. function getDatasetItems(id, offset, limit)
            const newItems = await apifyService.getDatasetItems(datasetId, offset, 50);

            let savedCount = 0;
            const failedItems = [];

            // Transform for DB
            for (const profile of newItems) {
                const priority = apifyService.calculatePriority(profile);
                const { error } = await supabase.from('account_queue').upsert({
                    username: profile.username,
                    full_name: profile.fullName,
                    biography: profile.biography,
                    external_url: profile.externalUrl,
                    business_category_name: profile.businessCategoryName,
                    business_address: JSON.stringify(profile.businessAddress),
                    is_business_account: profile.isBusinessAccount || false,
                    follower_count: profile.followersCount,
                    following_count: profile.followsCount,
                    post_count: profile.postsCount,
                    profile_pic_url: profile.profilePicUrl,
                    is_verified: profile.verified || false,
                    is_private: profile.private || false,
                    status: 'pending',
                    priority: priority,
                    workspace_id: workspaceId,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'username, workspace_id',
                    ignoreDuplicates: true
                });

                if (!error) savedCount++;
                else failedItems.push(profile.username);
            }

            return NextResponse.json({
                success: true,
                status: status,
                items: newItems.map(p => ({
                    pk: p.id,
                    username: p.username,
                    fullName: p.fullName,
                    biography: p.biography,
                    externalUrl: p.externalUrl,
                    isBusinessAccount: p.isBusinessAccount,
                    profilePicUrl: p.profilePicUrl,
                    isPrivate: p.private,
                    isVerified: p.verified,
                    followerCount: p.followersCount,
                    isNew: true // Just a flag
                })),
                savedCount,
                newOffset: offset + newItems.length
            });
        }

        // --- LEGACY BLOCKING (Fallback) ---
        // Run Search (Blocking)
        const results = await apifyService.searchUsers(searchTerms, limit);

        // Process and Save to DB
        let savedCount = 0;
        const failedItems = [];

        for (const profile of results) {
            // Priority Check
            const priority = apifyService.calculatePriority(profile);

            // Upsert Logic
            // Note: using 'username' and 'workspaceId' as unique constraint if defined in schema, 
            // but schema uses 'id'. 
            // We want to avoid duplicates. We should check if exists or use upsert if supported by simple supabase client,
            // but Prisma is better for this. Since we are in an API route, we could use Prisma if we imported it, 
            // but here we are using Supabase client as per imports.
            // Let's use Supabase client for consistency with other routes or switch to Prisma if needed.
            // The project uses both? `cookie-service` uses `prisma`. `comment-search` uses `createClient` (Supabase).
            // Let's use Prisma for easier upsert with relations if available, but the imports in `comment-search` suggest Supabase.
            // Wait, `comment-search` route imports: `import { createClient } from '@/lib/supabase/server';`
            // BUT `cookie-service` uses `prisma`.
            // I will use Supabase client for insert. 

            const { error } = await supabase.from('account_queue').upsert({
                username: profile.username,
                full_name: profile.fullName,
                biography: profile.biography,
                external_url: profile.externalUrl,
                business_category_name: profile.businessCategoryName,
                business_address: JSON.stringify(profile.businessAddress),
                is_business_account: profile.isBusinessAccount || false,
                follower_count: profile.followersCount,
                following_count: profile.followsCount,
                post_count: profile.postsCount,
                profile_pic_url: profile.profilePicUrl,
                is_verified: profile.verified || false,
                is_private: profile.private || false,
                status: 'pending',
                priority: priority,
                workspace_id: workspaceId,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'username, workspace_id',
                ignoreDuplicates: true // Or false to update? Let's update.
            });

            if (!error) {
                savedCount++;
            } else {
                console.error('Failed to save profile:', profile.username, error);
                failedItems.push(profile.username);
            }
        }

        return NextResponse.json({
            success: true,
            count: results.length,
            saved: savedCount,
            failed: failedItems,
            users: results.map(p => ({
                pk: p.id, // Apify ID is string
                username: p.username,
                fullName: p.fullName,
                profilePicUrl: p.profilePicUrl,
                isPrivate: p.private,
                isVerified: p.verified,
                followerCount: p.followersCount
            }))
        });

    } catch (error: any) {
        console.error('Apify Search Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
