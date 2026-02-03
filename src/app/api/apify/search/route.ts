import { NextRequest, NextResponse } from 'next/server';
import { apifyService } from '@/lib/server/apify/service';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(options: NextRequest) {
    try {
        const body = await options.json();
        const { searchTerms, searchType = 'user', limit = 50 } = body;

        if (!searchTerms) {
            return NextResponse.json({ error: 'Search terms required' }, { status: 400 });
        }

        const supabase = await createClient(); // Fixed: await and no args
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get workspace (assuming single workspace for now or logic to get it)
        // For now, let's fetch the first workspace or use a default if available
        // In a real multi-tenant app, we'd pick from headers or user metadata
        const { data: workspaceData } = await supabase
            .from('workspaces')
            .select('id')
            .limit(1)
            .single();

        if (!workspaceData) {
            return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
        }

        const workspaceId = workspaceData.id;

        // Run Search
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
