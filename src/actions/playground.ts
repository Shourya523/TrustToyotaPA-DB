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

// ─── Deterministic month name → number map (no Date() parsing) ────────────────
const MONTH_NAME_TO_NUM: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4,
  may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};

export type PlaygroundEmployee = {
  ssn: number;
  name: string;
  jobTitle: string;
  city: string;
  branchId: number;
  branchStreet: string;
  totalCarsSold: number;
  totalRevenue: number;
};

export type PlaygroundCarModel = {
  carId: number;
  model: string;
  brand: string;
  label: string;
  avgPrice: number;
  totalSold: number;
};

export type PlaygroundBranch = {
  branchId: number;
  city: string;
  street: string;
  totalRevenue: number;
  totalCarsSold: number;
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
    // ── Employees ──────────────────────────────────────────────────────────────
    const empRows = await sql<
      {
        ssn: number;
        fname: string;
        lname: string;
        job_title: string;
        city: string;
        branch_id: number;
        branch_street: string;
        total_cars: string;
        total_revenue: string;
      }[]
    >`
      SELECT
        e.ssn,
        e.fname,
        e.lname,
        j.title AS job_title,
        e.city,
        e.branch_id,
        b.street AS branch_street,
        COUNT(c.contract_id)::text AS total_cars,
        COALESCE(SUM(cph.price), 0)::text AS total_revenue
      FROM employee e
      JOIN job j ON j.job_id = e.job_id
      JOIN branch b ON b.branch_id = e.branch_id
      LEFT JOIN contract c ON c.emp_ssn = e.ssn
      LEFT JOIN LATERAL (
        SELECT price FROM car_price_history
        WHERE car_id = c.car_id
        ORDER BY price_date DESC
        LIMIT 1
      ) cph ON true
      WHERE (
        j.title ILIKE '%sales%'
        OR j.title ILIKE '%consultant%'
        OR j.title ILIKE '%representative%'
        OR j.title ILIKE '%advisor%'
      )
      GROUP BY e.ssn, e.fname, e.lname, j.title, e.city, e.branch_id, b.street
      ORDER BY SUM(COALESCE(cph.price, 0)) DESC
      LIMIT 40
    `;

    const employees: PlaygroundEmployee[] = empRows.map((r) => ({
      ssn: r.ssn,
      name: `${r.fname} ${r.lname}`,
      jobTitle: r.job_title,
      city: r.city,
      branchId: r.branch_id,
      branchStreet: r.branch_street,
      totalCarsSold: Number(r.total_cars),
      totalRevenue: Number(r.total_revenue),
    }));

    // ── Car models ─────────────────────────────────────────────────────────────
    const carRows = await sql<
      {
        car_id: number;
        model: string;
        brand: string;
        latest_price: string;
        total_sold: string;
      }[]
    >`
      SELECT
        car.car_id,
        car.model,
        comp.name AS brand,
        COALESCE(cph_latest.price, 0)::text AS latest_price,
        COUNT(con.contract_id)::text AS total_sold
      FROM car
      JOIN company comp ON comp.company_id = car.company_id
      LEFT JOIN contract con ON con.car_id = car.car_id
      LEFT JOIN LATERAL (
        SELECT price FROM car_price_history
        WHERE car_id = car.car_id
        ORDER BY price_date DESC
        LIMIT 1
      ) cph_latest ON true
      GROUP BY car.car_id, car.model, comp.name, cph_latest.price
      ORDER BY COUNT(con.contract_id) DESC
      LIMIT 30
    `;

    const carModels: PlaygroundCarModel[] = carRows.map((r) => ({
      carId: r.car_id,
      model: r.model,
      brand: r.brand,
      label: `${r.brand} ${r.model}`,
      avgPrice: Number(r.latest_price),
      totalSold: Number(r.total_sold),
    }));

    // ── Branches ───────────────────────────────────────────────────────────────
    const branchRows = await sql<
      {
        branch_id: number;
        city: string;
        street: string;
        total_revenue: string;
        total_cars: string;
      }[]
    >`
      SELECT
        b.branch_id,
        b.city,
        b.street,
        COALESCE(SUM(cph.price), 0)::text AS total_revenue,
        COUNT(c.contract_id)::text AS total_cars
      FROM branch b
      LEFT JOIN contract c ON c.branch_id = b.branch_id
      LEFT JOIN LATERAL (
        SELECT price FROM car_price_history
        WHERE car_id = c.car_id
        ORDER BY price_date DESC
        LIMIT 1
      ) cph ON true
      GROUP BY b.branch_id, b.city, b.street
      ORDER BY SUM(COALESCE(cph.price, 0)) DESC
    `;

    const branches: PlaygroundBranch[] = branchRows.map((r) => ({
      branchId: r.branch_id,
      city: r.city,
      street: r.street,
      totalRevenue: Number(r.total_revenue),
      totalCarsSold: Number(r.total_cars),
    }));

    // ── Years ──────────────────────────────────────────────────────────────────
    const yearRows = await sql<
      { year: number; total_revenue: string; total_cars: string }[]
    >`
      SELECT
        EXTRACT(YEAR FROM c.contract_date)::int AS year,
        COALESCE(SUM(cph.price), 0)::text AS total_revenue,
        COUNT(c.contract_id)::text AS total_cars
      FROM contract c
      LEFT JOIN LATERAL (
        SELECT price FROM car_price_history
        WHERE car_id = c.car_id
        ORDER BY price_date DESC
        LIMIT 1
      ) cph ON true
      WHERE c.contract_date IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM c.contract_date)
      ORDER BY year DESC
    `;

    const years: PlaygroundYear[] = yearRows.map((r) => ({
      year: r.year,
      totalRevenue: Number(r.total_revenue),
      totalCarsSold: Number(r.total_cars),
    }));

    // Fixed, deterministic months list (name + pre-computed num)
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
  monthNum: number | null;    // 1-12, already resolved
  year: number | null;
  branchId: number | null;
};

export type ConnectionInsight = {
  filters: ActiveFilters;
  carsSold: number;
  revenue: number;
  avgDealSize: number;
  peakMonth: string;          // month with highest unit count
  peakMonthCount: number;
  monthlyBreakdown: { month: string; monthNum: number; count: number; revenue: number }[];
  validQuery: boolean;        // false when no filters at all (avoids showing DB total as "insight")
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
  };

  // Require at least one meaningful filter to avoid returning the entire DB
  if (empSsn === null && carLabel === null && year === null && branchId === null && monthNum === null) {
    return emptyInsight;
  }

  return withDb(async (sql) => {
    // ── Build WHERE conditions as proper tagged-template fragments ─────────────
    // Using the postgres library's proper fragment composition.
    // Each condition is a sql fragment; we combine them below.

    type SqlFragment = ReturnType<typeof sql>;

    const conds: SqlFragment[] = [sql`1=1`];

    if (empSsn !== null) {
      conds.push(sql`c.emp_ssn = ${empSsn}`);
    }
    if (carLabel !== null) {
      // Match the label format used in palette: `${brand} ${model}`
      conds.push(sql`(comp.name || ' ' || car.model) = ${carLabel}`);
    }
    if (monthNum !== null) {
      conds.push(sql`EXTRACT(MONTH FROM c.contract_date)::int = ${monthNum}`);
    }
    if (year !== null) {
      conds.push(sql`EXTRACT(YEAR FROM c.contract_date)::int = ${year}`);
    }
    if (branchId !== null) {
      conds.push(sql`c.branch_id = ${branchId}`);
    }

    // Reduce to a single WHERE fragment: cond1 AND cond2 AND ...
    const whereFragment = conds.reduce((acc, cur) => sql`${acc} AND ${cur}`);

    // ── Main aggregation query ─────────────────────────────────────────────────
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
          c.contract_id,
          EXTRACT(MONTH FROM c.contract_date)::int AS month_num,
          TO_CHAR(c.contract_date, 'Month') AS month_name,
          COALESCE(cph.price, 0) AS price
        FROM contract c
        JOIN car ON car.car_id = c.car_id
        JOIN company comp ON comp.company_id = car.company_id
        LEFT JOIN LATERAL (
          SELECT price FROM car_price_history
          WHERE car_id = c.car_id
          ORDER BY price_date DESC
          LIMIT 1
        ) cph ON true
        WHERE ${whereFragment}
          AND c.contract_date IS NOT NULL
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
        COUNT(b.contract_id)::text AS cars_sold,
        COALESCE(SUM(b.price), 0)::text AS revenue,
        mc.month_num AS peak_month_num,
        TRIM(mc.month_name) AS peak_month_name,
        mc.cnt::text AS peak_month_count
      FROM base b
      LEFT JOIN monthly_counts mc ON true
      GROUP BY mc.month_num, mc.month_name, mc.cnt
    `;

    // ── Monthly breakdown (always group by month, ignoring the month filter) ───
    // If a month filter is set, we still show the breakdown across that month only
    // (results will be one bar). If no month filter, show all months in scope.
    const breakdownConds: SqlFragment[] = [sql`1=1`];
    if (empSsn !== null) breakdownConds.push(sql`c.emp_ssn = ${empSsn}`);
    if (carLabel !== null) breakdownConds.push(sql`(comp.name || ' ' || car.model) = ${carLabel}`);
    if (year !== null) breakdownConds.push(sql`EXTRACT(YEAR FROM c.contract_date)::int = ${year}`);
    if (branchId !== null) breakdownConds.push(sql`c.branch_id = ${branchId}`);
    // month filter intentionally excluded from breakdown so the chart always shows context
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
        TO_CHAR(DATE_TRUNC('month', c.contract_date), 'YYYY-MM') AS sort_key,
        TO_CHAR(DATE_TRUNC('month', c.contract_date), 'Mon YYYY') AS month_label,
        EXTRACT(MONTH FROM DATE_TRUNC('month', c.contract_date))::int AS month_num,
        COUNT(c.contract_id)::text AS count,
        COALESCE(SUM(cph.price), 0)::text AS revenue
      FROM contract c
      JOIN car ON car.car_id = c.car_id
      JOIN company comp ON comp.company_id = car.company_id
      LEFT JOIN LATERAL (
        SELECT price FROM car_price_history
        WHERE car_id = c.car_id
        ORDER BY price_date DESC
        LIMIT 1
      ) cph ON true
      WHERE ${breakdownWhere}
        AND c.contract_date IS NOT NULL
      GROUP BY DATE_TRUNC('month', c.contract_date)
      ORDER BY DATE_TRUNC('month', c.contract_date)
    `;

    const row = summaryRows[0];
    const carsSold = Number(row?.cars_sold ?? 0);
    const revenue = Number(row?.revenue ?? 0);

    return {
      filters,
      carsSold,
      revenue,
      avgDealSize: carsSold > 0 ? revenue / carsSold : 0,
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
    };
  });
}
