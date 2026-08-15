const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const order = await prisma.order.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log(order);
}
main().catch(console.error).finally(() => prisma.$disconnect());
