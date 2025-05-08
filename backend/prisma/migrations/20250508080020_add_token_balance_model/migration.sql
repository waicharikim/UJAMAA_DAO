-- CreateEnum
CREATE TYPE "HolderType" AS ENUM ('USER', 'GROUP');

-- CreateTable
CREATE TABLE "TokenBalance" (
    "id" TEXT NOT NULL,
    "holderType" "HolderType" NOT NULL,
    "holderId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenBalance_holderType_holderId_key" ON "TokenBalance"("holderType", "holderId");
