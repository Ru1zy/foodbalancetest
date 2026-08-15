const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function testDatabase() {
  console.log('🔄 Тестування підключення до Бази Даних (Prisma)...');

  if (!process.env.DATABASE_URL) {
    console.error('❌ ПОМИЛКА: DATABASE_URL не знайдено у файлі .env');
    return;
  }

  const prisma = new PrismaClient();

  try {
    console.log('1️⃣ Спроба підключення...');
    await prisma.$connect();
    console.log('✅ Успішно підключено до бази даних!');

    console.log('\n2️⃣ Спроба виконати тестовий запит (читання користувачів)...');
    const userCount = await prisma.user.count();
    console.log(`✅ Запит успішний! Знайдено ${userCount} користувачів у базі.`);

  } catch (error) {
    console.error('\n❌ ЗБІЙ! Не вдалося підключитися або виконати запит до бази даних:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Підключення закрито.');
  }
}

testDatabase();
