import { NextRequest, NextResponse } from 'next/server';
import { InstagramCookieService } from '@/lib/server/instagram/cookie-service';

import { prisma } from '@/lib/server/prisma/client';

export async function POST(req: NextRequest) {
    try {
        const { cookies, username, limit = 12, workspaceId } = await req.json();

        if (!cookies || !username) {
            return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
        }

        const cookieService = new InstagramCookieService();

        // Parallel fetch: Media + User Profile (for tracking)
        const [media, userProfile] = await Promise.all([
            cookieService.getUserRecentMedia(cookies, username, limit, 'posts'),
            workspaceId ? cookieService.getUserProfileByUsername(cookies, username) : Promise.resolve(null)
        ]);

        // If workspaceId is provided, save as Target Account
        if (workspaceId && userProfile) {
            try {
                await prisma.targetAccount.upsert({
                    where: {
                        username_workspaceId: {
                            username: username,
                            workspaceId: workspaceId
                        }
                    },
                    update: {
                        fullName: userProfile.fullName,
                        biography: userProfile.bio,
                        followerCount: userProfile.followerCount,
                        followingCount: userProfile.followingCount,
                        postCount: userProfile.postCount,
                        isPrivate: userProfile.isPrivate,
                        isVerified: userProfile.isVerified,
                        lastScrapedAt: new Date(),
                        // Append 'real_estate_agency' tag if not present (PostgreSQL specific, but easier to just set for now or read-modify-write if strictly needed. For MVP, we ensure it's in the list)
                        // Prisma doesn't support array append easily in update without raw query, so we'll just set it for new ones or re-set it. 
                        // To be safe and simple: just set it. Or ideally, read first.
                        // For efficiency, let's just update statistics. Tags might be managed manually later.
                    },
                    create: {
                        username: username,
                        workspaceId: workspaceId,
                        fullName: userProfile.fullName,
                        biography: userProfile.bio,
                        followerCount: userProfile.followerCount,
                        followingCount: userProfile.followingCount,
                        postCount: userProfile.postCount,
                        isPrivate: userProfile.isPrivate,
                        isVerified: userProfile.isVerified,
                        isTracked: true,
                        tags: ['real_estate_agency'],
                        lastScrapedAt: new Date()
                    }
                });
                console.log(`[API] Upserted TargetAccount: ${username}`);
            } catch (dbError) {
                console.error('[API] Failed to save TargetAccount:', dbError);
                // Don't fail the request if DB save fails
            }
        }

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
