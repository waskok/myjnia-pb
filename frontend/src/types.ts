export interface Employee { id: number; firstName: string; lastName: string; role: string; login: string; email?: string; phone?: string; }
export interface Customer { id: number; firstName: string; lastName: string; email: string; phone: string; loyaltyPoints: number; registered: boolean; }
export interface WashService { id: number; type: string; price: number; loyaltyPoints: number; }
export interface Reservation { id: number; date: string; status: string; washService: WashService; customer?: { firstName: string; lastName: string; phone: string; }; }
export interface Fuel { id: number; type: string; pricePerLiter: number; tankLevel: number; maxLevel: number; percentage?: string; }
export interface Delivery { id: number; fuel: Fuel; quantity: number; status: string; deliveryDate: string; supplier: string; owner?: { firstName: string; lastName: string; } }
export interface MonitoringData { fuels: Fuel[]; lpg: { pressure: string; temp: string; }; carWash: { bay: number; occupied: boolean; camera: string; }[]; alerts: string[]; }
export interface TransactionItem { id?: number; product: string; quantity: number; value: number; }
export interface Transaction { id: number; totalAmount: number; date: string; paymentMethod: string; customer?: { firstName: string; lastName: string; }; employee: { firstName: string; lastName: string; }; items?: TransactionItem[]; }
export interface ReportData { totalRevenue: number; totalCount: number; transactions: Transaction[]; }

export type ReportPeriodType = 'all' | 'daily' | 'monthly' | 'yearly';
export type ActiveCustTab = 'book' | 'resHistory' | 'buyHistory' | 'contact';

export interface ScheduleEntry {
  id: number;
  date: string;
  startTime: string;
  employeeId: number;
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'role'>;
}

export interface ScheduleMonthData {
  year: number;
  month: number;
  schedules: ScheduleEntry[];
}