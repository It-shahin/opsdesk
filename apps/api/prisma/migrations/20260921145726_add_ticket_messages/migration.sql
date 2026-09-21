-- CreateEnum
CREATE TYPE "TicketMessageKind" AS ENUM ('PUBLIC_REPLY', 'INTERNAL_NOTE');

-- CreateEnum
CREATE TYPE "TicketMessageAuthorType" AS ENUM ('MEMBER', 'CUSTOMER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TicketMessageSource" AS ENUM ('MANUAL', 'EMAIL', 'SYSTEM');

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "authorMembershipId" UUID,
    "kind" "TicketMessageKind" NOT NULL,
    "authorType" "TicketMessageAuthorType" NOT NULL,
    "source" "TicketMessageSource" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_messages_organizationId_ticketId_createdAt_idx" ON "ticket_messages"("organizationId", "ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "ticket_messages_authorMembershipId_idx" ON "ticket_messages"("authorMembershipId");

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_authorMembershipId_fkey" FOREIGN KEY ("authorMembershipId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
