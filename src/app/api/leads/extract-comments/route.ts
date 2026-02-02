import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InstagramCookieService } from '@/lib/server/instagram/cookie-service';

export async function POST(req: NextRequest) {
    try {
        const { mediaIds, intentKeywords, cookies, simulate = false } = await req.json();

        if (!mediaIds || !Array.isArray(mediaIds) || !intentKeywords || !Array.isArray(intentKeywords) || !cookies) {
            return NextResponse.json(
                { success: false, error: 'Media IDs, intent keywords, and cookies are required' },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Get workspace ID for the user
        const { data: userData } = await supabase
            .from('users')
            .select('workspaceId')
            .eq('supabaseAuthId', user.id)
            .single();

        if (!userData?.workspaceId) {
            return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
        }

        const cookieService = new InstagramCookieService();
        console.log(`[CTL-System] Extracting comments from ${mediaIds.length} posts. Keywords: ${intentKeywords.join(', ')}`);

        // Normalize keywords
        const lowerKeywords = intentKeywords.map((k: string) => k.toLowerCase());

        let leadsFound: any[] = [];
        const processedMediaIds = new Set<string>();

        try {
            for (const media of mediaIds) {
                // Basic check to ensure we have an ID
                const mediaId = typeof media === 'string' ? media : media.id;
                if (!mediaId) continue;

                // Skip if already processed in this batch
                if (processedMediaIds.has(mediaId)) continue;
                processedMediaIds.add(mediaId);

                console.log(`[CTL-System] Scraping media: ${mediaId}`);

                // Add random delay to be safe (1-3 seconds)
                await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

                const comments = await cookieService.getPostComments(cookies, mediaId, 50); // Limit 50 per post for safety

                for (const comment of comments) {
                    const text = (comment.text || '').toLowerCase();

                    // Check for intent match
                    const matchedKeyword = lowerKeywords.find((k: string) => text.includes(k));

                    if (matchedKeyword) {
                        leadsFound.push({
                            igUserId: comment.user.pk,
                            igUsername: comment.user.username,
                            fullName: comment.user.fullName,
                            profilePicUrl: comment.user.profilePicUrl,
                            isVerified: comment.user.isVerified,
                            isPrivate: comment.user.isPrivate,
                            match: {
                                keyword: matchedKeyword,
                                commentText: comment.text,
                                commentId: comment.pk,
                                mediaId: mediaId,
                                mediaCode: media.code // Assuming media object has code
                            }
                        });
                    }
                }
            }

            console.log(`[CTL-System] Found ${leadsFound.length} potential leads.`);

            // Deduplicate within the batch by ID
            const uniqueLeads = Array.from(new Map(leadsFound.map(item => [item.igUserId, item])).values());

            let savedCount = 0;

            if (!simulate) {
                // Save to Database
                for (const lead of uniqueLeads) {
                    // Check if lead exists in workspace
                    const { data: existing } = await supabase
                        .from('leads')
                        .select('id, matchedKeywords')
                        .eq('igUserId', lead.igUserId)
                        .eq('workspaceId', userData.workspaceId)
                        .single();

                    if (existing) {
                        // Update existing lead with new keyword if not present
                        const currentKeywords = existing.matchedKeywords || [];
                        if (!currentKeywords.includes(lead.match.keyword)) {
                            await supabase
                                .from('leads')
                                .update({
                                    matchedKeywords: [...currentKeywords, lead.match.keyword],
                                    updatedAt: new Date().toISOString()
                                })
                                .eq('id', existing.id);
                        }
                    } else {
                        // Create new lead
                        await supabase.from('leads').insert({
                            igUserId: lead.igUserId,
                            igUsername: lead.igUsername,
                            fullName: lead.fullName,
                            profilePicUrl: lead.profilePicUrl,
                            isVerified: lead.isVerified,
                            isPrivate: lead.isPrivate,
                            workspaceId: userData.workspaceId,
                            status: 'new',
                            source: 'comment-to-lead',
                            sourceQuery: `Post: ${lead.match.mediaId}`,
                            matchedKeywords: [lead.match.keyword],
                            notes: `Comment: "${lead.match.commentText}" on Post ${lead.match.mediaId}`
                        });
                        savedCount++;
                    }
                }
            }

            return NextResponse.json({
                success: true,
                leads_found: uniqueLeads.length,
                leads_saved: savedCount,
                details: uniqueLeads // Return details for UI to display immediately
            });

        } catch (igError: any) {
            console.error(`[CTL-System] Instagram API Error (Extract):`, igError);
            return NextResponse.json(
                { success: false, error: igError.message || 'Failed to extract comments' },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error('[CTL-System] Extract Comments API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
