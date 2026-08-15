require('dotenv').config();

async function testTelegram() {
  console.log('🔄 Тестування підключення до Telegram API...');

  const token = process.env.TELEGRAM_BOT_TOKEN || 'ENTER_YOUR_BOT_TOKEN';
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || 'ENTER_YOUR_CHAT_ID';

  if (token === 'ENTER_YOUR_BOT_TOKEN' || chatId === 'ENTER_YOUR_CHAT_ID') {
    console.error('❌ ПОМИЛКА: Будь ласка, вкажіть TELEGRAM_BOT_TOKEN та TELEGRAM_ADMIN_CHAT_ID у файлі .env або безпосередньо у скрипті.');
    return;
  }

  try {
    // 1. Тест токена бота
    console.log('1️⃣ Перевірка токена бота (getMe)...');
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();
    
    if (!meData.ok) {
      throw new Error(`Бот недійсний. Відповідь Telegram: ${meData.description}`);
    }
    console.log(`✅ Бот працює: @${meData.result.username} (${meData.result.first_name})`);

    // 2. Тест відправки повідомлення
    console.log(`\n2️⃣ Спроба відправити тестове повідомлення в чат ${chatId}...`);
    const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.split(',')[0].trim(), // Беремо перший чат, якщо їх декілька
        text: '🤖 <b>Діагностичне повідомлення:</b>\nTelegram API працює ідеально!',
        parse_mode: 'HTML'
      })
    });
    
    const sendData = await sendRes.json();
    
    if (sendData.ok) {
      console.log('✅ Повідомлення успішно відправлено! Перевірте Telegram.');
    } else {
      throw new Error(`Не вдалося відправити повідомлення. Відповідь Telegram: ${sendData.description}`);
    }

  } catch (error) {
    console.error('\n❌ ЗБІЙ! Помилка підключення до Telegram:', error.message);
  }
}

testTelegram();
