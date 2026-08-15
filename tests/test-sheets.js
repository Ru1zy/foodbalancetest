const { google } = require('googleapis');
require('dotenv').config();

async function testSheets() {
  console.log('🔄 Тестування підключення до Google Sheets API...');

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  // Fallback to checking if they exist
  if (!clientEmail || !privateKey) {
    console.error('❌ ПОМИЛКА: GOOGLE_CLIENT_EMAIL або GOOGLE_PRIVATE_KEY не знайдено у файлі .env');
    return;
  }

  try {
    console.log('1️⃣ Авторизація через Service Account...');
    
    // Format private key (replace \\n with actual newlines if needed)
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
    
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: formattedPrivateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Авторизація успішна!');

    // We can't read a specific sheet without its ID, but we can verify the token
    console.log('\n2️⃣ Перевірка доступу до токена...');
    const token = await auth.getAccessToken();
    
    if (token.token) {
      console.log('✅ Токен доступу успішно отримано! Сервісний акаунт налаштований правильно.');
      console.log('💡 Примітка: Щоб перевірити конкретну таблицю, переконайтеся, що ви надали доступ до неї для email:', clientEmail);
    } else {
      throw new Error("Не вдалося отримати токен доступу");
    }

  } catch (error) {
    console.error('\n❌ ЗБІЙ! Помилка підключення до Google Sheets API:');
    console.error(error.message);
  }
}

testSheets();
