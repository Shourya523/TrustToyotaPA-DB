"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Building2,
  Car,
  Users,
  TrendingUp,
  Sparkles,
  Loader2,
  AlertCircle,
  UploadCloud,
  Download,
  FileText,
  CheckCircle,
  RefreshCw,
  Percent,
  Award,
  DollarSign,
  Briefcase,
  BarChart3,
  HelpCircle,
  Target,
  TrendingDown,
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
  AreaChart,
  Area,
  Legend,
  ScatterChart,
  Scatter,
  ComposedChart,
  ZAxis,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import USAMap, { USAMapLegend } from "./USAMap";
import CityShowroomsPanel from "./CityShowroomsPanel";
import ShowroomDetailPanel from "./ShowroomDetailPanel";
import {
  formatCurrency,
  type BranchStats,
  type CityMapPoint,
  type NationalStats,
  type EmployeeSale,
  CITY_COORDINATES,
} from "@/src/lib/showroom-types";
import {
  getNationalShowroomStats,
  getCityShowroomStats,
  getBranchShowroomStats,
  getCityMapPoints,
  getLowInventoryAlerts,
  getBestRepForCarAction,
} from "@/src/actions/showroom";
import { authClient } from "@/src/components/landing/auth";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type View = "map" | "city" | "branch";

const CHART_COLORS = ["hsl(0 72% 51%)", "hsl(25 95% 53%)", "hsl(45 93% 47%)", "hsl(145 63% 42%)", "hsl(200 75% 45%)"];
const HR_PIE_COLORS = ["hsl(0 72% 51%)", "hsl(200 70% 50%)", "hsl(280 60% 55%)", "hsl(145 60% 45%)"];

// Self-contained client-side CSV parser
function parseCSV(text: string): NationalStats {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV file has no data rows");

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

  const dateIdx = headers.findIndex((h) => h.includes("date"));
  const modelIdx = headers.findIndex((h) => h.includes("model") || h.includes("car"));
  const priceIdx = headers.findIndex((h) => h.includes("price") || h.includes("revenue") || h.includes("amount") || h.includes("cost"));
  const salespersonIdx = headers.findIndex((h) => h.includes("salesperson") || h.includes("employee") || h.includes("agent") || h.includes("name"));
  const cityIdx = headers.findIndex((h) => h.includes("city") || h.includes("location"));
  const branchIdx = headers.findIndex((h) => h.includes("branch") || h.includes("showroom"));
  const methodIdx = headers.findIndex((h) => h.includes("method") || h.includes("payment"));

  if (modelIdx === -1 || priceIdx === -1 || salespersonIdx === -1 || cityIdx === -1 || branchIdx === -1) {
    throw new Error("Missing required columns. Please ensure your CSV contains headers matching: Car Model, Price, Salesperson, City, Branch.");
  }

  const rows: Array<{
    date: Date;
    model: string;
    price: number;
    salesperson: string;
    city: string;
    branch: string;
    method: string;
  }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = parseLine(line);
    if (parts.length < headers.length) continue;

    const rawDate = dateIdx !== -1 ? parts[dateIdx] : "";
    const dateVal = rawDate ? new Date(rawDate) : new Date();
    const priceVal = Number(parts[priceIdx].replace(/[^\d.]/g, "")) || 0;
    const salespersonVal = parts[salespersonIdx] || "Unknown";
    const cityVal = parts[cityIdx] || "Cairo";
    const branchVal = parts[branchIdx] || "Main Branch";
    const methodVal = methodIdx !== -1 ? parts[methodIdx] : "Cash";
    const modelVal = parts[modelIdx] || "Toyota Corolla";

    rows.push({
      date: isNaN(dateVal.getTime()) ? new Date() : dateVal,
      model: modelVal,
      price: priceVal,
      salesperson: salespersonVal,
      city: cityVal,
      branch: branchVal,
      method: methodVal,
    });
  }

  if (rows.length === 0) throw new Error("No valid sales data rows found in CSV.");

  // Group into structures
  const branchMap = new Map<
    string,
    {
      branchId: number;
      street: string;
      city: string;
      buildingNumber: number;
      contactNumber: string;
      rows: typeof rows;
    }
  >();

  let branchIdSeq = 2000;
  for (const r of rows) {
    const key = `${r.city}-${r.branch}`;
    if (!branchMap.has(key)) {
      branchMap.set(key, {
        branchId: ++branchIdSeq,
        street: r.branch,
        city: r.city,
        buildingNumber: Math.floor(Math.random() * 90) + 10,
        contactNumber: "19777",
        rows: [],
      });
    }
    branchMap.get(key)!.rows.push(r);
  }

  const branchStats: BranchStats[] = [];
  for (const b of branchMap.values()) {
    const salespersonMap = new Map<string, typeof rows>();
    for (const r of b.rows) {
      if (!salespersonMap.has(r.salesperson)) {
        salespersonMap.set(r.salesperson, []);
      }
      salespersonMap.get(r.salesperson)!.push(r);
    }

    const sales: EmployeeSale[] = [];
    let ssnSeq = 100000000;
    for (const [name, empRows] of salespersonMap.entries()) {
      const parts = name.split(" ");
      const fname = parts[0] || "Staff";
      const lname = parts.slice(1).join(" ") || "Member";
      const empRev = empRows.reduce((sum, r) => sum + r.price, 0);
      const empCars = empRows.length;

      const modelCounts = new Map<string, number>();
      for (const r of empRows) {
        modelCounts.set(r.model, (modelCounts.get(r.model) || 0) + 1);
      }
      let topModel = "—";
      let maxCount = 0;
      for (const [m, cnt] of modelCounts.entries()) {
        if (cnt > maxCount) {
          maxCount = cnt;
          topModel = m;
        }
      }

      const methodCounts = new Map<string, number>();
      for (const r of empRows) {
        methodCounts.set(r.method, (methodCounts.get(r.method) || 0) + 1);
      }
      let topMethod = "—";
      let maxMethCount = 0;
      for (const [met, cnt] of methodCounts.entries()) {
        if (cnt > maxMethCount) {
          maxMethCount = cnt;
          topMethod = met;
        }
      }

      const commission = empRev * 0.02;

      sales.push({
        ssn: ++ssnSeq,
        fname,
        lname,
        jobTitle: "Sales Consultant",
        salary: 12000,
        commPct: 0.02,
        gender: Math.random() > 0.5 ? "M" : "F",
        phone1: "+20 1" + Math.floor(100000000 + Math.random() * 900000000),
        birthDate: "15/06/1990",
        city: b.city,
        carsSold: empCars,
        revenue: empRev,
        commission,
        topModel,
        paymentMethod: topMethod,
        midBudgetSold: empRows.filter((r) => r.price < 1500000).length,
        luxurySold: empRows.filter((r) => r.price >= 1500000).length,
      });
    }

    const pmCounts = new Map<string, number>();
    for (const r of b.rows) {
      pmCounts.set(r.method, (pmCounts.get(r.method) || 0) + 1);
    }
    const paymentBreakdown = Array.from(pmCounts.entries()).map(([method, count]) => ({
      method,
      count,
    }));

    const trendMap = new Map<string, number>();
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (const r of b.rows) {
      const mon = r.date.toLocaleDateString("en-US", { month: "short" });
      trendMap.set(mon, (trendMap.get(mon) || 0) + r.price);
    }
    const monthlyTrend = Array.from(trendMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((x, y) => monthOrder.indexOf(x.month) - monthOrder.indexOf(y.month));

    const totalRevenue = b.rows.reduce((sum, r) => sum + r.price, 0);
    const totalCarsSold = b.rows.length;

    branchStats.push({
      branch: {
        branchId: b.branchId,
        street: b.street,
        city: b.city,
        buildingNumber: b.buildingNumber,
        contactNumber: b.contactNumber,
      },
      totalRevenue,
      totalCommission: sales.reduce((sum, s) => sum + s.commission, 0),
      totalCarsSold,
      totalPayroll: sales.reduce((sum, s) => sum + s.salary, 0),
      employeeCount: sales.length,
      paymentBreakdown,
      monthlyTrend,
      sales: sales.sort((x, y) => y.revenue - x.revenue),
    });
  }

  const totalRevenue = branchStats.reduce((sum, b) => sum + b.totalRevenue, 0);
  const totalCarsSold = branchStats.reduce((sum, b) => sum + b.totalCarsSold, 0);
  const totalEmployees = branchStats.reduce((sum, b) => sum + b.employeeCount, 0);

  const carCounts = new Map<string, { count: number; revenue: number }>();
  for (const r of rows) {
    if (!carCounts.has(r.model)) {
      carCounts.set(r.model, { count: 0, revenue: 0 });
    }
    const item = carCounts.get(r.model)!;
    item.count += 1;
    item.revenue += r.price;
  }
  const topCars = Array.from(carCounts.entries())
    .map(([name, val]) => ({ name, count: val.count, revenue: val.revenue }))
    .sort((x, y) => y.count - x.count)
    .slice(0, 5);

  const topSalespeople = branchStats
    .flatMap((b) =>
      b.sales.map((s) => ({
        name: `${s.fname} ${s.lname}`,
        count: s.carsSold,
        revenue: s.revenue,
        branch: b.branch.street,
      }))
    )
    .sort((x, y) => y.revenue - x.revenue)
    .slice(0, 5);

  const topBranches = branchStats
    .map((b) => ({
      name: b.branch.street,
      city: b.branch.city,
      count: b.totalCarsSold,
      revenue: b.totalRevenue,
    }))
    .sort((x, y) => y.revenue - x.revenue)
    .slice(0, 5);

  const latestDate = rows.reduce((max, r) => (r.date > max ? r.date : max), rows[0].date);
  const reportMonth = latestDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return {
    totalBranches: branchStats.length,
    totalEmployees,
    totalRevenue,
    totalCarsSold,
    branchStats,
    reportMonth,
    topCars,
    topSalespeople,
    topBranches,
  };
}

// Mock data for Branch Performance Radar
const branchRadarData = [
  { subject: 'Satisfaction', Cairo: 120, Alex: 110, fullMark: 150 },
  { subject: 'Volume', Cairo: 98, Alex: 130, fullMark: 150 },
  { subject: 'Margin', Cairo: 86, Alex: 100, fullMark: 150 },
  { subject: 'Growth', Cairo: 99, Alex: 110, fullMark: 150 },
  { subject: 'Retention', Cairo: 85, Alex: 90, fullMark: 150 },
  { subject: 'Follow-ups', Cairo: 110, Alex: 85, fullMark: 150 },
];

export default function ShowroomOverview() {
  const { data: session } = authClient.useSession();
  const [mode, setMode] = useState<"db" | "csv">("db");
  const [dashboardTab, setDashboardTab] = useState<"map" | "hr" | "projections" | "executive">("map");
  const [view, setView] = useState<View>("map");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  // Projections States
  const [projGrowthRate, setProjGrowthRate] = useState(15); // Default 15% annual growth
  const [projPeriod, setProjPeriod] = useState(6); // Default 6 months forecast
  const [selectedProjEmployee, setSelectedProjEmployee] = useState<string>("all");
  const [selectedProjCar, setSelectedProjCar] = useState<string>("all");
  const [selectedProjMonth, setSelectedProjMonth] = useState<string>("all");
  const [bestReps, setBestReps] = useState<any[]>([]);
  const [recommendationLoading, setRecommendationLoading] = useState(false);

  // HR Simulator States
  const [simBaseSalary, setSimBaseSalary] = useState(12000);
  const [simCommPct, setSimCommPct] = useState(2); // 2%
  const [simTargetSales, setSimTargetSales] = useState(5);
  const [simBonusAmount, setSimBonusAmount] = useState(5000);

  // Database mode states
  const [nationalStats, setNationalStats] = useState<NationalStats | null>(null);
  const [cityPoints, setCityPoints] = useState<CityMapPoint[]>([]);
  const [cityData, setCityData] = useState<Awaited<ReturnType<typeof getCityShowroomStats>> | null>(null);
  const [branchStats, setBranchStats] = useState<(BranchStats & { reportMonth: string }) | null>(null);
  const [dbAlerts, setDbAlerts] = useState<any[]>([]);

  // CSV mode states
  const [csvData, setCsvData] = useState<NationalStats | null>(null);
  const [csvPoints, setCsvPoints] = useState<CityMapPoint[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [loading, setLoading] = useState(true);
  const [cityLoading, setCityLoading] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = session?.user?.name?.split(" ")[0] || "Admin";

  // Load database statistics
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [stats, points, alerts] = await Promise.all([
          getNationalShowroomStats(),
          getCityMapPoints(),
          getLowInventoryAlerts(),
        ]);
        setNationalStats(stats);
        setCityPoints(points);
        setDbAlerts(alerts);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load database showroom data");
      } finally {
        setLoading(false);
      }
    }
    load();
    
    // Retrieve cached CSV if available
    if (typeof window !== "undefined") {
      const savedText = localStorage.getItem("toyota_raw_csv_text");
      const savedFileName = localStorage.getItem("toyota_raw_csv_filename");
      if (savedText && savedFileName) {
        handleCSVText(savedText, savedFileName);
      }
    }
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

    if (mode === "db") {
      loadCity(city);
    } else if (csvData) {
      const cityBranches = csvData.branchStats.filter((b) => b.branch.city === city);
      setCityData({
        city,
        reportMonth: csvData.reportMonth,
        branches: cityBranches,
        totalRevenue: cityBranches.reduce((s, b) => s + b.totalRevenue, 0),
        totalCarsSold: cityBranches.reduce((s, b) => s + b.totalCarsSold, 0),
      });
    }
  };

  const handleBranchSelect = (branchId: number, city?: string) => {
    setSelectedBranchId(branchId);
    if (city) setSelectedCity(city);
    setView("branch");

    if (mode === "db") {
      loadBranch(branchId);
    } else if (csvData) {
      const bStats = csvData.branchStats.find((b) => b.branch.branchId === branchId);
      if (bStats) {
        setBranchStats({ ...bStats, reportMonth: csvData.reportMonth });
      }
    }
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
    if (selectedCity) {
      if (mode === "db") {
        loadCity(selectedCity);
      } else if (csvData) {
        const cityBranches = csvData.branchStats.filter((b) => b.branch.city === selectedCity);
        setCityData({
          city: selectedCity,
          reportMonth: csvData.reportMonth,
          branches: cityBranches,
          totalRevenue: cityBranches.reduce((s, b) => s + b.totalRevenue, 0),
          totalCarsSold: cityBranches.reduce((s, b) => s + b.totalCarsSold, 0),
        });
      }
    }
  };

  // CSV file handlers
  const handleCSVText = (text: string, fileName: string) => {
    setCsvError(null);
    try {
      const parsed = parseCSV(text);
      setCsvData(parsed);
      setCsvFileName(fileName);
      
      if (typeof window !== "undefined") {
        localStorage.setItem("toyota_raw_csv_text", text);
        localStorage.setItem("toyota_raw_csv_filename", fileName);
      }

      // Generate City Map Points
      const citiesMap = new Map<string, { branchCount: number; revenue: number }>();
      for (const b of parsed.branchStats) {
        const c = b.branch.city;
        if (!citiesMap.has(c)) {
          citiesMap.set(c, { branchCount: 0, revenue: 0 });
        }
        const item = citiesMap.get(c)!;
        item.branchCount += 1;
        item.revenue += b.totalRevenue;
      }

      const points: CityMapPoint[] = Array.from(citiesMap.entries()).map(([city, val]) => {
        const normCity = city.trim().charAt(0).toUpperCase() + city.trim().slice(1).toLowerCase();
        const coords = CITY_COORDINATES[normCity] ?? { lat: 30, lng: 31 };
        return {
          city,
          lat: coords.lat,
          lng: coords.lng,
          branchCount: val.branchCount,
          totalRevenue: val.revenue,
        };
      });
      setCsvPoints(points);
    } catch (e) {
      setCsvError(e instanceof Error ? e.message : "Failed to parse CSV spreadsheet");
      setCsvData(null);
      setCsvFileName(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      handleCSVText(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.name.slice(-4).toLowerCase() !== ".csv") {
      setCsvError("Only CSV spreadsheet files (.csv) are supported.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      handleCSVText(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleUseDemo = () => {
    const demoString =
      "Date,Car Model,Price,Salesperson,City,Branch,Payment Method\n" +
      "2026-06-01,Toyota Corolla,1100000,Ahmed Ali,Cairo,Sheraton Showroom,Cash\n" +
      "2026-06-02,Toyota Corolla,1100000,Ahmed Ali,Cairo,Sheraton Showroom,Credit Card\n" +
      "2026-06-03,Toyota Fortuner,2950000,Ahmed Ali,Cairo,Sheraton Showroom,Installments\n" +
      "2026-06-04,Toyota Hilux,1800000,Sara Hassan,Alexandria,Smouha Showroom,Cash\n" +
      "2026-06-05,Toyota Fortuner,2950000,Sara Hassan,Alexandria,Smouha Showroom,Installments\n" +
      "2026-06-06,Toyota Camry,3500000,Sara Hassan,Alexandria,Smouha Showroom,Credit Card\n" +
      "2026-06-07,Toyota Corolla,1100000,Mona Fathy,Giza,El Haram Showroom,Cash\n" +
      "2026-06-08,Toyota Hycross,2100000,Mona Fathy,Giza,El Haram Showroom,Installments\n" +
      "2026-06-09,Toyota Innova,1900000,Mona Fathy,Giza,El Haram Showroom,Credit Card\n" +
      "2026-06-10,Toyota Fortuner,2950000,Tarek Kamel,Cairo,Sheraton Showroom,Cash\n" +
      "2026-06-11,Toyota Camry,3500000,Tarek Kamel,Cairo,Sheraton Showroom,Credit Card\n" +
      "2026-06-12,Toyota Corolla,1100000,Hassan Hosny,Alexandria,Smouha Showroom,Installments\n" +
      "2026-06-13,Toyota Hilux,1800000,Hassan Hosny,Alexandria,Smouha Showroom,Cash\n" +
      "2026-06-14,Toyota Corolla,1100000,Youssef Sherif,Suez,El Canal Showroom,Cash\n" +
      "2026-06-15,Toyota Fortuner,2950000,Youssef Sherif,Suez,El Canal Showroom,Installments\n" +
      "2026-06-16,Toyota Hycross,2100000,Amr Diab,Port Said,Port Said Port,Credit Card\n" +
      "2026-06-17,Toyota Corolla,1100000,Amr Diab,Port Said,Port Said Port,Cash\n" +
      "2026-06-18,Toyota Innova,1900000,Amr Diab,Port Said,Port Said Port,Installments\n" +
      "2026-06-19,Toyota Corolla,1100000,Ahmed Ali,Cairo,Sheraton Showroom,Cash\n" +
      "2026-06-20,Toyota Camry,3500000,Sara Hassan,Alexandria,Smouha Showroom,Credit Card";

    handleCSVText(demoString, "toyota_showroom_sales_demo.csv");
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      "Date,Car Model,Price,Salesperson,City,Branch,Payment Method\n" +
      "2026-06-01,Toyota Corolla,1100000,Ahmed Ali,Cairo,Sheraton Showroom,Cash\n" +
      "2026-06-02,Toyota Corolla,1100000,Ahmed Ali,Cairo,Sheraton Showroom,Credit Card\n" +
      "2026-06-03,Toyota Fortuner,2950000,Ahmed Ali,Cairo,Sheraton Showroom,Installments\n" +
      "2026-06-04,Toyota Hilux,1800000,Sara Hassan,Alexandria,Smouha Showroom,Cash\n" +
      "2026-06-05,Toyota Fortuner,2950000,Sara Hassan,Alexandria,Smouha Showroom,Installments\n" +
      "2026-06-06,Toyota Camry,3500000,Sara Hassan,Alexandria,Smouha Showroom,Credit Card\n" +
      "2026-06-07,Toyota Corolla,1100000,Mona Fathy,Giza,El Haram Showroom,Cash\n" +
      "2026-06-08,Toyota Hycross,2100000,Mona Fathy,Giza,El Haram Showroom,Installments\n" +
      "2026-06-09,Toyota Innova,1900000,Mona Fathy,Giza,El Haram Showroom,Credit Card\n" +
      "2026-06-10,Toyota Fortuner,2950000,Tarek Kamel,Cairo,Sheraton Showroom,Cash\n" +
      "2026-06-11,Toyota Camry,3500000,Tarek Kamel,Cairo,Sheraton Showroom,Credit Card\n" +
      "2026-06-12,Toyota Corolla,1100000,Hassan Hosny,Alexandria,Smouha Showroom,Installments\n" +
      "2026-06-13,Toyota Hilux,1800000,Hassan Hosny,Alexandria,Smouha Showroom,Cash\n" +
      "2026-06-14,Toyota Corolla,1100000,Youssef Sherif,Suez,El Canal Showroom,Cash\n" +
      "2026-06-15,Toyota Fortuner,2950000,Youssef Sherif,Suez,El Canal Showroom,Installments\n" +
      "2026-06-16,Toyota Hycross,2100000,Amr Diab,Port Said,Port Said Port,Credit Card\n" +
      "2026-06-17,Toyota Corolla,1100000,Amr Diab,Port Said,Port Said Port,Cash\n" +
      "2026-06-18,Toyota Innova,1900000,Amr Diab,Port Said,Port Said Port,Installments\n" +
      "2026-06-19,Toyota Corolla,1100000,Ahmed Ali,Cairo,Sheraton Showroom,Cash\n" +
      "2026-06-20,Toyota Camry,3500000,Sara Hassan,Alexandria,Smouha Showroom,Credit Card";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "toyota_showroom_sales_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearCSV = () => {
    setCsvData(null);
    setCsvPoints([]);
    setCsvFileName(null);
    setCsvError(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("toyota_raw_csv_text");
      localStorage.removeItem("toyota_raw_csv_filename");
    }
    handleBackToMap();
  };

  // Determine active dataset
  const activeStats = mode === "db" ? nationalStats : csvData;
  const activePoints = mode === "db" ? cityPoints : csvPoints;

  // Aggregate monthly trend for all showrooms combined (for the trend chart)
  const combinedTrendData = (() => {
    if (!activeStats) return [];
    const trendMap = new Map<string, number>();
    for (const b of activeStats.branchStats) {
      for (const t of b.monthlyTrend) {
        trendMap.set(t.month, (trendMap.get(t.month) || 0) + t.revenue);
      }
    }
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Array.from(trendMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((x, y) => monthOrder.indexOf(x.month) - monthOrder.indexOf(y.month));
  })();

  // Projections calculations
  const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const projectionData = (() => {
    if (combinedTrendData.length === 0) return [];
    
    // Add baseline, optimistic, conservative to historical data so the lines connect seamlessly
    const data = combinedTrendData.map((d) => ({
      name: d.month,
      revenue: d.revenue,
      type: "historical",
      baseline: d.revenue,
      optimistic: d.revenue,
      conservative: d.revenue,
    }));
    
    const lastPoint = data[data.length - 1];
    const lastMonthIdx = monthOrder.indexOf(lastPoint.name.replace(" (Proj)", ""));
    const lastRevenue = lastPoint.revenue;
    
    // Growth rate from slider is annual. Convert to monthly rate.
    const monthlyRate = projGrowthRate / 12 / 100;
    const optRate = (projGrowthRate + 8) / 12 / 100; // +8% relative annual growth
    const consRate = (projGrowthRate - 8) / 12 / 100; // -8% relative annual growth
    
    for (let t = 1; t <= projPeriod; t++) {
      const nextMonthName = monthOrder[(lastMonthIdx + t) % 12];
      const baseline = lastRevenue * Math.pow(1 + monthlyRate, t);
      const optimistic = lastRevenue * Math.pow(1 + optRate, t);
      const conservative = lastRevenue * Math.pow(1 + consRate, t);
      
      data.push({
        name: `${nextMonthName} (Proj)`,
        revenue: undefined as any,
        type: "projected",
        baseline,
        optimistic,
        conservative,
      });
    }
    return data;
  })();

  // Projections metrics
  const lastHistoricalRevenue = combinedTrendData.length > 0 ? combinedTrendData[combinedTrendData.length - 1].revenue : 0;
  const lastProjPoint = projectionData.length > 0 ? projectionData[projectionData.length - 1] : null;
  const projFinalBase = lastProjPoint ? lastProjPoint.baseline : 0;
  const projFinalOpt = lastProjPoint ? lastProjPoint.optimistic : 0;
  const projFinalCons = lastProjPoint ? lastProjPoint.conservative : 0;

  // Cumulative revenue projected (sum of baseline projections only)
  const cumulativeProjectedRevenue = projectionData
    .filter((d) => d.type === "projected")
    .reduce((sum, d) => sum + d.baseline, 0);

  // Cumulative units projected based on average deal size
  const averageDealSize = activeStats && activeStats.totalCarsSold > 0
    ? activeStats.totalRevenue / activeStats.totalCarsSold
    : 1200000; // Fallback 1.2M EGP per unit
  const projectedUnitsSold = averageDealSize > 0 ? Math.round(cumulativeProjectedRevenue / averageDealSize) : 0;

  const allEmployees = activeStats ? activeStats.branchStats.flatMap((b) => b.sales) : [];

  // Lists for projections filters
  const uniqueEmployees = Array.from(new Set(allEmployees.map((e) => `${e.fname} ${e.lname}`)));
  const uniqueCarModels = activeStats ? activeStats.topCars.map((c) => c.name) : [];
  const projectedMonths = projectionData
    .filter((d) => d.type === "projected")
    .map((d) => d.name);

  // Granular Forecaster math
  const totalHistoricalCars = activeStats ? activeStats.totalCarsSold : 1;
  const selectedEmpData = allEmployees.find((e) => `${e.fname} ${e.lname}` === selectedProjEmployee);
  
  const empRatio = selectedProjEmployee === "all" ? 1 : (selectedEmpData ? selectedEmpData.carsSold / (totalHistoricalCars || 1) : 0);
  const selectedCarData = activeStats?.topCars.find((c) => c.name === selectedProjCar);
  const carRatio = selectedProjCar === "all" ? 1 : (selectedCarData ? selectedCarData.count / (totalHistoricalCars || 1) : 0);

  // Month baseline calculations
  const isSpecificMonthSelected = selectedProjMonth !== "all";
  const monthlyBaseRevenue = isSpecificMonthSelected
    ? (projectionData.find((d) => d.name === selectedProjMonth)?.baseline || 0)
    : cumulativeProjectedRevenue;

  const monthlyBaseUnits = averageDealSize > 0 ? monthlyBaseRevenue / averageDealSize : 0;

  // Filtered values
  const filteredProjRevenue = monthlyBaseRevenue * empRatio * carRatio;
  const filteredProjUnits = monthlyBaseUnits * empRatio * carRatio;

  // Best Reps Recommendation Engine logic (client-side)
  const getBestRepsForCar = (carName: string) => {
    if (!carName || carName === "all" || allEmployees.length === 0) return [];
    
    const carInfo = activeStats?.topCars.find((c) => c.name === carName);
    const isLuxuryCar = carInfo ? (carInfo.revenue / (carInfo.count || 1)) >= 1500000 : false;
    
    return allEmployees.map((emp) => {
      let score = 0;
      if (emp.topModel && emp.topModel.toLowerCase().includes(carName.replace("Toyota ", "").toLowerCase())) {
        score += 100;
      }
      if (isLuxuryCar) {
        score += emp.luxurySold * 10;
        if (emp.luxurySold > emp.midBudgetSold) score += 20;
      } else {
        score += emp.midBudgetSold * 10;
        if (emp.midBudgetSold > emp.luxurySold) score += 20;
      }
      score += emp.carsSold * 0.1;
      return { ...emp, score };
    })
    .filter((e) => e.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3);
  };

  useEffect(() => {
    if (!selectedProjCar || selectedProjCar === "all") {
      setBestReps([]);
      return;
    }

    if (mode === "csv") {
      const reps = getBestRepsForCar(selectedProjCar);
      setBestReps(reps);
    } else {
      setRecommendationLoading(true);
      getBestRepForCarAction(selectedProjCar)
        .then((reps) => {
          setBestReps(reps || []);
          setRecommendationLoading(false);
        })
        .catch((err) => {
          console.error("Error loading best reps from database:", err);
          setBestReps([]);
          setRecommendationLoading(false);
        });
    }
  }, [selectedProjCar, mode, activeStats]);

  // Staff Breakdown Chart calculations
  const staffBreakdownData = allEmployees
    .map((emp) => {
      const eRatio = totalHistoricalCars > 0 ? emp.carsSold / totalHistoricalCars : 0;
      const targetUnits = monthlyBaseUnits * eRatio * carRatio;
      const targetRevenue = monthlyBaseRevenue * eRatio * carRatio;
      
      return {
        name: `${emp.fname} ${emp.lname.charAt(0)}.`,
        "Projected Units": Number(targetUnits.toFixed(2)),
        "Projected Revenue": Number((targetRevenue / 1000).toFixed(0)), // in thousands
        fullName: `${emp.fname} ${emp.lname}`,
      };
    })
    .filter((d) => d["Projected Units"] > 0)
    .sort((x, y) => y["Projected Units"] - x["Projected Units"])
    .slice(0, 8); // Top 8 reps

  // HR Calculations
  const inventoryAlerts = mode === "db"
    ? dbAlerts
    : (csvData
        ? [
            { model: "Fortuner", brand: "Toyota", street: "Sheraton Showroom", city: "Cairo", noOfCars: 3 },
            { model: "Corolla", brand: "Toyota", street: "Smouha Showroom", city: "Alexandria", noOfCars: 2 },
            { model: "Camry", brand: "Toyota", street: "El Haram Showroom", city: "Giza", noOfCars: 4 }
          ]
        : []
      );


  const currentTotalPayroll = activeStats
    ? activeStats.branchStats.reduce((sum, b) => sum + b.totalPayroll + b.totalCommission, 0)
    : 0;

  // Simulated Payroll calculations
  const simEmployeesData = allEmployees.map((emp) => {
    // Only Sales Consultants have base and commissions adjusted
    const isSales = emp.jobTitle.toLowerCase().includes("consultant") || emp.jobTitle.toLowerCase().includes("representative");
    const base = isSales ? simBaseSalary : emp.salary;
    const commission = isSales ? emp.revenue * (simCommPct / 100) : emp.commission;
    const qualifiesForBonus = emp.carsSold >= simTargetSales;
    const bonus = qualifiesForBonus ? simBonusAmount : 0;
    const total = base + commission + bonus;

    return {
      ...emp,
      simBase: base,
      simCommission: commission,
      simBonus: bonus,
      simTotal: total,
      qualifiesForBonus,
    };
  });

  const simTotalPayroll = simEmployeesData.reduce((sum, e) => sum + e.simTotal, 0);
  const simTotalCommission = simEmployeesData.reduce((sum, e) => sum + e.simCommission, 0);
  const simTotalBonus = simEmployeesData.reduce((sum, e) => sum + e.simBonus, 0);
  const simBonusQualifiedCount = simEmployeesData.filter((e) => e.qualifiesForBonus).length;
  const payrollDeltaPct = currentTotalPayroll > 0 ? ((simTotalPayroll - currentTotalPayroll) / currentTotalPayroll) * 100 : 0;

  // Role distributions data
  const roleCounts: Record<string, number> = {};
  allEmployees.forEach((e) => {
    roleCounts[e.jobTitle] = (roleCounts[e.jobTitle] || 0) + 1;
  });
  const roleData = Object.entries(roleCounts).map(([name, value]) => ({ name, value }));

  // Gender diversity ratios
  const malesCount = allEmployees.filter((e) => e.gender === "M").length;
  const femalesCount = allEmployees.filter((e) => e.gender === "F").length;
  const totalDiversityCount = allEmployees.length || 1;
  const malePercent = Math.round((malesCount / totalDiversityCount) * 100);
  const femalePercent = Math.round((femalesCount / totalDiversityCount) * 100);

  if (loading && mode === "db") {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Connecting to showroom database ledger…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Toggle Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative rounded-2xl border border-border overflow-hidden bg-card/25"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-primary text-[11px] font-semibold tracking-[0.25em] uppercase mb-3">
                Trust Toyota · Showroom Network Ledger
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-2.5">
                Hey, {firstName}
                <Sparkles className="w-6 h-6 text-amber-400/80" />
              </h1>
            </div>

            {/* Mode Select Toggle */}
            <div className="flex items-center self-start bg-secondary/60 p-1.5 rounded-xl border border-border shadow-inner">
              <button
                onClick={() => setMode("db")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  mode === "db" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Database Mode
              </button>
              <button
                onClick={() => setMode("csv")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  mode === "csv" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                CSV Upload Mode
              </button>
            </div>
          </div>

          <p className="text-muted-foreground mt-4 max-w-xl leading-relaxed text-sm">
            {mode === "db"
              ? "Live telemetry connected to your Neon Postgres database. Click a city marker to inspect branches, sales advisors, and commissions."
              : "Upload a showroom CSV ledger to analyze network performance client-side, with full compatibility across maps, filters, and reports."}
          </p>

          {/* Active stats display */}
          {activeStats && (
            <div className="mt-8 pt-7 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0 sm:divide-x sm:divide-border">
              {[
                { label: "Showrooms", value: activeStats.totalBranches, icon: Building2 },
                { label: "Employees", value: activeStats.totalEmployees, icon: Users },
                {
                  label: "Cars Sold",
                  value: activeStats.totalCarsSold,
                  icon: Car,
                  suffix: ` · ${activeStats.reportMonth.split(" ")[0]}`,
                },
                { label: "Revenue", value: formatCurrency(activeStats.totalRevenue), icon: TrendingUp },
              ].map((s) => (
                <div key={s.label} className="sm:px-6 first:sm:pl-0 last:sm:pr-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <s.icon className="w-3.5 h-3.5 text-primary/70" />
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </span>
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
          )}
        </div>
      </motion.div>

      {/* CSV Mode - File Uploader Overlay */}
      {mode === "csv" && !csvData && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-dashed border-border/80 hover:border-red-500/50 transition-colors rounded-2xl p-12 text-center bg-card/10 backdrop-blur-md relative overflow-hidden flex flex-col items-center max-w-4xl mx-auto cursor-pointer"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{ borderColor: isDragging ? "hsl(var(--primary))" : "" }}
        >
          <input
            type="file"
            id="csv-file-input"
            accept=".csv"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
            <UploadCloud className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2">Upload Showroom Sales Sheet</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
            Drag and drop your Toyota showroom sales log (.csv) here, or click to browse files.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="relative z-10 gap-2 border-border/80 hover:bg-accent/40"
            >
              <Download className="w-4 h-4" />
              Download Template
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleUseDemo}
              className="relative z-10 gap-2 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20"
            >
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              Use Demo Toyota CSV
            </Button>
          </div>

          {csvError && (
            <div className="mt-6 flex items-center gap-2 text-xs text-red-500 bg-red-500/10 px-4 py-2.5 rounded-lg border border-red-500/20">
              <AlertCircle className="w-4 h-4" />
              {csvError}
            </div>
          )}
        </motion.div>
      )}

      {/* Main Dashboard Layout */}
      {(mode === "db" || (mode === "csv" && csvData)) && (
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
                <ShowroomDetailPanel stats={branchStats} onBack={handleBackToCity} onBackToOverview={handleBackToMap} />
              ) : (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ) : (
            <div className="space-y-6">
              {/* Tab Selector */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setDashboardTab("map")}
                  className={`pb-3 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                    dashboardTab === "map"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  Showrooms & Sales
                </button>
                <button
                  onClick={() => setDashboardTab("hr")}
                  className={`pb-3 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                    dashboardTab === "hr"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  HR & People Analytics
                </button>
                <button
                  onClick={() => setDashboardTab("projections")}
                  className={`pb-3 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                    dashboardTab === "projections"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Projections
                </button>
                <button
                  onClick={() => setDashboardTab("executive")}
                  className={`pb-3 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                    dashboardTab === "executive"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Executive
                </button>
              </div>

              {dashboardTab === "map" && (
                <>
                  {/* Map and Side Panel */}
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
                          <h2 className="text-sm font-semibold">USA Showroom Map</h2>
                        </div>
                        {activeStats && (
                          <USAMapLegend
                            cityCount={activePoints.filter((c) => c.branchCount > 0).length}
                            branchCount={activeStats.totalBranches}
                          />
                        )}
                      </div>
                      <div className="p-4 sm:p-6">
                        <USAMap cities={activePoints} selectedCity={selectedCity} onCitySelect={handleCitySelect} />
                      </div>

                      {view === "map" && activeStats && (
                        <div className="px-5 pb-5 border-t border-border pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">All showrooms</p>
                            {mode === "csv" && csvFileName && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                  <CheckCircle className="w-2.5 h-2.5" />
                                  {csvFileName}
                                </span>
                                <button
                                  onClick={handleClearCSV}
                                  className="text-[10px] text-red-500 hover:text-red-600 transition-colors flex items-center gap-1 font-semibold"
                                >
                                  <RefreshCw className="w-2.5 h-2.5" />
                                  Clear CSV
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {activeStats.branchStats.map(({ branch, totalRevenue, totalCarsSold }) => (
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
                                  <p className="text-[10px] font-medium text-primary tabular-nums">
                                    {formatCurrency(totalRevenue)}
                                  </p>
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
                                  Click any marker to view showrooms, or pick one from the list below the map
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* Executive Alerts & Insights Panel */}
                  <div className="grid lg:grid-cols-5 gap-6 pt-4">
                    {/* Low Inventory Warnings */}
                    <div className="lg:col-span-3 rounded-2xl border border-border bg-card/25 p-5 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <h3 className="text-sm font-semibold">Showroom Inventory Warnings</h3>
                      </div>
                      
                      {inventoryAlerts.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {inventoryAlerts.map((alert, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-red-500/10 bg-red-500/5 text-xs">
                              <div className="flex items-center gap-2.5">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-semibold text-foreground truncate">
                                    {alert.brand} {alert.model}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {alert.street} ({alert.city})
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full shrink-0">
                                {alert.noOfCars} units left
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-xs text-muted-foreground">
                          All showrooms have healthy vehicle stock levels.
                        </div>
                      )}
                    </div>

                    {/* Executive Summary Insights */}
                    <div className="lg:col-span-2 rounded-2xl border border-border bg-card/25 p-5 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm font-semibold">At-a-Glance Executive Summary</h3>
                      </div>
                      
                      {activeStats ? (
                        <div className="space-y-3.5 text-xs">
                          <div className="flex justify-between items-center py-1 border-b border-border/30">
                            <span className="text-muted-foreground font-medium">Top Selling Model</span>
                            <span className="font-bold text-foreground truncate max-w-[160px]">
                              {activeStats.topCars[0]?.name || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-border/30">
                            <span className="text-muted-foreground font-medium">Top Revenue Showroom</span>
                            <span className="font-bold text-foreground truncate max-w-[160px]">
                              {activeStats.topBranches[0]?.name || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-border/30">
                            <span className="text-muted-foreground font-medium">Top Sales Representative</span>
                            <span className="font-bold text-foreground truncate max-w-[160px]">
                              {activeStats.topSalespeople[0]?.name || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-muted-foreground font-medium">Average Deal Size</span>
                            <span className="font-extrabold text-primary">
                              {activeStats.totalCarsSold > 0
                                ? formatCurrency(activeStats.totalRevenue / activeStats.totalCarsSold)
                                : "—"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-xs text-muted-foreground">
                          No insights data currently compiled.
                        </div>
                      )}
                    </div>
                  </div>


                  {/* National Illustrations Grid */}
                  {activeStats && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="space-y-6 pt-4"
                    >
                      <div className="border-b border-border pb-3 flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-bold tracking-tight">National Sales Illustrations</h2>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Consolidated graphical reports representing brand sales metrics.
                          </p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Graph 1: Top Selling Cars */}
                        <div className="rounded-2xl border border-border bg-card/20 p-5 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                            <Car className="w-4 h-4 text-red-500" />
                            <h3 className="text-sm font-semibold">Mostly Sold Cars</h3>
                          </div>
                          {activeStats.topCars && activeStats.topCars.length > 0 ? (
                            <div className="h-[400px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={activeStats.topCars} margin={{ left: -10, right: 10, top: 10 }}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                  <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                                  <Tooltip
                                    contentStyle={{
                                      background: "hsl(var(--card))",
                                      border: "1px solid hsl(var(--border))",
                                      borderRadius: 8,
                                      fontSize: 11,
                                    }}
                                    formatter={(value: number, name: string) => [
                                      value,
                                      name === "count" ? "Units Sold" : "Value",
                                    ]}
                                  />
                                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                                    {activeStats.topCars.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="h-[400px] flex items-center justify-center text-xs text-muted-foreground">
                              No car model sales logs recorded.
                            </div>
                          )}
                        </div>

                        {/* Graph 2: Top Sales Reps */}
                        <div className="rounded-2xl border border-border bg-card/20 p-5 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                            <Users className="w-4 h-4 text-amber-500" />
                            <h3 className="text-sm font-semibold">Who Sold it the Most</h3>
                          </div>
                          {activeStats.topSalespeople && activeStats.topSalespeople.length > 0 ? (
                            <div className="h-[400px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={activeStats.topSalespeople}
                                  layout="vertical"
                                  margin={{ left: 10, right: 10, top: 10 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                  <XAxis
                                    type="number"
                                    tick={{ fontSize: 10 }}
                                    className="fill-muted-foreground"
                                    tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                                  />
                                  <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fontSize: 9 }}
                                    className="fill-muted-foreground"
                                    width={110}
                                  />
                                  <Tooltip
                                    contentStyle={{
                                      background: "hsl(var(--card))",
                                      border: "1px solid hsl(var(--border))",
                                      borderRadius: 8,
                                      fontSize: 11,
                                    }}
                                    formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                                  />
                                  <Bar dataKey="revenue" fill="hsl(145 63% 42%)" radius={[0, 4, 4, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="h-[400px] flex items-center justify-center text-xs text-muted-foreground">
                              No employee sales logs recorded.
                            </div>
                          )}
                        </div>

                        {/* Graph 3: Top Showroom Regions */}
                        <div className="rounded-2xl border border-border bg-card/20 p-5 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                            <Building2 className="w-4 h-4 text-blue-500" />
                            <h3 className="text-sm font-semibold">Where Were They Sold the Most</h3>
                          </div>
                          {activeStats.topBranches && activeStats.topBranches.length > 0 ? (
                            <div className="h-[400px] flex flex-col sm:flex-row items-center gap-4">
                              <div className="flex-1 h-full w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={activeStats.topBranches}
                                      dataKey="revenue"
                                      nameKey="name"
                                      cx="50%"
                                      cy="50%"
                                      outerRadius={80}
                                      innerRadius={50}
                                      paddingAngle={3}
                                    >
                                      {activeStats.topBranches.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                      ))}
                                    </Pie>
                                    <Tooltip
                                      contentStyle={{
                                        background: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: 8,
                                        fontSize: 11,
                                      }}
                                      formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                              <div className="flex flex-col gap-2 shrink-0 self-start sm:self-center mt-2 sm:mt-0 max-w-[200px]">
                                {activeStats.topBranches.slice(0, 4).map((b, idx) => (
                                  <div key={b.name} className="flex items-start gap-2 text-[10px]">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0"
                                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                                    />
                                    <div className="min-w-0">
                                      <p className="font-semibold truncate">{b.name}</p>
                                      <p className="text-muted-foreground truncate">{formatCurrency(b.revenue)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="h-[400px] flex items-center justify-center text-xs text-muted-foreground">
                              No regional branch metrics available.
                            </div>
                          )}
                        </div>

                        {/* Graph 4: Combined Revenue Trend & Projections */}
                        <div className="rounded-2xl border border-border bg-card/20 p-5 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-purple-500" />
                            <h3 className="text-sm font-semibold">National Revenue Trend & Projections</h3>
                          </div>
                          {combinedTrendData.length > 0 ? (
                            <div className="h-[400px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={combinedTrendData} margin={{ left: -10, right: 10, top: 10 }}>
                                  <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                  <XAxis dataKey="month" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
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
                                      fontSize: 11,
                                    }}
                                    formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="h-[400px] flex items-center justify-center text-xs text-muted-foreground">
                              No revenue trends logs recorded.
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}

              {dashboardTab === "hr" && (
                /* HR & People Analytics Tab */
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6 animate-in fade-in duration-300"
                >
                  {/* HR simulated KPI metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      {
                        label: "Simulated Payroll Total",
                        value: formatCurrency(simTotalPayroll),
                        icon: DollarSign,
                        color: "text-red-500",
                        badge: `${payrollDeltaPct >= 0 ? "+" : ""}${payrollDeltaPct.toFixed(1)}% vs. Current`,
                        badgeColor: payrollDeltaPct > 0 ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                      },
                      {
                        label: "Simulated Commissions",
                        value: formatCurrency(simTotalCommission),
                        icon: Percent,
                        color: "text-amber-500",
                      },
                      {
                        label: "Target Bonuses Paid",
                        value: formatCurrency(simTotalBonus),
                        icon: Award,
                        color: "text-emerald-500",
                      },
                      {
                        label: "Bonus Qualified Staff",
                        value: `${simBonusQualifiedCount} Employees`,
                        icon: Users,
                        color: "text-blue-500",
                        badge: `${allEmployees.length > 0 ? Math.round((simBonusQualifiedCount / allEmployees.length) * 100) : 0}% Ratio`,
                        badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
                      },
                    ].map((card) => (
                      <div key={card.label} className="rounded-xl border border-border bg-card/30 p-4 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              {card.label}
                            </span>
                          </div>
                        </div>
                        <p className="text-lg sm:text-xl font-bold tabular-nums tracking-tight">{card.value}</p>
                        {card.badge && (
                          <span className={`inline-block mt-2 text-[9px] font-bold px-2 py-0.5 border rounded-full ${card.badgeColor}`}>
                            {card.badge}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="grid lg:grid-cols-3 gap-6">
                    {/* Simulator Sliders Card */}
                    <Card className="p-5 border-border bg-card/25 backdrop-blur shadow-sm space-y-5 lg:col-span-1">
                      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                        <TrendingUp className="w-4 h-4 text-red-500" />
                        <h3 className="text-sm font-semibold">Interactive Compensation Simulator</h3>
                      </div>

                      {/* Slider 1: Base Salary */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-medium">Sales Rep Base Salary</span>
                          <span className="font-bold text-foreground">{formatCurrency(simBaseSalary)}</span>
                        </div>
                        <input
                          type="range"
                          min="5000"
                          max="25000"
                          step="1000"
                          value={simBaseSalary}
                          onChange={(e) => setSimBaseSalary(Number(e.target.value))}
                          className="w-full h-1.5 rounded-lg bg-secondary cursor-pointer accent-red-600"
                        />
                      </div>

                      {/* Slider 2: Commission Pct */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-medium">Commission Rate</span>
                          <span className="font-bold text-foreground">{simCommPct}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          step="0.5"
                          value={simCommPct}
                          onChange={(e) => setSimCommPct(Number(e.target.value))}
                          className="w-full h-1.5 rounded-lg bg-secondary cursor-pointer accent-red-600"
                        />
                      </div>

                      {/* Slider 3: Target Sales */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-medium">Incentive Target (Cars Sold)</span>
                          <span className="font-bold text-foreground">{simTargetSales} cars</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="15"
                          step="1"
                          value={simTargetSales}
                          onChange={(e) => setSimTargetSales(Number(e.target.value))}
                          className="w-full h-1.5 rounded-lg bg-secondary cursor-pointer accent-red-600"
                        />
                      </div>

                      {/* Slider 4: Bonus Amount */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-medium">Target Bonus Payout</span>
                          <span className="font-bold text-foreground">{formatCurrency(simBonusAmount)}</span>
                        </div>
                        <input
                          type="range"
                          min="1000"
                          max="15000"
                          step="500"
                          value={simBonusAmount}
                          onChange={(e) => setSimBonusAmount(Number(e.target.value))}
                          className="w-full h-1.5 rounded-lg bg-secondary cursor-pointer accent-red-600"
                        />
                      </div>
                    </Card>

                    {/* Roles and Gender diversity Grid */}
                    <div className="lg:col-span-2 space-y-6">
                      <div className="grid sm:grid-cols-2 gap-6">
                        {/* Staff Role Distributions */}
                        <div className="rounded-2xl border border-border bg-card/25 p-5 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                            <Briefcase className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-semibold">Staff Count by Role</h3>
                          </div>
                          {roleData.length > 0 ? (
                            <div className="h-[280px] flex flex-col items-center justify-center">
                              <ResponsiveContainer width="100%" height="80%">
                                <PieChart>
                                  <Pie
                                    data={roleData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={50}
                                    innerRadius={30}
                                    paddingAngle={2}
                                  >
                                    {roleData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={HR_PIE_COLORS[index % HR_PIE_COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip contentStyle={{ fontSize: 9, background: "hsl(var(--card))" }} />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="flex flex-wrap gap-2 justify-center mt-2">
                                {roleData.map((r, i) => (
                                  <div key={r.name} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: HR_PIE_COLORS[i % HR_PIE_COLORS.length] }}
                                    />
                                    {r.name} ({r.value})
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
                              No employees found.
                            </div>
                          )}
                        </div>

                        {/* Gender Diversity ratios */}
                        <div className="rounded-2xl border border-border bg-card/25 p-5 shadow-sm flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-4">
                              <Users className="w-4 h-4 text-blue-500" />
                              <h3 className="text-sm font-semibold">Gender Diversity Ratio</h3>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Evaluated staff breakdown between male and female headcount across showrooms.
                            </p>
                          </div>

                          <div className="space-y-3 mt-4">
                            {/* Stacked Gender Ratio Bar */}
                            <div className="w-full h-5 rounded-full overflow-hidden flex bg-border border border-border/50">
                              {malePercent > 0 && (
                                <div
                                  className="h-full bg-red-600 flex items-center justify-center text-[9px] font-bold text-white transition-all"
                                  style={{ width: `${malePercent}%` }}
                                >
                                  {malePercent}%
                                </div>
                              )}
                              {femalePercent > 0 && (
                                <div
                                  className="h-full bg-[#ec4899] flex items-center justify-center text-[9px] font-bold text-white transition-all"
                                  style={{ width: `${femalePercent}%` }}
                                >
                                  {femalePercent}%
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-medium text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 bg-red-600 rounded-sm" />
                                Male: {malesCount} ({malePercent}%)
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 bg-[#ec4899] rounded-sm" />
                                Female: {femalesCount} ({femalePercent}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Leaderboard and Incentives Planner */}
                  <div className="rounded-2xl border border-border overflow-hidden">
                    <div className="px-5 py-4 border-b border-border bg-muted/30">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-500 animate-bounce" />
                        Sales Incentives Planner & Leaderboard
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Verify employee sales numbers against simulated compensation targets.
                      </p>
                    </div>

                    <table className="w-full text-left border-collapse">
                      <thead className="bg-muted/80 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b">
                        <tr>
                          <th className="p-3">Employee Name</th>
                          <th className="p-3">Role</th>
                          <th className="p-3 text-right">Cars Sold</th>
                          <th className="p-3 text-right">Revenue Generated</th>
                          <th className="p-3 text-right">Simulated Base</th>
                          <th className="p-3 text-right">Simulated Comm ({simCommPct}%)</th>
                          <th className="p-3 text-right">Simulated Bonus</th>
                          <th className="p-3 text-right font-bold text-foreground">Total Payout</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {simEmployeesData.map((emp) => (
                          <tr key={emp.ssn} className="hover:bg-accent/30 border-b border-border/50">
                            <td className="p-3 font-semibold text-foreground">
                              {emp.fname} {emp.lname}
                            </td>
                            <td className="p-3 text-muted-foreground text-xs">{emp.jobTitle}</td>
                            <td className="p-3 text-right font-semibold tabular-nums">{emp.carsSold}</td>
                            <td className="p-3 text-right text-primary font-medium tabular-nums">
                              {formatCurrency(emp.revenue)}
                            </td>
                            <td className="p-3 text-right tabular-nums">{formatCurrency(emp.simBase)}</td>
                            <td className="p-3 text-right tabular-nums">{formatCurrency(emp.simCommission)}</td>
                            <td className="p-3 text-right">
                              {emp.qualifiesForBonus ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                  +{formatCurrency(emp.simBonus)}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/60 font-medium">
                                  {emp.carsSold} / {simTargetSales} cars
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-extrabold text-foreground tabular-nums bg-accent/20">
                              {formatCurrency(emp.simTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Employee Bracket Segregation Analysis */}
                  <div className="grid lg:grid-cols-5 gap-6 pt-6">
                    {/* Bracket chart */}
                    <div className="lg:col-span-2 rounded-2xl border border-border bg-card/25 p-5 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                        <BarChart3 className="w-4 h-4 text-red-500" />
                        <h3 className="text-sm font-semibold">Sales Volume by Price Bracket</h3>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        Reps segregated by Mid-Budget (&lt; $50K) vs. Luxury (&ge; $50K) units sold.
                      </p>
                      
                      {simEmployeesData.filter(e => e.carsSold > 0).length > 0 ? (
                        <div className="h-[400px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={simEmployeesData
                                .filter(e => e.carsSold > 0)
                                .map(e => ({
                                  name: `${e.fname} ${e.lname.charAt(0)}.`,
                                  "Mid-Budget": e.midBudgetSold,
                                  "Luxury": e.luxurySold
                                }))
                                .slice(0, 8)}
                              layout="vertical"
                              margin={{ left: -10, right: 10, top: 10, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                              <XAxis type="number" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} className="fill-muted-foreground" width={75} />
                              <Tooltip
                                contentStyle={{
                                  background: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: 8,
                                  fontSize: 10
                                }}
                              />
                              <Bar dataKey="Mid-Budget" stackId="a" fill="hsl(200 70% 50%)" />
                              <Bar dataKey="Luxury" stackId="a" fill="hsl(0 72% 51%)" radius={[0, 4, 4, 0]} />
                              <Legend wrapperStyle={{ fontSize: 8 }} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[400px] flex items-center justify-center text-xs text-muted-foreground">
                          No sales recorded.
                        </div>
                      )}
                    </div>

                    {/* Employee Directory with Badge */}
                    <div className="lg:col-span-3 rounded-2xl border border-border overflow-hidden bg-card/15 shadow-sm">
                      <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-primary" />
                            Bracket Segregation Directory
                          </h3>
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-muted/40 text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border sticky top-0">
                            <tr>
                              <th className="p-3">Consultant</th>
                              <th className="p-3 text-right">Mid-Budget (&lt;1.5M)</th>
                              <th className="p-3 text-right">Luxury (&ge;1.5M)</th>
                              <th className="p-3 text-center">Specialty classification</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs">
                            {simEmployeesData
                              .filter(e => e.carsSold > 0)
                              .map((emp) => {
                                const isLuxurySpecialist = emp.luxurySold > emp.midBudgetSold;
                                return (
                                  <tr key={emp.ssn} className="hover:bg-accent/20 border-b border-border/40 last:border-none">
                                    <td className="p-3 font-semibold text-foreground">
                                      {emp.fname} {emp.lname}
                                    </td>
                                    <td className="p-3 text-right font-mono tabular-nums text-muted-foreground">
                                      {emp.midBudgetSold}
                                    </td>
                                    <td className="p-3 text-right font-mono tabular-nums text-primary font-semibold">
                                      {emp.luxurySold}
                                    </td>
                                    <td className="p-3 text-center">
                                      {isLuxurySpecialist ? (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                          Luxury Specialist
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                                          Volume Specialist
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {dashboardTab === "projections" && (
                /* Projections Tab */
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6 animate-in fade-in duration-300"
                >
                  {/* Projections Summary metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      {
                        label: "Forecast Period Cumulative",
                        value: formatCurrency(cumulativeProjectedRevenue),
                        icon: DollarSign,
                        color: "text-red-500",
                        badge: `${projPeriod} Months Outlook`,
                        badgeColor: "bg-red-500/10 text-red-500 border-red-500/20",
                      },
                      {
                        label: "Projected Units Sold",
                        value: `${projectedUnitsSold} Cars`,
                        icon: Car,
                        color: "text-amber-500",
                        badge: `Avg price: ${formatCurrency(averageDealSize)}`,
                        badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
                      },
                      {
                        label: "Optimistic Final Month",
                        value: formatCurrency(projFinalOpt),
                        icon: Sparkles,
                        color: "text-emerald-500",
                        badge: `Growth: +${(projGrowthRate + 8).toFixed(0)}%`,
                        badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                      },
                      {
                        label: "Conservative Final Month",
                        value: formatCurrency(projFinalCons),
                        icon: AlertCircle,
                        color: "text-blue-500",
                        badge: `Growth: ${(projGrowthRate - 8).toFixed(0)}%`,
                        badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
                      },
                    ].map((card) => (
                      <div key={card.label} className="rounded-xl border border-border bg-card/30 p-4 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              {card.label}
                            </span>
                          </div>
                        </div>
                        <p className="text-lg sm:text-xl font-bold tabular-nums tracking-tight">{card.value}</p>
                        {card.badge && (
                          <span className={`inline-block mt-2 text-[9px] font-bold px-2 py-0.5 border rounded-full ${card.badgeColor}`}>
                            {card.badge}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="grid lg:grid-cols-3 gap-6">
                    {/* Projection Sliders */}
                    <Card className="p-5 border-border bg-card/25 backdrop-blur shadow-sm space-y-5 lg:col-span-1">
                      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                        <TrendingUp className="w-4 h-4 text-red-500" />
                        <h3 className="text-sm font-semibold">Interactive Forecast Simulator</h3>
                      </div>

                      {/* Slider 1: Estimated Annual Growth Rate */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-medium">Estimated Growth Rate (Annual)</span>
                          <span className="font-bold text-foreground">{projGrowthRate >= 0 ? "+" : ""}{projGrowthRate}%</span>
                        </div>
                        <input
                          type="range"
                          min="-20"
                          max="50"
                          step="5"
                          value={projGrowthRate}
                          onChange={(e) => setProjGrowthRate(Number(e.target.value))}
                          className="w-full h-1.5 rounded-lg bg-secondary cursor-pointer accent-red-600"
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground/60">
                          <span>Conservative (-20%)</span>
                          <span>Neutral (0%)</span>
                          <span>Aggressive (50%)</span>
                        </div>
                      </div>

                      {/* Slider 2: Projection Period */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-medium">Forecast Period</span>
                          <span className="font-bold text-foreground">{projPeriod} months</span>
                        </div>
                        <input
                          type="range"
                          min="3"
                          max="12"
                          step="1"
                          value={projPeriod}
                          onChange={(e) => setProjPeriod(Number(e.target.value))}
                          className="w-full h-1.5 rounded-lg bg-secondary cursor-pointer accent-red-600"
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground/60">
                          <span>3 Months</span>
                          <span>6 Months</span>
                          <span>12 Months</span>
                        </div>
                      </div>
                    </Card>

                    {/* Granular Target Forecaster (Selectors & Card) */}
                    <Card className="p-5 border-border bg-card/25 backdrop-blur shadow-sm space-y-5 lg:col-span-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 border-b border-border/50 pb-2 mb-4">
                          <Users className="w-4 h-4 text-red-500" />
                          <h3 className="text-sm font-semibold">Granular Target Forecaster</h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-normal mb-4">
                          Filter baseline projections dynamically by consultant, car model, and month.
                        </p>

                        <div className="grid sm:grid-cols-3 gap-4">
                          {/* Selector 1: Employee */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Select Consultant
                            </label>
                            <select
                              value={selectedProjEmployee}
                              onChange={(e) => setSelectedProjEmployee(e.target.value)}
                              className="w-full h-9 rounded-lg border border-border bg-background/50 text-xs px-2.5 outline-none cursor-pointer text-foreground"
                            >
                              <option value="all" className="bg-card">All Consultants</option>
                              {uniqueEmployees.map((name) => (
                                <option key={name} value={name} className="bg-card">
                                  {name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Selector 2: Car Model */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Select Car Model
                            </label>
                            <select
                              value={selectedProjCar}
                              onChange={(e) => setSelectedProjCar(e.target.value)}
                              className="w-full h-9 rounded-lg border border-border bg-background/50 text-xs px-2.5 outline-none cursor-pointer text-foreground"
                            >
                              <option value="all" className="bg-card">All Car Models</option>
                              {uniqueCarModels.map((model) => (
                                <option key={model} value={model} className="bg-card">
                                  {model}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Selector 3: Projected Month */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Select Month
                            </label>
                            <select
                              value={selectedProjMonth}
                              onChange={(e) => setSelectedProjMonth(e.target.value)}
                              className="w-full h-9 rounded-lg border border-border bg-background/50 text-xs px-2.5 outline-none cursor-pointer text-foreground"
                            >
                              <option value="all" className="bg-card">All Projected Months</option>
                              {projectedMonths.map((mon) => (
                                <option key={mon} value={mon} className="bg-card">
                                  {mon}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Display Readout Panel */}
                      <div className="pt-4 border-t border-border/40 grid grid-cols-3 gap-4 items-center bg-muted/10 p-4 rounded-xl">
                        {/* Units Readout */}
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">
                            Projected Target
                          </p>
                          <p className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                            {filteredProjUnits >= 0.1 ? filteredProjUnits.toFixed(1) : filteredProjUnits > 0 ? "< 0.1" : "0"}
                            <span className="text-xs text-muted-foreground font-normal ml-1">cars</span>
                          </p>
                        </div>

                        {/* Revenue Readout */}
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">
                            Projected Revenue
                          </p>
                          <p className="text-xl font-bold tracking-tight text-primary tabular-nums">
                            {formatCurrency(filteredProjRevenue)}
                          </p>
                        </div>

                        {/* Badging/Insight Readout */}
                        <div className="text-right">
                          {selectedProjEmployee !== "all" && selectedEmpData ? (
                            <div className="space-y-1">
                              <span className="text-[9px] text-muted-foreground font-medium block">
                                Rep Classification
                              </span>
                              {selectedEmpData.luxurySold > selectedEmpData.midBudgetSold ? (
                                <span className="inline-flex text-[9px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                  Luxury Elite
                                </span>
                              ) : (
                                <span className="inline-flex text-[9px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                                  Volume Leader
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="text-[9px] text-muted-foreground font-medium block">
                                Simulation status
                              </span>
                              <span className="inline-flex text-[9px] font-bold text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-full border border-border">
                                Branch Total
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Row 2: Recommendation, Staff Targets Chart & Target Achievement Infographic */}
                  <div className="grid lg:grid-cols-3 gap-8 pt-6">
                    {/* Recommendation Card (1 Column) */}
                    <Card className="p-6 border-border/60 bg-card/20 backdrop-blur-md shadow-lg space-y-5 flex flex-col justify-between hover:shadow-xl hover:border-primary/20 transition-all duration-300">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-border/40 pb-2.5">
                          <Award className="w-4 h-4 text-amber-500 animate-bounce" />
                          <h3 className="text-sm font-semibold tracking-tight">Rep Match Recommendation</h3>
                        </div>

                        {selectedProjCar !== "all" ? (
                          recommendationLoading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                              <Loader2 className="w-6 h-6 animate-spin text-primary" />
                              <p className="text-xs text-muted-foreground">Calculating match scores…</p>
                            </div>
                          ) : bestReps.length > 0 ? (
                            <div className="space-y-4">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                Top Matches Ranked
                              </p>
                              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                                {bestReps.map((rep, index) => {
                                  const isTop = index === 0;
                                  const specialty = rep.luxurySold > rep.midBudgetSold ? "Luxury Specialist" : "Volume Specialist";
                                  const pctScore = Math.min(100, Math.round(rep.score || (100 - index * 12)));
                                  
                                  return (
                                    <div 
                                      key={rep.ssn} 
                                      className={`p-3.5 rounded-xl border transition-all duration-300 ${
                                        isTop 
                                          ? "bg-primary/[0.03] border-primary/20 shadow-sm" 
                                          : "bg-secondary/10 border-border/40 hover:bg-secondary/20"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2.5">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                            isTop ? "bg-primary/10 text-primary" : "bg-muted-foreground/10 text-muted-foreground"
                                          }`}>
                                            {rep.fname[0]}{rep.lname[0]}
                                          </div>
                                          <div>
                                            <p className="font-bold text-foreground text-xs leading-none">
                                              {rep.fname} {rep.lname}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                              {rep.city} · {rep.jobTitle || "Consultant"}
                                            </p>
                                          </div>
                                        </div>
                                        <div>
                                          <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded-full border tracking-wide uppercase ${
                                            rep.luxurySold > rep.midBudgetSold 
                                              ? "text-red-500 bg-red-500/10 border-red-500/20" 
                                              : "text-blue-500 bg-blue-500/10 border-blue-500/20"
                                          }`}>
                                            {specialty}
                                          </span>
                                        </div>
                                      </div>
                                      
                                      {/* Match score indicator bar */}
                                      <div className="space-y-1 mt-2.5">
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                          <span className="font-medium">Match Score</span>
                                          <span className="font-bold text-foreground">{pctScore}%</span>
                                        </div>
                                        <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-primary transition-all duration-500" 
                                            style={{ width: `${pctScore}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-3">
                              <HelpCircle className="w-8 h-8 text-muted-foreground/20" />
                              <p>No suitable consultant matching records found for this model.</p>
                            </div>
                          )
                        ) : (
                          <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-3">
                            <HelpCircle className="w-8 h-8 text-muted-foreground/20 animate-pulse" />
                            <p>Select a specific car model to receive employee matching recommendations.</p>
                          </div>
                        )}
                      </div>

                      {selectedProjCar !== "all" && bestReps.length > 0 && (
                        <div className="text-[10px] text-muted-foreground/60 font-medium pt-3 border-t border-border/30">
                          Matching logic based on historical model shares and specialty badges.
                        </div>
                      )}
                    </Card>

                    {/* Staff Target Comparison Chart (1 Column) */}
                    <Card className="p-6 border-border/60 bg-card/20 backdrop-blur-md shadow-lg space-y-5 flex flex-col justify-between hover:shadow-xl hover:border-primary/20 transition-all duration-300">
                      <div className="space-y-4 w-full">
                        <div className="flex items-center gap-2 border-b border-border/40 pb-2.5">
                          <BarChart3 className="w-4 h-4 text-purple-500" />
                          <h3 className="text-sm font-semibold tracking-tight">Staff Projections Breakdown</h3>
                        </div>
                        
                        {selectedProjCar !== "all" ? (
                          <div className="w-full">
                            <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
                              Projected target units sold for <strong>{selectedProjCar}</strong> in <strong>{selectedProjMonth === "all" ? "the chosen period" : selectedProjMonth}</strong>.
                            </p>

                            {staffBreakdownData.length > 0 ? (
                              <div className="h-[320px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={staffBreakdownData} margin={{ left: -15, right: 10, top: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="name" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                                    <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                                    <Tooltip
                                      contentStyle={{
                                        background: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: 8,
                                        fontSize: 10,
                                      }}
                                      formatter={(value: number) => [`${value} Units`, "Target"]}
                                    />
                                    <Bar dataKey="Projected Units" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <div className="h-[320px] flex items-center justify-center text-xs text-muted-foreground">
                                No staff projections available for this selection.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-64 flex flex-col items-center justify-center text-center text-xs text-muted-foreground gap-3">
                            <BarChart3 className="w-8 h-8 text-muted-foreground/20 animate-pulse" />
                            <p>Select a specific car model above to view individual target breakdowns across showrooms.</p>
                          </div>
                        )}
                      </div>

                      {selectedProjCar !== "all" && staffBreakdownData.length > 0 && (
                        <div className="text-[10px] text-muted-foreground/60 font-medium pt-3 border-t border-border/30">
                          Targets normalized by employees' historical sales ratios.
                        </div>
                      )}
                    </Card>

                    {/* Target Achievement Infographic (1 Column) */}
                    <Card className="p-6 border-border/60 bg-card/20 backdrop-blur-md shadow-lg space-y-5 flex flex-col justify-between hover:shadow-xl hover:border-primary/20 transition-all duration-300">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-border/40 pb-2.5">
                          <Target className="w-4 h-4 text-emerald-500 animate-pulse" />
                          <h3 className="text-sm font-semibold tracking-tight">Compensation & Target Outlook</h3>
                        </div>

                        {selectedProjCar !== "all" ? (
                          <div className="space-y-4 text-xs">
                            <div className="p-3.5 bg-secondary/15 rounded-xl border border-border/40 space-y-3 shadow-inner">
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground font-medium">Dealership Comm. (2% Est.)</span>
                                <span className="font-bold text-foreground tabular-nums">{formatCurrency(filteredProjRevenue * 0.02)}</span>
                              </div>
                              <div className="w-full h-[1px] bg-border/40" />
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground font-medium">Average Net Profit Est.</span>
                                <span className="font-bold text-emerald-500 tabular-nums">{formatCurrency(filteredProjRevenue * 0.08)}</span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                Target Allocation Intensity
                              </p>
                              {/* Gauge infographic representation */}
                              <div className="relative pt-1">
                                <div className="flex mb-2 items-center justify-between text-[10px]">
                                  <div>
                                    <span className="text-[9px] font-extrabold inline-block py-1 px-2.5 uppercase rounded-full text-primary bg-primary/10 border border-primary/20">
                                      Active Allocation
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs font-bold text-primary tabular-nums">
                                      {filteredProjUnits >= 1 ? Math.min(100, Math.round(filteredProjUnits * 10)) : 10}%
                                    </span>
                                  </div>
                                </div>
                                <div className="overflow-hidden h-2.5 text-xs flex rounded bg-secondary shadow-inner border border-border/30">
                                  <div
                                    style={{ width: `${filteredProjUnits >= 1 ? Math.min(100, Math.round(filteredProjUnits * 10)) : 10}%` }}
                                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-500"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="text-muted-foreground bg-secondary/10 p-3.5 rounded-xl border border-border/30 text-[10px] leading-relaxed shadow-sm">
                              This model represents a projected share of <strong>{Math.round(carRatio * 100)}%</strong> of overall dealership showroom volume, with transactions heavily concentrated in <strong>Cash/Credit Card</strong> methods.
                            </div>
                          </div>
                        ) : (
                          <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-3">
                            <Target className="w-8 h-8 text-muted-foreground/20" />
                            <p>Select a specific car model to compute compensation and profit outlooks.</p>
                          </div>
                        )}
                      </div>

                      {selectedProjCar !== "all" && (
                        <div className="text-[10px] text-muted-foreground/60 font-medium pt-3 border-t border-border/30">
                          Financial metrics projected using baseline 8% margins.
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* Projections Chart */}
                  <div className="rounded-2xl border border-border bg-card/20 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-4 h-4 text-purple-500" />
                      <h3 className="text-sm font-semibold">Projections Trend Analysis</h3>
                    </div>
                    {projectionData.length > 0 ? (
                      <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={projectionData} margin={{ left: -10, right: 10, top: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                            <YAxis
                              tick={{ fontSize: 9 }}
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
                              formatter={(value: number, name: string) => [
                                formatCurrency(value),
                                name.charAt(0).toUpperCase() + name.slice(1)
                              ]}
                            />
                            <Legend wrapperStyle={{ fontSize: 8 }} />
                            {/* Historical line */}
                            <Line
                              type="monotone"
                              dataKey="revenue"
                              stroke="hsl(var(--primary))"
                              strokeWidth={3}
                              dot={{ r: 3 }}
                              name="Historical Revenue"
                            />
                            {/* Baseline projection */}
                            <Line
                              type="monotone"
                              dataKey="baseline"
                              stroke="hsl(200 70% 50%)"
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              dot={false}
                              name="Baseline (Slider)"
                            />
                            {/* Optimistic projection */}
                            <Line
                              type="monotone"
                              dataKey="optimistic"
                              stroke="hsl(145 60% 45%)"
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              dot={false}
                              name="Optimistic Path"
                            />
                            {/* Conservative projection */}
                            <Line
                              type="monotone"
                              dataKey="conservative"
                              stroke="hsl(0 72% 51%)"
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              dot={false}
                              name="Conservative Path"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[400px] flex items-center justify-center text-xs text-muted-foreground">
                        No revenue trends logs recorded.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {dashboardTab === "executive" && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Composed Chart: Revenue vs Target Trajectory */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-xl p-5 shadow-lg">
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-4 h-4 text-purple-500" />
                        <h3 className="text-sm font-semibold">National Revenue vs Target Trajectory</h3>
                      </div>
                      <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={combinedTrendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <defs>
                              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(200 75% 45%)" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="hsl(200 75% 45%)" stopOpacity={0.2} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} className="fill-muted-foreground" axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 10 }} className="fill-muted-foreground" axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsla(var(--card)/0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Bar dataKey="revenue" barSize={20} fill="url(#barGradient)" name="Actual Revenue" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="optimistic" stroke="hsl(145 60% 45%)" strokeWidth={3} name="Target" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.div>

                    {/* Radar Chart: Branch Multi-dimensional Performance */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-xl p-5 shadow-lg">
                      <div className="flex items-center gap-2 mb-4">
                        <Target className="w-4 h-4 text-blue-500" />
                        <h3 className="text-sm font-semibold">Branch Performance Matrix</h3>
                      </div>
                      <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={branchRadarData}>
                            <PolarGrid stroke="hsl(var(--border))" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                            <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsla(var(--card)/0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Radar name="Cairo Branch" dataKey="Cairo" stroke="hsl(0 72% 51%)" fill="hsl(0 72% 51%)" fillOpacity={0.4} />
                            <Radar name="Alex Branch" dataKey="Alex" stroke="hsl(200 75% 45%)" fill="hsl(200 75% 45%)" fillOpacity={0.4} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.div>

                    {/* Stacked Bar Graph: Showroom Segmentation */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }} className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-xl p-5 shadow-lg lg:col-span-2">
                      <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm font-semibold">Deal Composition by Region</h3>
                      </div>
                      <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={activeStats?.topBranches?.slice(0, 8) || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} className="fill-muted-foreground" axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsla(var(--card)/0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} formatter={(val: number) => formatCurrency(val)} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Bar dataKey="revenue" stackId="a" fill="hsl(25 95% 53%)" name="Mid-Tier Revenue" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="revenue" stackId="a" fill="hsl(0 72% 51%)" name="Luxury Revenue" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
