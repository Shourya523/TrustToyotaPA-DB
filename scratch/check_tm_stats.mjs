import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_FALLBACK_URI;
const sql = neon(uri);

async function check() {
  try {
    const stats = await sql`
      SELECT 
        COUNT(s.sale_id) as count,
        SUM(s.sale_price * s.quantity) as revenue
      FROM sales s
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE cu.city = 'Thomasmouth'
    `;
    console.log("Thomasmouth stats:", stats);

    const topModel = await sql`
      SELECT 
        c.brand || ' ' || c.model as model_name,
        SUM(s.quantity) as sold
      FROM sales s
      JOIN cars c ON c.car_id = s.car_id
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE cu.city = 'Thomasmouth'
      GROUP BY c.brand, c.model
      ORDER BY sold DESC
      LIMIT 1
    `;
    console.log("Thomasmouth top model:", topModel);
  } catch (err) {
    console.error(err);
  }
}
check();
