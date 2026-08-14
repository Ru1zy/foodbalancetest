import "server-only";

import { google, type sheets_v4 } from "googleapis";

const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/**
 * Build the only supported service-account client for Google Sheets.
 *
 * Railway stores multiline private keys as a literal `\\n` sequence, so they
 * are normalized here once instead of every export path interpreting secrets
 * differently. Customer Google sign-in and the administrator Drive OAuth use
 * different credentials and are intentionally not handled by this helper.
 */
export function createGoogleSheetsClient(): sheets_v4.Sheets | null {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    console.error("Google Sheets service-account credentials are not configured.");
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: [GOOGLE_SHEETS_SCOPE],
  });

  return google.sheets({ version: "v4", auth });
}
