import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const uri = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_FALLBACK_URI;
const sql = neon(uri);

async function check() {
  try {
    const uniqueCitiesRows = await sql`
      SELECT DISTINCT city FROM customers WHERE city IS NOT NULL AND city != '' ORDER BY city
    `;
    const cityList = uniqueCitiesRows.map((r) => r.city.trim());
    console.log("Total unique cities:", cityList.length);
    
    const idx = cityList.indexOf("Thomasmouth");
    console.log("Index of Thomasmouth:", idx);
    if (idx !== -1) {
      const branchId = 2001 + idx;
      console.log("Generated branchId:", branchId);
      
      // Let's simulate resolveCityFromBranchIdDb
      const idxResolved = branchId - 2001;
      const cityResolved = cityList[idxResolved];
      console.log("Resolved city:", cityResolved);
    } else {
      console.log("Thomasmouth not found in cityList!");
    }
  } catch (err) {
    console.error(err);
  }
}
check();
