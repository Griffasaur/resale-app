// backend/src/ebay/client.real.js
import "dotenv/config";

const EBAY_ENV = (process.env.EBAY_ENV || "sandbox").toLowerCase();
const CLIENT_ID = (process.env.EBAY_CLIENT_ID || "").toString().trim();
const CLIENT_SECRET = (process.env.EBAY_CLIENT_SECRET || "").toString().trim();
const RUNAME = process.env.EBAY_RU_NAME ? process.env.EBAY_RU_NAME.toString().trim() : "";
const REDIRECT_URI = process.env.EBAY_REDIRECT_URL ? process.env.EBAY_REDIRECT_URL.toString().trim() : "";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn("[eBay] WARNING - CLIENT_ID or CLIENT_SECRET missing in env");
}

const HOST = EBAY_ENV === "prod" || EBAY_ENV === "production"
  ? { auth: "https://auth.ebay.com", api: "https://api.ebay.com" }
  : { auth: "https://auth.sandbox.ebay.com", api: "https://api.sandbox.ebay.com" };

const AUTHORIZE_BASE = `${HOST.auth}/oauth2/authorize`;
const TOKEN_URL = `${HOST.api}/identity/v1/oauth2/token`;
const FULFILLMENT_BASE = `${HOST.api}/sell/fulfillment/v1`;

function basicAuthHeader() {
  return `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;
}

export const RestEbayClient = {
  /**
   * Build the eBay authorize URL.
   * Uses RUNAME if present (exact match expected by eBay), otherwise falls back to REDIRECT_URI.
   */
  getAuthorizeUrl({
    scopes = ["https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"],
    state = ""
  } = {}) {
    if (!CLIENT_ID) throw new Error("[eBay] Missing CLIENT_ID in env");

    // prefer the explicit RuName (or redirect value) as registered in eBay portal
    const redirect = (RUNAME || REDIRECT_URI || "").toString().trim();
    if (!redirect) throw new Error("[eBay] Missing RUNAME / REDIRECT_URI in env - please set EBAY_RU_NAME or EBAY_REDIRECT_URL");

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirect,
      response_type: "code",
      scope: scopes.join(" "),
      state
    });

    // URLSearchParams encodes space as '+', convert to %20 for safety
    let url = `${AUTHORIZE_BASE}?${params.toString()}`;
    url = url.replace(/\+/g, "%20");

    // helpful debug log (remove in prod)
    console.log("[eBay] Authorize URL:", url);

    return url;
  },

  /**
   * Exchange authorization code for tokens.
   */
  async exchangeCode(code) {
    if (!code) throw new Error("exchangeCode requires code");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: (RUNAME || REDIRECT_URI)
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`[eBay] Token exchange failed: ${res.status} ${res.statusText} ${txt}`);
    }

    const json = await res.json();
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      accessTokenExpiresAt: new Date(Date.now() + (json.expires_in || 3600) * 1000),
      raw: json
    };
  },

  /**
   * Refresh an access token using a refresh token.
   */
  async refreshAccessToken(refreshToken, scopes = ["https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"]) {
    if (!refreshToken) throw new Error("refreshAccessToken requires refreshToken");

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: scopes.join(" ")
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`[eBay] Refresh failed: ${res.status} ${res.statusText} ${txt}`);
    }

    const json = await res.json();
    return {
      accessToken: json.access_token,
      accessTokenExpiresAt: new Date(Date.now() + (json.expires_in || 3600) * 1000),
      raw: json
    };
  },

  /**
   * Get a page of orders via Fulfillment API.
   * Accepts createdFrom/createdTo and either offset or default pagination.
   */
  async getOrdersPage({ accessToken, createdFrom, createdTo, limit = 50, offset = 0 } = {}) {
    if (!accessToken) throw new Error("getOrdersPage requires accessToken");

    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("fieldGroups", "TAX_BREAKDOWN");

    const filters = [];
    if (createdFrom) filters.push(`creationdate:[${createdFrom.toISOString()}..]`);
    if (createdTo) filters.push(`creationdate:[..${createdTo.toISOString()}]`);
    if (filters.length) params.set("filter", filters.join(" AND "));

    const url = `${FULFILLMENT_BASE}/order?${params.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (res.status === 401) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Unauthorized: ${txt}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[eBay] getOrders failed: ${res.status} ${res.statusText} ${text}`);
    }

    const json = await res.json();
    const orders = Array.isArray(json.orders) ? json.orders : [];
    const total = typeof json.total === "number" ? json.total : undefined;

    let nextOffset = null;
    if (typeof total === "number") {
      const next = offset + limit;
      if (next < total) nextOffset = next;
    } else if (json.href || json.next) {
      const nextUrl = json.next || json.href;
      try {
        const u = new URL(nextUrl);
        const off = u.searchParams.get("offset");
        if (off) nextOffset = Number(off);
      } catch (e) {
        // ignore
      }
    }

    return { orders, nextOffset, raw: json };
  }
};
