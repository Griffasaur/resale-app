// src/routes/sync.js (or inside app.js for now)
import { ebayClient } from "../ebay/index.js";
import { mapEbayOrderToModels } from "../services/mapEbayOrder.js";
import { prisma } from "../db.js";

export async function syncOrders({ days = 90 } = {}) {
  const createdTo = new Date();
  const createdFrom = new Date(createdTo.getTime() - days * 24 * 60 * 60 * 1000);

  let token = null;
  let created = 0;
  let updated = 0;

  do {
    const { orders, nextToken } = await ebayClient.getOrdersPage({
      createdFrom, createdTo, continuationToken: token, limit: 1 // 1=forces paging; use 50 later
    });

    for (const raw of orders) {
      const { order, lines } = mapEbayOrderToModels(raw);

      // store raw payload (handy for debugging)
      const rawRow = await prisma.rawPayload.create({
        data: { source: "mock.getOrders", payload: raw }
      });

      // upsert order
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

      // stats (was this an insert or update?)
      // crude: if first time, consider "created" — you can refine using try/catch or a select before upsert
      created += 1;
    }

    token = nextToken;
  } while (token);

  return { created, updated };
}
