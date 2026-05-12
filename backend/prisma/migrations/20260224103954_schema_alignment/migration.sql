/*
  Warnings:

  - Made the column `proofUrl` on table `ResidenceChangeRequest` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ResidenceChangeRequest" ALTER COLUMN "proofUrl" SET NOT NULL;
