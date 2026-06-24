import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.DATABASE_URL;
const sql = neon(uri);

async function run() {
  try {
    const maxDateRes = await sql`SELECT MAX(sale_date) as max_date, MIN(sale_date) as min_date FROM sales`;
    console.log("Date range:", maxDateRes[0]);

    const maxMonthStart = new Date(maxDateRes[0].max_date);
    maxMonthStart.setDate(1);
    console.log("Max Month Start:", maxMonthStart);

    const maxMonthEnd = new Date(maxMonthStart);
    maxMonthEnd.setMonth(maxMonthEnd.getMonth() + 1);

    const salesInMaxMonth = await sql`
      SELECT COUNT(*) as cnt, SUM(sale_price * quantity) as revenue 
      FROM sales 
      WHERE sale_date >= ${maxMonthStart} AND sale_date < ${maxMonthEnd}
    `;
    console.log("Sales in Max Month (October 2025):", salesInMaxMonth[0]);

    const salesByCityInMaxMonth = await sql`
      SELECT cu.city, COUNT(s.sale_id) as cnt
      FROM sales s
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE s.sale_date >= ${maxMonthStart} AND s.sale_date < ${maxMonthEnd}
      GROUP BY cu.city
      ORDER BY cnt DESC
      LIMIT 10
    `;
    console.log("Sales by city in Max Month:", salesByCityInMaxMonth);

    // Let's count total sales by month to see the distribution
    const salesByMonth = await sql`
      SELECT date_trunc('month', sale_date)::date as m, COUNT(*) as cnt
      FROM sales
      GROUP BY m
      ORDER BY m DESC
      LIMIT 12
    `;
    console.log("Sales by month (last 12 months with records):", salesByMonth);

  } catch (err) {
    console.error(err);
  }
}

run();
