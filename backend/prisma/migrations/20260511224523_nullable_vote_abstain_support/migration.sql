/*
  Warnings:

  - You are about to drop the column `maxAssignees` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `skillCategory` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the `WorkPresence` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorkSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WorkPresence" DROP CONSTRAINT "WorkPresence_attestedById_fkey";

-- DropForeignKey
ALTER TABLE "WorkPresence" DROP CONSTRAINT "WorkPresence_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "WorkPresence" DROP CONSTRAINT "WorkPresence_userId_fkey";

-- DropForeignKey
ALTER TABLE "WorkSession" DROP CONSTRAINT "WorkSession_createdById_fkey";

-- DropForeignKey
ALTER TABLE "WorkSession" DROP CONSTRAINT "WorkSession_milestoneId_fkey";

-- DropForeignKey
ALTER TABLE "WorkSession" DROP CONSTRAINT "WorkSession_projectId_fkey";

-- AlterTable
ALTER TABLE "GroupMemberVote" ALTER COLUMN "vote" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "maxAssignees",
DROP COLUMN "skillCategory";

-- DropTable
DROP TABLE "WorkPresence";

-- DropTable
DROP TABLE "WorkSession";

-- DropEnum
DROP TYPE "WorkSessionStatus";
