export type Branch = {
  branchId: number;
  street: string;
  city: string;
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
  Cairo: { lat: 30.0444, lng: 31.2357 },
  Alexandria: { lat: 31.2001, lng: 29.9187 },
  Giza: { lat: 30.0131, lng: 31.2089 },
  "Port Said": { lat: 31.2565, lng: 32.2841 },
  Suez: { lat: 29.9668, lng: 32.5498 },
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
