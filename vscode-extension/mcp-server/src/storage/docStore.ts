import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { getStoreDir } from "./connectionStore.js";

function docsDir(connectionId: string): string {
  const dir = join(getStoreDir(), "docs", connectionId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function saveDocumentation(
  connectionId: string,
  tableName: string,
  markdown: string
): void {
  const filePath = join(docsDir(connectionId), `${tableName}.md`);
  writeFileSync(filePath, markdown, "utf-8");
}

export function getDocumentation(
  connectionId: string,
  tableName?: string
): { tableName: string; content: string; updatedAt: string }[] {
  const dir = docsDir(connectionId);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  const results: { tableName: string; content: string; updatedAt: string }[] = [];

  for (const file of files) {
    const name = file.replace(/\.md$/, "");
    if (tableName && name !== tableName) continue;

    const filePath = join(dir, file);
    const content = readFileSync(filePath, "utf-8");
    const stat = statSync(filePath);
    results.push({
      tableName: name,
      content,
      updatedAt: stat.mtime.toISOString(),
    });
  }

  return results.sort((a, b) => a.tableName.localeCompare(b.tableName));
}
