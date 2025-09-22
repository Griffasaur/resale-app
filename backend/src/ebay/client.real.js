// Real eBay API client (ESM, Node 18+ uses global fetch)
// Reads credentials from process.env:
//   EBAY_ENV = "sandbox" | "prod"  (default "sandbox")
//   EBAY_CLIENT_ID
//   EBAY_CLIENT_SECRET
//   EBAY_RU_NAME   (the OAuth Redirect URI / RuName configured in eBay Dev Portal)
//
// Notes:
// - eBay expects redirect_uri = RuName (NOT a raw URL) for OAuth code/refresh flows
// - Scopes are space-delimited; start with fulfillment read for orders:
//     https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly

const env = (name, fallback = undefined) => {
  const v = process.env[name];
  return v === undefined ? fallback : v;
};

const EBAY_ENV = (env("EBAY_ENV", "sandbox") || "sandbox").toLowerCase();
const CLIENT_ID = env("EBAY_CLIENT_ID");
const CLIENT_SECRET = env("EBAY_CLIENT_SECRET");
const RUNAME = env("EBAY_RU_NAME"); // exact value from eBay Dev Portal

if (!CLIENT_ID || !CLIENT_SECRET || !RUNAME) {
  // Don't crash the process; but make it obvious in logs.
  console.warn(
    "[eBay] Missing EBAY_CLIENT_ID / EBAY_CLIENT_SECRET / EBAY_RU_NAME in environment. OAuth calls will fail."
  );
}

const HOSTS = {
  sandbox: {
    auth: "https://auth.sandbox.ebay.com",
    api: "https://api.sandbox.ebay.com",
  },
  prod: {
    auth: "https://auth.ebay.com",
    api: "https://api.ebay.com",
  },
};

const HOST = HOSTS[EBAY_ENV] || HOSTS.sandbox;

const FULFILLMENT_BASE = `${HOST.api}/sell/fulfillment/v1`;
const AUTHORIZE_URL = `${HOST.auth}/oauth2/authorize`;
const TOKEN_URL = `${HOST.api}/identity/v1/oauth2/token`;

function basicAuthHeader(id, secret) {
  const b64 = Buffer.from(`${id}:${secret}`).toString("base64");
  return `Basic ${b64}`;
}

// Utility: build querystring from object (skips undefined)
function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    search.set(k, String(v));
  }
  return search.toString();
}

// ---- Public Client ----
export const RestEbayClient = {
  /**
   * Build user consent URL (Authorization Code flow).
   * @param {Object} options
   * @param {string[]} options.scopes  space-delimited in request (array here)
   * @param {string} options.state     CSRF token you’ll verify in callback
   * @returns {string}
   */
  getAuthorizeUrl({ scopes = [], state = "" } = {}) {
    const scopeStr = scopes.length ? scopes.join(" ") : "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly";
    // eBay expects redirect_uri to be the configured RuName (not a raw http URL)
    const params = {
      client_id: CLIENT_ID,
      redirect_uri: RUNAME,
      response_type: "code",
      scope: scopeStr,
      state,
      // optional UX hints:
      // prompt: "login", // or "consent"
    };
    return `${AUTHORIZE_URL}?${qs(params)}`;
  },

  /**
   * Exchange authorization code for tokens.
   * @param {string} code  the `code` query param you received in callback
   * @param {string[]} scopes  same scopes (recommended) used for authorize
   * @returns {Promise<{accessToken, refreshToken, accessTokenExpiresAt, ebayUserId?: string}>}
   */
  async exchangeCode(code, scopes = ["https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"]) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: RUNAME,
      // Some eBay flows accept scope here; not strictly required for code exchange,
      // but harmless to include consistently:
      scope: scopes.join(" "),
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(CLIENT_ID, CLIENT_SECRET),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[eBay] code exchange failed: ${res.status} ${res.statusText} ${text}`);
    }

    const json = await res.json();
    // eBay returns expires_in (seconds)
    const accessToken = json.access_token;
    const refreshToken = json.refresh_token;
    const accessTokenExpiresAt = new Date(Date.now() + (json.expires_in ?? 3000) * 1000);
    // ebayUserId is not always returned; can be derived from subsequent calls if needed
    const ebayUserId = json.refresh_token_id || undefined;

    return { accessToken, refreshToken, accessTokenExpiresAt, ebayUserId };
  },

  /**
   * Refresh the access token using a long-lived refresh token.
   * @param {string} refreshToken
   * @param {string[]} scopes  must be included on refresh for many eBay scopes
   * @returns {Promise<{accessToken, accessTokenExpiresAt}>}
   */
  async refreshAccessToken(refreshToken, scopes = ["https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"]) {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(CLIENT_ID, CLIENT_SECRET),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[eBay] refresh failed: ${res.status} ${res.statusText} ${text}`);
    }

    const json = await res.json();
    const accessToken = json.access_token;
    const accessTokenExpiresAt = new Date(Date.now() + (json.expires_in ?? 3000) * 1000);
    return { accessToken, accessTokenExpiresAt };
  },

  /**
   * Fulfillment: getOrders with simple offset pagination.
   * You provide a valid user access token (with fulfillment scope).
   *
   * @param {Object} opts
   * @param {string} opts.accessToken     (required)
   * @param {Date=}  opts.createdFrom     optional filter
   * @param {Date=}  opts.createdTo       optional filter
   * @param {number=} opts.limit          default 50 (max allowed varies)
   * @param {number=} opts.offset         default 0; use `nextOffset` returned below
   * @returns {Promise<{ orders: any[], nextOffset: number|null }>}
   */
  async getOrdersPage({ accessToken, createdFrom, createdTo, limit = 50, offset = 0 } = {}) {
    if (!accessToken) throw new Error("[eBay] getOrdersPage requires accessToken");

    const params = {
      limit,
      offset,
      fieldGroups: "TAX_BREAKDOWN",
    };

    // Date filters are ISO-8601 timestamps; use creationdate range if you want
    if (createdFrom) params.filter = appendFilter(params.filter, `creationdate:[${createdFrom.toISOString()}..]`);
    if (createdTo)   params.filter = appendFilter(params.filter, `creationdate:[..${createdTo.toISOString()}]`);

    const url = `${FULFILLMENT_BASE}/order?${qs(params)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    // Handle common transient issues (rate-limit 429, 5xx) with a simple retry
    if (res.status === 429 || res.status >= 500) {
      await sleep(500);
      const retry = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      if (!retry.ok) {
        const t = await retry.text().catch(() => "");
        throw new Error(`[eBay] getOrders retry failed: ${retry.status} ${retry.statusText} ${t}`);
      }
      return parseOrders(await retry.json(), limit, offset);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[eBay] getOrders failed: ${res.status} ${res.statusText} ${text}`);
    }

    const json = await res.json();
    return parseOrders(json, limit, offset);
  },
};

// ---- helpers ----

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function appendFilter(current, frag) {
  if (!current) return frag;
  return `${current} AND ${frag}`;
}

// Extract orders + derive next offset from total/limit/offset.
// eBay responses include pagination hints (href/next links); offset math is simple and robust.
function parseOrders(json, limit, currentOffset) {
  const orders = Array.isArray(json.orders) ? json.orders : [];
  const total = typeof json.total === "number" ? json.total : undefined;

  let nextOffset = null;
  if (typeof total === "number") {
    const next = currentOffset + limit;
    nextOffset = next < total ? next : null;
  } else if (json.next) {
    // Fallback: if "next" link present, parse its `offset` param
    const url = new URL(json.next);
    const off = url.searchParams.get("offset");
    nextOffset = off ? Number(off) : null;
  }

  return { orders, nextOffset };
}
