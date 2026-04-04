import { PrismaClient } from "../prisma/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  await prisma.menu.deleteMany();

  const templateMenus = [
    {
      dayOfWeek: 1,
      packageType: "Template",
      dishes: {
        breakfast: [{ full: "Млинці з маком та ягодами", short: "Млинцы ёпта" }],
        lunch: [{ full: "Індичка в апельсиновому соусі з булгуром", short: "Індичка" }],
        dinner: [{ full: "Салат з червоної капусти, кукурудзи та курки", short: "Салат" }],
        snack: [],
      },
    },
    {
      dayOfWeek: 2,
      packageType: "Template",
      dishes: {
        breakfast: [{ full: "Артемий Какашкинсон", short: "Артемий Какашкинсон" }],
        lunch: [{ full: "Тест 3", short: "Короткое название" }],
        dinner: [{ full: "Тест 5", short: "Тест 5" }],
        snack: [],
      },
    },
  ];

  const sushkaMenus = [
    {
      dayOfWeek: 1,
      packageType: "Sushka",
      dishes: {
        breakfast: [{ full: "Фулл 1", short: "Шорт 1" }],
        lunch: [{ full: "АНРУИЗЕД ХИРЕ", short: "АНРУИЗЕД ХИРЕ" }],
        dinner: [{ full: "тест", short: "тест" }],
        snack: [{ full: "тест", short: "тест" }],
      },
    },
    {
      dayOfWeek: 2,
      packageType: "Sushka",
      dishes: {
        breakfast: [{ full: "Фулл 2", short: "Шорт 2" }],
        lunch: [{ full: "тест", short: "тест" }],
        dinner: [{ full: "тест", short: "тест" }],
        snack: [{ full: "тест", short: "тест" }],
      },
    },
  ];

  await prisma.menu.createMany({ data: [...templateMenus, ...sushkaMenus] });
  console.log("Seed data for Menu has been created.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });