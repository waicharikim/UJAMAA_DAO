-- CreateTable
CREATE TABLE "ImpactPoint" (
    "id" TEXT NOT NULL,
    "holderType" "HolderType" NOT NULL,
    "holderId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImpactPoint_holderType_holderId_key" ON "ImpactPoint"("holderType", "holderId");
