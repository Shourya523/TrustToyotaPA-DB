import { GoogleGenerativeAI } from "@google/generative-ai";
import { getMcpGeminiApiKey } from "../config/env.js";
import {
  ColumnInfo,
  getDatabaseMetadata,
  getSingleTableDetails,
  groupSchemaByTable,
} from "./database.js";
import { getDocumentation, saveDocumentation } from "../storage/docStore.js";

const DOC_SYSTEM = `You are a senior enterprise data architect and technical documentation expert.

Generate high-quality, professional database documentation in clean Markdown format.

Follow these rules:
1. Use proper Markdown syntax only.
2. Use properly formatted Markdown tables.
3. Keep descriptions concise and professional.
4. Do NOT invent fields or relationships.
5. Output Markdown only.

Structure:
# {Table Name}
## Overview
## Schema Summary
## Fields (table format)
## Relationships`;

export async function generateDocumentationForConnection(
  connectionId: string,
  uri: string,
  tableName?: string
): Promise<{ success: boolean; message?: string; error?: string; generated?: string[] }> {
  const apiKey = getMcpGeminiApiKey();
  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY_MCP is required for documentation generation." };
  }

  const metadata = await getDatabaseMetadata(uri);
  if (!metadata.success || !metadata.data) {
    return { success: false, error: metadata.error ?? "Failed to fetch schema" };
  }

  const tables = groupSchemaByTable(metadata.data.schema);
  const targetTables = tableName
    ? tables.has(tableName)
      ? [tableName]
      : []
    : [...tables.keys()];

  if (targetTables.length === 0) {
    return { success: false, error: tableName ? `Table "${tableName}" not found.` : "No tables found." };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: DOC_SYSTEM,
  });

  const generated: string[] = [];

  for (const name of targetTables) {
    const columns = tables.get(name)!;
    const payload = {
      table: name,
      fields: columns.map((c) => ({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === "YES",
        is_primary_key: c.is_primary_key ?? false,
        is_foreign_key: c.is_foreign_key ?? false,
        references: c.foreign_table_name
          ? `${c.foreign_table_name}.${c.foreign_column_name}`
          : null,
      })),
      relationships: columns
        .filter((c) => c.is_foreign_key && c.foreign_table_name)
        .map((c) => ({
          field: c.column_name,
          references_table: c.foreign_table_name,
          references_field: c.foreign_column_name,
        })),
    };

    const prompt = `Generate documentation for:\n\n${JSON.stringify(payload, null, 2)}`;
    const result = await model.generateContent(prompt);
    let markdown = result.response.text();
    markdown = markdown.replace(/^```markdown\n/, "").replace(/\n```$/, "");

    saveDocumentation(connectionId, name, markdown);
    generated.push(name);
  }

  return {
    success: true,
    message: `Generated documentation for ${generated.length} table(s).`,
    generated,
  };
}

export function listDocumentation(connectionId: string, tableName?: string) {
  return getDocumentation(connectionId, tableName);
}

export function buildSchemaContextForChat(schema: ColumnInfo[], tableFilter?: string[]): string {
  const tables = groupSchemaByTable(schema);
  const names = tableFilter?.length ? tableFilter : [...tables.keys()].slice(0, 20);
  const parts: string[] = [];

  for (const name of names) {
    const cols = tables.get(name);
    if (!cols) continue;
    parts.push(`## Table: ${name}`);
    for (const c of cols) {
      let line = `- ${c.column_name} (${c.data_type})`;
      if (c.is_primary_key) line += " [PK]";
      if (c.is_foreign_key) line += ` [FK -> ${c.foreign_table_name}.${c.foreign_column_name}]`;
      parts.push(line);
    }
  }
  return parts.join("\n");
}

export async function getTableSchemaPayload(uri: string, tableName: string) {
  return getSingleTableDetails(uri, tableName);
}
