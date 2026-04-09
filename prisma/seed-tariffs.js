require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const tariffs = [
  {
    name: "Slim",
    title: "Slim",
    kcal: "≈ 1450–1650 ккал",
    price: "від 610 ₴",
    basePrice: 610,
    imageUrl: "",
  },
  {
    name: "Balance",
    title: "Balance",
    kcal: "≈ 1750–1950 ккал",
    price: "від 700 ₴",
    basePrice: 700,
    imageUrl: "",
  },
  {
    name: "Active",
    title: "Active",
    kcal: "≈ 2100–2350 ккал",
    price: "від 800 ₴",
    basePrice: 800,
    imageUrl: "",
  },
  {
    name: "Sport",
    title: "Sport Active+",
    kcal: "≈ 2500–2800 ккал",
    price: "від 900 ₴",
    basePrice: 900,
    imageUrl: "",
  },
  {
    name: "Sushka XS",
    title: "Сушка XS",
    kcal: "≈ 1600–1800 ккал",
    price: "від 500 ₴",
    basePrice: 500,
    imageUrl: "",
  },
  {
    name: "Sushka S",
    title: "Сушка S",
    kcal: "≈ 1600–1800 ккал",
    price: "від 600 ₴",
    basePrice: 600,
    imageUrl: "",
  },
  {
    name: "Indiv",
    title: "Індивідуальний",
    kcal: "За вашим планом",
    price: "від 700 ₴",
    basePrice: 700,
    imageUrl: "",
  },
];

async function main() {
  console.log("Seeding tariffs...");

  for (const tariff of tariffs) {
    await prisma.tariff.upsert({
      where: { name: tariff.name },
      update: tariff,
      create: tariff,
    });
    console.log(`✓ ${tariff.name}`);
  }

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
