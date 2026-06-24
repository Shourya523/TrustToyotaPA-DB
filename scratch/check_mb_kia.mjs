import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_FALLBACK_URI;
const sql = neon(uri);

async function check() {
  try {
    const results = await sql`
      SELECT 
        s.sale_id,
        s.salesperson,
        c.brand,
        c.model,
        cu.city,
        s.sale_price * s.quantity as rev
      FROM sales s
      JOIN cars c ON c.car_id = s.car_id
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE s.salesperson = 'Michael Brown'
    `;
    console.log("Michael Brown sales:", results);
  } catch (err) {
    console.error(err);
  }
}
check();
