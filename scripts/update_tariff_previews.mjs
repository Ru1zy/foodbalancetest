import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

async function updateTariffs() {
  const updates = [
    { name: "Slim", previewImageUrl: "/images/meals/slim-meals.jpg", imageUrl: "/images/rations/slim-prices.jpg" },
    { name: "Balance", previewImageUrl: "/images/meals/balance-meals.jpg", imageUrl: "/images/rations/balance-prices.jpg" },
    { name: "Active", previewImageUrl: "/images/meals/active-meals.jpg", imageUrl: "/images/rations/active-prices.jpg" },
    { name: "Sport", previewImageUrl: "/images/meals/sport-meals.jpg", imageUrl: "/images/rations/sport-prices.jpg" },
    { name: "Sushka XS", previewImageUrl: "/images/meals/sushka-xs-meals.jpg", imageUrl: "/images/sushka/prices-xs.jpg" },
    { name: "Sushka S", previewImageUrl: "/images/meals/sushka-s-meals.jpg", imageUrl: "/images/sushka/prices-s.jpg" },
    { name: "Indiv", previewImageUrl: "/images/meals/individual-meals.jpg", imageUrl: "/images/rations/programs-overview.jpg" },
  ];

  for (const item of updates) {
    const updated = await prisma.tariff.updateMany({
      where: { name: item.name },
      data: {
        previewImageUrl: item.previewImageUrl,
        imageUrl: item.imageUrl,
      },
    });
    console.log(`Updated ${item.name}: ${updated.count}`);
  }

  const all = await prisma.tariff.findMany();
  console.log("Current tariffs in DB:");
  for (const t of all) {
    console.log(`- ${t.name}: preview=${t.previewImageUrl}, detail=${t.imageUrl}`);
  }
}

updateTariffs()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Done!");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
