-- AlterTable
ALTER TABLE "public"."InventoryItem" ADD COLUMN     "isCollection" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT,
ALTER COLUMN "sku" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "InventoryItem_userId_parentId_idx" ON "public"."InventoryItem"("userId", "parentId");

-- CreateIndex
CREATE INDEX "InventoryItem_isCollection_idx" ON "public"."InventoryItem"("isCollection");

-- CreateIndex
CREATE INDEX "ListingLink_ebayItemId_idx" ON "public"."ListingLink"("ebayItemId");

-- AddForeignKey
ALTER TABLE "public"."InventoryItem" ADD CONSTRAINT "InventoryItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
