import { describe, test, expect } from "@jest/globals";
import { mapEbayOrderToModels } from "../src/services/mapEbayOrder.js";

const MOCK_ORDER = {
  orderId: "MOCK-ORDER-1002",
  creationDate: "2025-09-01T09:47:55.000Z",
  buyer: { username: "buyer_two" },
  pricingSummary: {
    total: { value: "120.00", currency: "USD" },
    deliveryCost: { value: "0.00", currency: "USD" },
    tax: { value: "0.00", currency: "USD" }
  },
  lineItems: [
    {
      lineItemId: "LI-1002-1",
      sku: null,
      itemId: "MOCK-ITEM-9002",
      quantity: 2,
      lineItemCost: { value: "50.00", currency: "USD" }
    },
    {
      lineItemId: "LI-1002-2",
      sku: "INV-2509-AAA002",
      itemId: "MOCK-ITEM-9003",
      quantity: 1,
      lineItemCost: { value: "20.00", currency: "USD" }
    }
  ]
};

describe("mapEbayOrderToModels", () => {
  test("maps core fields and converts money to cents", () => {
    const { order, lines } = mapEbayOrderToModels(MOCK_ORDER);

    // order fields
    expect(order.ebayOrderId).toBe("MOCK-ORDER-1002");
    expect(order.buyer).toBe("buyer_two");
    expect(order.createdAt instanceof Date).toBe(true);
    expect(order.totalCents).toBe(12000);
    expect(order.taxCents).toBe(0);
    expect(order.shippingCents).toBe(0);

    // lines
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      ebayLineId: "LI-1002-1",
      sku: null,
      ebayItemId: "MOCK-ITEM-9002",
      qty: 2,
      itemPriceCents: 5000
    });
    expect(lines[1]).toMatchObject({
      ebayLineId: "LI-1002-2",
      sku: "INV-2509-AAA002",
      ebayItemId: "MOCK-ITEM-9003",
      qty: 1,
      itemPriceCents: 2000
    });
  });

  test("handles missing/undefined fields gracefully", () => {
    const { order, lines } = mapEbayOrderToModels({
      orderId: "X",
      creationDate: "2025-01-01T00:00:00.000Z",
      // buyer omitted
      pricingSummary: {},    // totals omitted
      lineItems: [{}]        // minimal line
    });

    expect(order.totalCents).toBe(0);
    expect(order.taxCents).toBe(0);
    expect(order.shippingCents).toBe(0);
    expect(lines[0]).toMatchObject({
      ebayLineId: null,
      sku: null,
      ebayItemId: null,
      qty: 1,
      itemPriceCents: 0
    });
  });
});
