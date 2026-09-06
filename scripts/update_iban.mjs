import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

const IBAN_DETAILS = `ОТРИМУВАЧ: ВОВК СОФІЯ СТАНІСЛАВІВНА
ЄДРПОУ: 3946803829
IBAN: UA223003350000000260072473479
Призначення платежу: надання послуг харчування ПІБ

Після оплати надішліть, будь ласка, квитанцію❤️`;

async function updateIban() {
  console.log("Updating IBAN details in SystemSetting table...");
  const setting = await prisma.systemSetting.upsert({
    where: { key: "ibanDetails" },
    update: { value: IBAN_DETAILS },
    create: { key: "ibanDetails", value: IBAN_DETAILS },
  });
  console.log("✅ Successfully updated IBAN in DB:");
  console.log(setting.value);
}

updateIban()
  .catch((err) => {
    console.error("Failed to update IBAN:", err.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
