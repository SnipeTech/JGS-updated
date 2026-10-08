export interface Staff {
  id: string;
  name: string;
  phone: string;
  role: string;
  password?: string;
  supervisorId?: string;
  adminPermissions?: string[]; // Array of TabId strings
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

export interface SitePayment {
  id: string;
  amount: number;
  date: string;
  note: string;
  paymentMethod?: string;
}

export interface SitePaymentStage {
  stageName: string;
  expectedAmount: number;
  paidAmount: number;
  dueDate?: string;
  payments: SitePayment[];
  workDescription?: string;
  stepsTaken?: string;
  expenseStatus?: 'under_control' | 'high';
  highExpenseReason?: string;
  completionStatus?: 'pending' | 'in_progress' | 'completion_requested' | 'completed';
}

export interface StageCompletionRequest {
  id: string;
  siteId: string;
  siteName: string;
  stageName: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  requestedAt: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  reviewedAt?: string;
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
  paymentStages?: SitePaymentStage[];
  totalLevels?: number;
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

export interface ManualExpense {
  id: string;
  siteId: string;
  siteName?: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  workLevelStage?: string;
  paymentMethod?: string;
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
  bike: 0,
  bus: 0,
  auto: 0,
  car: 0,
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
  incomePaymentMethod?: string;
  notes: string;
  workerIds?: string[];
  workerCounts?: LabourCount;
  workLevelStage?: string;
  supervisorSalary?: number;
  employeeSalaries?: {
    staffId: string;
    staffName: string;
    role: string;
    baseSalary: number;
    isHalfDay: boolean;
    otHours: number;
    otPay: number;
    totalSalary: number;
  }[];
}

export interface LabourCount {
  painter?: number;
  plumber?: number;
  labour?: number;
  [key: string]: number | undefined;
}

export interface SiteAssignment {
  siteId: string;
  counts: LabourCount;
  halfDayCounts?: LabourCount;
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
  siteName?: string;
  expenseAmount?: number;
  expenseNotes?: string;
  expensePaymentMethod?: string;
  expenseStatus?: 'pending' | 'verified' | 'paid' | 'rejected';
  expenseVerifiedBy?: string;
  expenseVerifiedAt?: string;
  expensePaidAt?: string;
  expensePaidAmount?: number;
  expenseRejectionReason?: string;
  expenses?: { itemName: string; amount: number }[];
  presentCounts?: LabourCount;
  halfDayCounts?: LabourCount;
  siteAssignments?: SiteAssignment[];
  unnamedOtHours?: number;
  unnamedOtStaffCount?: number;
  isSubmitted?: boolean;
  editedByAdmin?: boolean;
  editedByAdminName?: string;
}

export interface MaterialSetting {
  id: string;
  name: string;
  category?: string;
  unit: string;
  perUnitWeight?: string;
  defaultRate?: number;
  isRental?: boolean;
  rentalRatePerDay?: number;
  // Store room inventory tracking:
  isStoreRoom?: boolean;
  stockQuantity?: number;
  minStockAlert?: number;
  storeRoomLocation?: string;
  buyingPrice?: number;
  totalPurchaseCost?: number;
}

export interface StoreRoomDispatchRecord {
  id: string;
  materialId: string;
  materialName: string;
  category?: string;
  quantity: number;
  unit: string;
  siteId: string;
  siteName: string;
  workLevelStage?: string;
  startDate: string;
  startTime?: string;
  deliveryDate?: string; // Date product was delivered/arrived on site
  returnDate?: string;
  returnTime?: string;
  dispatchDate?: string;
  dispatchTime?: string;
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  vehicleNumber?: string;
  transitCost?: number;
  perDayRate?: number;
  totalDays?: number;
  storeRoomAmount?: number;
  storeRoomProfit?: number;
  destinationType?: 'store_room' | 'other_site';
  transferToSiteId?: string;
  transferToSiteName?: string;
  status: 'active' | 'returned' | 'dispatched' | 'delivered';
  notes?: string;
  dispatchedBy?: string;
  createdAt: string;
}

export const MATERIAL_CATEGORIES = [
  'Civil & Structural',
  'Masonry & Concrete',
  'Paints & Finishing',
  'Plumbing & Sanitary',
  'Electrical & Wiring',
  'Carpentry & Woodwork',
  'Scaffolding & Rental Tools',
  'Hardware & Consumables',
  'Other'
] as const;

export interface MaterialRental {
  id: string;
  materialId: string;
  materialName: string;
  siteId: string;
  siteName: string;
  startDate: string;
  endDate?: string;
  quantity: number;
  unit: string;
  requiresDriver: boolean;
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  vehicleNumber?: string;
  transitCost?: number;
  rentalRatePerDay: number;
  totalDays?: number;
  totalRentalCost?: number;
  status: 'active' | 'returned';
  notes?: string;
  createdAt: string;
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

  // Per-product Tax & GST:
  gstType?: 'none' | 'igst' | 'cgst_sgst';
  gstRate?: number;
  igstRate?: number;
  cgstRate?: number;
  sgstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  gstAmount?: number;
  totalWithGst?: number;
}

export interface Vehicle {
  id: string;
  name: string;
  number: string;
  type: string; // 'Pickup' | 'JCB' | 'Lorry / Tipper' | 'Mini Truck (Tata Ace)' | 'Tractor' | 'Three Wheeler (Auto)' | 'Other'
  status?: 'Active' | 'Under Maintenance' | 'Idle' | 'Out of Service' | string;
  fuelType?: 'Diesel' | 'Petrol' | 'Electric' | 'CNG' | string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  odometer?: number;
  insuranceExpiry?: string;
  fitnessExpiry?: string;
  notes?: string;
  createdAt?: string;
}

export interface VehicleMaintenanceRecord {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehicleNumber: string;
  date: string;
  type: 'Regular Service' | 'Oil Change' | 'Tyre Replacement' | 'Brake Service' | 'Engine Repair' | 'Body Work' | 'Insurance / Tax' | 'Other' | string;
  cost: number;
  odometerReading?: number;
  workshopName?: string;
  billNumber?: string;
  nextServiceDueDate?: string;
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
  workLevelStage?: string;
  
  // Sourcing (Supplier vs Inter-Site Transfer vs Store Room):
  sourceType?: 'supplier' | 'site' | 'store_room';
  sourceSiteId?: string;
  sourceSiteName?: string;
  isStoreRoom?: boolean;
  storeRoomMaterialId?: string;
  startDate?: string;
  deliveryDate?: string; // Date delivered to site
  returnDate?: string;
  storeRoomAmount?: number;
  storeRoomProfit?: number;
  
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

  // GST details:
  gstType?: 'none' | 'igst' | 'cgst_sgst';
  igstRate?: number;
  cgstRate?: number;
  sgstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  gstAmount?: number;
  
  completedAt?: string;
  completionNotes?: string;
}

export interface CrushedStockRecord {
  id: string;
  materialId?: string;
  materialName: string;
  category?: string;
  unit: string;
  crushedQuantity: number;
  buyingPrice: number;
  lossAmount: number;
  reason: string;
  notes?: string;
  date: string;
  time?: string;
  createdAt?: string;
}

export interface AppState {
  staffList: Staff[];
  sites: Site[];
  dailyLogs: DailyLog[];
  customers: Customer[];
  products: Product[];
  quotations: Quotation[];
  manualExpenses: ManualExpense[];
  vendors: Vendor[];
  workEntries: WorkEntry[];
  attendances: Attendance[];
  materialSettings: MaterialSetting[];
  suppliers: Supplier[];
  vehicles: Vehicle[];
  vehicleMaintenance: VehicleMaintenanceRecord[];
  materialRequests: MaterialRequest[];
  labourTypes: string[];
  paymentStageMaster: string[];
  unitMaster: string[];
  materialRentals: MaterialRental[];
  stageCompletionRequests: StageCompletionRequest[];
  storeRoomDispatches?: StoreRoomDispatchRecord[];
  crushedStockHistory?: CrushedStockRecord[];
  currentUser: { id: string; name?: string; role: 'admin' | 'staff'; adminPermissions?: string[] } | null;
}

