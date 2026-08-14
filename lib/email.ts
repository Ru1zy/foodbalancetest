import nodemailer from "nodemailer";

export async function sendEmail(to: string, subject: string, html: string) {
  const user = process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass) {
    console.error("Email environment variables (SMTP_EMAIL, SMTP_PASSWORD) are not configured.");
    return { ok: false };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"FoodBalance" <${user}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent: %s", info.messageId);
    return { ok: true };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { ok: false, error };
  }
}
