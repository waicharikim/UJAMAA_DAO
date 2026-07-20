-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('NOTICE', 'PROJECT_UPDATE', 'ANNOUNCEMENT', 'RESOURCE');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "projectId" UUID,
ADD COLUMN     "proposalId" UUID,
ADD COLUMN     "resourceTitle" TEXT,
ADD COLUMN     "resourceUrl" TEXT,
ADD COLUMN     "type" "PostType" NOT NULL DEFAULT 'NOTICE';

-- CreateIndex
CREATE INDEX "posts_type_idx" ON "posts"("type");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
