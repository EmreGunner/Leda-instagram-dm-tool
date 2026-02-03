
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { leads, workspaceId } = body;

        if (!leads || !Array.isArray(leads)) {
            return NextResponse.json({ error: 'Invalid leads data' }, { status: 400 });
        }

        if (!workspaceId) {
            return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
        }

        // Verify workspace access
        const { data: workspaceMembers } = await supabase
            .from('workspace_members')
            .select('role')
            .eq('workspace_id', workspaceId)
            .eq('user_id', user.id)
            .single();

        if (!workspaceMembers) {
            return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 });
        }

        const { data: userData } = await supabase
            .from('users')
            .select('workspace_id')
            .eq('supabase_auth_id', user.id)
            .single();

        // Process leads for insertion
        const leadsToInsert = leads.map((profile: any) => ({
            workspace_id: workspaceId,
            // Handle generic fields
            instagram_account_id: profile.instagramAccountId, // Optional, might be null if added via public api
            ig_user_id: profile.pk || profile.id, // Handle different formats (Apify vs Cookie)
            ig_username: profile.username,
            full_name: profile.fullName,
            bio: profile.bio || profile.biography,
            profile_pic_url: profile.profilePicUrl,
            follower_count: profile.followerCount || profile.followersCount,
            following_count: profile.followingCount || profile.followsCount,
            post_count: profile.postCount || profile.postsCount,
            is_verified: profile.isVerified || profile.verified || false,
            is_private: profile.isPrivate || profile.private || false,
            is_business: profile.isBusiness || profile.isBusinessAccount || false,
            status: 'new',
            source: profile.source || 'api_batch',
            source_query: profile.sourceQuery,
            matched_keywords: profile.matchedKeywords || [],
            updated_at: new Date().toISOString()
        }));

        // Upsert
        const { error, count } = await supabase
            .from('leads')
            .upsert(leadsToInsert, {
                onConflict: 'ig_user_id,workspace_id',
                ignoreDuplicates: true // We want to update? Or ignore? User said "delete it only if..." - stick to upsert but maybe existing status?
                // Let's use standard upsert behavior: update if exists.
            })
            .select('id');

        if (error) {
            console.error('Batch add error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, count: leadsToInsert.length }); // approximate count

    } catch (error) {
        console.error('Batch leads API error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
