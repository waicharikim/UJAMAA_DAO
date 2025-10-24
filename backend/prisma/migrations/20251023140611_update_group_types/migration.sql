/*
  Warnings:

  - The values [COMMUNITY,COMPANY,COUNTY,HIGH_SCHOOL,CHURCH] on the enum `GroupType` will be removed. If these variants are still used in the database, this will fail.
  - The values [LOCAL] on the enum `LocationScope` will be removed. If these variants are still used in the database, this will fail.
  - The values [SUPER_ADMIN,AUDITOR,COMPLIANCE_OFFICER,SUPPORT_STAFF,GENERAL_USER] on the enum `SystemRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `constituency` on the `ImpactPoint` table. All the data in the column will be lost.
  - You are about to drop the column `county` on the `ImpactPoint` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ImpactPoint` table. All the data in the column will be lost.
  - Added the required column `description` to the `ImpactPoint` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ImpactPointType" AS ENUM ('LOCATION_BASED', 'SYSTEM');

-- AlterEnum
BEGIN;
CREATE TYPE "GroupType_new" AS ENUM ('WARD_COMMUNITY', 'CONSTITUENCY_PROJECT', 'COUNTY_INITIATIVE', 'NATIONAL_CAMPAIGN', 'BUSINESS', 'NON_PROFIT', 'EDUCATION', 'RELIGIOUS', 'HEALTH', 'AGRICULTURE', 'YOUTH', 'WOMEN', 'PROJECT_GROUP');
ALTER TABLE "Group" ALTER COLUMN "groupType" DROP DEFAULT;
ALTER TABLE "Group" ALTER COLUMN "groupType" TYPE "GroupType_new" USING ("groupType"::text::"GroupType_new");
ALTER TYPE "GroupType" RENAME TO "GroupType_old";
ALTER TYPE "GroupType_new" RENAME TO "GroupType";
DROP TYPE "GroupType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "LocationScope_new" AS ENUM ('WARD', 'CONSTITUENCY', 'COUNTY', 'NATIONAL');
ALTER TABLE "Project" ALTER COLUMN "locationScope" TYPE "LocationScope_new" USING ("locationScope"::text::"LocationScope_new");
ALTER TABLE "Proposal" ALTER COLUMN "locationScope" TYPE "LocationScope_new" USING ("locationScope"::text::"LocationScope_new");
ALTER TABLE "ImpactPoint" ALTER COLUMN "locationScope" TYPE "LocationScope_new" USING ("locationScope"::text::"LocationScope_new");
ALTER TYPE "LocationScope" RENAME TO "LocationScope_old";
ALTER TYPE "LocationScope_new" RENAME TO "LocationScope";
DROP TYPE "LocationScope_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SystemRole_new" AS ENUM ('super_admin', 'auditor', 'compliance_officer', 'support_staff', 'general_user');
ALTER TYPE "SystemRole" RENAME TO "SystemRole_old";
ALTER TYPE "SystemRole_new" RENAME TO "SystemRole";
DROP TYPE "SystemRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "Group" ALTER COLUMN "groupType" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ImpactPoint" DROP COLUMN "constituency",
DROP COLUMN "county",
DROP COLUMN "updatedAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "locationHoldingId" INTEGER;

-- CreateTable
CREATE TABLE "Holding" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "holdingType" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countyId" UUID,
    "constituencyId" UUID,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ImpactPoint" ADD CONSTRAINT "ImpactPoint_locationHoldingId_fkey" FOREIGN KEY ("locationHoldingId") REFERENCES "Holding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHolding" ADD CONSTRAINT "UserHolding_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "Holding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "County"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
