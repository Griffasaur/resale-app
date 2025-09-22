import express from "express";
import crypto from "crypto";
import { ebayClient } from "../ebay/index.js";
import { prisma } from "../db.js";

const router = express.Router();

// utility for CSRF/random state
function cryptoRandom() {
  return crypto.randomBytes(16).toString("hex");
}

// start OAuth: redirect user to eBay consent
router.get("/ebay/connect", (req, res) => {
  const state = cryptoRandom();
  // TODO: save `state` to session or db for verification in callback
  const url = ebayClient.getAuthorizeUrl({
    scopes: ["https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"],
    state,
  });
  res.redirect(url);
});

// callback after user authorizes
router.get("/ebay/callback", async (req, res) => {
  const { code, state } = req.query;
  // TODO: verify `state` against stored value

  try {
    const { accessToken, refreshToken, accessTokenExpiresAt, ebayUserId } =
      await ebayClient.exchangeCode(code);

    // for now, just attach to a dummy user (replace with real auth’d user later)
    const dummyUserId = "user-1";

    await prisma.ebayToken.upsert({
      where: { userId: dummyUserId },
      update: { accessToken, refreshToken, accessTokenExpiresAt, ebayUserId },
      create: { userId: dummyUserId, accessToken, refreshToken, accessTokenExpiresAt, ebayUserId },
    });

    res.send("✅ eBay account connected. You can close this window.");
  } catch (err) {
    console.error(err);
    res.status(500).send("eBay OAuth failed");
  }
});

export default router;
