import { prisma } from "../db.js";
import { RestEbayClient } from "./client.real.js"; // or import from factory if you prefer

const REFRESH_BEFORE_MS = 60 * 1000; // refresh if less than 60s left

export async function ensureFreshAccessToken(userId) {
  const tok = await prisma.ebayToken.findFirst({ where: { userId } });
  if (!tok) throw new Error("No EbayToken for user");

  const now = new Date();
  if (tok.accessTokenExpiresAt && new Date(tok.accessTokenExpiresAt).getTime() - now.getTime() > REFRESH_BEFORE_MS) {
    return tok.accessToken;
  }

  // refresh
  const { accessToken, accessTokenExpiresAt } = await RestEbayClient.refreshAccessToken(tok.refreshToken);
  await prisma.ebayToken.update({
    where: { id: tok.id },
    data: { accessToken, accessTokenExpiresAt }
  });
  return accessToken;
}
