// ESM module
// Mock eBay client with the same method signatures you'll use in production.
// No external deps.

const MOCK_ACCESS_TOKEN = "mock_access_token";
const MOCK_REFRESH_TOKEN = "mock_refresh_token";
const NOW = () => new Date();

// --- tiny in-memory "orders" fixture (2 orders, 3 lines) ---
// Keep the shape close to what Fulfillment getOrders returns so your mapper doesn't drift.
const ORDERS_FIXTURE = [
  {
    orderId: "MOCK-ORDER-1001",
    creationDate: "2025-08-31T14:12:03.000Z",
    buyer: { username: "buyer_one" },
    pricingSummary: {
      total: { value: "42.50", currency: "USD" },
      deliveryCost: { value: "5.00", currency: "USD" },
      tax: { value: "3.50", currency: "USD" }
    },
    lineItems: [
      {
        lineItemId: "LI-1001-1",
        sku: "INV-2509-AAA001",          // present → should auto-link
        itemId: "MOCK-ITEM-9001",
        quantity: 1,
        lineItemCost: { value: "34.00", currency: "USD" }
      }
    ]
  },
  {
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
        sku: null,                        // missing SKU → will be "unlinked" at first
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
  }
];

// Simple helper to slice pages and return a continuation token.
function paginate(array, pageSize, token) {
  const start = token ? Number(token) : 0;
  const end = Math.min(start + pageSize, array.length);
  const next = end < array.length ? String(end) : null;
  return { slice: array.slice(start, end), next };
}

export const MockEbayClient = {
  /**
   * Build an authorize URL (mocked)
   * In prod this would hit https://auth.sandbox.ebay.com/oauth2/authorize
   */
  getAuthorizeUrl({ clientId, ruName, scopes = [], state = "" }) {
    const scopeParam = encodeURIComponent(scopes.join(" "));
    // Return a URL that *looks* like eBay's but stays local for dev.
    return `http://localhost:3000/mock/ebay/authorize?client_id=${encodeURIComponent(
      clientId || "mock"
    )}&ruName=${encodeURIComponent(ruName || "mock")}&scope=${scopeParam}&state=${encodeURIComponent(
      state
    )}`;
  },

  /**
   * Exchange a code for tokens (mocked)
   */
  async exchangeCode(/* code */) {
    // In prod you'd call the token endpoint with grant_type=authorization_code
    const expiresAt = new Date(NOW().getTime() + 55 * 60 * 1000); // ~55 mins
    return {
      accessToken: MOCK_ACCESS_TOKEN,
      refreshToken: MOCK_REFRESH_TOKEN,
      accessTokenExpiresAt: expiresAt,
      ebayUserId: "mock_seller_123"
    };
  },

  /**
   * Use a refresh token to mint a new access token (mocked)
   */
  async refreshAccessToken(/* refreshToken */) {
    const expiresAt = new Date(NOW().getTime() + 55 * 60 * 1000);
    return {
      accessToken: MOCK_ACCESS_TOKEN + "_refreshed",
      accessTokenExpiresAt: expiresAt
    };
  },

  /**
   * getOrdersPage simulates eBay Fulfillment getOrders pagination.
   * @param {Object} opts
   * @param {Date=}  opts.createdFrom
   * @param {Date=}  opts.createdTo
   * @param {string=} opts.continuationToken
   * @param {number=} opts.limit
   * @returns {Promise<{ orders: any[], nextToken: string | null }>}
   */
  async getOrdersPage({ createdFrom, createdTo, continuationToken, limit = 1 } = {}) {
    // Filter by date window if provided (works on creationDate)
    const filtered = ORDERS_FIXTURE.filter((o) => {
      const ts = new Date(o.creationDate).getTime();
      const fromOk = createdFrom ? ts >= createdFrom.getTime() : true;
      const toOk = createdTo ? ts < createdTo.getTime() : true;
      return fromOk && toOk;
    });

    const { slice, next } = paginate(filtered, limit, continuationToken);

    // Mimic network latency a bit (optional)
    await new Promise((r) => setTimeout(r, 10));

    return { orders: slice, nextToken: next };
  }
};
