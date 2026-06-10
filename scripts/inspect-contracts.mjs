import postgres from "postgres";

const uri =
  "postgresql://neondb_owner:npg_XAes98HyWjiu@ep-aged-night-aprryn3f-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(uri, { max: 1 });

try {
  const contracts = await sql`
    SELECT c.contract_id, c.branch_id, b.city, c.emp_ssn, e.fname, e.lname,
           c.method_id, pm.method, c.contract_date,
           cph.price
    FROM contract c
    JOIN branch b ON b.branch_id = c.branch_id
    JOIN employee e ON e.ssn = c.emp_ssn
    JOIN payment_method pm ON pm.method_id = c.method_id
    LEFT JOIN LATERAL (
      SELECT price FROM car_price_history
      WHERE car_id = c.car_id
      ORDER BY price_date DESC LIMIT 1
    ) cph ON true
    WHERE c.contract_date >= '2026-06-01' AND c.contract_date < '2026-07-01'
    LIMIT 5
  `;
  console.log("June 2026 contracts:", contracts.length, contracts);

  const monthly = await sql`
    SELECT b.branch_id, b.street, b.city,
           COUNT(c.contract_id) AS cars_sold,
           COALESCE(SUM(cph.price), 0) AS revenue
    FROM branch b
    LEFT JOIN contract c ON c.branch_id = b.branch_id
      AND c.contract_date >= '2026-06-01' AND c.contract_date < '2026-07-01'
    LEFT JOIN LATERAL (
      SELECT price FROM car_price_history
      WHERE car_id = c.car_id ORDER BY price_date DESC LIMIT 1
    ) cph ON true
    GROUP BY b.branch_id, b.street, b.city
    ORDER BY b.branch_id
  `;
  console.log("\nBranch stats June 2026:", monthly);

  const allTime = await sql`SELECT MIN(contract_date) as min_d, MAX(contract_date) as max_d, COUNT(*) as cnt FROM contract`;
  console.log("\nContract date range:", allTime);
} finally {
  await sql.end();
}
