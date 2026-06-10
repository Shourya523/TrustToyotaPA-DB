import postgres from "postgres";

const uri =
  "postgresql://neondb_owner:npg_XAes98HyWjiu@ep-aged-night-aprryn3f-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(uri, { max: 1 });

try {
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `;
  console.log("TABLES:", tables.map((t) => t.table_name).join(", "));

  for (const { table_name } of tables.slice(0, 15)) {
    const cols = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table_name}
      ORDER BY ordinal_position
    `;
    console.log(`\n${table_name}:`, cols.map((c) => c.column_name).join(", "));
    const sample = await sql.unsafe(`SELECT * FROM "${table_name}" LIMIT 2`);
    console.log("sample:", JSON.stringify(sample).slice(0, 200));
  }
} finally {
  await sql.end();
}
