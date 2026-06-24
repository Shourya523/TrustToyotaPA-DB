import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_FALLBACK_URI;
console.log("Using URI:", uri);
const sql = neon(uri);

async function inspect() {
  try {
    const tableCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log("Tables:", tableCheck);

    const carsCount = await sql`SELECT COUNT(*) FROM cars`;
    console.log("Cars count:", carsCount);

    const sampleCars = await sql`SELECT DISTINCT brand, model FROM cars LIMIT 10`;
    console.log("Sample Cars:", sampleCars);

    const salesCount = await sql`SELECT COUNT(*) FROM sales`;
    console.log("Sales count:", salesCount);

    const sampleSales = await sql`SELECT salesperson, sale_date, sale_price, quantity, car_id, customer_id FROM sales LIMIT 5`;
    console.log("Sample Sales:", sampleSales);

    const customersCount = await sql`SELECT COUNT(*) FROM customers`;
    console.log("Customers count:", customersCount);

    const sampleCustomers = await sql`SELECT DISTINCT city FROM customers LIMIT 10`;
    console.log("Sample Customer Cities:", sampleCustomers);

  } catch (err) {
    console.error("Error inspecting database:", err);
  }
}

inspect();
