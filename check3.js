require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.RAILWAY_DATABASE_URL });
async function test() {
  await client.connect();
  const res = await client.query("SELECT id, \"createdAt\", \"packageId\" FROM \"SubscriptionPurchase\" WHERE status = 'CREDITED_PENDING_CONFIRMATION'");
  for (let r of res.rows) {
    console.log(r);
  }
  await client.end();
}
test().catch(console.error);
