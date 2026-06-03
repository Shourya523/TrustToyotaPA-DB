const getPostgres = async () => (await import("postgres")).default;
const getMySQL = async () => (await import("mysql2/promise")).default;

export interface ColumnInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable?: string;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
  foreign_table_name?: string;
  foreign_column_name?: string;
}

export interface SchemaResult {
  schema: ColumnInfo[];
  counts: { table_name: string; row_count: number }[];
}

export async function executeQuery(uri: string, sqlText: string): Promise<unknown[]> {
  if (uri.startsWith("postgres")) {
    const postgres = await getPostgres();
    const sqlConnection = postgres(uri, { max: 1 });
    try {
      return (await sqlConnection.unsafe(sqlText)) as unknown[];
    } finally {
      await sqlConnection.end();
    }
  }
  return [];
}

export async function testConnection(uri: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = uri?.trim();
  if (!trimmed) return { success: false, error: "Connection string is required." };

  const result = await getDatabaseMetadata(trimmed);
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

export async function getDatabaseMetadata(
  connectionString: string
): Promise<{ success: boolean; data?: SchemaResult; error?: string }> {
  const uri = connectionString?.trim();
  if (!uri) return { success: false, error: "Connection string is required." };

  if (uri.startsWith("postgres")) {
    const postgres = await getPostgres();
    const sqlConnection = postgres(uri, { max: 1, connect_timeout: 10 });
    try {
      const schemaInfo = await sqlConnection`
        SELECT 
            c.table_name, 
            c.column_name, 
            c.data_type,
            c.is_nullable,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key,
            CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END AS is_foreign_key,
            fk.foreign_table_name,
            fk.foreign_column_name
        FROM information_schema.columns c
        LEFT JOIN (
            SELECT kcu.table_name, kcu.column_name
            FROM information_schema.table_constraints tco
            JOIN information_schema.key_column_usage kcu 
              ON kcu.constraint_name = tco.constraint_name 
             AND kcu.constraint_schema = tco.constraint_schema
            WHERE tco.constraint_type = 'PRIMARY KEY' AND tco.table_schema = 'public'
        ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
        LEFT JOIN (
             SELECT
                tc.table_name, kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position;
      `;
      const counts = await sqlConnection`
        SELECT relname AS table_name, n_live_tup AS row_count 
        FROM pg_stat_user_tables;
      `;
      return {
        success: true,
        data: {
          schema: schemaInfo as unknown as ColumnInfo[],
          counts: counts as unknown as SchemaResult["counts"],
        },
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Postgres Error: ${msg}` };
    } finally {
      await sqlConnection.end();
    }
  }

  if (uri.startsWith("mysql")) {
    const mysql = await getMySQL();
    let connection;
    try {
      connection = await mysql.createConnection(uri);
      const [schemaInfo] = await connection.execute(`
        SELECT TABLE_NAME as table_name, COLUMN_NAME as column_name, DATA_TYPE as data_type
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        ORDER BY table_name, ordinal_position;
      `);
      const [counts] = await connection.execute(`
        SELECT TABLE_NAME as table_name, TABLE_ROWS as row_count
        FROM information_schema.tables
        WHERE table_schema = DATABASE();
      `);
      return {
        success: true,
        data: {
          schema: schemaInfo as ColumnInfo[],
          counts: counts as SchemaResult["counts"],
        },
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `MySQL Error: ${msg}` };
    } finally {
      if (connection) await connection.end();
    }
  }

  return { success: false, error: "Unsupported provider. Use postgres:// or mysql:// connection strings." };
}

export async function getDatabaseRelations(uri: string) {
  const metadata = await getDatabaseMetadata(uri);
  if (!metadata.success || !metadata.data) return metadata;

  const relQuery = `
    SELECT
        tc.table_name AS source_table, 
        kcu.column_name AS source_column, 
        ccu.table_name AS target_table,
        ccu.column_name AS target_column
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
  `;

  const relations = await executeQuery(uri, relQuery);
  return {
    success: true,
    data: { schema: metadata.data.schema, relations },
  };
}

export async function getSingleTableDetails(connectionString: string, tableName: string) {
  const postgres = await getPostgres();
  const sqlConnection = postgres(connectionString, { max: 1 });
  try {
    const columns = await sqlConnection`
      SELECT 
          c.table_name, 
          c.column_name, 
          c.data_type,
          c.is_nullable,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key,
          CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END AS is_foreign_key,
          fk.foreign_table_name,
          fk.foreign_column_name
      FROM information_schema.columns c
      LEFT JOIN (
          SELECT kcu.table_name, kcu.column_name
          FROM information_schema.table_constraints tco
          JOIN information_schema.key_column_usage kcu 
            ON kcu.constraint_name = tco.constraint_name 
           AND kcu.constraint_schema = tco.constraint_schema
          WHERE tco.constraint_type = 'PRIMARY KEY' AND tco.table_schema = 'public'
      ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
      LEFT JOIN (
           SELECT
              tc.table_name, kcu.column_name,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
      WHERE c.table_name = ${tableName} AND c.table_schema = 'public'
      ORDER BY c.ordinal_position;
    `;
    return { success: true, data: columns };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  } finally {
    await sqlConnection.end();
  }
}

export async function runCustomQuery(uri: string, sqlText: string) {
  if (!uri.startsWith("postgres")) {
    return { success: false, error: "Custom queries currently support PostgreSQL only." };
  }

  const postgres = await getPostgres();
  const sqlConnection = postgres(uri, { max: 1 });
  try {
    const result = await sqlConnection.unsafe(sqlText);
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  } finally {
    await sqlConnection.end();
  }
}

export async function getTableQuality(
  connectionString: string,
  tableName: string,
  columns: ColumnInfo[]
) {
  const postgres = await getPostgres();
  const sql = postgres(connectionString, { max: 1 });

  try {
    const projections = columns
      .map((col) => {
        const name = col.column_name;
        const type = col.data_type.toLowerCase();
        const isNumeric = ["integer", "numeric", "real", "double precision", "bigint", "decimal"].some(
          (t) => type.includes(t)
        );
        return `
        COUNT("${name}") as "${name}_count",
        COUNT(DISTINCT "${name}") as "${name}_unique"
        ${isNumeric ? `, AVG("${name}")::float as "${name}_avg"` : ""}
      `;
      })
      .join(", ");

    const [stats] = await sql.unsafe(
      `SELECT COUNT(*) as total_rows, ${projections} FROM "${tableName}"`
    );

    const metrics = columns.map((col) => {
      const name = col.column_name;
      const count = Number((stats as Record<string, unknown>)[`${name}_count`]);
      const total = Number((stats as Record<string, unknown>).total_rows);

      return {
        column: name,
        type: col.data_type,
        completeness: total > 0 ? (count / total) * 100 : 0,
        uniqueness: total > 0 ? (Number((stats as Record<string, unknown>)[`${name}_unique`]) / total) * 100 : 0,
        avg: (stats as Record<string, unknown>)[`${name}_avg`] ?? null,
      };
    });

    return { success: true, data: { totalRows: (stats as Record<string, unknown>).total_rows, metrics } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  } finally {
    await sql.end();
  }
}

export function groupSchemaByTable(schema: ColumnInfo[]): Map<string, ColumnInfo[]> {
  const tables = new Map<string, ColumnInfo[]>();
  for (const col of schema) {
    const existing = tables.get(col.table_name) ?? [];
    existing.push(col);
    tables.set(col.table_name, existing);
  }
  return tables;
}

export function getDashboardMetrics(schema: ColumnInfo[], relations: unknown[]) {
  const tables = new Set(schema.map((c) => c.table_name));
  const fkCount = schema.filter((c) => c.is_foreign_key).length;
  const pkCount = schema.filter((c) => c.is_primary_key).length;
  const indexEstimate = tables.size;

  return {
    totalTables: tables.size,
    totalColumns: schema.length,
    totalRelationships: Array.isArray(relations) ? relations.length : 0,
    foreignKeyCount: fkCount,
    primaryKeyCount: pkCount,
    schemaComplexity:
      tables.size > 0
        ? Math.round((schema.length / tables.size + fkCount / tables.size) * 10) / 10
        : 0,
    indexEstimate,
  };
}
