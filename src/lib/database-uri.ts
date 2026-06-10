export const DEFAULT_CONNECTION_ID = "showroom-db";

export function getDefaultDatabaseUri(): string {
  const uri = process.env.DATABASE_URL?.trim();
  if (!uri) {
    throw new Error("DATABASE_URL is not configured");
  }
  return uri;
}

export async function resolveDatabaseUri(connectionId: string, userId?: string): Promise<string> {
  if (
    !userId ||
    connectionId === DEFAULT_CONNECTION_ID ||
    connectionId === "demo-mode" ||
    connectionId === "demo-neon-db"
  ) {
    return getDefaultDatabaseUri();
  }
  const { getConnectionStringById } = await import("@/src/actions/db");
  return (await getConnectionStringById(connectionId, userId)) || getDefaultDatabaseUri();
}
