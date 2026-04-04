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
        breakfast: [
          { full: "Омлет з зеленню", short: "Омлет" },
          { full: "Тост з авокадо", short: "Тост" },
        ],
        lunch: [
          { full: "Суп-пюре з броколі", short: "Суп" },
          { full: "Курячі котлети з гречкою", short: "Котлети" },
        ],
        dinner: [
          { full: "Запечена риба з овочами", short: "Риба" },
          { full: "Куряче філе з булгуром", short: "Філе" },
        ],
        snack: [
          { full: "Грецький йогурт з ягодами", short: "Йогурт" },
          { full: "Мигдальні палички", short: "Палички" },
        ],
      },
    },
    {
      dayOfWeek: 2,
      packageType: "Template",
      dishes: {
        breakfast: [
          { full: "Запіканка з сиром", short: "Запіканка" },
          { full: "Фруктовий салат", short: "Салат" },
        ],
        lunch: [
          { full: "Плов зі свининою", short: "Плов" },
          { full: "Овочевий рататуй", short: "Рататуй" },
        ],
        dinner: [
          { full: "Куряча грудка з овочами", short: "Грудка" },
          { full: "Паста з томатним соусом", short: "Паста" },
        ],
        snack: [
          { full: "Сирники з медом", short: "Сирники" },
          { full: "Смузі з бананом", short: "Смузі" },
        ],
      },
    },
    {
      dayOfWeek: 3,
      packageType: "Template",
      dishes: {
        breakfast: [
          { full: "Вівсянка з яблуками", short: "Вівсянка" },
          { full: "Йогурт з горіхами", short: "Йогурт" },
        ],
        lunch: [
          { full: "Салат Цезар з куркою", short: "Цезар" },
          { full: "Рисова каша з овочами", short: "Каша" },
        ],
        dinner: [
          { full: "Індичка з квасолею", short: "Індичка" },
          { full: "Овочеве рагу з кіноа", short: "Рагу" },
        ],
        snack: [
          { full: "Фруктовий мікс", short: "Фрукти" },
          { full: "Сухофрукти і горіхи", short: "Сухофрукти" },
        ],
      },
    },
    {
      dayOfWeek: 4,
      packageType: "Template",
      dishes: {
        breakfast: [
          { full: "Млинці з бананом", short: "Млинці" },
          { full: "Яйце пашот з семгою", short: "Яйце" },
        ],
        lunch: [
          { full: "Крем-суп із кабачків", short: "Суп" },
          { full: "Тушковане м’ясо з картоплею", short: "М’ясо" },
        ],
        dinner: [
          { full: "Салат з куркою та кіноа", short: "Салат" },
          { full: "Печена індичка з броколі", short: "Індичка" },
        ],
        snack: [
          { full: "Морквяний фреш", short: "Фреш" },
          { full: "Цільнозерновий батончик", short: "Батончик" },
        ],
      },
    },
    {
      dayOfWeek: 5,
      packageType: "Template",
      dishes: {
        breakfast: [
          { full: "Яєчня з овочами", short: "Яєчня" },
          { full: "Тост з сиром", short: "Тост" },
        ],
        lunch: [
          { full: "Гречка з грибами", short: "Гречка" },
          { full: "Салат з тунцем", short: "Тунець" },
        ],
        dinner: [
          { full: "Крабові палички з рисом", short: "Краб" },
          { full: "Запечений лосось", short: "Лосось" },
        ],
        snack: [
          { full: "Творожно-ягідний десерт", short: "Десерт" },
          { full: "Горіхова суміш", short: "Горіхи" },
        ],
      },
    },
    {
      dayOfWeek: 6,
      packageType: "Template",
      dishes: {
        breakfast: [
          { full: "Кашка з насінням чіа", short: "Каша" },
          { full: "Печені яблука з корицею", short: "Яблука" },
        ],
        lunch: [
          { full: "Курячий бульйон з лапшою", short: "Бульйон" },
          { full: "Салат з тунцем і овочами", short: "Салат" },
        ],
        dinner: [
          { full: "Печена свинина з овочами", short: "Свинина" },
          { full: "Кальмари з овочами", short: "Кальмари" },
        ],
        snack: [
          { full: "Пахлава", short: "Пахлава" },
          { full: "Заат з йогуртом", short: "Заат" },
        ],
      },
    },
    {
      dayOfWeek: 7,
      packageType: "Template",
      dishes: {
        breakfast: [
          { full: "Омлет з грецьким сиром", short: "Омлет" },
          { full: "Круасан з медом", short: "Круасан" },
        ],
        lunch: [
          { full: "Качка з яблуками", short: "Качка" },
          { full: "Бургер з яловичини", short: "Бургер" },
        ],
        dinner: [
          { full: "Суп з морепродуктами", short: "Суп" },
          { full: "Курка барбекю", short: "Курка" },
        ],
        snack: [
          { full: "Мікс горішків", short: "Горішки" },
          { full: "Фруктовий салат", short: "Фрукти" },
        ],
      },
    },
  ];

  const sushkaMenus = [
    {
      dayOfWeek: 1,
      packageType: "Sushka",
      dishes: {
        breakfast: [{ full: "Фулл 1", short: "Шорт 1" }],
        lunch: [{ full: "Сушені креветки", short: "Креветки" }],
        dinner: [{ full: "Протеїновий салат", short: "Салат" }],
        snack: [{ full: "Протеїновий батончик", short: "Батончик" }],
      },
    },
    {
      dayOfWeek: 2,
      packageType: "Sushka",
      dishes: {
        breakfast: [{ full: "Фулл 2", short: "Шорт 2" }],
        lunch: [{ full: "Сушені індичі смужки", short: "Індичка" }],
        dinner: [{ full: "Сушений тунець", short: "Тунець" }],
        snack: [{ full: "Кешью", short: "Горіхи" }],
      },
    },
    {
      dayOfWeek: 3,
      packageType: "Sushka",
      dishes: {
        breakfast: [{ full: "Фулл 3", short: "Шорт 3" }],
        lunch: [{ full: "Протеїновий салат ваго", short: "Салат" }],
        dinner: [{ full: "Делікатесний м’ясний мікс", short: "М’ясо" }],
        snack: [{ full: "Яблуко", short: "Яблуко" }],
      },
    },
    {
      dayOfWeek: 4,
      packageType: "Sushka",
      dishes: {
        breakfast: [{ full: "Фулл 4", short: "Шорт 4" }],
        lunch: [{ full: "Курячі сосиски", short: "Сосиски" }],
        dinner: [{ full: "Запечена відбивна", short: "Відбивна" }],
        snack: [{ full: "Сир", short: "Сир" }],
      },
    },
    {
      dayOfWeek: 5,
      packageType: "Sushka",
      dishes: {
        breakfast: [{ full: "Фулл 5", short: "Шорт 5" }],
        lunch: [{ full: "Огірково-курячий салат", short: "Салат" }],
        dinner: [{ full: "Тушкована яловичина", short: "Яловичина" }],
        snack: [{ full: "Сухофрукти", short: "Сухофрукти" }],
      },
    },
    {
      dayOfWeek: 6,
      packageType: "Sushka",
      dishes: {
        breakfast: [{ full: "Фулл 6", short: "Шорт 6" }],
        lunch: [{ full: "Питний білковий коктейль", short: "Коктейль" }],
        dinner: [{ full: "Шашлик з курки", short: "Шашлик" }],
        snack: [{ full: "Горіхи", short: "Горіхи" }],
      },
    },
    {
      dayOfWeek: 7,
      packageType: "Sushka",
      dishes: {
        breakfast: [{ full: "Фулл 7", short: "Шорт 7" }],
        lunch: [{ full: "Салат із тунцем", short: "Салат" }],
        dinner: [{ full: "Протеїнова риба", short: "Риба" }],
        snack: [{ full: "Сузі з насінням", short: "Сузі" }],
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