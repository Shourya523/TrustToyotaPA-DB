import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(request: Request) {
  try {
    const customDir = path.join(process.cwd(), "src/app/api/custom");
    
    // Ensure directory exists
    try {
      await fs.mkdir(customDir, { recursive: true });
    } catch (e) {}

    const entries = await fs.readdir(customDir, { withFileTypes: true });
    const endpoints = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const routeFile = path.join(customDir, entry.name, "route.ts");
        try {
          const stats = await fs.stat(routeFile);
          const code = await fs.readFile(routeFile, "utf-8");
          endpoints.push({
            slug: entry.name,
            url: `/api/custom/${entry.name}`,
            code: code,
            updatedAt: stats.mtime.toISOString(),
          });
        } catch {
          // File does not exist or cannot be read
        }
      }
    }

    return NextResponse.json({ success: true, endpoints });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ success: false, error: "slug parameter is required" }, { status: 400 });
    }

    const cleanSlug = slug.replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase();
    const endpointDir = path.join(process.cwd(), "src/app/api/custom", cleanSlug);

    try {
      await fs.rm(endpointDir, { recursive: true, force: true });
      return NextResponse.json({ success: true, message: `Endpoint /api/custom/${cleanSlug} deleted successfully.` });
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
