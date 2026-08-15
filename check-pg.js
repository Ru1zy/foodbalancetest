const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:APyNhHmcguNzqobeIMwLIPjnrnhnnSnc@sakura.proxy.rlwy.net:58221/railway' });
async function main() {
  await client.connect();
  const res = await client.query('SELECT "id", "sendEmailReceipt", "receiptEmail" FROM "Order" ORDER BY "createdAt" DESC LIMIT 1');
  console.log(res.rows[0]);
  await client.end();
}
main().catch(console.error);
