import express from "express";
import { prisma } from "./db.js";
import authRoutes from "./routes/auth.js";

app.use("/auth", authRoutes);

export const app = express();
app.use(express.json());

// health
app.get("/healthz", (req, res) => res.json({ ok: true }));

// sanity routes
app.get("/", (req, res) => res.send("resale-app backend is alive"));
app.get("/test", async (req, res) => {
  const items = await prisma.inventoryItem.findMany();
  res.json(items);
});

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


// Temporary Test Sync
import { syncOrders } from "./routes/sync.js"; 

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
