import { google } from "googleapis";

export async function sendEmail(to: string, subject: string, html: string) {
  const user = process.env.SMTP_EMAIL;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!user || !clientId || !clientSecret || !refreshToken) {
    console.error(
      "Email environment variables (SMTP_EMAIL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN) are not fully configured."
    );
    return { ok: false };
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      "https://developers.google.com/oauthplayground" // redirect URL is typically this for playground-generated tokens
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Base64 encode the subject for UTF-8 support
    const subjectEncoded = Buffer.from(subject).toString("base64");
    
    // Construct the MIME message
    const messageParts = [
      `From: "FoodBalance" <${user}>`,
      `To: ${to}`,
      `Subject: =?utf-8?B?${subjectEncoded}?=`,
      "Content-Type: text/html; charset=utf-8",
      "MIME-Version: 1.0",
      "",
      html,
    ];
    const message = messageParts.join("\r\n");

    // The Gmail API requires base64url encoding
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log("Email sent via Gmail API: %s", res.data.id);
    return { ok: true, id: res.data.id };
  } catch (error) {
    console.error("Failed to send email via Gmail API:", error);
    return { ok: false, error };
  }
}
