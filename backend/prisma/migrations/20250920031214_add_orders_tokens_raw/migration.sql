-- CreateTable
CREATE TABLE "public"."EbayToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ebayUserId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EbayToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" TEXT NOT NULL,
    "ebayOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "buyer" TEXT,
    "totalCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "rawId" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "ebayLineId" TEXT,
    "sku" TEXT,
    "ebayItemId" TEXT,
    "qty" INTEGER NOT NULL,
    "itemPriceCents" INTEGER NOT NULL,
    "inventoryItemId" TEXT,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RawPayload" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawPayload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EbayToken_userId_idx" ON "public"."EbayToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_ebayOrderId_key" ON "public"."Order"("ebayOrderId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "public"."Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderLine_sku_idx" ON "public"."OrderLine"("sku");

-- CreateIndex
CREATE INDEX "OrderLine_ebayItemId_idx" ON "public"."OrderLine"("ebayItemId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLine_orderId_ebayLineId_key" ON "public"."OrderLine"("orderId", "ebayLineId");

-- AddForeignKey
ALTER TABLE "public"."OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
