-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "maxAssignees" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "skillCategory" TEXT;
