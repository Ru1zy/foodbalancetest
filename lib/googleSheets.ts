import { google } from "googleapis";

/**
 * Normalizes a phone number to the strict legacy format: 0XXXXXXXXX
 * - Strips non-digits
 * - Handles 9-digit (adds 0), 10-digit (keeps), and 12-digit (strips 38)
 */
export function normalizePhoneForLegacy(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 9) {
    return "0" + digits;
  }

  if (digits.length === 12 && digits.startsWith("380")) {
    return digits.slice(2);
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    return digits;
  }

  return digits;
}

export type ClientProfileSyncData = {
  name: string;
  phone: string;
  address: string;
  chatId?: string | null;
  packageType: string;
  cutlery: number;
  notes: string;
};

/**
 * Synchronizes client profile to the "Info" tab of the CRM Google Sheet.
 * Performs an upsert: updates row if phone exists, otherwise appends a new row.
 */
export async function syncClientToSheet(profileData: ClientProfileSyncData): Promise<void> {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    console.error("syncClientToSheet: Missing Google API environment variables.");
    return;
  }

  const normalizedPhone = normalizePhoneForLegacy(profileData.phone);

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // 1. Fetch current "Info" sheet data to find matching phone
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Info!A:H",
    });

    const rows = response.data.values || [];
    // Skip header row if it exists (usually row 1)
    let foundRowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      const rowPhone = normalizePhoneForLegacy(String(rows[i][2] || ""));
      if (rowPhone === normalizedPhone) {
        foundRowIndex = i + 1; // 1-based index for Sheets
        break;
      }
    }

    const rowData = [
      "", // A: Номер зам
      profileData.name, // B: ПІБ
      normalizedPhone, // C: Телефон
      profileData.address, // D: Адреса
      profileData.chatId || "", // E: Chat id
      profileData.packageType, // F: Пакет
      profileData.cutlery.toString(), // G: Прибори
      profileData.notes, // H: Особливості
    ];

    if (foundRowIndex !== -1) {
      // 2. Update existing row
      // We update columns B-H (index 1 to 7) but we can just update the whole range
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Info!A${foundRowIndex}:H${foundRowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowData],
        },
      });
      console.log(`syncClientToSheet: Updated user ${normalizedPhone} at row ${foundRowIndex}`);
    } else {
      // 3. Append new row
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Info!A:H",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowData],
        },
      });
      console.log(`syncClientToSheet: Appended new user ${normalizedPhone}`);
    }
  } catch (error) {
    console.error("syncClientToSheet failed:", error);
  }
}
