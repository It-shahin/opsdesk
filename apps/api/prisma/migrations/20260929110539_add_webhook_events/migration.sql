-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('RESEND');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PROCESSED', 'IGNORED');

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider" "WebhookProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "providerEntityId" TEXT NOT NULL,
    "webhookMessageId" TEXT,
    "status" "WebhookEventStatus" NOT NULL,
    "reason" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_events_webhookMessageId_idx" ON "webhook_events"("webhookMessageId");

-- CreateIndex
CREATE INDEX "webhook_events_provider_eventType_createdAt_idx" ON "webhook_events"("provider", "eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_eventType_providerEntityId_key" ON "webhook_events"("provider", "eventType", "providerEntityId");
