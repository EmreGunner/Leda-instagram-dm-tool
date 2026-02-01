import { prisma } from '@/lib/server/prisma/client';

/**
 * Automation Engine
 * Processes incoming messages and triggers automations (Reply DMs)
 */
export const automationEngine = {
    /**
     * Process a new incoming message to check for automation triggers
     */
    async processMessage(params: {
        workspaceId: string;
        instagramAccountId: string;
        contactId: string;
        contactUsername: string;
        contactIgUserId: string;
        messageContent: string;
        conversationId: string;
    }) {
        const {
            workspaceId,
            instagramAccountId,
            contactId,
            contactUsername,
            contactIgUserId,
            messageContent,
            conversationId
        } = params;

        try {
            // 1. Fetch active automations for this account
            const automations = await prisma.automation.findMany({
                where: {
                    instagramAccountId,
                    isActive: true,
                    workspaceId,
                },
            });

            if (automations.length === 0) return;

            // 2. Fetch our account details (for sender info)
            const account = await prisma.instagramAccount.findUnique({
                where: { id: instagramAccountId },
                select: { igUsername: true, igUserId: true },
            });

            if (!account) return;

            const lowerMsg = messageContent.toLowerCase();

            // 3. Evaluate each automation
            for (const automation of automations) {
                let isMatch = false;

                // --- Trigger: Keyword match ---
                if (automation.triggerType === 'Keyword match') {
                    if (automation.triggerKeywords && automation.triggerKeywords.length > 0) {
                        // Check if ANY keyword is present in the message
                        isMatch = automation.triggerKeywords.some(keyword =>
                            lowerMsg.includes(keyword.toLowerCase())
                        );
                    }
                }
                // --- Trigger: New message ---
                else if (automation.triggerType === 'New message') {
                    // This usually implies responding to every *new* conversation or message
                    // For safety, let's treat it as "Every message" for now, but user might expect "First message".
                    // Given the context of "Auto-reply", it often means "Default Reply".
                    isMatch = true;
                }

                if (isMatch) {
                    console.log(`[Automation] Triggered '${automation.name}' (ID: ${automation.id}) for user @${contactUsername}`);

                    // Create Job in Queue
                    await prisma.jobQueue.create({
                        data: {
                            workspaceId,
                            campaignId: automation.id, // Map Automation ID to Campaign ID
                            leadId: contactId,         // Map Contact ID to Lead ID

                            // Job Details
                            senderUsername: account.igUsername,
                            jobType: 'DM',
                            payload: {
                                message: automation.responseTemplate || '',
                            },
                            scheduledAt: new Date(),
                            status: 'QUEUED',

                            // Expanded Details
                            senderInstagramAccountId: instagramAccountId,
                            senderIgUserId: account.igUserId,
                            senderIgUsername: account.igUsername,

                            recipientUserId: contactIgUserId,
                            recipientUsername: contactUsername,
                            campaignName: automation.name,
                        },
                    });

                    // Increment usage counter
                    await prisma.automation.update({
                        where: { id: automation.id },
                        data: { messagesHandled: { increment: 1 } },
                    });
                }
            }
        } catch (error) {
            console.error('[Automation] Error processing message:', error);
        }
    },
};
