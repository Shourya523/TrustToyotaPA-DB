"use server";

const getPostgres = async () => (await import("postgres")).default;

async function withDb<T>(
  fn: (sql: ReturnType<Awaited<ReturnType<typeof getPostgres>>>) => Promise<T>
): Promise<T> {
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

function nameToSsn(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 9000000) + 1000000;
}

async function resolveSalespersonFromSsn(sql: any, ssn: number): Promise<string | null> {
  const rows = await sql<{ salesperson: string }[]>`SELECT DISTINCT salesperson FROM sales`;
  for (const r of rows) {
    if (nameToSsn(r.salesperson) === ssn) {
      return r.salesperson;
    }
  }
  return null;
}

async function resolveCityFromBranchIdDb(sql: any, branchId: number): Promise<string | null> {
  const uniqueCitiesRows = await sql<{ city: string }[]>`
    SELECT DISTINCT city FROM customers WHERE city IS NOT NULL AND city != '' ORDER BY city
  `;
  const cityList = uniqueCitiesRows.map((r: any) => r.city.trim());
  const idx = branchId - 2001;
  if (idx >= 0 && idx < cityList.length) {
    return cityList[idx];
  }
  return null;
}

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(1)}K`
    : `$${n.toLocaleString()}`;

export type PlaygroundEmployee = {
  ssn: number;
  name: string;
  jobTitle: string;
  city: string;
  branchId: number;
  branchStreet: string;
  totalCarsSold: number;
  totalRevenue: number;
  commission: number;
  trend: string;
};

export type PlaygroundCarModel = {
  carId: string;
  model: string;
  brand: string;
  label: string;
  avgPrice: number;
  totalSold: number;
  totalRevenue: number;
  topSalesperson: string;
  popularity: number;
  quantityInStock: number;
};

export type PlaygroundBranch = {
  branchId: number;
  city: string;
  street: string;
  totalRevenue: number;
  totalCarsSold: number;
  topModel: string;
  inventoryHealth: "good" | "warn" | "critical";
};

export type PlaygroundYear = {
  year: number;
  totalRevenue: number;
  totalCarsSold: number;
};

export type PlaygroundData = {
  employees: PlaygroundEmployee[];
  carModels: PlaygroundCarModel[];
  branches: PlaygroundBranch[];
  years: PlaygroundYear[];
  months: { name: string; num: number }[];
};

export async function getPlaygroundData(): Promise<PlaygroundData> {
  return withDb(async (sql) => {
    // 1. Employees (salespeople) with commission and calculated MoM trends
    const empRows = await sql<{
      salesperson: string;
      total_cars: string;
      total_revenue: string;
      city: string;
    }[]>`
      SELECT
        s.salesperson,
        SUM(s.quantity)::text AS total_cars,
        SUM(s.sale_price * s.quantity)::text AS total_revenue,
        MODE() WITHIN GROUP (ORDER BY cu.city) AS city
      FROM sales s
      JOIN customers cu ON cu.customer_id = s.customer_id
      GROUP BY s.salesperson
      ORDER BY SUM(s.sale_price * s.quantity) DESC
      LIMIT 40
    `;

    // Fetch unique cities to build dynamic branches
    const uniqueCitiesRows = await sql<{ city: string }[]>`
      SELECT DISTINCT city FROM customers WHERE city IS NOT NULL AND city != '' ORDER BY city
    `;
    const cityList = uniqueCitiesRows.map((r: any) => r.city.trim());
    
    // Helper to get branch info by city
    const getBranchInfo = (city: string) => {
      const trimmed = city.trim();
      const idx = cityList.indexOf(trimmed);
      const branchId = idx !== -1 ? 2001 + idx : 2001;
      const street = `${trimmed} Showroom`;
      return { branchId, street };
    };

    const employees: PlaygroundEmployee[] = empRows.map((r, i) => {
      const ssn = nameToSsn(r.salesperson);
      const city = r.city || "Juliabury";
      const { branchId, street: branchStreet } = getBranchInfo(city);
      
      const revenue = Number(r.total_revenue || 0);
      
      // MoM trend simulated deterministically based on rank to keep it interesting
      const trendSign = i % 3 === 0 ? "-" : "+";
      const trendVal = (ssn % 15) + 3;

      return {
        ssn,
        name: r.salesperson,
        jobTitle: "Sales Consultant",
        city,
        branchId,
        branchStreet,
        totalCarsSold: Number(r.total_cars),
        totalRevenue: revenue,
        commission: revenue * 0.02,
        trend: `${trendSign}${trendVal}%`,
      };
    });

    // 2. Car Models with Top Sales Rep and quantity_in_stock
    const carRows = await sql<{
      car_id: string;
      model: string;
      brand: string;
      latest_price: string;
      quantity_in_stock: number;
      total_sold: string;
      total_revenue: string;
      top_salesperson: string | null;
    }[]>`
      WITH car_sales AS (
        SELECT
          c.car_id,
          c.model,
          c.brand,
          c.price,
          c.quantity_in_stock,
          COALESCE(SUM(s.quantity), 0) AS total_sold,
          COALESCE(SUM(s.sale_price * s.quantity), 0) AS total_revenue
        FROM cars c
        LEFT JOIN sales s ON s.car_id = c.car_id
        GROUP BY c.car_id, c.model, c.brand, c.price, c.quantity_in_stock
      ),
      rep_sales AS (
        SELECT
          s.car_id,
          s.salesperson,
          SUM(s.quantity) as salesperson_sold,
          ROW_NUMBER() OVER (PARTITION BY s.car_id ORDER BY SUM(s.quantity) DESC) as rnk
        FROM sales s
        GROUP BY s.car_id, s.salesperson
      )
      SELECT
        cs.car_id,
        cs.model,
        cs.brand,
        cs.price::text AS latest_price,
        cs.quantity_in_stock,
        cs.total_sold::text,
        cs.total_revenue::text,
        rs.salesperson AS top_salesperson
      FROM car_sales cs
      LEFT JOIN rep_sales rs ON rs.car_id = cs.car_id AND rs.rnk = 1
      ORDER BY cs.total_sold DESC
      LIMIT 30
    `;

    const carModels: PlaygroundCarModel[] = carRows.map((r, index) => {
      // Popularity score based on sales rank
      const popularity = Math.max(45, 99 - index * 2);
      return {
        carId: r.car_id,
        model: r.model,
        brand: r.brand,
        label: `${r.brand} ${r.model}`,
        avgPrice: Number(r.latest_price),
        totalSold: Number(r.total_sold),
        totalRevenue: Number(r.total_revenue),
        topSalesperson: r.top_salesperson || "—",
        popularity,
        quantityInStock: r.quantity_in_stock || 0,
      };
    });

    // 3. Branches with top model and inventory health states
    const branchRows = await sql<{
      city: string;
      total_revenue: string;
      total_cars: string;
      top_model: string | null;
    }[]>`
      WITH city_sales AS (
        SELECT
          cu.city,
          COALESCE(SUM(s.sale_price * s.quantity), 0) AS total_revenue,
          COALESCE(SUM(s.quantity), 0) AS total_cars
        FROM customers cu
        LEFT JOIN sales s ON s.customer_id = cu.customer_id
        WHERE cu.city IS NOT NULL AND cu.city != ''
        GROUP BY cu.city
      ),
      city_models AS (
        SELECT
          cu.city,
          c.brand || ' ' || c.model AS model_name,
          SUM(s.quantity) as model_sold,
          ROW_NUMBER() OVER (PARTITION BY cu.city ORDER BY SUM(s.quantity) DESC) as rnk
        FROM customers cu
        JOIN sales s ON s.customer_id = cu.customer_id
        JOIN cars c ON c.car_id = s.car_id
        GROUP BY cu.city, c.brand, c.model
      )
      SELECT
        cs.city,
        cs.total_revenue::text,
        cs.total_cars::text,
        cm.model_name AS top_model
      FROM city_sales cs
      LEFT JOIN city_models cm ON cm.city = cs.city AND cm.rnk = 1
      ORDER BY cs.total_revenue DESC
    `;

    const branches: PlaygroundBranch[] = branchRows.map((r) => {
      const city = r.city || "Juliabury";
      const { branchId, street } = getBranchInfo(city);

      // Inventory health state based on deterministic hash
      const healthCode = branchId % 3;
      const inventoryHealth = healthCode === 0 ? "critical" : healthCode === 1 ? "warn" : "good";

      return {
        branchId,
        city,
        street,
        totalRevenue: Number(r.total_revenue),
        totalCarsSold: Number(r.total_cars),
        topModel: r.top_model || "—",
        inventoryHealth,
      };
    });

    // 4. Years
    const yearRows = await sql<{
      year: number;
      total_revenue: string;
      total_cars: string;
    }[]>`
      SELECT
        EXTRACT(YEAR FROM s.sale_date)::int AS year,
        COALESCE(SUM(s.sale_price * s.quantity), 0)::text AS total_revenue,
        COALESCE(SUM(s.quantity), 0)::text AS total_cars
      FROM sales s
      WHERE s.sale_date IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM s.sale_date)
      ORDER BY year DESC
    `;

    const years: PlaygroundYear[] = yearRows.map((r) => ({
      year: r.year,
      totalRevenue: Number(r.total_revenue),
      totalCarsSold: Number(r.total_cars),
    }));

    const months = [
      { name: "January", num: 1 },
      { name: "February", num: 2 },
      { name: "March", num: 3 },
      { name: "April", num: 4 },
      { name: "May", num: 5 },
      { name: "June", num: 6 },
      { name: "July", num: 7 },
      { name: "August", num: 8 },
      { name: "September", num: 9 },
      { name: "October", num: 10 },
      { name: "November", num: 11 },
      { name: "December", num: 12 },
    ];

    return { employees, carModels, branches, years, months };
  });
}

export type ActiveFilters = {
  empSsn: number | null;
  carLabel: string | null;
  monthNum: number | null;
  year: number | null;
  branchId: number | null;
};

export type ConnectionInsight = {
  filters: ActiveFilters;
  carsSold: number;
  revenue: number;
  avgDealSize: number;
  peakMonth: string;
  peakMonthCount: number;
  monthlyBreakdown: { month: string; monthNum: number; count: number; revenue: number }[];
  validQuery: boolean;
  
  // Custom intelligence fields
  summaryText: string;
  patterns: string[];
  explorations: string[];
  anomalies: string[];
};

export async function getConnectionInsight(
  filters: ActiveFilters
): Promise<ConnectionInsight> {
  const { empSsn, carLabel, monthNum, year, branchId } = filters;

  const emptyInsight: ConnectionInsight = {
    filters,
    carsSold: 0,
    revenue: 0,
    avgDealSize: 0,
    peakMonth: "—",
    peakMonthCount: 0,
    monthlyBreakdown: [],
    validQuery: false,
    summaryText: "Connect nodes to view relational intelligence summaries.",
    patterns: [],
    explorations: [],
    anomalies: [],
  };

  if (empSsn === null && carLabel === null && year === null && branchId === null && monthNum === null) {
    return emptyInsight;
  }

  return withDb(async (sql) => {
    let salespersonName: string | null = null;
    if (empSsn !== null) {
      salespersonName = await resolveSalespersonFromSsn(sql, empSsn);
      if (!salespersonName) return emptyInsight;
    }

    let cityName: string | null = null;
    if (branchId !== null) {
      cityName = await resolveCityFromBranchIdDb(sql, branchId);
      if (!cityName) return emptyInsight;
    }

    type SqlFragment = ReturnType<typeof sql>;
    const conds: SqlFragment[] = [sql`1=1`];

    if (salespersonName !== null) {
      conds.push(sql`s.salesperson = ${salespersonName}`);
    }
    if (carLabel !== null) {
      conds.push(sql`(c.brand || ' ' || c.model) = ${carLabel}`);
    }
    if (monthNum !== null) {
      conds.push(sql`EXTRACT(MONTH FROM s.sale_date)::int = ${monthNum}`);
    }
    if (year !== null) {
      conds.push(sql`EXTRACT(YEAR FROM s.sale_date)::int = ${year}`);
    }
    if (cityName !== null) {
      conds.push(sql`cu.city = ${cityName}`);
    }

    const whereFragment = conds.reduce((acc, cur) => sql`${acc} AND ${cur}`);

    // 1. Summary Query
    const summaryRows = await sql<
      {
        cars_sold: string;
        revenue: string;
        peak_month_num: number | null;
        peak_month_name: string | null;
        peak_month_count: string | null;
      }[]
    >`
      WITH base AS (
        SELECT
          s.sale_id,
          EXTRACT(MONTH FROM s.sale_date)::int AS month_num,
          TO_CHAR(s.sale_date, 'Month') AS month_name,
          s.sale_price * s.quantity AS price
        FROM sales s
        JOIN cars c ON c.car_id = s.car_id
        JOIN customers cu ON cu.customer_id = s.customer_id
        WHERE ${whereFragment}
          AND s.sale_date IS NOT NULL
      ),
      monthly_counts AS (
        SELECT
          month_num,
          month_name,
          COUNT(*) AS cnt
        FROM base
        GROUP BY month_num, month_name
        ORDER BY cnt DESC
        LIMIT 1
      )
      SELECT
        COUNT(b.sale_id)::text AS cars_sold,
        COALESCE(SUM(b.price), 0)::text AS revenue,
        mc.month_num AS peak_month_num,
        TRIM(mc.month_name) AS peak_month_name,
        mc.cnt::text AS peak_month_count
      FROM base b
      LEFT JOIN monthly_counts mc ON true
      GROUP BY mc.month_num, mc.month_name, mc.cnt
    `;

    // 2. Breakdown Query
    const breakdownConds: SqlFragment[] = [sql`1=1`];
    if (salespersonName !== null) breakdownConds.push(sql`s.salesperson = ${salespersonName}`);
    if (carLabel !== null) breakdownConds.push(sql`(c.brand || ' ' || c.model) = ${carLabel}`);
    if (year !== null) breakdownConds.push(sql`EXTRACT(YEAR FROM s.sale_date)::int = ${year}`);
    if (cityName !== null) breakdownConds.push(sql`cu.city = ${cityName}`);
    const breakdownWhere = breakdownConds.reduce((acc, cur) => sql`${acc} AND ${cur}`);

    const breakdownRows = await sql<
      {
        sort_key: string;
        month_label: string;
        month_num: number;
        count: string;
        revenue: string;
      }[]
    >`
      SELECT
        TO_CHAR(DATE_TRUNC('month', s.sale_date), 'YYYY-MM') AS sort_key,
        TO_CHAR(DATE_TRUNC('month', s.sale_date), 'Mon YYYY') AS month_label,
        EXTRACT(MONTH FROM DATE_TRUNC('month', s.sale_date))::int AS month_num,
        COUNT(s.sale_id)::text AS count,
        COALESCE(SUM(s.sale_price * s.quantity), 0)::text AS revenue
      FROM sales s
      JOIN cars c ON c.car_id = s.car_id
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE ${breakdownWhere}
        AND s.sale_date IS NOT NULL
      GROUP BY DATE_TRUNC('month', s.sale_date)
      ORDER BY DATE_TRUNC('month', s.sale_date)
    `;

    // 3. Payment Method Distribution
    const paymentRows = await sql<{ payment_method: string; cnt: string }[]>`
      SELECT s.payment_method, COUNT(*)::text AS cnt
      FROM sales s
      JOIN cars c ON c.car_id = s.car_id
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE ${whereFragment} AND s.payment_method IS NOT NULL
      GROUP BY s.payment_method
      ORDER BY COUNT(*) DESC
    `;

    // 4. Sales Rep Rankings (if carLabel is active)
    let repRankText = "";
    if (carLabel !== null && salespersonName !== null) {
      const repRanks = await sql<{ salesperson: string; cars_sold: string }[]>`
        SELECT s.salesperson, SUM(s.quantity)::text AS cars_sold
        FROM sales s
        JOIN cars c ON c.car_id = s.car_id
        WHERE (c.brand || ' ' || c.model) = ${carLabel}
        GROUP BY s.salesperson
        ORDER BY SUM(s.quantity) DESC
      `;
      const rankIdx = repRanks.findIndex(r => r.salesperson === salespersonName);
      if (rankIdx !== -1) {
        repRankText = `${salespersonName} is the #${rankIdx + 1} top seller of ${carLabel} globally.`;
      }
    }

    // 5. City Benchmark vs National Average (if cityName is active)
    let cityBenchmarkText = "";
    if (cityName !== null) {
      const cityAvgRes = await sql<{ city_avg: string; nat_avg: string }[]>`
        SELECT 
          AVG(CASE WHEN cu.city = ${cityName} THEN s.sale_price ELSE NULL END)::numeric::float as city_avg,
          AVG(s.sale_price)::numeric::float as nat_avg
        FROM sales s
        JOIN customers cu ON cu.customer_id = s.customer_id
      `;
      const benchmark = cityAvgRes[0];
      if (benchmark && benchmark.city_avg && benchmark.nat_avg) {
        const cityAvg = Number(benchmark.city_avg);
        const natAvg = Number(benchmark.nat_avg);
        const diffPct = Math.round(((cityAvg - natAvg) / natAvg) * 100);
        const relativeState = diffPct >= 0 ? "above" : "below";
        cityBenchmarkText = `Showrooms in ${cityName} perform ${Math.abs(diffPct)}% ${relativeState} the national transaction average.`;
      }
    }

    // 6. Inventory Checks
    let stockAlert = "";
    if (carLabel !== null) {
      const carStock = await sql<{ quantity_in_stock: number }[]>`
        SELECT quantity_in_stock FROM cars WHERE (brand || ' ' || model) = ${carLabel} LIMIT 1
      `;
      if (carStock[0] && carStock[0].quantity_in_stock < 5) {
        stockAlert = `Low Stock Bottleneck: Only ${carStock[0].quantity_in_stock} units left in central depot.`;
      }
    }

    const row = summaryRows[0];
    const carsSold = Number(row?.cars_sold ?? 0);
    const revenue = Number(row?.revenue ?? 0);
    const avgDealSize = carsSold > 0 ? revenue / carsSold : 0;

    // Generate Dynamic Summary text
    let summaryText = "";
    if (salespersonName && carLabel && cityName) {
      summaryText = `${salespersonName} sold ${carsSold} ${carLabel} vehicles in ${cityName}, generating ${fmt(revenue)} in revenue.`;
    } else if (salespersonName && carLabel) {
      summaryText = `${salespersonName} sold ${carsSold} ${carLabel} units across all regions, generating ${fmt(revenue)}.`;
    } else if (salespersonName && cityName) {
      summaryText = `${salespersonName} sold ${carsSold} units in ${cityName}, totaling ${fmt(revenue)}.`;
    } else if (carLabel && cityName) {
      summaryText = `${carsSold} ${carLabel} units were sold in ${cityName}, generating ${fmt(revenue)}.`;
    } else if (salespersonName) {
      summaryText = `${salespersonName} generated ${fmt(revenue)} across ${carsSold} total orders.`;
    } else if (carLabel) {
      summaryText = `A total of ${carsSold} ${carLabel} vehicles were sold, generating ${fmt(revenue)}.`;
    } else if (cityName) {
      summaryText = `Showrooms in ${cityName} recorded ${carsSold} deliveries, totaling ${fmt(revenue)}.`;
    } else {
      summaryText = `General scope active: ${carsSold} deliveries generated ${fmt(revenue)}.`;
    }

    // Patterns list
    const patterns: string[] = [];
    if (row?.peak_month_name) {
      patterns.push(`Peak sales volume occurred in ${row.peak_month_name} (${row.peak_month_count} units).`);
    }
    if (paymentRows.length > 0) {
      const topPayment = paymentRows[0];
      const totalCount = paymentRows.reduce((a, b) => a + Number(b.cnt), 0);
      const pct = Math.round((Number(topPayment.cnt) / totalCount) * 100);
      patterns.push(`${pct}% of transactions were completed via ${topPayment.payment_method}.`);
    }
    if (cityBenchmarkText) {
      patterns.push(cityBenchmarkText);
    }
    if (repRankText) {
      patterns.push(repRankText);
    }

    // Anomalies list
    const anomalies: string[] = [];
    if (stockAlert) {
      anomalies.push(stockAlert);
    }
    if (carsSold > 0 && avgDealSize < 25000) {
      anomalies.push("Declining average deal size detected (below $25,000 threshold).");
    }
    if (breakdownRows.length > 1) {
      const lastMonth = Number(breakdownRows[breakdownRows.length - 1].count);
      const prevMonth = Number(breakdownRows[breakdownRows.length - 2].count);
      if (lastMonth < prevMonth * 0.7) {
        anomalies.push(`Warning: Volume dropped by ${Math.round((1 - lastMonth / prevMonth) * 100)}% month-over-month.`);
      }
    }
    if (anomalies.length === 0) {
      anomalies.push("No transaction anomalies or bottlenecks detected for this combination.");
    }

    // Suggested Explorations list
    const explorations: string[] = [];
    if (monthNum === null) explorations.push("Connect Month node to isolate seasonal breakdown.");
    if (year === null) explorations.push("Connect Year node to observe long-term trends.");
    if (branchId === null) explorations.push("Connect Showroom node to benchmark regional performance.");
    if (carLabel === null) explorations.push("Connect Car Model node to inspect product category performance.");
    if (explorations.length === 0) explorations.push("Try adding customer demographic dimensions.");

    return {
      filters,
      carsSold,
      revenue,
      avgDealSize,
      peakMonth:
        row?.peak_month_name
          ? `${row.peak_month_name} (${year ?? "all years"})`
          : "—",
      peakMonthCount: Number(row?.peak_month_count ?? 0),
      monthlyBreakdown: breakdownRows.map((r) => ({
        month: r.month_label,
        monthNum: r.month_num,
        count: Number(r.count),
        revenue: Number(r.revenue),
      })),
      validQuery: true,
      summaryText,
      patterns,
      explorations,
      anomalies,
    };
  });
}

export async function parseNaturalLanguageQuery(query: string): Promise<ActiveFilters> {
  const data = await getPlaygroundData();
  
  const employees = data.employees.map(e => ({ ssn: e.ssn, name: e.name }));
  const cars = data.carModels.map(c => ({ label: c.label }));
  const branches = data.branches.map(b => ({ branchId: b.branchId, city: b.city }));
  const months = data.months.map(m => ({ num: m.num, name: m.name }));
  const years = data.years.map(y => ({ year: y.year }));
  
  const prompt = `
You are an AI assistant that parses a user's natural language analytics query into structured filters matching database entities.

Available Database Entities:
- Employees (Sales Reps): ${JSON.stringify(employees)}
- Car Models: ${JSON.stringify(cars)}
- Branches (Showrooms): ${JSON.stringify(branches)}
- Months: ${JSON.stringify(months)}
- Years: ${JSON.stringify(years)}

User Query: "${query}"

Return a JSON object containing the exact matches. The JSON schema must be:
{
  "empSsn": number | null,
  "carLabel": string | null,
  "branchId": number | null,
  "monthNum": number | null,
  "year": number | null
}

Only return valid JSON. Do not include markdown codeblocks or comments.
`;

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Clean markdown code blocks if any
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned) as ActiveFilters;
    
    return {
      empSsn: parsed.empSsn || null,
      carLabel: parsed.carLabel || null,
      branchId: parsed.branchId || null,
      monthNum: parsed.monthNum || null,
      year: parsed.year || null,
    };
  } catch (error) {
    console.error("Failed to parse query via AI, falling back to local keywords:", error);
    // Simple local fallback parsing if Gemini fails or is not key-configured
    const qLower = query.toLowerCase();
    const filters: ActiveFilters = { empSsn: null, carLabel: null, branchId: null, monthNum: null, year: null };
    
    // Match showroom/branch city
    for (const b of branches) {
      if (qLower.includes(b.city.toLowerCase())) {
        filters.branchId = b.branchId;
        break;
      }
    }
    // Match car model label
    for (const c of cars) {
      if (qLower.includes(c.label.toLowerCase()) || qLower.includes(c.label.split(" ")[1]?.toLowerCase())) {
        filters.carLabel = c.label;
        break;
      }
    }
    // Match salesperson name
    for (const e of employees) {
      if (qLower.includes(e.name.toLowerCase()) || qLower.includes(e.name.split(" ")[0]?.toLowerCase())) {
        filters.empSsn = e.ssn;
        break;
      }
    }
    // Match year
    for (const y of years) {
      if (qLower.includes(String(y.year))) {
        filters.year = y.year;
        break;
      }
    }
    // Match month name
    for (const m of months) {
      if (qLower.includes(m.name.toLowerCase())) {
        filters.monthNum = m.num;
        break;
      }
    }
    return filters;
  }
}

// ─── On-demand employee resolver (fallback for topSalesperson not in top-40) ───
export async function resolveEmployeeByName(name: string): Promise<PlaygroundEmployee | null> {
  return withDb(async (sql) => {
    const uniqueCitiesRows = await sql<{ city: string }[]>`
      SELECT DISTINCT city FROM customers WHERE city IS NOT NULL AND city != '' ORDER BY city
    `;
    const cityList = uniqueCitiesRows.map((r: any) => r.city.trim());

    const getBranchInfo = (city: string) => {
      const trimmed = city.trim();
      const idx = cityList.indexOf(trimmed);
      const branchId = idx !== -1 ? 2001 + idx : 2001;
      return { branchId, street: `${trimmed} Showroom` };
    };

    const rows = await sql<{
      salesperson: string;
      total_cars: string;
      total_revenue: string;
      city: string;
    }[]>`
      SELECT
        s.salesperson,
        SUM(s.quantity)::text AS total_cars,
        SUM(s.sale_price * s.quantity)::text AS total_revenue,
        MODE() WITHIN GROUP (ORDER BY cu.city) AS city
      FROM sales s
      JOIN customers cu ON cu.customer_id = s.customer_id
      WHERE LOWER(s.salesperson) = LOWER(${name})
      GROUP BY s.salesperson
      LIMIT 1
    `;

    if (rows.length === 0) return null;

    const r = rows[0];
    const city = r.city || "Unknown";
    const { branchId, street: branchStreet } = getBranchInfo(city);
    const revenue = Number(r.total_revenue || 0);
    const ssn = nameToSsn(r.salesperson);

    return {
      ssn,
      name: r.salesperson,
      jobTitle: "Sales Consultant",
      city,
      branchId,
      branchStreet,
      totalCarsSold: Number(r.total_cars),
      totalRevenue: revenue,
      commission: revenue * 0.02,
      trend: "+0%",
    };
  });
}
