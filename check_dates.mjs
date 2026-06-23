import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();
const sql = postgres(process.env.DATABASE_URL);
async function run() {
  try {
    const res = await sql`SELECT ssn, fname, lname, birth_date FROM employee`;
    console.log("Employees count:", res.length);
    let invalidCount = 0;
    for (const r of res) {
      if (!r.birth_date) {
        console.log(`Employee ${r.fname} ${r.lname} has null/empty birth_date`);
        invalidCount++;
      } else {
        const d = new Date(r.birth_date);
        if (isNaN(d.getTime())) {
          console.log(`Employee ${r.fname} ${r.lname} has invalid birth_date:`, r.birth_date);
          invalidCount++;
        }
      }
    }
    console.log("Total invalid birth dates:", invalidCount);
  } catch(e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
