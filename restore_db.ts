import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function restoreDatabase() {
  console.log('Restoring database...');
  const data = JSON.parse(fs.readFileSync('database_dump.json', 'utf-8'));

  // Define the order to avoid foreign key constraints
  console.log('Restoring Users...');
  await prisma.user.createMany({ data: data.users || [] });

  console.log('Restoring Menus...');
  await prisma.menu.createMany({ data: data.menus || [] });

  console.log('Restoring Tariffs...');
  await prisma.tariff.createMany({ data: data.tariffs || [] });

  console.log('Restoring SheetConfigs...');
  await prisma.sheetConfig.createMany({ data: data.sheetConfigs || [] });

  console.log('Restoring GoogleDriveConnections...');
  await prisma.googleDriveConnection.createMany({ data: data.googleDriveConnections || [] });

  console.log('Restoring Orders...');
  await prisma.order.createMany({ data: data.orders || [] });

  console.log('Restoring OrderDays...');
  await prisma.orderDay.createMany({ data: data.orderDays || [] });

  console.log('Restoring UserBalances...');
  await prisma.userBalance.createMany({ data: data.userBalances || [] });

  console.log('Restoring SubscriptionPurchases...');
  await prisma.subscriptionPurchase.createMany({ data: data.subscriptionPurchases || [] });

  console.log('Restoring CheckoutIdempotency...');
  await prisma.checkoutIdempotency.createMany({ data: data.checkoutIdempotency || [] });

  console.log('Restoring AuthTokens...');
  await prisma.authToken.createMany({ data: data.authTokens || [] });

  console.log('Restoring MergeTokens...');
  await prisma.mergeToken.createMany({ data: data.mergeTokens || [] });

  console.log('Restoring OutboxJobs...');
  await prisma.outboxJob.createMany({ data: data.outboxJobs || [] });

  console.log('Database restored successfully!');
}

restoreDatabase()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
