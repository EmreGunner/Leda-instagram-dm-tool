import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InstagramCookieService } from '@/lib/server/instagram/cookie-service';

export async function POST(req: NextRequest) {
    try {
        const { username, cookies } = await req.json();

        if (!username || !cookies) {
            return NextResponse.json(
                { success: false, error: 'Username and cookies are required' },
                { status: 400 }
            );
        }

        // Initialize Supabase to ensure authenticated user
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const cookieService = new InstagramCookieService();

        // Clean username
        const cleanUsername = username.replace('@', '').trim();

        console.log(`[CTL-System] Validating target user: ${cleanUsername}`);

        try {
            const profile = await cookieService.getUserProfileByUsername(cookies, cleanUsername);

            if (!profile) {
                return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
            }

            console.log(`[CTL-System] Target validated: ${profile.username} (PK: ${profile.pk})`);

            return NextResponse.json({
                success: true,
                profile: {
                    pk: profile.pk,
                    username: profile.username,
                    fullName: profile.fullName,
                    profilePicUrl: profile.profilePicUrl,
                    isPrivate: profile.isPrivate,
                    isVerified: profile.isVerified
                }
            });

        } catch (igError: any) {
            console.error(`[CTL-System] Instagram API Error:`, igError);
            return NextResponse.json(
                { success: false, error: igError.message || 'Failed to validate user' },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error('[CTL-System] Validate Target API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
