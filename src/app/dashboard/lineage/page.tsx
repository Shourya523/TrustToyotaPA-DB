"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  Handle,
  Position,
  MarkerType,
  Node,
  Edge,
  EdgeLabelRenderer,
  getBezierPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";

import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import { getUserConnections, getRelationsForConnection, resolveConnectionUriAction } from "../../../actions/db";
import { DEFAULT_CONNECTION_ID } from "@/src/lib/database-uri";
import { getColumnLineage } from "../../../actions/graphQueries";
import { authClient } from "@/src/components/landing/auth";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Loader2, Table2, Network, Columns3, Search, AlertTriangle } from "lucide-react";

const DEMO_CONN = DEFAULT_CONNECTION_ID;

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], columnMode: boolean) => {
  const nodeHeight = columnMode ? 320 : 250;
  dagreGraph.setGraph({ rankdir: "LR", nodesep: columnMode ? 150 : 100, ranksep: columnMode ? 300 : 250 });
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: 250, height: nodeHeight }));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: { x: nodeWithPosition.x - 125, y: nodeWithPosition.y - nodeHeight / 2 },
    };
  });
  return { nodes: layoutedNodes, edges };
};

function ColumnEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
}: any) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path id={id} className="react-flow__edge-path" d={edgePath} style={style} markerEnd={markerEnd} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-card border border-primary/30 text-primary shadow-sm"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const TableNode = ({ data }: any) => {
  const columnMode = data.columnMode;
  const highlighted = data.highlightedColumns as Set<string> | undefined;
  const selectedColumn = data.selectedColumn as string | undefined;

  return (
    <div className="relative">
      {!columnMode && (
        <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-primary border-2 border-background" />
      )}
      <Card className={`min-w-[220px] border-primary/20 shadow-2xl bg-card overflow-hidden ${data.isHighlighted ? "ring-2 ring-primary" : ""}`}>
        <div className="bg-primary/10 px-3 py-2 border-b border-primary/10 flex items-center gap-2">
          <Table2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-widest">{data.label}</span>
        </div>
        <div className="p-2 space-y-0.5 bg-background/50 max-h-[280px] overflow-y-auto">
          {data.columns.map((col: { name: string; isFk?: boolean; isPk?: boolean }) => {
            const colId = `${data.label}.${col.name}`;
            const isHighlighted = highlighted?.has(colId);
            const isSelected = selectedColumn === colId;
            const isFk = col.isFk || col.name.toLowerCase().includes("id");

            return (
              <div key={col.name} className="relative">
                {columnMode && (
                  <>
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={`${data.label}.${col.name}-target`}
                      className="!w-2 !h-2 !bg-blue-500 !border-background"
                      style={{ top: "50%" }}
                    />
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`${data.label}.${col.name}-source`}
                      className="!w-2 !h-2 !bg-primary !border-background"
                      style={{ top: "50%" }}
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => data.onColumnClick?.(data.label, col.name)}
                  className={`w-full text-[10px] font-mono flex items-center justify-between px-1.5 py-1 rounded transition-colors ${
                    isSelected
                      ? "bg-primary/20 text-primary font-bold"
                      : isHighlighted
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className={isFk ? "text-primary font-bold" : ""}>{col.name}</span>
                  <span className="flex gap-0.5">
                    {col.isPk && <span className="text-[7px] bg-primary/10 text-primary px-1 rounded font-bold">PK</span>}
                    {col.isFk && <span className="text-[7px] bg-blue-500/10 text-blue-500 px-1 rounded font-bold">FK</span>}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </Card>
      {!columnMode && (
        <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-primary border-2 border-background" />
      )}
    </div>
  );
};

const nodeTypes = { table: TableNode };
const edgeTypes = { column: ColumnEdge };
const proOptions = { hideAttribution: true };

type Relation = {
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
};

export default function LineagePage() {
  const { data: session, isPending } = authClient.useSession();
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConn, setSelectedConn] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "column">("table");
  const [relations, setRelations] = useState<Relation[]>([]);
  const [tableGroups, setTableGroups] = useState<Record<string, { name: string; isFk: boolean; isPk: boolean }[]>>({});
  const [columnSearch, setColumnSearch] = useState("");
  const [selectedColumn, setSelectedColumn] = useState<{ table: string; column: string } | null>(null);
  const [lineageInfo, setLineageInfo] = useState<any>(null);
  const [loadingLineage, setLoadingLineage] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPending) {
      if (session?.user?.id) {
        getUserConnections(session.user.id).then((res) => {
          if (res.success) setConnections(res.data || []);
        });
      } else {
        visualizeLineage(DEMO_CONN);
      }
    }
  }, [session, isPending]);

  const highlightedColumns = useMemo(() => {
    const set = new Set<string>();
    if (!selectedColumn || !lineageInfo) return set;
    set.add(`${selectedColumn.table}.${selectedColumn.column}`);
    lineageInfo.upstream?.forEach((n: any) => set.add(`${n.table}.${n.column}`));
    lineageInfo.downstream?.forEach((n: any) => set.add(`${n.table}.${n.column}`));
    return set;
  }, [selectedColumn, lineageInfo]);

  const handleColumnClick = useCallback(async (table: string, column: string) => {
    setSelectedColumn({ table, column });
    if (!selectedConn || selectedConn === DEMO_CONN) return;

    setLoadingLineage(true);
    const info = await getColumnLineage(table, column, selectedConn);
    setLineageInfo(info);
    setLoadingLineage(false);
  }, [selectedConn]);

  const buildGraph = useCallback((
    tableGroups: Record<string, { name: string; isFk: boolean; isPk: boolean }[]>,
    rels: Relation[],
    mode: "table" | "column",
    onColClick: (t: string, c: string) => void,
    highlighted: Set<string>,
    focused: { table: string; column: string } | null,
  ) => {
    const highlightedTables = new Set<string>();
    if (focused) {
      highlightedTables.add(focused.table);
      rels.forEach((r) => {
        if (r.source_table === focused.table && r.source_column === focused.column) highlightedTables.add(r.target_table);
        if (r.target_table === focused.table && r.target_column === focused.column) highlightedTables.add(r.source_table);
      });
    }

    const initialNodes: Node[] = Object.entries(tableGroups).map(([name, columns]) => ({
      id: name,
      type: "table",
      position: { x: 0, y: 0 },
      data: {
        label: name,
        columns,
        columnMode: mode === "column",
        onColumnClick: onColClick,
        highlightedColumns: highlighted,
        selectedColumn: focused ? `${focused.table}.${focused.column}` : undefined,
        isHighlighted: highlightedTables.has(name),
      },
    }));

    let initialEdges: Edge[];

    if (mode === "column") {
      initialEdges = rels.map((rel, i) => ({
        id: `e-${i}`,
        source: rel.source_table,
        target: rel.target_table,
        sourceHandle: `${rel.source_table}.${rel.source_column}-source`,
        targetHandle: `${rel.target_table}.${rel.target_column}-target`,
        type: "column",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "hsl(var(--primary))" },
        style: {
          stroke: highlighted.size > 0 &&
            (highlighted.has(`${rel.source_table}.${rel.source_column}`) ||
              highlighted.has(`${rel.target_table}.${rel.target_column}`))
            ? "hsl(var(--primary))"
            : "hsl(var(--muted-foreground) / 0.4)",
          strokeWidth: highlighted.size > 0 &&
            (highlighted.has(`${rel.source_table}.${rel.source_column}`) ||
              highlighted.has(`${rel.target_table}.${rel.target_column}`))
            ? 2.5
            : 1.5,
        },
        data: { label: `${rel.source_column} → ${rel.target_column}` },
      }));
    } else {
      const seen = new Set<string>();
      initialEdges = rels.reduce<Edge[]>((acc, rel, i) => {
        const key = `${rel.source_table}->${rel.target_table}`;
        if (seen.has(key)) return acc;
        seen.add(key);
        acc.push({
          id: `e-${i}`,
          source: rel.source_table,
          target: rel.target_table,
          animated: true,
          type: ConnectionLineType.SmoothStep,
          markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: "hsl(var(--primary))" },
          style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
        });
        return acc;
      }, []);
    }

    const { nodes: lNodes, edges: lEdges } = getLayoutedElements(initialNodes, initialEdges, mode === "column");
    setNodes(lNodes as Node[]);
    setEdges(lEdges as Edge[]);
  }, [setNodes, setEdges]);

  const visualizeLineage = async (connId: string) => {
    if (!connId) return;
    setSelectedConn(connId);
    setLoading(true);
    setSelectedColumn(null);
    setLineageInfo(null);

    try {
      const res = await getRelationsForConnection(connId, session?.user?.id);
      if (res.success && res.data) {
        const data = res.data as any;
        const fkColumns = new Set<string>();
        const rels: Relation[] = data.relations || [];
        rels.forEach((r: Relation) => {
          fkColumns.add(`${r.source_table}.${r.source_column}`);
        });

        const tableGroups: Record<string, { name: string; isFk: boolean; isPk: boolean }[]> = {};
        data.schema.forEach((curr: any) => {
          const tableName = curr.table_name || curr.TABLE_NAME;
          const columnName = curr.column_name || curr.COLUMN_NAME;
          const isPk = curr.is_primary_key === true || curr.is_primary_key === "true";
          const isFk = fkColumns.has(`${tableName}.${columnName}`) || curr.is_foreign_key;
          if (!tableGroups[tableName]) tableGroups[tableName] = [];
          tableGroups[tableName].push({ name: columnName, isFk, isPk });
        });

        setRelations(rels);
        setTableGroups(tableGroups);
        buildGraph(tableGroups, rels, viewMode, handleColumnClick, highlightedColumns, selectedColumn);
      }
    } catch (err) {
      console.error("Lineage Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedConn || relations.length === 0 || Object.keys(tableGroups).length === 0) return;
    buildGraph(tableGroups, relations, viewMode, handleColumnClick, highlightedColumns, selectedColumn);
  }, [viewMode, highlightedColumns, selectedColumn, relations, tableGroups, buildGraph, handleColumnClick, selectedConn]);

  const filteredColumns = useMemo(() => {
    if (!columnSearch.trim()) return [];
    const q = columnSearch.toLowerCase();
    const results: { table: string; column: string }[] = [];
    relations.forEach((r) => {
      if (r.source_column.toLowerCase().includes(q)) results.push({ table: r.source_table, column: r.source_column });
      if (r.target_column.toLowerCase().includes(q)) results.push({ table: r.target_table, column: r.target_column });
    });
    return results.slice(0, 8);
  }, [columnSearch, relations]);

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Data Lineage</h1>
            <p className="text-sm text-muted-foreground">
              {viewMode === "column"
                ? "Column-level FK mapping — click a column to trace upstream/downstream impact."
                : "Table-level ER diagram showing how tables connect."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-input overflow-hidden">
              <Button
                size="sm"
                variant={viewMode === "table" ? "default" : "ghost"}
                className="rounded-none h-9 text-xs"
                onClick={() => setViewMode("table")}
              >
                <Network className="w-3.5 h-3.5 mr-1.5" /> Table View
              </Button>
              <Button
                size="sm"
                variant={viewMode === "column" ? "default" : "ghost"}
                className="rounded-none h-9 text-xs"
                onClick={() => setViewMode("column")}
              >
                <Columns3 className="w-3.5 h-3.5 mr-1.5" /> Column View
              </Button>
            </div>

            {session && (
              <select
                className="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm outline-none"
                onChange={(e) => visualizeLineage(e.target.value)}
                value={selectedConn}
              >
                <option value="">Select Connection...</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {viewMode === "column" && (
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search columns (e.g. user_id)..."
                value={columnSearch}
                onChange={(e) => setColumnSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm outline-none"
              />
              {filteredColumns.length > 0 && columnSearch && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
                  {filteredColumns.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-muted transition-colors"
                      onClick={() => {
                        handleColumnClick(c.table, c.column);
                        setColumnSearch(`${c.table}.${c.column}`);
                      }}
                    >
                      <span className="text-muted-foreground">{c.table}.</span>
                      <span className="text-primary font-bold">{c.column}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedColumn && (
              <Card className="flex-1 px-4 py-2 flex items-center gap-4 border-primary/20 bg-primary/5">
                {loadingLineage ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Focus: </span>
                      <span className="font-mono font-bold text-primary">{selectedColumn.table}.{selectedColumn.column}</span>
                    </div>
                    {lineageInfo && (
                      <>
                        <div className="text-xs text-muted-foreground">
                          ↑ {lineageInfo.upstream?.length ?? 0} upstream · ↓ {lineageInfo.downstream?.length ?? 0} downstream
                        </div>
                        {lineageInfo.affectedCount > 0 && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {lineageInfo.affectedCount} related column{lineageInfo.affectedCount !== 1 ? "s" : ""} affected
                          </div>
                        )}
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => { setSelectedColumn(null); setLineageInfo(null); }}>
                      Clear
                    </Button>
                  </>
                )}
              </Card>
            )}
          </div>
        )}

        <div className="flex-1 border rounded-2xl bg-muted/5 relative overflow-hidden shadow-inner">
          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {!selectedConn && !loading && session && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <Network className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">Select a connection to view lineage map</p>
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            proOptions={proOptions}
            fitView
          >
            <Background gap={20} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
    </DashboardLayout>
  );
}
