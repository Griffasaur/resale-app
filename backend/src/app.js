import express from "express";
import { prisma } from "./db.js";
import syncRouter from "./routes/sync.js";
import { syncOrders } from "./services/syncOrders.js";
import authRoutes from "./routes/auth.js";
import debugRoutes from "./routes/debug.js";



export const app = express();

app.use(express.json());

app.use("/auth", authRoutes);

//Debug Routes
app.use("/debug", debugRoutes);

// small dev helpers
app.set("json spaces", 2);
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// mount routers
app.use("/sync", syncRouter);

// root
app.get("/", (_req, res) => res.send("resale-app backend is alive"));

// CRUD: inventory
app.get("/inventory", async (req, res) => {
  const items = await prisma.inventoryItem.findMany({
    include: { listingLinks: true, parent: true, children: true }
  });
  res.json(items);
});

app.post("/inventory", async (req, res) => {
  const { title, costCents, quantityOnHand, userId, parentId } = req.body;
  const sku = `INV-${Date.now()}`;
  const item = await prisma.inventoryItem.create({
    data: {
      title,
      costCents,
      quantityOnHand: quantityOnHand ?? 1,
      sku,
      userId,
      parentId
    }
  });
  res.status(201).json(item);
});

app.put("/inventory/:id", async (req, res) => {
  const { id } = req.params;
  const { title, costCents, quantityOnHand } = req.body;
  const item = await prisma.inventoryItem.update({
    where: { id },
    data: { title, costCents, quantityOnHand }
  });
  res.json(item);
});

app.delete("/inventory/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.inventoryItem.delete({ where: { id } });
  res.json({ message: "Item deleted" });
});

// trigger a sync 
app.post("/sync/orders", async (req, res) => {
  try {
    const days = Number(req.query.days ?? 90);
    const result = await syncOrders({ days });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "sync failed" });
  }
});

// read back sales
app.get("/sales", async (_req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { lines: true }
  });
  res.json(orders);
});

// Debugging

app.get("/debug/ebay-env", (req, res) => {
  res.json({
    EBAY_ENV: process.env.EBAY_ENV,
    EBAY_CLIENT_ID: process.env.EBAY_CLIENT_ID ? "SET" : "MISSING",
    EBAY_RU_NAME: process.env.EBAY_RU_NAME,
    EBAY_REDIRECT_URL: process.env.EBAY_REDIRECT_URL
  });
});