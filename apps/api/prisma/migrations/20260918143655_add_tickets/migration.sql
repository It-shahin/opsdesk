-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('MANUAL', 'EMAIL');

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "source" "TicketSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tickets_organizationId_idx" ON "tickets"("organizationId");

-- CreateIndex
CREATE INDEX "tickets_organizationId_status_idx" ON "tickets"("organizationId", "status");

-- CreateIndex
CREATE INDEX "tickets_organizationId_priority_idx" ON "tickets"("organizationId", "priority");

-- CreateIndex
CREATE INDEX "tickets_organizationId_customerId_idx" ON "tickets"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "tickets_organizationId_createdAt_idx" ON "tickets"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
