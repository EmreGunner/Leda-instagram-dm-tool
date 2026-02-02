import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/server/prisma/client';

export async function POST(req: NextRequest) {
    try {
        const { targetUsernames, frequency = '4h', duration = 4 } = await req.json();

        if (!targetUsernames || !Array.isArray(targetUsernames)) {
            return NextResponse.json(
                { success: false, error: 'Target usernames array is required' },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Get workspace ID
        const { data: userData } = await supabase
            .from('users')
            .select('workspaceId')
            .eq('supabaseAuthId', user.id)
            .single();

        if (!userData?.workspaceId) {
            return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
        }

        // Get an active Instagram account for the workspace to likely perform the job
        const account = await prisma.instagramAccount.findFirst({
            where: { workspaceId: userData.workspaceId, isActive: true }
        });

        if (!account) {
            return NextResponse.json({ success: false, error: 'No active Instagram account found in workspace' }, { status: 400 });
        }

        const jobs = [];
        const startTime = new Date();

        for (const target of targetUsernames) {
            const job = await prisma.jobQueue.create({
                data: {
                    workspaceId: userData.workspaceId,
                    senderUsername: account.igUsername, // Using a workspace account as the 'performer'
                    senderInstagramAccountId: account.id,
                    jobType: 'DISCOVERY_JOB',
                    status: 'QUEUED',
                    payload: {
                        targetUsername: target,
                        durationHours: duration,
                        frequency: frequency
                    },
                    scheduledAt: startTime
                }
            });
            jobs.push(job);
        }

        console.log(`[CTL-System] Scheduled ${jobs.length} discovery jobs.`);

        return NextResponse.json({
            success: true,
            jobsScheduled: jobs.length,
            firstJobId: jobs[0]?.id
        });

    } catch (error: any) {
        console.error('[CTL-System] Schedule Job API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
