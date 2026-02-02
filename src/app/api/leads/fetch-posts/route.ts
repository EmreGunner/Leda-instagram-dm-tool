import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InstagramCookieService } from '@/lib/server/instagram/cookie-service';

export async function POST(req: NextRequest) {
    try {
        const { username, limit = 12, cookies } = await req.json();

        if (!username || !cookies) {
            return NextResponse.json(
                { success: false, error: 'Username and cookies are required' },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const cookieService = new InstagramCookieService();
        console.log(`[CTL-System] Fetching posts for: ${username}`);

        try {
            // Reuse existing service method
            const mediaItems = await cookieService.getUserRecentMedia(cookies, username, limit, 'posts');

            const simplifiedMedia = mediaItems.map((item: any) => ({
                id: item.id,
                code: item.code,
                // Handle different image version structures if necessary, but roughly:
                thumbnailUrl: item.image_versions2?.candidates?.[0]?.url || item.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url,
                caption: item.caption?.text || '',
                takenAt: item.taken_at,
                commentCount: item.comment_count,
                likeCount: item.like_count,
                type: item.media_type // 1=Image, 2=Video, 8=Carousel
            }));

            console.log(`[CTL-System] Found ${simplifiedMedia.length} posts for ${username}`);

            return NextResponse.json({
                success: true,
                media: simplifiedMedia
            });

        } catch (igError: any) {
            console.error(`[CTL-System] Instagram API Error (Fetch Posts):`, igError);
            return NextResponse.json(
                { success: false, error: igError.message || 'Failed to fetch posts' },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error('[CTL-System] Fetch Posts API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
