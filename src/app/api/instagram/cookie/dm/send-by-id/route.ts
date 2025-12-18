import { NextRequest, NextResponse } from 'next/server';
import { instagramCookieService } from '@/lib/server/instagram/cookie-service';
import { prisma } from '@/lib/server/prisma/client';
import { requireAuth } from '@/lib/server/auth';
import type { InstagramCookies } from '@/lib/server/instagram/types';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { cookies, recipientUserId, message, accountId } = await request.json() as {
      cookies: InstagramCookies;
      recipientUserId: string | number;
      message: string;
      accountId?: string;
    };

    if (!cookies || !cookies.sessionId || !cookies.dsUserId) {
      return NextResponse.json(
        { success: false, error: 'Invalid cookies provided' },
        { status: 400 }
      );
    }

    if (!recipientUserId || !message) {
      return NextResponse.json(
        { success: false, error: 'recipientUserId and message are required' },
        { status: 400 }
      );
    }

    // Ensure recipientUserId is a string (convert from number if needed)
    const userIdStr = String(recipientUserId).trim();
    
    // Log for debugging (remove in production if needed)
    console.log('Sending DM to user ID:', userIdStr, 'Message length:', message.length);

    const result = await instagramCookieService.sendDMByUserId(
      cookies,
      userIdStr,
      message
    );

    // If DM was sent successfully, increment daily DM count
    if (result.success && accountId) {
      try {
        // Get account to check current count and reset time
        const account = await prisma.instagramAccount.findUnique({
          where: { id: accountId },
          select: { dmsSentToday: true, dmLimitResetAt: true },
        });

        if (account) {
          const now = new Date();
          const resetAt = account.dmLimitResetAt || now;
          
          // Check if we need to reset (if reset time has passed)
          const shouldReset = resetAt < now;
          
          await prisma.instagramAccount.update({
            where: { id: accountId },
            data: {
              dmsSentToday: shouldReset ? 1 : { increment: 1 },
              dmLimitResetAt: shouldReset 
                ? new Date(now.getTime() + 24 * 60 * 60 * 1000) // Reset in 24 hours
                : account.dmLimitResetAt || new Date(now.getTime() + 24 * 60 * 60 * 1000),
            },
          });
          
          console.log(`✓ Updated daily DM count for account ${accountId}`);
        }
      } catch (updateError) {
        console.error('Error updating daily DM count:', updateError);
        // Don't fail the request if count update fails
      }
    }

    if (!result.success) {
      console.error('Failed to send DM:', result.error);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error sending DM by ID:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send DM',
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

