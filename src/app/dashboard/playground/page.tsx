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
  type EdgeProps,
  getBezierPath,
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
  Layout,
  CornerDownRight,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import {
  getPlaygroundData,
  getConnectionInsight,
  parseNaturalLanguageQuery,
  resolveEmployeeByName,
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
import { motion, AnimatePresence } from "framer-motion";
import dagre from "dagre";

// ─── Format helpers ────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(1)}K`
    : `$${n.toLocaleString()}`;

// ─── Node definitions (gradients and colors) ──────────────────────────────────
const NODE_DEFS = {
  employee: {
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    glow: "rgba(59,130,246,0.25)",
    accent: "#60a5fa",
    icon: User,
    label: "Sales Rep",
    tabColor: "#3b82f6",
  },
  car: {
    gradient: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)",
    glow: "rgba(249,115,22,0.25)",
    accent: "#fb923c",
    icon: Car,
    label: "Car Model",
    tabColor: "#f97316",
  },
  branch: {
    gradient: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
    glow: "rgba(168,85,247,0.25)",
    accent: "#c084fc",
    icon: Building2,
    label: "Showroom",
    tabColor: "#a855f7",
  },
  month: {
    gradient: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
    glow: "rgba(16,185,129,0.25)",
    accent: "#34d399",
    icon: Calendar,
    label: "Month",
    tabColor: "#10b981",
  },
  year: {
    gradient: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
    glow: "rgba(245,158,11,0.25)",
    accent: "#fbbf24",
    icon: Clock,
    label: "Year",
    tabColor: "#f59e0b",
  },
} as const;

type NodeKind = keyof typeof NODE_DEFS;

type CustomNodeData = {
  label: string;
  kind: NodeKind;
  sub?: string;
  meta?: any;
  onDelete?: (id: string) => void;
  onSpawnAndConnect?: (sourceId: string, targetKind: NodeKind, targetLabel: string) => void;
};

type CustomNode = Node<CustomNodeData>;

// ─── Custom Animated Connection Edge ───────────────────────────────────────────
function AnimatedFlowingEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  });

  return (
    <>
      {/* Thick glowing background path */}
      <path
        d={edgePath}
        fill="none"
        stroke="#dc2626"
        strokeWidth={5}
        strokeOpacity={0.15}
        className="blur-[2px]"
      />
      {/* Base interactive path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke="#b91c1c"
        strokeWidth={2}
        markerEnd={markerEnd}
        style={style}
      />
      {/* Flowing animated dash path */}
      <path
        d={edgePath}
        fill="none"
        stroke="#f87171"
        strokeWidth={1.5}
        className="edge-flow-dash"
        style={{
          strokeLinecap: "round",
        }}
      />
    </>
  );
}

const edgeTypes = {
  flowing: AnimatedFlowingEdge,
};

// ─── Custom Rich Node Card ─────────────────────────────────────────────────────
function PlayNode({
  id,
  data,
  selected,
}: {
  id: string;
  data: CustomNodeData;
  selected?: boolean;
}) {
  const def = NODE_DEFS[data.kind];
  const Icon = def.icon;
  const meta = data.meta || {};

  const renderContent = () => {
    switch (data.kind) {
      case "employee": {
        const initials = data.label
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/20 text-blue-400 font-extrabold text-sm border border-blue-500/30 shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-xs text-slate-100 truncate">{data.label}</p>
                <p className="text-[10px] text-slate-400 font-medium truncate">{meta.jobTitle || "Sales Consultant"}</p>
              </div>
            </div>
            
            <div className="text-[9px] text-slate-400 border-t border-slate-900/60 pt-2 flex justify-between items-center">
              <span>Showroom</span>
              <span className="font-semibold text-slate-200 truncate max-w-[150px]">{meta.branchStreet || "Toyota Showroom"}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-1 text-[10px]">
              <div>
                <p className="text-slate-500 text-[9px] font-medium">Revenue</p>
                <p className="font-extrabold text-slate-200 truncate mt-0.5">{meta.totalRevenue ? fmt(meta.totalRevenue) : "$0"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[9px] font-medium">Cars Sold</p>
                <p className="font-extrabold text-slate-200 mt-0.5">{meta.totalCarsSold || 0} units</p>
              </div>
            </div>

            {/* MoM trend pill in layout */}
            <div className="flex justify-between items-center text-[9px] border-t border-slate-900/60 pt-2.5">
              <span className="text-slate-500">MoM Performance</span>
              <span className={`px-2 py-0.5 rounded-full font-extrabold text-[9px] ${
                meta.trend?.startsWith("+") 
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" 
                  : "bg-red-500/10 border border-red-500/30 text-red-400"
              }`}>
                {meta.trend || "0%"}
              </span>
            </div>

            {/* AI Action button */}
            {data.onSpawnAndConnect && meta.city && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onSpawnAndConnect!(id, "branch", meta.city);
                }}
                className="w-full mt-2 py-1.5 px-2 rounded-xl bg-blue-500/5 hover:bg-blue-500/15 border border-blue-500/20 text-[9px] font-bold text-blue-400 transition-all flex items-center justify-center gap-1 cursor-pointer hover:scale-[1.01]"
              >
                <Sparkles className="w-2.5 h-2.5 shrink-0 animate-pulse" />
                Spawn {meta.city} Showroom
              </button>
            )}
          </div>
        );
      }
      case "car": {
        const isLowStock = meta.quantityInStock !== undefined && meta.quantityInStock < 5;
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
                <Car className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-xs text-slate-100 truncate">{data.label}</p>
                <p className="text-[10px] text-slate-400 font-medium truncate">Popularity: {meta.popularity || 0}%</p>
              </div>
            </div>

            <div className="text-[9px] text-slate-400 border-t border-slate-900/60 pt-2 flex justify-between items-center">
              <span>Top Consultant</span>
              <span className="font-semibold text-slate-200 truncate max-w-[150px]">{meta.topSalesperson || "—"}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-1 text-[10px]">
              <div>
                <p className="text-slate-500 text-[9px] font-medium">Avg Price</p>
                <p className="font-extrabold text-slate-200 truncate mt-0.5">{meta.avgPrice ? fmt(meta.avgPrice) : "$0"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[9px] font-medium">Units Sold</p>
                <p className="font-extrabold text-slate-200 mt-0.5">{meta.totalSold || 0} units</p>
              </div>
            </div>

            {/* Stock pill */}
            <div className="flex justify-between items-center text-[9px] border-t border-slate-900/60 pt-2.5">
              <span className="text-slate-500">Depot Inventory</span>
              {isLowStock ? (
                <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-bold animate-pulse text-[9px]">
                  Low Stock ({meta.quantityInStock})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[9px]">
                  In Stock ({meta.quantityInStock})
                </span>
              )}
            </div>

            {/* AI Action button */}
            {data.onSpawnAndConnect && meta.topSalesperson && meta.topSalesperson !== "—" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onSpawnAndConnect!(id, "employee", meta.topSalesperson);
                }}
                className="w-full mt-2 py-1.5 px-2 rounded-xl bg-orange-500/5 hover:bg-orange-500/15 border border-orange-500/20 text-[9px] font-bold text-orange-400 transition-all flex items-center justify-center gap-1 cursor-pointer hover:scale-[1.01]"
              >
                <Sparkles className="w-2.5 h-2.5 shrink-0 animate-pulse" />
                Spawn Top Consultant
              </button>
            )}
          </div>
        );
      }
      case "branch": {
        const healthStyles =
          meta.inventoryHealth === "critical"
            ? { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", label: "Critical" }
            : meta.inventoryHealth === "warn"
            ? { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", label: "Warning" }
            : { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", label: "Healthy" };
        
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-xs text-slate-100 truncate">{data.label} Showroom</p>
                <p className="text-[10px] text-slate-450 font-medium truncate">{meta.street || "Branch Showroom"}</p>
              </div>
            </div>

            <div className="text-[9px] text-slate-400 border-t border-slate-800/60 pt-2 flex justify-between items-center">
              <span>Best-Selling car</span>
              <span className="font-semibold text-slate-200 truncate max-w-[150px]">{meta.topModel || "—"}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-1 text-[10px]">
              <div>
                <p className="text-slate-500 text-[9px] font-medium">Revenue</p>
                <p className="font-extrabold text-slate-200 truncate mt-0.5">{meta.totalRevenue ? fmt(meta.totalRevenue) : "$0"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[9px] font-medium">Deliveries</p>
                <p className="font-extrabold text-slate-200 mt-0.5">{meta.totalCarsSold || 0} units</p>
              </div>
            </div>

            {/* Health pill */}
            <div className="flex justify-between items-center text-[9px] border-t border-slate-900/60 pt-2.5">
              <span className="text-slate-500">Depot Health</span>
              <span className={`px-2 py-0.5 rounded-full ${healthStyles.bg} ${healthStyles.border} ${healthStyles.text} font-extrabold text-[9px]`}>
                {healthStyles.label}
              </span>
            </div>

            {/* AI Action button */}
            {data.onSpawnAndConnect && meta.topModel && meta.topModel !== "—" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onSpawnAndConnect!(id, "car", meta.topModel);
                }}
                className="w-full mt-2 py-1.5 px-2 rounded-xl bg-purple-500/5 hover:bg-purple-500/15 border border-purple-500/20 text-[9px] font-bold text-purple-400 transition-all flex items-center justify-center gap-1 cursor-pointer hover:scale-[1.01]"
              >
                <Sparkles className="w-2.5 h-2.5 shrink-0 animate-pulse" />
                Spawn Best Selling Car
              </button>
            )}
          </div>
        );
      }
      case "month": {
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-slate-100">{data.label}</p>
                <p className="text-[10px] text-slate-400 font-medium">Seasonal Period</p>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 border-t border-slate-850 pt-2.5 leading-relaxed">
              Filters all active canvas entities to highlight seasonal peaks and cycles.
            </div>
          </div>
        );
      }
      case "year": {
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-slate-100">{data.label}</p>
                <p className="text-[10px] text-slate-400 font-medium">Annual Segment</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 py-1 text-[10px] border-t border-slate-850 pt-2.5">
              <div>
                <p className="text-slate-500 text-[9px] font-medium">Revenue</p>
                <p className="font-extrabold text-slate-200 truncate mt-0.5">{meta.totalRevenue ? fmt(meta.totalRevenue) : "$0"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[9px] font-medium">Sold</p>
                <p className="font-extrabold text-slate-200 mt-0.5">{meta.totalCarsSold || 0} units</p>
              </div>
            </div>
          </div>
        );
      }
      default:
        return <p className="text-xs text-slate-200">{data.label}</p>;
    }
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02, transition: { type: "spring", stiffness: 450, damping: 20 } }}
      className="relative select-none text-left"
      style={{ width: 280 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 8,
          height: 8,
          background: def.accent,
          border: "2px solid #09090b",
          boxShadow: `0 0 8px ${def.accent}`,
          left: -4,
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
          className="absolute -top-2 -right-2 w-5.5 h-5.5 rounded-full flex items-center justify-center z-20 shadow-lg bg-red-500/90 border border-zinc-950 text-white cursor-pointer hover:bg-red-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Main card panel */}
      <div
        className={`relative overflow-hidden rounded-2xl border bg-zinc-950/85 backdrop-blur-md p-5 transition-all`}
        style={{
          borderColor: selected ? def.accent : "rgba(63, 63, 70, 0.4)",
          boxShadow: selected ? `0 8px 30px ${def.glow}, 0 0 0 1.5px ${def.accent}` : `0 4px 16px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Top-gradient accent glow bar */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: def.gradient }}
        />

        {/* Shine highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Corner Node Pill */}
        <div className="flex justify-between items-center mb-3.5">
          <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-500">
            Node Identity
          </span>
          <span
            className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 text-white"
            style={{ background: def.gradient }}
          >
            <Icon className="w-2.5 h-2.5" />
            {def.label}
          </span>
        </div>

        {/* Content switch */}
        {renderContent()}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 8,
          height: 8,
          background: def.accent,
          border: "2px solid #09090b",
          boxShadow: `0 0 8px ${def.accent}`,
          right: -4,
          zIndex: 10,
        }}
      />
    </motion.div>
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
    <div className="flex flex-col h-full overflow-hidden bg-zinc-950 border-l border-zinc-800/80">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)" }}
            >
              <Zap className="w-3.5 h-3.5 text-white animate-pulse" />
            </div>
            <span className="text-sm font-extrabold text-slate-100 tracking-tight">Intelligence Feed</span>
          </div>
          {hasData && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-red-400 hover:bg-red-500/10 transition-colors border border-red-500/20 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Reset filters
            </button>
          )}
        </div>

        {hasData && (
          <div className="mt-2.5">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{
                background: "rgba(220,38,38,0.1)",
                color: "#f87171",
                border: "1px solid rgba(220,38,38,0.2)",
              }}
            >
              <Activity className="w-2.5 h-2.5" />
              {edgeCount} {edgeCount === 1 ? "relation" : "relations"} mapped
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
        {!hasData && !loading ? (
          /* Empty */
          <div className="flex flex-col items-center justify-center py-16 text-center gap-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}
            >
              <Sparkles className="w-6 h-6" style={{ color: "#ef4444" }} />
            </div>
            <div className="space-y-2 max-w-[220px]">
              <p className="text-xs font-bold text-slate-200">Intelligence offline</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Connect entity nodes together on the canvas to synthesize live database patterns.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 border border-zinc-800/80 bg-zinc-900/30 px-3 py-1.5 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <ArrowRight className="w-3 h-3" />
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span>Drag edge between node handles</span>
            </div>
          </div>
        ) : loading ? (
          /* Loading */
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative w-12 h-12">
              <div
                className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-ping"
              />
              <div
                className="relative w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)" }}
              >
                <Loader2 className="w-5 h-5 animate-spin text-red-500" />
              </div>
            </div>
            <p className="text-[11px] font-bold text-slate-400 animate-pulse">Running analytical SQL...</p>
          </div>
        ) : insight && insight.validQuery ? (
          <>
            {/* AI Summary Text */}
            <div className="space-y-2">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-red-400 animate-pulse" />
                Relational Summary
              </p>
              <div className="rounded-2xl border border-red-500/15 bg-red-500/5 p-4 text-[11px] font-medium text-slate-200 leading-relaxed shadow-lg">
                {insight.summaryText}
              </div>
            </div>

            {/* KPIs Grid */}
            <div className="space-y-3">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-500">
                Key Metrics
              </p>
              <div className="space-y-2.5">
                {[
                  { label: "Total Revenue Generated", value: fmt(insight.revenue), icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                  { label: "Total Units Delivered", value: insight.carsSold.toLocaleString(), icon: Car, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                  { label: "Average Deal Ticket", value: fmt(insight.avgDealSize), icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
                ].map((kpi) => {
                  const Ic = kpi.icon;
                  return (
                    <div
                      key={kpi.label}
                      className="flex items-center gap-3.5 rounded-xl p-3 border border-zinc-850 bg-zinc-900/20"
                    >
                      <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border ${kpi.bg}`}>
                        <Ic className={`w-4 h-4 ${kpi.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">{kpi.label}</p>
                        <p className="text-xs font-extrabold text-slate-100 tabular-nums truncate mt-0.5">{kpi.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Peak period */}
            {insight.peakMonthCount > 0 && (
              <div
                className="rounded-xl px-4 py-3 flex items-center gap-3 border bg-red-500/5 border-red-500/10 shadow-sm"
              >
                <Calendar className="w-4 h-4 shrink-0 text-red-400" />
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-extrabold text-zinc-500">Seasonal Peak</p>
                  <p className="text-xs font-extrabold text-slate-200 mt-0.5">{insight.peakMonth}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Recorded {insight.peakMonthCount} deliveries</p>
                </div>
              </div>
            )}

            {/* Monthly Area Chart */}
            {insight.monthlyBreakdown.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-500">
                    Monthly Revenue Trend
                  </p>
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                </div>
                <div className="rounded-xl border border-zinc-850 bg-zinc-950 p-3 shadow-md">
                  <div className="h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={insight.monthlyBreakdown} margin={{ left: -22, right: 4, top: 8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#dc2626" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.01)" />
                        <XAxis dataKey="month" tick={{ fontSize: 7, fill: "#71717a" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 7, fill: "#71717a" }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: "#09090b",
                            border: "1px solid #27272a",
                            borderRadius: 10,
                            fontSize: 10,
                            color: "#f4f4f5",
                          }}
                          formatter={(v: number) => [fmt(v), "Revenue"]}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#dc2626" strokeWidth={1.5} fill="url(#areaGrad)" dot={{ r: 2, fill: "#dc2626", strokeWidth: 0 }} activeDot={{ r: 4, fill: "#ef4444" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Discovered Patterns */}
            {insight.patterns && insight.patterns.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-red-400" />
                  Discovered Patterns
                </p>
                <div className="rounded-xl border border-zinc-850 bg-zinc-950 p-4 space-y-2.5 shadow-sm">
                  {insight.patterns.map((p, idx) => (
                    <div key={idx} className="flex gap-2.5 text-xs text-slate-300 leading-relaxed items-start">
                      <span className="text-red-400 select-none text-[10px] font-bold mt-0.5">•</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Anomalies */}
            {insight.anomalies && insight.anomalies.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                  <Info className="w-3 h-3 text-amber-500" />
                  System Anomalies
                </p>
                <div className="rounded-xl border border-zinc-850 bg-zinc-950 p-4 space-y-2.5 shadow-sm">
                  {insight.anomalies.map((a, idx) => (
                    <div key={idx} className="flex gap-2.5 text-xs text-slate-300 leading-relaxed items-start">
                      <span className="text-amber-500 font-bold select-none text-[11px] mt-0.5">!</span>
                      <span className="text-slate-300 font-medium">{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Explorations */}
            {insight.explorations && insight.explorations.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                  <HelpCircle className="w-3 h-3 text-red-500/50" />
                  Suggested Explorations
                </p>
                <div className="rounded-xl border border-zinc-850 bg-zinc-900/10 p-4 space-y-2.5">
                  {insight.explorations.map((e, idx) => (
                    <div key={idx} className="flex gap-2.5 text-xs text-slate-400 leading-relaxed items-start">
                      <span className="text-red-500 select-none text-[10px] mt-0.5" style={{ color: "rgba(220,38,38,0.4)" }}>→</span>
                      <span>{e}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : insight && !insight.validQuery ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <Info className="w-8 h-8 text-amber-500/80" />
            <p className="text-xs font-bold text-slate-200">Connect filters to query</p>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-[200px] mx-auto">
              Please link an Employee, Car, Showroom, or Month/Year node to isolate sales intelligence.
            </p>
          </div>
        ) : (
          <p className="text-xs text-center text-slate-500 py-12">No data returned for this query configuration.</p>
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
      className="group w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-900/80 transition-all text-left border border-transparent hover:border-zinc-850/80 cursor-pointer"
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
        style={{ background: def.gradient, boxShadow: `0 3px 10px ${def.glow}` }}
      >
        <Icon style={{ width: 12, height: 12, color: "white" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold truncate text-slate-300 group-hover:text-slate-100">{label}</p>
        {sub && <p className="text-[9px] truncate mt-0.5 text-slate-500 group-hover:text-slate-450">{sub}</p>}
      </div>
      <div className="w-5.5 h-5.5 rounded-md bg-red-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
        <Plus className="w-3 h-3 text-red-400" />
      </div>
    </button>
  );
}

// ─── Main Canvas ───────────────────────────────────────────────────────────────
function PlaygroundCanvas({ data }: { data: PlaygroundData }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Keep references to nodes and edges to break the react hook dependency loop
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  // Local data state — seeded from props, grows as new employees are resolved on demand
  const [localData, setLocalData] = useState<PlaygroundData>(data);
  const dataRef = useRef(localData);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  dataRef.current = localData;

  // Stable refs for callbacks so node data never needs updating
  const deleteNodeRef = useRef<(id: string) => void>(null!);
  const spawnAndConnectRef = useRef<(sourceId: string, targetKind: NodeKind, targetLabel: string) => void | Promise<void>>(null!);

  const [insight, setInsight] = useState<ConnectionInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<NodeKind, boolean>>({
    employee: true,
    car: true,
    branch: true,
    month: false,
    year: false,
  });
  
  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  
  const { fitView, addNodes: rfAddNodes } = useReactFlow<CustomNode>();
  const nodeIdRef = useRef(1);
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Focus command input when command palette opens
  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => {
        commandInputRef.current?.focus();
      }, 50);
    }
  }, [commandPaletteOpen]);

  // Command palette global key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Delete node by id — stable, reads no closing-over state
  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [setNodes, setEdges]
  );
  deleteNodeRef.current = deleteNode;

  // AI exploration / spawning action on node cards — empty dep array, reads everything via refs
  const spawnAndConnect = useCallback(async (sourceId: string, targetKind: NodeKind, targetLabel: string) => {
    const data = dataRef.current;
    if (!data) return;

    let targetItem: any = null;
    let label = targetLabel;
    let sub = "";
    let meta: any = null;
    
    if (targetKind === "car") {
      targetItem = data.carModels.find(
        (c) => c.label.toLowerCase() === targetLabel.toLowerCase() || 
               c.model.toLowerCase() === targetLabel.toLowerCase() || 
               targetLabel.toLowerCase().includes(c.model.toLowerCase())
      );
      if (targetItem) {
        label = targetItem.label;
        sub = `Avg ${fmt(targetItem.avgPrice)} · ${targetItem.totalSold} sold`;
        meta = targetItem;
      }
    } else if (targetKind === "branch") {
      targetItem = data.branches.find(
        (b) => b.city.toLowerCase() === targetLabel.toLowerCase() || 
               b.street.toLowerCase() === targetLabel.toLowerCase() ||
               targetLabel.toLowerCase().includes(b.city.toLowerCase())
      );
      if (targetItem) {
        label = targetItem.city;
        sub = targetItem.street;
        meta = targetItem;
      }
    } else if (targetKind === "employee") {
      // First try local list (top-40)
      targetItem = data.employees.find(
        (e) => e.name.toLowerCase() === targetLabel.toLowerCase() || 
               e.name.toLowerCase().startsWith(targetLabel.toLowerCase()) ||
               targetLabel.toLowerCase().includes(e.name.toLowerCase())
      );
      if (targetItem) {
        label = targetItem.name;
        sub = `${targetItem.jobTitle} · ${targetItem.city}`;
        meta = targetItem;
      } else {
        // Fallback: fetch directly from DB (handles consultants outside the top-40)
        const resolved = await resolveEmployeeByName(targetLabel);
        if (resolved) {
          label = resolved.name;
          sub = `${resolved.jobTitle} · ${resolved.city}`;
          meta = resolved;
          // Add to local palette list so they appear in the Sales Reps sidebar
          setLocalData((prev) => {
            const alreadyKnown = prev.employees.some((e) => e.ssn === resolved.ssn);
            if (alreadyKnown) return prev;
            return { ...prev, employees: [...prev.employees, resolved] };
          });
        }
      }
    }
    
    if (!meta) {
      console.warn("Auto Explorer: could not resolve item for", targetLabel);
      return;
    }
    
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    let existingNode = currentNodes.find((n) => {
      if (n.data.kind !== targetKind) return false;
      if (targetKind === "employee") return n.data.meta?.ssn === meta.ssn;
      if (targetKind === "car") return n.data.meta?.carId === meta.carId;
      if (targetKind === "branch") return n.data.meta?.branchId === meta.branchId;
      return false;
    });
    
    let targetNodeId = existingNode?.id;
    
    if (!existingNode) {
      // Create new node
      targetNodeId = `node_${nodeIdRef.current++}`;
      const sourceNode = currentNodes.find((n) => n.id === sourceId);
      const sx = sourceNode?.position.x ?? 300;
      const sy = sourceNode?.position.y ?? 240;
      // Position it to the right with offset
      const x = sx + 320 + (Math.random() - 0.5) * 50;
      const y = sy + (Math.random() - 0.5) * 80;
      
      const newNode = {
        id: targetNodeId,
        type: "play",
        position: { x, y },
        data: { 
          label, 
          kind: targetKind, 
          sub, 
          meta, 
          onDelete: (nodeId: string) => deleteNodeRef.current(nodeId),
          onSpawnAndConnect: (sid: string, tk: NodeKind, tl: string) => spawnAndConnectRef.current(sid, tk, tl),
        },
      };
      
      setNodes((nds) => [...nds, newNode]);
    }
    
    // Add custom edge between source and target
    if (targetNodeId) {
      const edgeId = `edge_${sourceId}_${targetNodeId}`;
      const edgeExists = currentEdges.some(
        (e) => (e.source === sourceId && e.target === targetNodeId) || 
               (e.source === targetNodeId && e.target === sourceId)
      );
      if (!edgeExists) {
        setEdges((eds) => 
          addEdge({
            id: edgeId,
            source: sourceId,
            target: targetNodeId,
            type: "flowing",
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#818cf8", width: 14, height: 14 },
          }, eds)
        );
      }

    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNodes, setEdges]);
  spawnAndConnectRef.current = spawnAndConnect;

  // Handle Dagre Auto Layout
  const autoLayout = useCallback((direction: "TB" | "LR") => {
    setNodes((nds) => {
      if (nds.length === 0) return nds;
      
      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({ rankdir: direction, ranksep: 100, nodesep: 60 });
      
      nds.forEach((n) => {
        g.setNode(n.id, { width: 280, height: 160 });
      });
      
      edges.forEach((e) => {
        g.setEdge(e.source, e.target);
      });
      
      dagre.layout(g);
      
      return nds.map((n) => {
        const nodeWithPosition = g.node(n.id);
        if (!nodeWithPosition) return n;
        return {
          ...n,
          position: {
            x: nodeWithPosition.x - 140,
            y: nodeWithPosition.y - 80,
          },
        };
      });
    });
    
    setTimeout(() => {
      fitView({ duration: 600, padding: 0.15 });
    }, 100);
  }, [edges, setNodes, fitView]);

  // Handle Natural Language Ask AI parser
  const handleAskAI = async (queryText: string) => {
    if (!queryText.trim()) return;
    setAiLoading(true);
    try {
      const filters = await parseNaturalLanguageQuery(queryText);
      
      // Clear canvas
      setNodes([]);
      setEdges([]);
      
      const newNodes: CustomNode[] = [];
      const newEdges: Edge[] = [];
      let tempNodeIdRef = 1;
      const spawned: { kind: NodeKind; id: string; label: string }[] = [];
      
      const addSpawned = (kind: NodeKind, label: string, sub: string, meta: any) => {
        const id = `node_ai_${tempNodeIdRef++}`;
        newNodes.push({
          id,
          type: "play",
          position: { x: 0, y: 0 },
          data: { 
            label, 
            kind, 
            sub, 
            meta, 
            onDelete: (nodeId: string) => deleteNodeRef.current(nodeId),
            onSpawnAndConnect: (sid: string, tk: NodeKind, tl: string) => spawnAndConnectRef.current(sid, tk, tl),
          },
        });
        spawned.push({ kind, id, label });
      };

      if (filters.empSsn && data) {
        const item = data.employees.find(e => e.ssn === filters.empSsn);
        if (item) addSpawned("employee", item.name, `${item.jobTitle} · ${item.city}`, item);
      }
      if (filters.carLabel && data) {
        const item = data.carModels.find(c => c.label.toLowerCase() === filters.carLabel?.toLowerCase());
        if (item) addSpawned("car", item.label, `Avg ${fmt(item.avgPrice)} · ${item.totalSold} sold`, item);
      }
      if (filters.branchId && data) {
        const item = data.branches.find(b => b.branchId === filters.branchId);
        if (item) addSpawned("branch", item.city, item.street, item);
      }
      if (filters.monthNum && data) {
        const item = data.months.find(m => m.num === filters.monthNum);
        if (item) addSpawned("month", item.name, "Month filter", item);
      }
      if (filters.year && data) {
        const item = data.years.find(y => y.year === filters.year);
        if (item) addSpawned("year", String(item.year), `${item.totalCarsSold} units · ${fmt(item.totalRevenue)}`, item);
      }
      
      if (newNodes.length === 0) {
        alert("No matching entities found in database. Try standardizing names like 'Ahmed', 'Corolla' or 'Cairo'.");
        setAiLoading(false);
        return;
      }
      
      // Connect AI nodes to build a star-shaped graph linked to the first spawned node
      if (spawned.length > 1) {
        const source = spawned[0];
        for (let i = 1; i < spawned.length; i++) {
          const target = spawned[i];
          newEdges.push({
            id: `edge_ai_${source.id}_${target.id}`,
            source: source.id,
            target: target.id,
            type: "flowing",
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#818cf8", width: 14, height: 14 },
          });
        }
      }
      
      // Layout layout
      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({ rankdir: "LR", ranksep: 100, nodesep: 60 });
      
      newNodes.forEach((n) => {
        g.setNode(n.id, { width: 280, height: 160 });
      });
      newEdges.forEach((e) => {
        g.setEdge(e.source, e.target);
      });
      
      dagre.layout(g);
      
      const layoutedNodes = newNodes.map((n) => {
        const pos = g.node(n.id);
        return {
          ...n,
          position: {
            x: pos.x - 140,
            y: pos.y - 80,
          },
        };
      });
      
      setNodes(layoutedNodes);
      setEdges(newEdges);
      setCommandPaletteOpen(false);
      setCommandQuery("");
      
      setTimeout(() => {
        fitView({ duration: 800, padding: 0.2 });
      }, 100);
      
    } catch (e) {
      console.error("AI node spawning failed:", e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAskAI(commandQuery);
    }
  };

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "flowing",
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#818cf8", width: 14, height: 14 },
          },
          eds
        )
      ),
    [setEdges]
  );

  // No callback-sync effect needed: node data uses stable ref wrappers,
  // so deleteNodeRef.current / spawnAndConnectRef.current always dispatch to the latest function.

  // Recompute connection insights whenever edges/nodes config changes
  useEffect(() => {
    if (edges.length === 0) {
      setInsight(null);
      return;
    }

    const connectedIds = new Set<string>();
    edges.forEach((e) => {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    });

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
      const meta = n.data.meta as Record<string, any>;
      if (kind === "employee") filters.empSsn = meta.ssn as number;
      if (kind === "car") filters.carLabel = n.data.label as string;
      if (kind === "month") filters.monthNum = meta.num as number;
      if (kind === "year") filters.year = meta.year as number;
      if (kind === "branch") filters.branchId = meta.branchId as number;
    });
    setInsightLoading(true);
    getConnectionInsight(filters)
      .then(setInsight)
      .catch(() => setInsight(null))
      .finally(() => setInsightLoading(false));
  }, [edges, nodes]);

  const addNodeToCanvas = (kind: NodeKind, label: string, sub: string | undefined, meta: Record<string, any>) => {
    const id = `node_${nodeIdRef.current++}`;
    const x = 300 + (Math.random() - 0.5) * 450;
    const y = 240 + (Math.random() - 0.5) * 250;
    rfAddNodes([
      {
        id,
        type: "play",
        position: { x, y },
        data: { 
          label, 
          kind, 
          sub, 
          meta, 
          onDelete: (nodeId: string) => deleteNodeRef.current(nodeId),
          onSpawnAndConnect: (sid: string, tk: NodeKind, tl: string) => spawnAndConnectRef.current(sid, tk, tl),
        },
      },
    ]);
  };

  const clearCanvas = () => {
    setNodes([]);
    setEdges([]);
    setInsight(null);
  };

  const filterItems = (kind: NodeKind) => {
    const q = search.toLowerCase();
    switch (kind) {
      case "employee":
        return localData.employees
          .filter((e) => e.name.toLowerCase().includes(q) || e.city.toLowerCase().includes(q))
          .map((e) => ({ label: e.name, sub: `${e.jobTitle} · ${e.city}`, meta: e }));
      case "car":
        return localData.carModels
          .filter((c) => c.label.toLowerCase().includes(q))
          .map((c) => ({ label: c.label, sub: `Avg ${fmt(c.avgPrice)} · ${c.totalSold} sold`, meta: c }));
      case "branch":
        return localData.branches
          .filter((b) => `${b.street} ${b.city}`.toLowerCase().includes(q))
          .map((b) => ({ label: b.city, sub: b.street, meta: b }));
      case "month":
        return localData.months
          .filter((m) => m.name.toLowerCase().includes(q))
          .map((m) => ({ label: m.name, sub: `Month filter`, meta: m }));
      case "year":
        return localData.years
          .filter((y) => String(y.year).includes(q))
          .map((y) => ({ label: String(y.year), sub: `${y.totalCarsSold} units · ${fmt(y.totalRevenue)}`, meta: y }));
      default:
        return [];
    }
  };

  return (
    <div className="flex h-full bg-zinc-950 text-slate-100">
      {/* ── Left Palette ─────────────────────────────────────────────────────── */}
      <div className="w-[320px] shrink-0 flex flex-col h-full border-r border-zinc-800/80 bg-zinc-950">
        {/* Header */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20"
            >
              <Layers className="w-3.5 h-3.5 text-red-500" />
            </div>
            <p className="text-xs font-bold text-slate-200">Canvas Node Palette</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-555 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search database nodes..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-850 bg-zinc-900/60 text-slate-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-500/60 transition-all"
            />
          </div>
        </div>

        {/* Accordion List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
          {(Object.keys(NODE_DEFS) as NodeKind[]).map((kind) => {
            const def = NODE_DEFS[kind];
            const SectionIcon = def.icon;
            const items = filterItems(kind);
            const isExpanded = expandedSections[kind];
            
            // If searching and this section has no items, hide it
            if (search && items.length === 0) return null;

            return (
              <div key={kind} className="space-y-1">
                {/* Section Header */}
                <button
                  onClick={() => setExpandedSections(prev => ({ ...prev, [kind]: !prev[kind] }))}
                  className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-zinc-900 transition-colors text-left text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <SectionIcon className="w-3.5 h-3.5 transition-colors" style={{ color: def.tabColor }} />
                    <span>{def.label}s</span>
                    <span className="text-[9px] font-bold text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded-full border border-zinc-800/40">
                      {items.length}
                    </span>
                  </div>
                  <span className="text-zinc-650 group-hover:text-zinc-450 text-[8px] transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    ▶
                  </span>
                </button>

                {/* Section Items */}
                {isExpanded && (
                  <div className="space-y-0.5 pl-1 pt-1">
                    {items.length === 0 ? (
                      <p className="text-[10px] text-zinc-600 italic pl-6 py-1">No items available</p>
                    ) : (
                      items.map((item) => (
                        <PaletteItem
                          key={`${item.label}-${JSON.stringify(item.meta)}`}
                          label={item.label}
                          sub={item.sub}
                          kind={kind}
                          onAdd={() => addNodeToCanvas(kind, item.label, item.sub, item.meta)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 p-3 border-t border-zinc-800/80 bg-zinc-950 space-y-2 shadow-inner">
          <button
            onClick={() => fitView({ duration: 600, padding: 0.15 })}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-750 text-slate-200 transition-all cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
            Fit Canvas
          </button>
          <button
            onClick={clearCanvas}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-red-400 bg-red-500/5 border border-red-500/10 hover:bg-red-500/15 hover:border-red-500/25 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Canvas
          </button>
        </div>
      </div>

      {/* ── Canvas ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden bg-[#09090b]">
        {/* Animated keyframes style */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes flow-dash {
            to {
              stroke-dashoffset: -20;
            }
          }
          .edge-flow-dash {
            stroke-dasharray: 6 8;
            animation: flow-dash 1.2s linear infinite;
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 5px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #27272a;
            border-radius: 9999px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #3f3f46;
          }
        ` }} />

        {/* Global Floating shortcut tip */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md border border-zinc-800/80 px-3.5 py-2 rounded-xl shadow-lg pointer-events-none select-none">
          <Sparkles className="w-3.5 h-3.5 text-red-400" />
          <span className="text-[10px] font-bold text-zinc-300">
            Press <kbd className="font-mono bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded border border-zinc-700 mx-0.5">Ctrl</kbd> + <kbd className="font-mono bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded border border-zinc-700 mx-0.5">K</kbd> to Ask AI Query
          </span>
        </div>

        {/* Canvas Toolbar Panel */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl shadow-xl">
          <button
            onClick={() => autoLayout("LR")}
            title="Auto Layout Horizontal"
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer flex items-center gap-1.5 text-[10px] font-bold"
          >
            <Layout className="w-3.5 h-3.5" />
            Layout (H)
          </button>
          <div className="w-px h-4 bg-zinc-800" />
          <button
            onClick={() => autoLayout("TB")}
            title="Auto Layout Vertical"
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer flex items-center gap-1.5 text-[10px] font-bold"
          >
            <Layout className="w-3.5 h-3.5 rotate-90" />
            Layout (V)
          </button>
          <div className="w-px h-4 bg-zinc-800" />
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="p-2 rounded-lg hover:bg-red-500/15 bg-red-500/10 text-red-400 hover:text-red-300 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold border border-red-500/20"
          >
            <Sparkles className="w-3 h-3 animate-pulse" />
            Ask AI
          </button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          className="bg-transparent"
          defaultEdgeOptions={{
            type: "flowing",
            animated: true,
            style: { stroke: "#b91c1c", strokeWidth: 2 },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#1f1f23" />
          <Controls className="!rounded-xl !overflow-hidden !shadow-lg !border-zinc-800 !bg-zinc-900 !text-slate-200" />
          <MiniMap
            nodeColor={(n) => NODE_DEFS[(n.data?.kind as NodeKind) ?? "employee"].tabColor}
            className="!bg-zinc-950 !border-zinc-800 !rounded-2xl !shadow-2xl"
            maskColor="rgba(9,9,11,0.65)"
            style={{ borderRadius: 16 }}
          />

          {/* Empty state panel */}
          {nodes.length === 0 && (
            <Panel position="top-center" style={{ marginTop: "12vh" }}>
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-5 text-center px-8 py-8 rounded-3xl bg-zinc-950 border border-zinc-850 shadow-2xl max-w-sm"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center border border-red-500/30"
                  style={{
                    background: "linear-gradient(135deg,rgba(220,38,38,0.1),rgba(239,68,68,0.1))",
                  }}
                >
                  <Sparkles className="w-7 h-7 text-red-400" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-slate-100">Interactive Sales Playground</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Build relation graphs between consultants, vehicle models, showrooms, and months to analyze revenue benchmarks.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {(Object.keys(NODE_DEFS) as NodeKind[]).map((k) => {
                    const d = NODE_DEFS[k];
                    return (
                      <span
                        key={k}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-white border border-white/10"
                        style={{ background: d.gradient }}
                      >
                        {d.label}
                      </span>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCommandPaletteOpen(true)}
                  className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ask AI to build graph
                </button>
              </motion.div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* ── Right Insight Panel ───────────────────────────────────────────────── */}
      <div className="w-[320px] shrink-0 h-full">
        <InsightPanel
          insight={insight}
          loading={insightLoading}
          edgeCount={edges.length}
          onClear={() => {
            setEdges([]);
            setInsight(null);
          }}
        />
      </div>

      {/* ── Command Palette Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {commandPaletteOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCommandPaletteOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -10 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden backdrop-blur-md"
            >
              {/* Search header */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800/80">
                <Search className="w-5 h-5 text-zinc-450 shrink-0" />
                <input
                  ref={commandInputRef}
                  type="text"
                  value={commandQuery}
                  onChange={(e) => setCommandQuery(e.target.value)}
                  onKeyDown={handleCommandKeyDown}
                  placeholder='Ask AI (e.g. "Show Corolla sales in Cairo") or type a command...'
                  className="w-full bg-transparent text-sm text-zinc-150 placeholder:text-zinc-650 focus:outline-none"
                />
                <button
                  onClick={() => setCommandPaletteOpen(false)}
                  className="text-[9px] font-bold bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  ESC
                </button>
              </div>

              {/* Palette content / suggestions */}
              <div className="max-h-[320px] overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                    <p className="text-xs font-bold text-zinc-500 animate-pulse">Gemini is structuring your graph canvas...</p>
                  </div>
                ) : (
                  <>
                    {commandQuery.trim().length > 0 && (
                      <button
                        onClick={() => handleAskAI(commandQuery)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-red-500/10 text-left transition-all text-xs font-bold text-red-400 border border-dashed border-red-500/20 bg-red-500/5 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-red-400 animate-pulse shrink-0" />
                          <span className="truncate">Run Natural Language Explorer: "{commandQuery}"</span>
                        </div>
                        <kbd className="text-[9px] text-red-300 font-mono bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30 shrink-0">Enter</kbd>
                      </button>
                    )}

                    {/* Quick Commands */}
                    <div>
                      <p className="px-3 py-1.5 text-[8px] font-extrabold uppercase tracking-widest text-zinc-550">Quick Commands</p>
                      {[
                        {
                          name: "Auto-Layout (Horizontal)",
                          desc: "Organize active nodes left-to-right using Dagre",
                          icon: Layout,
                          action: () => {
                            autoLayout("LR");
                            setCommandPaletteOpen(false);
                          },
                        },
                        {
                          name: "Auto-Layout (Vertical)",
                          desc: "Organize active nodes top-to-bottom using Dagre",
                          icon: Layout,
                          action: () => {
                            autoLayout("TB");
                            setCommandPaletteOpen(false);
                          },
                        },
                        {
                          name: "Clear Playground",
                          desc: "Remove all active nodes, edges and filter states",
                          icon: Trash2,
                          action: () => {
                            clearCanvas();
                            setCommandPaletteOpen(false);
                          },
                        },
                      ].map((cmd) => {
                        const CmdIcon = cmd.icon;
                        return (
                          <button
                            key={cmd.name}
                            onClick={cmd.action}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-900 text-left transition-all group cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-lg bg-zinc-900 group-hover:bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-850">
                              <CmdIcon className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-200">{cmd.name}</p>
                              <p className="text-[10px] text-zinc-555 mt-0.5 truncate">{cmd.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Presets suggestions */}
                    <div>
                      <p className="px-3 py-1.5 text-[8px] font-extrabold uppercase tracking-widest text-zinc-550">AI Presets Suggestions</p>
                      {[
                        "Show Michael Brown's Toyota Camry sales",
                        "Show Nissan Sunny performance in Port Christopher",
                        "Show Jennifer Johnson's sales in 2024",
                        "Show Tesla Model X deliveries in September",
                        "Show Robert Thompson's revenue in Thomasmouth",
                        "Show Mercedes GLA sales across 2025",
                      ].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handleAskAI(preset)}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-900 text-left transition-all text-xs text-zinc-400 group cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Sparkles className="w-3.5 h-3.5 text-red-500/50 group-hover:text-red-400 transition-colors shrink-0" />
                            <span className="truncate">{preset}</span>
                          </div>
                          <kbd className="text-[9px] text-zinc-650 group-hover:text-zinc-450 font-mono shrink-0">run</kbd>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
    <div className="flex flex-col bg-[#09090b]" style={{ height: "calc(100vh - 64px)" }}>
      {/* Body — full height, no top bar */}
      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 bg-[#09090b]">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-red-500/10 animate-ping" />
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center border border-red-500/20"
                style={{ background: "rgba(220,38,38,0.08)" }}
              >
                <Loader2 className="w-6 h-6 animate-spin text-red-500" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-bold text-slate-200">Initializing Relation Workspace...</p>
              <p className="text-[10px] text-slate-500">Mapping entity structures and telemetry models</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full bg-[#09090b]">
            <div className="text-center space-y-3 max-w-sm p-8 border border-red-500/15 rounded-3xl bg-red-500/5 shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto">
                <Info className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-xs font-bold text-red-400">Playground initialization failed</p>
              <p className="text-[10px] text-slate-500 font-mono leading-relaxed">{error}</p>
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
