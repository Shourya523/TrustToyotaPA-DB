import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomNumber(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seed() {
  try {
    console.log("Seeding massive data for the current month (June 2026)...");

    const branches = (await sql`SELECT branch_id FROM branch`).map(r => r.branch_id);
    const cars = (await sql`SELECT car_id FROM car`).map(r => r.car_id);
    const employees = (await sql`SELECT ssn FROM employee`).map(r => r.ssn);
    const customers = (await sql`SELECT ssn FROM customer`).map(r => r.ssn);
    const methods = (await sql`SELECT method_id FROM payment_method`).map(r => r.method_id);

    const contractMaxRes = await sql`SELECT MAX(contract_id) as max FROM contract`;
    let contractId = (contractMaxRes[0].max || 0) + 1;

    let addedContracts = 0;
    for (let i = 0; i < 500; i++) {
      const carId = randomChoice(cars);
      const empSsn = randomChoice(employees);
      // Ensure branch matches employee branch for consistency
      const empRow = await sql`SELECT branch_id FROM employee WHERE ssn = ${empSsn}`;
      const branchId = empRow[0].branch_id;
      const custSsn = randomChoice(customers);
      const methodId = randomChoice(methods);
      
      // Current month dates (June 2026)
      const year = 2026;
      const month = 6;
      const day = randomNumber(1, 10); // Since today is June 11, random from 1 to 10

      try {
        await sql`
          INSERT INTO contract (contract_id, car_id, branch_id, emp_ssn, cust_ssn, method_id, contract_date)
          VALUES (${contractId++}, ${carId}, ${branchId}, ${empSsn}, ${custSsn}, ${methodId}, ${`${year}-0${month}-${day.toString().padStart(2, '0')}`})
        `;
        addedContracts++;
      } catch (e) {}
    }
    
    console.log(`Successfully added ${addedContracts} new sales (contracts) for June 2026!`);
  } catch(e) {
    console.error("Seeding error:", e);
  } finally {
    await sql.end();
  }
}

seed();
