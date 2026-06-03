/**
 * MCP-only API keys — separate from the web app's GEMINI_API_KEY / GROQ_API_KEY
 * so MCP usage does not consume the main app rate limits.
 */
export function getMcpGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY_MCP?.trim();
}

export function getMcpGroqApiKey(): string | undefined {
  return process.env.GROQ_API_KEY_MCP?.trim();
}
