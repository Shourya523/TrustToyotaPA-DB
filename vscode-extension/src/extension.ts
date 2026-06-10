import * as vscode from "vscode";
import { existsSync } from "fs";
import { join } from "path";

export function activate(context: vscode.ExtensionContext) {
  const connectCmd = vscode.commands.registerCommand(
    "datalens.connectDatabase",
    async () => {
      const uri = await vscode.window.showInputBox({
        prompt: "Enter database connection URI",
        placeHolder: "postgresql://user:password@localhost:5432/mydb",
        password: true,
        ignoreFocusOut: true,
      });

      if (!uri) return;

      const name = await vscode.window.showInputBox({
        prompt: "Connection name",
        placeHolder: "My Database",
        value: "My Database",
      });

      await vscode.workspace
        .getConfiguration("datalens")
        .update("databaseUrl", uri, vscode.ConfigurationTarget.Workspace);

      vscode.window.showInformationMessage(
        `DataLens: Connected to "${name ?? "database"}". Use MCP tools or Cursor chat to explore your schema.`
      );
    }
  );

  const explorerCmd = vscode.commands.registerCommand(
    "datalens.openSchemaExplorer",
    () => {
      vscode.window.showInformationMessage(
        "DataLens Schema Explorer: Use MCP tools (datalens_get_schema) in Cursor/VS Code AI chat, or run the DataLens web app at localhost:3000."
      );
    }
  );

  const mcpCmd = vscode.commands.registerCommand(
    "datalens.configureMcp",
    async () => {
      const workspaceRoot =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
      const mcpPath = join(
        workspaceRoot,
        "vscode-extension",
        "mcp-server",
        "dist",
        "index.js"
      );

      const configSnippet = {
        mcpServers: {
          datalens: {
            command: "node",
            args: [mcpPath],
            env: {
              DATALENS_DATABASE_URL: "${DATALENS_DATABASE_URL}",
              GEMINI_API_KEY: "${GEMINI_API_KEY}",
              GROQ_API_KEY: "${GROQ_API_KEY}",
            },
          },
        },
      };

      const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(configSnippet, null, 2),
        language: "json",
      });
      await vscode.window.showTextDocument(doc);

      const built = existsSync(mcpPath);
      if (!built) {
        vscode.window.showWarningMessage(
          "MCP server not built yet. Run: cd vscode-extension/mcp-server && npm install && npm run build"
        );
      } else {
        vscode.window.showInformationMessage(
          "Copy this config into .cursor/mcp.json (Cursor) or your VS Code MCP settings."
        );
      }
    }
  );

  context.subscriptions.push(connectCmd, explorerCmd, mcpCmd);

  const dbUrl = vscode.workspace.getConfiguration("datalens").get<string>("databaseUrl");
  if (dbUrl) {
    console.log("DataLens AI: database URL configured in workspace settings.");
  }
}

export function deactivate() {}
