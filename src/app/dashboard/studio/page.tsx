"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import { getUserConnections, runCustomQuery } from "../../../actions/db";
import { textToSqlAction } from "../../../actions/rag";
import {
  listSavedQueries,
  saveQuery,
  updateSavedQuery,
  deleteSavedQuery,
  type SavedQuery,
} from "../../../actions/savedQueries";
import {
  loadLocalQueries,
  addLocalQuery,
  updateLocalQuery,
  deleteLocalQuery,
} from "@/src/lib/savedQueriesLocal";
import { authClient } from "@/src/components/landing/auth";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Input } from "../../../components/ui/input";
import {
  Loader2,
  Sparkles,
  Play,
  Table2,
  BarChart3,
  Shield,
  MessageSquareText,
  History,
  Star,
  Trash2,
  Save,
  Tag,
  RotateCcw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { DEFAULT_CONNECTION_ID } from "@/src/lib/database-uri";

const DEMO_ID = DEFAULT_CONNECTION_ID;
const EXAMPLE_QUERIES = [
  "Show me the top 5 customers by order volume last month.",
  "What are the total sales per product category?",
  "List orders with their payment type and delivery status.",
];

export default function TextToSqlStudioPage() {
  const { data: session } = authClient.useSession();
  const userKey = session?.user?.id ?? "guest";

  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConn, setSelectedConn] = useState(DEMO_ID);
  const [naturalQuery, setNaturalQuery] = useState("");
  const [sqlText, setSqlText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"all" | "favorites">("all");
  const [tagFilter, setTagFilter] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveTags, setSaveTags] = useState("");

  const loadQueries = useCallback(async () => {
    if (session?.user?.id) {
      const res = await listSavedQueries(session.user.id, selectedConn);
      if (res.success && res.data) {
        setSavedQueries(res.data);
        return;
      }
    }
    setSavedQueries(loadLocalQueries(userKey, selectedConn));
  }, [session?.user?.id, selectedConn, userKey]);

  useEffect(() => {
    const fetchConns = async () => {
      let userConns: any[] = [];
      if (session?.user?.id) {
        const res = await getUserConnections(session.user.id);
        if (res.success) userConns = res.data || [];
      }
      setConnections([{ id: DEMO_ID, name: "Car Showroom Database" }, ...userConns]);
    };
    fetchConns();
  }, [session]);

  useEffect(() => {
    loadQueries();
  }, [loadQueries]);

  const generateSql = async () => {
    if (!naturalQuery.trim()) return;
    setIsGenerating(true);
    setError(null);
    setResults([]);

    const res = await textToSqlAction(naturalQuery, selectedConn);
    if (res.success && res.data) {
      setSqlText(res.data.sql);
      setExplanation(res.data.explanation);
      await runQuery(res.data.sql);
    } else {
      setError(res.error || "Failed to generate SQL.");
    }
    setIsGenerating(false);
  };

  const runQuery = async (sql?: string) => {
    const trimmedSql = (sql ?? sqlText).trim();
    if (!trimmedSql) return;

    const readOnlyRegex = /^\s*(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN)\b/i;
    if (!readOnlyRegex.test(trimmedSql)) {
      setError("Security Policy: Only read-only queries (SELECT, WITH, SHOW, DESCRIBE, EXPLAIN) are permitted.");
      return;
    }

    setIsRunning(true);
    setError(null);
    setResults([]);

    const dbRes = await runCustomQuery(selectedConn, session?.user?.id, trimmedSql);
    if (dbRes.success) {
      const data = (dbRes.data as any[]) || [];
      setResults(data);
      if (data.length === 0) setError("Query successful, but no rows were returned.");
    } else {
      setError(dbRes.error || "An error occurred.");
    }
    setIsRunning(false);
  };

  const handleSaveQuery = async () => {
    if (!sqlText.trim()) return;
    const title = saveTitle.trim() || naturalQuery.slice(0, 50) || "Untitled query";
    const tags = saveTags.split(",").map((t) => t.trim()).filter(Boolean);

    if (session?.user?.id) {
      const res = await saveQuery(session.user.id, {
        connectionId: selectedConn,
        title,
        sql: sqlText,
        naturalLanguage: naturalQuery || undefined,
        tags,
      });
      if (res.success) {
        await loadQueries();
        setShowSaveDialog(false);
        setSaveTitle("");
        setSaveTags("");
        return;
      }
    }

    addLocalQuery(userKey, selectedConn, {
      connectionId: selectedConn,
      title,
      sql: sqlText,
      naturalLanguage: naturalQuery || null,
      tags,
      isFavorite: false,
    });
    await loadQueries();
    setShowSaveDialog(false);
    setSaveTitle("");
    setSaveTags("");
  };

  const toggleFavorite = async (query: SavedQuery) => {
    if (session?.user?.id) {
      await updateSavedQuery(session.user.id, query.id, { isFavorite: !query.isFavorite });
    } else {
      updateLocalQuery(userKey, selectedConn, query.id, { isFavorite: !query.isFavorite });
    }
    await loadQueries();
  };

  const handleDeleteQuery = async (id: string) => {
    if (session?.user?.id) {
      await deleteSavedQuery(session.user.id, id);
    } else {
      deleteLocalQuery(userKey, selectedConn, id);
    }
    await loadQueries();
  };

  const loadSavedQuery = (query: SavedQuery) => {
    setSqlText(query.sql);
    setNaturalQuery(query.naturalLanguage ?? "");
    setExplanation("");
    setResults([]);
    setError(null);
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    savedQueries.forEach((q) => q.tags.forEach((t) => tags.add(t)));
    return Array.from(tags);
  }, [savedQueries]);

  const filteredQueries = useMemo(() => {
    return savedQueries.filter((q) => {
      if (historyFilter === "favorites" && !q.isFavorite) return false;
      if (tagFilter && !q.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [savedQueries, historyFilter, tagFilter]);

  const chartData = useMemo(() => {
    if (results.length === 0) return null;
    const keys = Object.keys(results[0]);
    const labelKey = keys.find((k) => typeof results[0][k] === "string") || keys[0];
    const valueKey = keys.find((k) => {
      const val = results[0][k];
      return typeof val === "number" || (!isNaN(Number(val)) && val !== null && val !== "");
    });
    if (!valueKey) return null;

    return results.slice(0, 15).map((row, i) => ({
      name: String(row[labelKey] ?? `Row ${i + 1}`).slice(0, 20),
      value: Number(row[valueKey]) || 0,
    }));
  }, [results]);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)] gap-4 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              Query
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Natural Language</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Describe what you need in plain English — generate SQL, save queries, and re-run anytime.
            </p>
          </div>

          <select
            className="h-10 w-64 rounded-md border border-input bg-background px-3 text-sm outline-none"
            value={selectedConn}
            onChange={(e) => setSelectedConn(e.target.value)}
          >
            {connections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-4 min-h-0 overflow-hidden">
          {/* Query History Panel */}
          <Card className="flex flex-col overflow-hidden border-primary/20 order-3 xl:order-1 max-h-64 xl:max-h-none">
            <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3 h-3" /> My Queries
              </span>
              <span className="text-[10px] text-muted-foreground">{filteredQueries.length}</span>
            </div>

            <div className="px-3 py-2 border-b flex gap-1.5 shrink-0">
              <button
                onClick={() => setHistoryFilter("all")}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  historyFilter === "all" ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setHistoryFilter("favorites")}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 ${
                  historyFilter === "favorites" ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground"
                }`}
              >
                <Star className="w-2.5 h-2.5" /> Favorites
              </button>
            </div>

            {allTags.length > 0 && (
              <div className="px-3 py-2 border-b flex flex-wrap gap-1 shrink-0">
                <button
                  onClick={() => setTagFilter("")}
                  className={`text-[9px] px-1.5 py-0.5 rounded border ${!tagFilter ? "bg-muted text-foreground" : "text-muted-foreground border-border"}`}
                >
                  all tags
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                    className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                      tagFilter === tag ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border"
                    }`}
                  >
                    <Tag className="w-2 h-2" />{tag}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredQueries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground opacity-50">
                  <History className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-xs">No saved queries yet</p>
                </div>
              ) : (
                filteredQueries.map((q) => (
                  <div
                    key={q.id}
                    className="group p-2.5 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer"
                    onClick={() => loadSavedQuery(q)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-semibold truncate flex-1">{q.title}</p>
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(q); }}
                          className="p-0.5 hover:text-amber-500"
                        >
                          <Star className={`w-3 h-3 ${q.isFavorite ? "fill-amber-500 text-amber-500" : ""}`} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); runQuery(q.sql); setSqlText(q.sql); }}
                          className="p-0.5 hover:text-primary"
                          title="Re-run"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteQuery(q.id); }}
                          className="p-0.5 hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">{q.sql}</p>
                    {q.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {q.tags.map((t) => (
                          <span key={t} className="text-[8px] px-1 py-0.5 rounded bg-primary/10 text-primary">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          <div className="flex flex-col gap-4 overflow-hidden order-1 xl:order-2 h-full min-h-0">
            <Card className="p-4 space-y-3 border-primary/20 shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquareText className="w-4 h-4 text-primary" />
                Ask in natural language
              </div>
              <textarea
                value={naturalQuery}
                onChange={(e) => setNaturalQuery(e.target.value)}
                placeholder='e.g. "Show me the top 5 customers by order volume last month."'
                className="w-full h-20 p-3 rounded-lg border border-input bg-background text-sm outline-none resize-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => setNaturalQuery(q)}
                    className="text-[10px] px-2 py-1 rounded-full border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {q.slice(0, 40)}…
                  </button>
                ))}
              </div>
              <Button onClick={generateSql} disabled={isGenerating || isRunning || !naturalQuery.trim()} className="w-full">
                {(isGenerating || isRunning) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Send
              </Button>
              {explanation && (
                <div className="text-xs text-muted-foreground mt-2 p-2 bg-primary/5 rounded-md">
                  <span className="font-semibold text-primary">AI Explanation:</span> {explanation}
                </div>
              )}
            </Card>

            {/* Results */}
            <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
              <Tabs defaultValue="table" className="flex flex-col h-full">
              <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between shrink-0">
                <TabsList className="h-8">
                  <TabsTrigger value="table" className="text-xs gap-1">
                    <Table2 className="w-3 h-3" /> Table
                  </TabsTrigger>
                  <TabsTrigger value="chart" className="text-xs gap-1" disabled={!chartData}>
                    <BarChart3 className="w-3 h-3" /> Chart
                  </TabsTrigger>
                </TabsList>
                {results.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{results.length} rows</span>
                )}
              </div>

              {error && (
                <div className="px-4 py-2 text-xs text-destructive bg-destructive/10 border-b shrink-0">{error}</div>
              )}

              <TabsContent value="table" className="flex-1 overflow-auto m-0 p-0 min-h-0">
                {results.length > 0 ? (
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead className="sticky top-0 bg-muted/90 backdrop-blur-md">
                      <tr>
                        {Object.keys(results[0]).map((key) => (
                          <th key={key} className="p-3 text-[10px] font-bold uppercase border-b text-muted-foreground">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((row, i) => (
                        <tr key={i} className="hover:bg-primary/5 border-b border-border/5">
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="p-3 text-[11px] font-mono">{val?.toString() ?? "null"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-40 p-8 text-center">
                    <Table2 className="w-12 h-12 mb-3" />
                    <p className="text-sm">Generate or load a query, then run it</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="chart" className="flex-1 m-0 p-4 min-h-0">
                {chartData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    Run a query with numeric results to see a chart
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
