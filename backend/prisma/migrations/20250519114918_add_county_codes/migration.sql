/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `County` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `County` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "County" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "County_code_key" ON "County"("code");
