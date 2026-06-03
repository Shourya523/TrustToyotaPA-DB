import { ColumnInfo, runCustomQuery } from "./database.js";
import { getMcpGroqApiKey } from "../config/env.js";

export interface DataQualityResult {
  orphans: { type: string; orphan_count: number; affected_table: string; fk_column: string }[];
  duplicates: { type: string; count: number; column: string }[];
  nullViolations: { column: string; count: number; ratio: number }[];
  freshness: { freshness_days: number } | null;
  health: { table: string; score: number; status: "GOOD" | "WARNING" | "CRITICAL" };
}

export async function getDataQualityMetrics(
  uri: string,
  tableName: string,
  schema: ColumnInfo[]
): Promise<{ success: boolean; data?: DataQualityResult; error?: string }> {
  const tableSchema = schema.filter((c) => c.table_name === tableName);
  if (tableSchema.length === 0) {
    return { success: false, error: `Table "${tableName}" not found in schema.` };
  }

  const results: DataQualityResult = {
    orphans: [],
    duplicates: [],
    nullViolations: [],
    freshness: null,
    health: { table: tableName, score: 100, status: "GOOD" },
  };

  for (const col of tableSchema) {
    if (col.is_foreign_key && col.foreign_table_name) {
      const orphanSql = `
        SELECT COUNT(*)::int as count
        FROM "${tableName}" c
        LEFT JOIN "${col.foreign_table_name}" p ON c."${col.column_name}" = p."${col.foreign_column_name}"
        WHERE p."${col.foreign_column_name}" IS NULL AND c."${col.column_name}" IS NOT NULL;
      `;
      const res = await runCustomQuery(uri, orphanSql);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const row = res.data[0] as { count: number };
        results.orphans.push({
          type: "integrity_check",
          orphan_count: row.count,
          affected_table: tableName,
          fk_column: col.column_name,
        });
      }
    }
  }

  const pk = tableSchema.find((c) => c.is_primary_key);
  if (pk) {
    const dupSql = `
      SELECT COUNT(*)::int as count FROM (
        SELECT "${pk.column_name}" FROM "${tableName}" GROUP BY "${pk.column_name}" HAVING COUNT(*) > 1
      ) sub;
    `;
    const res = await runCustomQuery(uri, dupSql);
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      const row = res.data[0] as { count: number };
      results.duplicates.push({
        type: "duplicate_check",
        count: row.count,
        column: pk.column_name,
      });
    }
  }

  for (const col of tableSchema) {
    if (col.is_nullable === "NO") {
      const nullSql = `
        SELECT 
          COUNT(*) FILTER (WHERE "${col.column_name}" IS NULL)::int as null_count,
          COUNT(*)::int as total_count
        FROM "${tableName}";
      `;
      const res = await runCustomQuery(uri, nullSql);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const row = res.data[0] as { null_count: number; total_count: number };
        const ratio = row.total_count > 0 ? row.null_count / row.total_count : 0;
        if (row.null_count > 0 || ratio > 0.2) {
          results.nullViolations.push({
            column: col.column_name,
            count: row.null_count,
            ratio,
          });
        }
      }
    }
  }

  const timeCol = tableSchema.find(
    (c) =>
      c.column_name.toLowerCase() === "updated_at" ||
      c.column_name.toLowerCase() === "created_at"
  );
  if (timeCol) {
    const freshSql = `SELECT MAX("${timeCol.column_name}") as last_updated FROM "${tableName}";`;
    const res = await runCustomQuery(uri, freshSql);
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      const row = res.data[0] as { last_updated: string | null };
      if (row.last_updated) {
        const lastDate = new Date(row.last_updated);
        const diffDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        results.freshness = { freshness_days: diffDays };
      }
    }
  }

  let score = 100;
  const orphanPenalty = results.orphans.reduce((acc, o) => acc + (o.orphan_count > 0 ? 10 : 0), 0);
  const dupPenalty = results.duplicates.reduce((acc, d) => acc + (d.count > 0 ? 20 : 0), 0);
  const nullPenalty = results.nullViolations.length * 5;
  const stalenessPenalty = (results.freshness?.freshness_days ?? 0) > 30 ? 10 : 0;

  score = Math.max(0, score - orphanPenalty - dupPenalty - nullPenalty - stalenessPenalty);
  results.health = {
    table: tableName,
    score,
    status: score > 80 ? "GOOD" : score > 50 ? "WARNING" : "CRITICAL",
  };

  return { success: true, data: results };
}

export function getStructuralAnalysis(
  schema: ColumnInfo[],
  relations: { source_table: string; target_table: string }[]
) {
  const tableNames = new Set(schema.map((c) => c.table_name));
  const connected = new Set<string>();

  for (const rel of relations) {
    connected.add(rel.source_table);
    connected.add(rel.target_table);
  }

  const isolated = [...tableNames].filter((t) => !connected.has(t) || !relations.some((r) => r.source_table === t || r.target_table === t));

  const degreeMap = new Map<string, number>();
  for (const rel of relations) {
    degreeMap.set(rel.source_table, (degreeMap.get(rel.source_table) ?? 0) + 1);
    degreeMap.set(rel.target_table, (degreeMap.get(rel.target_table) ?? 0) + 1);
  }

  const hubs = [...degreeMap.entries()]
    .filter(([, degree]) => degree > 3)
    .map(([name, connections]) => ({ name, connections }))
    .sort((a, b) => b.connections - a.connections);

  const adjacency = new Map<string, Set<string>>();
  for (const rel of relations) {
    if (!adjacency.has(rel.source_table)) adjacency.set(rel.source_table, new Set());
    adjacency.get(rel.source_table)!.add(rel.target_table);
  }

  let maxDepth = 0;
  for (const start of tableNames) {
    const depth = bfsMaxDepth(start, adjacency);
    maxDepth = Math.max(maxDepth, depth);
  }

  return {
    isolated: isolated.filter((t) => !relations.some((r) => r.source_table === t || r.target_table === t)),
    maxDepth,
    hubs,
    totalTables: tableNames.size,
    totalRelationships: relations.length,
  };
}

function bfsMaxDepth(start: string, adjacency: Map<string, Set<string>>): number {
  const visited = new Set<string>();
  const queue: { node: string; depth: number }[] = [{ node: start, depth: 0 }];
  let max = 0;

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    max = Math.max(max, depth);

    const neighbors = adjacency.get(node);
    if (neighbors) {
      for (const n of neighbors) {
        if (!visited.has(n)) queue.push({ node: n, depth: depth + 1 });
      }
    }
  }
  return max;
}

export async function analyzeQueryImpact(query: string) {
  const apiKey = getMcpGroqApiKey();
  if (!apiKey) {
    return { success: false, error: "GROQ_API_KEY_MCP is required for query impact analysis." };
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            'Analyze the SQL query. Return JSON: { "depth": number, "relations": ["tableA -> tableB"], "impact": "description" }',
        },
        { role: "user", content: query },
      ],
      response_format: { type: "json_object" },
    }),
  });

  const data = (await response.json()) as {
    error?: { message: string };
    choices?: { message: { content: string } }[];
  };

  if (!response.ok) {
    return { success: false, error: data.error?.message ?? "Groq API Error" };
  }

  if (data.choices?.length) {
    return { success: true, data: JSON.parse(data.choices[0].message.content) };
  }
  return { success: false, error: "No analysis generated." };
}
