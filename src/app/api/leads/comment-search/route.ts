import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InstagramCookieService } from '@/lib/server/instagram/cookie-service';
import { requireAuth } from '@/lib/server/auth';
import { LocationDetector } from '@/lib/server/location-detector';



export async function POST(req: NextRequest) {
    try {
        // Get authenticated user and workspace
        const auth = await requireAuth(req);
        if (auth instanceof Response) return auth; // Returns 401 if not authenticated

        const { mediaIds, intentKeywords, cookies, dateFrom, dateTo } = await req.json();

        if (!mediaIds || !Array.isArray(mediaIds) || !intentKeywords || !cookies) {
            return NextResponse.json({ success: false, error: 'Missing required parameters: mediaIds (array) and intentKeywords are required' }, { status: 400 });
        }

        const supabase = await createClient();
        const cookieService = new InstagramCookieService();

        // 2. Scraping & Filtering Phase
        let leadsFound: any[] = [];
        const intentLower = intentKeywords.map((k: string) => k.toLowerCase());

        // Parse dates if provided
        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(dateTo) : null;

        console.log(`Starting surgical comment extraction for ${mediaIds.length} posts.`);
        console.log(`Intent keywords: ${intentLower.join(', ')}`);
        if (fromDate) console.log(`Date From: ${fromDate.toISOString()}`);
        if (toDate) console.log(`Date To: ${toDate.toISOString()}`);

        // Helper for chunked parallel execution
        const processInChunks = async <T, R>(
            items: T[],
            batchSize: number,
            task: (item: T) => Promise<R>
        ): Promise<R[]> => {
            const results: R[] = [];
            for (let i = 0; i < items.length; i += batchSize) {
                const chunk = items.slice(i, i + batchSize);
                const chunkResults = await Promise.all(chunk.map(task));
                results.push(...chunkResults);
            }
            return results;
        };

        // 2. Scraping & Filtering Phase (Parallelized)
        console.log(`Starting surgical comment extraction for ${mediaIds.length} posts.`);
        console.log(`Intent keywords: ${intentLower.join(', ')}`);

        const processPost = async (post: any) => {
            const postLeads: any[] = [];
            try {
                console.log(`Fetching comments for media: ${post.id} (code: ${post.code})`);

                // Scrape comments for this post
                const comments = await cookieService.getPostComments(cookies, post.id, 100);
                console.log(`Found ${comments.length} total comments for post ${post.id}`);

                for (const comment of comments) {
                    // Check date range
                    const commentDate = new Date(comment.createdAt * 1000); // Instagram returns seconds
                    if (fromDate && commentDate < fromDate) continue;
                    if (toDate && commentDate > toDate) continue;

                    const commentText = (comment.text || '').toLowerCase();

                    // check if comment matches intent
                    const matchedKeyword = intentLower.find((k: string) => commentText.includes(k));

                    if (matchedKeyword) {
                        // Detect metadata from caption
                        const detector = LocationDetector.getInstance();
                        const caption = (post.caption || '').toString();

                        const location = detector.detectLocation(caption);
                        const propertyType = detector.detectPropertyType(caption);
                        const propertySubType = detector.detectPropertySubType(caption);
                        const listingType = detector.detectListingType(caption);

                        // Scoring Logic 
                        const now = new Date();
                        const diffDays = (now.getTime() - commentDate.getTime()) / (1000 * 60 * 60 * 24);

                        let leadScore = 50;
                        if (diffDays < 1) leadScore = 100;
                        else if (diffDays <= 7) leadScore = 90;
                        else if (diffDays <= 14) leadScore = 70;
                        else if (diffDays <= 30) leadScore = 50;
                        else leadScore = 30;

                        postLeads.push({
                            pk: comment.user.pk,
                            username: comment.user.username,
                            fullName: comment.user.fullName,
                            profilePicUrl: comment.user.profilePicUrl,
                            isPrivate: comment.user.isPrivate || false,
                            isVerified: comment.user.isVerified || false,
                            matchedKeyword: matchedKeyword,
                            sourcePostUrl: `https://instagram.com/p/${post.code}/`,
                            sourcePostCaption: post.caption,

                            // New Detected Fields
                            city: location?.city,
                            town: location?.town,
                            propertyType: propertyType,
                            propertySubType: propertySubType,
                            listingType: listingType,

                            commentText: comment.text,
                            commentDate: commentDate.toISOString(),
                            commentLink: `https://instagram.com/p/${post.code}/c/${comment.pk}/`,

                            leadScore: leadScore,
                            source: 'comment-to-lead',
                            sourceQuery: `Comment Match: ${matchedKeyword}`
                        });
                    }
                }
            } catch (err) {
                console.error(`Error processing post ${post.id}:`, err);
            }
            return postLeads;
        };

        // Process posts in chunks of 5
        const allPostLeads = await processInChunks(mediaIds, 5, processPost);
        // Assign to the previously defined variable or use a new name if needed, 
        // but since leadsFound was initialized as [], we can just overwrite or concat.
        // Actually, leadsFound was defined at line 25.
        // Let's just rename this one to allLeads and use it, or assign back to leadsFound.
        leadsFound = allPostLeads.flat();

        // Deduplicate leads by user PK
        const uniqueLeads = Array.from(new Map(leadsFound.map(item => [item.pk, item])).values());

        console.log(`Extracted ${uniqueLeads.length} unique high-intent leads.`);

        // ✅ FIX: Save leads to database (Parallelized)
        const workspaceId = auth.workspaceId;

        if (!workspaceId) {
            console.error('[Lead Save] No workspace ID found');
            return NextResponse.json({
                success: false,
                error: 'No workspace selected'
            }, { status: 400 });
        }

        console.log(`[Lead Save] Saving ${uniqueLeads.length} leads to workspace: ${workspaceId}`);

        const saveLead = async (lead: any) => {
            try {
                // Check if lead already exists
                const { data: existing } = await supabase
                    .from('leads')
                    .select('id, comment_count, city, town, property_type, listing_type, property_sub_type, tags')
                    .eq('ig_user_id', lead.pk)
                    .eq('workspace_id', workspaceId)
                    .single();

                if (existing) {
                    const updates: any = {
                        updated_at: new Date().toISOString(),
                        comment_count: (existing.comment_count || 1) + 1,
                        city: existing.city || lead.city,
                        town: existing.town || lead.town,
                        property_type: existing.property_type || lead.propertyType,
                        property_sub_type: existing.property_sub_type || lead.propertySubType,
                        listing_type: existing.listing_type || lead.listingType,
                        lead_score: lead.leadScore,
                        comment_date: lead.commentDate,
                        comment_link: lead.commentLink,
                        tags: existing.tags ? (existing.tags.includes('real_estate_lead') ? existing.tags : [...existing.tags, 'real_estate_lead']) : ['real_estate_lead']
                    };

                    let categoryDisplay = lead.listingType ? (lead.listingType === 'Sale' ? '🏷️ For Sale' : '🏠 For Rent') : '❓ Unknown';
                    if (!lead.listingType && lead.propertyType) categoryDisplay = `❓ Detected: ${lead.propertyType} (Action Unknown)`;

                    const locationDisplay = lead.city ? `📍 ${lead.city}${lead.town ? ` / ${lead.town}` : ''}` : '📍 Unknown Location';
                    const subTypeDisplay = lead.propertySubType ? ` (${lead.propertySubType})` : '';

                    updates.notes = `📝 Comment: ${lead.commentText}\n\n🔗 Post: ${lead.sourcePostUrl}\n\n🏠 Type: ${categoryDisplay}\n\n🏗️ Property: ${lead.propertyType || 'N/A'}${subTypeDisplay}\n\n${locationDisplay}\n\n🔑 Keyword: ${lead.matchedKeyword}\n\n📅 Date: ${new Date(lead.commentDate).toLocaleDateString()}\n\n📋 Caption: ${lead.sourcePostCaption || 'N/A'}`;

                    await supabase.from('leads').update(updates).eq('id', existing.id);
                    return { id: existing.id, ...lead, isNew: false };
                } else {
                    // Insert new lead
                    const { data: newLead, error } = await supabase
                        .from('leads')
                        .insert({
                            id: crypto.randomUUID(),
                            workspace_id: workspaceId,
                            ig_user_id: lead.pk,
                            ig_username: lead.username,
                            full_name: lead.fullName,
                            profile_pic_url: lead.profilePicUrl,
                            is_private: lead.isPrivate,
                            is_verified: lead.isVerified,
                            source: 'comment-to-lead',
                            source_query: lead.sourceQuery,
                            city: lead.city,
                            town: lead.town,
                            property_type: lead.propertyType,
                            property_sub_type: lead.propertySubType,
                            listing_type: lead.listingType,
                            comment_count: 1,
                            lead_score: lead.leadScore,
                            post_link: lead.sourcePostUrl,
                            post_caption: lead.sourcePostCaption,
                            comment_date: lead.commentDate,
                            comment_link: lead.commentLink,
                            tags: ['real_estate_lead'],
                            updated_at: new Date().toISOString(),
                            notes: `📝 Comment: ${lead.commentText}\n\n🔗 Post: ${lead.sourcePostUrl}\n\n🏠 Type: ${lead.listingType || 'Unknown'}\n\n🏗️ Property: ${lead.propertyType || 'N/A'}${lead.propertySubType ? ` (${lead.propertySubType})` : ''}\n\n📍 Location: ${lead.city || 'Unknown'}\n\n🔑 Keyword: ${lead.matchedKeyword}\n\n📅 Date: ${new Date(lead.commentDate).toLocaleDateString()}\n\n📋 Caption: ${lead.sourcePostCaption || 'N/A'}`
                        })
                        .select('id')
                        .single();

                    if (error) throw error;
                    return { ...newLead, ...lead, isNew: true };
                }
            } catch (saveError) {
                console.error(`[Lead Save] Exception saving lead ${lead.username}:`, saveError);
                return null;
            }
        };

        // Save leads in chunks of 10
        const saveResults = await processInChunks(uniqueLeads, 10, saveLead);
        const savedLeads = saveResults.filter(l => l !== null);

        console.log(`[Lead Save] Successfully saved ${savedLeads.length}/${uniqueLeads.length} leads`);

        return NextResponse.json({
            success: true,
            users: savedLeads,
            savedCount: savedLeads.filter(l => l.isNew).length,
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
