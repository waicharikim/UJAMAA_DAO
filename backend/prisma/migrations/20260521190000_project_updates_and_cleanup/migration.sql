-- Remove PROJECT_UPDATE from PostType enum
ALTER TYPE "PostType" RENAME TO "PostType_old";
CREATE TYPE "PostType" AS ENUM ('NOTICE', 'ANNOUNCEMENT', 'RESOURCE');
-- Drop default before changing column type (PG can't auto-cast the default)
ALTER TABLE "posts" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "posts" ALTER COLUMN "type" TYPE "PostType" USING "type"::text::"PostType";
ALTER TABLE "posts" ALTER COLUMN "type" SET DEFAULT 'NOTICE';
DROP TYPE "PostType_old";

-- Remove projectId column from posts
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_projectId_fkey";
DROP INDEX IF EXISTS "posts_projectId_idx";
ALTER TABLE "posts" DROP COLUMN IF EXISTS "projectId";

-- Create project_updates table
CREATE TABLE "project_updates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_updates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_updates_projectId_createdAt_idx" ON "project_updates"("projectId", "createdAt" DESC);
CREATE INDEX "project_updates_authorId_idx" ON "project_updates"("authorId");

ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
