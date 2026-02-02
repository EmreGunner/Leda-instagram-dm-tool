import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma/client';
import { InstagramCookieService } from '@/lib/server/instagram/cookie-service';
import { createClient } from '@/lib/supabase/server';
import { analyzeCommentIntent } from '@/lib/server/ai/gemini-service';

export async function POST(req: NextRequest) {
    try {
        const { cookies } = await req.json();

        if (!cookies) {
            return NextResponse.json({ success: false, error: 'Cookies required' }, { status: 400 });
        }

        // 1. Fetch next available job
        const job = await prisma.jobQueue.findFirst({
            where: {
                status: 'QUEUED',
                scheduledAt: { lte: new Date() }
            },
            orderBy: { scheduledAt: 'asc' }
        });

        if (!job) {
            return NextResponse.json({ success: true, message: 'No jobs pending', job: null });
        }

        // 2. Lock job
        await prisma.jobQueue.update({
            where: { id: job.id },
            data: { status: 'PROCESSING', sentAt: new Date() } // reusing sentAt as 'startedAt'
        });

        console.log(`[CTL-System] Processing job ${job.id} (${job.jobType})`);

        const cookieService = new InstagramCookieService();

        try {
            const payload = job.payload as any;

            // ==================================================================
            // DISCOVERY JOB: Find posts from a target user
            // ==================================================================
            if (job.jobType === 'DISCOVERY_JOB') {
                const { targetUsername, durationHours } = payload;

                // Fetch recent posts
                const mediaItems = await cookieService.getUserRecentMedia(cookies, targetUsername, 12, 'posts');
                console.log(`[CTL-System] Discovery found ${mediaItems.length} posts for ${targetUsername}`);

                // Schedule analysis jobs for each post
                // Stagger them to avoid rate limits (e.g., 2 minutes apart)
                const newJobs = [];
                let delayMinutes = 1;

                // FILTER: LAST 30 DAYS ONLY
                const thirtyDaysAgo = Date.now() / 1000 - (30 * 24 * 60 * 60); // Instagram timestamps are seconds
                const freshMedia = mediaItems.filter(m => m.taken_at > thirtyDaysAgo);

                console.log(`[CTL-System] Date Filter: ${mediaItems.length} -> ${freshMedia.length} posts (Last 30 Days)`);

                for (const media of freshMedia) {
                    const analysisJob = await prisma.jobQueue.create({
                        data: {
                            workspaceId: job.workspaceId,
                            campaignId: job.campaignId, // Propagate if exists
                            senderUsername: job.senderUsername,
                            senderInstagramAccountId: job.senderInstagramAccountId,
                            jobType: 'EXTRACTION_JOB',
                            status: 'QUEUED',
                            payload: {
                                mediaId: media.id,
                                mediaCode: media.code,
                                caption: media.caption?.text,
                                targetUsername: targetUsername
                            },
                            // Stagger: 2-5 mins gap + random jitter
                            scheduledAt: new Date(Date.now() + (delayMinutes * 60 * 1000) + (Math.random() * 60000))
                        }
                    });
                    newJobs.push(analysisJob);
                    delayMinutes += (Math.random() * 3) + 2; // Add 2-5 mins for next one
                }

                // Mark as completed
                await prisma.jobQueue.update({
                    where: { id: job.id },
                    data: { status: 'COMPLETED' }
                });

                // RECURSIVE SCHEDULING (Auto-Pilot Loop)
                if (payload.frequency) {
                    const freqHours = parseInt(payload.frequency) || 4; // Default 4h if string '4h' parse fails
                    const nextRun = new Date(Date.now() + freqHours * 60 * 60 * 1000);

                    console.log(`[CTL-System] Rescheduling continuous discovery for ${targetUsername} at ${nextRun.toISOString()}`);

                    await prisma.jobQueue.create({
                        data: {
                            workspaceId: job.workspaceId,
                            senderUsername: job.senderUsername,
                            senderInstagramAccountId: job.senderInstagramAccountId,
                            jobType: 'DISCOVERY_JOB',
                            status: 'QUEUED',
                            payload: payload, // Pass original payload including frequency
                            scheduledAt: nextRun
                        }
                    });
                }

                return NextResponse.json({ success: true, jobType: 'DISCOVERY', newJobsCreated: newJobs.length });
            }

            // ==================================================================
            // EXTRACTION JOB: Scrape comments from a specific post
            // ==================================================================
            else if (job.jobType === 'EXTRACTION_JOB') {
                const { mediaId, targetUsername } = payload;

                // Reuse the logic we built in extract-comments, or call the service directly
                // ideally we would call a shared function. For now, let's implement the core call.

                console.log(`[CTL-System] Extracting comments for media ${mediaId}`);

                // Intent keywords should ideally be stored in the job payload or workspace config
                // For now, hardcoding the defaults from the PRD/Manual mode or fetching from a 'config' would be best.
                // Let's assume standard keywords for this "Auto" mode:
                const intentKeywords = ['price', 'cost', 'how much', 'fiyat', 'ne kadar', 'kac', 'kaç'];
                const lowerKeywords = intentKeywords;

                // Scrape
                const comments = await cookieService.getPostComments(cookies, mediaId, 50);
                const leadsFound = [];

                for (const comment of comments) {
                    const text = (comment.text || '').toLowerCase();
                    const matchedKeyword = lowerKeywords.find(k => text.includes(k));

                    if (matchedKeyword) {
                        let aiScore = 0;
                        let aiReason = 'Keyword Match';

                        // AI ENRICHMENT (If enabled or implicitly "necessary" for high quality)
                        // For this implementation, we run it if environment key exists to better score leads
                        if (process.env.GEMINI_API_KEY) {
                            const analysis = await analyzeCommentIntent(comment.text, payload.caption);
                            if (analysis.isHighIntent) {
                                aiScore = analysis.score;
                                aiReason = analysis.reason;
                            } else {
                                // If AI says it's low intent, valid keyword match might still be worth saving but with lower score
                                // or we could skip it. Let's keep it but mark score low.
                                aiScore = analysis.score;
                                aiReason = `AI Low Confidence: ${analysis.reason}`;
                            }
                        }

                        leadsFound.push({
                            igUserId: comment.user.pk,
                            igUsername: comment.user.username,
                            fullName: comment.user.fullName,
                            profilePicUrl: comment.user.profilePicUrl,
                            isVerified: comment.user.isVerified || false,
                            isPrivate: comment.user.isPrivate || false,
                            matchedKeyword: matchedKeyword,
                            commentText: comment.text,
                            leadScore: aiScore,
                            notes: aiReason
                        });
                    }
                }

                // Save Leads (Deduplicated)
                if (leadsFound.length > 0) {
                    // Need supabase client here
                    const supabase = await createClient(); // WARNING: This needs a valid session or Service Role. 
                    // Since this API is called by client (Manual Mode trigger) or cron, 
                    // if called by cron we need service role. 
                    // For now, assuming client-side trigger carries auth config.

                    // Simulating save for now to stay concise, 
                    // in real implementation we'd copy the saving logic from extract-comments
                    console.log(`[CTL-System] Found ${leadsFound.length} leads. Saving...`);

                    // Re-fetch lead lists or insert logic here...
                    for (const lead of leadsFound) {
                        // Try to insert if not exists
                        const { error } = await supabase.from('leads').insert({
                            igUserId: lead.igUserId,
                            igUsername: lead.igUsername,
                            fullName: lead.fullName || '',
                            profilePicUrl: lead.profilePicUrl || '',
                            workspaceId: job.workspaceId,
                            status: 'new',
                            sourceQuery: `Post: ${mediaId} (@${targetUsername})`,
                            matchedKeywords: [lead.matchedKeyword],
                            notes: lead.notes || `Auto-found: "${lead.commentText}"`,
                            leadScore: lead.leadScore
                        });
                        if (error) console.error('Error saving lead:', error.message);
                    }
                }

                await prisma.jobQueue.update({
                    where: { id: job.id },
                    data: { status: 'COMPLETED' }
                });

                return NextResponse.json({
                    success: true,
                    jobType: 'EXTRACTION',
                    leadsFound: leadsFound.length
                });
            }

            // Unknown Job Type
            else {
                await prisma.jobQueue.update({
                    where: { id: job.id },
                    data: { status: 'FAILED', payload: { ...payload, error: 'Unknown Job Type' } }
                });
                return NextResponse.json({ success: false, error: 'Unknown Job Type' });
            }

        } catch (err: any) {
            console.error(`[CTL-System] Job Failed:`, err);
            await prisma.jobQueue.update({
                where: { id: job.id },
                data: { status: 'FAILED', sentAt: undefined } // clear 'startedAt' effectively
            });
            return NextResponse.json({ success: false, error: err.message });
        }

    } catch (error: any) {
        console.error('[CTL-System] Process Job API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
