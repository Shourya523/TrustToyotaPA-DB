import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomNumber(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seed() {
  try {
    console.log("Seeding massive data for BLACK cars...");

    // 1. Ensure "Black" color exists
    let blackRows = await sql`SELECT color_id FROM color WHERE color_name ILIKE 'Black'`;
    let blackColorId;
    if (blackRows.length === 0) {
      const maxCol = await sql`SELECT MAX(color_id) as max FROM color`;
      blackColorId = (maxCol[0].max || 0) + 1;
      await sql`INSERT INTO color (color_id, color_name) VALUES (${blackColorId}, 'Black')`;
    } else {
      blackColorId = blackRows[0].color_id;
    }

    // 2. Find cars that are black
    let blackCars = (await sql`SELECT car_id FROM car_color WHERE color_id = ${blackColorId}`).map(r => r.car_id);
    
    // If no black cars, make 10 random cars black
    if (blackCars.length === 0) {
       const allCars = (await sql`SELECT car_id FROM car LIMIT 10`).map(r => r.car_id);
       for (const cid of allCars) {
         try {
           await sql`INSERT INTO car_color (car_id, color_id) VALUES (${cid}, ${blackColorId})`;
         } catch(e) {}
       }
       blackCars = allCars;
    }

    const branches = (await sql`SELECT branch_id FROM branch`).map(r => r.branch_id);
    const employees = (await sql`SELECT ssn FROM employee`).map(r => r.ssn);
    const customers = (await sql`SELECT ssn FROM customer`).map(r => r.ssn);
    const methods = (await sql`SELECT method_id FROM payment_method`).map(r => r.method_id);

    const contractMaxRes = await sql`SELECT MAX(contract_id) as max FROM contract`;
    let contractId = (contractMaxRes[0].max || 0) + 1;

    // Insert 600 contracts for Black Cars distributed across all showrooms
    let addedContracts = 0;
    for (let i = 0; i < 600; i++) {
      const carId = randomChoice(blackCars);
      const branchId = randomChoice(branches);
      
      // Get employees for this branch
      const branchEmps = (await sql`SELECT ssn FROM employee WHERE branch_id = ${branchId}`).map(r => r.ssn);
      const empSsn = branchEmps.length > 0 ? randomChoice(branchEmps) : randomChoice(employees);
      
      const custSsn = randomChoice(customers);
      const methodId = randomChoice(methods);
      
      // Distributed heavily in the last few months
      const year = 2026;
      const month = randomNumber(4, 6);
      const day = randomNumber(1, 28);

      try {
        await sql`
          INSERT INTO contract (contract_id, car_id, branch_id, emp_ssn, cust_ssn, method_id, contract_date)
          VALUES (${contractId++}, ${carId}, ${branchId}, ${empSsn}, ${custSsn}, ${methodId}, ${`${year}-0${month}-${day.toString().padStart(2, '0')}`})
        `;
        addedContracts++;
      } catch (e) {}
    }
    
    // Update inventory to reflect lots of black cars
    for (const carId of blackCars) {
       for (const branchId of branches) {
           try {
              await sql`
                 INSERT INTO no_of_cars (car_id, branch_id, no_of_cars)
                 VALUES (${carId}, ${branchId}, ${randomNumber(20, 50)})
                 ON CONFLICT (car_id, branch_id) DO UPDATE SET no_of_cars = no_of_cars.no_of_cars + ${randomNumber(10, 30)}
              `;
           } catch(e) {}
       }
    }

    console.log(`Successfully added ${addedContracts} new sales for BLACK cars across all showrooms!`);
  } catch(e) {
    console.error("Seeding error:", e);
  } finally {
    await sql.end();
  }
}

seed();
