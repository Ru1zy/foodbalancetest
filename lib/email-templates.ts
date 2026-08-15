export function BaseEmailLayout({
  subject,
  title,
  subtitle = 'Дякуємо, що обрали Food Balance 🥑',
  headerColor = '#047857',
  subtitleColor = '#d1fae5',
  content,
}: {
  subject: string;
  title: string;
  subtitle?: string;
  headerColor?: string;
  subtitleColor?: string;
  content: string;
}) {
  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); margin: 0 auto; max-width: 600px;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color: ${headerColor}; padding: 30px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">${title}</h1>
              <p style="color: ${subtitleColor}; margin: 10px 0 0 0; font-size: 16px;">${subtitle}</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 30px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #f9fafb; padding: 25px 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Виникли питання? Напишіть нам у Telegram!</p>
              <p style="margin: 10px 0 0 0; font-size: 14px;">
                <a href="https://t.me/foodbalancezp" style="color: #047857; text-decoration: none; font-weight: 600;">@foodbalancezp</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateOrderReceiptHtml({
  orderId,
  name,
  phone,
  packageType,
  price,
  daysText,
  address,
  cutlery,
  notes,
}: {
  orderId?: string;
  name: string;
  phone: string;
  packageType: string;
  price?: number | null;
  daysText: string;
  address?: string | null;
  cutlery?: number;
  notes?: string | null;
}) {
  let inDayBlock = false;
  const formattedDaysHtml = daysText
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";

      // Day Title Header
      if (trimmed.startsWith("<b>") && trimmed.includes("-")) {
        const prefix = inDayBlock ? "</div>" : "";
        inDayBlock = true;
        return `${prefix}<div style="margin-bottom: 20px;"><div style="background-color: #047857; color: white; padding: 8px 12px; border-radius: 6px; font-weight: 600; margin-bottom: 10px; display: inline-block;">📅 ${trimmed.replace(/<b>|<\/b>/g, "")}</div>`;
      }
      
      // Box header (if any)
      if (trimmed.startsWith("📦")) {
        return `<h4 style="margin: 15px 0 5px 0; color: #047857; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">${trimmed.replace(/&nbsp;/g, ' ')}</h4>`;
      }

      // Dish item
      if (trimmed.includes("<b>") && trimmed.includes(":")) {
        const parts = trimmed.split(":");
        const title = parts[0].replace(/<b>|<\/b>|&nbsp;/g, "").trim();
        const value = parts.slice(1).join(":").trim();
        return `<div style="margin-bottom: 6px; color: #374151; padding-left: 10px; border-left: 2px solid #d1fae5;"><strong style="color: #111827;">${title}:</strong> ${value}</div>`;
      }

      return `<p style="margin: 4px 0; color: #374151;">${trimmed.replace(/&nbsp;/g, ' ')}</p>`;
    })
    .join("");

  const finalDaysHtml = inDayBlock ? formattedDaysHtml + "</div>" : formattedDaysHtml;

  const content = `
    <!-- Order Info -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
      <tr>
        <td style="padding-bottom: 15px;">
          <p style="margin: 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Деталі клієнта</p>
          <p style="margin: 5px 0 0 0; color: #111827; font-size: 16px; font-weight: 500;">${name} (${phone})</p>
          ${address ? `<p style="margin: 5px 0 0 0; color: #374151; font-size: 15px;">📍 ${address}</p>` : ''}
        </td>
        <td align="right" style="padding-bottom: 15px;">
          ${orderId ? `<p style="margin: 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Замовлення #</p><p style="margin: 5px 0 0 0; color: #111827; font-size: 16px; font-weight: 500;">${orderId.slice(0, 8)}</p>` : ''}
        </td>
      </tr>
    </table>
    <div style="height: 1px; background-color: #e5e7eb; margin: 20px 0;"></div>
    
    <!-- Package & Price -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 25px; background-color: #f9fafb; border-radius: 8px; padding: 20px;">
      <tr>
        <td>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">Раціон</p>
          <p style="margin: 5px 0 0 0; color: #111827; font-size: 18px; font-weight: 600;">${packageType}</p>
        </td>
        <td align="right">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">Сума до сплати</p>
          <p style="margin: 5px 0 0 0; color: #047857; font-size: 22px; font-weight: 700;">${price !== undefined && price !== null ? `${price} ₴` : 'За балансом'}</p>
        </td>
      </tr>
    </table>
    
    <!-- Cart Details -->
    <div style="margin-bottom: 30px;">
      <p style="margin: 0 0 15px 0; color: #111827; font-size: 16px; font-weight: 600;">Ваше меню:</p>
      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px 20px;">
        ${finalDaysHtml || "<i>Меню відсутнє</i>"}
      </div>
    </div>
    
    <!-- Extra Info -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 20px;">
      <tr>
        <td>
          <p style="margin: 0 0 5px 0; color: #374151; font-size: 15px;">🍴 <strong>Прибори:</strong> ${cutlery || 0} шт.</p>
          ${notes ? `<p style="margin: 5px 0 0 0; color: #374151; font-size: 15px;">📝 <strong>Коментар:</strong> ${notes}</p>` : ''}
        </td>
      </tr>
    </table>
  `;

  return BaseEmailLayout({
    subject: 'Квитанція замовлення Food Balance',
    title: 'Ваше замовлення прийнято!',
    content
  });
}

export function generateSubscriptionReceiptHtml({
  purchaseId,
  name,
  phone,
  packageId,
  days,
  finalPrice,
  method,
  status,
}: {
  purchaseId?: string;
  name: string;
  phone: string;
  packageId: string;
  days: number;
  finalPrice: number;
  method: string;
  status: string;
}) {
  const isPaid = status === 'PAID';
  const title = isPaid ? 'Абонемент активовано!' : 'Заявка на абонемент!';
  const message = isPaid 
    ? "Дні успішно зараховані на ваш баланс. Якщо ви обрали оплату готівкою, просто передайте суму кур'єру при доставці."
    : "Ми отримали вашу заявку. Після успішного підтвердження платежу дні будуть автоматично зараховані на ваш баланс.";

  const content = `
    <!-- Order Info -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
      <tr>
        <td style="padding-bottom: 15px;">
          <p style="margin: 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Деталі клієнта</p>
          <p style="margin: 5px 0 0 0; color: #111827; font-size: 16px; font-weight: 500;">${name} (${phone})</p>
        </td>
        <td align="right" style="padding-bottom: 15px;">
          ${purchaseId ? `<p style="margin: 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Оплата #</p><p style="margin: 5px 0 0 0; color: #111827; font-size: 16px; font-weight: 500;">${purchaseId.slice(0, 8)}</p>` : ''}
        </td>
      </tr>
    </table>
    <div style="height: 1px; background-color: #e5e7eb; margin: 20px 0;"></div>
    
    <!-- Package & Price -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 25px; background-color: #f9fafb; border-radius: 8px; padding: 20px;">
      <tr>
        <td>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">Тариф</p>
          <p style="margin: 5px 0 0 0; color: #111827; font-size: 18px; font-weight: 600;">${packageId} (${days} днів)</p>
        </td>
        <td align="right">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">Сума до сплати</p>
          <p style="margin: 5px 0 0 0; color: #047857; font-size: 22px; font-weight: 700;">${finalPrice} ₴</p>
        </td>
      </tr>
    </table>
    
    <!-- Extra Info -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 20px;">
      <tr>
        <td>
          <p style="margin: 0 0 5px 0; color: #374151; font-size: 15px;">💳 <strong>Спосіб оплати:</strong> ${method}</p>
          <p style="margin: 15px 0 0 0; color: #4b5563; font-size: 14px; line-height: 1.5;">${message}</p>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailLayout({
    subject: 'Оплата абонемента Food Balance',
    title,
    content
  });
}

export function generateSubscriptionApprovedHtml({
  packageId,
  days,
}: {
  packageId: string;
  days: number;
}) {
  const content = `
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="background-color: #d1fae5; color: #047857; display: inline-block; padding: 15px; border-radius: 50%; margin-bottom: 15px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      </div>
      <h2 style="margin: 0 0 10px 0; color: #111827; font-size: 20px;">Дні зараховано!</h2>
      <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.5;">Вашу оплату успішно підтверджено. Тепер ви можете використовувати зараховані дні для замовлення їжі через нашого Telegram-бота.</p>
    </div>
    
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px;">
      <tr>
        <td align="center">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">Поповнений тариф</p>
          <p style="margin: 5px 0 0 0; color: #111827; font-size: 18px; font-weight: 600;">${packageId} (${days} днів)</p>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailLayout({
    subject: 'Оплату абонемента підтверджено | Food Balance',
    title: 'Оплату підтверджено!',
    content
  });
}

export function generateSubscriptionRejectedHtml({
  packageId,
  days,
}: {
  packageId: string;
  days: number;
}) {
  const content = `
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="background-color: #fee2e2; color: #b91c1c; display: inline-block; padding: 15px; border-radius: 50%; margin-bottom: 15px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
      </div>
      <h2 style="margin: 0 0 10px 0; color: #111827; font-size: 20px;">Оплату скасовано</h2>
      <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.5;">На жаль, адміністратор відхилив вашу оплату. Якщо ви вважаєте, що це помилка, будь ласка, зверніться до нашої служби підтримки.</p>
    </div>
    
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px;">
      <tr>
        <td align="center">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">Тариф</p>
          <p style="margin: 5px 0 0 0; color: #111827; font-size: 18px; font-weight: 600;">${packageId} (${days} днів)</p>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailLayout({
    subject: 'Оплату абонемента скасовано | Food Balance',
    title: 'Оплату скасовано',
    subtitle: 'Упс! Виникла проблема 😔',
    headerColor: '#dc2626',
    subtitleColor: '#fecaca',
    content
  });
}
