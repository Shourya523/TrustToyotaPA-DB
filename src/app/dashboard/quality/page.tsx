"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import { getTableQuality, getUserConnections, getDatabaseMetadata, resolveConnectionUriAction } from "../../../actions/db";
import { DEFAULT_CONNECTION_ID } from "@/src/lib/database-uri";
import { authClient } from "@/src/components/landing/auth";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Loader2, AlertTriangle, CheckCircle2, BarChart3, Sparkles, Database, Search } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, Line, Legend } from "recharts";
import { motion } from "framer-motion";

const freshnessData = [
  { time: '00:00', writes: 12, reads: 400 },
  { time: '04:00', writes: 5, reads: 300 },
  { time: '08:00', writes: 80, reads: 1200 },
  { time: '12:00', writes: 150, reads: 2500 },
  { time: '16:00', writes: 130, reads: 2200 },
  { time: '20:00', writes: 45, reads: 800 },
];


export default function QualityPage() {
  const { data: session } = authClient.useSession();
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConn, setSelectedConn] = useState<string>("");
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  
  // NEW: State for the intermediate table fetching
  const [isFetchingTables, setIsFetchingTables] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [qualityData, setQualityData] = useState<any>(null);

  const DEMO_ID = DEFAULT_CONNECTION_ID;

  useEffect(() => {
    const fetchConns = async () => {
      let userConns: any[] = [];
      if (session?.user?.id) {
        const res = await getUserConnections(session.user.id);
        if (res.success) userConns = res.data || [];
      }
      const demoConn = { id: DEMO_ID, name: "Car Showroom Database (Neon)", isDemo: true };
      setConnections([demoConn, ...userConns]);
    };
    fetchConns();
  }, [session]);

  const getEffectiveUri = async (connId: string) => {
    const result = await resolveConnectionUriAction(connId, session?.user?.id);
    if (!result.success || !result.data) throw new Error(result.error || "Connection not found");
    return result.data;
  };

  const fetchTables = async (connId: string) => {
    if (!connId) {
      setSelectedConn("");
      setTables([]);
      return;
    }

    setSelectedConn(connId);
    setQualityData(null);
    setTables([]);
    setIsFetchingTables(true); // START LOADING

    try {
      const uri = await getEffectiveUri(connId);
      if (!uri) return;

      const res = await getDatabaseMetadata(uri);

      if (res.success && res.data?.schema) {
        const schemaArray = res.data.schema;
        const uniqueTableNames = Array.from(
          new Set(schemaArray.map((s: any) => s.table_name || s.TABLE_NAME))
        ).filter(Boolean);

        const mappedTables = uniqueTableNames.map(name => ({
          name: name as string,
          columns: schemaArray.filter((s: any) =>
            (s.table_name || s.TABLE_NAME) === name
          )
        }));

        setTables(mappedTables);
      }
    } catch (err) {
      console.error("Error in fetchTables:", err);
    } finally {
      setIsFetchingTables(false); // STOP LOADING
    }
  };

  const runAudit = async () => {
    const tableObj = tables.find(t => t.name === selectedTable);
    if (!selectedConn || !tableObj) return;

    setIsAnalyzing(true);
    try {
      const uri = await getEffectiveUri(selectedConn);
      if (!uri) throw new Error("Connection URI not found");

      const res = await getTableQuality(uri, selectedTable, tableObj.columns);
      if (res.success) setQualityData(res.data);
    } catch (err) {
      console.error("Audit failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Data Quality Audit</h1>
        <p className="text-sm text-muted-foreground">Analyze completeness, uniqueness, and statistical health.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 items-end">
        {/* Connection Selection */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">Database Source</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-all focus:ring-2 focus:ring-primary outline-none"
            value={selectedConn}
            onChange={(e) => fetchTables(e.target.value)}
          >
            <option value="">Select Connection</option>
            {connections.map(c => (
              <option key={c.id} value={c.id}>
                {c.isDemo ? "✨ " : ""}{c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Table Selection with Inline Loader */}
        <div className="space-y-1.5 relative">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">Schema Table</label>
          <div className="relative">
            <select
              className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-all outline-none ${isFetchingTables ? 'opacity-50 cursor-not-allowed' : 'opacity-100'}`}
              disabled={!tables.length || isFetchingTables}
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
            >
              <option value="">{isFetchingTables ? "Loading schema..." : "Select Table"}</option>
              {tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
            {isFetchingTables && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>

        {/* Audit Button */}
        <Button 
          onClick={runAudit} 
          className="h-10 shadow-lg shadow-primary/10 transition-all hover:scale-[1.02]"
          disabled={!selectedTable || isAnalyzing || isFetchingTables}
        >
          {isAnalyzing ? (
            <Loader2 className="animate-spin mr-2 w-4 h-4" />
          ) : (
            <Sparkles className="mr-2 w-4 h-4" />
          )}
          {isAnalyzing ? "Analyzing Rows..." : "Run Quality Audit"}
        </Button>
      </div>

      {/* Loading Placeholder for Results */}
      {!qualityData && isAnalyzing && (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-3xl bg-muted/5 animate-pulse">
          <BarChart3 className="w-10 h-10 text-muted-foreground/20 mb-4" />
          <p className="text-sm text-muted-foreground">Running statistical analysis on <span className="font-mono font-bold text-primary">{selectedTable}</span>...</p>
        </div>
      )}

      {qualityData && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          {/* Header Card */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-primary/5 border-primary/20 relative overflow-hidden flex items-center gap-4">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Records</p>
                <p className="text-2xl font-black">{qualityData.totalRows.toLocaleString()}</p>
              </div>
              {selectedConn === DEMO_ID && (
                <Sparkles className="absolute -right-2 -top-2 w-12 h-12 text-primary/10 rotate-12" />
              )}
            </Card>
          </div>

          {/* Visual Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {/* Radar Chart for Table Health */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="p-4 flex flex-col items-center bg-card/60 backdrop-blur-xl border-white/5 shadow-lg">
                <h3 className="font-bold text-sm w-full text-left mb-2">Column Health Overview</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={qualityData.metrics.map((m: any) => ({
                      subject: m.column.length > 10 ? m.column.substring(0, 10) + '...' : m.column,
                      completeness: m.completeness,
                      uniqueness: m.uniqueness
                    }))}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Completeness" dataKey="completeness" stroke="hsl(145 63% 42%)" fill="hsl(145 63% 42%)" fillOpacity={0.4} />
                      <Radar name="Uniqueness" dataKey="uniqueness" stroke="hsl(200 75% 45%)" fill="hsl(200 75% 45%)" fillOpacity={0.4} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsla(var(--card)/0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-muted-foreground"><div className="w-2 h-2 rounded-full shadow-sm bg-[hsl(145_63%_42%)]"></div> Completeness</div>
                  <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-muted-foreground"><div className="w-2 h-2 rounded-full shadow-sm bg-[hsl(200_75%_45%)]"></div> Uniqueness</div>
                </div>
              </Card>
            </motion.div>

            {/* Bar Chart for Completeness */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="p-4 flex flex-col bg-card/60 backdrop-blur-xl border-white/5 shadow-lg">
                <h3 className="font-bold text-sm mb-2">Completeness by Column</h3>
                <div className="h-[250px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={qualityData.metrics} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                      <defs>
                        <linearGradient id="completeBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="column" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} angle={-45} textAnchor="end" axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsla(var(--card)/0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
                      <Bar dataKey="completeness" fill="url(#completeBar)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Freshness Timeline */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-4">
            <Card className="p-4 bg-card/60 backdrop-blur-xl border-white/5 shadow-lg">
              <h3 className="font-bold text-sm mb-4">Data Freshness over Time</h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={freshnessData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="writeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(145 63% 42%)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(145 63% 42%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="time" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsla(var(--card)/0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="writes" name="Data Writes" fill="url(#writeGradient)" stroke="hsl(145 63% 42%)" strokeWidth={2} />
                    <Line type="monotone" dataKey="reads" name="Data Reads" stroke="hsl(200 75% 45%)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>

          {/* Metric Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {qualityData.metrics.map((m: any, index: number) => (
              <Card 
                key={m.column} 
                className="p-5 space-y-4 hover:border-primary/40 transition-all hover:shadow-xl hover:shadow-primary/5 group border-muted shadow-sm"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm font-mono group-hover:text-primary transition-colors">{m.column}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{m.type}</p>
                  </div>
                  {m.completeness === 100 ? (
                    <div className="bg-green-500/10 p-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 p-1 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-muted-foreground uppercase tracking-tighter">Completeness</span>
                    <span className={m.completeness > 90 ? 'text-green-500' : 'text-amber-500'}>
                      {m.completeness.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ease-out ${m.completeness > 90 ? 'bg-green-500' : 'bg-amber-500'}`}
                      style={{ width: `${m.completeness}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/40">
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Uniqueness</p>
                    <p className="text-sm font-black">{m.uniqueness.toFixed(1)}%</p>
                  </div>
                  {m.avg !== null && (
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Mean Value</p>
                      <p className="text-sm font-black text-primary">{Number(m.avg).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}