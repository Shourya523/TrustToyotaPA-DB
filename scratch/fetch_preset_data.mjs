import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function main() {
  // Top employees by revenue
  const emps = await sql`
    SELECT s.salesperson, SUM(s.sale_price * s.quantity)::bigint as rev
    FROM sales s
    GROUP BY s.salesperson
    ORDER BY rev DESC
    LIMIT 10
  `;
  console.log('TOP EMPLOYEES:', emps.map(r => `${r.salesperson} ($${Number(r.rev).toLocaleString()})`).join('\n  '));

  // Top car models
  const cars = await sql`
    SELECT c.brand, c.model, SUM(s.quantity) as units
    FROM sales s JOIN cars c ON c.car_id = s.car_id
    GROUP BY c.brand, c.model
    ORDER BY units DESC
    LIMIT 10
  `;
  console.log('TOP CARS:', cars.map(r => `${r.brand} ${r.model} (${r.units} units)`).join('\n  '));

  // Top cities by revenue
  const cities = await sql`
    SELECT cu.city, SUM(s.sale_price * s.quantity)::bigint as rev
    FROM sales s JOIN customers cu ON cu.customer_id = s.customer_id
    GROUP BY cu.city
    ORDER BY rev DESC
    LIMIT 10
  `;
  console.log('TOP CITIES:', cities.map(r => `${r.city} ($${Number(r.rev).toLocaleString()})`).join('\n  '));

  // Available years
  const years = await sql`SELECT DISTINCT EXTRACT(YEAR FROM sale_date)::int as yr FROM sales ORDER BY yr`;
  console.log('YEARS:', years.map(r => r.yr).join(', '));

  // Available months with data
  const months = await sql`
    SELECT DISTINCT TO_CHAR(sale_date, 'Month') as name, EXTRACT(MONTH FROM sale_date)::int as num
    FROM sales ORDER BY num
  `;
  console.log('MONTHS:', months.map(r => r.name.trim()).join(', '));
}
main().catch(console.error);
