import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ColumnInfo, getDatabaseMetadata } from "./database.js";
import { buildSchemaContextForChat, listDocumentation } from "./documentation.js";
import { getMcpGeminiApiKey, getMcpGroqApiKey } from "../config/env.js";

export async function chatWithSchema(
  query: string,
  connectionId: string,
  uri: string
): Promise<{ success: boolean; answer?: string; error?: string }> {
  const metadata = await getDatabaseMetadata(uri);
  if (!metadata.success || !metadata.data) {
    return { success: false, error: metadata.error ?? "Failed to load schema" };
  }

  const docs = listDocumentation(connectionId);
  const docContext = docs
    .slice(0, 5)
    .map((d) => `### ${d.tableName}\n${d.content.slice(0, 2000)}`)
    .join("\n\n---\n\n");

  const schemaContext = buildSchemaContextForChat(metadata.data.schema);
  const context = `SCHEMA:\n${schemaContext}\n\nDOCUMENTATION:\n${docContext || "No documentation generated yet. Run generate_documentation first."}`;

  const groqKey = getMcpGroqApiKey();
  if (groqKey) {
    const groq = new Groq({ apiKey: groqKey });
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a database intelligence assistant for DataLens AI. Use only the provided schema and documentation context. Do not hallucinate tables or columns.\n\n${context}`,
        },
        { role: "user", content: query },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      max_tokens: 1500,
    });
    return {
      success: true,
      answer: completion.choices[0]?.message?.content ?? "No response generated.",
    };
  }

  const geminiKey = getMcpGeminiApiKey();
  if (geminiKey) {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(
      `Context:\n${context}\n\nUser question: ${query}\n\nAnswer based only on the context.`
    );
    return { success: true, answer: result.response.text() };
  }

  return {
    success: false,
    error: "Set GROQ_API_KEY_MCP or GEMINI_API_KEY_MCP for schema chat.",
  };
}

export async function askAiForQuery(
  userQuestion: string,
  schema: ColumnInfo[]
): Promise<{ success: boolean; answer?: string; error?: string }> {
  const context = buildSchemaContextForChat(schema);
  const geminiKey = getMcpGeminiApiKey();
  if (!geminiKey) {
    return { success: false, error: "GEMINI_API_KEY_MCP is required for AI query generation." };
  }

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: `You are a PostgreSQL expert. Given a schema, write a query. Always append LIMIT 100 to SELECT statements unless the user asks for a specific count.`,
  });

  const prompt = `SCHEMA:\n${context}\n\nQUESTION:\n${userQuestion}\n\nReturn a PostgreSQL code block with LIMIT 100.`;
  const result = await model.generateContent(prompt);
  return { success: true, answer: result.response.text() };
}
