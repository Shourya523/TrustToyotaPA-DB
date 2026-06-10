import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  console.log("Companies:");
  console.log(await sql`SELECT * FROM company`);
  console.log("Cars for Toyota:");
  console.log(await sql`
    SELECT car.car_id, car.model, company.name as company_name 
    FROM car 
    JOIN company ON car.company_id = company.company_id 
    WHERE company.name ILIKE '%Toyota%'
  `);
  console.log("Other cars:");
  console.log(await sql`
    SELECT car.car_id, car.model, company.name as company_name 
    FROM car 
    JOIN company ON car.company_id = company.company_id 
    LIMIT 10
  `);
  await sql.end();
}

run();
