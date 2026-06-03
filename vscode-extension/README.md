# DataLens AI — VS Code Extension & MCP Server

Connect any database to DataLens AI from **Cursor**, **VS Code**, or any MCP-compatible client. Explore schemas, generate documentation, run queries, check data quality, and chat with your database metadata — without leaving the IDE.

## What you get

| Capability | MCP Tool |
|------------|----------|
| Connect database | `datalens_connect` |
| Connection status | `datalens_connection_status` |
| Full schema scan | `datalens_get_schema` |
| Table details | `datalens_get_table_details` |
| Foreign key map | `datalens_get_relationships` |
| Run SQL (read-only) | `datalens_run_query` |
| Column quality metrics | `datalens_get_table_quality` |
| Data quality checks | `datalens_get_data_quality` |
| Structural analysis | `datalens_get_structural_analysis` |
| Dashboard metrics | `datalens_get_dashboard_metrics` |
| Generate AI docs | `datalens_generate_documentation` |
| View documentation | `datalens_get_documentation` |
| Schema chat | `datalens_chat_with_schema` |
| AI SQL generation | `datalens_ask_ai_query` |
| Query impact analysis | `datalens_analyze_query` |

Supported databases: **PostgreSQL**, **MySQL** (schema scan); **PostgreSQL** (custom queries and quality checks).

---

## Quick start (Cursor / MCP)

### 1. Build the MCP server

```bash
cd vscode-extension/mcp-server
npm install
npm run build
```

### 2. Configure Cursor

Copy the example config and set your database URI:

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
```

Edit `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "datalens": {
      "command": "node",
      "args": ["vscode-extension/mcp-server/dist/index.js"],
      "env": {
        "DATALENS_DATABASE_URL": "postgresql://user:password@localhost:5432/mydb",
        "GEMINI_API_KEY": "optional-for-docs",
        "GROQ_API_KEY": "optional-for-chat"
      }
    }
  }
}
```

Restart Cursor. In chat, you can ask:

- *"Connect to my database and list all tables"*
- *"Generate documentation for the orders table"*
- *"Run data quality checks on customers"*
- *"What tables reference users?"*

### 3. Or connect via tool

Instead of `DATALENS_DATABASE_URL`, use the `datalens_connect` tool:

```
name: "Production DB"
connection_uri: "postgresql://..."
```

Connections are stored in `~/.datalens/connections.json`.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATALENS_DATABASE_URL` | No* | Default connection URI |
| `DATALENS_ACTIVE_CONNECTION_ID` | No | Use a specific saved connection |
| `DATALENS_STORE_DIR` | No | Override storage path (default: `~/.datalens`) |
| `GEMINI_API_KEY_MCP` | For docs / AI SQL | MCP-only Gemini key (separate from web app) |
| `GROQ_API_KEY_MCP` | For chat / query analysis | MCP-only Groq key (separate from web app) |

\* Either set this env var or call `datalens_connect`.

---

## VS Code extension

### Install (development)

```bash
cd vscode-extension
npm install
npm run build:mcp
npm run compile
```

Press **F5** in VS Code to launch the Extension Development Host.

### Commands

- **DataLens: Connect to Database** — saves URI to workspace settings
- **DataLens: Configure MCP Server** — opens MCP config snippet
- **DataLens: Open Schema Explorer** — guidance for MCP-based exploration

### Settings (`datalens.*`)

- `datalens.databaseUrl` — default connection URI
- `datalens.geminiApiKey` — Gemini API key
- `datalens.groqApiKey` — Groq API key

---

## Security

- Connection strings are stored locally (`~/.datalens` or VS Code workspace settings).
- MCP `datalens_run_query` blocks destructive SQL (DROP, DELETE, UPDATE, etc.).
- AI features use **schema metadata only** — no bulk row export to LLMs by default.
- API keys are passed via environment variables, not committed to git.

---

## Project layout

```
vscode-extension/
├── mcp-server/           # Standalone MCP server (stdio)
│   ├── src/
│   │   ├── index.ts      # Tool definitions
│   │   ├── services/     # Database, docs, quality, chat
│   │   └── storage/      # Local connection & doc store
│   └── package.json
├── src/
│   └── extension.ts      # VS Code extension entry
└── package.json
```

---

## Relationship to the web app

This MCP server ports core logic from the DataLens Next.js app (`src/actions/db.ts`, `dataQuality.ts`, `rag.ts`, `chat.ts`) into a standalone Node process suitable for IDE integration. The web app adds OAuth, Neo4j graph sync, Qdrant vector search, and Puppeteer doc images; the MCP server provides the essential workflow with local file storage and optional AI keys.

For the full visual experience (ER diagrams, graph DB, dashboard UI), run the web app:

```bash
npm run dev
# http://localhost:3000
```

---

## Troubleshooting

**"No database connected"**  
Set `DATALENS_DATABASE_URL` in MCP config or run `datalens_connect`.

**"GEMINI_API_KEY_MCP is required"**  
Add `GEMINI_API_KEY_MCP` to your project `.env` for documentation tools.

**"Only PostgreSQL is supported for custom queries"**  
Use a `postgresql://` URI for `datalens_run_query` and quality tools.

**MCP server not found**  
Run `npm run build` inside `vscode-extension/mcp-server`.
