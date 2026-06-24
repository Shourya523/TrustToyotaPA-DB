"use client";

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import { getUserConnections, runCustomQuery } from "../../../actions/db";
import { DEFAULT_CONNECTION_ID } from "@/src/lib/database-uri";
import { textToSqlAction, analyzeQueryResultsAction } from "../../../actions/rag";
import { authClient } from "@/src/components/landing/auth";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import {
  Loader2,
  Send,
  Car,
  Users,
  TrendingUp,
  MapPin,
  Sparkles,
  Database,
  Code,
  Table,
  HelpCircle,
  ArrowRight,
  MessageSquare,
  Mic,
  MicOff,
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
  AreaChart,
  Area,
} from "recharts";
import { formatCurrency } from "@/src/lib/showroom-types";

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

const QUICK_PROMPTS = [
  { label: "Mostly Sold Cars", text: "Which car models are mostly sold?", icon: Car },
  { label: "Top Sales Reps", text: "Who sold the most cars and what is their total revenue?", icon: Users },
  { label: "City Revenue", text: "What is the total revenue and count of sales in each city?", icon: MapPin },
  { label: "Revenue Trend", text: "Show our monthly revenue trend.", icon: TrendingUp },
];

export default function ShowroomAssistantPage() {
  const { data: session } = authClient.useSession();
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConn, setSelectedConn] = useState(DEMO_ID);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hello! I am your **Trust Toyota Showroom AI Assistant**. 
Playground Canvas can also help you visually inspect relations, but here you can ask me questions about vehicle sales, employee performance, or customer demographics in plain English, and I will translate it to queries and provide visual insights.
 
*Example questions you can ask:*
- *Which cars were mostly sold?*
- *Who sold the most cars and what is their total revenue?*
- *Show me our monthly revenue trend.*
- *What is the total revenue and count of sales in each city?*
 
Alternatively, feel free to enter direct PostgreSQL \`SELECT\` queries!`,
    },
  ]);
  const [isPending, setIsPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Voice Assistant States and Refs
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const finalTextRef = useRef("");

  // Initialize SpeechRecognition on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
          finalTextRef.current = "";
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          const currentText = finalTranscript || interimTranscript;
          setInput(currentText);
          if (finalTranscript.trim()) {
            finalTextRef.current = finalTranscript.trim();
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
          const textToSubmit = finalTextRef.current.trim();
          if (textToSubmit) {
            handleSendMessage(textToSubmit);
            finalTextRef.current = "";
          }
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!isSupported) return;
    if (isListening) {
      finalTextRef.current = ""; // cancel auto-submit
      recognitionRef.current?.stop();
    } else {
      setInput("");
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Fetch connections on load
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

  // Scroll to bottom of message thread
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (textToSend: string) => {
    const queryText = textToSend.trim();
    if (!queryText) return;

    // 1. Add User Message
    const userMsgId = crypto.randomUUID();
    const userMsg: Message = { id: userMsgId, role: "user", content: queryText };
    setMessages((prev) => [...prev, userMsg]);
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

  // Process initial voice queries if redirected from legacy routes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const voiceQuery = params.get("voice_query");
      if (voiceQuery) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
        handleSendMessage(voiceQuery);
      }
    }
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)] gap-4 overflow-hidden">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-red-500" />
              Showroom AI Assistant
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Interact with the showroom database using conversational AI and dynamic charts.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center bg-secondary/30 border p-1 rounded-xl">
            <Database className="w-3.5 h-3.5 text-muted-foreground ml-2 shrink-0" />
            <select
              className="h-8 w-48 rounded-lg bg-transparent text-xs outline-none pr-2 cursor-pointer font-medium"
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
        </div>

        {/* Message Log Thread */}
        <div className="flex-1 overflow-y-auto px-1 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-3xl rounded-2xl p-4 sm:p-5 shadow-sm border transition-all duration-300 ${
                  msg.role === "user"
                    ? "bg-red-500/10 border-red-500/20 text-foreground ml-12 rounded-tr-sm"
                    : "bg-card/35 backdrop-blur-md border-border/80 mr-12 rounded-tl-sm"
                }`}
              >
                {/* Assistant Icon */}
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-3 text-red-500 text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                    Toyota AI Advisor
                  </div>
                )}

                {/* Loading State */}
                {msg.loading ? (
                  <div className="flex items-center gap-3 py-2 text-xs text-muted-foreground font-medium">
                    <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                    Querying ledger & analyzing data...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Content text */}
                    <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground/90">
                      {msg.content}
                    </div>

                    {/* Error display */}
                    {msg.error && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-500">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-semibold">Query Failure</p>
                          <p className="font-mono text-[10px] break-all leading-normal">{msg.error}</p>
                        </div>
                      </div>
                    )}

                    {/* Chart Visualization */}
                    {msg.chartConfig && msg.data && msg.data.length > 0 && (
                      <div className="mt-4 p-4 border border-border/60 bg-background/50 rounded-xl">
                        <div className="h-[320px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            {msg.chartConfig.recommendedChart === "bar" ? (
                              <BarChart data={msg.data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis
                                  dataKey={msg.chartConfig.labelKey}
                                  tick={{ fontSize: 9 }}
                                  className="fill-muted-foreground"
                                />
                                <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                                <Tooltip
                                  contentStyle={{
                                    fontSize: 10,
                                    background: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: 6,
                                  }}
                                />
                                <Bar
                                  dataKey={msg.chartConfig.valueKey}
                                  fill="hsl(var(--primary))"
                                  radius={[4, 4, 0, 0]}
                                >
                                  {msg.data.map((_, i) => (
                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            ) : msg.chartConfig.recommendedChart === "line" ? (
                              <LineChart data={msg.data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis
                                  dataKey={msg.chartConfig.labelKey}
                                  tick={{ fontSize: 9 }}
                                  className="fill-muted-foreground"
                                />
                                <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                                <Tooltip
                                  contentStyle={{
                                    fontSize: 10,
                                    background: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: 6,
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey={msg.chartConfig.valueKey}
                                  stroke="hsl(var(--primary))"
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                />
                              </LineChart>
                            ) : (
                              <PieChart>
                                <Pie
                                  data={msg.data}
                                  dataKey={msg.chartConfig.valueKey}
                                  nameKey={msg.chartConfig.labelKey}
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={95}
                                  innerRadius={60}
                                  paddingAngle={3}
                                >
                                  {msg.data.map((_, i) => (
                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    fontSize: 10,
                                    background: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: 6,
                                  }}
                                />
                              </PieChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] text-center text-muted-foreground font-medium mt-2">
                          Visualizing {msg.chartConfig.valueKey} grouped by {msg.chartConfig.labelKey}
                        </p>
                      </div>
                    )}

                    {/* SQL details */}
                    {msg.sql && (
                      <details className="text-xs border border-border/60 bg-background/30 rounded-xl p-3 shadow-inner">
                        <summary className="font-semibold cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1.5 outline-none select-none">
                          <Code className="w-3.5 h-3.5" />
                          Show Generated SQL
                        </summary>
                        <pre className="mt-3 text-[10px] font-mono text-emerald-400 bg-background/80 p-3 rounded-lg overflow-x-auto border border-border/40 whitespace-pre-wrap leading-relaxed select-text">
                          {msg.sql}
                        </pre>
                      </details>
                    )}

                    {/* Data table details */}
                    {msg.data && msg.data.length > 0 && (
                      <details className="text-xs border border-border/60 bg-background/30 rounded-xl p-3 shadow-inner">
                        <summary className="font-semibold cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1.5 outline-none select-none">
                          <Table className="w-3.5 h-3.5" />
                          View Result Table ({msg.data.length} rows)
                        </summary>
                        <div className="mt-3 overflow-x-auto rounded-lg border border-border/50 max-h-64 overflow-y-auto">
                          <table className="w-full text-left border-collapse min-w-[320px]">
                            <thead className="bg-muted/80 backdrop-blur text-[8px] uppercase tracking-widest font-bold sticky top-0 border-b">
                              <tr>
                                {Object.keys(msg.data[0] || {}).map((k) => (
                                  <th key={k} className="p-2.5">
                                    {k}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="text-[10px] font-mono text-foreground/80">
                              {msg.data.slice(0, 15).map((row, i) => (
                                <tr key={i} className="hover:bg-accent/40 border-b last:border-0 border-border/40">
                                  {Object.values(row).map((val: any, j) => (
                                    <td key={j} className="p-2.5">
                                      {typeof val === "number" && val > 10000 && j === 0
                                        ? formatCurrency(val)
                                        : String(val ?? "null")}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {msg.data.length > 15 && (
                            <div className="text-[10px] text-center text-muted-foreground bg-muted/40 p-2 border-t">
                              Showing first 15 rows of {msg.data.length} total.
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {messages.length === 1 && (
            <div className="max-w-4xl mx-auto pt-6 pb-8 space-y-6">
              <div className="text-center space-y-2">
                <p className="text-primary text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Quick AI Prompt Board</p>
                <h2 className="text-2xl font-bold tracking-tight">Select a Preset Analysis Task</h2>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Click any of the cards below to instantly run complex analytics and visualize the results.
                </p>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  {
                    title: "Luxury Sales Specialists",
                    description: "Retrieve representatives who sold the most cars in the luxury bracket (>= 50,000).",
                    query: "Who sold the most luxury cars (price >= 50000) and what is their total revenue?",
                    icon: Users,
                  },
                  {
                    title: "Car Stock Warnings",
                    description: "Check which cars have low stock inventory (under 5 units).",
                    query: "Show cars with low quantity in stock under 5 units.",
                    icon: Car,
                  },
                  {
                    title: "Average Transaction by City",
                    description: "Compare average deal size and transaction revenue across Cairo, Alexandria, and Giza.",
                    query: "What is the average transaction price of cars sold in each city?",
                    icon: MapPin,
                  },
                  {
                    title: "Monthly Revenue Outlook",
                    description: "Analyze monthly sales history to support revenue planning and growth projections.",
                    query: "Show our monthly revenue trend.",
                    icon: TrendingUp,
                  },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => handleSendMessage(card.query)}
                      className="text-left p-5 rounded-2xl border transition-all duration-300 hover:scale-[1.01] active:scale-95 flex gap-4 border-border bg-card/25 hover:border-primary/30 group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-background/80 border border-border flex items-center justify-center shrink-0 shadow-sm">
                        <Icon className="w-5 h-5 text-primary transition-transform group-hover:scale-110" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          {card.title}
                          <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                        </h4>
                        <p className="text-xs text-muted-foreground leading-normal">
                          {card.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Input Bar & Actions */}
        <div className="space-y-3 pt-3 border-t border-border/50 bg-background/50 backdrop-blur-lg">
          {/* Quick Prompt Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-bold uppercase mr-1 select-none flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-red-500" /> Quick Ask:
            </span>
            {QUICK_PROMPTS.map((pill) => {
              const Icon = pill.icon;
              return (
                <button
                  key={pill.label}
                  disabled={isPending}
                  onClick={() => handleSendMessage(pill.text)}
                  className="px-3 py-1 rounded-full border border-border/80 bg-card/40 hover:bg-red-500/10 hover:border-red-500/20 text-[10px] sm:text-xs text-muted-foreground hover:text-red-500 transition-all font-medium cursor-pointer flex items-center gap-1.5"
                >
                  <Icon className="w-3 h-3 text-muted-foreground" />
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Form Text Input */}
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-2">
            {isListening && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/5 border border-red-500/10 rounded-lg self-start">
                <div className="flex items-center gap-0.5 h-3">
                  {[0.4, 0.8, 0.5, 0.9, 0.4].map((delay, idx) => (
                    <div
                      key={idx}
                      className="w-0.5 bg-red-500 rounded-full animate-pulse"
                      style={{
                        height: "100%",
                        animationDuration: `${delay}s`,
                        animationDelay: `${idx * 0.05}s`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider">Listening to your voice...</span>
              </div>
            )}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isPending}
                  placeholder={isListening ? "Listening..." : "Ask a question in plain English or write direct SQL..."}
                  className={`w-full h-12 rounded-xl border border-input bg-card/30 pl-4 pr-12 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-red-500/50 transition-all ${
                    isListening ? "border-red-500/50 bg-red-500/5 placeholder:text-red-500/60 font-medium italic" : ""
                  }`}
                />
                {isSupported && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
                      isListening
                        ? "text-red-500 hover:bg-red-500/10 animate-pulse"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                    title="Voice Search"
                  >
                    {isListening ? (
                      <div className="relative flex items-center justify-center">
                        <MicOff className="w-4 h-4 text-red-500" />
                        <span className="absolute -inset-1 rounded-full border border-red-500/30 animate-ping" />
                      </div>
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              <Button
                type="submit"
                disabled={isPending || !input.trim()}
                className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 bg-red-600 hover:bg-red-700 text-white border-none"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Simple Helper component used for inline error styling
function AlertCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12" y1="16" y2="16.01" />
    </svg>
  );
}