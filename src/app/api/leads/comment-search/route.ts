import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InstagramCookieService } from '@/lib/server/instagram/cookie-service';

export async function POST(req: NextRequest) {
    try {
        const { location, listingKeywords, intentKeywords, dateRange, cookies } = await req.json();

        if (!location || !listingKeywords || !intentKeywords || !cookies) {
            return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
        }

        // CRITICAL FIX: Await the createClient() call
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const cookieService = new InstagramCookieService();

        // 1. Discovery Phase: Find posts
        // Search hashtags combining location + listing keywords (e.g., #beşiktaşsatılık)
        // Also simple location hashtag
        const searchHashtags = [
            location.replace(/\s+/g, '').toLowerCase(),
            ...listingKeywords.map((k: string) => `${location.replace(/\s+/g, '')}${k.replace(/\s+/g, '')}`.toLowerCase())
        ];

        console.log(`Starting comment-to-lead search for hashtags: ${searchHashtags.join(', ')}`);

        let allPosts: any[] = [];

        // Limit total posts to verify to avoid rate limits
        const MAX_POSTS_TO_CHECK = 50;

        for (const tag of searchHashtags.slice(0, 3)) { // Check top 3 hashtag variations
            try {
                const posts = await cookieService.getHashtagPosts(cookies, tag, 20); // Get 20 posts per tag
                allPosts = [...allPosts, ...posts];
                if (allPosts.length >= MAX_POSTS_TO_CHECK) break;
            } catch (e) {
                console.warn(`Failed to fetch posts for #${tag}:`, e);
            }
        }

        // Filter posts by date range
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - (dateRange || 30));

        // Filter posts by caption keywords (secondary check)
        const validPosts = allPosts.filter(post => {
            const postDate = new Date(post.takenAt * 1000);
            if (postDate < cutoffDate) return false;

            const caption = (post.caption || '').toLowerCase();
            // Must contain at least one listing keyword if not implicitly found via specific hashtag
            // But if we searched #location + listing_keyword, it's likely relevant.
            // Let's enforce finding at least one listing keyword in caption for higher quality
            return listingKeywords.some((k: string) => caption.includes(k.toLowerCase()));
        });

        console.log(`Found ${validPosts.length} relevant posts from ${allPosts.length} candidates.`);

        // 2. Scraping & Filtering Phase
        let leadsFound: any[] = [];
        const intentLower = intentKeywords.map((k: string) => k.toLowerCase());

        for (const post of validPosts) {
            // Scrape comments for this post
            const comments = await cookieService.getPostComments(cookies, post.id, 50); // Check top 50 comments per post

            for (const comment of comments) {
                // Skip author's own comments
                if (comment.user.pk === post.user.pk) continue;

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
                        sourceQuery: `${location} - ${matchedKeyword}`
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
                postsScanned: validPosts.length,
                commentsScanned: leadsFound.length // rough proxy
            }
        });

    } catch (error: any) {
        console.error('Comment-to-Lead Search Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
