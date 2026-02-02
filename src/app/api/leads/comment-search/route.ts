import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InstagramCookieService } from '@/lib/server/instagram/cookie-service';
import { requireAuth } from '@/lib/server/auth';

export async function POST(req: NextRequest) {
    try {
        // Get authenticated user and workspace
        const auth = await requireAuth(req);
        if (auth instanceof Response) return auth; // Returns 401 if not authenticated

        const { mediaIds, intentKeywords, cookies } = await req.json();

        if (!mediaIds || !Array.isArray(mediaIds) || !intentKeywords || !cookies) {
            return NextResponse.json({ success: false, error: 'Missing required parameters: mediaIds (array) and intentKeywords are required' }, { status: 400 });
        }

        const supabase = await createClient();
        const cookieService = new InstagramCookieService();

        // 2. Scraping & Filtering Phase
        let leadsFound: any[] = [];
        const intentLower = intentKeywords.map((k: string) => k.toLowerCase());

        console.log(`Starting surgical comment extraction for ${mediaIds.length} posts.`);
        console.log(`Intent keywords: ${intentLower.join(', ')}`);

        for (const post of mediaIds) {
            console.log(`Fetching comments for media: ${post.id} (code: ${post.code})`);

            // Scrape comments for this post
            const comments = await cookieService.getPostComments(cookies, post.id, 100); // Increased limit for surgical mode
            console.log(`Found ${comments.length} total comments for post ${post.id}`);

            for (const comment of comments) {
                // Skip author's own comments (assuming we can identify author, or generic check)
                // If we attached author info to post object, we could check. 
                // For now, let's skip if matchedKeyword seems like an answer? No, relies on intent.

                const commentText = (comment.text || '').toLowerCase();

                // check if comment matches intent
                const matchedKeyword = intentLower.find((k: string) => commentText.includes(k));

                if (matchedKeyword) {
                    console.log(`  Match found! User: ${comment.user.username}, Keyword: ${matchedKeyword}`);
                    leadsFound.push({
                        pk: comment.user.pk,
                        username: comment.user.username,
                        fullName: comment.user.fullName,
                        profilePicUrl: comment.user.profilePicUrl,
                        isPrivate: comment.user.isPrivate || false,
                        isVerified: comment.user.isVerified || false,
                        matchedKeyword: matchedKeyword,
                        sourcePostUrl: `https://instagram.com/p/${post.code}/`,
                        sourcePostCaption: post.caption,
                        commentText: comment.text,
                        commentDate: new Date(comment.createdAt * 1000).toISOString(),
                        source: 'comment-to-lead',
                        sourceQuery: `Surgical - ${matchedKeyword}`
                    });
                }
            }
        }

        // Deduplicate leads by user PK
        const uniqueLeads = Array.from(new Map(leadsFound.map(item => [item.pk, item])).values());

        console.log(`Extracted ${uniqueLeads.length} unique high-intent leads.`);

        // ✅ FIX: Save leads to database
        const workspaceId = auth.workspaceId;

        if (!workspaceId) {
            console.error('[Lead Save] No workspace ID found');
            return NextResponse.json({
                success: false,
                error: 'No workspace selected'
            }, { status: 400 });
        }

        console.log(`[Lead Save] Saving ${uniqueLeads.length} leads to workspace: ${workspaceId}`);

        const savedLeads = [];
        for (const lead of uniqueLeads) {
            try {
                // Check if lead already exists
                const { data: existing } = await supabase
                    .from('leads')
                    .select('id')
                    .eq('ig_user_id', lead.pk) // Schema uses ig_user_id not pk
                    .eq('workspace_id', workspaceId)
                    .single();

                if (existing) {
                    console.log(`[Lead Save] Lead ${lead.username} already exists, skipping`);
                    savedLeads.push({ id: existing.id, ...lead });
                    continue;
                }

                // Insert new lead - only fields that exist in schema
                const { data: newLead, error } = await supabase
                    .from('leads')
                    .insert({
                        id: crypto.randomUUID(), // Generate UUID for id field
                        workspace_id: workspaceId,
                        ig_user_id: lead.pk, // Schema uses ig_user_id not pk
                        ig_username: lead.username, // Schema uses ig_username not username
                        full_name: lead.fullName,
                        profile_pic_url: lead.profilePicUrl,
                        is_private: lead.isPrivate,
                        is_verified: lead.isVerified,
                        source: 'comment-to-lead',
                        source_query: lead.sourceQuery,
                        updated_at: new Date().toISOString(), // Required field
                        notes: `📝 Comment: ${lead.commentText}\n\n🔗 Post: ${lead.sourcePostUrl}\n\n📸 Post Owner: ${lead.postOwner || 'N/A'}\n\n🔑 Matched Keyword: ${lead.matchedKeyword}\n\n📅 Comment Date: ${lead.commentDate ? new Date(lead.commentDate * 1000).toLocaleDateString() : 'N/A'}\n\n📋 Post Caption: ${lead.sourcePostCaption ? lead.sourcePostCaption.substring(0, 200) + '...' : 'N/A'}` // Store ALL comment metadata in notes field
                    })
                    .select()
                    .single();

                if (error) {
                    console.error(`[Lead Save] Error saving lead ${lead.username}:`, error);
                } else {
                    console.log(`[Lead Save] ✅ Saved lead: ${lead.username} (ID: ${newLead.id})`);
                    savedLeads.push(newLead);
                }

            } catch (saveError) {
                console.error(`[Lead Save] Exception saving lead ${lead.username}:`, saveError);
            }
        }

        console.log(`[Lead Save] Successfully saved ${savedLeads.length}/${uniqueLeads.length} leads`);

        return NextResponse.json({
            success: true,
            users: uniqueLeads,
            savedCount: savedLeads.length,
            meta: {
                postsScanned: mediaIds.length,
                commentsScanned: leadsFound.length // rough proxy, not accurate count of all comments
            }
        });

    } catch (error: any) {
        console.error('Comment-to-Lead Search Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
