"use client";

import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import { Card } from "../../../components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ShieldAlert, ShieldCheck, Lock, Unlock } from "lucide-react";

const piiData = [
  { name: "Non-PII", value: 75 },
  { name: "Encrypted PII", value: 20 },
  { name: "Unencrypted PII", value: 5 },
];

const riskData = [
  { schema: "public", riskScore: 15 },
  { schema: "sales", riskScore: 45 },
  { schema: "hr", riskScore: 85 },
  { schema: "finance", riskScore: 65 },
  { schema: "logs", riskScore: 5 },
];

const COLORS = ["hsl(145 63% 42%)", "hsl(45 93% 47%)", "hsl(0 72% 51%)"];

export default function CompliancePage() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Compliance & Security</h1>
        <p className="text-sm text-muted-foreground">Track sensitive data, encryption status, and governance policies.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-[hsl(145_63%_42%)]">
          <div className="bg-green-500/10 p-3 rounded-xl">
            <ShieldCheck className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Compliance Score</p>
            <p className="text-2xl font-black">92%</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-[hsl(45_93%_47%)]">
          <div className="bg-amber-500/10 p-3 rounded-xl">
            <Lock className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Encrypted Fields</p>
            <p className="text-2xl font-black">1,420</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-[hsl(0_72%_51%)]">
          <div className="bg-red-500/10 p-3 rounded-xl">
            <Unlock className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Unencrypted PII</p>
            <p className="text-2xl font-black">12 <span className="text-sm font-normal text-muted-foreground">columns</span></p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="font-bold text-sm mb-4">Data Sensitivity Distribution</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={piiData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {piiData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {piiData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                {entry.name}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-sm">Risk Exposure by Schema</h3>
            <ShieldAlert className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="h-[300px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="stroke-border" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis type="category" dataKey="schema" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
                <Bar dataKey="riskScore" radius={[0, 4, 4, 0]}>
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.riskScore > 75 ? "hsl(0 72% 51%)" : entry.riskScore > 30 ? "hsl(25 95% 53%)" : "hsl(145 63% 42%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}