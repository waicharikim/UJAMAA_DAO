-- CreateTable: UtWithdrawal
-- fiatBackedUtBalance → M-Pesa B2C payout requests

CREATE TABLE "ut_withdrawals" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "userId"      UUID         NOT NULL,
    "amountKes"   INTEGER      NOT NULL,
    "mpesaPhone"  TEXT         NOT NULL,
    "status"      TEXT         NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "failureNote" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ut_withdrawals_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ut_withdrawals"
    ADD CONSTRAINT "ut_withdrawals_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ut_withdrawals_userId_createdAt_idx" ON "ut_withdrawals"("userId", "createdAt");
CREATE INDEX "ut_withdrawals_status_idx" ON "ut_withdrawals"("status");
