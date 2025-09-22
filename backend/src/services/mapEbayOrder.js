// src/services/mapEbayOrder.js
export function mapEbayOrderToModels(orderJson) {
  const toCents = (v) => Math.round(Number(v || 0) * 100);

  const order = {
    ebayOrderId: orderJson.orderId,
    createdAt: new Date(orderJson.creationDate),
    buyer: orderJson.buyer?.username ?? null,
    totalCents: toCents(orderJson.pricingSummary?.total?.value),
    taxCents: toCents(orderJson.pricingSummary?.tax?.value),
    shippingCents: toCents(orderJson.pricingSummary?.deliveryCost?.value)
  };

  const lines = (orderJson.lineItems || []).map((li) => ({
    ebayLineId: li.lineItemId ?? null,
    sku: li.sku ?? null,
    ebayItemId: li.itemId ?? null,
    qty: Number(li.quantity || 1),
    itemPriceCents: toCents(li.lineItemCost?.value)
  }));

  return { order, lines };
}
