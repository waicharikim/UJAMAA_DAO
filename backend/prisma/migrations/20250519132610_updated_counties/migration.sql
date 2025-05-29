/*
  Warnings:

  - Made the column `code` on table `County` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "County" ALTER COLUMN "code" SET NOT NULL;
