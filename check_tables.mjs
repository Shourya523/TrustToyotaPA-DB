import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();
const sql = neon(process.env.NEXT_PUBLIC_FALLBACK_URI);
sql`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`.then(res => {
  console.log(res);
}).catch(console.error);
