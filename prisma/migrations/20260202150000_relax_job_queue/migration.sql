-- AlterTable
ALTER TABLE "job_queue" ALTER COLUMN "campaign_id" DROP NOT NULL;
ALTER TABLE "job_queue" ALTER COLUMN "lead_id" DROP NOT NULL;
