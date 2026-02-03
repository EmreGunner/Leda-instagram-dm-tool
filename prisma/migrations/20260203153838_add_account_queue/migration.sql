-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "city" TEXT,
ADD COLUMN     "comment_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "comment_date" TIMESTAMP(3),
ADD COLUMN     "comment_link" TEXT,
ADD COLUMN     "listing_type" TEXT,
ADD COLUMN     "post_caption" TEXT,
ADD COLUMN     "post_link" TEXT,
ADD COLUMN     "property_sub_type" TEXT,
ADD COLUMN     "property_type" TEXT,
ADD COLUMN     "town" TEXT;

-- CreateTable
CREATE TABLE "target_accounts" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "full_name" TEXT,
    "biography" TEXT,
    "follower_count" INTEGER,
    "following_count" INTEGER,
    "post_count" INTEGER,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "is_tracked" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[],
    "notes" TEXT,
    "last_scraped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "workspace_id" TEXT NOT NULL,

    CONSTRAINT "target_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_queue" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "full_name" TEXT,
    "biography" TEXT,
    "external_url" TEXT,
    "business_category_name" TEXT,
    "business_address" TEXT,
    "is_business_account" BOOLEAN NOT NULL DEFAULT false,
    "follower_count" INTEGER,
    "following_count" INTEGER,
    "post_count" INTEGER,
    "profile_pic_url" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "workspace_id" TEXT NOT NULL,

    CONSTRAINT "account_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "target_accounts_workspace_id_idx" ON "target_accounts"("workspace_id");

-- CreateIndex
CREATE INDEX "target_accounts_is_tracked_idx" ON "target_accounts"("is_tracked");

-- CreateIndex
CREATE UNIQUE INDEX "target_accounts_username_workspace_id_key" ON "target_accounts"("username", "workspace_id");

-- CreateIndex
CREATE INDEX "account_queue_workspace_id_idx" ON "account_queue"("workspace_id");

-- CreateIndex
CREATE INDEX "account_queue_status_idx" ON "account_queue"("status");

-- CreateIndex
CREATE INDEX "account_queue_priority_idx" ON "account_queue"("priority");

-- CreateIndex
CREATE INDEX "account_queue_username_idx" ON "account_queue"("username");

-- AddForeignKey
ALTER TABLE "target_accounts" ADD CONSTRAINT "target_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_queue" ADD CONSTRAINT "account_queue_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
