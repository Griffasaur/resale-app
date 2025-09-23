// backend/src/routes/debug.js
import express from "express";
import { prisma } from "../db.js";

const router = express.Router();
const DUMMY_USER_ID = "user-1"; // match your syncOrders / auth flow

router.get("/ebay-token", async (req, res) => {
  try {
    const token = await prisma.ebayToken.findUnique({ where: { userId: DUMMY_USER_ID } });
    if (!token) return res.status(404).json({ error: "No token found, connect first" });

    res.json({
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshToken: token.refreshToken
    });
  } catch (err) {
    console.error("[Debug] Failed to fetch token", err);
    res.status(500).json({ error: "Failed to fetch token" });
  }
});

export default router;
