"use client";

import { Card } from "../ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Database, Users, HardDrive, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const adoptionData = [
  { name: "Mon", users: 120, queries: 450 },
  { name: "Tue", users: 140, queries: 520 },
  { name: "Wed", users: 180, queries: 610 },
  { name: "Thu", users: 150, queries: 480 },
  { name: "Fri", users: 210, queries: 750 },
  { name: "Sat", users: 90, queries: 200 },
  { name: "Sun", users: 105, queries: 250 },
];

const storageData = [
  { name: "Production DB", value: 400 },
  { name: "Staging DB", value: 150 },
  { name: "Analytics", value: 800 },
  { name: "Logs", value: 200 },
];

const sparklineUsers = [
  { value: 90 }, { value: 105 }, { value: 120 }, { value: 140 }, { value: 180 }, { value: 150 }, { value: 210 }
];
const sparklineQueries = [
  { value: 200 }, { value: 250 }, { value: 450 }, { value: 520 }, { value: 610 }, { value: 480 }, { value: 750 }
];
const sparklineStorage = [
  { value: 1.40 }, { value: 1.45 }, { value: 1.48 }, { value: 1.50 }, { value: 1.52 }, { value: 1.54 }, { value: 1.55 }
];

const gaugeData = [
  { name: "Score", value: 92 },
  { name: "Empty", value: 8 },
];

const COLORS = ["hsl(0 72% 51%)", "hsl(25 95% 53%)", "hsl(45 93% 47%)", "hsl(200 75% 45%)"];

export default function PlatformAnalytics() {
  return (
    <div className="space-y-6 mb-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="text-xl font-bold tracking-tight">Platform Overview</h2>
        <p className="text-sm text-muted-foreground">Monitor adoption and resource usage across your data estate.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "Active Users", value: "1,024", trend: "+12% from last week", icon: Users, color: "hsl(0 72% 51%)", data: sparklineUsers, delay: 0.1 },
          { title: "Queries Run", value: "42.5k", trend: "+5% from last week", icon: Database, color: "hsl(25 95% 53%)", data: sparklineQueries, delay: 0.2 },
          { title: "Total Storage", value: "1.55 TB", trend: "+1.2% from last week", icon: HardDrive, color: "hsl(200 75% 45%)", data: sparklineStorage, delay: 0.3 }
        ].map((kpi, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: kpi.delay, duration: 0.4 }}>
            <Card className="p-4 border-l-4 overflow-hidden relative bg-card/60 backdrop-blur-xl shadow-lg border-white/5 transition-all hover:shadow-xl" style={{ borderLeftColor: kpi.color }}>
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                  <h3 className="text-xs font-bold uppercase tracking-wider">{kpi.title}</h3>
                </div>
                <p className="text-3xl font-black tracking-tight drop-shadow-sm">{kpi.value}</p>
                <p className="text-[10px] font-bold mt-1 w-fit px-1.5 py-0.5 rounded bg-foreground/5 text-foreground/70">
                  {kpi.trend}
                </p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-16 opacity-20 pointer-events-none">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={kpi.data}>
                    <Area type="monotone" dataKey="value" stroke="none" fill={kpi.color} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
          <Card className="p-5 bg-card/60 backdrop-blur-xl shadow-lg border-white/5 h-full">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Adoption & Usage (7 Days)
            </h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={adoptionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(25 95% 53%)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="hsl(25 95% 53%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ fontSize: 12, borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsla(var(--card)/0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="queries" stroke="hsl(25 95% 53%)" strokeWidth={3} fillOpacity={1} fill="url(#colorQueries)" />
                  <Area type="monotone" dataKey="users" stroke="hsl(0 72% 51%)" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div className="flex flex-col gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
          
          {/* Health Gauge */}
          <Card className="p-5 bg-card/60 backdrop-blur-xl shadow-lg border-white/5 flex-1 relative flex flex-col items-center justify-center">
            <h3 className="text-sm font-bold absolute top-5 left-5 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Platform Health
            </h3>
            <div className="h-[120px] w-full mt-8">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <linearGradient id="healthGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(45 93% 47%)" />
                      <stop offset="100%" stopColor="hsl(145 63% 42%)" />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={gaugeData}
                    cx="50%" cy="100%"
                    startAngle={180} endAngle={0}
                    innerRadius={70} outerRadius={90}
                    paddingAngle={0} dataKey="value"
                    stroke="none" cornerRadius={8}
                  >
                    <Cell fill="url(#healthGradient)" />
                    <Cell fill="hsl(var(--muted)/0.3)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute bottom-4 flex flex-col items-center pointer-events-none">
              <span className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-emerald-500">92</span>
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Excellent</span>
            </div>
          </Card>

          {/* Storage Donut */}
          <Card className="p-5 bg-card/60 backdrop-blur-xl shadow-lg border-white/5 flex-1 flex flex-col">
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-500" /> Storage Usage
            </h3>
            <div className="h-[120px] w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={storageData}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={60}
                    paddingAngle={3} dataKey="value"
                    stroke="none" cornerRadius={4}
                  >
                    {storageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value} GB`, 'Storage']}
                    contentStyle={{ fontSize: 12, borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsla(var(--card)/0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {storageData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate">{entry.name}</span>
                </div>
              ))}
            </div>
          </Card>

        </motion.div>
      </div>
    </div>
  );
}
