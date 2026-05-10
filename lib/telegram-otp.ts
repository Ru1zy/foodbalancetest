export async function sendTelegramOTP(chatId: string, code: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not configured");
    return false;
  }

  const message = `🔐 <b>Підтвердження прив'язки аккаунта</b>\n\nХтось намагається прив'язати ваш номер телефону до аккаунта Google.\n\n<b>Ваш код підтвердження:</b> <code>${code}</code>\n\nЯкщо це не ви, проігноруйте це повідомлення.\n\n⏱ Код дійсний 5 хвилин.`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      console.error(`Failed to send OTP to ${chatId}: ${await response.text()}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending Telegram OTP:", error);
    return false;
  }
}

export function generateOTPCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
