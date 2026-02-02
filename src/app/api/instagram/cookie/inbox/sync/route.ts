import { NextRequest, NextResponse } from 'next/server';
import { instagramCookieService } from '@/lib/server/instagram/cookie-service';
import { prisma } from '@/lib/server/prisma/client';
import { requireAuth } from '@/lib/server/auth';
import type { InstagramCookies } from '@/lib/server/instagram/types';
import { automationEngine } from '@/lib/server/automation/engine';

// Helper to safely parse Instagram timestamps (may be in microseconds or invalid)
function safeDate(timestamp: any): string {
  if (!timestamp) return new Date().toISOString();

  try {
    // Instagram timestamps can be in microseconds (13+ digits) or milliseconds
    let ts = Number(timestamp);
    if (isNaN(ts)) return new Date().toISOString();

    // If timestamp is in microseconds (13+ digits), convert to milliseconds
    if (ts > 9999999999999) {
      ts = Math.floor(ts / 1000);
    }
    // If timestamp is in seconds (10 digits), convert to milliseconds
    if (ts < 10000000000) {
      ts = ts * 1000;
    }

    const date = new Date(ts);
    if (isNaN(date.getTime())) return new Date().toISOString();

    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth; // Error response

    const { cookies, accountId } = await request.json() as {
      cookies: InstagramCookies;
      accountId: string;
    };

    if (!cookies || !cookies.sessionId || !cookies.dsUserId) {
      return NextResponse.json(
        { success: false, error: 'Invalid cookies provided' },
        { status: 400 }
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'accountId is required' },
        { status: 400 }
      );
    }

    const finalWorkspaceId = auth.workspaceId;

    // Get inbox threads from Instagram
    const threads = await instagramCookieService.getInbox(cookies, 20);

    let syncedConversations = 0;
    let syncedMessages = 0;

    // ✅ OPTIMIZATION 1: Batch contact upserts
    const contactOperations = threads.map(thread => {
      const otherUser = thread.users[0];
      if (!otherUser) return null;

      return prisma.contact.upsert({
        where: {
          igUserId_workspaceId: {
            igUserId: otherUser.pk,
            workspaceId: finalWorkspaceId,
          },
        },
        create: {
          workspaceId: finalWorkspaceId,
          igUserId: otherUser.pk,
          igUsername: otherUser.username,
          name: otherUser.fullName,
          profilePictureUrl: otherUser.profilePicUrl,
        },
        update: {
          igUsername: otherUser.username,
          name: otherUser.fullName,
          profilePictureUrl: otherUser.profilePicUrl,
        },
      });
    }).filter(Boolean);

    const contacts = await Promise.all(contactOperations);

    // ✅ OPTIMIZATION 2: Batch conversation upserts  
    const conversationOperations = threads.map((thread, index) => {
      const contact = contacts[index];
      if (!contact) return null;

      return prisma.conversation.upsert({
        where: {
          instagramAccountId_contactId: {
            instagramAccountId: accountId,
            contactId: contact.id,
          },
        },
        create: {
          instagramAccountId: accountId,
          contactId: contact.id,
          status: 'OPEN',
          lastMessageAt: safeDate(thread.lastActivity),
          unreadCount: thread.unreadCount,
        },
        update: {
          lastMessageAt: safeDate(thread.lastActivity),
          unreadCount: thread.unreadCount,
        },
      });
    }).filter(Boolean);

    const conversations = await Promise.all(conversationOperations);
    syncedConversations = conversations.length;

    // ✅ OPTIMIZATION 3: Parallel message processing with batched duplicate checks
    const messageProcessingPromises = threads.map(async (thread, index) => {
      try {
        const conversation = conversations[index];
        const contact = contacts[index];
        const otherUser = thread.users[0];

        if (!conversation || !contact || !otherUser) return 0;

        // Fetch messages for this thread
        const messages = await instagramCookieService.getThreadMessages(
          cookies,
          thread.threadId,
          30
        );

        if (messages.length === 0) return 0;

        // ✅ BATCH: Fetch ALL existing message IDs for this conversation in ONE query
        const messageIds = messages.map(m => m.itemId);
        const existingMessages = await prisma.message.findMany({
          where: {
            conversationId: conversation.id,
            igMessageId: { in: messageIds },
          },
          select: {
            id: true,
            igMessageId: true,
            direction: true,
            readAt: true,
            deliveredAt: true,
            status: true,
          },
        });

        // Create a lookup map for O(1) existence checks
        const existingMap = new Map(
          existingMessages.map(m => [m.igMessageId, m])
        );

        const newMessages = [];
        const messagesToUpdate = [];

        for (const msg of messages) {
          if (!msg.text) continue;

          const isFromUs = msg.userId === cookies.dsUserId;
          const existing = existingMap.get(msg.itemId);

          if (!existing) {
            // New message - prepare for batch insert
            let messageStatus: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' = 'DELIVERED';
            if (isFromUs) {
              messageStatus = (msg as any).readAt ? 'READ' : ((msg as any).deliveredAt ? 'DELIVERED' : 'SENT');
            }

            newMessages.push({
              conversationId: conversation.id,
              igMessageId: msg.itemId,
              content: msg.text,
              messageType: 'TEXT',
              direction: isFromUs ? 'OUTBOUND' : 'INBOUND',
              status: messageStatus,
              sentAt: safeDate(msg.timestamp),
              deliveredAt: (msg as any).deliveredAt ? safeDate((msg as any).deliveredAt) : null,
              readAt: (msg as any).readAt ? safeDate((msg as any).readAt) : null,
              createdAt: safeDate(msg.timestamp),
            });

            // Trigger automation for new inbound messages (async, don't await)
            if (!isFromUs) {
              automationEngine.processMessage({
                workspaceId: finalWorkspaceId,
                instagramAccountId: accountId,
                contactId: contact.id,
                contactUsername: otherUser.username,
                contactIgUserId: otherUser.pk,
                messageContent: msg.text,
                conversationId: conversation.id,
              }).catch(err => console.error('Automation error:', err));
            }
          } else {
            // Update existing message status if needed
            if (isFromUs && existing.direction === 'OUTBOUND') {
              const updateData: any = {};
              if ((msg as any).readAt && !existing.readAt) {
                updateData.readAt = safeDate((msg as any).readAt);
                updateData.status = 'READ';
              } else if ((msg as any).deliveredAt && !existing.deliveredAt) {
                updateData.deliveredAt = safeDate((msg as any).deliveredAt);
                if (existing.status !== 'READ') {
                  updateData.status = 'DELIVERED';
                }
              }

              if (Object.keys(updateData).length > 0) {
                messagesToUpdate.push({
                  id: existing.id,
                  data: updateData,
                });
              }
            }
          }
        }

        // ✅ BATCH: Insert all new messages at once
        let insertedCount = 0;
        if (newMessages.length > 0) {
          await prisma.message.createMany({
            data: newMessages as any,
            skipDuplicates: true,
          });
          insertedCount = newMessages.length;
        }

        // ✅ BATCH: Update messages in parallel (if needed)
        if (messagesToUpdate.length > 0) {
          await Promise.all(
            messagesToUpdate.map(({ id, data }) =>
              prisma.message.update({ where: { id }, data })
            )
          );
        }

        return insertedCount;
      } catch (threadError: any) {
        console.error(`Error syncing thread ${thread.threadId}:`, threadError);
        return 0;
      }
    });

    // ✅ OPTIMIZATION 4: Process all threads in parallel (with limit to avoid overwhelming)
    // Process in batches of 5 to avoid overwhelming the database
    const BATCH_SIZE = 5;
    for (let i = 0; i < messageProcessingPromises.length; i += BATCH_SIZE) {
      const batch = messageProcessingPromises.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch);
      syncedMessages += results.reduce((sum, count) => sum + count, 0);
    }

    return NextResponse.json({
      success: true,
      syncedConversations,
      syncedMessages,
    });
  } catch (error: any) {
    console.error('Error syncing inbox:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync inbox',
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
