export interface Staff {
  id: string;
  name: string;
  phone: string;
  role: string;
  password?: string;
  supervisorId?: string;
  salaryType?: 'daily' | 'hourly'; // 'daily' | 'hourly'
  perDaySalary?: number;
  perHourSalary?: number;          // hourly salary (₹/hr)
  customerHourlyRate?: number;     // for drivers: hourly customer billing/pay amount (₹/hr)
  inTime?: string;
  outTime?: string;
  incentivePerHour?: number;
  underLabourSalary?: number;
  underLabourOT?: number;
  perDayIncentive?: number;
}

export interface Site {
  id: string;
  name: string;
  address: string;
  clientName: string;
  status: 'active' | 'completed' | 'on-hold';
  startDate: string;
  budget: number;
  supervisorId?: string;
  assignedStaffIds?: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  rate: number;
  description: string;
}

export interface QuotationItem {
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  customerName: string;
  siteId: string;
  siteName: string;
  items: QuotationItem[];
  totalAmount: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'converted';
  createdAt: string;
  notes: string;
}

export interface PaymentHistory {
  id: string;
  date: string;
  amount: number;
  mode: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';
  note: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  quotationId?: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  siteId: string;
  siteName: string;
  items: QuotationItem[];
  totalAmount: number;
  paidAmount: number;
  status: 'pending' | 'partial' | 'paid';
  paymentHistory?: PaymentHistory[];
  paymentType: 'full' | 'partial';
  partialDueDate?: string;
  createdAt: string;
  dueDate: string;
  notes: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  email: string;
  category: string;
  address: string;
  notes: string;
}

export interface WorkEntry {
  id: string;
  staffId: string;
  staffName: string;
  siteId: string;
  siteName: string;
  date: string;
  workDescription: string;
  hoursWorked: number;
  status: 'present' | 'absent' | 'half-day';
}

export type TransportMode = 'bike' | 'auto' | 'bus' | 'car' | 'walk';

export const TRANSPORT_RATES: Record<TransportMode, number> = {
  walk: 0,
  bike: 5,
  bus: 15,
  auto: 50,
  car: 100,
};

export interface Material {
  name: string;
  quantity: number;
  cost: number;
}

export interface DailyLog {
  id: string;
  staffId: string;
  staffName: string;
  siteId: string;
  siteName: string;
  date: string;
  materials: Material[];
  transportMode?: string;
  transportCost?: number;
  expenses?: { itemName: string, amount: number }[];
  incomeFromClient: number;
  notes: string;
  workerIds?: string[];
}

export interface LabourCount {
  painter: number;
  plumber: number;
  labour: number;
}

export interface SiteAssignment {
  siteId: string;
  counts: LabourCount;
}

export interface Attendance {
  id: string;
  staffId: string;
  date: string;
  status: 'present' | 'absent' | 'half-day';
  inTime?: string;
  outTime?: string;
  otHours?: number;
  incentiveAmount?: number;
  notes?: string;
  manCount?: number;
  siteId?: string;
  presentCounts?: LabourCount;
  siteAssignments?: SiteAssignment[];
  unnamedOtHours?: number;
  unnamedOtStaffCount?: number;
}

export interface MaterialSetting {
  id: string;
  name: string;
  unit: string;
  perUnitWeight?: string;
  defaultRate?: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address?: string;
  materialsSupplied?: string;
  suppliedMaterials?: string[];
  materialRates?: Record<string, number>;
  notes?: string;
  createdAt: string;
}

export interface MaterialRequestItem {
  name: string;
  quantity: number;
  unit?: string;
  rate?: number;           // supplier purchase unit rate (₹) - materials only
  amount?: number;         // calculated supplier amount: quantity * rate (₹)
  supplierRate?: number;   // unit rate for supplier purchase (₹)
  supplierAmount?: number; // calculated supplier amount: quantity * supplierRate (₹)
  clientRate?: number;     // unit rate for client (₹)
  clientAmount?: number;   // calculated amount for client: quantity * clientRate (₹)
  customerRate?: number;   // unit rate for customer (₹)
  customerAmount?: number; // calculated amount for customer: quantity * customerRate (₹)
}

export interface Vehicle {
  id: string;
  name: string;
  number: string;
  type: string; // 'Pickup' | 'JCB' | 'Lorry / Tipper' | 'Mini Truck (Tata Ace)' | 'Tractor' | 'Three Wheeler (Auto)' | 'Other'
  notes?: string;
  createdAt?: string;
}

export const VEHICLE_TYPES = [
  'Pickup',
  'JCB',
  'Lorry / Tipper',
  'Mini Truck (Tata Ace)',
  'Tractor',
  'Three Wheeler (Auto)',
  'Other'
] as const;

export interface SupplierPaymentRecord {
  id: string;
  date: string;
  time?: string;
  amount: number;
  method: 'Cash' | 'UPI / GPay' | 'Bank Transfer / NEFT' | 'Cheque' | string;
  supplierRateDescription?: string;
  notes?: string;
  createdAt?: string;
}

export interface MaterialRequest {
  id: string;
  siteId: string;
  siteName: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  date: string;
  time: string;
  items: MaterialRequestItem[];
  notes?: string;
  status: 'pending' | 'assigned' | 'completed' | 'cancelled';
  
  // Sourcing (Supplier vs Inter-Site Transfer):
  sourceType?: 'supplier' | 'site';
  sourceSiteId?: string;
  sourceSiteName?: string;
  
  // Assignment by Admin:
  driverId?: string;
  driverName?: string;
  supplierId?: string;
  supplierName?: string;
  vehicle?: string;
  vehicleNumber?: string;
  vehicleType?: string; // e.g. 'Pickup', 'JCB', etc.
  assignedAt?: string;
  startTime?: string;   // Staff start/dispatch time e.g. "09:30 AM"
  
  // Completion details:
  endTime?: string;        // Staff completion/end time e.g. "11:45 AM"
  duration?: string;       // Calculated duration e.g. "2h 15m"
  durationHours?: number;  // Numeric transit duration in decimal hours (e.g. 2.0)
  driverWage?: number;     // Auto-detected driver pay / customer charge based on hours * driverHourlyRate (₹)
  driverHourlyRate?: number; // Hourly rate applied for driver transit (₹/hr)
  completionTime?: string;
  materialCost?: number;   // Total supplier material purchase cost (quantity * supplierRate) - strictly materials only!
  supplierMaterialCost?: number; // Total supplier bill for materials only (₹) - NO driver or petrol added
  clientMaterialCost?: number; // Total materials price for Client (₹)
  customerMaterialCost?: number; // Total materials price for Customer (₹)
  totalCost?: number;      // Grand total requisition cost (₹)
  clientTotalCost?: number; // Total cost billed for Client (Material for Client + Driver + Petrol)
  customerTotalCost?: number; // Total cost billed for Customer (Material for Customer + Driver + Petrol)
  petrolCharge?: number;   // Petrol allowance/expense (₹)
  // Supplier pricing & payment tracking:
  supplierPrice?: number;      // Total price/bill charged by supplier for materials (₹)
  supplierPaidAmount?: number; // How much given / paid to the supplier (₹)
  supplierBalance?: number;    // Remaining amount for supplier (₹)
  supplierPaymentMethod?: 'Cash' | 'UPI / GPay' | 'Bank Transfer / NEFT' | 'Cheque' | string;
  supplierPaymentDate?: string;
  supplierPaymentNotes?: string;
  supplierPayments?: SupplierPaymentRecord[];
  
  completedAt?: string;
  completionNotes?: string;
}

export interface AppState {
  staffList: Staff[];
  sites: Site[];
  dailyLogs: DailyLog[];
  customers: Customer[];
  products: Product[];
  quotations: Quotation[];
  invoices: Invoice[];
  vendors: Vendor[];
  workEntries: WorkEntry[];
  attendances: Attendance[];
  materialSettings: MaterialSetting[];
  suppliers: Supplier[];
  vehicles: Vehicle[];
  materialRequests: MaterialRequest[];
  currentUser: { id: string; role: 'admin' | 'staff' } | null;
}
