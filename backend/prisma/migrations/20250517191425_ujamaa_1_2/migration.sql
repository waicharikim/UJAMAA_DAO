/*
  Warnings:

  - The primary key for the `TokenBalance` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[holderType,userId]` on the table `TokenBalance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[holderType,groupId]` on the table `TokenBalance` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "TokenBalance_holderType_userId_groupId_key";

-- AlterTable
ALTER TABLE "TokenBalance" DROP CONSTRAINT "TokenBalance_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "TokenBalance_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "TokenBalance_holderType_userId_key" ON "TokenBalance"("holderType", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenBalance_holderType_groupId_key" ON "TokenBalance"("holderType", "groupId");
