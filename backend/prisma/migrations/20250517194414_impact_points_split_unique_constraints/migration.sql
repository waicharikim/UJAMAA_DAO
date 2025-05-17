/*
  Warnings:

  - A unique constraint covering the columns `[holderType,userId,locationScope]` on the table `ImpactPoint` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[holderType,groupId,locationScope]` on the table `ImpactPoint` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ImpactPoint_holderType_userId_groupId_locationScope_key";

-- CreateIndex
CREATE UNIQUE INDEX "ImpactPoint_holderType_userId_locationScope_key" ON "ImpactPoint"("holderType", "userId", "locationScope");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactPoint_holderType_groupId_locationScope_key" ON "ImpactPoint"("holderType", "groupId", "locationScope");
