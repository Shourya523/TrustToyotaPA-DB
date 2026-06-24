"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { FeatureCollection } from "geojson";
import type { CityMapPoint } from "@/src/lib/showroom-types";
import { formatCurrency } from "@/src/lib/showroom-types";
import { Plus, Minus, RotateCcw, Building2, Car } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type USAMapProps = {
  cities: CityMapPoint[];
  selectedCity: string | null;
  onCitySelect: (city: string) => void;
};

export default function USAMap({ cities, selectedCity, onCitySelect }: USAMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [hoveredCity, setHoveredCity] = useState<CityMapPoint | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    fetch("/geo/usa_states.json")
      .then((r) => r.json())
      .then(setGeo)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!geo || !svgRef.current || !containerRef.current) return;

    const width = 960;
    const height = 600;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Albers USA projection — the standard for US maps (handles AK & HI insets)
    const projection = d3.geoAlbersUsa().scale(1280).translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection);

    const defs = svg.append("defs");

    // Revenue colour scale
    const maxRevenue = d3.max(cities, (c) => c.totalRevenue) || 1;

    const gradient = defs
      .append("linearGradient")
      .attr("id", "stateBase")
      .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "100%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "hsl(var(--primary) / 0.10)");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "hsl(var(--primary) / 0.03)");

    // Drop shadow
    const filter = defs.append("filter").attr("id", "drop-shadow")
      .attr("x", "-20%").attr("y", "-20%").attr("width", "140%").attr("height", "140%");
    filter.append("feDropShadow").attr("dx", 0).attr("dy", 4).attr("stdDeviation", 8)
      .attr("flood-color", "hsl(var(--foreground))").attr("flood-opacity", 0.08);

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        g.selectAll(".marker").attr("transform", function () {
          const d = d3.select(this).datum() as CityMapPoint;
          const projected = projection([d.lng, d.lat]);
          if (!projected) return "";
          const [x, y] = projected;
          return `translate(${x},${y}) scale(${1 / event.transform.k})`;
        });
        g.selectAll("path.state").attr("stroke-width", 0.8 / event.transform.k);
      });

    svg.call(zoom);
    zoomBehavior.current = zoom;

    // States
    g.selectAll("path.state")
      .data(geo.features)
      .join("path")
      .attr("class", "state")
      .attr("d", path as never)
      .attr("fill", "url(#stateBase)")
      .attr("stroke", "hsl(var(--primary) / 0.25)")
      .attr("stroke-width", 0.8)
      .attr("stroke-linejoin", "round")
      .style("filter", "url(#drop-shadow)");

    // City markers
    const markers = g.selectAll(".marker")
      .data(cities.filter((c) => {
        const p = projection([c.lng, c.lat]);
        return p !== null;
      }))
      .join("g")
      .attr("class", "marker cursor-pointer")
      .attr("transform", (d) => {
        const p = projection([d.lng, d.lat]) || [0, 0];
        return `translate(${p[0]},${p[1]}) scale(1)`;
      })
      .style("pointer-events", (d) => (d.branchCount > 0 ? "all" : "none"))
      .on("click", (e, d) => d.branchCount > 0 && onCitySelect(d.city))
      .on("mousemove", (e, d) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setHoveredCity(d);
      })
      .on("mouseleave", () => setHoveredCity(null));

    // Revenue-scaled radius
    const rScale = d3.scaleSqrt().domain([0, maxRevenue]).range([5, 18]);

    // Pulse ring
    markers.filter((d) => d.branchCount > 0)
      .append("circle")
      .attr("r", (d) => rScale(d.totalRevenue) + 5)
      .attr("fill", "hsl(var(--primary))")
      .attr("opacity", 0.15)
      .style("animation", "pulse-anim 2s cubic-bezier(0.4,0,0.6,1) infinite");

    // Selection ring
    markers.append("circle")
      .attr("r", (d) => rScale(d.totalRevenue) + 8)
      .attr("fill", "hsl(var(--primary) / 0.12)")
      .attr("stroke", "hsl(var(--primary) / 0.5)")
      .attr("stroke-width", 1.5)
      .attr("opacity", (d) => (d.city === selectedCity ? 1 : 0));

    // Main dot
    markers.append("circle")
      .attr("r", (d) => rScale(d.totalRevenue))
      .attr("fill", (d) => d.branchCount > 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.35)")
      .attr("stroke", "hsl(var(--background))")
      .attr("stroke-width", 2);

    // Inner dot
    markers.filter((d) => d.branchCount > 0)
      .append("circle")
      .attr("r", 2.5)
      .attr("fill", "hsl(var(--primary-foreground))");

    // Labels
    markers.append("text")
      .attr("y", (d) => rScale(d.totalRevenue) + 13)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => d.city === selectedCity ? "hsl(var(--primary))" : "hsl(var(--foreground))")
      .attr("font-size", (d) => d.city === selectedCity ? 12 : 10)
      .attr("font-weight", (d) => d.city === selectedCity ? 700 : 600)
      .style("text-shadow", "0 1px 3px hsl(var(--background)), 0 -1px 3px hsl(var(--background))")
      .style("pointer-events", "none")
      .text((d) => d.city);

  }, [geo, cities, selectedCity, onCitySelect]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomBehavior.current)
      d3.select(svgRef.current).transition().duration(300).call(zoomBehavior.current.scaleBy, 1.5);
  };
  const handleZoomOut = () => {
    if (svgRef.current && zoomBehavior.current)
      d3.select(svgRef.current).transition().duration(300).call(zoomBehavior.current.scaleBy, 0.67);
  };
  const handleReset = () => {
    if (svgRef.current && zoomBehavior.current)
      d3.select(svgRef.current).transition().duration(500).call(zoomBehavior.current.transform, d3.zoomIdentity);
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-b from-card to-background border border-border/60 shadow-inner" ref={containerRef}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-anim {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}} />

      {!geo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground bg-background/50 backdrop-blur-sm z-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading Map Data…
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <div className="flex flex-col bg-background/90 backdrop-blur border border-border/60 rounded-lg shadow-lg overflow-hidden">
          <button onClick={handleZoomIn} className="p-2 hover:bg-accent transition-colors border-b border-border/50" aria-label="Zoom In">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={handleZoomOut} className="p-2 hover:bg-accent transition-colors" aria-label="Zoom Out">
            <Minus className="w-4 h-4" />
          </button>
        </div>
        <button onClick={handleReset} className="p-2 bg-background/90 backdrop-blur border border-border/60 rounded-lg shadow-lg hover:bg-accent transition-colors" aria-label="Reset Map">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 960 600"
        className="w-full h-auto min-h-[400px] sm:min-h-[500px] cursor-grab active:cursor-grabbing touch-none"
        role="img"
        aria-label="Map of USA with car showroom locations"
      />

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredCity && hoveredCity.branchCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute pointer-events-none z-20"
            style={{ left: mousePos.x, top: mousePos.y - 10, transform: "translate(-50%, -100%)" }}
          >
            <div className="bg-background/95 backdrop-blur-md border border-border/60 shadow-xl rounded-xl p-3 min-w-[160px]">
              <p className="font-bold text-sm mb-1">{hoveredCity.city}</p>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  <span>{hoveredCity.branchCount} Showroom{hoveredCity.branchCount !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Car className="w-3.5 h-3.5 text-blue-500" />
                  <span className="font-medium text-foreground">{formatCurrency(hoveredCity.totalRevenue)} Revenue</span>
                </div>
              </div>
            </div>
            <div className="w-3 h-3 bg-background/95 border-b border-r border-border/60 rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-background/90 backdrop-blur shadow-lg px-3 py-2 rounded-lg border border-border/60">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-3 w-3 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-40" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="font-medium">Active Showrooms</span>
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Pin size = revenue</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function USAMapLegend({ cityCount, branchCount }: { cityCount: number; branchCount: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
        Live Network: {branchCount} showrooms across {cityCount} cities
      </p>
    </div>
  );
}
