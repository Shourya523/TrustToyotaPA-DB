import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_FALLBACK_URI;
const sql = neon(uri);

async function check() {
  try {
    const reps = await sql`
      SELECT salesperson, COUNT(*), SUM(sale_price * quantity) as total_rev
      FROM sales 
      GROUP BY salesperson 
      ORDER BY total_rev DESC 
      LIMIT 40
    `;
    console.log("Reps:");
    console.log(reps.map(r => `${r.salesperson}: ${r.total_rev} (${r.count} sales)`).join("\n"));
  } catch (err) {
    console.error(err);
  }
}
check();
