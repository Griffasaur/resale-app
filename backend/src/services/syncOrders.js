import { ebayClient } from "../ebay/index.js";
import { mapEbayOrderToModels } from "./mapEbayOrder.js";
import { prisma } from "../db.js";
import { ensureFreshAccessToken } from "./ebayAuth.js"; // make sure this file exists

/**
 * Sync orders from eBay into our DB.
 * - Uses ensureFreshAccessToken(userId) to get a valid token (and refresh if needed)
 * - Supports both "nextToken" (string) and "nextOffset" (number) pagination returned by different clients
 *
 * @param {object} opts
 * @param {number} opts.days number of days back to fetch (default 90)
 * @param {string} opts.userId user id to fetch token for (optional; defaults to "user-1" for dev)
 */
export async function syncOrders({ days = 90, userId = "user-1" } = {}) {
  const createdTo = new Date();
  const createdFrom = new Date(createdTo.getTime() - days * 24 * 60 * 60 * 1000);

  let pagerToken = null; // can be string or number depending on client
  let created = 0;
  let updated = 0;

  // We'll loop until the client stops returning a next token/offset
  while (true) {
    // Ensure we have a fresh access token (this helper should refresh/save if needed)
    const accessToken = await ensureFreshAccessToken(userId);

    // Build params for the client call.
    // We always send accessToken + createdFrom/To. For pagination include either continuationToken or offset.
    const params = {
      accessToken,
      createdFrom,
      createdTo,
      limit: 50
    };

    // If pagerToken is a number, pass as offset. If string, pass as continuationToken.
    if (pagerToken !== null) {
      if (typeof pagerToken === "number") {
        params.offset = pagerToken;
      } else {
        params.continuationToken = pagerToken;
      }
    }

    // Call the client (mock or real) — both should accept the above args (mock accepts continuationToken).
    const resp = await ebayClient.getOrdersPage(params);

    // Normalize response: some clients return { orders, nextToken }, others { orders, nextOffset }
    const orders = resp.orders ?? [];
    const nextToken = resp.nextToken ?? resp.nextOffset ?? null;

    for (const raw of orders) {
      const { order, lines } = mapEbayOrderToModels(raw);

      // store raw payload (handy for debugging)
      const rawRow = await prisma.rawPayload.create({
        data: { source: "ebay.getOrders", payload: raw }
      });

      // upsert order (idempotent)
      const upserted = await prisma.order.upsert({
        where: { ebayOrderId: order.ebayOrderId },
        update: { ...order, rawId: rawRow.id },
        create: { id: undefined, ...order, rawId: rawRow.id }
      });

      // upsert lines (idempotent on [orderId, ebayLineId])
      for (const li of lines) {
        await prisma.orderLine.upsert({
          where: { orderId_ebayLineId: { orderId: upserted.id, ebayLineId: li.ebayLineId } },
          update: { ...li },
          create: { orderId: upserted.id, ...li }
        });

        // quick matcher (SKU → InventoryItem)
        if (li.sku) {
          const item = await prisma.inventoryItem.findUnique({ where: { sku: li.sku } });
          if (item) {
            await prisma.orderLine.update({
              where: { orderId_ebayLineId: { orderId: upserted.id, ebayLineId: li.ebayLineId } },
              data: { inventoryItemId: item.id }
            });
          }
        }
      }

      created += 1;
    }

    // If client returned null, empty string, or undefined -> stop
    if (nextToken === null || nextToken === undefined) break;

    // Prepare for next loop:
    // If it's numeric-like, convert to number so the next call will pass offset.
    pagerToken = typeof nextToken === "number" ? nextToken : nextToken;
  }

  return { created, updated };
}

