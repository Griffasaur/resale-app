import request from "supertest";
import { jest } from "@jest/globals";


// ---- Mock prisma layer ----
const mockInventory = [
  {
    id: "item-1",
    sku: "INV-123",
    title: "Vintage Card",
    costCents: 1000,
    quantityOnHand: 1,
    userId: "user-1",
    isCollection: false,
    parentId: null,
    listingLinks: [],
    parent: null,
    children: []
  }
];

const prismaMocks = {
  inventoryItem: {
    findMany: jest.fn(async () => mockInventory),
    create: jest.fn(async ({ data }) => ({
      id: "item-new",
      listingLinks: [],
      parent: null,
      children: [],
      ...data
    })),
    update: jest.fn(async ({ where, data }) => ({
      ...mockInventory[0],
      id: where.id,
      ...data
    })),
    delete: jest.fn(async ({ where }) => ({ id: where.id }))
  }
};

// Replace the real prisma with our mock
jest.unstable_mockModule("../src/db.js", () => ({
  prisma: prismaMocks
}));

// Re-import app AFTER mocking (Node ESM quirk)
const { app: mockedApp } = await import("../src/app.js");

describe("Inventory routes", () => {
  test("GET /inventory returns list", async () => {
    const res = await request(mockedApp).get("/inventory");
    expect(res.status).toBe(200);
    expect(prismaMocks.inventoryItem.findMany).toHaveBeenCalledTimes(1);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].title).toBe("Vintage Card");
  });

  test("POST /inventory creates item", async () => {
    const payload = {
      title: "New Thing",
      costCents: 500,
      quantityOnHand: 2,
      userId: "user-1"
    };

    const res = await request(mockedApp)
      .post("/inventory")
      .send(payload);

    expect(res.status).toBe(201);
    expect(prismaMocks.inventoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "New Thing",
          costCents: 500,
          quantityOnHand: 2,
          userId: "user-1"
        })
      })
    );
    expect(res.body.title).toBe("New Thing");
    expect(res.body.sku).toMatch(/^INV-/);
  });

  test("PUT /inventory/:id updates item", async () => {
    const res = await request(mockedApp)
      .put("/inventory/item-1")
      .send({ title: "Updated", costCents: 750, quantityOnHand: 3 });

    expect(res.status).toBe(200);
    expect(prismaMocks.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-1" },
        data: { title: "Updated", costCents: 750, quantityOnHand: 3 }
      })
    );
    expect(res.body.title).toBe("Updated");
    expect(res.body.costCents).toBe(750);
  });

  test("DELETE /inventory/:id removes item", async () => {
    const res = await request(mockedApp).delete("/inventory/item-1");
    expect(res.status).toBe(200);
    expect(prismaMocks.inventoryItem.delete).toHaveBeenCalledWith({
      where: { id: "item-1" }
    });
    expect(res.body).toEqual({ message: "Item deleted" });
  });
});
