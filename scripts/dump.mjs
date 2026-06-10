import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  console.log("job:");
  console.log(await sql`SELECT * FROM job`);
  console.log("salary_of_jobs:");
  try { console.log(await sql`SELECT * FROM salary_of_jobs`); } catch(e) { console.log("error", e.message) }
  console.log("branch count:");
  console.log(await sql`SELECT COUNT(*) FROM branch`);
  console.log("employee count:");
  console.log(await sql`SELECT COUNT(*) FROM employee`);
  
  await sql.end();
}

run();
