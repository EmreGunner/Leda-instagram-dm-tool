import { InstagramCookieService } from '@/lib/server/instagram/cookie-service';
import { AIAgentService } from '@/lib/server/ai/ai-agent-service';
import { prisma } from '@/lib/server/prisma/client';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * AUTONOMOUS LEAD GENERATION ENGINE
 * Runs continuously until 4000 real estate leads are collected
 * Uses cookie-based Instagram scraping + AI agent for scoring
 */

interface EngineState {
    leadsCollected: number;
    cyclesCompleted: number;
    startTime: number;
    targetAccounts: string[];
    processedPosts: Set<string>;
    lastGitCommit: number;
}

export class AutonomousEngine {
    private instagram: InstagramCookieService;
    private aiAgent: AIAgentService;
    private state: EngineState;
    private statePath = './autonomous_state.json';
    private logPath = './autonomous_engine.log';
    private isRunning = false;
    private targetLeadCount = 4000;

    // Seed real estate accounts
    private seedAccounts = [
        'emaar_properties', 'damacproperties', 'azizidevelopments',
        'istanbul_homes', 'turkey_property', 'london_property',
        'miami_luxury_homes', 'nyc_apartments', 'toronto_condos',
        'sydney_property', 'sothebysrealty', 'luxuryhomes'
    ];

    constructor() {
        this.instagram = new InstagramCookieService();
        this.aiAgent = new AIAgentService();
        this.state = this.loadState();
    }

    /**
     * Main entry point - starts the autonomous loop
     */
    async start(cookies: any, workspaceId: string) {
        this.isRunning = true;
        this.log('🚀 Autonomous Engine Starting...');
        this.log(`Target: ${this.targetLeadCount} leads`);
        this.log(`Workspace: ${workspaceId}`);

        while (this.isRunning) {
            try {
                // Check if we've reached goal
                const currentCount = await this.getLeadCount(workspaceId);
                this.state.leadsCollected = currentCount;

                if (currentCount >= this.targetLeadCount) {
                    await this.complete();
                    break;
                }

                this.log(`\n=== CYCLE ${this.state.cyclesCompleted + 1} ===`);
                this.log(`Current leads: ${currentCount}/${this.targetLeadCount}`);

                // Run one extraction cycle
                await this.runCycle(cookies, workspaceId);

                this.state.cyclesCompleted++;
                this.saveState();

                // Auto-commit to git every 10 cycles
                if (this.state.cyclesCompleted % 10 === 0) {
                    await this.gitCommit(`Cycle ${this.state.cyclesCompleted}: ${currentCount} leads collected`);
                }

                // Wait 2-3 minutes before next cycle
                const waitTime = 120000 + Math.random() * 60000; // 2-3 min
                this.log(`Waiting ${Math.round(waitTime / 1000)}s before next cycle...`);
                await this.sleep(waitTime);

            } catch (error) {
                this.log(`❌ Cycle error: ${error}`, true);
                this.saveState(); // Save state on error
                await this.sleep(60000); // Wait 1 min on error
            }
        }
    }

    /**
     * Run a single extraction cycle
     */
    private async runCycle(cookies: any, workspaceId: string) {
        // Pick a target account
        const targetUsername = this.state.targetAccounts[
            this.state.cyclesCompleted % this.state.targetAccounts.length
        ];

        this.log(`📍 Target: @${targetUsername}`);

        try {
            // Fetch recent posts
            const posts = await this.instagram.getUserRecentMedia(cookies, targetUsername, 12, 'posts');
            this.log(`Found ${posts.length} posts`);

            let newLeadsThisCycle = 0;

            // Process each post
            for (const post of posts) {
                const postId = post.id;

                // Skip if already processed
                if (this.state.processedPosts.has(postId)) {
                    continue;
                }

                this.log(`  📄 Post ${postId.substring(0, 8)}... (${post.comment_count || 0} comments)`);

                // Fetch comments
                const comments = await this.instagram.getPostComments(cookies, postId, 50);
                this.log(`    Fetched ${comments.length} comments`);

                if (comments.length === 0) {
                    this.state.processedPosts.add(postId);
                    continue;
                }

                // Score comments using AI agent
                const commentData = comments.map(c => ({
                    username: c.user.username,
                    text: c.text || ''
                }));

                const scores = await this.aiAgent.scoreComments(commentData);

                // Filter high-intent comments (score >= 70)
                const highIntentComments = scores
                    .filter((s: any) => s.score >= 70)
                    .map((s: any) => ({
                        ...comments[s.index],
                        score: s.score,
                        reason: s.reason
                    }));

                this.log(`    ✅ ${highIntentComments.length} high-intent comments`);

                // Extract leads
                for (const comment of highIntentComments) {
                    try {
                        const lead = await this.extractLead(
                            comment,
                            workspaceId,
                            targetUsername,
                            postId
                        );

                        if (lead) {
                            newLeadsThisCycle++;
                            this.log(`      💎 Lead saved: @${comment.user.username} (score: ${comment.score})`);
                        }
                    } catch (error: any) {
                        if (error.code === '23505' || error.message?.includes('duplicate')) {
                            this.log(`      ⏭️  Duplicate: @${comment.user.username}`);
                        } else {
                            this.log(`      ⚠️  Error saving @${comment.user.username}: ${error.message}`);
                        }
                    }
                }

                this.state.processedPosts.add(postId);

                // Rate limiting
                await this.sleep(2000);
            }

            this.log(`✨ Cycle complete: +${newLeadsThisCycle} new leads`);

        } catch (error: any) {
            this.log(`❌ Error processing @${targetUsername}: ${error.message}`, true);
        }
    }

    /**
     * Extract and save a lead from a high-intent comment
     */
    private async extractLead(comment: any, workspaceId: string, targetUsername: string, postId: string) {
        const username = comment.user.username;

        // Insert lead (will fail gracefully on duplicate due to unique constraint)
        const lead = await prisma.lead.create({
            data: {
                igUserId: comment.user.pk,
                igUsername: username,
                fullName: comment.user.fullName || '',
                profilePicUrl: comment.user.profilePicUrl || '',
                workspaceId: workspaceId,
                status: 'new',
                source: 'autonomous-comment-mining',
                sourceQuery: `@${targetUsername}/post/${postId.substring(0, 8)}`,
                matchedKeywords: [comment.reason || 'high-intent'],
                notes: `Score: ${comment.score}/100. Comment: "${comment.text?.substring(0, 100)}"`,
                leadScore: comment.score,
                isVerified: comment.user.isVerified || false,
                isPrivate: comment.user.isPrivate || false
            }
        });

        return lead;
    }

    /**
     * Get current lead count
     */
    private async getLeadCount(workspaceId: string): Promise<number> {
        const count = await prisma.lead.count({
            where: { workspaceId }
        });
        return count;
    }

    /**
     * Complete the mission
     */
    private async complete() {
        const duration = Date.now() - this.state.startTime;
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);

        this.log('\n🎉 ====== MISSION COMPLETE ======');
        this.log(`✅ ${this.state.leadsCollected} leads collected`);
        this.log(`⏱️  Time: ${hours}h ${minutes}m`);
        this.log(`🔄 Cycles: ${this.state.cyclesCompleted}`);
        this.log(`📊 Avg leads/cycle: ${(this.state.leadsCollected / this.state.cyclesCompleted).toFixed(1)}`);

        await this.gitCommit(`🎉 Mission complete: ${this.state.leadsCollected} leads`);

        this.isRunning = false;
    }

    /**
     * Load state from disk (crash recovery)
     */
    private loadState(): EngineState {
        try {
            if (fs.existsSync(this.statePath)) {
                const data = JSON.parse(fs.readFileSync(this.statePath, 'utf-8'));
                data.processedPosts = new Set(data.processedPosts || []);
                this.log('📂 State loaded from disk');
                return data;
            }
        } catch (error) {
            this.log('⚠️  Could not load state, starting fresh');
        }

        return {
            leadsCollected: 0,
            cyclesCompleted: 0,
            startTime: Date.now(),
            targetAccounts: this.seedAccounts,
            processedPosts: new Set(),
            lastGitCommit: Date.now()
        };
    }

    /**
     * Save state to disk
     */
    private saveState() {
        try {
            const data = {
                ...this.state,
                processedPosts: Array.from(this.state.processedPosts)
            };
            fs.writeFileSync(this.statePath, JSON.stringify(data, null, 2));
        } catch (error) {
            this.log(`⚠️  Could not save state: ${error}`);
        }
    }

    /**
     * Git commit
     */
    private async gitCommit(message: string) {
        try {
            await execAsync('git add .');
            await execAsync(`git commit -m "${message}" || true`);
            await execAsync('git push || true');
            this.log(`📤 Git: ${message}`);
            this.state.lastGitCommit = Date.now();
        } catch (error) {
            // Git errors are non-fatal
        }
    }

    /**
     * Log to console and file
     */
    private log(message: string, isError = false) {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] ${message}`;

        console.log(logLine);

        try {
            fs.appendFileSync(this.logPath, logLine + '\n');
        } catch (error) {
            // Ignore log file errors
        }
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Stop the engine
     */
    stop() {
        this.log('🛑 Stopping engine...');
        this.isRunning = false;
        this.saveState();
    }
}
