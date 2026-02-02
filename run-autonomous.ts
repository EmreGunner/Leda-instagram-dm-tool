#!/usr/bin/env ts-node

/**
 * AUTONOMOUS ENGINE RUNNER
 * Run this script to start the 4000-lead collection mission
 * 
 * Usage: npm run autonomous
 */

import { AutonomousEngine } from './src/lib/server/autonomous/engine';
import { getCookies as getCookiesFromStorage } from './src/lib/instagram-cookie-storage';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🤖 AUTONOMOUS LEAD GENERATION ENGINE');
    console.log('=====================================\n');

    // Get workspace and Instagram account
    const workspace = await prisma.workspace.findFirst();
    if (!workspace) {
        console.error('❌ No workspace found. Please set up your workspace first.');
        process.exit(1);
    }

    const account = await prisma.instagramAccount.findFirst({
        where: {
            workspaceId: workspace.id,
            isActive: true
        }
    });

    if (!account) {
        console.error('❌ No active Instagram account found.');
        console.error('   Please connect an Instagram account in Settings.');
        process.exit(1);
    }

    // Get cookies
    const cookies = getCookiesFromStorage({
        igUserId: account.igUserId,
        igUsername: account.igUsername
    });

    if (!cookies) {
        console.error('❌ No Instagram session found.');
        console.error('   Please log in using the Chrome extension.');
        process.exit(1);
    }

    console.log(`✅ Workspace: ${workspace.name}`);
    console.log(`✅ Instagram: @${account.igUsername}`);
    console.log(`🎯 Target: 4000 real estate leads\n`);

    // Start the engine
    const engine = new AutonomousEngine();

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Stopping engine...');
        engine.stop();
        process.exit(0);
    });

    // Start the mission
    await engine.start(cookies, workspace.id);
}

main()
    .catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
