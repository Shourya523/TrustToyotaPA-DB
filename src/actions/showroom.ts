"use server";

import type {
  Branch,
  BranchStats,
  CityMapPoint,
  EmployeeSale,
  NationalStats,
} from "@/src/lib/showroom-types";
import { CITY_COORDINATES, formatMonthLabel } from "@/src/lib/showroom-types";

const getPostgres = async () => (await import("postgres")).default;

async function withDb<T>(fn: (sql: ReturnType<Awaited<ReturnType<typeof getPostgres>>>) => Promise<T>): Promise<T> {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL is not configured");
  const postgres = await getPostgres();
  const sql = postgres(uri, { max: 1, connect_timeout: 15 });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

function getUSCityForSynthetic(syntheticCity: string): { name: string; lat: number; lng: number } {
  const keys = Object.keys(CITY_COORDINATES);
  let hash = 0;
  for (let i = 0; i < syntheticCity.length; i++) {
    hash = (hash * 31 + syntheticCity.charCodeAt(i)) >>> 0;
  }
  const name = keys[hash % keys.length];
  const coords = CITY_COORDINATES[name];
  return { name, ...coords };
}

async function getDynamicBranches(sql: any): Promise<Branch[]> {
  const rows = await sql<{ city: string }[]>`
    SELECT DISTINCT city FROM customers WHERE city IS NOT NULL AND city != '' ORDER BY city
  `;
  return rows.map((r: any, i: number) => {
    const dbCity = r.city.trim();
    const usCity = getUSCityForSynthetic(dbCity);
    const id = 2001 + i;
    return {
      branchId: id,
      street: `${dbCity} Showroom`,
      city: usCity.name,
      dbCity: dbCity,
      buildingNumber: 10 + (dbCity.length % 90),
      contactNumber: "1-800-TOYOTA",
    };
  });
}

async function getBranchDetails(sql: any, branchId: number): Promise<Branch> {
  const branches = await getDynamicBranches(sql);
  const b = branches.find((x) => x.branchId === branchId);
  return b || { branchId: 2001, city: "New York", dbCity: "Juliabury", street: "Juliabury Showroom", buildingNumber: 42, contactNumber: "1-800-TOYOTA" };
}

function nameToSsn(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 9000000) + 1000000;
}

async function getReportMonth(sql: ReturnType<Awaited<ReturnType<typeof getPostgres>>>, branchId?: number, city?: string) {
  let row;
  if (branchId) {
    const details = await getBranchDetails(sql, branchId);
    const dbCity = details.dbCity || details.city;
    [row] = await sql<{ month_start: Date }[]>`
      SELECT date_trunc('month', MAX(s.sale_date))::date AS month_start
      FROM sales s
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE cu.city = ${dbCity}
    `;
  } else if (city) {
    const branches = await fetchBranches(sql);
    const dbCities = branches.filter(b => b.city.toLowerCase() === city.toLowerCase()).map(b => b.dbCity).filter(Boolean) as string[];
    if (dbCities.length > 0) {
      [row] = await sql<{ month_start: Date }[]>`
        SELECT date_trunc('month', MAX(s.sale_date))::date AS month_start
        FROM sales s
        JOIN customers cu ON cu.customer_id = s.customer_id
        WHERE cu.city IN (${dbCities})
      `;
    } else {
      [row] = await sql<{ month_start: Date }[]>`
        SELECT date_trunc('month', MAX(sale_date))::date AS month_start
        FROM sales
      `;
    }
  } else {
    [row] = await sql<{ month_start: Date }[]>`
      SELECT date_trunc('month', MAX(sale_date))::date AS month_start
      FROM sales
    `;
  }
  if (!row?.month_start) {
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), label: formatMonthLabel(now) };
  }
  const start = new Date(row.month_start);
  return { start, label: formatMonthLabel(start) };
}

function monthRange(start: Date) {
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return { start, end };
}

async function fetchBranches(sql: ReturnType<Awaited<ReturnType<typeof getPostgres>>>) {
  return getDynamicBranches(sql);
}

async function fetchBranchStats(
  sql: ReturnType<Awaited<ReturnType<typeof getPostgres>>>,
  branchId: number,
  monthStart: Date,
  monthEnd: Date
): Promise<Omit<BranchStats, "branch">> {
  const branchDetails = await getBranchDetails(sql, branchId);
  const dbCity = branchDetails.dbCity || branchDetails.city;

  const salesRows = await sql<
    {
      salesperson: string;
      cars_sold: string;
      revenue: string;
      mid_budget_sold: string;
      luxury_sold: string;
      top_model: string | null;
      payment_method: string | null;
    }[]
  >`
    WITH city_sales AS (
      SELECT 
        s.salesperson,
        s.sale_id,
        s.payment_method,
        s.sale_price * s.quantity AS sale_revenue,
        c.brand || ' ' || c.model AS car_label
      FROM sales s
      JOIN customers cu ON cu.customer_id = s.customer_id
      JOIN cars c ON c.car_id = s.car_id
      WHERE cu.city = ${dbCity}
        AND s.sale_date >= ${monthStart}
        AND s.sale_date < ${monthEnd}
    ),
    rep_summary AS (
      SELECT
        salesperson,
        COUNT(*)::int AS cars_sold,
        SUM(sale_revenue) AS revenue,
        COUNT(CASE WHEN sale_revenue < 50000 THEN 1 END)::int AS mid_budget_sold,
        COUNT(CASE WHEN sale_revenue >= 50000 THEN 1 END)::int AS luxury_sold,
        MODE() WITHIN GROUP (ORDER BY car_label) AS top_model,
        MODE() WITHIN GROUP (ORDER BY payment_method) AS payment_method
      FROM city_sales
      GROUP BY salesperson
    )
    SELECT * FROM rep_summary
    ORDER BY revenue DESC
  `;

  const sales: EmployeeSale[] = salesRows.map((r) => {
    const ssn = nameToSsn(r.salesperson);
    const parts = r.salesperson.split(" ");
    const fname = parts[0] || "Sales";
    const lname = parts.slice(1).join(" ") || "Rep";
    const revenue = Number(r.revenue);
    const commPct = 0.02;
    const commission = revenue * commPct;
    
    let gender = "M";
    if (["sara", "mona", "jill", "claudia", "tanya", "nicole", "laura"].some(n => r.salesperson.toLowerCase().includes(n))) {
      gender = "F";
    }

    return {
      ssn,
      fname,
      lname,
      jobTitle: "Sales Consultant",
      salary: 12000,
      commPct,
      gender,
      phone1: `+1 ${(ssn % 900) + 100}-${(ssn % 9000) + 1000}`,
      birthDate: new Date(1985 + (ssn % 15), ssn % 12, (ssn % 28) + 1).toLocaleDateString("en-US"),
      city: branchDetails.city,
      carsSold: Number(r.cars_sold),
      revenue,
      commission,
      topModel: r.top_model ?? "—",
      paymentMethod: r.payment_method ?? "—",
      midBudgetSold: Number(r.mid_budget_sold),
      luxurySold: Number(r.luxury_sold),
    };
  });

  const totalRevenue = sales.reduce((s, e) => s + e.revenue, 0);
  const totalCommission = sales.reduce((s, e) => s + e.commission, 0);
  const totalCarsSold = sales.reduce((s, e) => s + e.carsSold, 0);
  const totalPayroll = sales.reduce((s, e) => s + e.salary, 0);

  const paymentRows = await sql<{ payment_method: string; count: string }[]>`
    SELECT s.payment_method, SUM(s.quantity)::text AS count
    FROM sales s
    JOIN customers cu ON cu.customer_id = s.customer_id
    WHERE cu.city = ${dbCity}
      AND s.sale_date >= ${monthStart}
      AND s.sale_date < ${monthEnd}
    GROUP BY s.payment_method
    ORDER BY SUM(s.quantity) DESC
  `;

  const trendRows = await sql<{ month: string; revenue: string }[]>`
    SELECT 
      TO_CHAR(DATE_TRUNC('month', s.sale_date), 'Mon') AS month,
      SUM(s.sale_price * s.quantity)::text AS revenue,
      DATE_TRUNC('month', s.sale_date) AS sort_date
    FROM sales s
    JOIN customers cu ON cu.customer_id = s.customer_id
    WHERE cu.city = ${dbCity}
      AND s.sale_date >= ${monthStart} - INTERVAL '5 months'
      AND s.sale_date < ${monthEnd}
    GROUP BY DATE_TRUNC('month', s.sale_date)
    ORDER BY sort_date
  `;

  return {
    totalRevenue,
    totalCommission,
    totalCarsSold,
    totalPayroll,
    employeeCount: sales.length,
    paymentBreakdown: paymentRows.map((p) => ({ method: p.payment_method || "Other", count: Number(p.count) })),
    monthlyTrend: trendRows.map((t) => ({ month: t.month, revenue: Number(t.revenue) })),
    sales,
  };
}

export async function getNationalShowroomStats(): Promise<NationalStats> {
  return withDb(async (sql) => {
    const { start, label } = await getReportMonth(sql);
    const { end } = monthRange(start);
    const branches = await fetchBranches(sql);

    const [empCount] = await sql<{ count: string }[]>`SELECT COUNT(DISTINCT salesperson)::text AS count FROM sales`;

    const topCarsRows = await sql<{ name: string; count: number; revenue: string }[]>`
      SELECT 
        c.brand || ' ' || c.model AS name,
        SUM(s.quantity)::int AS count,
        SUM(s.sale_price * s.quantity)::text AS revenue
      FROM sales s
      JOIN cars c ON c.car_id = s.car_id
      WHERE s.sale_date >= ${start} AND s.sale_date < ${end}
      GROUP BY c.brand, c.model
      ORDER BY count DESC, revenue DESC
      LIMIT 5
    `;
    const topCars = topCarsRows.map((r: any) => ({
      name: r.name,
      count: r.count,
      revenue: Number(r.revenue)
    }));

    const topSalespeopleRows = await sql<{ name: string; count: number; revenue: string; city: string }[]>`
      SELECT 
        s.salesperson AS name,
        SUM(s.quantity)::int AS count,
        SUM(s.sale_price * s.quantity)::text AS revenue,
        MODE() WITHIN GROUP (ORDER BY cu.city) AS city
      FROM sales s
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE s.sale_date >= ${start} AND s.sale_date < ${end}
      GROUP BY s.salesperson
      ORDER BY SUM(s.sale_price * s.quantity) DESC
      LIMIT 5
    `;
    const topSalespeople = topSalespeopleRows.map((r: any) => ({
      name: r.name,
      count: r.count,
      revenue: Number(r.revenue),
      branch: `${getUSCityForSynthetic(r.city).name} Showroom`
    }));

    const topBranchesRows = await sql<{ city: string; count: number; revenue: string }[]>`
      SELECT 
        cu.city,
        SUM(s.quantity)::int AS count,
        SUM(s.sale_price * s.quantity)::text AS revenue
      FROM sales s
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE s.sale_date >= ${start} AND s.sale_date < ${end}
      GROUP BY cu.city
      ORDER BY SUM(s.sale_price * s.quantity) DESC
      LIMIT 5
    `;
    const topBranches = topBranchesRows.map((r: any) => ({
      name: `${r.city} Showroom`,
      city: getUSCityForSynthetic(r.city).name,
      count: r.count,
      revenue: Number(r.revenue)
    }));

    const citySummaries = await sql<{ city: string; total_cars_sold: number; total_revenue: string; employee_count: number }[]>`
      SELECT 
        cu.city,
        SUM(s.quantity)::int AS total_cars_sold,
        SUM(s.sale_price * s.quantity)::text AS total_revenue,
        COUNT(DISTINCT s.salesperson)::int AS employee_count
      FROM sales s
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE s.sale_date >= ${start} AND s.sale_date < ${end}
      GROUP BY cu.city
    `;

    const allRepsRows = await sql<{
      salesperson: string;
      city: string;
      cars_sold: number;
      revenue: string;
      mid_budget_sold: number;
      luxury_sold: number;
      top_model: string | null;
      payment_method: string | null;
    }[]>`
      WITH city_sales AS (
        SELECT 
          s.salesperson,
          s.sale_id,
          s.payment_method,
          s.sale_price * s.quantity AS sale_revenue,
          c.brand || ' ' || c.model AS car_label,
          cu.city
        FROM sales s
        JOIN customers cu ON cu.customer_id = s.customer_id
        JOIN cars c ON c.car_id = s.car_id
        WHERE s.sale_date >= ${start}
          AND s.sale_date < ${end}
      )
      SELECT
        salesperson,
        city,
        COUNT(*)::int AS cars_sold,
        SUM(sale_revenue)::text AS revenue,
        COUNT(CASE WHEN sale_revenue < 50000 THEN 1 END)::int AS mid_budget_sold,
        COUNT(CASE WHEN sale_revenue >= 50000 THEN 1 END)::int AS luxury_sold,
        MODE() WITHIN GROUP (ORDER BY car_label) AS top_model,
        MODE() WITHIN GROUP (ORDER BY payment_method) AS payment_method
      FROM city_sales
      GROUP BY salesperson, city
    `;

    const allPaymentsRows = await sql<{ city: string; payment_method: string; count: string }[]>`
      SELECT cu.city, s.payment_method, SUM(s.quantity)::text AS count
      FROM sales s
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE s.sale_date >= ${start} AND s.sale_date < ${end}
      GROUP BY cu.city, s.payment_method
    `;

    const allTrendsRows = await sql<{ city: string; month: string; revenue: string; sort_date: Date }[]>`
      SELECT 
        cu.city,
        TO_CHAR(DATE_TRUNC('month', s.sale_date), 'Mon') AS month,
        SUM(s.sale_price * s.quantity)::text AS revenue,
        DATE_TRUNC('month', s.sale_date) AS sort_date
      FROM sales s
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE s.sale_date >= ${start} - INTERVAL '5 months'
        AND s.sale_date < ${end}
      GROUP BY cu.city, DATE_TRUNC('month', s.sale_date)
      ORDER BY cu.city, sort_date
    `;

    const summaryByCity: Record<string, { totalCarsSold: number; totalRevenue: number; employeeCount: number }> = {};
    for (const r of citySummaries) {
      summaryByCity[r.city.trim()] = {
        totalCarsSold: r.total_cars_sold,
        totalRevenue: Number(r.total_revenue),
        employeeCount: r.employee_count
      };
    }

    const repsByCity: Record<string, EmployeeSale[]> = {};
    for (const r of allRepsRows) {
      const dbCity = r.city.trim();
      const usCity = getUSCityForSynthetic(dbCity);
      const ssn = nameToSsn(r.salesperson);
      const parts = r.salesperson.split(" ");
      const fname = parts[0] || "Sales";
      const lname = parts.slice(1).join(" ") || "Rep";
      const revenue = Number(r.revenue);
      const commPct = 0.02;
      const commission = revenue * commPct;
      
      let gender = "M";
      if (["sara", "mona", "jill", "claudia", "tanya", "nicole", "laura"].some(n => r.salesperson.toLowerCase().includes(n))) {
        gender = "F";
      }

      const empSale: EmployeeSale = {
        ssn,
        fname,
        lname,
        jobTitle: "Sales Consultant",
        salary: 12000,
        commPct,
        gender,
        phone1: `+1 ${(ssn % 900) + 100}-${(ssn % 9000) + 1000}`,
        birthDate: new Date(1985 + (ssn % 15), ssn % 12, (ssn % 28) + 1).toLocaleDateString("en-US"),
        city: usCity.name,
        carsSold: Number(r.cars_sold),
        revenue,
        commission,
        topModel: r.top_model ?? "—",
        paymentMethod: r.payment_method ?? "—",
        midBudgetSold: Number(r.mid_budget_sold),
        luxurySold: Number(r.luxury_sold),
      };

      if (!repsByCity[dbCity]) {
        repsByCity[dbCity] = [];
      }
      repsByCity[dbCity].push(empSale);
    }

    const paymentsByCity: Record<string, { method: string; count: number }[]> = {};
    for (const p of allPaymentsRows) {
      const dbCity = p.city.trim();
      if (!paymentsByCity[dbCity]) {
        paymentsByCity[dbCity] = [];
      }
      paymentsByCity[dbCity].push({
        method: p.payment_method || "Other",
        count: Number(p.count)
      });
    }

    const trendsByCity: Record<string, { month: string; revenue: number }[]> = {};
    for (const t of allTrendsRows) {
      const dbCity = t.city.trim();
      if (!trendsByCity[dbCity]) {
        trendsByCity[dbCity] = [];
      }
      trendsByCity[dbCity].push({
        month: t.month,
        revenue: Number(t.revenue)
      });
    }

    const branchStats: BranchStats[] = branches.map((branch) => {
      const dbCity = branch.dbCity || branch.city;
      const summary = summaryByCity[dbCity];
      const salesList = repsByCity[dbCity] || [];
      const paymentBreakdown = paymentsByCity[dbCity] || [];
      const monthlyTrend = trendsByCity[dbCity] || [];

      if (!summary) {
        return {
          branch,
          totalRevenue: 0,
          totalCommission: 0,
          totalCarsSold: 0,
          totalPayroll: 0,
          employeeCount: 0,
          paymentBreakdown: [],
          monthlyTrend: [],
          sales: []
        };
      }

      const totalRevenue = summary.totalRevenue;
      const totalCommission = salesList.reduce((s: number, e: any) => s + e.commission, 0);
      const totalCarsSold = summary.totalCarsSold;
      const totalPayroll = salesList.reduce((s: number, e: any) => s + e.salary, 0);
      const employeeCount = summary.employeeCount;

      return {
        branch,
        totalRevenue,
        totalCommission,
        totalCarsSold,
        totalPayroll,
        employeeCount,
        paymentBreakdown,
        monthlyTrend,
        sales: salesList.sort((x, y) => y.revenue - x.revenue)
      };
    });

    const totalRevenue = branchStats.reduce((s: number, b: any) => s + b.totalRevenue, 0);
    const totalCarsSold = branchStats.reduce((s: number, b: any) => s + b.totalCarsSold, 0);

    return {
      totalBranches: branches.length,
      totalEmployees: Number(empCount?.count ?? 0),
      totalRevenue,
      totalCarsSold,
      branchStats,
      reportMonth: label,
      topCars,
      topSalespeople,
      topBranches
    };
  });
}

export async function getCityShowroomStats(city: string) {
  return withDb(async (sql) => {
    const { start, label } = await getReportMonth(sql, undefined, city);
    const { end } = monthRange(start);
    const branches = (await fetchBranches(sql)).filter((b) => b.city.toLowerCase() === city.toLowerCase());

    const branchStats: BranchStats[] = [];
    for (const branch of branches) {
      const stats = await fetchBranchStats(sql, branch.branchId, start, end);
      branchStats.push({ branch, ...stats });
    }

    return {
      city,
      reportMonth: label,
      branches: branchStats,
      totalRevenue: branchStats.reduce((s, b) => s + b.totalRevenue, 0),
      totalCarsSold: branchStats.reduce((s, b) => s + b.totalCarsSold, 0),
    };
  });
}

export async function getBranchShowroomStats(branchId: number): Promise<BranchStats & { reportMonth: string }> {
  return withDb(async (sql) => {
    const { start, label } = await getReportMonth(sql, branchId);
    const { end } = monthRange(start);
    const branches = await fetchBranches(sql);
    const branch = branches.find((b) => b.branchId === branchId);
    if (!branch) throw new Error("Branch not found");

    const stats = await fetchBranchStats(sql, branchId, start, end);
    return { branch, reportMonth: label, ...stats };
  });
}

export async function getCityMapPoints(): Promise<CityMapPoint[]> {
  return withDb(async (sql) => {
    const { start } = await getReportMonth(sql);
    const { end } = monthRange(start);

    const rows = await sql<{ city: string; revenue: string; count: string }[]>`
      SELECT
        cu.city,
        COALESCE(SUM(s.sale_price * s.quantity), 0)::text AS revenue,
        COALESCE(SUM(s.quantity), 0)::text AS count
      FROM customers cu
      LEFT JOIN sales s ON s.customer_id = cu.customer_id
        AND s.sale_date >= ${start}
        AND s.sale_date < ${end}
      WHERE cu.city IS NOT NULL AND cu.city != ''
      GROUP BY cu.city
    `;

    const keys = Object.keys(CITY_COORDINATES);
    const buckets = keys.reduce((acc, key) => {
      acc[key] = { branchCount: 0, totalRevenue: 0 };
      return acc;
    }, {} as Record<string, { branchCount: number; totalRevenue: number }>);

    for (const r of rows) {
      const dbCity = r.city.trim();
      const usCity = getUSCityForSynthetic(dbCity);
      buckets[usCity.name].branchCount += 1;
      buckets[usCity.name].totalRevenue += Number(r.revenue);
    }

    return keys.map((name) => ({
      city: name,
      lat: CITY_COORDINATES[name].lat,
      lng: CITY_COORDINATES[name].lng,
      branchCount: buckets[name].branchCount,
      totalRevenue: buckets[name].totalRevenue,
    }));
  });
}

export async function getShowroomCities(): Promise<string[]> {
  return withDb(async (sql) => {
    const branches = await fetchBranches(sql);
    const cities = Array.from(new Set(branches.map((b) => b.city)));
    return cities.sort();
  });
}

export async function getLowInventoryAlerts() {
  return withDb(async (sql) => {
    const rows = await sql<
      {
        model: string;
        brand: string;
        quantity_in_stock: number;
        status: string;
      }[]
    >`
      SELECT model, brand, quantity_in_stock, status
      FROM cars
      WHERE quantity_in_stock < 5
      ORDER BY quantity_in_stock ASC
      LIMIT 10
    `;
    return rows.map((r) => ({
      model: r.model,
      brand: r.brand,
      street: "Main Depot",
      city: "Central Stock",
      noOfCars: Number(r.quantity_in_stock),
    }));
  });
}

export async function getCategoryMetrics() {
  return withDb(async (sql) => {
    const modelsRows = await sql<{ name: string; units_sold: number; revenue: string }[]>`
      SELECT 
        c.brand || ' ' || c.model AS name,
        SUM(s.quantity)::int AS units_sold,
        SUM(s.sale_price * s.quantity)::text AS revenue
      FROM cars c
      LEFT JOIN sales s ON s.car_id = c.car_id
      GROUP BY c.brand, c.model
      ORDER BY units_sold DESC, revenue DESC
    `;

    const brandsRows = await sql<{ name: string; units_sold: number; revenue: string }[]>`
      SELECT 
        c.brand AS name,
        SUM(s.quantity)::int AS units_sold,
        SUM(s.sale_price * s.quantity)::text AS revenue
      FROM cars c
      LEFT JOIN sales s ON s.car_id = c.car_id
      GROUP BY c.brand
      ORDER BY units_sold DESC, revenue DESC
    `;

    const paymentsRows = await sql<{ name: string; count: number; revenue: string }[]>`
      SELECT 
        s.payment_method AS name,
        SUM(s.quantity)::int AS count,
        SUM(s.sale_price * s.quantity)::text AS revenue
      FROM sales s
      WHERE s.payment_method IS NOT NULL
      GROUP BY s.payment_method
      ORDER BY count DESC
    `;

    const gendersRows = await sql<{ name: string; count: number; revenue: string }[]>`
      SELECT 
        cu.gender AS name,
        SUM(s.quantity)::int AS count,
        SUM(s.sale_price * s.quantity)::text AS revenue
      FROM customers cu
      JOIN sales s ON s.customer_id = cu.customer_id
      WHERE cu.gender IS NOT NULL
      GROUP BY cu.gender
    `;

    return {
      models: modelsRows.map((r) => ({
        name: r.name,
        unitsSold: Number(r.units_sold || 0),
        revenue: Number(r.revenue || 0),
        avgPrice: Number(r.units_sold || 0) > 0 ? Number(r.revenue || 0) / Number(r.units_sold || 1) : 0,
      })),
      brands: brandsRows.map((r) => ({
        name: r.name || "Unknown",
        unitsSold: Number(r.units_sold || 0),
        revenue: Number(r.revenue || 0),
      })),
      payments: paymentsRows.map((r) => ({
        name: r.name || "Other",
        count: Number(r.count || 0),
        revenue: Number(r.revenue || 0),
      })),
      genders: gendersRows.map((r) => ({
        name: r.name === "M" || r.name === "Male" ? "Male Customers" : "Female Customers",
        count: Number(r.count || 0),
        revenue: Number(r.revenue || 0),
        avgSpend: Number(r.count || 0) > 0 ? Number(r.revenue || 0) / Number(r.count || 1) : 0,
      })),
    };
  });
}

export async function getBestRepForCarAction(carModel: string) {
  return withDb(async (sql) => {
    const rows = await sql<{
      salesperson: string;
      cars_sold: number;
      revenue: string;
      luxury_sold: number;
      mid_budget_sold: number;
      top_model: string | null;
      city: string;
    }[]>`
      SELECT 
        s.salesperson,
        SUM(s.quantity)::int AS cars_sold,
        SUM(s.sale_price * s.quantity)::text AS revenue,
        COUNT(CASE WHEN s.sale_price >= 50000 THEN 1 END)::int AS luxury_sold,
        COUNT(CASE WHEN s.sale_price < 50000 THEN 1 END)::int AS mid_budget_sold,
        MAX(c.brand || ' ' || c.model) AS top_model,
        MODE() WITHIN GROUP (ORDER BY cu.city) AS city
      FROM sales s
      JOIN cars c ON c.car_id = s.car_id
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE (c.brand || ' ' || c.model) = ${carModel}
      GROUP BY s.salesperson
      ORDER BY cars_sold DESC, revenue DESC
      LIMIT 5
    `;
    
    return rows.map(r => {
      const ssn = nameToSsn(r.salesperson);
      return {
        ssn,
        fname: r.salesperson.split(" ")[0] || "Sales",
        lname: r.salesperson.split(" ").slice(1).join(" ") || "Rep",
        jobTitle: "Sales Consultant",
        city: getUSCityForSynthetic(r.city).name,
        carsSold: Number(r.cars_sold),
        revenue: Number(r.revenue),
        luxurySold: Number(r.luxury_sold),
        midBudgetSold: Number(r.mid_budget_sold),
        topModel: r.top_model ?? "—"
      };
    });
  });
}
