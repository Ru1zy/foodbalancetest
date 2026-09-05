const nodemailer = require('nodemailer');

async function test() {
  const user = process.env.SMTP_EMAIL || 'test@example.com';
  const pass = 'ENTER_YOUR_APP_PASSWORD';

  console.log('Testing SMTP connection for:', user);
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  try {
    await transporter.verify();
    console.log('SUCCESS! The App Password is correct and Google accepted the connection.');
  } catch (err) {
    console.error('FAILED! Google rejected it. Error:', err.message);
  }
}
test();
