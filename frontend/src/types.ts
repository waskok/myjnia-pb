export interface Employee { id: number; firstName: string; lastName: string; role: string; isActive: boolean; login: string; email?: string; phone?: string; }
export interface Customer { id: number; firstName: string; lastName: string; email: string; phone: string; loyaltyPoints: number; registered: boolean; }
export interface WashService { id: number; type: string; price: number; loyaltyPoints: number; }
export interface Reservation { id: number; date: string; status: string; washService: WashService; customer?: { firstName: string; lastName: string; phone: string; }; }
export interface Fuel { id: number; type: string; pricePerLiter: number; tankLevel: number; maxLevel: number; percentage?: string; }
export interface Delivery { id: number; fuel: Fuel; quantity: number; status: string; deliveryDate: string; supplier: string; owner?: { firstName: string; lastName: string; } }
export interface MonitoringPoint { timestamp: string; value: number; }
export interface MonitoringConfig {
  samplingIntervalSec: number;
  fuelLowLevelPercent: number;
  fuelMaxPressureBar: number;
  fuelMaxTempC: number;
  lpgLowLevelPercent: number;
  lpgMaxPressureBar: number;
  lpgMaxTempC: number;
}
export interface TankTelemetry {
  tank: 'E95' | 'E98' | 'ON';
  label: string;
  level: number | null;
  maxLevel: number | null;
  percentage: string | null;
  pressure: number | null;
  temperature: number | null;
  history: {
    level: MonitoringPoint[];
    pressure: MonitoringPoint[];
    temperature: MonitoringPoint[];
  };
}
export interface MonitoringData {
  fuels: (Fuel & { tankCode?: string; pressure?: number | null; temperature?: number | null })[];
  tankTelemetry?: TankTelemetry[];
  historyWindow?: { period: string; from: string; to: string };
  config?: MonitoringConfig;
  lpg: {
    pressure: number | null;
    temp: number | null;
    level?: number | null;
    maxLevel?: number | null;
    percentage?: string | null;
    history?: {
      level: MonitoringPoint[];
      pressure: MonitoringPoint[];
      temperature: MonitoringPoint[];
    };
  };
  carWash: { bay: number; occupied: boolean; camera: string; }[];
  alerts: string[];
}
export interface TransactionItem { id?: number; product: string; quantity: number; value: number; }
export interface Transaction { id: number; totalAmount: number; date: string; paymentMethod: string; customer?: { firstName: string; lastName: string; }; employee: { firstName: string; lastName: string; }; items?: TransactionItem[]; pointsUsed?: number; pointsDelta?: number; }
export interface ReportData { totalRevenue: number; totalCount: number; transactions: Transaction[]; }
export interface WashReportEntry {
  id: number;
  date: string;
  status: string;
  serviceType: string;
  servicePrice: number;
  customer: { firstName: string; lastName: string } | null;
}
export interface WashReportData {
  totalRevenue: number;
  totalCount: number;
  washes: WashReportEntry[];
}
export interface MonitoringReportEntry {
  id: number;
  tank: string;
  tankLabel: string;
  level: number | null;
  pressure: number | null;
  temperature: number | null;
  alertStatus: 'Brak alertu' | 'Alert wysłany';
  createdAt: string;
}
export interface MonitoringReportData {
  totalReadings: number;
  alertEvents: number;
  readings: MonitoringReportEntry[];
}
export type OwnerReportKind = 'sales' | 'wash' | 'monitoring';

export type ReportPeriodType = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ActiveCustTab = 'book' | 'resHistory' | 'buyHistory' | 'contact';

export interface ScheduleEntry {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  employeeId: number;
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'role'>;
}

export interface ScheduleMonthData {
  year: number;
  month: number;
  schedules: ScheduleEntry[];
}