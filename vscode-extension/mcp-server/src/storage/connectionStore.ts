import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface StoredConnection {
  id: string;
  name: string;
  provider: string;
  uri: string;
  connectedAt: string;
}

const STORE_DIR = process.env.DATALENS_STORE_DIR || join(homedir(), ".datalens");
const STORE_FILE = join(STORE_DIR, "connections.json");

function ensureStore(): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
}

function readStore(): StoredConnection[] {
  ensureStore();
  if (!existsSync(STORE_FILE)) return [];
  try {
    return JSON.parse(readFileSync(STORE_FILE, "utf-8")) as StoredConnection[];
  } catch {
    return [];
  }
}

function writeStore(connections: StoredConnection[]): void {
  ensureStore();
  writeFileSync(STORE_FILE, JSON.stringify(connections, null, 2), "utf-8");
}

export function connectionIdFromUri(uri: string): string {
  return createHash("sha256").update(uri.trim()).digest("hex").slice(0, 16);
}

export function detectProvider(uri: string): string {
  if (uri.startsWith("postgres")) return "postgresql";
  if (uri.startsWith("mysql")) return "mysql";
  if (uri.startsWith("snowflake")) return "snowflake";
  if (uri.startsWith("neo4j")) return "neo4j";
  return "unknown";
}

export function getActiveConnection(): StoredConnection | null {
  const envUri =
    process.env.DATALENS_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (envUri) {
    return {
      id: connectionIdFromUri(envUri),
      name: "Environment Connection",
      provider: detectProvider(envUri),
      uri: envUri,
      connectedAt: new Date().toISOString(),
    };
  }

  const connections = readStore();
  const activeId = process.env.DATALENS_ACTIVE_CONNECTION_ID;
  if (activeId) {
    return connections.find((c) => c.id === activeId) ?? null;
  }
  return connections.length > 0 ? connections[connections.length - 1] : null;
}

export function saveConnection(name: string, uri: string): StoredConnection {
  const trimmed = uri.trim();
  const connection: StoredConnection = {
    id: connectionIdFromUri(trimmed),
    name,
    provider: detectProvider(trimmed),
    uri: trimmed,
    connectedAt: new Date().toISOString(),
  };

  const connections = readStore().filter((c) => c.id !== connection.id);
  connections.push(connection);
  writeStore(connections);
  return connection;
}

export function listConnections(): StoredConnection[] {
  return readStore();
}

export function getConnectionById(id: string): StoredConnection | null {
  return readStore().find((c) => c.id === id) ?? null;
}

export function getStoreDir(): string {
  ensureStore();
  return STORE_DIR;
}
