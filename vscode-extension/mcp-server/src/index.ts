#!/usr/bin/env node
import { config } from "dotenv";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
for (const envPath of [
  resolve(__dirname, "../../../.env"),
  resolve(__dirname, "../../.env"),
  resolve(process.cwd(), ".env"),
]) {
  if (existsSync(envPath)) {
    config({ path: envPath });
    break;
  }
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getActiveConnection,
  getConnectionById,
  listConnections,
  saveConnection,
} from "./storage/connectionStore.js";
import {
  getDashboardMetrics,
  getDatabaseMetadata,
  getDatabaseRelations,
  getSingleTableDetails,
  getTableQuality,
  groupSchemaByTable,
  runCustomQuery,
  testConnection,
} from "./services/database.js";
import {
  generateDocumentationForConnection,
  listDocumentation,
} from "./services/documentation.js";
import {
  analyzeQueryImpact,
  getDataQualityMetrics,
  getStructuralAnalysis,
} from "./services/quality.js";
import { askAiForQuery, chatWithSchema } from "./services/chat.js";

function requireConnection(connectionId?: string) {
  const conn = connectionId
    ? getConnectionById(connectionId) ?? getActiveConnection()
    : getActiveConnection();

  if (!conn) {
    throw new Error(
      "No database connected. Use datalens_connect with a connection string, or set DATALENS_DATABASE_URL."
    );
  }
  return conn;
}

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

const server = new McpServer({
  name: "datalens-ai",
  version: "0.1.0",
});

server.tool(
  "datalens_connect",
  "Connect to a database by saving its connection URI. Supports PostgreSQL and MySQL. The URI is stored locally in ~/.datalens.",
  {
    name: z.string().describe("Friendly name for this connection"),
    connection_uri: z
      .string()
      .describe("Database URI, e.g. postgresql://user:pass@host:5432/db"),
  },
  async ({ name, connection_uri }) => {
    const test = await testConnection(connection_uri);
    if (!test.success) {
      return textResult({ success: false, error: test.error });
    }
    const conn = saveConnection(name, connection_uri);
    return textResult({
      success: true,
      message: `Connected to ${conn.name} (${conn.provider})`,
      connection: {
        id: conn.id,
        name: conn.name,
        provider: conn.provider,
      },
    });
  }
);

server.tool(
  "datalens_connection_status",
  "Get the active database connection and list all saved connections.",
  {},
  async () => {
    const active = getActiveConnection();
    const all = listConnections();
    return textResult({
      active: active
        ? { id: active.id, name: active.name, provider: active.provider }
        : null,
      saved_connections: all.map((c) => ({
        id: c.id,
        name: c.name,
        provider: c.provider,
        connectedAt: c.connectedAt,
      })),
      env_configured: Boolean(process.env.DATALENS_DATABASE_URL),
    });
  }
);

server.tool(
  "datalens_get_schema",
  "Scan the connected database and return full schema metadata: tables, columns, types, primary keys, foreign keys, and row counts.",
  {
    connection_id: z.string().optional().describe("Optional connection ID"),
  },
  async ({ connection_id }) => {
    const conn = requireConnection(connection_id);
    const result = await getDatabaseMetadata(conn.uri);
    if (!result.success) return textResult({ success: false, error: result.error });

    const tables = groupSchemaByTable(result.data!.schema);
    const summary = [...tables.entries()].map(([name, cols]) => ({
      table: name,
      columnCount: cols.length,
      primaryKeys: cols.filter((c) => c.is_primary_key).map((c) => c.column_name),
      foreignKeys: cols
        .filter((c) => c.is_foreign_key)
        .map((c) => ({
          column: c.column_name,
          references: `${c.foreign_table_name}.${c.foreign_column_name}`,
        })),
    }));

    return textResult({
      success: true,
      connection: conn.name,
      tables: summary,
      schema: result.data!.schema,
      rowCounts: result.data!.counts,
    });
  }
);

server.tool(
  "datalens_get_table_details",
  "Get detailed column information for a specific table including keys and constraints.",
  {
    table_name: z.string().describe("Table name to inspect"),
    connection_id: z.string().optional(),
  },
  async ({ table_name, connection_id }) => {
    const conn = requireConnection(connection_id);
    const result = await getSingleTableDetails(conn.uri, table_name);
    return textResult(result);
  }
);

server.tool(
  "datalens_get_relationships",
  "Get foreign key relationships between tables in the connected database.",
  {
    connection_id: z.string().optional(),
  },
  async ({ connection_id }) => {
    const conn = requireConnection(connection_id);
    const result = await getDatabaseRelations(conn.uri);
    return textResult(result);
  }
);

server.tool(
  "datalens_run_query",
  "Execute a read-only SQL query against the connected PostgreSQL database. Use SELECT queries; results are returned as JSON.",
  {
    sql: z.string().describe("SQL query to execute"),
    connection_id: z.string().optional(),
  },
  async ({ sql, connection_id }) => {
    const conn = requireConnection(connection_id);
    const normalized = sql.trim().toUpperCase();
    if (
      normalized.startsWith("DROP") ||
      normalized.startsWith("DELETE") ||
      normalized.startsWith("TRUNCATE") ||
      normalized.startsWith("ALTER") ||
      normalized.startsWith("INSERT") ||
      normalized.startsWith("UPDATE")
    ) {
      return textResult({
        success: false,
        error: "Only read queries (SELECT, WITH, EXPLAIN) are allowed via MCP for safety.",
      });
    }
    const result = await runCustomQuery(conn.uri, sql);
    return textResult(result);
  }
);

server.tool(
  "datalens_get_table_quality",
  "Get column-level data quality metrics for a table: completeness, uniqueness, and averages for numeric columns.",
  {
    table_name: z.string().describe("Table to analyze"),
    connection_id: z.string().optional(),
  },
  async ({ table_name, connection_id }) => {
    const conn = requireConnection(connection_id);
    const meta = await getDatabaseMetadata(conn.uri);
    if (!meta.success || !meta.data) return textResult({ success: false, error: meta.error });

    const columns = meta.data.schema.filter((c) => c.table_name === table_name);
    if (columns.length === 0) {
      return textResult({ success: false, error: `Table "${table_name}" not found.` });
    }

    const result = await getTableQuality(conn.uri, table_name, columns);
    return textResult(result);
  }
);

server.tool(
  "datalens_get_data_quality",
  "Run comprehensive data quality checks on a table: orphan records, duplicate PKs, null violations, freshness, and health score.",
  {
    table_name: z.string().describe("Table to check"),
    connection_id: z.string().optional(),
  },
  async ({ table_name, connection_id }) => {
    const conn = requireConnection(connection_id);
    const meta = await getDatabaseMetadata(conn.uri);
    if (!meta.success || !meta.data) return textResult({ success: false, error: meta.error });

    const result = await getDataQualityMetrics(conn.uri, table_name, meta.data.schema);
    return textResult(result);
  }
);

server.tool(
  "datalens_get_structural_analysis",
  "Analyze schema structure: isolated tables, relationship depth, and hub tables with many connections.",
  {
    connection_id: z.string().optional(),
  },
  async ({ connection_id }) => {
    const conn = requireConnection(connection_id);
    const meta = await getDatabaseMetadata(conn.uri);
    if (!meta.success || !meta.data) return textResult({ success: false, error: meta.error });

    const relResult = await getDatabaseRelations(conn.uri);
    const relations =
      relResult.success && relResult.data && "relations" in relResult.data
        ? (relResult.data.relations as { source_table: string; target_table: string }[])
        : [];

    const analysis = getStructuralAnalysis(meta.data.schema, relations);
    return textResult({ success: true, data: analysis });
  }
);

server.tool(
  "datalens_get_dashboard_metrics",
  "Get schema analytics dashboard metrics: table count, relationships, complexity, and key statistics.",
  {
    connection_id: z.string().optional(),
  },
  async ({ connection_id }) => {
    const conn = requireConnection(connection_id);
    const meta = await getDatabaseMetadata(conn.uri);
    if (!meta.success || !meta.data) return textResult({ success: false, error: meta.error });

    const relResult = await getDatabaseRelations(conn.uri);
    const relations =
      relResult.success && relResult.data && "relations" in relResult.data
        ? relResult.data.relations
        : [];

    const metrics = getDashboardMetrics(meta.data.schema, relations);
    return textResult({ success: true, connection: conn.name, metrics });
  }
);

server.tool(
  "datalens_generate_documentation",
  "Generate AI-powered Markdown documentation for database tables using Gemini. Requires GEMINI_API_KEY_MCP.",
  {
    table_name: z
      .string()
      .optional()
      .describe("Specific table name, or omit to document all tables"),
    connection_id: z.string().optional(),
  },
  async ({ table_name, connection_id }) => {
    const conn = requireConnection(connection_id);
    const result = await generateDocumentationForConnection(
      conn.id,
      conn.uri,
      table_name
    );
    return textResult(result);
  }
);

server.tool(
  "datalens_get_documentation",
  "Retrieve generated Markdown documentation for tables. Run datalens_generate_documentation first if empty.",
  {
    table_name: z.string().optional().describe("Filter to a specific table"),
    connection_id: z.string().optional(),
  },
  async ({ table_name, connection_id }) => {
    const conn = requireConnection(connection_id);
    const docs = listDocumentation(conn.id, table_name);
    return textResult({
      success: true,
      count: docs.length,
      documentation: docs.map((d) => ({
        tableName: d.tableName,
        updatedAt: d.updatedAt,
        content: d.content,
      })),
    });
  }
);

server.tool(
  "datalens_chat_with_schema",
  "Ask questions about your database schema and documentation. Uses Groq or Gemini. Requires GROQ_API_KEY_MCP or GEMINI_API_KEY_MCP.",
  {
    question: z.string().describe("Question about the schema, tables, or relationships"),
    connection_id: z.string().optional(),
  },
  async ({ question, connection_id }) => {
    const conn = requireConnection(connection_id);
    const result = await chatWithSchema(question, conn.id, conn.uri);
    return textResult(result);
  }
);

server.tool(
  "datalens_ask_ai_query",
  "Ask AI to generate a SQL query based on your schema. Returns PostgreSQL with LIMIT 100. Requires GEMINI_API_KEY_MCP.",
  {
    question: z.string().describe("Natural language question, e.g. 'Show top 10 customers by order count'"),
    connection_id: z.string().optional(),
  },
  async ({ question, connection_id }) => {
    const conn = requireConnection(connection_id);
    const meta = await getDatabaseMetadata(conn.uri);
    if (!meta.success || !meta.data) return textResult({ success: false, error: meta.error });

    const result = await askAiForQuery(question, meta.data.schema);
    return textResult(result);
  }
);

server.tool(
  "datalens_analyze_query",
  "Analyze a SQL query for join depth, table relationships, and performance impact. Requires GROQ_API_KEY_MCP.",
  {
    sql: z.string().describe("SQL query to analyze"),
  },
  async ({ sql }) => {
    const result = await analyzeQueryImpact(sql);
    return textResult(result);
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DataLens AI MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
