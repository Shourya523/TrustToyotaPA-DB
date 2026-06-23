"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type Connection,
  type Edge,
  type Node,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  User,
  Car,
  Building2,
  Calendar,
  Clock,
  TrendingUp,
  Loader2,
  Trash2,
  Layers,
  Info,
  Plus,
  Search,
  Zap,
  DollarSign,
  Activity,
  Sparkles,
  ArrowRight,
  X,
  Maximize2,
} from "lucide-react";
import {
  getPlaygroundData,
  getConnectionInsight,
  type PlaygroundData,
  type ConnectionInsight,
  type ActiveFilters,
} from "@/src/actions/playground";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Format helpers ────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M EGP`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K EGP`
    : `${n.toLocaleString()} EGP`;

// ─── Node definitions (gradients are the same in both modes) ──────────────────
const NODE_DEFS = {
  employee: {
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    glow: "rgba(59,130,246,0.35)",
    accent: "#93c5fd",
    icon: User,
    label: "Sales Rep",
    tabColor: "#3b82f6",
  },
  car: {
    gradient: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)",
    glow: "rgba(249,115,22,0.35)",
    accent: "#fdba74",
    icon: Car,
    label: "Car Model",
    tabColor: "#f97316",
  },
  branch: {
    gradient: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
    glow: "rgba(168,85,247,0.35)",
    accent: "#d8b4fe",
    icon: Building2,
    label: "Showroom",
    tabColor: "#a855f7",
  },
  month: {
    gradient: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
    glow: "rgba(16,185,129,0.35)",
    accent: "#6ee7b7",
    icon: Calendar,
    label: "Month",
    tabColor: "#10b981",
  },
  year: {
    gradient: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
    glow: "rgba(245,158,11,0.35)",
    accent: "#fde68a",
    icon: Clock,
    label: "Year / Future",
    tabColor: "#f59e0b",
  },
} as const;

type NodeKind = keyof typeof NODE_DEFS;

// ─── Custom Node ───────────────────────────────────────────────────────────────
function PlayNode({
  id,
  data,
  selected,
}: {
  id: string;
  data: { label: string; kind: NodeKind; sub?: string; onDelete?: (id: string) => void };
  selected?: boolean;
}) {
  const def = NODE_DEFS[data.kind];
  const Icon = def.icon;

  return (
    <div className="relative select-none" style={{ width: 172 }}>
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 12,
          height: 12,
          background: def.accent,
          border: "2.5px solid white",
          boxShadow: `0 0 10px ${def.glow}`,
          left: -6,
          zIndex: 10,
        }}
      />

      {/* Delete button */}
      {data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete!(id);
          }}
          className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full flex items-center justify-center z-20 shadow-lg transition-transform hover:scale-110"
          style={{
            background: "#ef4444",
            border: "2px solid white",
            boxShadow: "0 2px 8px rgba(239,68,68,0.5)",
          }}
        >
          <X className="w-3 h-3 text-white" />
        </button>
      )}

      {/* Card */}
      <div
        className="relative overflow-hidden rounded-2xl transition-all duration-150 cursor-grab active:cursor-grabbing"
        style={{
          background: def.gradient,
          boxShadow: selected
            ? `${def.glow.replace("0.35", "0.6")}, 0 0 0 2.5px ${def.accent}, 0 8px 32px ${def.glow}`
            : `0 6px 24px ${def.glow}, 0 2px 8px rgba(0,0,0,0.15)`,
          transform: selected ? "scale(1.03)" : "scale(1)",
        }}
      >
        {/* Shine bar */}
        <div
          className="absolute top-0 left-0 right-0 h-px opacity-60"
          style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)" }}
        />

        <div className="relative flex flex-col gap-2 px-4 py-3.5">
          {/* Icon row */}
          <div className="flex items-center justify-between">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              <Icon style={{ width: 18, height: 18, color: "white" }} />
            </div>
            <span
              className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
              style={{ background: "rgba(0,0,0,0.25)", color: "rgba(255,255,255,0.8)" }}
            >
              {def.label}
            </span>
          </div>

          {/* Name */}
          <div>
            <p className="font-bold text-[12px] leading-snug line-clamp-2" style={{ color: "white" }}>
              {data.label}
            </p>
            {data.sub && (
              <p className="text-[9px] mt-0.5 leading-snug truncate" style={{ color: "rgba(255,255,255,0.65)" }}>
                {data.sub}
              </p>
            )}
          </div>

          {/* Bottom divider */}
          <div className="h-px rounded-full" style={{ background: "rgba(255,255,255,0.18)" }} />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 12,
          height: 12,
          background: def.accent,
          border: "2.5px solid white",
          boxShadow: `0 0 10px ${def.glow}`,
          right: -6,
          zIndex: 10,
        }}
      />
    </div>
  );
}

const nodeTypes = { play: PlayNode };

// ─── Insight Panel (Right sidebar) ────────────────────────────────────────────
function InsightPanel({
  insight,
  loading,
  edgeCount,
  onClear,
}: {
  insight: ConnectionInsight | null;
  loading: boolean;
  edgeCount: number;
  onClear: () => void;
}) {
  const hasData = edgeCount > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card border-l border-border">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
            >
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-foreground">Live Insight</span>
          </div>
          {hasData && (
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {hasData && (
          <div className="mt-2.5">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{
                background: "rgba(99,102,241,0.12)",
                color: "#6366f1",
                border: "1px solid rgba(99,102,241,0.25)",
              }}
            >
              <Activity className="w-2.5 h-2.5" />
              {edgeCount} {edgeCount === 1 ? "connection" : "connections"} active
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {!hasData && !loading ? (
          /* Empty */
          <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)" }}
            >
              <Sparkles className="w-7 h-7" style={{ color: "#6366f1" }} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">No connections yet</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Draw edges between nodes to compute live sales insights
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <ArrowRight className="w-3 h-3" />
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span>Drag between node handles</span>
            </div>
          </div>
        ) : loading ? (
          /* Loading */
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative w-12 h-12">
              <div
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: "rgba(99,102,241,0.2)" }}
              />
              <div
                className="relative w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}
              >
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#6366f1" }} />
              </div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground">Querying database...</p>
          </div>
        ) : insight && insight.validQuery ? (
          <>
            {/* KPIs */}
            <div className="space-y-3">
              {[
                { label: "Cars Sold", value: insight.carsSold.toLocaleString(), icon: Car, grad: "linear-gradient(135deg,#3b82f6,#1d4ed8)", glow: "rgba(59,130,246,0.3)" },
                { label: "Total Revenue", value: fmt(insight.revenue), icon: DollarSign, grad: "linear-gradient(135deg,#10b981,#047857)", glow: "rgba(16,185,129,0.3)" },
                { label: "Avg Deal Size", value: fmt(insight.avgDealSize), icon: TrendingUp, grad: "linear-gradient(135deg,#f59e0b,#b45309)", glow: "rgba(245,158,11,0.3)" },
              ].map((kpi) => {
                const Ic = kpi.icon;
                return (
                  <div
                    key={kpi.label}
                    className="flex items-center gap-4 rounded-xl p-3.5 border border-border bg-secondary/30"
                  >
                    <div
                      className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
                      style={{ background: kpi.grad, boxShadow: `0 4px 16px ${kpi.glow}` }}
                    >
                      <Ic style={{ width: 18, height: 18, color: "white" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{kpi.label}</p>
                      <p className="text-sm font-extrabold text-foreground tabular-nums truncate mt-0.5">{kpi.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Peak period */}
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-3 border"
              style={{ background: "rgba(99,102,241,0.06)", borderColor: "rgba(99,102,241,0.2)" }}
            >
              <Calendar className="w-4 h-4 shrink-0" style={{ color: "#6366f1" }} />
              <div>
                <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Peak Month</p>
                <p className="text-sm font-bold text-foreground">{insight.peakMonth}</p>
                {insight.peakMonthCount > 0 && (
                  <p className="text-[10px] text-muted-foreground">{insight.peakMonthCount} units sold</p>
                )}
              </div>
            </div>

            {/* Monthly chart */}
            {insight.monthlyBreakdown.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                    Monthly Volume
                  </p>
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#6366f1" }} />
                </div>
                <div className="rounded-xl border border-border bg-secondary/20 p-3">
                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={insight.monthlyBreakdown} margin={{ left: -20, right: 4, top: 8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" tick={{ fontSize: 8 }} className="fill-muted-foreground" axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 8 }} className="fill-muted-foreground" axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 10,
                            fontSize: 11,
                            color: "hsl(var(--foreground))",
                          }}
                          formatter={(v: number) => [v, "Units Sold"]}
                        />
                        <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#areaGrad)" dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#818cf8" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : insight && !insight.validQuery ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <Info className="w-8 h-8 text-amber-500" />
            <p className="text-xs font-bold text-foreground">Add at least one filter</p>
            <p className="text-[11px] text-muted-foreground">
              Connect an Employee, Car, Showroom, or Year node to get specific results.
            </p>
          </div>
        ) : (
          <p className="text-xs text-center text-muted-foreground py-8">No data for this combination.</p>
        )}
      </div>
    </div>
  );
}

// ─── Palette Item ──────────────────────────────────────────────────────────────
function PaletteItem({ label, sub, kind, onAdd }: { label: string; sub?: string; kind: NodeKind; onAdd: () => void }) {
  const def = NODE_DEFS[kind];
  const Icon = def.icon;
  return (
    <button
      onClick={onAdd}
      className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-all text-left border border-transparent hover:border-border"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
        style={{ background: def.gradient, boxShadow: `0 3px 10px ${def.glow}` }}
      >
        <Icon style={{ width: 14, height: 14, color: "white" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate text-foreground">{label}</p>
        {sub && <p className="text-[9px] truncate mt-0.5 text-muted-foreground">{sub}</p>}
      </div>
      <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
        <Plus className="w-3 h-3 text-primary" />
      </div>
    </button>
  );
}

// ─── Main Canvas ───────────────────────────────────────────────────────────────
function PlaygroundCanvas({ data }: { data: PlaygroundData }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [insight, setInsight] = useState<ConnectionInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<NodeKind>("employee");
  const [search, setSearch] = useState("");
  const { fitView, addNodes: rfAddNodes } = useReactFlow();
  const nodeIdRef = useRef(1);

  // Delete node by id
  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [setNodes, setEdges]
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 2.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#818cf8", width: 14, height: 14 },
          },
          eds
        )
      ),
    [setEdges]
  );

  // Recompute insight whenever edges/nodes change
  useEffect(() => {
    if (edges.length === 0) { setInsight(null); return; }

    // Only count node IDs that appear in at least one edge endpoint
    const connectedIds = new Set<string>();
    edges.forEach((e) => { connectedIds.add(e.source); connectedIds.add(e.target); });

    const filters: ActiveFilters = {
      empSsn: null,
      carLabel: null,
      monthNum: null,
      year: null,
      branchId: null,
    };

    nodes.forEach((n) => {
      if (!connectedIds.has(n.id)) return;
      const kind = n.data.kind as NodeKind;
      const meta = n.data.meta as Record<string, unknown>;
      if (kind === "employee") filters.empSsn = meta.ssn as number;
      if (kind === "car") filters.carLabel = n.data.label as string;
      // monthNum is stored in meta.num (set when node is added)
      if (kind === "month") filters.monthNum = meta.num as number;
      if (kind === "year") filters.year = meta.year as number;
      if (kind === "branch") filters.branchId = meta.branchId as number;
    });

    setInsightLoading(true);
    setInsight(null);
    getConnectionInsight(filters)
      .then(setInsight)
      .catch(() => setInsight(null))
      .finally(() => setInsightLoading(false));
  }, [edges, nodes]);

  const addNodeToCanvas = (kind: NodeKind, label: string, sub: string | undefined, meta: Record<string, unknown>) => {
    const id = `node_${nodeIdRef.current++}`;
    const x = 300 + (Math.random() - 0.5) * 480;
    const y = 240 + (Math.random() - 0.5) * 280;
    rfAddNodes([{
      id,
      type: "play",
      position: { x, y },
      data: { label, kind, sub, meta, onDelete: deleteNode },
    }]);
  };

  // Sync onDelete callback into existing nodes when deleteNode changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, onDelete: deleteNode },
      }))
    );
  }, [deleteNode, setNodes]);

  const clearCanvas = () => { setNodes([]); setEdges([]); setInsight(null); };

  const paletteItems = (() => {
    const q = search.toLowerCase();
    switch (activeTab) {
      case "employee":
        return data.employees
          .filter((e) => e.name.toLowerCase().includes(q) || e.city.toLowerCase().includes(q))
          .map((e) => ({ label: e.name, sub: `${e.jobTitle} · ${e.city}`, meta: { ssn: e.ssn } }));
      case "car":
        return data.carModels
          .filter((c) => c.label.toLowerCase().includes(q))
          .map((c) => ({ label: c.label, sub: `Avg ${fmt(c.avgPrice)} · ${c.totalSold} sold`, meta: { carId: c.carId } }));
      case "branch":
        return data.branches
          .filter((b) => `${b.street} ${b.city}`.toLowerCase().includes(q))
          .map((b) => ({ label: b.city, sub: b.street, meta: { branchId: b.branchId } }));
      case "month":
        return data.months
          .filter((m) => m.name.toLowerCase().includes(q))
          .map((m) => ({ label: m.name, sub: `Month filter`, meta: { num: m.num } }));
      case "year":
        return data.years
          .filter((y) => String(y.year).includes(q))
          .map((y) => ({ label: String(y.year), sub: `${y.totalCarsSold} units · ${fmt(y.totalRevenue)}`, meta: { year: y.year } }));
      default:
        return [];
    }
  })();

  return (
    <div className="flex h-full bg-background">
      {/* ── Left Palette ─────────────────────────────────────────────────────── */}
      <div className="w-[272px] shrink-0 flex flex-col h-full border-r border-border bg-card">
        {/* Header */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2 mb-3.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
            >
              <Layers className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-sm font-bold text-foreground">Node Palette</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search nodes..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex gap-1 p-2 border-b border-border bg-secondary/30">
          {(Object.keys(NODE_DEFS) as NodeKind[]).map((k) => {
            const def = NODE_DEFS[k];
            const Ic = def.icon;
            const isActive = activeTab === k;
            return (
              <button
                key={k}
                onClick={() => { setActiveTab(k); setSearch(""); }}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[8px] font-bold uppercase tracking-wide transition-all"
                style={{
                  background: isActive ? def.gradient : "transparent",
                  color: isActive ? "white" : "hsl(var(--muted-foreground))",
                  boxShadow: isActive ? `0 3px 12px ${def.glow}` : "none",
                }}
              >
                <Ic style={{ width: 14, height: 14 }} />
                <span>{k.slice(0, 3)}</span>
              </button>
            );
          })}
        </div>

        {/* Count label */}
        <div className="px-4 py-2 border-b border-border/50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {NODE_DEFS[activeTab].label}s — {paletteItems.length} available
          </p>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {paletteItems.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-10">No items found</p>
          ) : (
            paletteItems.map((item) => (
              <PaletteItem
                key={`${item.label}-${JSON.stringify(item.meta)}`}
                label={item.label}
                sub={item.sub}
                kind={activeTab}
                onAdd={() => addNodeToCanvas(activeTab, item.label, item.sub, item.meta)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3 border-t border-border space-y-2">
          <button
            onClick={() => fitView({ duration: 600, padding: 0.15 })}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Fit to View
          </button>
          <button
            onClick={clearCanvas}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
        </div>
      </div>

      {/* ── Canvas ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          className="bg-background"
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 2.5 },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="hsl(var(--border))" />
          <Controls className="!rounded-xl !overflow-hidden !shadow-lg !border-border" />
          <MiniMap
            nodeColor={(n) => NODE_DEFS[(n.data?.kind as NodeKind) ?? "employee"].tabColor}
            className="!bg-card !border-border !rounded-xl !shadow-lg"
            maskColor="hsl(var(--background) / 0.6)"
            style={{ borderRadius: 12 }}
          />

          {/* Empty state */}
          {nodes.length === 0 && (
            <Panel position="top-center" style={{ marginTop: 80 }}>
              <div className="flex flex-col items-center gap-5 text-center px-8 py-8 rounded-3xl bg-card border border-border shadow-xl max-w-sm">
                <div
                  className="w-16 h-16 rounded-3xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.15))",
                    border: "1.5px solid rgba(99,102,241,0.3)",
                  }}
                >
                  <Layers className="w-8 h-8" style={{ color: "#6366f1" }} />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-bold text-foreground">Sales Relation Playground</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Click items in the left palette to add them as nodes, then drag edges between handles to compute live insights.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {(Object.keys(NODE_DEFS) as NodeKind[]).map((k) => {
                    const d = NODE_DEFS[k];
                    const Ic = d.icon;
                    return (
                      <span
                        key={k}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white"
                        style={{ background: d.gradient, boxShadow: `0 3px 10px ${d.glow}` }}
                      >
                        <Ic style={{ width: 11, height: 11 }} />
                        {d.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* ── Right Insight Panel ───────────────────────────────────────────────── */}
      <div className="w-[300px] shrink-0 h-full">
        <InsightPanel
          insight={insight}
          loading={insightLoading}
          edgeCount={edges.length}
          onClear={() => { setEdges([]); setInsight(null); }}
        />
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function PlaygroundPage() {
  const [data, setData] = useState<PlaygroundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlaygroundData()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 16px rgba(99,102,241,0.4)" }}
          >
            <Layers className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-tight leading-none">
              Sales Relation Playground
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Connect nodes to compute live insights from the database
            </p>
          </div>
        </div>

        {data && (
          <div className="hidden lg:flex items-center gap-4">
            {(Object.keys(NODE_DEFS) as NodeKind[]).map((k) => {
              const def = NODE_DEFS[k];
              const count =
                k === "employee" ? data.employees.length
                : k === "car" ? data.carModels.length
                : k === "branch" ? data.branches.length
                : k === "month" ? 12
                : data.years.length;
              return (
                <div key={k} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: def.tabColor, boxShadow: `0 0 8px ${def.tabColor}88` }}
                  />
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {count} {def.label}{count !== 1 ? "s" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
          style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.25)" }}
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Live DB</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 bg-background">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-ping" />
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)" }}
              >
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#6366f1" }} />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">Loading playground...</p>
              <p className="text-xs text-muted-foreground mt-1">Fetching employees, cars, showrooms & years</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full bg-background">
            <div className="text-center space-y-3 max-w-sm p-8">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                <Info className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-sm font-bold text-red-500">Failed to load data</p>
              <p className="text-xs text-muted-foreground font-mono">{error}</p>
            </div>
          </div>
        ) : data ? (
          <ReactFlowProvider>
            <PlaygroundCanvas data={data} />
          </ReactFlowProvider>
        ) : null}
      </div>
    </div>
  );
}
