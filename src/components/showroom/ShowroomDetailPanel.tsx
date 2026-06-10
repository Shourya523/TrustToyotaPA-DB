"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Phone,
  MapPin,
  Users,
  TrendingUp,
  Car,
  Wallet,
  Award,
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency, type BranchStats } from "@/src/lib/showroom-types";
import { Badge } from "@/src/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";

type ShowroomDetailPanelProps = {
  stats: BranchStats & { reportMonth: string };
  loading?: boolean;
  onBack: () => void;
};

const PIE_COLORS = ["hsl(145 72% 45%)", "hsl(200 70% 50%)", "hsl(280 60% 55%)"];

export default function ShowroomDetailPanel({ stats, loading, onBack }: ShowroomDetailPanelProps) {
  const { branch, reportMonth, sales } = stats;
  const topPerformer = sales.find((s) => s.carsSold > 0) ?? sales[0];

  const chartData = sales
    .filter((e) => e.revenue > 0)
    .slice(0, 8)
    .map((e) => ({ name: e.fname, revenue: e.revenue, cars: e.carsSold }));

  const paymentData = stats.paymentBreakdown.filter((p) => p.count > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to {branch.city}
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold tracking-tight">{branch.street} Showroom</h2>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                Branch #{branch.branchId}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {branch.street}, Bldg {branch.buildingNumber}, {branch.city}, Egypt
              </span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                +20 {branch.contactNumber}
              </span>
            </p>
          </div>
          <Badge className="self-start bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
            {reportMonth}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Monthly Revenue", value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: "text-primary" },
          { label: "Cars Sold", value: stats.totalCarsSold.toString(), icon: Car, color: "text-blue-500" },
          { label: "Staff", value: stats.employeeCount.toString(), icon: Users, color: "text-purple-500" },
          { label: "Total Payroll", value: formatCurrency(stats.totalPayroll), icon: Wallet, color: "text-amber-500" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      {topPerformer && topPerformer.carsSold > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Award className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">
              Top Performer — {reportMonth}
            </p>
            <p className="font-semibold">
              {topPerformer.fname} {topPerformer.lname}
            </p>
            <p className="text-xs text-muted-foreground">
              {topPerformer.jobTitle} · {topPerformer.carsSold} cars · {formatCurrency(topPerformer.revenue)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              +{formatCurrency(topPerformer.commission)}
            </p>
            <p className="text-[10px] text-muted-foreground">commission</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card/30 p-4">
          <p className="text-sm font-semibold mb-4">Employee Sales — {reportMonth}</p>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
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
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-12 text-center">No sales recorded for this month.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card/30 p-4">
          <p className="text-sm font-semibold mb-4">Payment Methods</p>
          {paymentData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    dataKey="count"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                  >
                    {paymentData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {paymentData.map((p, i) => (
                  <div key={p.method} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {p.method} ({p.count})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No payment data.</p>
          )}
        </div>
      </div>

      {stats.monthlyTrend.length > 0 && (
        <div className="rounded-xl border border-border bg-card/30 p-4">
          <p className="text-sm font-semibold mb-4">Revenue Trend</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={stats.monthlyTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
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
                  fontSize: 12,
                }}
                formatter={(value: number) => [formatCurrency(value), "Revenue"]}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="sales">Sales & Commission</TabsTrigger>
          <TabsTrigger value="payroll">Payroll & Info</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Cars Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Top Model</TableHead>
                  <TableHead>Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((emp) => (
                  <TableRow key={emp.ssn}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {emp.fname} {emp.lname}
                        </p>
                        <p className="text-[10px] text-muted-foreground">SSN #{emp.ssn}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{emp.jobTitle}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{emp.carsSold}</TableCell>
                    <TableCell className="text-right tabular-nums text-primary">{formatCurrency(emp.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(emp.commission)}</TableCell>
                    <TableCell className="text-xs">{emp.topModel}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px]">
                        {emp.paymentMethod}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="payroll" className="mt-4">
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Base Salary</TableHead>
                  <TableHead className="text-right">Comm %</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>City</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((emp) => (
                  <TableRow key={emp.ssn}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {emp.fname} {emp.lname}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Born {emp.birthDate}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{emp.jobTitle}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(emp.salary)}</TableCell>
                    <TableCell className="text-right tabular-nums">{(emp.commPct * 100).toFixed(0)}%</TableCell>
                    <TableCell>{emp.gender === "M" ? "Male" : "Female"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{emp.phone1}</TableCell>
                    <TableCell className="text-xs">{emp.city}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
