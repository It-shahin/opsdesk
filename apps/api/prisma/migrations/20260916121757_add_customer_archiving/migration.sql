-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "customers_organizationId_archivedAt_idx" ON "customers"("organizationId", "archivedAt");
