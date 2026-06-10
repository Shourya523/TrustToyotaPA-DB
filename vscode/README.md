# DataLens AI — IDE Setup (Cursor, VS Code, Antigravity)

Use the **DataLens MCP server** to explore schemas, run queries, generate documentation, and check data quality from your IDE.

Implementation: [`../vscode-extension/`](../vscode-extension/) (MCP server + optional VS Code extension).

---

## 1. Build the MCP server (everyone)

From the **repo root**:

```bash
cd vscode-extension/mcp-server
npm install
npm run build
```

Entry point (use this path in all configs below):

```text
<REPO_ROOT>/vscode-extension/mcp-server/dist/index.js
```

Example on Windows:

```text
C:/Users/You/datalens-hackDays/vscode-extension/mcp-server/dist/index.js
```

---

## 2. Environment variables (`.env`)

Create or edit **`.env`** at the repo root. The MCP server loads it automatically when `cwd` is the repo root.

| Variable | Purpose |
|----------|---------|
| `DATALENS_DATABASE_URL` | PostgreSQL/MySQL connection URI |
| `DATABASE_URL` | Fallback if `DATALENS_DATABASE_URL` is unset |
| `GEMINI_API_KEY_MCP` | AI docs / SQL generation (MCP only — not the web app key) |
| `GROQ_API_KEY_MCP` | Schema chat / query analysis (MCP only) |
| `DOTENV_CONFIG_QUIET` | Set to `true` if you still see MCP init errors (dotenv stdout) |

**Web app keys** (`GEMINI_API_KEY`, `GROQ_API_KEY`) stay separate so MCP usage does not hit the same rate limits.

---

## 3. Cursor

### Where to enable

**Settings → Tools & MCP** → toggle **datalens** **ON** (green dot, ~15 tools).

### Config file

| Location | Path |
|----------|------|
| **Project** | `<REPO_ROOT>/.cursor/mcp.json` |

Copy the example:

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
```

### Example `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "datalens": {
      "command": "node",
      "args": ["${workspaceFolder}/vscode-extension/mcp-server/dist/index.js"]
    }
  }
}
```

`${workspaceFolder}` resolves to the cloned repo when the workspace is open. Secrets come from `.env` at the repo root.

Optional explicit env (instead of `.env`):

```json
"env": {
  "DOTENV_CONFIG_QUIET": "true",
  "DATALENS_DATABASE_URL": "postgresql://...",
  "GEMINI_API_KEY_MCP": "...",
  "GROQ_API_KEY_MCP": "..."
}
```

### Use in chat

Open **Agent** chat and ask:

```text
Use datalens to check connection status and list my database tables
```

---

## 4. Google Antigravity

Antigravity does **not** read `.cursor/mcp.json`.

### Where to enable

1. Open the **Agent** side panel.
2. Click **`...`** (top of panel) → **MCP Servers**.
3. **Manage MCP Servers** → **View raw config**.
4. Ensure **datalens** is listed, `"disabled": false`, then **Refresh**.

Also: **Ctrl+,** → **Customizations** → **Installed MCP Servers** → **Refresh**.

### Config file

| OS | Path |
|----|------|
| **Windows** | `C:\Users\<You>\.gemini\config\mcp_config.json` |
| **Mac / Linux** | `~/.gemini/config/mcp_config.json` |

Use **absolute paths** (Antigravity does not support `${workspaceFolder}`).

### Example `mcp_config.json`

Merge into the existing `mcpServers` object:

```json
{
  "mcpServers": {
    "datalens": {
      "command": "node",
      "args": [
        "C:/Users/You/datalens-hackDays/vscode-extension/mcp-server/dist/index.js"
      ],
      "cwd": "C:/Users/You/datalens-hackDays",
      "disabled": false,
      "env": {
        "DOTENV_CONFIG_QUIET": "true"
      }
    }
  }
}
```

Replace `C:/Users/You/datalens-hackDays` with your real clone path. Forward slashes work on Windows.

Full template: [`../vscode-extension/antigravity-mcp.example.json`](../vscode-extension/antigravity-mcp.example.json)

### Troubleshooting Antigravity

| Error | Fix |
|-------|-----|
| `invalid character 'â' looking for beginning of value` | dotenv printed to stdout — set `DOTENV_CONFIG_QUIET=true` and rebuild MCP server |
| `0 tools` | Wrong path to `dist/index.js`, or server not built |
| Server disabled | Set `"disabled": false` and refresh |

---

## 5. Visual Studio Code (GitHub Copilot)

Requires VS Code with **GitHub Copilot** and MCP support.

### Where to enable

- **Command Palette** → `MCP: List Servers` → start **datalens**
- Or open `.vscode/mcp.json` and use **Start Server** above the server block
- **Extensions** view → **MCP SERVERS** section

### Config file

| Scope | Path |
|-------|------|
| **Workspace** (share with team) | `<REPO_ROOT>/.vscode/mcp.json` |
| **User** | Command Palette → `MCP: Open User Configuration` |

Copy the example:

```bash
cp .vscode/mcp.json.example .vscode/mcp.json
```

### Example `.vscode/mcp.json`

```json
{
  "servers": {
    "datalens": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/vscode-extension/mcp-server/dist/index.js"],
      "cwd": "${workspaceFolder}",
      "env": {
        "DOTENV_CONFIG_QUIET": "true"
      }
    }
  }
}
```

VS Code uses `"servers"` (not `"mcpServers"`). Optional: add `inputs` for secrets instead of `.env` — see [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration).

### Use in Copilot Chat

Ask in **Copilot Chat** (agent mode):

```text
Use datalens to get schema and list all tables
```

---

## 6. MCP tools reference

| Tool | Description |
|------|-------------|
| `datalens_connect` | Save a database URI |
| `datalens_connection_status` | Active + saved connections |
| `datalens_get_schema` | Full schema scan |
| `datalens_get_table_details` | One table’s columns |
| `datalens_get_relationships` | Foreign keys |
| `datalens_run_query` | Read-only SQL (PostgreSQL) |
| `datalens_get_table_quality` | Column completeness / uniqueness |
| `datalens_get_data_quality` | Orphans, duplicates, health score |
| `datalens_get_structural_analysis` | Hubs, isolated tables, depth |
| `datalens_get_dashboard_metrics` | Schema analytics |
| `datalens_generate_documentation` | AI Markdown docs |
| `datalens_get_documentation` | Read generated docs |
| `datalens_chat_with_schema` | Ask about schema |
| `datalens_ask_ai_query` | Natural language → SQL |
| `datalens_analyze_query` | Query impact analysis |

---

## 7. Quick comparison

| IDE | Config file | Path style | Enable UI |
|-----|-------------|------------|-----------|
| **Cursor** | `.cursor/mcp.json` | `${workspaceFolder}/...` | Settings → Tools & MCP → toggle |
| **Antigravity** | `~/.gemini/config/mcp_config.json` | Absolute `C:/...` + `cwd` | Agent `...` → Manage MCP Servers |
| **VS Code** | `.vscode/mcp.json` | `${workspaceFolder}/...` | MCP: List Servers / Start Server |

---

## 8. VS Code extension (optional)

For command-palette helpers (connect DB, open config snippet):

```bash
cd vscode-extension
npm install
npm run build:mcp
npm run compile
```

Press **F5** to run the Extension Development Host.

---

## 9. Security

- Do not commit `.env` (already in `.gitignore`).
- MCP blocks destructive SQL (`DROP`, `DELETE`, `UPDATE`, etc.).
- Use `GEMINI_API_KEY_MCP` / `GROQ_API_KEY_MCP` for MCP so the web app keys stay separate.

---

## 10. More docs

- MCP server details: [`../vscode-extension/README.md`](../vscode-extension/README.md)
- Web app: [`../README.md`](../README.md)
