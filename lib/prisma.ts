import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prisma: PrismaClient | undefined;
}

// Инициализация адаптера для Neon/Postgres
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma =
  global.prisma ||
  new PrismaClient({
    adapter: adapter,
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

export default prisma;
