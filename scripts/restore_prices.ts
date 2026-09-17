import prisma from "../lib/prisma.ts";

const ORIGINAL = {
  Slim: { basePrice: 610, price: "610 ₴" },
  Balance: { basePrice: 670, price: "670 ₴" },
  Active: { basePrice: 750, price: "750 ₴" },
  Sport: { basePrice: 850, price: "850 ₴" },
  "Sushka XS": { basePrice: 710, price: "710 ₴" },
  "Sushka S": { basePrice: 770, price: "770 ₴" },
};

async function main() {
  for (const [name, data] of Object.entries(ORIGINAL)) {
    await prisma.tariff.updateMany({
      where: { name },
      data,
    });
    console.log(`Restored ${name} -> basePrice: ${data.basePrice}, price: "${data.price}"`);
  }
  console.log("PRODUCTION PRICES RESTORED");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
