import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// Types for Apify Input
interface ApifySearchInput {
    search: string; // Reverted to string
    searchType: 'user' | 'hashtag' | 'place';
    resultsLimit?: number;
    searchLimit?: number;
    enhanceUserSearchWithFacebookPage?: boolean;
}

// Types for Apify Output (based on user sample)
interface ApifyInstagramProfile {
    id: string; // "17841400..."
    username: string;
    fullName?: string;
    biography?: string;
    externalUrl?: string; // "http://..."
    externalUrlShimmed?: string;

    businessCategoryName?: string; // "Real Estate Agent"
    businessAddress?: string; // JSON string or object? User sample says "null" or "undefined"
    isBusinessAccount?: boolean;

    followersCount?: number;
    followsCount?: number;
    postsCount?: number;

    profilePicUrl?: string;
    profilePicUrlHD?: string;

    verified?: boolean;
    private?: boolean;

    latestPosts?: any[]; // Array of posts
}

export class ApifyService {
    private get API_TOKEN() {
        return process.env.APIFY_TOKEN;
    }
    private readonly ACTOR_ID = 'apify/instagram-search-scraper'; // Or 'apify~instagram-search-scraper'
    private readonly API_URL = `https://api.apify.com/v2/acts/apify~instagram-search-scraper/runs`;

    /**
     * Search for Instagram users via Apify
     * @param query Search keywords (comma separated or array)
     * @param limit limit per search term
     */
    async searchUsers(query: string | string[], limit: number = 50) {
        if (!this.API_TOKEN) {
            throw new Error('APIFY_TOKEN is not configured');
        }

        console.log(`[Apify] Starting search for: ${query}`);

        // 1. Start the Actor Run
        const run = await this.startActorRun({
            search: Array.isArray(query) ? query.join(',') : query, // Join array to string
            searchType: 'user',
            searchLimit: limit,
            enhanceUserSearchWithFacebookPage: true
        });

        console.log(`[Apify] Run started. ID: ${run.data.id}`);

        // 2. Poll for completion
        const finishedRun = await this.waitForRun(run.data.id);

        if (finishedRun.status !== 'SUCCEEDED') {
            throw new Error(`Apify run failed with status: ${finishedRun.status}`);
        }

        // 3. Fetch Results
        const results = await this.fetchRunResults(run.data.defaultDatasetId);

        return results;
    }

    private async startActorRun(input: ApifySearchInput) {
        const response = await fetch(`${this.API_URL}?token=${this.API_TOKEN}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(input)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to start Apify run: ${response.status} ${error}`);
        }

        return await response.json();
    }

    private async waitForRun(runId: string, pollIntervalMs = 5000) {
        let run;
        do {
            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
            const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${this.API_TOKEN}`);
            run = await response.json();
            console.log(`[Apify] Run status: ${run.data.status}`);
        } while (run.data.status === 'RUNNING' || run.data.status === 'READY');

        return run.data;
    }

    async startSearch(query: string | string[], limit: number = 50) {
        return this.startActorRun({
            search: Array.isArray(query) ? query.join(',') : query,
            searchType: 'user',
            searchLimit: limit,
            enhanceUserSearchWithFacebookPage: true
        });
    }

    async getRun(runId: string) {
        const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${this.API_TOKEN}`);
        const data = await response.json();
        return data.data;
    }

    async getDatasetItems(datasetId: string, offset: number = 0, limit: number = 50): Promise<ApifyInstagramProfile[]> {
        const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${this.API_TOKEN}&offset=${offset}&limit=${limit}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch dataset items');
        }
        return await response.json();
    }

    private async fetchRunResults(datasetId: string): Promise<ApifyInstagramProfile[]> {
        const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${this.API_TOKEN}`);
        if (!response.ok) {
            throw new Error('Failed to fetch dataset items');
        }
        return await response.json();
    }

    /**
     * Map Apify profile to our DB logic and calculate priority
     */
    calculatePriority(profile: ApifyInstagramProfile): number {
        let score = 0;

        // Boost for Real Estate keywords in bio/category
        const keywords = ['real estate', 'emlak', 'gayrimenkul', 'realtor', 'broker', 'agency', 'danışman'];
        const text = ((profile.biography || '') + (profile.businessCategoryName || '')).toLowerCase();

        if (keywords.some(k => text.includes(k))) score += 50;

        // Boost for business accounts
        if (profile.isBusinessAccount) score += 20;

        // Boost for contact info (if we can infer it, e.g. email in bio)
        if (profile.biography?.includes('@') || profile.biography?.match(/\d{10}/)) score += 10;

        // Penalize very small or very large accounts (we want mid-sized active agencies usually)
        if ((profile.followersCount || 0) < 100) score -= 20;

        // Boost Verified? Maybe neutral.

        return Math.max(0, Math.min(100, score)); // Clamp 0-100
    }
}

export const apifyService = new ApifyService();
