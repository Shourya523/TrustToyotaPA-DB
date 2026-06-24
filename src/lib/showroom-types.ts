export type Branch = {
  branchId: number;
  street: string;
  city: string;
  dbCity?: string;
  buildingNumber: number;
  contactNumber: string;
};

export type EmployeeSale = {
  ssn: number;
  fname: string;
  lname: string;
  jobTitle: string;
  salary: number;
  commPct: number;
  gender: string;
  phone1: string;
  birthDate: string;
  city: string;
  carsSold: number;
  revenue: number;
  commission: number;
  topModel: string;
  paymentMethod: string;
  midBudgetSold: number;
  luxurySold: number;
};

export type BranchStats = {
  branch: Branch;
  totalRevenue: number;
  totalCommission: number;
  totalCarsSold: number;
  totalPayroll: number;
  employeeCount: number;
  paymentBreakdown: { method: string; count: number }[];
  monthlyTrend: { month: string; revenue: number }[];
  sales: EmployeeSale[];
};

export type NationalStats = {
  totalBranches: number;
  totalEmployees: number;
  totalRevenue: number;
  totalCarsSold: number;
  branchStats: BranchStats[];
  reportMonth: string;
  topCars: { name: string; count: number; revenue: number }[];
  topSalespeople: { name: string; count: number; revenue: number; branch: string }[];
  topBranches: { name: string; city: string; count: number; revenue: number }[];
};

export type CityMapPoint = {
  city: string;
  lat: number;
  lng: number;
  branchCount: number;
  totalRevenue: number;
};

export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "New York": { lat: 40.7128, lng: -74.0060 },
  "Los Angeles": { lat: 34.0522, lng: -118.2437 },
  "Chicago": { lat: 41.8781, lng: -87.6298 },
  "Houston": { lat: 29.7604, lng: -95.3698 },
  "Phoenix": { lat: 33.4484, lng: -112.0740 },
  "Philadelphia": { lat: 39.9526, lng: -75.1652 },
  "Dallas": { lat: 32.7767, lng: -96.7970 },
  "Jacksonville": { lat: 30.3322, lng: -81.6557 },
  "San Francisco": { lat: 37.7749, lng: -122.4194 },
  "Seattle": { lat: 47.6062, lng: -122.3321 },
  "Denver": { lat: 39.7392, lng: -104.9903 },
  "Boston": { lat: 42.3601, lng: -71.0589 },
  "Atlanta": { lat: 33.7490, lng: -84.3880 },
  "Miami": { lat: 25.7617, lng: -80.1918 },
  "Minneapolis": { lat: 44.9778, lng: -93.2650 },
  "St. Louis": { lat: 38.6270, lng: -90.1994 },
  "Las Vegas": { lat: 36.1716, lng: -115.1391 },
  "Anchorage": { lat: 61.2181, lng: -149.9003 },
  "Honolulu": { lat: 21.3069, lng: -157.8583 },
  "Detroit": { lat: 42.3314, lng: -83.0458 }
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
