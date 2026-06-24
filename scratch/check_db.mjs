import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const url = process.env.DATABASE_URL;
  const sql = neon(url);
  try {
    const [{ count }] = await sql`SELECT COUNT(*)::text AS count FROM sales`;
    const [{ min, max }] = await sql`SELECT MIN(sale_date)::text AS min, MAX(sale_date)::text AS max FROM sales`;
    console.log(`Total Sales: ${count}`);
    console.log(`Date Range: ${min} to ${max}`);
  } catch (err) {
    console.error("Error querying:", err);
  }
}

main();
