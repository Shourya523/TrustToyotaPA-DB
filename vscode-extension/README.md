# DataLens MCP Server & VS Code Extension

Standalone MCP server and optional VS Code extension for DataLens AI.

**IDE setup (Cursor, Antigravity, VS Code):** see **[`../vscode/README.md`](../vscode/README.md)** — paths, config files, and enable steps for each editor.

## Build

```bash
cd vscode-extension/mcp-server
npm install
npm run build
```

## Config templates

| IDE | Example file |
|-----|----------------|
| Cursor | [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) |
| VS Code | [`.vscode/mcp.json.example`](../.vscode/mcp.json.example) |
| Antigravity | [`antigravity-mcp.example.json`](antigravity-mcp.example.json) |

## Project layout

```
vscode-extension/
├── mcp-server/     # MCP server (stdio)
├── src/            # VS Code extension entry
└── package.json
```
