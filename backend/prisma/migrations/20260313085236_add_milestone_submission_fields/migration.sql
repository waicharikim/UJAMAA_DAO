-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "proofUrl" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "submissionDescription" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedById" UUID,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" UUID;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
