-- CreateTable
CREATE TABLE "waiting_list" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "instagram_id" TEXT,
    "message" TEXT,
    "slack_notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "slack_notification_sent_at" TIMESTAMP(3),
    "slack_notification_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waiting_list_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waiting_list_email_key" ON "waiting_list"("email");
