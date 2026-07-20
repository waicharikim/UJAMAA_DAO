-- ADR-004: Split utilityTokens into two separate pools
-- fiatBackedUtBalance: M-Pesa deposits, 1 UT = 1 KES, cashable back to M-Pesa
-- earnedUtBalance:     Platform activity rewards, no cash-out path

-- Add the two new columns
ALTER TABLE "users" ADD COLUMN "fiatBackedUtBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "earnedUtBalance" INTEGER NOT NULL DEFAULT 0;

-- Migrate existing utilityTokens to fiatBackedUtBalance
-- (all existing UT came from dues payments = fiat-backed)
UPDATE "users" SET "fiatBackedUtBalance" = "utilityTokens";

-- Drop the old column
ALTER TABLE "users" DROP COLUMN "utilityTokens";
