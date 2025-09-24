import express from "express";
import { ensureFreshAccessToken } from "../services/ebayAuth.js";
import { RestEbayClient } from "../ebay/client.real.js";

const router = express.Router();

router.get("/orders", async (req, res) => {
  try {
    const userId = req.query.userId || "user-1";
    const offset = Number(req.query.offset || 0);
    const limit = Number(req.query.limit || 50);
    const accessToken = await ensureFreshAccessToken(userId);
    const { orders, nextOffset, raw } = await RestEbayClient.getOrdersPage({
      accessToken,
      createdFrom: req.query.from ? new Date(req.query.from) : undefined,
      createdTo: req.query.to ? new Date(req.query.to) : undefined,
      limit, offset
    });
    res.json({ orders, nextOffset, raw });
  } catch (err) {
    console.error("[GET /ebay/orders] error", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

const accessToken = await ensureFreshAccessToken(req.query.userId || "user-1");
const { orders, nextOffset } = await RestEbayClient.getOrdersPage({ accessToken, limit, offset });
res.json({ orders, nextOffset });


export default router;
