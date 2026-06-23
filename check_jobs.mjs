import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();
const sql = postgres(process.env.DATABASE_URL);
async function run() {
  try {
    const res = await sql`SELECT e.ssn, e.fname, e.lname, e.job_id, j.title FROM employee e LEFT JOIN job j ON j.job_id = e.job_id`;
    console.log("Total employees:", res.length);
    console.log("Employees with null/missing jobs:", res.filter(r => !r.title));
  } catch(e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
