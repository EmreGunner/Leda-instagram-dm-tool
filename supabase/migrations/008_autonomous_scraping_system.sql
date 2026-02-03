-- Migration: Autonomous Instagram Scraping System
-- Creates tables for tracking Instagram accounts to scrape, their posts, and background jobs
-- Date: 2026-02-04

-- ============================================================================
-- 1. SCRAPING_ACCOUNTS: Instagram accounts to monitor
-- ============================================================================

CREATE TABLE IF NOT EXISTS scraping_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Instagram Profile Info
  username TEXT NOT NULL,
  full_name TEXT,
  biography TEXT,
  follower_count INTEGER,
  following_count INTEGER,
  post_count INTEGER,
  is_verified BOOLEAN DEFAULT FALSE,
  is_private BOOLEAN DEFAULT FALSE,
  profile_pic_url TEXT,
  
  -- Validation & Status
  is_validated BOOLEAN DEFAULT FALSE,
  is_tracked BOOLEAN DEFAULT TRUE,
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'approved', 'rejected')),
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMP WITH TIME ZONE,
  
  -- Categorization
  account_type TEXT NOT NULL DEFAULT 'real_estate_agency',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  
  -- Scraping Configuration
  scraping_priority INTEGER DEFAULT 0,
  scrape_frequency_hours INTEGER DEFAULT 24,
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  last_scrape_post_count INTEGER DEFAULT 0,
  
  -- Source Tracking
  added_via TEXT DEFAULT 'manual' CHECK (added_via IN ('manual', 'apify', 'csv', 'api', 'webhook')),
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(username, workspace_id)
);

-- Indexes for scraping_accounts
CREATE INDEX idx_scraping_accounts_workspace ON scraping_accounts(workspace_id);
CREATE INDEX idx_scraping_accounts_validated ON scraping_accounts(is_validated, is_tracked) WHERE is_validated = TRUE AND is_tracked = TRUE;
CREATE INDEX idx_scraping_accounts_pending ON scraping_accounts(workspace_id, validation_status, created_at DESC) WHERE validation_status = 'pending';
CREATE INDEX idx_scraping_accounts_scraping_due ON scraping_accounts(workspace_id, last_scraped_at) WHERE is_validated = TRUE AND is_tracked = TRUE;
CREATE INDEX idx_scraping_accounts_priority ON scraping_accounts(scraping_priority DESC, last_scraped_at ASC NULLS FIRST);
CREATE INDEX idx_scraping_accounts_username ON scraping_accounts(username);

-- Comment
COMMENT ON TABLE scraping_accounts IS 'Instagram accounts (agencies, competitors) to monitor for post scraping';

-- ============================================================================
-- 2. SCRAPED_POSTS: Posts from validated accounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS scraped_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scraping_account_id UUID NOT NULL REFERENCES scraping_accounts(id) ON DELETE CASCADE,
  
  -- Instagram Post Data
  ig_post_id TEXT NOT NULL,
  post_url TEXT NOT NULL,
  caption TEXT,
  media_type TEXT CHECK (media_type IN ('PHOTO', 'VIDEO', 'CAROUSEL', 'REEL')),
  media_url TEXT,
  
  -- Engagement Metrics
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE,
  
  -- Property Detection (extracted from caption/image)
  detected_property_type TEXT,
  detected_listing_type TEXT,
  detected_city TEXT,
  detected_town TEXT,
  detected_price TEXT,
  
  -- Processing Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'error')),
  comments_scraped BOOLEAN DEFAULT FALSE,
  comments_scraped_at TIMESTAMP WITH TIME ZONE,
  comments_scraped_count INTEGER DEFAULT 0,
  leads_extracted_count INTEGER DEFAULT 0,
  
  -- Error Tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(ig_post_id, workspace_id)
);

-- Indexes for scraped_posts
CREATE INDEX idx_scraped_posts_workspace ON scraped_posts(workspace_id);
CREATE INDEX idx_scraped_posts_account ON scraped_posts(scraping_account_id);
CREATE INDEX idx_scraped_posts_status ON scraped_posts(status, created_at DESC);
CREATE INDEX idx_scraped_posts_posted_at ON scraped_posts(posted_at DESC);
CREATE INDEX idx_scraped_posts_unprocessed ON scraped_posts(workspace_id, status, created_at) WHERE status = 'pending' AND comments_scraped = FALSE;
CREATE INDEX idx_scraped_posts_account_status ON scraped_posts(scraping_account_id, status, posted_at DESC);

COMMENT ON TABLE scraped_posts IS 'Instagram posts scraped from validated accounts for lead extraction';

-- ============================================================================
-- 3. SCRAPING_JOBS: Background job queue
-- ============================================================================

CREATE TABLE IF NOT EXISTS scraping_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Job Configuration
  job_type TEXT NOT NULL CHECK (job_type IN ('scrape_account_posts', 'scrape_post_comments', 'validate_account', 'enrichment')),
  priority INTEGER DEFAULT 0,
  
  -- Target References
  scraping_account_id UUID REFERENCES scraping_accounts(id) ON DELETE CASCADE,
  scraped_post_id UUID REFERENCES scraped_posts(id) ON DELETE CASCADE,
  
  -- Payload (flexible JSON for different job types)
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  
  -- Scheduling
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Results
  result JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Worker Info
  worker_id TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for scraping_jobs
CREATE INDEX idx_scraping_jobs_workspace ON scraping_jobs(workspace_id);
CREATE INDEX idx_scraping_jobs_queue ON scraping_jobs(status, priority DESC, scheduled_at ASC) WHERE status IN ('queued', 'running');
CREATE INDEX idx_scraping_jobs_type ON scraping_jobs(job_type, status);
CREATE INDEX idx_scraping_jobs_account ON scraping_jobs(scraping_account_id) WHERE scraping_account_id IS NOT NULL;
CREATE INDEX idx_scraping_jobs_post ON scraping_jobs(scraped_post_id) WHERE scraped_post_id IS NOT NULL;

COMMENT ON TABLE scraping_jobs IS 'Background job queue for automated scraping tasks';

-- ============================================================================
-- 4. SCRAPING_CONFIG: Workspace-specific configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS scraping_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Global Settings
  scraping_enabled BOOLEAN DEFAULT TRUE,
  auto_approve_accounts BOOLEAN DEFAULT FALSE,
  auto_approve_follower_threshold INTEGER DEFAULT 5000,
  
  -- Rate Limiting
  max_accounts_per_day INTEGER DEFAULT 100,
  max_posts_per_account INTEGER DEFAULT 50,
  max_comments_per_post INTEGER DEFAULT 500,
  scraping_delay_seconds INTEGER DEFAULT 5,
  
  -- Keyword Filters
  bio_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  comment_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  exclude_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Property Detection
  property_type_keywords JSONB DEFAULT '{}'::JSONB,
  listing_type_keywords JSONB DEFAULT '{}'::JSONB,
  city_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Notification Settings
  notify_on_new_leads BOOLEAN DEFAULT TRUE,
  notify_on_validation_needed BOOLEAN DEFAULT TRUE,
  notification_email TEXT,
  
  -- API Configuration
  webhook_url TEXT,
  api_key_hash TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scraping_config_workspace ON scraping_config(workspace_id);

COMMENT ON TABLE scraping_config IS 'Per-workspace configuration for autonomous scraping';

-- ============================================================================
-- 5. UPDATE TRIGGERS for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_scraping_accounts_updated_at BEFORE UPDATE ON scraping_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scraped_posts_updated_at BEFORE UPDATE ON scraped_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scraping_jobs_updated_at BEFORE UPDATE ON scraping_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scraping_config_updated_at BEFORE UPDATE ON scraping_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. RLS POLICIES (Row Level Security)
-- ============================================================================

-- Enable RLS
ALTER TABLE scraping_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_config ENABLE ROW LEVEL SECURITY;

-- Policies for scraping_accounts
CREATE POLICY "Users can view scraping_accounts in their workspace"
  ON scraping_accounts FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE supabase_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert scraping_accounts in their workspace"
  ON scraping_accounts FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE supabase_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can update scraping_accounts in their workspace"
  ON scraping_accounts FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE supabase_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete scraping_accounts in their workspace"
  ON scraping_accounts FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE supabase_auth_id = auth.uid()
    )
  );

-- Policies for scraped_posts
CREATE POLICY "Users can view scraped_posts in their workspace"
  ON scraped_posts FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE supabase_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert scraped_posts in their workspace"
  ON scraped_posts FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE supabase_auth_id = auth.uid()
    )
  );

-- Policies for scraping_jobs
CREATE POLICY "Users can view scraping_jobs in their workspace"
  ON scraping_jobs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE supabase_auth_id = auth.uid()
    )
  );

-- Policies for scraping_config
CREATE POLICY "Users can view scraping_config in their workspace"
  ON scraping_config FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE supabase_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can update scraping_config in their workspace"
  ON scraping_config FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE supabase_auth_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. INITIAL DATA
-- ============================================================================

-- No initial data needed, will be populated via API/webhooks

-- Migration complete
