// backend/src/routes/auth.js  (snippet)
import express from "express";
import crypto from "crypto";
import { RestEbayClient } from "../ebay/client.real.js";
import { prisma } from "../db.js";

const router = express.Router();
const oauthStateStore = new Map();

function cryptoRandom() { return crypto.randomBytes(16).toString("hex"); }

router.get("/ebay/connect", (req, res) => {
  const state = cryptoRandom();
  oauthStateStore.set(state, Date.now());
  const url = RestEbayClient.getAuthorizeUrl({
    scopes: ["https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"],
    state
  });
  console.log("Redirecting to:", url);
  res.redirect(url);
});

router.get("/ebay/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!state || !oauthStateStore.has(state)) return res.status(400).send("Invalid state");
  oauthStateStore.delete(state);

  try {
    const { accessToken, refreshToken, accessTokenExpiresAt, raw } = await RestEbayClient.exchangeCode(code);
    const dummyUserId = "user-1";
    await prisma.ebayToken.upsert({
      where: { userId: dummyUserId },
      update: { accessToken, refreshToken, accessTokenExpiresAt },
      create: { userId: dummyUserId, accessToken, refreshToken, accessTokenExpiresAt }
    });
    res.send("Connected (sandbox). You can close this window.");
  } catch (err) {
    console.error("OAuth exchange failed", err);
    res.status(500).send("OAuth exchange failed");
  }
});

export default router;
