"use server";

export interface NotionSyncData {
    domain: string;
    overview: string;
    keyFindings: string[];
    recommendations: string[];
    dataGovernance: string;
    overallAssessment: string;
    tableCount: number;
    columnCount: number;
    totalRows: number;
    healthScore: number;
    piiCount: number;
    relationsCount: number;
    qualityIssues: {
        severity: string;
        table: string;
        column: string;
        issue: string;
        suggestion: string;
    }[];
    tables: {
        tableName: string;
        content: string;
    }[];
}

function parseMarkdownToBlocks(markdown: string): any[] {
    const lines = markdown.split("\n");
    const blocks: any[] = [];
    
    let inCodeBlock = false;
    let codeContent = "";
    let codeLanguage = "plain text";
    
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith("```")) {
            if (inCodeBlock) {
                blocks.push({
                    object: "block",
                    type: "code",
                    code: {
                        rich_text: [{ type: "text", text: { content: codeContent.trim() } }],
                        language: codeLanguage
                    }
                });
                inCodeBlock = false;
                codeContent = "";
            } else {
                inCodeBlock = true;
                const lang = line.substring(3).trim();
                codeLanguage = lang || "plain text";
            }
            continue;
        }
        
        if (inCodeBlock) {
            codeContent += lines[i] + "\n";
            continue;
        }
        
        if (line.startsWith("|")) {
            if (!inTable) {
                inTable = true;
                tableHeaders = line.split("|").map(s => s.trim()).filter(Boolean);
                tableRows = [];
            } else {
                if (line.replace(/[\s\-\|:]/g, "") === "") {
                    continue;
                }
                const cells = line.split("|").map(s => s.trim()).filter(Boolean);
                if (cells.length > 0) {
                    tableRows.push(cells);
                }
            }
            continue;
        } else if (inTable) {
            if (tableHeaders.length > 0) {
                blocks.push({
                    object: "block",
                    type: "paragraph",
                    paragraph: {
                        rich_text: [{ 
                            type: "text", 
                            text: { 
                                content: `Table Schema: ${tableHeaders.join(" | ")} \n` + 
                                         tableRows.map(row => row.join(" | ")).join("\n") 
                            } 
                        }]
                    }
                });
            }
            inTable = false;
            tableHeaders = [];
            tableRows = [];
        }
        
        if (line === "") continue;
        
        if (line.startsWith("# ")) {
            blocks.push({
                object: "block",
                type: "heading_1",
                heading_1: {
                    rich_text: [{ type: "text", text: { content: line.substring(2) } }]
                }
            });
        } else if (line.startsWith("## ")) {
            blocks.push({
                object: "block",
                type: "heading_2",
                heading_2: {
                    rich_text: [{ type: "text", text: { content: line.substring(3) } }]
                }
            });
        } else if (line.startsWith("### ")) {
            blocks.push({
                object: "block",
                type: "heading_3",
                heading_3: {
                    rich_text: [{ type: "text", text: { content: line.substring(4) } }]
                }
            });
        } else if (line.startsWith("- ") || line.startsWith("* ")) {
            blocks.push({
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                    rich_text: [{ type: "text", text: { content: line.substring(2) } }]
                }
            });
        } else if (/^\d+\.\s/.test(line)) {
            const content = line.replace(/^\d+\.\s/, "");
            blocks.push({
                object: "block",
                type: "numbered_list_item",
                numbered_list_item: {
                    rich_text: [{ type: "text", text: { content } }]
                }
            });
        } else if (line.startsWith("> ")) {
            blocks.push({
                object: "block",
                type: "callout",
                callout: {
                    rich_text: [{ type: "text", text: { content: line.substring(2) } }],
                    icon: { type: "emoji", emoji: "💡" }
                }
            });
        } else {
            blocks.push({
                object: "block",
                type: "paragraph",
                paragraph: {
                    rich_text: [{ type: "text", text: { content: line } }]
                }
            });
        }
    }
    
    return blocks;
}

export async function createNotionPage(data: NotionSyncData) {
    const apiKey = process.env.NOTION_API_KEY;
    const parentPageId = process.env.NOTION_PAGE_ID;
    
    if (!apiKey || !parentPageId) {
        return {
            success: true,
            url: "https://notion.so",
            isMock: true
        };
    }
    
    try {
        const blocks: any[] = [
            {
                object: "block",
                type: "heading_1",
                heading_1: {
                    rich_text: [{ type: "text", text: { content: "Executive Overview" } }]
                }
            },
            {
                object: "block",
                type: "callout",
                callout: {
                    rich_text: [{ type: "text", text: { content: `Overall Assessment: ${data.overallAssessment}` } }],
                    icon: { type: "emoji", emoji: "🛡️" }
                }
            },
            {
                object: "block",
                type: "paragraph",
                paragraph: {
                    rich_text: [{ type: "text", text: { content: data.overview } }]
                }
            },
            {
                object: "block",
                type: "heading_2",
                heading_2: {
                    rich_text: [{ type: "text", text: { content: "Database Metrics & Statistics" } }]
                }
            },
            {
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                    rich_text: [{ type: "text", text: { content: `Tables Count: ${data.tableCount}` } }]
                }
            },
            {
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                    rich_text: [{ type: "text", text: { content: `Columns Count: ${data.columnCount}` } }]
                }
            },
            {
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                    rich_text: [{ type: "text", text: { content: `Total Live Rows: ${data.totalRows.toLocaleString()}` } }]
                }
            },
            {
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                    rich_text: [{ type: "text", text: { content: `Database Health Score: ${data.healthScore}%` } }]
                }
            },
            {
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                    rich_text: [{ type: "text", text: { content: `PII Columns Identified: ${data.piiCount}` } }]
                }
            },
            {
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                    rich_text: [{ type: "text", text: { content: `Foreign Key Links: ${data.relationsCount}` } }]
                }
            }
        ];
        
        if (data.keyFindings && data.keyFindings.length > 0) {
            blocks.push({
                object: "block",
                type: "heading_2",
                heading_2: {
                    rich_text: [{ type: "text", text: { content: "Key Findings" } }]
                }
            });
            data.keyFindings.forEach(f => {
                blocks.push({
                    object: "block",
                    type: "bulleted_list_item",
                    bulleted_list_item: {
                        rich_text: [{ type: "text", text: { content: f } }]
                    }
                });
            });
        }
        
        if (data.recommendations && data.recommendations.length > 0) {
            blocks.push({
                object: "block",
                type: "heading_2",
                heading_2: {
                    rich_text: [{ type: "text", text: { content: "Recommendations" } }]
                }
            });
            data.recommendations.forEach(r => {
                blocks.push({
                    object: "block",
                    type: "bulleted_list_item",
                    bulleted_list_item: {
                        rich_text: [{ type: "text", text: { content: r } }]
                    }
                });
            });
        }
        
        if (data.dataGovernance) {
            blocks.push({
                object: "block",
                type: "heading_2",
                heading_2: {
                    rich_text: [{ type: "text", text: { content: "Data Governance & Compliance" } }]
                }
            });
            blocks.push({
                object: "block",
                type: "callout",
                callout: {
                    rich_text: [{ type: "text", text: { content: data.dataGovernance } }],
                    icon: { type: "emoji", emoji: "🔒" }
                }
            });
        }
        
        if (data.qualityIssues && data.qualityIssues.length > 0) {
            blocks.push({
                object: "block",
                type: "heading_2",
                heading_2: {
                    rich_text: [{ type: "text", text: { content: "Data Quality Issues Detected" } }]
                }
            });
            data.qualityIssues.forEach(q => {
                blocks.push({
                    object: "block",
                    type: "callout",
                    callout: {
                        rich_text: [{ type: "text", text: { content: `[${q.severity.toUpperCase()}] Table ${q.table}, Column ${q.column}: ${q.issue} \nSuggestion: ${q.suggestion}` } }],
                        icon: { type: "emoji", emoji: q.severity === "critical" ? "🚨" : "⚠️" }
                    }
                });
            });
        }

        blocks.push(
            {
                object: "block",
                type: "heading_1",
                heading_1: {
                    rich_text: [{ type: "text", text: { content: "System Integration & Architecture" } }]
                }
            },
            {
                object: "block",
                type: "heading_2",
                heading_2: {
                    rich_text: [{ type: "text", text: { content: "Environment Variables Configuration" } }]
                }
            },
            {
                object: "block",
                type: "code",
                code: {
                    rich_text: [{ 
                        type: "text", 
                        text: { 
                            content: `DATABASE_URL="your-database-connection-url"\nPORT=3000\nNODE_ENV=production` 
                        } 
                    }],
                    language: "shell"
                }
            },
            {
                object: "block",
                type: "heading_2",
                heading_2: {
                    rich_text: [{ type: "text", text: { content: "Deployment Instructions" } }]
                }
            },
            {
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                    rich_text: [{ type: "text", text: { content: "Ensure environmental schema migrations are fully verified." } }]
                }
            },
            {
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                    rich_text: [{ type: "text", text: { content: "Execute 'npm run build' to bundle production modules." } }]
                }
            },
            {
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                    rich_text: [{ type: "text", text: { content: "Launch with Node server instance or deploy seamlessly to Vercel." } }]
                }
            }
        );
        
        if (data.tables && data.tables.length > 0) {
            blocks.push({
                object: "block",
                type: "heading_1",
                heading_1: {
                    rich_text: [{ type: "text", text: { content: "Data Dictionary Schematics" } }]
                }
            });
            
            for (const table of data.tables) {
                if (blocks.length >= 80) break;
                blocks.push({
                    object: "block",
                    type: "heading_2",
                    heading_2: {
                        rich_text: [{ type: "text", text: { content: `Table: ${table.tableName}` } }]
                    }
                });
                
                const tableBlocks = parseMarkdownToBlocks(table.content);
                for (const tBlock of tableBlocks) {
                    if (blocks.length >= 95) break;
                    blocks.push(tBlock);
                }
            }
        }
        
        if (blocks.length >= 95) {
            blocks.push({
                object: "block",
                type: "callout",
                callout: {
                    rich_text: [{ type: "text", text: { content: "... [Remaining tables and fields truncated due to Notion API block limits]" } }],
                    icon: { type: "emoji", emoji: "📋" }
                }
            });
        }
        
        const response = await fetch("https://api.notion.com/v1/pages", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                parent: { page_id: parentPageId },
                properties: {
                    title: [
                        {
                            text: { content: `Database Dictionary Manual - ${data.domain}` }
                        }
                    ]
                },
                children: blocks
            }),
            cache: "no-store"
        });
        
        if (!response.ok) {
            const errRes = await response.text();
            throw new Error(`Notion API failure: ${response.status} - ${errRes}`);
        }
        
        const resJson = await response.json();
        return {
            success: true,
            url: resJson.url || `https://notion.so/${resJson.id.replace(/-/g, "")}`,
            isMock: false
        };
    } catch (error: any) {
        console.error("Notion page creation failed:", error);
        return {
            success: false,
            error: error.message || "Failed to create page inside Notion"
        };
    }
}
