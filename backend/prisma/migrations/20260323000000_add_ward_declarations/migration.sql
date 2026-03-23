-- CreateTable
CREATE TABLE "ward_declarations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "groupId" UUID NOT NULL,
    "wardName" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "declarationText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ward_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ward_declarations_groupId_key" ON "ward_declarations"("groupId");

-- AddForeignKey
ALTER TABLE "ward_declarations" ADD CONSTRAINT "ward_declarations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
