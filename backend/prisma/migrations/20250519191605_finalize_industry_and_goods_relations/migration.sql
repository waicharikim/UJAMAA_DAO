/*
  Warnings:

  - You are about to drop the column `industryFocus` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `productsServices` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `goodsServices` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `industry` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Group" DROP COLUMN "industryFocus",
DROP COLUMN "productsServices",
ADD COLUMN     "industryFocusId" UUID;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "goodsServices",
DROP COLUMN "industry",
ADD COLUMN     "industryId" UUID;

-- CreateTable
CREATE TABLE "Industry" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsService" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "GoodsService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserGoodsServices" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_UserGoodsServices_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_GroupGoodsServices" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_GroupGoodsServices_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Industry_name_key" ON "Industry"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsService_name_key" ON "GoodsService"("name");

-- CreateIndex
CREATE INDEX "_UserGoodsServices_B_index" ON "_UserGoodsServices"("B");

-- CreateIndex
CREATE INDEX "_GroupGoodsServices_B_index" ON "_GroupGoodsServices"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_industryFocusId_fkey" FOREIGN KEY ("industryFocusId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserGoodsServices" ADD CONSTRAINT "_UserGoodsServices_A_fkey" FOREIGN KEY ("A") REFERENCES "GoodsService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserGoodsServices" ADD CONSTRAINT "_UserGoodsServices_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroupGoodsServices" ADD CONSTRAINT "_GroupGoodsServices_A_fkey" FOREIGN KEY ("A") REFERENCES "GoodsService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroupGoodsServices" ADD CONSTRAINT "_GroupGoodsServices_B_fkey" FOREIGN KEY ("B") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
