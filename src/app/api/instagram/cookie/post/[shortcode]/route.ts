import { NextRequest, NextResponse } from 'next/server';
import { InstagramCookieService } from '@/lib/server/instagram/cookie-service';

export async function POST(
    req: NextRequest,
    { params }: { params: { shortcode: string } }
) {
    try {
        const { cookies } = await req.json();
        const { shortcode } = params;

        if (!cookies || !shortcode) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        const cookieService = new InstagramCookieService();

        console.log('[Manual Post] Fetching post by shortcode:', shortcode);

        // Get post info by shortcode
        const post = await cookieService.getPostByShortcode(cookies, shortcode);

        console.log('[Manual Post] Fetched successfully:', {
            id: post.id,
            shortcode: post.shortcode,
            commentCount: post.commentCount
        });

        return NextResponse.json({
            success: true,
            post
        });

    } catch (error: any) {
        console.error('[Manual Post] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
