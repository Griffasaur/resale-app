import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      passwordHash: "dummyhash"
    }
  });

  await prisma.inventoryItem.create({
    data: {
      title: "Vintage Card",
      costCents: 1000,
      quantityOnHand: 1,
      userId: user.id
    }
  });
}

main()
  .then(() => console.log("Seeded!"))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
