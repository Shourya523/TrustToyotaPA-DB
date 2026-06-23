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

async function getReportMonth(sql: ReturnType<Awaited<ReturnType<typeof getPostgres>>>, branchId?: number, city?: string) {
  let row;
  if (branchId) {
    [row] = await sql<{ month_start: Date }[]>`
      SELECT date_trunc('month', MAX(contract_date))::date AS month_start
      FROM contract
      WHERE branch_id = ${branchId}
    `;
  } else if (city) {
    [row] = await sql<{ month_start: Date }[]>`
      SELECT date_trunc('month', MAX(contract_date))::date AS month_start
      FROM contract c
      JOIN branch b ON b.branch_id = c.branch_id
      WHERE b.city = ${city}
    `;
  } else {
    [row] = await sql<{ month_start: Date }[]>`
      SELECT date_trunc('month', MAX(contract_date))::date AS month_start
      FROM contract
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
  const rows = await sql<
    {
      branch_id: number;
      street: string;
      city: string;
      building_number: number;
      contact_number: number;
    }[]
  >`
    SELECT branch_id, street, city, building_number, contact_number
    FROM branch
    ORDER BY branch_id
  `;
  return rows.map(
    (r): Branch => ({
      branchId: r.branch_id,
      street: r.street,
      city: r.city,
      buildingNumber: r.building_number,
      contactNumber: String(r.contact_number),
    })
  );
}

async function fetchBranchStats(
  sql: ReturnType<Awaited<ReturnType<typeof getPostgres>>>,
  branchId: number,
  monthStart: Date,
  monthEnd: Date
): Promise<Omit<BranchStats, "branch">> {
  const employeeRows = await sql<
    {
      ssn: number;
      fname: string;
      lname: string;
      gender: string;
      birth_date: Date;
      phone_1: string;
      city: string;
      job_title: string;
      salary: number | null;
      comm_pct: number | null;
      cars_sold: string;
      revenue: string;
      commission: string;
      top_model: string | null;
      payment_method: string | null;
      mid_budget_sold: string;
      luxury_sold: string;
    }[]
  >`
    WITH month_contracts AS (
      SELECT
        c.emp_ssn,
        c.contract_id,
        pm.method AS payment_method,
        COALESCE(cph.price, 0)::numeric AS price,
        comp.name || ' ' || car.model AS car_label
      FROM contract c
      JOIN payment_method pm ON pm.method_id = c.method_id
      JOIN car ON car.car_id = c.car_id
      JOIN company comp ON comp.company_id = car.company_id
      LEFT JOIN LATERAL (
        SELECT price FROM car_price_history
        WHERE car_id = c.car_id
        ORDER BY price_date DESC
        LIMIT 1
      ) cph ON true
      WHERE c.branch_id = ${branchId}
        AND c.contract_date >= ${monthStart}
        AND c.contract_date < ${monthEnd}
    ),
    emp_sales AS (
      SELECT
        emp_ssn,
        COUNT(*)::int AS cars_sold,
        COALESCE(SUM(price), 0) AS revenue,
        MAX(car_label) AS top_model,
        MODE() WITHIN GROUP (ORDER BY payment_method) AS payment_method,
        COUNT(CASE WHEN price < 1500000 THEN 1 END)::int AS mid_budget_sold,
        COUNT(CASE WHEN price >= 1500000 THEN 1 END)::int AS luxury_sold
      FROM month_contracts
      GROUP BY emp_ssn
    )
    SELECT
      e.ssn,
      e.fname,
      e.lname,
      e.gender,
      e.birth_date,
      e.phone_1,
      e.city,
      j.title AS job_title,
      s.salary,
      s.comm_pct,
      COALESCE(es.cars_sold, 0)::text AS cars_sold,
      COALESCE(es.revenue, 0)::text AS revenue,
      COALESCE(es.revenue * COALESCE(s.comm_pct, 0), 0)::text AS commission,
      es.top_model,
      es.payment_method,
      COALESCE(es.mid_budget_sold, 0)::text AS mid_budget_sold,
      COALESCE(es.luxury_sold, 0)::text AS luxury_sold
    FROM employee e
    JOIN job j ON j.job_id = e.job_id
    LEFT JOIN salary_of_jobs s ON s.emp_ssn = e.ssn
    LEFT JOIN emp_sales es ON es.emp_ssn = e.ssn
    WHERE e.branch_id = ${branchId}
    ORDER BY COALESCE(es.revenue, 0) DESC, e.lname, e.fname
  `;

  const sales: EmployeeSale[] = employeeRows.map((r) => ({
    ssn: r.ssn,
    fname: r.fname,
    lname: r.lname,
    jobTitle: r.job_title,
    salary: Number(r.salary ?? 15000),
    commPct: Number(r.comm_pct ?? 0),
    gender: r.gender,
    phone1: r.phone_1,
    birthDate: new Date(r.birth_date).toLocaleDateString("en-GB"),
    city: r.city,
    carsSold: Number(r.cars_sold),
    revenue: Number(r.revenue),
    commission: Number(r.commission),
    topModel: r.top_model ?? "—",
    paymentMethod: r.payment_method ?? "—",
    midBudgetSold: Number(r.mid_budget_sold),
    luxurySold: Number(r.luxury_sold),
  }));

  const totalRevenue = sales.reduce((s, e) => s + e.revenue, 0);
  const totalCommission = sales.reduce((s, e) => s + e.commission, 0);
  const totalCarsSold = sales.reduce((s, e) => s + e.carsSold, 0);
  const totalPayroll = sales.reduce((s, e) => s + e.salary, 0);

  const paymentRows = await sql<{ method: string; count: string }[]>`
    SELECT pm.method, COUNT(*)::text AS count
    FROM contract c
    JOIN payment_method pm ON pm.method_id = c.method_id
    WHERE c.branch_id = ${branchId}
      AND c.contract_date >= ${monthStart}
      AND c.contract_date < ${monthEnd}
    GROUP BY pm.method
    ORDER BY COUNT(*) DESC
  `;

  const trendRows = await sql<{ month: string; revenue: string }[]>`
    SELECT
      TO_CHAR(date_trunc('month', c.contract_date), 'Mon') AS month,
      COALESCE(SUM(cph.price), 0)::text AS revenue
    FROM contract c
    LEFT JOIN LATERAL (
      SELECT price FROM car_price_history
      WHERE car_id = c.car_id ORDER BY price_date DESC LIMIT 1
    ) cph ON true
    WHERE c.branch_id = ${branchId}
      AND c.contract_date >= ${monthStart} - INTERVAL '5 months'
      AND c.contract_date < ${monthEnd}
    GROUP BY date_trunc('month', c.contract_date)
    ORDER BY date_trunc('month', c.contract_date)
  `;

  return {
    totalRevenue,
    totalCommission,
    totalCarsSold,
    totalPayroll,
    employeeCount: sales.length,
    paymentBreakdown: paymentRows.map((p) => ({ method: p.method, count: Number(p.count) })),
    monthlyTrend: trendRows.map((t) => ({ month: t.month, revenue: Number(t.revenue) })),
    sales,
  };
}

export async function getNationalShowroomStats(): Promise<NationalStats> {
  return withDb(async (sql) => {
    const { start, label } = await getReportMonth(sql);
    const { end } = monthRange(start);
    const branches = await fetchBranches(sql);

    const branchStats: BranchStats[] = [];
    for (const branch of branches) {
      const stats = await fetchBranchStats(sql, branch.branchId, start, end);
      branchStats.push({ branch, ...stats });
    }

    const [empCount] = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM employee`;

    // Query top cars
    const topCarsRows = await sql<{ name: string; count: number; revenue: string }[]>`
      SELECT 
        comp.name || ' ' || car.model AS name, 
        COUNT(*)::int AS count,
        COALESCE(SUM(cph.price), 0)::text AS revenue
      FROM contract con
      JOIN car ON car.car_id = con.car_id
      JOIN company comp ON comp.company_id = car.company_id
      LEFT JOIN LATERAL (
        SELECT price FROM car_price_history
        WHERE car_id = con.car_id
        ORDER BY price_date DESC
        LIMIT 1
      ) cph ON true
      WHERE con.contract_date >= ${start} AND con.contract_date < ${end}
      GROUP BY comp.name, car.model
      ORDER BY count DESC, revenue DESC
      LIMIT 5
    `;

    const topCars = topCarsRows.map(r => ({
      name: r.name,
      count: r.count,
      revenue: Number(r.revenue)
    }));

    // Aggregate top salespeople from branch stats
    const topSalespeople = branchStats
      .flatMap(b => b.sales.map(s => ({
        name: `${s.fname} ${s.lname}`,
        count: s.carsSold,
        revenue: s.revenue,
        branch: b.branch.street
      })))
      .sort((x, y) => y.revenue - x.revenue)
      .slice(0, 5);

    // Aggregate top branches
    const topBranches = branchStats
      .map(b => ({
        name: b.branch.street,
        city: b.branch.city,
        count: b.totalCarsSold,
        revenue: b.totalRevenue
      }))
      .sort((x, y) => y.revenue - x.revenue)
      .slice(0, 5);

    return {
      totalBranches: branches.length,
      totalEmployees: Number(empCount?.count ?? 0),
      totalRevenue: branchStats.reduce((s, b) => s + b.totalRevenue, 0),
      totalCarsSold: branchStats.reduce((s, b) => s + b.totalCarsSold, 0),
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
    const branches = (await fetchBranches(sql)).filter((b) => b.city === city);

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

    const rows = await sql<
      { city: string; branch_count: string; revenue: string }[]
    >`
      SELECT
        b.city,
        COUNT(DISTINCT b.branch_id)::text AS branch_count,
        COALESCE(SUM(cph.price), 0)::text AS revenue
      FROM branch b
      LEFT JOIN contract c ON c.branch_id = b.branch_id
        AND c.contract_date >= ${start}
        AND c.contract_date < ${end}
      LEFT JOIN LATERAL (
        SELECT price FROM car_price_history
        WHERE car_id = c.car_id ORDER BY price_date DESC LIMIT 1
      ) cph ON true
      GROUP BY b.city
      ORDER BY b.city
    `;

    return rows.map((r) => {
      const coords = CITY_COORDINATES[r.city] ?? { lat: 30, lng: 31 };
      return {
        city: r.city,
        lat: coords.lat,
        lng: coords.lng,
        branchCount: Number(r.branch_count),
        totalRevenue: Number(r.revenue),
      };
    });
  });
}

export async function getShowroomCities(): Promise<string[]> {
  return withDb(async (sql) => {
    const rows = await sql<{ city: string }[]>`SELECT DISTINCT city FROM branch ORDER BY city`;
    return rows.map((r) => r.city);
  });
}

export async function getLowInventoryAlerts() {
  return withDb(async (sql) => {
    const rows = await sql<
      {
        model: string;
        brand: string;
        street: string;
        city: string;
        no_of_cars: number;
      }[]
    >`
      SELECT 
        c.model,
        comp.name AS brand,
        b.street,
        b.city,
        n.no_of_cars
      FROM no_of_cars n
      JOIN car c ON c.car_id = n.car_id
      JOIN company comp ON comp.company_id = c.company_id
      JOIN branch b ON b.branch_id = n.branch_id
      WHERE n.no_of_cars < 5
      ORDER BY n.no_of_cars ASC
      LIMIT 10
    `;
    return rows.map((r) => ({
      model: r.model,
      brand: r.brand,
      street: r.street,
      city: r.city,
      noOfCars: Number(r.no_of_cars),
    }));
  });
}

export async function getCategoryMetrics() {
  return withDb(async (sql) => {
    // 1. Models category
    const modelsRows = await sql<{ name: string; units_sold: number; revenue: string }[]>`
      SELECT 
        c.model AS name, 
        COUNT(con.contract_id)::int AS units_sold,
        COALESCE(SUM(cph.price), 0)::text AS revenue
      FROM car c
      LEFT JOIN contract con ON con.car_id = c.car_id
      LEFT JOIN LATERAL (
        SELECT price FROM car_price_history
        WHERE car_id = c.car_id
        ORDER BY price_date DESC
        LIMIT 1
      ) cph ON true
      GROUP BY c.model
      ORDER BY units_sold DESC, revenue DESC
    `;

    // 2. Brands category
    const brandsRows = await sql<{ name: string; units_sold: number; revenue: string }[]>`
      SELECT 
        comp.name AS name, 
        COUNT(con.contract_id)::int AS units_sold,
        COALESCE(SUM(cph.price), 0)::text AS revenue
      FROM company comp
      JOIN car c ON c.company_id = comp.company_id
      LEFT JOIN contract con ON con.car_id = c.car_id
      LEFT JOIN LATERAL (
        SELECT price FROM car_price_history
        WHERE car_id = c.car_id
        ORDER BY price_date DESC
        LIMIT 1
      ) cph ON true
      GROUP BY comp.name
      ORDER BY units_sold DESC, revenue DESC
    `;

    // 3. Payments category
    const paymentsRows = await sql<{ name: string; count: number; revenue: string }[]>`
      SELECT 
        pm.method AS name, 
        COUNT(con.contract_id)::int AS count,
        COALESCE(SUM(cph.price), 0)::text AS revenue
      FROM payment_method pm
      LEFT JOIN contract con ON con.method_id = pm.method_id
      LEFT JOIN LATERAL (
        SELECT price FROM car_price_history
        WHERE car_id = con.car_id
        ORDER BY price_date DESC
        LIMIT 1
      ) cph ON true
      GROUP BY pm.method
      ORDER BY count DESC
    `;

    // 4. Genders category
    const gendersRows = await sql<{ name: string; count: number; revenue: string }[]>`
      SELECT 
        cust.gender AS name, 
        COUNT(con.contract_id)::int AS count,
        COALESCE(SUM(cph.price), 0)::text AS revenue
      FROM customer cust
      LEFT JOIN contract con ON con.cust_ssn = cust.ssn
      LEFT JOIN LATERAL (
        SELECT price FROM car_price_history
        WHERE car_id = con.car_id
        ORDER BY price_date DESC
        LIMIT 1
      ) cph ON true
      WHERE cust.gender IS NOT NULL AND cust.gender IN ('M', 'F')
      GROUP BY cust.gender
    `;

    return {
      models: modelsRows.map((r) => ({
        name: r.name,
        unitsSold: Number(r.units_sold),
        revenue: Number(r.revenue),
        avgPrice: Number(r.units_sold) > 0 ? Number(r.revenue) / Number(r.units_sold) : 0,
      })),
      brands: brandsRows.map((r) => ({
        name: r.name,
        unitsSold: Number(r.units_sold),
        revenue: Number(r.revenue),
      })),
      payments: paymentsRows.map((r) => ({
        name: r.name,
        count: Number(r.count),
        revenue: Number(r.revenue),
      })),
      genders: gendersRows.map((r) => ({
        name: r.name === "M" ? "Male Customers" : "Female Customers",
        count: Number(r.count),
        revenue: Number(r.revenue),
        avgSpend: Number(r.count) > 0 ? Number(r.revenue) / Number(r.count) : 0,
      })),
    };
  });
}

export async function getBestRepForCarAction(carModel: string) {
  return withDb(async (sql) => {
    const rows = await sql<{
      ssn: number;
      fname: string;
      lname: string;
      job_title: string;
      city: string;
      cars_sold: number;
      revenue: string;
      luxury_sold: number;
      mid_budget_sold: number;
      top_model: string | null;
    }[]>`
      SELECT 
        e.ssn,
        e.fname,
        e.lname,
        j.title AS job_title,
        e.city,
        COUNT(c.contract_id)::int AS cars_sold,
        COALESCE(SUM(cph.price), 0)::text AS revenue,
        COUNT(CASE WHEN cph.price >= 1500000 THEN 1 END)::int AS luxury_sold,
        COUNT(CASE WHEN cph.price < 1500000 THEN 1 END)::int AS mid_budget_sold,
        MAX(comp.name || ' ' || car.model) AS top_model
      FROM employee e
      JOIN job j ON j.job_id = e.job_id
      JOIN contract c ON c.emp_ssn = e.ssn
      JOIN car ON car.car_id = c.car_id
      JOIN company comp ON comp.company_id = car.company_id
      LEFT JOIN LATERAL (
        SELECT price FROM car_price_history
        WHERE car_id = c.car_id
        ORDER BY price_date DESC
        LIMIT 1
      ) cph ON true
      WHERE (comp.name || ' ' || car.model) = ${carModel}
      GROUP BY e.ssn, e.fname, e.lname, j.title, e.city
      ORDER BY cars_sold DESC, revenue DESC
      LIMIT 5
    `;
    
    return rows.map(r => ({
      ssn: r.ssn,
      fname: r.fname,
      lname: r.lname,
      jobTitle: r.job_title,
      city: r.city,
      carsSold: Number(r.cars_sold),
      revenue: Number(r.revenue),
      luxurySold: Number(r.luxury_sold),
      midBudgetSold: Number(r.mid_budget_sold),
      topModel: r.top_model ?? "—"
    }));
  });
}
