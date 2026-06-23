"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Sparkles,
  Database,
  Code,
  Table,
  HelpCircle,
  AlertCircle,
  Car,
  Users,
  MapPin,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency } from "@/src/lib/showroom-types";
import { runCustomQuery, getUserConnections } from "@/src/actions/db";
import { textToSqlAction, analyzeQueryResultsAction } from "@/src/actions/rag";
import { authClient } from "@/src/components/landing/auth";
import { DEFAULT_CONNECTION_ID } from "@/src/lib/database-uri";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  data?: any[];
  chartConfig?: {
    insight: string;
    recommendedChart: "bar" | "pie" | "line";
    labelKey: string;
    valueKey: string;
  };
  error?: string;
  loading?: boolean;
};

const DEMO_ID = DEFAULT_CONNECTION_ID;
const CHART_COLORS = ["hsl(0 72% 51%)", "hsl(25 95% 53%)", "hsl(45 93% 47%)", "hsl(145 63% 42%)", "hsl(200 75% 45%)"];

const PRESET_DRAWER_PROMPTS = [
  { label: "Mostly Sold Cars", text: "Which car models are mostly sold?", icon: Car },
  { label: "Top Reps", text: "Who sold the most cars and what is their total revenue?", icon: Users },
  { label: "Branches", text: "List all active showrooms and their locations.", icon: MapPin },
];

export default function GlobalAIChatDrawer() {
  const { data: session } = authClient.useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConn, setSelectedConn] = useState(DEMO_ID);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-drawer",
      role: "assistant",
      content: "Hello! I am your global **Trust Toyota AI Drawer** assistant. Ask me anything about showrooms, cars sold, or rep commissions!",
    },
  ]);
  const [isPending, setIsPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch database connections
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

  // Scroll thread to bottom
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend: string) => {
    const queryText = textToSend.trim();
    if (!queryText) return;

    // 1. Add User Message
    const userMsgId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", content: queryText }]);
    setInput("");
    setIsPending(true);

    // 2. Add Assistant Loading Placeholder
    const assistantMsgId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: "", loading: true }]);

    try {
      let sqlToExecute = "";
      let explanation = "";

      const readOnlyRegex = /^\s*(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN)\b/i;
      const isDirectSql = readOnlyRegex.test(queryText);

      if (isDirectSql) {
        sqlToExecute = queryText;
        explanation = "Running your custom SQL query directly...";
      } else {
        // Translate Natural Language to SQL
        const translationRes = await textToSqlAction(queryText, selectedConn);
        if (translationRes.success && translationRes.data) {
          sqlToExecute = translationRes.data.sql;
          explanation = translationRes.data.explanation;
        } else {
          throw new Error(translationRes.error || "Failed to translate natural language question to SQL query.");
        }
      }

      // Execute SQL Query
      const queryRes = await runCustomQuery(selectedConn, session?.user?.id, sqlToExecute);
      if (!queryRes.success) {
        throw new Error(queryRes.error || "SQL execution failed.");
      }

      const rawRows = (queryRes.data as any[]) || [];
      if (rawRows.length === 0) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: `${explanation}\n\nQuery completed successfully, but returned 0 rows.`,
                  sql: sqlToExecute,
                  data: [],
                  loading: false,
                }
              : msg
          )
        );
        setIsPending(false);
        return;
      }

      // Run AI Insights & Chart Recommendations on the data
      let chartConfig: Message["chartConfig"] = undefined;
      const analysisRes = await analyzeQueryResultsAction(queryText, sqlToExecute, rawRows);
      if (analysisRes.success && analysisRes.data) {
        chartConfig = {
          insight: analysisRes.data.insight,
          recommendedChart: analysisRes.data.recommendedChart as any,
          labelKey: analysisRes.data.labelKey,
          valueKey: analysisRes.data.valueKey,
        };
      }

      // Update Assistant Message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: chartConfig?.insight || explanation,
                sql: sqlToExecute,
                data: rawRows,
                chartConfig,
                loading: false,
              }
            : msg
        )
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: "I encountered an error trying to process that request.",
                error: err.message || "An unexpected error occurred.",
                loading: false,
              }
            : msg
        )
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-24 z-50 p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center border border-red-500/20"
        title="Open Showroom AI Assistant Drawer"
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </button>

      {/* Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-card border-l border-border shadow-2xl flex flex-col h-full overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-border/80 flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-red-500 animate-pulse" />
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Toyota AI Drawer</h2>
                    <p className="text-[10px] text-muted-foreground">Quick access showroom queries</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-secondary/50 border p-1 rounded-lg">
                    <Database className="w-3 h-3 text-muted-foreground ml-1" />
                    <select
                      className="bg-transparent text-[10px] outline-none pr-1 cursor-pointer font-medium max-w-[120px] truncate"
                      value={selectedConn}
                      onChange={(e) => setSelectedConn(e.target.value)}
                    >
                      {connections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-full hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 shadow-sm border transition-all duration-300 ${
                        msg.role === "user"
                          ? "bg-red-500/10 border-red-500/20 text-foreground rounded-tr-sm"
                          : "bg-card/90 border-border/80 rounded-tl-sm"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1.5 mb-2 text-red-500 text-[10px] font-bold uppercase tracking-wider">
                          <Sparkles className="w-3 h-3 text-red-500" />
                          AI Advisor
                        </div>
                      )}
                      
                      {msg.loading ? (
                        <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground font-medium">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                          Querying database...
                        </div>
                      ) : (
                        <div className="space-y-3.5">
                          <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans text-foreground/90">
                            {msg.content}
                          </div>

                          {msg.error && (
                            <div className="flex items-start gap-2 p-2.5 rounded-lg border border-red-500/20 bg-red-500/5 text-[10px] text-red-500">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <p className="font-semibold">Query Failure</p>
                                <p className="font-mono text-[9px] break-all leading-normal">{msg.error}</p>
                              </div>
                            </div>
                          )}

                          {/* Chart in Drawer */}
                          {msg.chartConfig && msg.data && msg.data.length > 0 && (
                            <div className="p-3 border border-border/60 bg-background/50 rounded-lg">
                              <div className="h-[260px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  {msg.chartConfig.recommendedChart === "bar" ? (
                                    <BarChart data={msg.data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                      <XAxis dataKey={msg.chartConfig.labelKey} tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                                      <YAxis tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                                      <Tooltip contentStyle={{ fontSize: 9, background: "hsl(var(--card))" }} />
                                      <Bar dataKey={msg.chartConfig.valueKey} fill="hsl(var(--primary))">
                                        {msg.data.map((_, i) => (
                                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  ) : msg.chartConfig.recommendedChart === "line" ? (
                                    <LineChart data={msg.data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                      <XAxis dataKey={msg.chartConfig.labelKey} tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                                      <YAxis tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                                      <Tooltip contentStyle={{ fontSize: 9, background: "hsl(var(--card))" }} />
                                      <Line type="monotone" dataKey={msg.chartConfig.valueKey} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
                                    </LineChart>
                                  ) : (
                                    <PieChart>
                                      <Pie
                                        data={msg.data}
                                        dataKey={msg.chartConfig.valueKey}
                                        nameKey={msg.chartConfig.labelKey}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        innerRadius={50}
                                        paddingAngle={2}
                                      >
                                        {msg.data.map((_, i) => (
                                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                      </Pie>
                                      <Tooltip contentStyle={{ fontSize: 9, background: "hsl(var(--card))" }} />
                                    </PieChart>
                                  )}
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}

                          {msg.sql && (
                            <details className="text-[10px] border border-border/50 bg-background/20 rounded-lg p-2">
                              <summary className="font-semibold cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                                <Code className="w-3 h-3" />
                                Show SQL
                              </summary>
                              <pre className="mt-2 text-[9px] font-mono text-emerald-400 bg-background/80 p-2 rounded overflow-x-auto whitespace-pre-wrap leading-relaxed select-text">
                                {msg.sql}
                              </pre>
                            </details>
                          )}

                          {msg.data && msg.data.length > 0 && (
                            <details className="text-[10px] border border-border/50 bg-background/20 rounded-lg p-2">
                              <summary className="font-semibold cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                                <Table className="w-3 h-3" />
                                View Table ({msg.data.length} rows)
                              </summary>
                              <div className="mt-2 overflow-x-auto rounded border border-border/40 max-h-48 overflow-y-auto">
                                <table className="w-full text-left border-collapse min-w-[200px]">
                                  <thead className="bg-muted text-[7px] uppercase tracking-wider font-bold sticky top-0 border-b">
                                    <tr>
                                      {Object.keys(msg.data[0] || {}).map((k) => (
                                        <th key={k} className="p-1.5">{k}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="text-[9px] font-mono text-foreground/80">
                                    {msg.data.slice(0, 10).map((row, idx) => (
                                      <tr key={idx} className="border-b last:border-0 border-border/30 hover:bg-accent/20">
                                        {Object.values(row).map((val: any, jdx) => (
                                          <td key={jdx} className="p-1.5">{String(val ?? "null")}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>

              {/* Chat Input & Presets */}
              <div className="p-4 border-t border-border/80 bg-background/50 backdrop-blur space-y-3">
                {/* Drawer Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] text-muted-foreground font-semibold flex items-center gap-0.5">
                    <HelpCircle className="w-2.5 h-2.5 text-red-500" /> Ask:
                  </span>
                  {PRESET_DRAWER_PROMPTS.map((pill) => {
                    const Icon = pill.icon;
                    return (
                      <button
                        key={pill.label}
                        disabled={isPending}
                        onClick={() => handleSendMessage(pill.text)}
                        className="px-2 py-0.5 rounded-full border border-border bg-card hover:bg-red-500/10 hover:border-red-500/20 text-[9px] text-muted-foreground hover:text-red-500 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Icon className="w-2.5 h-2.5" />
                        {pill.label}
                      </button>
                    );
                  })}
                </div>

                <form onSubmit={handleFormSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isPending}
                    placeholder="Ask a showroom database question..."
                    className="flex-1 h-10 rounded-lg border border-input bg-card/40 px-3 text-xs outline-none focus:border-red-500/50"
                  />
                  <button
                    type="submit"
                    disabled={isPending || !input.trim()}
                    className="h-10 w-10 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shrink-0 border-none transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
