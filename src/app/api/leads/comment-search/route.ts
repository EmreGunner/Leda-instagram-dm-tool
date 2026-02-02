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

                    // Detect metadata from caption
                    const detector = LocationDetector.getInstance();
                    const caption = (post.caption || '').toString();

                    const location = detector.detectLocation(caption);
                    const propertyType = detector.detectPropertyType(caption);
                    const propertySubType = detector.detectPropertySubType(caption);
                    const listingType = detector.detectListingType(caption);

                    // Scoring Logic
                    const commentDate = new Date(comment.createdAt * 1000);
                    const now = new Date();
                    const diffDays = (now.getTime() - commentDate.getTime()) / (1000 * 60 * 60 * 24);

                    let leadScore = 50;
                    if (diffDays < 1) leadScore = 100;
                    else if (diffDays <= 7) leadScore = 90;
                    else if (diffDays <= 14) leadScore = 70;
                    else if (diffDays <= 30) leadScore = 50;
                    else leadScore = 30;

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

                        // New Detected Fields
                        city: location?.city,
                        town: location?.town,
                        propertyType: propertyType,
                        propertySubType: propertySubType,
                        listingType: listingType,

                        commentText: comment.text,
                        commentDate: commentDate.toISOString(),
                        // Construct comment link (approximation as IG doesn't give direct comment URL easily without ID iteration, 
                        // but we can try linking to post)
                        commentLink: `https://instagram.com/p/${post.code}/c/${comment.pk}/`,

                        leadScore: leadScore,

                        source: 'comment-to-lead',
                        sourceQuery: `Comment Match: ${matchedKeyword}`
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
                    .select('id, comment_count, city, town, property_type, listing_type, property_sub_type, tags')
                    .eq('ig_user_id', lead.pk) // Schema uses ig_user_id not pk
                    .eq('workspace_id', workspaceId)
                    .single();

                if (existing) {
                    console.log(`[Lead Save] Lead ${lead.username} exists. Updating. Date: ${lead.commentDate} (Source: ${lead.commentDate})`);


                    const updates: any = {
                        updated_at: new Date().toISOString(),
                        comment_count: (existing.comment_count || 1) + 1,
                        // Update enriched fields if found and currently null
                        city: existing.city || lead.city,
                        town: existing.town || lead.town,
                        property_type: existing.property_type || lead.propertyType,
                        property_sub_type: existing.property_sub_type || lead.propertySubType,
                        listing_type: existing.listing_type || lead.listingType,
                        lead_score: lead.leadScore, // Always update score for freshness
                        comment_date: lead.commentDate,
                        comment_link: lead.commentLink,
                        // Append 'real_estate_lead' tag if not present
                        tags: existing.tags ? (existing.tags.includes('real_estate_lead') ? existing.tags : [...existing.tags, 'real_estate_lead']) : ['real_estate_lead']
                    };

                    // Generate Smart Note
                    let categoryDisplay = lead.listingType ? (lead.listingType === 'Sale' ? '🏷️ For Sale' : '🏠 For Rent') : '❓ Unknown';
                    if (!lead.listingType && lead.propertyType) categoryDisplay = `❓ Detected: ${lead.propertyType} (Action Unknown)`;

                    const locationDisplay = lead.city ? `📍 ${lead.city}${lead.town ? ` / ${lead.town}` : ''}` : '📍 Unknown Location';
                    const subTypeDisplay = lead.propertySubType ? ` (${lead.propertySubType})` : '';

                    updates.notes = `📝 Comment: ${lead.commentText}\n\n🔗 Post: ${lead.sourcePostUrl}\n\n🏠 Type: ${categoryDisplay}\n\n🏗️ Property: ${lead.propertyType || 'N/A'}${subTypeDisplay}\n\n${locationDisplay}\n\n🔑 Keyword: ${lead.matchedKeyword}\n\n📅 Date: ${new Date(lead.commentDate).toLocaleDateString()}\n\n📋 Caption: ${lead.sourcePostCaption || 'N/A'}`;

                    await supabase
                        .from('leads')
                        .update(updates)
                        .eq('id', existing.id);

                    savedLeads.push({ id: existing.id, ...lead, isNew: false });
                    continue;
                }

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

                        // New Fields
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

                        // Default tag for this source
                        tags: ['real_estate_lead'],

                        updated_at: new Date().toISOString(),
                        notes: `📝 Comment: ${lead.commentText}\n\n🔗 Post: ${lead.sourcePostUrl}\n\n🏠 Type: ${lead.listingType || 'Unknown'}\n\n🏗️ Property: ${lead.propertyType || 'N/A'}${lead.propertySubType ? ` (${lead.propertySubType})` : ''}\n\n📍 Location: ${lead.city || 'Unknown'}\n\n🔑 Keyword: ${lead.matchedKeyword}\n\n📅 Date: ${new Date(lead.commentDate).toLocaleDateString()}\n\n📋 Caption: ${lead.sourcePostCaption || 'N/A'}`
                    })
                    .select('id')
                    .single();

                if (error) {
                    console.error(`[Lead Save] Error saving lead ${lead.username}:`, error);
                } else {
                    console.log(`[Lead Save] ✅ Saved lead: ${lead.username} (ID: ${newLead.id})`);
                    savedLeads.push({ ...newLead, ...lead, isNew: true });
                }

            } catch (saveError) {
                console.error(`[Lead Save] Exception saving lead ${lead.username}:`, saveError);
            }
        }

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
