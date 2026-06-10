"use client";

import React, { useEffect, useState, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { 
  Bot, 
  User, 
  Loader2, 
  Send, 
  Trash2, 
  Play, 
  Code, 
  Terminal, 
  ArrowRight, 
  Check, 
  ExternalLink, 
  AlertCircle,
  Database,
  Sparkles,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { toast } from "sonner";
// @ts-ignore
import ReactMarkdown from "react-markdown";
// @ts-ignore
import remarkGfm from "remark-gfm";

interface Endpoint {
  slug: string;
  url: string;
  code: string;
  updatedAt: string;
}

export function AgentTab({ connectionId }: { connectionId: string }) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loadingEndpoints, setLoadingEndpoints] = useState(false);
  const [testingSlug, setTestingSlug] = useState<string | null>(null);
  const [testQueryParams, setTestQueryParams] = useState<string>("");
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [testTime, setTestTime] = useState<number | null>(null);
  const [testingLoading, setTestingLoading] = useState(false);
  const [expandedCodeSlug, setExpandedCodeSlug] = useState<string | null>(null);

  // Auto-scroll handler for chat
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch all endpoints
  const fetchEndpoints = async () => {
    setLoadingEndpoints(true);
    try {
      const res = await fetch("/api/agent-endpoints");
      const data = await res.json();
      if (data.success) {
        setEndpoints(data.endpoints);
      } else {
        toast.error("Failed to load custom API endpoints.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error connecting to endpoints registry.");
    } finally {
      setLoadingEndpoints(false);
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, [connectionId]);

  const [input, setInput] = useState("");
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const STORAGE_KEY = `agent_chat_history_${connectionId}`;

  // Setup Vercel AI SDK useChat
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/agent",
      body: {
        connectionId,
      },
    }),
    onFinish: () => {
      // Whenever a chat completes, the agent might have written a new route. Refresh the endpoints list!
      fetchEndpoints();
    },
    onError: (err) => {
      toast.error(err.message || "An error occurred in the Agent stream.");
    }
  });

  // 1. Restore chat history on mount / connectionId change
  useEffect(() => {
    setHasLoadedHistory(false);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
          setHasLoadedHistory(true);
          return;
        }
      }
      setMessages([]);
      setHasLoadedHistory(true);
    } catch (err) {
      console.error("Failed to restore agent chat history:", err);
      setMessages([]);
      setHasLoadedHistory(true);
    }
  }, [connectionId, setMessages]);

  // 2. Save chat history to localStorage when messages change
  useEffect(() => {
    if (!hasLoadedHistory) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (err) {
      console.error("Failed to save agent chat history:", err);
    }
  }, [messages, connectionId, hasLoadedHistory]);

  const clearChat = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setMessages([]);
      toast.success("Agent chat history cleared.");
    } catch (err) {
      console.error("Failed to clear agent chat:", err);
      toast.error("Failed to clear chat history.");
    }
  };

  const isLoading = status === "submitted" || status === "streaming";

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const textToSend = input;
    setInput("");

    try {
      await sendMessage({ text: textToSend });
    } catch (err: any) {
      toast.error(err.message || "Failed to send message.");
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Delete endpoint
  const deleteEndpoint = async (slug: string) => {
    const confirm = window.confirm(`Are you sure you want to delete the /api/custom/${slug} API route?`);
    if (!confirm) return;

    try {
      const res = await fetch(`/api/agent-endpoints?slug=${slug}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Endpoint /api/custom/${slug} deleted successfully.`);
        fetchEndpoints();
        if (testingSlug === slug) {
          setTestingSlug(null);
          setTestResult(null);
        }
        if (expandedCodeSlug === slug) {
          setExpandedCodeSlug(null);
        }
      } else {
        toast.error(data.error || "Failed to delete endpoint.");
      }
    } catch (err: any) {
      toast.error("Network error deleting endpoint.");
    }
  };

  // Test endpoint
  const testEndpoint = async (endpoint: Endpoint) => {
    setTestingSlug(endpoint.slug);
    setTestingLoading(true);
    setTestResult(null);
    setTestStatus(null);
    setTestTime(null);

    const startTime = performance.now();
    try {
      const cleanParams = testQueryParams.trim().startsWith("?") 
        ? testQueryParams.trim() 
        : testQueryParams.trim() 
          ? `?${testQueryParams.trim()}` 
          : "";
      const res = await fetch(`${endpoint.url}${cleanParams}`);
      const duration = Math.round(performance.now() - startTime);
      setTestTime(duration);
      setTestStatus(res.status);

      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      const duration = Math.round(performance.now() - startTime);
      setTestTime(duration);
      setTestStatus(500);
      setTestResult({ error: err.message || "Failed to complete request." });
    } finally {
      setTestingLoading(false);
    }
  };

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
      
      {/* LEFT COLUMN: CHAT WINDOW */}
      <div className="lg:col-span-7 flex flex-col h-[70vh] bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Bot className="w-4.5 h-4.5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold text-card-foreground text-sm tracking-tight flex items-center gap-2">
                AI API Agent
                <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold uppercase tracking-tight">Active</span>
              </h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Dynamic Endpoints Builder</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearChat}
                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Clear Chat History"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
            <div className="text-[10px] bg-muted px-2 py-0.5 rounded border border-border/50 text-muted-foreground font-semibold font-mono">
              {connectionId.substring(0, 8)}...
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-60 space-y-4 text-center max-w-md mx-auto py-12">
              <Sparkles className="w-10 h-10 text-blue-500 animate-pulse" />
              <div>
                <h3 className="font-semibold text-foreground text-sm">Create Dynamic API Routes via Chat</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Command the AI agent to write Next.js endpoints. It will automatically scan your database schema and write optimized code to query tables.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setInput("Scan my database schema and list tables")}
                  className="text-[10px] h-7 font-bold hover:bg-muted"
                >
                  Scan Database Schema
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setInput("Create a GET endpoint with slug 'recent-records' showing the top 5 records of one of my tables")}
                  className="text-[10px] h-7 font-bold hover:bg-muted"
                >
                  Create Endpoint Template
                </Button>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => {
            const textContent = msg.parts
              ? msg.parts
                  .filter((p) => p.type === "text" || p.type === "reasoning")
                  .map((p: any) => p.text)
                  .join("")
              : "";

            const toolCalls = msg.parts
              ? msg.parts
                  .filter((p) => p.type.startsWith("tool-") || p.type === "dynamic-tool")
                  .map((p: any) => ({
                    toolName: p.toolName || p.type.replace("tool-", ""),
                    toolCallId: p.toolCallId,
                    state: p.state,
                  }))
              : [];

            return (
              <div key={idx} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role !== "user" && (
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                    <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed ${msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm font-medium"
                  : "bg-muted/50 border border-border/50 rounded-tl-sm text-foreground"
                  }`}>
                  
                  {/* Standard Message content */}
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{textContent}</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Tool Calls Rendering */}
                      {toolCalls.map((toolCall) => {
                        const { toolName, toolCallId, state } = toolCall;
                        const isDone = state === "result";
                        return (
                          <div key={toolCallId} className="text-xs bg-muted border border-border/50 px-3.5 py-2.5 rounded-lg font-mono flex items-center justify-between gap-3 shadow-xs">
                            <div className="flex items-center gap-2.5">
                              {isDone ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                              )}
                              <span className="font-semibold text-foreground/80">
                                {toolName === "getSchema" && "Scanning Schema..."}
                                {toolName === "writeApiEndPoint" && "Writing API Endpoint..."}
                                {toolName === "listApiEndPoints" && "Listing API Endpoints..."}
                                {toolName === "deleteEndPoints" && "Deleting Endpoint..."}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground uppercase bg-card/60 px-2 py-0.5 rounded border border-border/20">
                              {state}
                            </span>
                          </div>
                        );
                      })}
                      
                      {/* Render Text */}
                      {textContent && (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-7 text-sm text-foreground/90 font-medium" {...props} />,
                            code: ({ node, ...props }) => <code className="bg-background border border-border/50 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded text-xs font-mono" {...props} />,
                            pre: ({ node, ...props }) => (
                              <div className="relative group">
                                <pre className="bg-zinc-950 p-4 rounded-lg overflow-x-auto my-4 border border-zinc-800 text-zinc-50 text-xs font-mono" {...props} />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    // extract pre text content
                                    const text = (node as any)?.children?.[0]?.children?.[0]?.value || "";
                                    copyToClipboard(text, "Code copied to clipboard!");
                                  }}
                                  className="absolute right-2 top-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-850"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ),
                            ul: ({ node, ...props }) => <ul className="list-disc ml-4 my-2 space-y-1" {...props} />,
                            strong: ({ node, ...props }) => <strong className="font-bold text-foreground" {...props} />,
                          }}
                        >
                          {textContent}
                        </ReactMarkdown>
                      )}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary-foreground font-bold" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (!messages[messages.length - 1]?.parts || !messages[messages.length - 1].parts.some(p => p.type.startsWith("tool-") || p.type === "dynamic-tool")) && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="max-w-[80%] rounded-2xl px-5 py-4 bg-muted/50 border border-border/50 rounded-tl-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500/50 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-blue-500/50 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 rounded-full bg-blue-500/50 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="p-4 bg-muted/10 border-t border-border">
          <form onSubmit={handleFormSubmit} className="relative flex items-center">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Generate a GET route at slug 'active-users' for the customers table..."
              className="w-full pr-12 py-6 rounded-xl border-border bg-background shadow-xs focus-visible:ring-blue-500/30 font-medium text-sm"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <div className="text-center mt-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Dynamic Agent Sandbox • Powered by Gemini 2.5</p>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: ACTIVE ENDPOINTS & TESTING HUB */}
      <div className="lg:col-span-5 flex flex-col h-[70vh] gap-6">
        
        {/* Endpoints List */}
        <div className="flex-1 bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 bg-muted/30 border-b border-border">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-card-foreground text-sm tracking-tight">Active Custom APIs</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchEndpoints}
              disabled={loadingEndpoints}
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingEndpoints ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingEndpoints && endpoints.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-48 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Indexing custom routes...</p>
              </div>
            ) : endpoints.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-48 border border-dashed rounded-lg opacity-60 p-6 text-center space-y-2">
                <Database className="w-8 h-8 text-muted-foreground mb-1" />
                <h4 className="text-xs font-bold">No Custom APIs Generated</h4>
                <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[200px]">
                  Ask the agent on the left to write an endpoint to populate this list.
                </p>
              </div>
            ) : (
              endpoints.map((ep) => {
                const isExpanded = expandedCodeSlug === ep.slug;
                return (
                  <div key={ep.slug} className="border border-border/80 rounded-xl bg-muted/10 overflow-hidden transition-all shadow-xs">
                    
                    {/* Header Item */}
                    <div className="flex items-center justify-between p-3.5 bg-muted/20 border-b border-border/40">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold bg-green-500/10 text-green-500 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-500/20 font-mono">GET</span>
                          <span className="font-bold font-mono text-sm tracking-tight text-foreground">/{ep.slug}</span>
                        </div>
                        <p className="text-[9px] font-mono text-muted-foreground uppercase">
                          Last generated: {new Date(ep.updatedAt).toLocaleTimeString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setExpandedCodeSlug(isExpanded ? null : ep.slug)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="View Source Code"
                        >
                          <Code className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setTestingSlug(ep.slug);
                            setTestResult(null);
                            setTestStatus(null);
                            setTestTime(null);
                          }}
                          className={`h-8 w-8 hover:text-blue-500 ${testingSlug === ep.slug ? "text-blue-500 bg-blue-500/10" : "text-muted-foreground"}`}
                          title="Test Endpoint"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteEndpoint(ep.slug)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete API"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* View Code Section */}
                    {isExpanded && (
                      <div className="bg-zinc-950 p-3.5 border-b border-border text-[11px] font-mono text-zinc-300 relative group max-h-[300px] overflow-y-auto">
                        <pre>{ep.code}</pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(ep.code, "TypeScript code copied!")}
                          className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live Testing Bed */}
        {testingSlug && (
          <div className="h-[250px] bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-250">
            <div className="flex items-center justify-between px-6 py-3.5 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-2">
                <Play className="w-3.5 h-3.5 text-blue-500" />
                <h3 className="font-semibold text-sm tracking-tight">Test: <span className="font-mono">/api/custom/{testingSlug}</span></h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTestingSlug(null)}
                className="h-6 text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground"
              >
                Close
              </Button>
            </div>

            {/* Config & Trigger */}
            <div className="p-3 bg-muted/10 border-b border-border flex items-center gap-2.5">
              <Input
                placeholder="Query parameters (e.g. limit=10&status=delivered)"
                value={testQueryParams}
                onChange={(e) => setTestQueryParams(e.target.value)}
                className="h-8 text-xs font-mono"
              />
              <Button
                size="sm"
                disabled={testingLoading}
                onClick={() => {
                  const ep = endpoints.find(e => e.slug === testingSlug);
                  if (ep) testEndpoint(ep);
                }}
                className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs px-3"
              >
                {testingLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                {testingLoading ? "CALLING..." : "SEND"}
              </Button>
            </div>

            {/* Results Viewport */}
            <div className="flex-1 overflow-auto p-4 bg-zinc-950 font-mono text-xs text-zinc-100 relative">
              {testingLoading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-600 animate-pulse" />
                </div>
              ) : testStatus !== null ? (
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-1.5 text-[10px] text-zinc-400 uppercase font-bold">
                    <div className="flex gap-4">
                      <span>Status: <strong className={testStatus >= 200 && testStatus < 300 ? "text-emerald-500" : "text-destructive"}>{testStatus}</strong></span>
                      <span>Time: <strong className="text-zinc-200">{testTime} ms</strong></span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(JSON.stringify(testResult, null, 2), "JSON response copied!")}
                      className="h-5 w-5 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                    >
                      <Copy className="w-2.5 h-2.5" />
                    </Button>
                  </div>
                  <pre className="overflow-x-auto select-text font-mono text-[10px] leading-relaxed max-w-full">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full opacity-35 text-[10px] uppercase font-bold tracking-wider">
                  Click send to execute API query.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
