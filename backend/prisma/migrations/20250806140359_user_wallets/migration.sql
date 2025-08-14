-- CreateTable
CREATE TABLE "WalletBalance" (
    "id" UUID NOT NULL,
    "holderType" "HolderType" NOT NULL,
    "userId" UUID,
    "groupId" UUID,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" UUID NOT NULL,
    "walletBalanceId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "mpesaReceipt" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletBalance_holderType_userId_key" ON "WalletBalance"("holderType", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletBalance_holderType_groupId_key" ON "WalletBalance"("holderType", "groupId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletBalanceId_idx" ON "WalletTransaction"("walletBalanceId");

-- AddForeignKey
ALTER TABLE "WalletBalance" ADD CONSTRAINT "WalletBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBalance" ADD CONSTRAINT "WalletBalance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletBalanceId_fkey" FOREIGN KEY ("walletBalanceId") REFERENCES "WalletBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
