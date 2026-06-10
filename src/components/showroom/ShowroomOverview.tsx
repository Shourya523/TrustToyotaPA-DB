"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Building2, Car, Users, TrendingUp, Sparkles, Loader2, AlertCircle } from "lucide-react";
import EgyptMap, { EgyptMapLegend } from "./EgyptMap";
import CityShowroomsPanel from "./CityShowroomsPanel";
import ShowroomDetailPanel from "./ShowroomDetailPanel";
import { formatCurrency, type BranchStats, type CityMapPoint, type NationalStats } from "@/src/lib/showroom-types";
import {
  getNationalShowroomStats,
  getCityShowroomStats,
  getBranchShowroomStats,
  getCityMapPoints,
} from "@/src/actions/showroom";
import { authClient } from "@/src/components/landing/auth";

type View = "map" | "city" | "branch";

export default function ShowroomOverview() {
  const { data: session } = authClient.useSession();
  const [view, setView] = useState<View>("map");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  const [nationalStats, setNationalStats] = useState<NationalStats | null>(null);
  const [cityPoints, setCityPoints] = useState<CityMapPoint[]>([]);
  const [cityData, setCityData] = useState<Awaited<ReturnType<typeof getCityShowroomStats>> | null>(null);
  const [branchStats, setBranchStats] = useState<(BranchStats & { reportMonth: string }) | null>(null);

  const [loading, setLoading] = useState(true);
  const [cityLoading, setCityLoading] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = session?.user?.name?.split(" ")[0] || "Admin";

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [stats, points] = await Promise.all([getNationalShowroomStats(), getCityMapPoints()]);
        setNationalStats(stats);
        setCityPoints(points);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load showroom data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const loadCity = useCallback(async (city: string) => {
    setCityLoading(true);
    try {
      const data = await getCityShowroomStats(city);
      setCityData(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load city data");
    } finally {
      setCityLoading(false);
    }
  }, []);

  const loadBranch = useCallback(async (branchId: number) => {
    setBranchLoading(true);
    try {
      const data = await getBranchShowroomStats(branchId);
      setBranchStats(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load branch data");
    } finally {
      setBranchLoading(false);
    }
  }, []);

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setSelectedBranchId(null);
    setBranchStats(null);
    setView("city");
    loadCity(city);
  };

  const handleBranchSelect = (branchId: number, city?: string) => {
    setSelectedBranchId(branchId);
    if (city) setSelectedCity(city);
    setView("branch");
    loadBranch(branchId);
  };

  const handleBackToMap = () => {
    setView("map");
    setSelectedCity(null);
    setSelectedBranchId(null);
    setCityData(null);
    setBranchStats(null);
  };

  const handleBackToCity = () => {
    setView("city");
    setSelectedBranchId(null);
    setBranchStats(null);
    if (selectedCity) loadCity(selectedCity);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading showroom network from database…</p>
      </div>
    );
  }

  if (error && !nationalStats) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-center px-6">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="font-medium">Could not connect to showroom database</p>
        <p className="text-sm text-muted-foreground max-w-md">{error}</p>
      </div>
    );
  }

  const stats = nationalStats!;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative rounded-2xl border border-border overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-primary text-[11px] font-semibold tracking-[0.25em] uppercase mb-3">
            Showroom Network · Egypt
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-2.5">
            Hey, {firstName}
            <Sparkles className="w-6 h-6 text-amber-400/80" />
          </h1>
          <p className="text-muted-foreground mt-2 max-w-lg leading-relaxed">
            Live data from your PostgreSQL showroom database. Click a city on the map to drill into branch sales,
            employee performance, and payroll for {stats.reportMonth}.
          </p>

          <div className="mt-8 pt-7 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0 sm:divide-x sm:divide-border">
            {[
              { label: "Showrooms", value: stats.totalBranches, icon: Building2 },
              { label: "Employees", value: stats.totalEmployees, icon: Users },
              {
                label: "Cars Sold",
                value: stats.totalCarsSold,
                icon: Car,
                suffix: ` · ${stats.reportMonth.split(" ")[0]}`,
              },
              { label: "Revenue", value: formatCurrency(stats.totalRevenue), icon: TrendingUp },
            ].map((s) => (
              <div key={s.label} className="sm:px-6 first:sm:pl-0 last:sm:pr-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <s.icon className="w-3.5 h-3.5 text-primary/70" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold tabular-nums tracking-tight">
                  {s.value}
                  {"suffix" in s && s.suffix && (
                    <span className="text-xs font-normal text-muted-foreground">{s.suffix}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {view === "branch" && selectedBranchId ? (
          <motion.div
            key="branch-detail"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="rounded-2xl border border-border bg-card/20 p-5 sm:p-8"
          >
            {branchStats ? (
              <ShowroomDetailPanel stats={branchStats} onBack={handleBackToCity} />
            ) : (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="map-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="grid lg:grid-cols-5 gap-6 lg:gap-8"
          >
            <div className="lg:col-span-3 rounded-2xl border border-border bg-card/20 overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold">Egypt Showroom Map</h2>
                </div>
                <EgyptMapLegend
                  cityCount={cityPoints.filter((c) => c.branchCount > 0).length}
                  branchCount={stats.totalBranches}
                />
              </div>
              <div className="p-4 sm:p-6">
                <EgyptMap cities={cityPoints} selectedCity={selectedCity} onCitySelect={handleCitySelect} />
              </div>

              {view === "map" && (
                <div className="px-5 pb-5 border-t border-border pt-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">All showrooms</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {stats.branchStats.map(({ branch, totalRevenue, totalCarsSold }) => (
                      <button
                        key={branch.branchId}
                        onClick={() => handleBranchSelect(branch.branchId, branch.city)}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card/30 hover:border-primary/30 hover:bg-accent/20 transition-all text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{branch.street}</p>
                          <p className="text-[10px] text-muted-foreground">{branch.city}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-medium text-primary tabular-nums">{formatCurrency(totalRevenue)}</p>
                          <p className="text-[9px] text-muted-foreground">{totalCarsSold} cars</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card/20 p-5 sm:p-6 min-h-[320px] lg:min-h-[480px]">
                {cityLoading ? (
                  <div className="flex items-center justify-center h-full py-24">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    {view === "city" && selectedCity && cityData ? (
                      <CityShowroomsPanel
                        key={`city-${selectedCity}`}
                        city={cityData.city}
                        reportMonth={cityData.reportMonth}
                        branches={cityData.branches}
                        totalRevenue={cityData.totalRevenue}
                        totalCarsSold={cityData.totalCarsSold}
                        onBack={handleBackToMap}
                        onSelectBranch={(id) => handleBranchSelect(id)}
                      />
                    ) : (
                      <motion.div
                        key="placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center h-full text-center py-16 lg:py-24"
                      >
                        <MapPin className="w-10 h-10 text-muted-foreground/30 mb-4" />
                        <p className="text-sm font-medium text-muted-foreground">Select a city on the map</p>
                        <p className="text-xs text-muted-foreground/60 mt-1 max-w-[220px]">
                          Click any green marker to view showrooms, or pick one from the list below the map
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
