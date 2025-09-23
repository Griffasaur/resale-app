import { prisma } from "../db.js";
import { RestEbayClient } from "../ebay/client.real.js";

const REFRESH_BEFORE_MS = 60 * 1000; // refresh if less than 60s left

export async function ensureFreshAccessToken(userId) {
  const tok = await prisma.ebayToken.findFirst({ where: { userId } });
  if (!tok) throw new Error("No EbayToken for user");

  const now = Date.now();
  const expiresAt = tok.accessTokenExpiresAt ? new Date(tok.accessTokenExpiresAt).getTime() : 0;

  if (expiresAt - now > REFRESH_BEFORE_MS) {
    return tok.accessToken;
  }

  // Refresh flow
  const refreshed = await RestEbayClient.refreshAccessToken(tok.refreshToken);
  await prisma.ebayToken.update({
    where: { id: tok.id },
    data: { accessToken: refreshed.accessToken, accessTokenExpiresAt: refreshed.accessTokenExpiresAt }
  });
  return refreshed.accessToken;
}
