"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import type { FeatureCollection } from "geojson";
import type { CityMapPoint } from "@/src/lib/showroom-types";
import { formatCurrency } from "@/src/lib/showroom-types";

type EgyptMapProps = {
  cities: CityMapPoint[];
  selectedCity: string | null;
  onCitySelect: (city: string) => void;
};

export default function EgyptMap({ cities, selectedCity, onCitySelect }: EgyptMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);

  useEffect(() => {
    fetch("/geo/egypt.json")
      .then((r) => r.json())
      .then(setGeo)
      .catch(console.error);
  }, []);

  const cityByName = useMemo(() => new Map(cities.map((c) => [c.city, c])), [cities]);

  useEffect(() => {
    if (!geo || !svgRef.current) return;

    const width = 800;
    const height = 600;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const projection = d3
      .geoMercator()
      .center([30.8, 27.5])
      .scale(2200)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "mapFill")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "100%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "hsl(var(--primary) / 0.12)");
    gradient.append("stop").attr("offset" as never, "100%").attr("stop-color", "hsl(var(--primary) / 0.04)");

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        g.selectAll(".inner-marker").attr("transform", `scale(${1 / event.transform.k})`);
        g.selectAll("path.country").attr("stroke-width", 1.2 / event.transform.k);
        g.selectAll("path.nile").attr("stroke-width", 2 / event.transform.k);
      });

    svg.call(zoom);

    g.selectAll("path.country")
      .data(geo.features)
      .join("path")
      .attr("class", "country")
      .attr("d", path as never)
      .attr("fill", "url(#mapFill)")
      .attr("stroke", "hsl(var(--primary) / 0.35)")
      .attr("stroke-width", 1.2)
      .attr("stroke-linejoin", "round");

    // Nile hint
    const nilePoints: [number, number][] = [
      [31.2, 22.5],
      [31.0, 26],
      [30.8, 28.5],
      [30.5, 30.5],
    ].map(([lng, lat]) => projection([lng, lat]) as [number, number]);

    g.append("path")
      .datum(d3.line().curve(d3.curveCatmullRom)(nilePoints))
      .attr("class", "nile")
      .attr("fill", "none")
      .attr("stroke", "hsl(200 70% 55% / 0.25)")
      .attr("stroke-width", 2)
      .attr("stroke-linecap", "round");

    cities.forEach((city) => {
      const projected = projection([city.lng, city.lat]);
      if (!projected) return;
      const [x, y] = projected;
      const isSelected = selectedCity === city.city;
      const isHovered = hoveredCity === city.city;
      const hasShowroom = city.branchCount > 0;
      const radius = isSelected ? 10 : isHovered ? 8 : 6;

      const marker = g
        .append("g")
        .attr("transform", `translate(${x},${y})`)
        .attr("class", "marker cursor-pointer")
        .style("pointer-events", hasShowroom ? "all" : "none")
        .on("click", () => hasShowroom && onCitySelect(city.city))
        .on("mouseenter", () => setHoveredCity(city.city))
        .on("mouseleave", () => setHoveredCity(null));

      const innerMarker = marker.append("g").attr("class", "inner-marker");

      if (isSelected || isHovered) {
        innerMarker
          .append("circle")
          .attr("r", radius + 8)
          .attr("fill", "hsl(var(--primary) / 0.12)")
          .attr("stroke", "hsl(var(--primary) / 0.3)")
          .attr("stroke-width", 1);
      }

      innerMarker
        .append("circle")
        .attr("r", radius)
        .attr("fill", hasShowroom ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)")
        .attr("stroke", "hsl(var(--background))")
        .attr("stroke-width", 2);

      innerMarker
        .append("circle")
        .attr("r", 2.5)
        .attr("fill", "hsl(var(--primary-foreground))");

      const labelY = -radius - 10;
      
      innerMarker
        .append("text")
        .attr("y", labelY)
        .attr("text-anchor", "middle")
        .attr("fill", isSelected || isHovered ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.8)")
        .attr("font-size", isSelected || isHovered ? 13 : 11)
        .attr("font-weight", isSelected || isHovered ? 700 : 500)
        .style("text-shadow", "0 1px 3px hsl(var(--background)), 0 -1px 3px hsl(var(--background)), 1px 0 3px hsl(var(--background)), -1px 0 3px hsl(var(--background))")
        .text(city.city);

      if (hasShowroom && (isHovered || isSelected)) {
        innerMarker
          .append("text")
          .attr("y", labelY + 14)
          .attr("text-anchor", "middle")
          .attr("fill", "hsl(var(--muted-foreground))")
          .attr("font-size", 10)
          .attr("font-weight", 500)
          .style("text-shadow", "0 1px 2px hsl(var(--background)), 0 -1px 2px hsl(var(--background))")
          .text(
            `${city.branchCount} showroom${city.branchCount !== 1 ? "s" : ""} · ${formatCurrency(city.totalRevenue)}`
          );
      }
    });
  }, [geo, cities, selectedCity, hoveredCity, onCitySelect]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-muted/20 border border-border/50">
      {!geo && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Loading map…
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox="0 0 800 600"
        className="w-full h-auto min-h-[320px] sm:min-h-[420px]"
        role="img"
        aria-label="Map of Egypt with car showroom locations"
      />
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-border/50">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
          <span>Showroom city</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
          <span>No showroom</span>
        </div>
      </div>
    </div>
  );
}

export function EgyptMapLegend({ cityCount, branchCount }: { cityCount: number; branchCount: number }) {
  return (
    <p className="text-xs text-muted-foreground">
      {branchCount} showrooms across {cityCount} cities in Egypt
    </p>
  );
}
