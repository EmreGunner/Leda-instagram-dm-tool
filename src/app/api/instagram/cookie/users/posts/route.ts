import { NextRequest, NextResponse } from 'next/server';
import { InstagramCookieService } from '@/lib/server/instagram/cookie-service';

export async function POST(req: NextRequest) {
    try {
        const { cookies, username, limit = 12 } = await req.json();

        if (!cookies || !username) {
            return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
        }

        const cookieService = new InstagramCookieService();
        const media = await cookieService.getUserRecentMedia(cookies, username, limit, 'posts');

        console.log('[API] Fetched media count:', media.length);
        if (media.length > 0) {
            console.log('[API] First post sample:', JSON.stringify(media[0], null, 2));
        }

        // Service already returns data in camelCase format, pass it through directly
        const mappedMedia = media.map(item => ({
            id: item.id,
            code: item.shortcode || item.code, // Service returns 'shortcode'
            shortcode: item.shortcode,
            caption: item.caption, // Already a string from service
            thumbnailUrl: item.thumbnailUrl, // Direct field from service (camelCase)
            likeCount: item.likeCount, // Service uses camelCase
            commentCount: item.commentCount, // Service uses camelCase
            takenAt: item.takenAt, // Service uses camelCase
            mediaType: item.mediaType,
            url: item.url
        }));

        if (mappedMedia.length > 0) {
            console.log('[API] Mapped first post:', JSON.stringify(mappedMedia[0], null, 2));
        }

        return NextResponse.json({
            success: true,
            media: mappedMedia
        });

    } catch (error: any) {
        console.error('Fetch Posts Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
