/*
  Warnings:

  - You are about to alter the column `balance` on the `WalletBalance` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(20,2)`.
  - You are about to alter the column `amount` on the `WalletTransaction` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(20,2)`.
  - Changed the type of `constituencyOrigin` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `countyOrigin` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `constituencyLive` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `countyLive` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `status` on the `WalletTransaction` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'SPEND', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "constituencyOrigin",
ADD COLUMN     "constituencyOrigin" UUID NOT NULL,
DROP COLUMN "countyOrigin",
ADD COLUMN     "countyOrigin" UUID NOT NULL,
DROP COLUMN "constituencyLive",
ADD COLUMN     "constituencyLive" UUID NOT NULL,
DROP COLUMN "countyLive",
ADD COLUMN     "countyLive" UUID NOT NULL;

-- AlterTable
ALTER TABLE "WalletBalance" ALTER COLUMN "balance" DROP DEFAULT,
ALTER COLUMN "balance" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "WalletTransaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(20,2),
DROP COLUMN "status",
ADD COLUMN     "status" "TransactionStatus" NOT NULL;

-- CreateIndex
CREATE INDEX "WalletTransaction_mpesaReceipt_idx" ON "WalletTransaction"("mpesaReceipt");
