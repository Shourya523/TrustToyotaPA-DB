"use client";

import { useEffect, useState } from "react";
import { Loader2, FileText, LayoutTemplate, Database, TrendingUp, Compass, Shield, Lock, Link, AlertTriangle, CheckCircle2, Activity, FileDown, BookOpen, Download, Sparkles, ExternalLink } from "lucide-react";
// @ts-ignore
import ReactMarkdown from "react-markdown";
// @ts-ignore
import remarkGfm from "remark-gfm";
import { getSchemaDocumentation } from "@/src/actions/db";
import { getOrGenerateBusinessReport } from "@/src/actions/rag";
import { Button } from "@/src/components/ui/button";
import NextLink from "next/link";

export function DocumentationTab({ connectionId, userId }: { connectionId: string, userId: string }) {
    const [docs, setDocs] = useState<{ tableName: string, content: string }[]>([]);
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const [docsRes, reportRes] = await Promise.all([
                    getSchemaDocumentation(connectionId, userId),
                    getOrGenerateBusinessReport(connectionId, userId)
                ]);
                if (docsRes.success && docsRes.data) {
                    setDocs(docsRes.data as { tableName: string, content: string }[]);
                } else {
                    setError(docsRes.error || "Failed to load documentation.");
                }
                if (reportRes.success && reportRes.data) {
                    setReport(reportRes.data);
                }
            } catch (err: any) {
                setError(err.message || "An unexpected error occurred.");
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [connectionId, userId]);

    const downloadDictJson = () => {
        const blob = new Blob([JSON.stringify(docs.filter(d => d.tableName !== "__business_report__"), null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `data_dictionary_${connectionId.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadDictMd = () => {
        const mdContent = docs.filter(d => d.tableName !== "__business_report__").map(doc => `# ${doc.tableName}\n\n${doc.content}`).join("\n\n---\n\n");
        const blob = new Blob([mdContent], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `data_dictionary_${connectionId.slice(0, 8)}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadFullReportMd = () => {
        if (!report) return;
        let md = `# Business Report - ${report.domain}\n\n`;
        md += `Run: ${connectionId.slice(0, 8)}\n\n`;
        md += `## Executive Overview\n${report.overview}\n\n`;
        md += `### Key Findings\n` + report.keyFindings.map((f: string) => `- ${f}`).join("\n") + "\n\n";
        md += `### Recommendations\n` + report.recommendations.map((r: string) => `- ${r}`).join("\n") + "\n\n";
        md += `## Data Governance\n${report.dataGovernance}\n\n`;
        md += `## Overall Assessment\n${report.overallAssessment}\n\n`;
        md += `## Database Statistics\n`;
        md += `- Tables: ${report.tableCount}\n`;
        md += `- Columns: ${report.columnCount}\n`;
        md += `- Rows: ${report.totalRows?.toLocaleString() || 0}\n`;
        md += `- Database Health: ${report.healthScore}%\n`;
        md += `- PII Columns: ${report.piiCount}\n`;
        md += `- Foreign Key Links: ${report.relationsCount}\n\n`;
        md += `## Data Quality Issues\n`;
        md += report.qualityIssues.map((q: any) => `### [${q.severity.toUpperCase()}] ${q.table}.${q.column}\n- **Issue:** ${q.issue}\n- **Suggestion:** ${q.suggestion}`).join("\n\n") + "\n\n";
        md += `\n---\n\n# Data Dictionary (Tables Detail)\n\n`;
        md += docs.filter(d => d.tableName !== "__business_report__").map(doc => `# ${doc.tableName}\n\n${doc.content}`).join("\n\n---\n\n");
        const blob = new Blob([md], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `business_report_${connectionId.slice(0, 8)}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadFullReportJson = () => {
        if (!report) return;
        const fullJson = {
            report,
            dictionary: docs.filter(d => d.tableName !== "__business_report__")
        };
        const blob = new Blob([JSON.stringify(fullJson, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `business_report_${connectionId.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 bg-card border border-dashed rounded-xl mt-6">
                <Loader2 className="w-10 h-10 animate-spin text-primary/50 mb-4" />
                <p className="text-sm font-medium animate-pulse uppercase tracking-widest text-muted-foreground">Retrieving AI Schematics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-destructive/5 border border-destructive/20 rounded-xl mt-6 text-destructive">
                <FileText className="w-10 h-10 mb-4 opacity-50" />
                <p className="font-semibold">{error}</p>
                <p className="text-sm opacity-80 mt-2">Ensure the AI Sync has been run for this database.</p>
            </div>
        );
    }

    if (docs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-32 bg-card border border-dashed rounded-xl mt-6">
                <LayoutTemplate className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-bold mb-1">No Documentation Found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                    It looks like the AI has not generated knowledge schemas for this database yet. Click <strong className="text-primary font-mono">SYNC AI</strong> above to generate docs.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 mt-6 pb-20 font-sans">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Business Report</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        AI-enhanced data dictionary & quality assessment — Run <span className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded">{connectionId.slice(0, 8)}</span>
                    </p>
                </div>
                <div className="flex flex-wrap gap-2.5 items-center">
                    <NextLink href={`/dashboard/tables/${connectionId}/document`} target="_blank" passHref>
                        <Button variant="default" size="sm" className="h-8 gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
                            <ExternalLink className="w-3.5 h-3.5" /> Full-Screen Docs
                        </Button>
                    </NextLink>
                    <Button variant="outline" size="sm" onClick={downloadDictJson} className="h-8 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                        <Download className="w-3.5 h-3.5" /> Dict JSON
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadDictMd} className="h-8 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                        <Download className="w-3.5 h-3.5" /> Dict MD
                    </Button>
                    <Button size="sm" onClick={downloadFullReportMd} className="h-8 gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                        <FileDown className="w-3.5 h-3.5" /> Full Report MD
                    </Button>
                    <Button size="sm" onClick={downloadFullReportJson} className="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                        <FileDown className="w-3.5 h-3.5" /> Full Report JSON
                    </Button>
                </div>
            </div>

            {report && (
                <div className="border border-border bg-card/40 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden transition-all duration-300 hover:border-border/80">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold tracking-tight text-card-foreground">Executive Overview</h2>
                        </div>
                        <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider font-mono self-start sm:self-auto">
                            {report.domain}
                        </span>
                    </div>

                    <p className="text-sm sm:text-base leading-relaxed text-muted-foreground mb-8">
                        {report.overview}
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Key Findings</h3>
                            </div>
                            <ul className="space-y-3 text-sm text-muted-foreground">
                                {report.keyFindings?.map((finding: string, i: number) => (
                                    <li key={i} className="flex gap-2 leading-relaxed">
                                        <span className="text-primary font-bold">→</span>
                                        <span>{finding}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                                <Sparkles className="w-4 h-4 text-blue-400" />
                                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Recommendations</h3>
                            </div>
                            <ul className="space-y-3 text-sm text-muted-foreground">
                                {report.recommendations?.map((rec: string, i: number) => (
                                    <li key={i} className="flex gap-2 leading-relaxed">
                                        <span className="text-emerald-500 font-bold">✓</span>
                                        <span>{rec}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {report.dataGovernance && (
                        <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500/90 text-sm leading-relaxed flex gap-3">
                            <Lock className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold uppercase text-[10px] tracking-wider block mb-1">Data Governance</span>
                                {report.dataGovernance}
                            </div>
                        </div>
                    )}

                    <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-primary text-sm font-medium leading-relaxed">
                        <span className="font-bold text-foreground">Overall Assessment:</span> {report.overallAssessment}
                    </div>
                </div>
            )}

            {report && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-sm hover:border-border/80 transition-all">
                        <div className="p-2.5 bg-blue-500/10 rounded-lg text-blue-500">
                            <LayoutTemplate className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[20px] font-black tracking-tight leading-none mb-1">{report.tableCount}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Tables</p>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-sm hover:border-border/80 transition-all">
                        <div className="p-2.5 bg-purple-500/10 rounded-lg text-purple-500">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[20px] font-black tracking-tight leading-none mb-1">{report.columnCount}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Columns</p>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-sm hover:border-border/80 transition-all">
                        <div className="p-2.5 bg-cyan-500/10 rounded-lg text-cyan-500">
                            <Database className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[20px] font-black tracking-tight leading-none mb-1">
                                {report.totalRows?.toLocaleString() || 0}
                            </p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Rows</p>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-sm hover:border-border/80 transition-all">
                        <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-500">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[20px] font-black tracking-tight leading-none mb-1">{report.healthScore}%</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Health</p>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-sm hover:border-border/80 transition-all">
                        <div className="p-2.5 bg-yellow-500/10 rounded-lg text-yellow-500">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[20px] font-black tracking-tight leading-none mb-1">{report.piiCount}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">PII Cols</p>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-sm hover:border-border/80 transition-all">
                        <div className="p-2.5 bg-indigo-500/10 rounded-lg text-indigo-500">
                            <Link className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[20px] font-black tracking-tight leading-none mb-1">{report.relationsCount}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">FK Links</p>
                        </div>
                    </div>
                </div>
            )}

            {report?.qualityIssues && report.qualityIssues.length > 0 && (
                <div className="border border-border bg-card/20 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            <h2 className="text-base font-bold tracking-tight text-foreground">Data Quality Issues</h2>
                        </div>
                        <div className="flex gap-2">
                            {report.qualityIssues.filter((q: any) => q.severity === "critical").length > 0 && (
                                <span className="text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full">
                                    {report.qualityIssues.filter((q: any) => q.severity === "critical").length} Critical
                                </span>
                            )}
                            {report.qualityIssues.filter((q: any) => q.severity === "warning").length > 0 && (
                                <span className="text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                    {report.qualityIssues.filter((q: any) => q.severity === "warning").length} Warnings
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                        {report.qualityIssues.map((issue: any, i: number) => (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 rounded-xl bg-card border border-border/45 hover:border-border transition-colors">
                                <span className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded uppercase self-start sm:mt-0.5 ${
                                    issue.severity === "critical" 
                                        ? "bg-destructive/10 text-destructive border border-destructive/20" 
                                        : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                }`}>
                                    {issue.severity}
                                </span>
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-foreground leading-none">
                                        <span className="font-mono text-primary text-xs bg-primary/5 px-1 rounded mr-1.5">{issue.table}</span>
                                        — Column <span className="font-mono font-medium">{issue.column}</span> {issue.issue.replace(/^(column|Column)\s+'?\w+'?\s+has\s+/, "has ")}
                                    </p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {issue.suggestion}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="border-t border-border/40 pt-8 mt-4">
                <div className="flex items-center gap-2.5 mb-6">
                    <Database className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold tracking-tight text-foreground">Data Dictionary Details</h2>
                </div>

                {docs.filter(doc => doc.tableName !== "__business_report__").map((doc, idx) => (
                    <div key={idx} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-8 last:mb-0">
                        <div className="flex items-center gap-3 px-6 py-4 bg-muted/20 border-b border-border">
                            <Database className="w-5 h-5 text-primary" />
                            <h2 className="font-semibold text-lg text-card-foreground tracking-tight">{doc.tableName}</h2>
                        </div>
                        <div className="p-6 sm:p-8">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: ({ node, ...props }) => <h1 className="text-2xl font-black tracking-tight mb-6 mt-2 text-foreground border-l-4 border-primary pl-4" {...props} />,
                                    h2: ({ node, ...props }) => <h2 className="text-lg font-bold tracking-tight first:mt-0 mt-10 mb-4 pb-2 border-b border-border/60 text-foreground/90 uppercase" {...props} />,
                                    h3: ({ node, ...props }) => <h3 className="text-sm font-bold tracking-tight mt-8 mb-3 text-primary uppercase font-mono tracking-wider" {...props} />,
                                    p: ({ node, ...props }) => <p className="leading-relaxed text-sm text-muted-foreground/95 mb-5 max-w-none font-sans" {...props} />,
                                    ul: ({ node, ...props }) => <ul className="my-4 ml-6 list-disc [&>li]:mt-2 text-sm text-muted-foreground/90" {...props} />,
                                    li: ({ node, ...props }) => <li className="leading-relaxed hover:text-foreground transition-colors duration-150" {...props} />,
                                    code: ({ node, ...props }) => <code className="relative rounded bg-muted/65 px-2 py-0.5 font-mono text-xs text-primary font-semibold border border-primary/10" {...props} />,
                                    table: ({ node, ...props }) => (
                                        <div className="my-6 w-full overflow-x-auto rounded-xl border border-border bg-card/15 shadow-sm">
                                            <table className="w-full text-xs sm:text-sm text-left border-collapse" {...props} />
                                        </div>
                                    ),
                                    thead: ({ node, ...props }) => <thead className="bg-muted/30 text-muted-foreground text-[10px] font-bold tracking-wider uppercase border-b border-border" {...props} />,
                                    th: ({ node, ...props }) => <th className="px-6 py-3.5 font-bold text-foreground/90" {...props} />,
                                    tbody: ({ node, ...props }) => <tbody className="divide-y divide-border/25" {...props} />,
                                    tr: ({ node, ...props }) => <tr className="hover:bg-muted/10 transition-colors duration-150" {...props} />,
                                    td: ({ node, ...props }) => <td className="px-6 py-3.5 text-muted-foreground/90 align-middle border-t border-border/25" {...props} />,
                                    strong: ({ node, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
                                }}
                            >
                                {doc.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
