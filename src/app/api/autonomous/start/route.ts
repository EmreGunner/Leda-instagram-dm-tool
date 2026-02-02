import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma/client';
import { AutonomousEngine } from '@/lib/server/autonomous/engine';
import { getCookies as getCookiesFromStorage } from '@/lib/instagram-cookie-storage';

/**
 * POST /api/autonomous/start
 * Starts the autonomous lead generation engine
 */
export async function POST(req: NextRequest) {
    try {
        // For autonomous mode, bypass strict auth and find workspace/account directly
        // This allows the script to run without browser session

        const workspace = await prisma.workspace.findFirst();
        if (!workspace) {
            return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
        }

        const account = await prisma.instagramAccount.findFirst({
            where: {
                workspaceId: workspace.id,
                isActive: true
            }
        });

        if (!account) {
            return NextResponse.json({ error: 'No active Instagram account' }, { status: 400 });
        }

        // Get cookies
        const cookies = getCookiesFromStorage({
            igUserId: account.igUserId,
            igUsername: account.igUsername
        });

        if (!cookies) {
            return NextResponse.json({ error: 'No Instagram session found' }, { status: 400 });
        }

        // Start the engine in background
        const engine = new AutonomousEngine();

        // Run in background (don't await)
        engine.start(cookies, workspace.id).catch(error => {
            console.error('[Autonomous Engine] Fatal error:', error);
        });

        return NextResponse.json({
            success: true,
            message: 'Autonomous engine started. Check logs at ./autonomous_engine.log',
            workspace: workspace.name,
            account: account.igUsername
        });

    } catch (error: any) {
        console.error('[Autonomous API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * GET /api/autonomous/status
 * Check engine status
 */
export async function GET(req: NextRequest) {
    try {
        const fs = require('fs');
        const statePath = './autonomous_state.json';

        if (!fs.existsSync(statePath)) {
            return NextResponse.json({
                running: false,
                message: 'Engine not started'
            });
        }

        const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

        return NextResponse.json({
            running: true,
            leadsCollected: state.leadsCollected,
            cyclesCompleted: state.cyclesCompleted,
            targetAccounts: state.targetAccounts.length,
            processedPosts: state.processedPosts?.length || 0,
            uptime: Date.now() - state.startTime
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
