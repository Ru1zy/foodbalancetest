import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prisma: PrismaClient | undefined;
}

// Инициализация адаптера для Neon/Postgres с контролем соединений
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const prisma =
  global.prisma ||
  new PrismaClient({
    adapter: adapter,
  });

global.prisma = prisma;

export default prisma;
