-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "assigneeMembershipId" UUID;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigneeMembershipId_fkey" FOREIGN KEY ("assigneeMembershipId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
