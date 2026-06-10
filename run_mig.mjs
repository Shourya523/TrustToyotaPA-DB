import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import * as dotenv from 'dotenv';
dotenv.config();
async function main() {
  const sql = neon(process.env.DATABASE_URL);
  
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  await sql`
  CREATE TABLE IF NOT EXISTS "schema_knowledge" (
    "id" text PRIMARY KEY NOT NULL,
    "connection_id" text NOT NULL,
    "entity_name" text NOT NULL,
    "markdown_content" text NOT NULL,
    "summary" text,
    "embedding_id" text,
    "embedding" vector(768),
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "unique_connection_entity" UNIQUE("connection_id","entity_name")
  );
  `;
  await sql`ALTER TABLE "schema_knowledge" DROP CONSTRAINT IF EXISTS "schema_knowledge_connection_id_connections_id_fk"`;
  await sql`ALTER TABLE "schema_knowledge" ADD CONSTRAINT "schema_knowledge_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action`;
  
  await sql`CREATE INDEX IF NOT EXISTS "idx_entity_name" ON "schema_knowledge" USING btree ("entity_name")`;

  await sql`
  CREATE TABLE IF NOT EXISTS "saved_queries" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "connection_id" text NOT NULL,
    "title" text NOT NULL,
    "natural_language" text,
    "sql" text NOT NULL,
    "tags" text,
    "is_favorite" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  );
  `;
  await sql`ALTER TABLE "saved_queries" DROP CONSTRAINT IF EXISTS "saved_queries_user_id_user_id_fk"`;
  await sql`ALTER TABLE "saved_queries" ADD CONSTRAINT "saved_queries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action`;
  
  await sql`CREATE INDEX IF NOT EXISTS "idx_saved_queries_user_conn" ON "saved_queries" USING btree ("user_id","connection_id")`;

  console.log('Done creating tables');
}
main().catch(console.error);
