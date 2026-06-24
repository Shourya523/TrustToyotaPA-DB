import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_FALLBACK_URI;
const sql = neon(uri);

async function check() {
  try {
    const rep = await sql`SELECT DISTINCT salesperson FROM sales WHERE salesperson = 'Michael Brown'`;
    console.log("Salesperson Michael Brown:", rep);

    const car = await sql`SELECT * FROM cars WHERE brand = 'Kia' OR model = 'Cerato'`;
    console.log("Car Kia Cerato:", car);

    const carList = await sql`SELECT DISTINCT brand, model FROM cars ORDER BY brand, model LIMIT 50`;
    console.log("Unique Cars (first 50):", carList);

    const city = await sql`SELECT DISTINCT city FROM customers WHERE city = 'Thomasmouth'`;
    console.log("City Thomasmouth:", city);
  } catch (err) {
    console.error("Error checking:", err);
  }
}

check();
