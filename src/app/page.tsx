"use client";

import Link from "next/link";
import { Button } from "../components/ui/button";
import { ArrowRight, Car, Building2, ShieldCheck, MapPin, BarChart3, UploadCloud } from "lucide-react";
import { motion } from "framer-motion";
import LandingNavbar from "../components/landing/LandingNavbar";

export default function ShowroomLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <LandingNavbar />
      
      {/* Hero Section */}
      <section id="overview" className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden bg-background dark:bg-[#050505] flex-1">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <div className="absolute w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full" />
        </div>

        <div className="container relative z-10 mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold tracking-wider uppercase mb-6 animate-pulse">
              <Car className="w-3.5 h-3.5" />
              Toyota Egypt Network
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tighter leading-[1.05] mb-8">
              Trust Toyota
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-500 to-red-600 dark:from-red-400 dark:via-orange-400 dark:to-red-500">
                Showroom Intelligence
              </span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
              Real-time sales performance, regional branch auditing, and automated employee payroll tracking across Cairo, Alexandria, Giza, Suez, and Port Said.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/dashboard">
                <Button size="lg" className="h-12 px-8 rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(239,68,68,0.2)] bg-red-600 hover:bg-red-700 text-white border-none">
                  Enter Showroom Portal
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="h-12 px-8 rounded-xl font-bold text-sm hover:bg-accent">
                  Explore Features
                </Button>
              </a>
            </div>
          </motion.div>

          {/* Quick Metrics Panel */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="mt-16 max-w-4xl mx-auto"
          >
            <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-6 sm:p-8 shadow-xl relative">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/[0.02] via-transparent to-transparent pointer-events-none rounded-2xl" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
                {[
                  { label: "Showrooms", value: "5 Active" },
                  { label: "Coverage", value: "National" },
                  { label: "Leading Models", value: "Corolla, Fortuner" },
                  { label: "Ledger Modes", value: "Postgres & CSV" },
                ].map((s, idx) => (
                  <div key={s.label} className="text-left border-l-2 border-red-500/40 pl-4 sm:pl-6">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5">{s.label}</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 border-t border-border bg-card/10 relative">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">System Capabilities</h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-3">
              Automated branch reporting and visual sales auditing tools designed for Toyota showroom admins.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: MapPin,
                title: "Egypt Network Map",
                desc: "Interactive map visualization detailing showroom density, regional revenues, and active branch coordinates.",
              },
              {
                icon: BarChart3,
                title: "Illustrative Reports",
                desc: "Detailed Recharts charts outlining popular vehicles, top performing sales agents, and payment preferences.",
              },
              {
                icon: UploadCloud,
                title: "Multi-Source Uploads",
                desc: "Switch between live PostgreSQL databases or drag-and-drop local CSV files to generate visual summaries.",
              },
              {
                icon: ShieldCheck,
                title: "Secure Commissions",
                desc: "Audited commission percentages and automatic base salary reports for all showroom representatives.",
              },
            ].map((f, i) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl border border-border bg-card/30 hover:border-red-500/20 hover:bg-accent/10 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="font-bold text-base mb-2">{f.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-background">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold">
            <Car className="w-4 h-4 text-primary" />
            Trust Toyota Showrooms
          </div>
          <div>
            © {new Date().getFullYear()} Trust Toyota Egypt. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
