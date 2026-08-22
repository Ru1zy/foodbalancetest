import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function dumpDatabase() {
  console.log('Dumping database...');
  const data = {
    users: await prisma.user.findMany(),
    userBalances: await prisma.userBalance.findMany(),
    subscriptionPurchases: await prisma.subscriptionPurchase.findMany(),
    menus: await prisma.menu.findMany(),
    tariffs: await prisma.tariff.findMany(),
    orders: await prisma.order.findMany(),
    orderDays: await prisma.orderDay.findMany(),
    checkoutIdempotency: await prisma.checkoutIdempotency.findMany(),
    sheetConfigs: await prisma.sheetConfig.findMany(),
    googleDriveConnections: await prisma.googleDriveConnection.findMany(),
    authTokens: await prisma.authToken.findMany(),
    mergeTokens: await prisma.mergeToken.findMany(),
    outboxJobs: await prisma.outboxJob.findMany(),
  };

  fs.writeFileSync('database_dump.json', JSON.stringify(data, null, 2));
  console.log('Database dumped to database_dump.json');
}

dumpDatabase()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
