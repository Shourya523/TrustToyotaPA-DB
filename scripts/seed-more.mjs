import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

const FIRST_NAMES = ["Ahmed", "Mohamed", "Omar", "Tariq", "Fatima", "Aisha", "Mariam", "Yousef", "Ali", "Hassan", "Sara", "Nour", "Mona", "Khaled", "Ziad", "Salma", "Heba"];
const LAST_NAMES = ["Hassan", "Ali", "Ibrahim", "Mostafa", "Adel", "Fathy", "Kamal", "Samir", "Gaber", "Farid", "Shawky", "Mahmoud", "Tawfik"];
const CITIES = ["Cairo", "Alexandria", "Giza", "Luxor", "Aswan", "Mansoura", "Tanta", "Ismailia", "Suez", "Port Said", "Fayoum", "Minya", "Asyut", "Sohag", "Qena"];
const STREETS = ["Talaat Harb", "Corniche", "Al Ahram", "Tahrir", "Abbas El Akkad", "Makram Ebeid", "Zamalek", "Dokki", "Maadi", "Heliopolis", "Nasr City"];

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomNumber(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomPhone() { return '01' + randomNumber(0, 2) + randomNumber(10000000, 99999999).toString(); }

async function seed() {
  try {
    console.log("Starting to seed more branches, employees, salaries, and sales...");

    // 1. Add 15 new branches (showrooms)
    const branchMaxRes = await sql`SELECT MAX(branch_id) as max FROM branch`;
    let branchId = (branchMaxRes[0].max || 0) + 1;
    let newBranches = [];
    
    for (let i = 0; i < 15; i++) {
       const bid = branchId++;
       await sql`
         INSERT INTO branch (branch_id, street, city, building_number, contact_number)
         VALUES (${bid}, ${randomChoice(STREETS)}, ${randomChoice(CITIES)}, ${randomNumber(1, 200)}, ${randomNumber(1000000, 9999999)})
       `;
       newBranches.push(bid);
    }
    console.log(`Added 15 new branches (showrooms).`);

    const allBranches = (await sql`SELECT branch_id FROM branch`).map(r => r.branch_id);

    // 2. Add 50 new employees
    const empMaxRes = await sql`SELECT MAX(ssn) as max FROM employee`;
    let empSsn = (empMaxRes[0].max || 0) + 1;
    const existingEmps = (await sql`SELECT ssn FROM employee`).map(r => r.ssn);
    let newEmployees = [];
    
    for (let i = 0; i < 50; i++) {
      const ssn = empSsn++;
      const fname = randomChoice(FIRST_NAMES);
      const lname = randomChoice(LAST_NAMES);
      const street = randomChoice(STREETS);
      const city = randomChoice(CITIES);
      const gender = Math.random() > 0.5 ? 'M' : 'F';
      const year = randomNumber(1970, 2000);
      const month = randomNumber(1, 12).toString().padStart(2, '0');
      const day = randomNumber(1, 28).toString().padStart(2, '0');
      const jobId = randomNumber(1, 10);
      const branch_id = randomChoice(allBranches);
      const supervisor = randomChoice(existingEmps);

      await sql`
        INSERT INTO employee (ssn, fname, lname, street, city, building_number, phone_1, phone_2, gender, birth_date, job_id, supervisor, branch_id)
        VALUES (${ssn}, ${fname}, ${lname}, ${street}, ${city}, ${randomNumber(1, 100)}, ${randomPhone()}, ${randomPhone()}, ${gender}, ${`${year}-${month}-${day}`}, ${jobId}, ${supervisor}, ${branch_id})
      `;
      newEmployees.push({ ssn, jobId });
    }
    console.log(`Added 50 new employees.`);

    // 3. Add salaries for new employees
    for (const emp of newEmployees) {
      await sql`
        INSERT INTO salary_of_jobs (job_id, emp_ssn, salary, comm_pct)
        VALUES (${emp.jobId}, ${emp.ssn}, ${randomNumber(10000, 30000)}, ${randomNumber(0, 20) / 100})
      `;
    }
    console.log(`Added salaries for 50 new employees.`);

    // 4. Add sales data (contracts) linked to new employees
    const cars = (await sql`SELECT car_id FROM car`).map(r => r.car_id);
    const customers = (await sql`SELECT ssn FROM customer`).map(r => r.ssn);
    const methods = (await sql`SELECT method_id FROM payment_method`).map(r => r.method_id);
    
    const contractMaxRes = await sql`SELECT MAX(contract_id) as max FROM contract`;
    let contractId = (contractMaxRes[0].max || 0) + 1;

    let addedContracts = 0;
    for (let i = 0; i < 300; i++) {
      const carId = randomChoice(cars);
      // Give preference to new employees to generate sales data for them
      const empSsn = randomChoice(newEmployees).ssn;
      // Get the branch of this employee
      const empRow = await sql`SELECT branch_id FROM employee WHERE ssn = ${empSsn}`;
      const branchId = empRow[0].branch_id;
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
      } catch (e) {}
    }
    console.log(`Added ${addedContracts} new sales (contracts) handled by the new employees.`);
    
    console.log("Done seeding more data!");
  } catch(e) {
    console.error("Seeding error:", e);
  } finally {
    await sql.end();
  }
}

seed();
