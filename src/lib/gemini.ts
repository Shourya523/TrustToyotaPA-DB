export interface TableData {
    tableName: string;
    description: string;
    columns: string;
    relationships: string;
}

export function parseMarkdownToTableData(tableName: string, content: string): TableData {
    const normalized = content.replace(/\r\n/g, "\n");
    
    let description = "";
    let columns = "";
    let relationships = "";
    
    const fieldsIdx = normalized.indexOf("## Fields");
    const relationsIdx = normalized.indexOf("## Relationships");
    
    if (fieldsIdx !== -1) {
        const beforeFields = normalized.substring(0, fieldsIdx).trim();
        description = beforeFields.replace(/^#[^\n]+\n/, "").trim();
    } else {
        description = normalized.trim();
    }
    
    if (fieldsIdx !== -1) {
        if (relationsIdx !== -1 && relationsIdx > fieldsIdx) {
            columns = normalized.substring(fieldsIdx + 9, relationsIdx).trim();
            relationships = normalized.substring(relationsIdx + 16).trim();
        } else {
            columns = normalized.substring(fieldsIdx + 9).trim();
        }
    }
    
    if (!columns && normalized.includes("## Columns")) {
        const colIdx = normalized.indexOf("## Columns");
        if (relationsIdx !== -1 && relationsIdx > colIdx) {
            columns = normalized.substring(colIdx + 10, relationsIdx).trim();
            relationships = normalized.substring(relationsIdx + 16).trim();
        } else {
            columns = normalized.substring(colIdx + 10).trim();
        }
    }
    
    return {
        tableName,
        description: description || "No description provided.",
        columns: columns || "No columns metadata provided.",
        relationships: relationships || "No relationships specified."
    };
}

export function generateGeminiPrompt(tableData: TableData): string {
    const instructions = `You are a database architect and data analyst.

Analyze the following database table documentation:`;

    const tasks = `Please:
1. Explain the purpose of this table.
2. Explain each column.
3. Identify potential design issues.
4. Suggest schema improvements.
5. Suggest useful SQL queries.
6. Describe how this table interacts with related tables.`;

    let description = tableData.description;
    let columns = tableData.columns;
    let relationships = tableData.relationships;

    const baseLength = instructions.length + tasks.length + 100;
    const maxTotalLength = 1800;
    
    let currentLength = baseLength + tableData.tableName.length + description.length + columns.length + relationships.length;
    
    if (currentLength > maxTotalLength) {
        if (description.length > 300) {
            description = description.substring(0, 300) + "... [Truncated for prompt length]";
        }
        
        currentLength = baseLength + tableData.tableName.length + description.length + columns.length + relationships.length;
        
        if (currentLength > maxTotalLength && relationships.length > 250) {
            relationships = relationships.substring(0, 250) + "... [Truncated for prompt length]";
        }
        
        currentLength = baseLength + tableData.tableName.length + description.length + columns.length + relationships.length;
        
        const allowedColumnsLength = maxTotalLength - (baseLength + tableData.tableName.length + description.length + relationships.length);
        if (columns.length > allowedColumnsLength && allowedColumnsLength > 100) {
            columns = columns.substring(0, allowedColumnsLength) + "... [Truncated for prompt length]";
        }
    }

    return `${instructions}

Table: ${tableData.tableName}

Description:
${description}

Columns:
${columns}

Relationships:
${relationships}

${tasks}`;
}

export async function openInGemini(prompt: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(prompt);
        window.open("https://gemini.google.com/", "_blank");
        return false;
    } catch (error) {
        console.error("Failed to copy prompt to clipboard:", error);
        window.open("https://gemini.google.com/", "_blank");
        throw error;
    }
}
