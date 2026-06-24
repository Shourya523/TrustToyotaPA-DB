import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const uri1 = process.env.DATABASE_URL;
const uri2 = process.env.NEXT_PUBLIC_FALLBACK_URI;

async function checkDb(name, uri) {
  if (!uri) {
    console.log(name, "is not configured");
    return;
  }
  const sql = neon(uri);
  try {
    const cars = await sql`SELECT COUNT(*) FROM cars`;
    const sales = await sql`SELECT COUNT(*) FROM sales`;
    const tmStats = await sql`
      SELECT 
        COUNT(s.sale_id) as count,
        SUM(s.sale_price * s.quantity) as revenue
      FROM sales s
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE cu.city = 'Thomasmouth'
    `;
    console.log(`${name}: Cars: ${cars[0].count}, Sales: ${sales[0].count}, Thomasmouth Rev: ${tmStats[0]?.revenue}`);
  } catch (err) {
    console.log(`Error querying ${name}:`, err.message);
  }
}

async function run() {
  await checkDb("DATABASE_URL", uri1);
  await checkDb("NEXT_PUBLIC_FALLBACK_URI", uri2);
}

run();
