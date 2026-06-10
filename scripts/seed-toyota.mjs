import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomNumber(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seed() {
  try {
    console.log("Seeding Toyota brand and models...");

    // 1. Ensure "Toyota" company exists
    let toyotaRows = await sql`SELECT company_id FROM company WHERE name ILIKE 'Toyota'`;
    let toyotaId;
    if (toyotaRows.length === 0) {
      const maxCol = await sql`SELECT MAX(company_id) as max FROM company`;
      toyotaId = (maxCol[0].max || 0) + 1;
      await sql`INSERT INTO company (company_id, name) VALUES (${toyotaId}, 'Toyota')`;
    } else {
      toyotaId = toyotaRows[0].company_id;
    }

    // 2. Add Toyota Models (Hycross, Fortuner, Innova, Camry, Corolla)
    const models = ["Hycross", "Fortuner", "Innova", "Camry", "Corolla"];
    const toyotaCarIds = [];
    
    const carMaxRes = await sql`SELECT MAX(car_id) as max FROM car`;
    let carId = (carMaxRes[0].max || 0) + 1;
    
    const priceMaxRes = await sql`SELECT MAX(car_price_id) as max FROM car_price_history`;
    let priceId = (priceMaxRes[0].max || 0) + 1;

    // Get color IDs to assign
    const colors = (await sql`SELECT color_id FROM color`).map(r => r.color_id);

    for (const model of models) {
        const cid = carId++;
        const year = randomNumber(2023, 2024);
        await sql`INSERT INTO car (car_id, company_id, model, year) VALUES (${cid}, ${toyotaId}, ${model}, ${`${year}-01-01`})`;
        
        // Add Price
        const price = randomNumber(30000, 80000);
        await sql`INSERT INTO car_price_history (car_price_id, car_id, price, price_date) VALUES (${priceId++}, ${cid}, ${price}, '2023-01-01')`;
        await sql`INSERT INTO car_price_history (car_price_id, car_id, price, price_date) VALUES (${priceId++}, ${cid}, ${price * 1.1}, '2026-01-01')`; // 10% markup in 2026

        // Add Colors (3 random colors per model)
        const selectedColors = new Set();
        while(selectedColors.size < 3 && selectedColors.size < colors.length) {
            selectedColors.add(randomChoice(colors));
        }
        for (const colorId of selectedColors) {
            await sql`INSERT INTO car_color (car_id, color_id) VALUES (${cid}, ${colorId})`;
        }
        
        toyotaCarIds.push(cid);
    }
    console.log(`Added Toyota Models: ${models.join(', ')}`);

    const branches = (await sql`SELECT branch_id FROM branch`).map(r => r.branch_id);
    const employees = (await sql`SELECT ssn FROM employee`).map(r => r.ssn);
    const customers = (await sql`SELECT ssn FROM customer`).map(r => r.ssn);
    const methods = (await sql`SELECT method_id FROM payment_method`).map(r => r.method_id);

    const contractMaxRes = await sql`SELECT MAX(contract_id) as max FROM contract`;
    let contractId = (contractMaxRes[0].max || 0) + 1;

    // Insert 400 contracts for Toyota Cars distributed across all showrooms
    let addedContracts = 0;
    for (let i = 0; i < 400; i++) {
      const carId = randomChoice(toyotaCarIds);
      const branchId = randomChoice(branches);
      
      const branchEmps = (await sql`SELECT ssn FROM employee WHERE branch_id = ${branchId}`).map(r => r.ssn);
      const empSsn = branchEmps.length > 0 ? randomChoice(branchEmps) : randomChoice(employees);
      const custSsn = randomChoice(customers);
      const methodId = randomChoice(methods);
      
      const year = 2026;
      const month = randomNumber(1, 6);
      const day = randomNumber(1, 28);

      try {
        await sql`
          INSERT INTO contract (contract_id, car_id, branch_id, emp_ssn, cust_ssn, method_id, contract_date)
          VALUES (${contractId++}, ${carId}, ${branchId}, ${empSsn}, ${custSsn}, ${methodId}, ${`${year}-0${month}-${day.toString().padStart(2, '0')}`})
        `;
        addedContracts++;
      } catch (e) {}
    }
    
    // Update inventory to reflect lots of Toyota cars
    for (const carId of toyotaCarIds) {
       for (const branchId of branches) {
           try {
              await sql`
                 INSERT INTO no_of_cars (car_id, branch_id, no_of_cars)
                 VALUES (${carId}, ${branchId}, ${randomNumber(10, 40)})
                 ON CONFLICT (car_id, branch_id) DO UPDATE SET no_of_cars = no_of_cars.no_of_cars + ${randomNumber(10, 20)}
              `;
           } catch(e) {}
       }
    }

    console.log(`Successfully added ${addedContracts} new sales for TOYOTA cars!`);
  } catch(e) {
    console.error("Seeding error:", e);
  } finally {
    await sql.end();
  }
}

seed();
