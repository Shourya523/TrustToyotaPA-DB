"use client";

import { motion } from "framer-motion";
import { Building2, MapPin, Phone, ChevronRight, ArrowLeft, Car } from "lucide-react";
import { formatCurrency, type BranchStats } from "@/src/lib/showroom-types";
import { Badge } from "@/src/components/ui/badge";

type CityShowroomsPanelProps = {
  city: string;
  reportMonth: string;
  branches: BranchStats[];
  totalRevenue: number;
  totalCarsSold: number;
  onBack: () => void;
  onSelectBranch: (branchId: number) => void;
};

export default function CityShowroomsPanel({
  city,
  reportMonth,
  branches,
  totalRevenue,
  totalCarsSold,
  onBack,
  onSelectBranch,
}: CityShowroomsPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to map
          </button>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            {city}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {branches.length} showroom{branches.length !== 1 ? "s" : ""} · {reportMonth}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">City total</p>
          <p className="text-lg font-bold text-primary tabular-nums">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground">{totalCarsSold} cars sold</p>
        </div>
      </div>

      <div className="space-y-2">
        {branches.map((item, i) => {
          const { branch, totalCarsSold: cars, totalRevenue: rev, employeeCount } = item;
          return (
            <motion.button
              key={branch.branchId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelectBranch(branch.branchId)}
              className="w-full group flex items-center gap-4 p-4 rounded-xl border border-border bg-card/40 hover:bg-accent/30 hover:border-primary/30 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Building2 className="w-5 h-5 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-sm">{branch.street}</p>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                    #{branch.branchId}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Bldg {branch.buildingNumber}, {branch.city}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {branch.contactNumber}
                  </span>
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Car className="w-3 h-3" />
                    {cars} sold
                  </span>
                  <span className="text-primary font-medium tabular-nums">{formatCurrency(rev)}</span>
                  <span className="text-muted-foreground">{employeeCount} staff</span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
