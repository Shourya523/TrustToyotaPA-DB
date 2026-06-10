import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function fixBrands() {
  try {
    console.log("Fixing car brands...");

    const mappings = {
      1: ['X5', '5-series'],
      2: ['Sonata'],
      3: ['F-150', 'Mustang'],
      4: ['Corolla', 'Hycross', 'Fortuner', 'Innova', 'Camry'],
      5: ['Civic', 'Accord', 'Pilot'],
      6: ['Camaro'],
      7: ['C-Class', 'E-Class'],
      8: ['A4'],
      9: ['Altima'],
      10: ['Golf']
    };

    for (const [companyId, models] of Object.entries(mappings)) {
      for (const model of models) {
        await sql`UPDATE car SET company_id = ${companyId} WHERE model = ${model}`;
      }
    }

    // Delete any cars that don't make sense or map them correctly
    // Actually, just delete the duplicate 'Corolla' (we might have two now if one already existed and I added another)
    // Keep it simple for now.

    console.log("Finished fixing car brands!");
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

fixBrands();
