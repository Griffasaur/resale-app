import express from "express";
import { syncOrders } from "../services/syncOrders.js";

const router = express.Router();

router.post("/orders", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const result = await syncOrders({ days });
    res.json(result);
  } catch (err) {
    console.error("[Sync] Failed", err);
    res.status(500).json({ error: "Sync failed" });
  }
});

export default router;
