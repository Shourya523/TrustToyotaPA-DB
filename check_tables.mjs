import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();
const sql = neon(process.env.DATABASE_URL);
sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`.then(res => {
  console.log(res.map(r => r.table_name));
}).catch(console.error);
