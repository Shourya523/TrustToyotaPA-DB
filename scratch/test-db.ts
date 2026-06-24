import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function inspect() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.error("No DATABASE_URL found in .env");
        process.exit(1);
    }
    const sql = postgres(url);
    try {
        console.log("Checking __drizzle_migrations...");
        const migrations = await sql`
            SELECT id, hash, created_at
            FROM drizzle.__drizzle_migrations
        `;
        console.log("Migrations in DB:", migrations);
        process.exit(0);
    } catch (e) {
        console.error("Query failed:", e);
        process.exit(1);
    }
}

inspect();
