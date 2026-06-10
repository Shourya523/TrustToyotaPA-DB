import { getDatabaseMetadata } from "@/src/actions/db";
import { db } from "@/src/db";
import { connections } from "@/src/db/schema";
import { tool, zodSchema } from "ai";
import { eq } from "drizzle-orm";
import { z } from 'zod';
import fs from 'fs/promises';
import path from "path";

async function ensureDirectory(dirPath: string) {
    try {
        await fs.mkdir(dirPath, { recursive: true })
    } catch (err: any) {
        if (err.code !== "EEXIST") throw err;
    }
}

export const agentTools = {
    // T1: retrieve db schema
    getSchema: tool({
        description: "Scan the database connection to retrieve all tables, column names, types, and primary/foreign keys.",
        inputSchema: zodSchema(z.object({
            connectionId: z.string().describe("The active database connection ID"),
        })),
        execute: async ({ connectionId }) => {
            try {
                let tableUri = "";
                let provider = "postgres";

                const [conn] = await db
                    .select()
                    .from(connections)
                    .where(eq(connections.id, connectionId))
                    .limit(1);

                if (conn) {
                    tableUri = conn.tableUri;
                    provider = conn.provider;
                } else {
                    tableUri = process.env.DATABASE_URL || "";
                    if (!tableUri) {
                        return { success: false, error: "Database connection does not exist and DATABASE_URL is not configured." };
                    }
                }

                const metadata = await getDatabaseMetadata(tableUri);
                if (!metadata.success) {
                    return { success: false, error: metadata.error || "Failed to scan metadata" };
                }

                return {
                    success: true,
                    provider: provider,
                    schema: metadata.data?.schema
                };
            } catch (err: any) {
                return { success: false, error: err.message };
            }
        }
    }),

    writeApiEndPoint: tool({
        //T2:make endpoints
        description: "Create a new Next.js Route Handler file for a dynamic database API endpoint.",
        inputSchema: zodSchema(z.object({
            slug: z.string().describe("The URL path slug (e.g. 'recent-sales' for '/api/custom/recent-sales')"),
            code: z.string().describe("The complete Next.js route.ts TypeScript code content"),
        })),
        execute: async ({ slug, code }) => {
            try {
                const cleanSlug = slug.replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase();
                if (!cleanSlug) return { success: false, error: "Invalid slug name" };
                const endPointDir = path.join(process.cwd(), "src/app/api/custom", cleanSlug);
                await ensureDirectory(endPointDir);

                const filePath = path.join(endPointDir, "route.ts");
                await fs.writeFile(filePath, code, "utf-8");
                return {
                    success: true,
                    message: `Endpoint created successfully. Access at /api/custom/${cleanSlug}`,
                    routeUrl: `/api/custom/${cleanSlug}`,
                };
            } catch (err: any) {
                return { sucess: false, error: err.message }

            }
        }
    }),

    listApiEndPoints: tool({
        //T3:List endpoints
        description: "List all dynamically generated API endpoints in the system.",
        inputSchema: zodSchema(z.object({})),
        execute: async () => {
            try {
                const customDir = path.join(process.cwd(), "src/app/api/custom");
                await ensureDirectory(customDir);

                const entries = await fs.readdir(customDir, { withFileTypes: true })
                const endpoint = []

                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const routeFile = path.join(customDir, entry.name, "route.ts");
                        try {
                            await fs.access(routeFile);
                            endpoint.push({
                                slug: entry.name,
                                url: `/api/custom/${entry.name}`,
                            });
                        } catch {
                        }
                    }
                }
                return { success: true, endpoint };
            } catch (err: any) {
                return { success: false, error: err.message };
            }
        }
    }),
    deleteEndPoints: tool({
        description: "Delete a custom dynamic API endpoint and its directory.",
        inputSchema: zodSchema(z.object({
            slug: z.string().describe("The slug of the endpoint to delete (e.g. 'recent-sales')"),
        })),
        execute: async ({ slug }) => {
            try {
                const cleanSlug = slug.replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase();
                const endpointDir = path.join(process.cwd(), "src/app/api/custom", cleanSlug);
                await fs.rm(endpointDir, { recursive: true, force: true });
                return { success: true, message: `Endpoint /api/custom/${cleanSlug} deleted successfully.` };
            } catch (err: any) {
                return { success: false, error: err.message };
            }
        },
    })

}
