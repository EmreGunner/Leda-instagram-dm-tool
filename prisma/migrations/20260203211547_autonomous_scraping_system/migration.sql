-- CreateTable
CREATE TABLE "scraping_accounts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "full_name" TEXT,
    "biography" TEXT,
    "follower_count" INTEGER,
    "following_count" INTEGER,
    "post_count" INTEGER,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "profile_pic_url" TEXT,
    "is_validated" BOOLEAN NOT NULL DEFAULT false,
    "is_tracked" BOOLEAN NOT NULL DEFAULT true,
    "validation_status" TEXT NOT NULL DEFAULT 'pending',
    "validated_by" TEXT,
    "validated_at" TIMESTAMP(3),
    "account_type" TEXT NOT NULL DEFAULT 'real_estate_agency',
    "tags" TEXT[],
    "notes" TEXT,
    "scraping_priority" INTEGER NOT NULL DEFAULT 0,
    "scrape_frequency_hours" INTEGER NOT NULL DEFAULT 24,
    "last_scraped_at" TIMESTAMP(3),
    "last_scrape_post_count" INTEGER NOT NULL DEFAULT 0,
    "added_via" TEXT NOT NULL DEFAULT 'manual',
    "added_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraping_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraped_posts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "scraping_account_id" TEXT NOT NULL,
    "ig_post_id" TEXT NOT NULL,
    "post_url" TEXT NOT NULL,
    "caption" TEXT,
    "media_type" TEXT,
    "media_url" TEXT,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "posted_at" TIMESTAMP(3),
    "detected_property_type" TEXT,
    "detected_listing_type" TEXT,
    "detected_city" TEXT,
    "detected_town" TEXT,
    "detected_price" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "comments_scraped" BOOLEAN NOT NULL DEFAULT false,
    "comments_scraped_at" TIMESTAMP(3),
    "comments_scraped_count" INTEGER NOT NULL DEFAULT 0,
    "leads_extracted_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraped_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraping_jobs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "scraping_account_id" TEXT,
    "scraped_post_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "worker_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraping_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraping_config" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "scraping_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_approve_accounts" BOOLEAN NOT NULL DEFAULT false,
    "auto_approve_follower_threshold" INTEGER NOT NULL DEFAULT 5000,
    "max_accounts_per_day" INTEGER NOT NULL DEFAULT 100,
    "max_posts_per_account" INTEGER NOT NULL DEFAULT 50,
    "max_comments_per_post" INTEGER NOT NULL DEFAULT 500,
    "scraping_delay_seconds" INTEGER NOT NULL DEFAULT 5,
    "bio_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comment_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exclude_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "property_type_keywords" JSONB,
    "listing_type_keywords" JSONB,
    "city_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notify_on_new_leads" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_validation_needed" BOOLEAN NOT NULL DEFAULT true,
    "notification_email" TEXT,
    "webhook_url" TEXT,
    "api_key_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraping_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scraping_accounts_workspace_id_idx" ON "scraping_accounts"("workspace_id");

-- CreateIndex
CREATE INDEX "scraping_accounts_is_validated_is_tracked_idx" ON "scraping_accounts"("is_validated", "is_tracked");

-- CreateIndex
CREATE INDEX "scraping_accounts_validation_status_idx" ON "scraping_accounts"("validation_status");

-- CreateIndex
CREATE INDEX "scraping_accounts_scraping_priority_idx" ON "scraping_accounts"("scraping_priority");

-- CreateIndex
CREATE INDEX "scraping_accounts_username_idx" ON "scraping_accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "scraping_accounts_username_workspace_id_key" ON "scraping_accounts"("username", "workspace_id");

-- CreateIndex
CREATE INDEX "scraped_posts_workspace_id_idx" ON "scraped_posts"("workspace_id");

-- CreateIndex
CREATE INDEX "scraped_posts_scraping_account_id_idx" ON "scraped_posts"("scraping_account_id");

-- CreateIndex
CREATE INDEX "scraped_posts_status_idx" ON "scraped_posts"("status");

-- CreateIndex
CREATE INDEX "scraped_posts_posted_at_idx" ON "scraped_posts"("posted_at");

-- CreateIndex
CREATE UNIQUE INDEX "scraped_posts_ig_post_id_workspace_id_key" ON "scraped_posts"("ig_post_id", "workspace_id");

-- CreateIndex
CREATE INDEX "scraping_jobs_workspace_id_idx" ON "scraping_jobs"("workspace_id");

-- CreateIndex
CREATE INDEX "scraping_jobs_status_priority_scheduled_at_idx" ON "scraping_jobs"("status", "priority", "scheduled_at");

-- CreateIndex
CREATE INDEX "scraping_jobs_job_type_idx" ON "scraping_jobs"("job_type");

-- CreateIndex
CREATE UNIQUE INDEX "scraping_config_workspace_id_key" ON "scraping_config"("workspace_id");

-- AddForeignKey
ALTER TABLE "scraping_accounts" ADD CONSTRAINT "scraping_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraping_accounts" ADD CONSTRAINT "scraping_accounts_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraping_accounts" ADD CONSTRAINT "scraping_accounts_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraped_posts" ADD CONSTRAINT "scraped_posts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraped_posts" ADD CONSTRAINT "scraped_posts_scraping_account_id_fkey" FOREIGN KEY ("scraping_account_id") REFERENCES "scraping_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraping_jobs" ADD CONSTRAINT "scraping_jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraping_jobs" ADD CONSTRAINT "scraping_jobs_scraping_account_id_fkey" FOREIGN KEY ("scraping_account_id") REFERENCES "scraping_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraping_jobs" ADD CONSTRAINT "scraping_jobs_scraped_post_id_fkey" FOREIGN KEY ("scraped_post_id") REFERENCES "scraped_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraping_config" ADD CONSTRAINT "scraping_config_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
