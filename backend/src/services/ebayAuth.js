// backend/src/services/ebayAuth.js
import { prisma } from "../db.js";
import { RestEbayClient } from "../ebay/client.real.js";

const REFRESH_BEFORE_MS = 60 * 1000; // refresh if less than 60s left
const DUMMY_USER_ID = "user-1"; // keep in sync with other places

export async function ensureFreshAccessToken(userId = DUMMY_USER_ID) {
  const tok = await prisma.ebayToken.findUnique({ where: { userId } });
  if (!tok) throw new Error(`No eBay token found for userId="${userId}" — visit /auth/ebay/connect`);

  const now = Date.now();
  const expiresAt = tok.accessTokenExpiresAt ? new Date(tok.accessTokenExpiresAt).getTime() : 0;

  // still valid
  if (expiresAt - now > REFRESH_BEFORE_MS) {
    return tok.accessToken;
  }

  if (!tok.refreshToken) {
    throw new Error(`No refresh token available for userId="${userId}" — re-auth required`);
  }

  // Try to refresh once. If it fails, surface the error.
  try {
    const refreshed = await RestEbayClient.refreshAccessToken(tok.refreshToken);

    // Persist refreshed access token; don't block return on DB write failures
    try {
      await prisma.ebayToken.update({
        where: { userId },
        data: {
          accessToken: refreshed.accessToken,
          accessTokenExpiresAt: refreshed.accessTokenExpiresAt
        }
      });
    } catch (dbErr) {
      console.warn("[ebayAuth] Failed to persist refreshed token to DB:", dbErr);
      // proceed anyway — we have a fresh token to return
    }

    return refreshed.accessToken;
  } catch (err) {
    // If refresh fails, include helpful context
    throw new Error(`Failed to refresh eBay access token for userId="${userId}": ${err.message}`);
  }
}
