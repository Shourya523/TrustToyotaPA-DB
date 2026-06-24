import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_FALLBACK_URI;
const sql = neon(uri);

async function check() {
  try {
    const results = await sql`
      SELECT 
        cu.city,
        COUNT(s.sale_id) as sales_count,
        SUM(s.quantity) as total_cars,
        SUM(s.sale_price * s.quantity) as total_revenue
      FROM customers cu
      INNER JOIN sales s ON s.customer_id = cu.customer_id
      WHERE cu.city IS NOT NULL AND cu.city != ''
      GROUP BY cu.city
      ORDER BY total_revenue DESC
      LIMIT 10
    `;
    console.log("Top 10 cities by actual revenue:", results);
  } catch (err) {
    console.error(err);
  }
}
check();
