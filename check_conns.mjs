import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();
const sql = neon(process.env.DATABASE_URL);
sql`SELECT * FROM connections`.then(res => {
  console.log(res);
}).catch(console.error);
