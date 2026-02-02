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

        return NextResponse.json({
            success: true,
            media: media.map(item => ({
                id: item.id || item.pk,
                code: item.code,
                caption: item.caption?.text || '',
                thumbnailUrl: item.thumbnail_url || item.image_versions2?.candidates?.[0]?.url,
                likeCount: item.like_count,
                commentCount: item.comment_count,
                takenAt: item.taken_at,
                mediaType: item.media_type, // 1=Image, 2=Video, 8=Carousel
                productType: item.product_type
            }))
        });

    } catch (error: any) {
        console.error('Fetch Posts Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
