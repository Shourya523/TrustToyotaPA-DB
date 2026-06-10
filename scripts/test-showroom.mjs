import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config();

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const { start } = await sql`SELECT date_trunc('month', MAX(contract_date))::date AS month_start FROM contract`;
const monthStart = new Date(start.month_start);
const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

const branches = await sql`SELECT branch_id, street, city FROM branch ORDER BY branch_id`;
console.log("Report month:", monthStart.toISOString().slice(0, 7));

for (const b of branches) {
  const [stats] = await sql`
    SELECT COUNT(c.contract_id)::int AS cars, COALESCE(SUM(cph.price),0)::numeric AS revenue
    FROM contract c
    LEFT JOIN LATERAL (SELECT price FROM car_price_history WHERE car_id = c.car_id ORDER BY price_date DESC LIMIT 1) cph ON true
    WHERE c.branch_id = ${b.branch_id} AND c.contract_date >= ${monthStart} AND c.contract_date < ${monthEnd}
  `;
  console.log(`${b.city} (${b.street}): ${stats.cars} cars, EGP ${stats.revenue}`);
}

await sql.end();
