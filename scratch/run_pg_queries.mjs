import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.DATABASE_URL;
const sql = neon(uri);

async function run() {
  try {
    // Query for Michael Brown
    const empRows = await sql`
      SELECT
        s.salesperson,
        SUM(s.quantity)::text AS total_cars,
        SUM(s.sale_price * s.quantity)::text AS total_revenue,
        MODE() WITHIN GROUP (ORDER BY cu.city) AS city
      FROM sales s
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE s.salesperson = 'Michael Brown'
      GROUP BY s.salesperson
    `;
    console.log("Michael Brown row:", empRows);

    // Query for Thomasmouth
    const branchRows = await sql`
      WITH city_sales AS (
        SELECT
          cu.city,
          COALESCE(SUM(s.sale_price * s.quantity), 0) AS total_revenue,
          COALESCE(SUM(s.quantity), 0) AS total_cars
        FROM customers cu
        LEFT JOIN sales s ON s.customer_id = cu.customer_id
        WHERE cu.city = 'Thomasmouth'
        GROUP BY cu.city
      ),
      city_models AS (
        SELECT
          cu.city,
          c.brand || ' ' || c.model AS model_name,
          SUM(s.quantity) as model_sold,
          ROW_NUMBER() OVER (PARTITION BY cu.city ORDER BY SUM(s.quantity) DESC) as rnk
        FROM customers cu
        JOIN sales s ON s.customer_id = cu.customer_id
        JOIN cars c ON c.car_id = s.car_id
        WHERE cu.city = 'Thomasmouth'
        GROUP BY cu.city, c.brand, c.model
      )
      SELECT
        cs.city,
        cs.total_revenue::text,
        cs.total_cars::text,
        cm.model_name AS top_model
      FROM city_sales cs
      LEFT JOIN city_models cm ON cm.city = cs.city AND cm.rnk = 1
    `;
    console.log("Thomasmouth row:", branchRows);
  } catch (err) {
    console.error(err);
  }
}

run();
