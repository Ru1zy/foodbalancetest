require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const p = await prisma.subscriptionPurchase.findFirst({ where: { status: 'CREDITED_PENDING_CONFIRMATION' }, orderBy: { createdAt: 'desc' } });
  if (!p) { console.log('No pending'); return; }
  console.log('Found:', p.id, p.userId, p.packageId);
  try {
    await prisma.userBalance.update({
      where: { userId_packageId: { userId: p.userId, packageId: p.packageId } },
      data: { totalDays: { decrement: p.days } }
    });
    console.log('Update success');
  } catch(e) {
    console.error('Error updating:', e);
  }
}
test().catch(console.error).finally(()=>prisma.$disconnect());
