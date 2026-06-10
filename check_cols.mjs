import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();
const sql = neon(process.env.DATABASE_URL);
sql.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY column_name", ['account'])
  .then((res) => console.log(res.rows || res))
  .catch(console.error);
