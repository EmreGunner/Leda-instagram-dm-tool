/**
 * TypeScript types for the autonomous scraping system
 */

// ============================================================================
// Database Types (matching Prisma schema)
// ============================================================================

export interface ScrapingAccount {
    id: string;
    workspaceId: string;
    username: string;
    fullName?: string | null;
    biography?: string | null;
    followerCount?: number | null;
    followingCount?: number | null;
    postCount?: number | null;
    isVerified: boolean;
    isPrivate: boolean;
    profilePicUrl?: string | null;
    isValidated: boolean;
    isTracked: boolean;
    validationStatus: 'pending' | 'approved' | 'rejected';
    validatedBy?: string | null;
    validatedAt?: Date | null;
    accountType: string;
    tags: string[];
    notes?: string | null;
    scrapingPriority: number;
    scrapeFrequencyHours: number;
    lastScrapedAt?: Date | null;
    lastScrapePostCount: number;
    addedVia: 'manual' | 'apify' | 'csv' | 'api' | 'webhook';
    addedBy?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ScrapedPost {
    id: string;
    workspaceId: string;
    scrapingAccountId: string;
    igPostId: string;
    postUrl: string;
    caption?: string | null;
    mediaType?: string | null;
    mediaUrl?: string | null;
    likeCount: number;
    commentCount: number;
    postedAt?: Date | null;
    detectedPropertyType?: string | null;
    detectedListingType?: string | null;
    detectedCity?: string | null;
    status: 'pending' | 'processing' | 'processed' | 'error';
    commentsScraped: boolean;
    leadsExtractedCount: number;
    createdAt: Date;
}

export interface ScrapingJob {
    id: string;
    workspaceId: string;
    jobType: 'scrape_account_posts' | 'scrape_post_comments' | 'validate_account' | 'enrichment';
    priority: number;
    scrapingAccountId?: string | null;
    scrapedPostId?: string | null;
    payload: Record<string, any>;
    scheduledAt: Date;
    startedAt?: Date | null;
    completedAt?: Date | null;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    result?: Record<string, any> | null;
    errorMessage?: string | null;
    retryCount: number;
    createdAt: Date;
}

// ============================================================================
// Webhook Input Types
// ============================================================================

export interface WebhookRequest {
    source: 'apify' | 'csv' | 'manual' | 'zapier' | 'n8n' | 'api';
    workspace_id: string;
    accounts: InstagramAccountInput[];
    metadata?: {
        batch_id?: string;
        tags?: string[];
        auto_validate?: boolean;
        priority?: number;
    };
}

export interface InstagramAccountInput {
    username: string;  // REQUIRED
    full_name?: string;
    biography?: string;
    follower_count?: number;
    following_count?: number;
    post_count?: number;
    is_verified?: boolean;
    is_private?: boolean;
    profile_pic_url?: string;
    external_url?: string;
    business_category_name?: string;
    business_address?: string;
    tags?: string[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface WebhookResponse {
    success: boolean;
    inserted?: number;
    updated?: number;
    duplicates?: number;
    errors?: number;
    accounts?: {
        username: string;
        id: string;
        status: 'inserted' | 'updated' | 'duplicate' | 'error';
        error?: string;
    }[];
    error?: string;
    details?: any;
}

export interface ApiError {
    error: string;
    details?: any;
    status?: number;
}

// ============================================================================
// Frontend Types
// ============================================================================

export interface ScrapingAccountWithStats extends ScrapingAccount {
    postsCount?: number;
    pendingPostsCount?: number;
    leadsExtractedTotal?: number;
}
