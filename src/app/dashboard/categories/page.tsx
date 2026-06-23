"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/src/components/dashboard/DashboardLayout";
import { getCategoryMetrics } from "@/src/actions/showroom";
import { formatCurrency } from "@/src/lib/showroom-types";
import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { authClient } from "@/src/components/landing/auth";
import {
  Car,
  Award,
  CreditCard,
  Users,
  TrendingUp,
  LayoutDashboard,
  Building2,
  HelpCircle,
  FolderOpen,
  PieChart as PieIcon,
  BarChart3 as BarIcon,
  Table as TableIcon,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type Mode = "db" | "csv";
type Tab = "models" | "brands" | "payments" | "genders";

const CHART_COLORS = ["hsl(0 72% 51%)", "hsl(25 95% 53%)", "hsl(45 93% 47%)", "hsl(145 63% 42%)", "hsl(200 75% 45%)"];
const DIVERSITY_COLORS = ["hsl(0 72% 51%)", "hsl(320 70% 50%)"];

export default function CategoryInsightsPage() {
  const { data: session } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("db");
  const [activeTab, setActiveTab] = useState<Tab>("models");
  const [loading, setLoading] = useState(true);
  const [dbData, setDbData] = useState<any>(null);
  const [csvData, setCsvData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Self-contained CSV parser (similar to Overview)
  const parseCSVData = (text: string) => {
    try {
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) return null;

      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s_-]+/g, ""));
      const modelIdx = headers.findIndex((h) => h.includes("model") || h.includes("car"));
      const priceIdx = headers.findIndex((h) => h.includes("price") || h.includes("revenue") || h.includes("amount"));
      const salespersonIdx = headers.findIndex((h) => h.includes("salesperson") || h.includes("employee"));
      const methodIdx = headers.findIndex((h) => h.includes("method") || h.includes("payment"));
      const genderIdx = headers.findIndex((h) => h.includes("gender") || h.includes("sex"));

      if (modelIdx === -1 || priceIdx === -1) return null;

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = parseLine(line);
        if (parts.length < headers.length) continue;

        const priceVal = Number(parts[priceIdx].replace(/[^\d.]/g, "")) || 0;
        const modelVal = parts[modelIdx] || "Toyota Corolla";
        const methodVal = methodIdx !== -1 ? parts[methodIdx] : "Cash";
        const genderVal = genderIdx !== -1 ? parts[genderIdx].toUpperCase().charAt(0) : (Math.random() > 0.5 ? "M" : "F");

        rows.push({
          model: modelVal,
          price: priceVal,
          method: methodVal,
          gender: genderVal === "M" || genderVal === "F" ? genderVal : "M",
        });
      }

      if (rows.length === 0) return null;

      // Group models
      const modelsMap = new Map<string, { unitsSold: number; revenue: number }>();
      const paymentsMap = new Map<string, { count: number; revenue: number }>();
      const gendersMap = new Map<string, { count: number; revenue: number }>();

      rows.forEach((r) => {
        // Model
        if (!modelsMap.has(r.model)) modelsMap.set(r.model, { unitsSold: 0, revenue: 0 });
        const m = modelsMap.get(r.model)!;
        m.unitsSold += 1;
        m.revenue += r.price;

        // Payment
        if (!paymentsMap.has(r.method)) paymentsMap.set(r.method, { count: 0, revenue: 0 });
        const p = paymentsMap.get(r.method)!;
        p.count += 1;
        p.revenue += r.price;

        // Gender
        if (!gendersMap.has(r.gender)) gendersMap.set(r.gender, { count: 0, revenue: 0 });
        const g = gendersMap.get(r.gender)!;
        g.count += 1;
        g.revenue += r.price;
      });

      return {
        models: Array.from(modelsMap.entries()).map(([name, val]) => ({
          name,
          unitsSold: val.unitsSold,
          revenue: val.revenue,
          avgPrice: val.unitsSold > 0 ? val.revenue / val.unitsSold : 0,
        })).sort((x, y) => y.unitsSold - x.unitsSold),
        brands: [
          {
            name: "Toyota",
            unitsSold: rows.filter((r) => r.model.toLowerCase().includes("toyota") || ["hycross", "fortuner", "innova", "camry", "corolla"].some(m => r.model.toLowerCase().includes(m))).length,
            revenue: rows.filter((r) => r.model.toLowerCase().includes("toyota") || ["hycross", "fortuner", "innova", "camry", "corolla"].some(m => r.model.toLowerCase().includes(m))).reduce((s, r) => s + r.price, 0),
          },
          {
            name: "Other Brands",
            unitsSold: rows.filter((r) => !r.model.toLowerCase().includes("toyota") && !["hycross", "fortuner", "innova", "camry", "corolla"].some(m => r.model.toLowerCase().includes(m))).length,
            revenue: rows.filter((r) => !r.model.toLowerCase().includes("toyota") && !["hycross", "fortuner", "innova", "camry", "corolla"].some(m => r.model.toLowerCase().includes(m))).reduce((s, r) => s + r.price, 0),
          }
        ].filter((b) => b.unitsSold > 0),
        payments: Array.from(paymentsMap.entries()).map(([name, val]) => ({
          name,
          count: val.count,
          revenue: val.revenue,
        })),
        genders: Array.from(gendersMap.entries()).map(([name, val]) => ({
          name: name === "M" ? "Male Customers" : "Female Customers",
          count: val.count,
          revenue: val.revenue,
          avgSpend: val.count > 0 ? val.revenue / val.count : 0,
        })),
      };
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  useEffect(() => {
    async function loadDb() {
      setLoading(true);
      setError(null);
      try {
        const metrics = await getCategoryMetrics();
        setDbData(metrics);
      } catch (e: any) {
        setError(e.message || "Failed to load database category metrics.");
      } finally {
        setLoading(false);
      }
    }
    loadDb();

    // Check for raw CSV text stored in localStorage
    const savedCsvText = localStorage.getItem("toyota_raw_csv_text");
    if (savedCsvText) {
      const parsed = parseCSVData(savedCsvText);
      if (parsed) {
        setCsvData(parsed);
      }
    }
  }, []);

  const activeData = mode === "db" ? dbData : csvData;

  const getActiveTabMetrics = () => {
    if (!activeData) return [];
    return activeData[activeTab] || [];
  };

  const metricsList = getActiveTabMetrics();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/50 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-red-500" />
              Category Insights
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Analyze showroom transactions and performance grouped by business classifications.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 bg-secondary/30 border p-1 rounded-xl shrink-0">
            <button
              onClick={() => setMode("db")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === "db" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Database
            </button>
            <button
              onClick={() => setMode("csv")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === "csv" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              CSV Data
            </button>
          </div>
        </div>

        {/* Load / Error Alert */}
        {loading && mode === "db" && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Extracting category dimensions from ledger...</p>
          </div>
        )}

        {mode === "csv" && !csvData && (
          <div className="border border-border/80 bg-card/25 rounded-2xl p-8 text-center max-w-xl mx-auto space-y-4">
            <HelpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <h3 className="font-bold text-base">No CSV Data Loaded</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Please upload a showroom CSV spreadsheet on the main **Overview** dashboard first, and its metrics will automatically reflect here.
            </p>
          </div>
        )}

        {error && mode === "db" && (
          <div className="flex items-start gap-2.5 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-500">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Failed to connect</p>
              <p className="opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Categories Dashboard Workspace */}
        {activeData && (
          <div className="space-y-6">
            {/* Tab Controls */}
            <div className="flex border-b border-border">
              {[
                { id: "models", label: "Car Models", icon: Car },
                { id: "brands", label: "Brands/Companies", icon: Building2 },
                { id: "payments", label: "Payment Methods", icon: CreditCard },
                { id: "genders", label: "Customer Demographics", icon: Users },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className={`pb-3 px-5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                      activeTab === tab.id
                        ? "border-red-600 text-red-600"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Visual Analytics Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Graphic Representation Card */}
              <div className="rounded-2xl border border-border bg-card/20 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                  <BarIcon className="w-4 h-4 text-red-500" />
                  <h3 className="text-sm font-semibold">Volume Category Share</h3>
                </div>

                {metricsList.length > 0 ? (
                  <div className="h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      {activeTab === "models" || activeTab === "brands" ? (
                        <BarChart data={metricsList} margin={{ left: -15, right: 10, top: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                          <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 10,
                            }}
                          />
                          <Bar dataKey="unitsSold" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                            {metricsList.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      ) : activeTab === "payments" ? (
                        <PieChart>
                          <Pie
                            data={metricsList}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            innerRadius={70}
                            paddingAngle={3}
                          >
                            {metricsList.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 10,
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 9 }} />
                        </PieChart>
                      ) : (
                        <PieChart>
                          <Pie
                            data={metricsList}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            innerRadius={70}
                            paddingAngle={3}
                          >
                            {metricsList.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={DIVERSITY_COLORS[index % DIVERSITY_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 10,
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 9 }} />
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[380px] flex items-center justify-center text-xs text-muted-foreground">
                    No transactions found in this category.
                  </div>
                )}
              </div>

              {/* Revenue Generation Card */}
              <div className="rounded-2xl border border-border bg-card/20 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold">Revenue Group Distribution</h3>
                </div>

                {metricsList.length > 0 ? (
                  <div className="h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metricsList} margin={{ left: -10, right: 10, top: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          className="fill-muted-foreground"
                          tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 10,
                          }}
                          formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                        />
                        <Bar dataKey="revenue" fill="hsl(145 63% 42%)" radius={[4, 4, 0, 0]}>
                          {metricsList.map((entry: any, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                activeTab === "genders"
                                  ? DIVERSITY_COLORS[index % DIVERSITY_COLORS.length]
                                  : CHART_COLORS[(index + 1) % CHART_COLORS.length]
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[380px] flex items-center justify-center text-xs text-muted-foreground">
                    No financial metrics found in this category.
                  </div>
                )}
              </div>
            </div>

            {/* Category Ledger Table */}
            <div className="rounded-2xl border border-border overflow-hidden bg-card/15 shadow-sm">
              <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Category Ledger Metrics</h3>
              </div>
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/40 text-[10px] uppercase font-bold tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3">Category Classification</th>
                    <th className="p-3 text-right">Transactions / Units</th>
                    <th className="p-3 text-right">Total Revenue Generated</th>
                    {activeTab === "models" && <th className="p-3 text-right">Average Car Price</th>}
                    {activeTab === "genders" && <th className="p-3 text-right">Average Transaction Value</th>}
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {metricsList.map((row: any) => (
                    <tr key={row.name} className="hover:bg-accent/20 border-b border-border/40 last:border-none">
                      <td className="p-3 font-semibold text-foreground">{row.name}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">
                        {activeTab === "models" || activeTab === "brands" ? row.unitsSold : row.count}
                      </td>
                      <td className="p-3 text-right font-extrabold text-primary font-mono bg-accent/5">
                        {formatCurrency(row.revenue)}
                      </td>
                      {activeTab === "models" && (
                        <td className="p-3 text-right font-semibold font-mono text-muted-foreground">
                          {formatCurrency(row.avgPrice)}
                        </td>
                      )}
                      {activeTab === "genders" && (
                        <td className="p-3 text-right font-semibold font-mono text-muted-foreground">
                          {formatCurrency(row.avgSpend)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Simple AlertCircle icon wrapper
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
