import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InstagramCookieService } from '@/lib/server/instagram/cookie-service';

export async function POST(req: NextRequest) {
    try {
        const { mediaIds, intentKeywords, cookies } = await req.json();

        if (!mediaIds || !Array.isArray(mediaIds) || !intentKeywords || !cookies) {
            return NextResponse.json({ success: false, error: 'Missing required parameters: mediaIds (array) and intentKeywords are required' }, { status: 400 });
        }

        // CRITICAL FIX: Await the createClient() call
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const cookieService = new InstagramCookieService();

        console.log(`Starting surgical comment extraction for ${mediaIds.length} posts.`);

        // 2. Scraping & Filtering Phase
        let leadsFound: any[] = [];
        const intentLower = intentKeywords.map((k: string) => k.toLowerCase());

        for (const post of mediaIds) {
            // Scrape comments for this post
            const comments = await cookieService.getPostComments(cookies, post.id, 100); // Increased limit for surgical mode

            for (const comment of comments) {
                // Skip author's own comments (assuming we can identify author, or generic check)
                // If we attached author info to post object, we could check. 
                // For now, let's skip if matchedKeyword seems like an answer? No, relies on intent.

                const commentText = (comment.text || '').toLowerCase();

                // check if comment matches intent
                const matchedKeyword = intentLower.find((k: string) => commentText.includes(k));

                if (matchedKeyword) {
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

        return NextResponse.json({
            success: true,
            users: uniqueLeads,
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
