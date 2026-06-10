import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

const FIRST_NAMES = ["Ahmed", "Mohamed", "Omar", "Tariq", "Fatima", "Aisha", "Mariam", "Yousef", "Ali", "Hassan", "Sara", "Nour", "Mona", "Khaled", "Ziad", "Salma", "Heba"];
const LAST_NAMES = ["Hassan", "Ali", "Ibrahim", "Mostafa", "Adel", "Fathy", "Kamal", "Samir", "Gaber", "Farid", "Shawky", "Mahmoud", "Tawfik"];
const CITIES = ["Cairo", "Alexandria", "Giza", "Luxor", "Aswan", "Mansoura", "Tanta", "Ismailia", "Suez", "Port Said"];
const STREETS = ["Talaat Harb", "Corniche", "Al Ahram", "Tahrir", "Abbas El Akkad", "Makram Ebeid", "Zamalek", "Dokki"];

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomNumber(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomPhone() { return '01' + randomNumber(0, 2) + randomNumber(10000000, 99999999).toString(); }

async function seed() {
  try {
    console.log("Connected to Neon DB. Starting seeding...");

    // Get max IDs to avoid conflicts
    const custMaxRes = await sql`SELECT MAX(ssn) as max FROM customer`;
    let custSsn = (custMaxRes[0].max || 0) + 1;

    // Generate 50 new customers
    console.log("Seeding 50 customers...");
    for (let i = 0; i < 50; i++) {
      const fname = randomChoice(FIRST_NAMES);
      const lname = randomChoice(LAST_NAMES);
      const street = randomChoice(STREETS);
      const city = randomChoice(CITIES);
      const gender = Math.random() > 0.5 ? 'M' : 'F';
      const year = randomNumber(1960, 2000);
      const month = randomNumber(1, 12).toString().padStart(2, '0');
      const day = randomNumber(1, 28).toString().padStart(2, '0');
      
      await sql`
        INSERT INTO customer (ssn, fname, lname, street, city, building_number, phone_1, phone_2, gender, birthdate)
        VALUES (${custSsn++}, ${fname}, ${lname}, ${street}, ${city}, ${randomNumber(1, 100)}, ${randomPhone()}, ${randomPhone()}, ${gender}, ${`${year}-${month}-${day}`})
      `;
    }

    // Get existing branches, cars, employees, customers for contracts
    const branches = (await sql`SELECT branch_id FROM branch`).map(r => r.branch_id);
    const cars = (await sql`SELECT car_id FROM car`).map(r => r.car_id);
    const employees = (await sql`SELECT ssn FROM employee`).map(r => r.ssn);
    const customers = (await sql`SELECT ssn FROM customer`).map(r => r.ssn);
    const methods = (await sql`SELECT method_id FROM payment_method`).map(r => r.method_id);

    const contractMaxRes = await sql`SELECT MAX(contract_id) as max FROM contract`;
    let contractId = (contractMaxRes[0].max || 0) + 1;

    // Generate 200 new contracts
    console.log("Seeding 200 contracts...");
    let addedContracts = 0;
    for (let i = 0; i < 200; i++) {
      if (!cars.length || !branches.length || !employees.length || !customers.length || !methods.length) {
        console.log("Missing prerequisite data for contracts.");
        break;
      }
      
      const carId = randomChoice(cars);
      const branchId = randomChoice(branches);
      const empSsn = randomChoice(employees);
      const custSsn = randomChoice(customers);
      const methodId = randomChoice(methods);
      
      const year = randomNumber(2021, 2024);
      const month = randomNumber(1, 12).toString().padStart(2, '0');
      const day = randomNumber(1, 28).toString().padStart(2, '0');

      try {
        await sql`
          INSERT INTO contract (contract_id, car_id, branch_id, emp_ssn, cust_ssn, method_id, contract_date)
          VALUES (${contractId++}, ${carId}, ${branchId}, ${empSsn}, ${custSsn}, ${methodId}, ${`${year}-${month}-${day}`})
        `;
        addedContracts++;
      } catch (e) {
        // Might fail on unique constraints, ignore
      }
    }

    console.log(`Successfully added 50 customers and ${addedContracts} contracts!`);
    
    // Increment no_of_cars for random branches to reflect inventory
    console.log("Adding inventory to no_of_cars...");
    for (let i = 0; i < 50; i++) {
      const carId = randomChoice(cars);
      const branchId = randomChoice(branches);
      try {
         await sql`
            INSERT INTO no_of_cars (car_id, branch_id, no_of_cars)
            VALUES (${carId}, ${branchId}, ${randomNumber(1, 15)})
            ON CONFLICT (car_id, branch_id) DO UPDATE SET no_of_cars = no_of_cars.no_of_cars + ${randomNumber(1, 15)}
         `;
      } catch(e) {}
    }

    console.log("Done seeding!");
  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    await sql.end();
  }
}

seed();
