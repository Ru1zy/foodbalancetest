const { google } = require('googleapis');
require('dotenv').config();

async function testGmailAPI() {
  // Read from .env
  const user = process.env.SMTP_EMAIL || 'foodbalancezp@gmail.com';
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // The user should paste their refresh token here for testing if they didn't add it to .env yet
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN || 'ENTER_YOUR_REFRESH_TOKEN_HERE';

  if (!clientId || !clientSecret) {
    console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
    return;
  }

  // Check removed

  console.log('Testing Gmail API for:', user);

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://developers.google.com/oauthplayground"
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  try {
    const subjectEncoded = Buffer.from("Test Email via Gmail API").toString("base64");
    const messageParts = [
      `From: "FoodBalance Test" <${user}>`,
      `To: ${user}`,
      `Subject: =?utf-8?B?${subjectEncoded}?=`,
      "Content-Type: text/html; charset=utf-8",
      "MIME-Version: 1.0",
      "",
      "<h1>SUCCESS!</h1><p>Your Gmail API is working perfectly!</p>",
    ];
    const message = messageParts.join("\r\n");
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });
    console.log('SUCCESS! Email sent successfully. Message ID:', res.data.id);
  } catch (error) {
    console.error('FAILED! Error sending email:', error.message);
  }
}

testGmailAPI();
