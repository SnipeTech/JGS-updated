import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Staff, Site, DailyLog, AppState, Customer, Product, Quotation, Invoice, Vendor, WorkEntry, Attendance, Supplier, MaterialRequest, Vehicle } from '@/types';
import { calculateDuration } from '@/lib/utils';
import { format } from 'date-fns';

interface AppContextType extends AppState {
  login: (id: string, password: string) => boolean;
  logout: () => void;
  // Staff
  addStaff: (staff: Omit<Staff, 'id'>) => void;
  deleteStaff: (id: string) => void;
  updateStaff: (id: string, updates: Partial<Staff>) => void;
  // Sites
  addSite: (site: Omit<Site, 'id'>) => void;
  deleteSite: (id: string) => void;
  updateSite: (id: string, site: Partial<Site>) => void;
  // Daily Logs
  addDailyLog: (log: Omit<DailyLog, 'id'>) => void;
  updateDailyLog: (id: string, log: Partial<DailyLog>) => void;
  // Customers
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => void;
  deleteCustomer: (id: string) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  // Products
  addProduct: (product: Omit<Product, 'id'>) => void;
  deleteProduct: (id: string) => void;
  // Quotations
  addQuotation: (quotation: Omit<Quotation, 'id' | 'quotationNumber' | 'createdAt'>) => void;
  updateQuotation: (id: string, quotation: Partial<Quotation>) => void;
  deleteQuotation: (id: string) => void;
  // Invoices
  addInvoice: (invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>) => void;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  // Vendors
  addVendor: (vendor: Omit<Vendor, 'id'>) => void;
  deleteVendor: (id: string) => void;
  // Work Entries
  addWorkEntry: (entry: Omit<WorkEntry, 'id'>) => void;
  // Attendances
  saveAttendance: (data: Omit<import('@/types').Attendance, 'id'> & { id?: string }) => void;
  // Material Settings
  addMaterialSetting: (setting: Omit<import('@/types').MaterialSetting, 'id'>) => void;
  updateMaterialSetting: (id: string, setting: Partial<import('@/types').MaterialSetting>) => void;
  deleteMaterialSetting: (id: string) => void;
  // Suppliers
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  // Vehicles
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
  // Material Requests
  addMaterialRequest: (request: Omit<MaterialRequest, 'id' | 'status'>) => void;
  updateMaterialRequest: (id: string, updates: Partial<MaterialRequest>) => void;
  deleteMaterialRequest: (id: string) => void;
  assignMaterialRequest: (id: string, assignment: { driverId: string; driverName: string; supplierId: string; supplierName: string; vehicle?: string; vehicleNumber?: string; vehicleType?: string; startTime?: string; supplierPrice?: number; supplierPaidAmount?: number; supplierBalance?: number }) => void;
  completeMaterialRequest: (id: string, completion: { startTime?: string; endTime: string; completionTime?: string; duration?: string; durationHours?: number; driverWage?: number; driverHourlyRate?: number; items?: import('@/types').MaterialRequestItem[]; materialCost?: number; totalCost?: number; petrolCharge: number; completionNotes?: string; supplierPrice?: number; supplierPaidAmount?: number; supplierBalance?: number }) => void;
  currentPortal: 'admin' | 'staff';
  switchPortal: (portal: 'admin' | 'staff') => void;
}

const ADMIN = { id: 'admin', name: 'Admin', phone: '0000000000', role: 'admin', password: 'admin123' };

const demoStaffId = 'staff_1772771203700';
const demoSiteId = 'site_1772771203701';
const demoSiteId2 = 'site_1772771203703';
const demoSiteId3 = 'site_1772771203704';
const demoCustId = 'cust_1772771203702';

const defaultState: AppState = {
  staffList: [
    { id: demoStaffId, name: 'Siddharth Staff', phone: '9876543210', role: 'supervisor', password: '123', perDaySalary: 800, inTime: '09:00', outTime: '18:00', incentivePerHour: 100, underLabourSalary: 700, underLabourOT: 100 }
  ],
  sites: [
    { id: demoSiteId, name: 'Villa Renovation', address: '123 Beach Rd, Kochi', clientName: 'Mr. John Abraham', status: 'active', startDate: '2026-03-01', budget: 500000 },
    { id: demoSiteId2, name: 'Penthouse Heights (MG Road)', address: '45 MG Road, Kochi', clientName: 'Dr. Ramesh Kumar', status: 'active', startDate: '2026-02-15', budget: 850000 },
    { id: demoSiteId3, name: 'Greenwood Luxury Villa', address: 'Plot 12 Kadavanthra, Kochi', clientName: 'Mrs. Priya Nambiar', status: 'active', startDate: '2026-03-10', budget: 620000 }
  ],
  dailyLogs: [
    {
      id: 'log_1',
      staffId: demoStaffId,
      staffName: 'Siddharth Staff',
      siteId: demoSiteId,
      siteName: 'Villa Renovation',
      date: '2026-03-04',
      materials: [{ name: 'Cement Bag', quantity: 10, cost: 450 }],
      expenses: [{ itemName: 'Food', amount: 200 }, { itemName: 'Bus', amount: 50 }],
      incomeFromClient: 5000,
      notes: 'Initial site preparation and clearing. Cement delivered.'
    },
    {
      id: 'log_2',
      staffId: demoStaffId,
      staffName: 'Siddharth Staff',
      siteId: demoSiteId,
      siteName: 'Villa Renovation',
      date: '2026-03-05',
      materials: [{ name: 'Paint Cans', quantity: 5, cost: 2100 }],
      expenses: [{ itemName: 'Food', amount: 250 }],
      incomeFromClient: 0,
      notes: 'Wall primering started for main hall area.'
    },
    {
      id: 'log_3',
      staffId: demoStaffId,
      staffName: 'Siddharth Staff',
      siteId: demoSiteId,
      siteName: 'Villa Renovation',
      date: '2026-03-06',
      materials: [],
      expenses: [{ itemName: 'Auto', amount: 80 }],
      incomeFromClient: 2000,
      notes: 'Wiring inspection completed by electrician. Plumbing check-up scheduled.'
    },
    {
      id: 'log_penthouse_1',
      staffId: demoStaffId,
      staffName: 'Siddharth Staff',
      siteId: demoSiteId2,
      siteName: 'Penthouse Heights (MG Road)',
      date: '2026-03-02',
      materials: [
        { name: 'Cement Bag (50kg)', quantity: 30, cost: 420 },
        { name: 'M-Sand', quantity: 5, cost: 1800 },
        { name: 'Interior Paint (White)', quantity: 18, cost: 380 },
        { name: 'Wall Putty', quantity: 10, cost: 450 }
      ],
      expenses: [{ itemName: 'Auto', amount: 120 }],
      incomeFromClient: 25000,
      notes: 'Foundation and plastering materials stored on site surplus.'
    },
    {
      id: 'log_greenwood_1',
      staffId: demoStaffId,
      staffName: 'Siddharth Staff',
      siteId: demoSiteId3,
      siteName: 'Greenwood Luxury Villa',
      date: '2026-03-03',
      materials: [
        { name: 'Red Bricks', quantity: 600, cost: 12 },
        { name: 'Jalli (Aggregate)', quantity: 3, cost: 2200 },
        { name: 'Cement Bag (50kg)', quantity: 15, cost: 430 }
      ],
      expenses: [{ itemName: 'Food', amount: 150 }],
      incomeFromClient: 15000,
      notes: 'Compound wall construction stock in hand.'
    }
  ],
  customers: [
    { id: demoCustId, name: 'John Abraham', phone: '9876543210', email: 'john@example.com', address: 'Marine Drive, Kochi', notes: 'Premium client, focus on quality.', createdAt: new Date().toISOString() }
  ],
  products: [],
  quotations: [],
  invoices: [
    {
      id: 'inv_1',
      invoiceNumber: 'INV-0001',
      customerId: demoCustId,
      customerName: 'John Abraham',
      customerPhone: '9876543210',
      siteId: demoSiteId,
      siteName: 'Villa Renovation',
      items: [
        { productId: 'Design Consult', productName: 'Interior Design Fee', quantity: 1, rate: 25000, total: 25000 },
        { productId: 'Adv Payment', productName: 'Advance Work Charges', quantity: 1, rate: 75000, total: 75000 }
      ],
      totalAmount: 100000,
      paidAmount: 7000,
      status: 'partial',
      paymentType: 'partial',
      partialDueDate: '2026-03-15',
      paymentHistory: [
        { id: 'ph_1', date: '2026-03-01', amount: 5000, mode: 'upi', note: 'Booking advance' },
        { id: 'ph_2', date: '2026-03-04', amount: 2000, mode: 'cash', note: 'Material advance' }
      ],
      createdAt: new Date().toISOString(),
      dueDate: '2026-03-30',
      notes: 'Advance invoice for initial phase.'
    }
  ],
  vendors: [],
  workEntries: [],
  attendances: [],
  materialSettings: [
    { id: 'ms_1', name: 'Cement', unit: 'Bags', perUnitWeight: '50kg' },
    { id: 'ms_2', name: 'Jalli', unit: 'Tons', perUnitWeight: '1 Ton' },
    { id: 'ms_3', name: 'Sand', unit: 'Tons', perUnitWeight: '1 Ton' },
  ],
  suppliers: [
    { id: 'sup_1', name: 'Sri Murugan Hardwares', phone: '9842155667', address: 'Main Road, Kochi', materialsSupplied: 'Cement, Jalli, Sand', suppliedMaterials: ['Cement', 'Jalli', 'Sand'], createdAt: new Date().toISOString() },
    { id: 'sup_2', name: 'Krishna Paints & Electricals', phone: '9443211223', address: 'Town Centre, Kochi', materialsSupplied: 'Paints, Putty', suppliedMaterials: ['Paints'], createdAt: new Date().toISOString() }
  ],
  vehicles: [
    { id: 'veh_1', name: 'Mahindra Bolero Pickup', number: 'TN 38 P 1024', type: 'Pickup', createdAt: new Date().toISOString() },
    { id: 'veh_2', name: 'JCB 3DX Earth Mover', number: 'TN 38 J 4521', type: 'JCB', createdAt: new Date().toISOString() },
    { id: 'veh_3', name: 'Tata Ace Gold', number: 'TN 38 M 8890', type: 'Mini Truck (Tata Ace)', createdAt: new Date().toISOString() }
  ],
  materialRequests: [],
  currentUser: null,
};

function loadState(): AppState {
  try {
    const saved = localStorage.getItem('edamari_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      const state = {
        ...defaultState,
        ...parsed,
        currentUser: null,
      };

      // If the user has no logs or sites, inject the demo ones alongside their data
      if (state.sites.length === 0) {
        state.sites = defaultState.sites;
      } else {
        // Ensure other sites with stock exist for inter-site transfers
        defaultState.sites.forEach(ds => {
          if (!state.sites.some(s => s.id === ds.id)) {
            state.sites.push(ds);
          }
        });
      }

      if (state.dailyLogs.length === 0) {
        state.dailyLogs = defaultState.dailyLogs;
      } else {
        defaultState.dailyLogs.forEach(dl => {
          if (!state.dailyLogs.some(l => l.id === dl.id)) {
            state.dailyLogs.push(dl);
          }
        });
      }

      if (state.staffList.length === 0) state.staffList = defaultState.staffList;
      if (state.customers.length === 0) state.customers = defaultState.customers;
      if (state.invoices.length === 0) state.invoices = defaultState.invoices;

      if (!state.workEntries) state.workEntries = [];
      if (!state.attendances) state.attendances = [];
      if (!state.materialSettings) state.materialSettings = defaultState.materialSettings;
      if (!state.suppliers || state.suppliers.length === 0) state.suppliers = defaultState.suppliers;
      if (!state.vehicles || state.vehicles.length === 0) state.vehicles = defaultState.vehicles;
      if (!state.materialRequests) state.materialRequests = [];

      return state;
    }
  } catch { }
  return defaultState;
}

function saveState(state: AppState) {
  const { currentUser, ...rest } = state;
  localStorage.setItem('edamari_data', JSON.stringify(rest));
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [currentPortal, setCurrentPortal] = useState<'admin' | 'staff'>('admin');
  const switchPortal = (portal: 'admin' | 'staff') => setCurrentPortal(portal);

  useEffect(() => {
    saveState(state);
  }, [state.staffList, state.sites, state.dailyLogs, state.customers, state.products, state.quotations, state.invoices, state.vendors, state.workEntries, state.attendances, state.materialSettings, state.suppliers, state.vehicles, state.materialRequests]);

  const login = (id: string, password: string): boolean => {
    if (id.trim() === 'admin' && password === ADMIN.password) {
      setState(s => ({ ...s, currentUser: { id: 'admin', role: 'admin' } }));
      setCurrentPortal('admin');
      return true;
    }
    // Staff can log in using their Name OR Phone Number OR raw ID — all case-insensitive
    const input = id.trim().toLowerCase();
    const staff = state.staffList.find(s =>
      s.password && s.password === password && (
        s.id === id.trim() ||
        s.name.toLowerCase() === input ||
        (s.phone && s.phone === id.trim())
      )
    );
    if (staff) {
      const userRole = staff.role === 'admin' ? 'admin' : 'staff';
      setState(s => ({ ...s, currentUser: { id: staff.id, role: userRole } }));
      setCurrentPortal(userRole === 'admin' ? 'admin' : 'staff');
      return true;
    }
    return false;
  };

  const logout = () => setState(s => ({ ...s, currentUser: null }));

  const addStaff = (staff: Omit<Staff, 'id'>) => {
    const id = 'staff_' + Date.now();
    setState(s => ({ ...s, staffList: [...s.staffList, { ...staff, id }] }));
  };
  const deleteStaff = (id: string) => setState(s => ({ ...s, staffList: s.staffList.filter(x => x.id !== id) }));
  const updateStaff = (id: string, updates: Partial<Staff>) =>
    setState(s => ({ ...s, staffList: s.staffList.map(x => x.id === id ? { ...x, ...updates } : x) }));

  const addSite = (site: Omit<Site, 'id'>) => {
    const id = 'site_' + Date.now();
    setState(s => ({ ...s, sites: [...s.sites, { ...site, id }] }));
  };
  const deleteSite = (id: string) => setState(s => ({ ...s, sites: s.sites.filter(x => x.id !== id) }));
  const updateSite = (id: string, updates: Partial<Site>) =>
    setState(s => ({ ...s, sites: s.sites.map(x => x.id === id ? { ...x, ...updates } : x) }));

  const addDailyLog = (log: Omit<DailyLog, 'id'>) => {
    setState(prev => ({
      ...prev,
      dailyLogs: [...prev.dailyLogs, { ...log, id: `log_${Date.now()}` }]
    }));
  };

  const updateDailyLog = (id: string, updates: Partial<DailyLog>) => {
    setState(prev => ({
      ...prev,
      dailyLogs: prev.dailyLogs.map(l => l.id === id ? { ...l, ...updates } : l)
    }));
  };

  const addCustomer = (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    const id = 'cust_' + Date.now();
    setState(s => ({ ...s, customers: [...s.customers, { ...customer, id, createdAt: new Date().toISOString() }] }));
  };
  const deleteCustomer = (id: string) => setState(s => ({ ...s, customers: s.customers.filter(x => x.id !== id) }));
  const updateCustomer = (id: string, updates: Partial<Customer>) =>
    setState(s => ({ ...s, customers: s.customers.map(x => x.id === id ? { ...x, ...updates } : x) }));

  const addProduct = (product: Omit<Product, 'id'>) => {
    const id = 'prod_' + Date.now();
    setState(s => ({ ...s, products: [...s.products, { ...product, id }] }));
  };
  const deleteProduct = (id: string) => setState(s => ({ ...s, products: s.products.filter(x => x.id !== id) }));

  const addQuotation = (quotation: Omit<Quotation, 'id' | 'quotationNumber' | 'createdAt'>) => {
    const id = 'quot_' + Date.now();
    const quotationNumber = 'QT-' + String(state.quotations.length + 1).padStart(4, '0');
    setState(s => ({ ...s, quotations: [...s.quotations, { ...quotation, id, quotationNumber, createdAt: new Date().toISOString() }] }));
  };
  const updateQuotation = (id: string, updates: Partial<Quotation>) =>
    setState(s => ({ ...s, quotations: s.quotations.map(x => x.id === id ? { ...x, ...updates } : x) }));
  const deleteQuotation = (id: string) => setState(s => ({ ...s, quotations: s.quotations.filter(x => x.id !== id) }));

  const addInvoice = (invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>) => {
    const id = 'inv_' + Date.now();
    const invoiceNumber = 'INV-' + String(state.invoices.length + 1).padStart(4, '0');
    setState(s => ({ ...s, invoices: [...s.invoices, { ...invoice, id, invoiceNumber, createdAt: new Date().toISOString() }] }));
  };
  const updateInvoice = (id: string, updates: Partial<Invoice>) =>
    setState(s => ({ ...s, invoices: s.invoices.map(x => x.id === id ? { ...x, ...updates } : x) }));
  const deleteInvoice = (id: string) => setState(s => ({ ...s, invoices: s.invoices.filter(x => x.id !== id) }));

  const addVendor = (vendor: Omit<Vendor, 'id'>) => {
    const id = 'vend_' + Date.now();
    setState(s => ({ ...s, vendors: [...s.vendors, { ...vendor, id }] }));
  };
  const deleteVendor = (id: string) => setState(s => ({ ...s, vendors: s.vendors.filter(x => x.id !== id) }));

  const addWorkEntry = (entry: Omit<WorkEntry, 'id'>) => {
    const id = 'work_' + Date.now();
    setState(s => ({ ...s, workEntries: [...s.workEntries, { ...entry, id }] }));
  };

  const saveAttendance = (data: Omit<Attendance, 'id'> & { id?: string }) => {
    setState(s => {
      const exists = s.attendances.find(a => a.staffId === data.staffId && a.date === data.date);
      if (exists) {
        return { ...s, attendances: s.attendances.map(a => a.id === exists.id ? { ...a, ...data } : a) };
      }
      return { ...s, attendances: [{ ...data, id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` }, ...s.attendances] };
    });
  };

  const addMaterialSetting = (setting: Omit<import('@/types').MaterialSetting, 'id'>) => {
    setState(s => ({ ...s, materialSettings: [{ ...setting, id: `ms_${Date.now()}` }, ...s.materialSettings] }));
  };

  const updateMaterialSetting = (id: string, updates: Partial<import('@/types').MaterialSetting>) => {
    setState(s => ({ ...s, materialSettings: s.materialSettings.map(m => m.id === id ? { ...m, ...updates } : m) }));
  };

  const deleteMaterialSetting = (id: string) => {
    setState(s => ({ ...s, materialSettings: s.materialSettings.filter(m => m.id !== id) }));
  };

  // Suppliers
  const addSupplier = (supplier: Omit<Supplier, 'id' | 'createdAt'>) => {
    const id = `sup_${Date.now()}`;
    const createdAt = new Date().toISOString();
    setState(s => ({ ...s, suppliers: [{ ...supplier, id, createdAt }, ...s.suppliers] }));
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    setState(s => ({ ...s, suppliers: s.suppliers.map(sup => sup.id === id ? { ...sup, ...updates } : sup) }));
  };

  const deleteSupplier = (id: string) => {
    setState(s => ({ ...s, suppliers: s.suppliers.filter(sup => sup.id !== id) }));
  };

  // Vehicles
  const addVehicle = (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => {
    const id = `veh_${Date.now()}`;
    const createdAt = new Date().toISOString();
    setState(s => ({ ...s, vehicles: [{ ...vehicle, id, createdAt }, ...s.vehicles] }));
  };

  const updateVehicle = (id: string, updates: Partial<Vehicle>) => {
    setState(s => ({ ...s, vehicles: s.vehicles.map(v => v.id === id ? { ...v, ...updates } : v) }));
  };

  const deleteVehicle = (id: string) => {
    setState(s => ({ ...s, vehicles: s.vehicles.filter(v => v.id !== id) }));
  };

  // Material Requests
  const addMaterialRequest = (request: Omit<MaterialRequest, 'id' | 'status'>) => {
    const id = `mr_${Date.now()}`;
    const now = new Date();
    setState(s => ({
      ...s,
      materialRequests: [{
        ...request,
        id,
        status: 'pending',
        createdAt: request.createdAt || now.toISOString(),
        date: request.date || format(now, 'yyyy-MM-dd'),
        time: request.time || format(now, 'hh:mm a')
      }, ...s.materialRequests]
    }));
  };

  const updateMaterialRequest = (id: string, updates: Partial<MaterialRequest>) => {
    setState(s => ({
      ...s,
      materialRequests: s.materialRequests.map(mr => {
        if (mr.id !== id) return mr;
        const merged = { ...mr, ...updates };
        if (merged.supplierPrice !== undefined || merged.supplierPaidAmount !== undefined) {
          const price = merged.supplierPrice !== undefined ? merged.supplierPrice : (merged.materialCost || 0);
          const paid = merged.supplierPaidAmount !== undefined ? merged.supplierPaidAmount : 0;
          merged.supplierBalance = Math.max(0, price - paid);
        }
        return merged;
      })
    }));
  };

  const deleteMaterialRequest = (id: string) => {
    setState(s => ({
      ...s,
      materialRequests: s.materialRequests.filter(mr => mr.id !== id)
    }));
  };

  const assignMaterialRequest = (id: string, assignment: {
    driverId: string;
    driverName: string;
    supplierId: string;
    supplierName: string;
    vehicle?: string;
    vehicleNumber?: string;
    vehicleType?: string;
    startTime?: string;
    supplierPrice?: number;
    supplierPaidAmount?: number;
    supplierBalance?: number;
    supplierPaymentMethod?: string;
    supplierPaymentDate?: string;
    supplierPaymentNotes?: string;
    supplierPayments?: import('@/types').SupplierPaymentRecord[];
    items?: import('@/types').MaterialRequestItem[];
  }) => {
    const finalVehicle = assignment.vehicle || `${assignment.vehicleType ? `${assignment.vehicleType} - ` : ''}${assignment.vehicleNumber || ''}`;
    setState(s => ({
      ...s,
      materialRequests: s.materialRequests.map(mr => mr.id === id ? {
        ...mr,
        ...assignment,
        items: assignment.items || mr.items,
        materialCost: assignment.supplierPrice !== undefined ? assignment.supplierPrice : mr.materialCost,
        vehicle: finalVehicle,
        vehicleNumber: assignment.vehicleNumber || assignment.vehicle,
        vehicleType: assignment.vehicleType,
        startTime: assignment.startTime || mr.startTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        supplierPrice: assignment.supplierPrice !== undefined ? assignment.supplierPrice : mr.supplierPrice,
        supplierPaidAmount: assignment.supplierPaidAmount !== undefined ? assignment.supplierPaidAmount : (mr.supplierPaidAmount || 0),
        supplierBalance: assignment.supplierBalance !== undefined ? assignment.supplierBalance : (
          assignment.supplierPrice !== undefined ? Math.max(0, assignment.supplierPrice - (assignment.supplierPaidAmount || mr.supplierPaidAmount || 0)) : mr.supplierBalance
        ),
        supplierPayments: assignment.supplierPayments || mr.supplierPayments,
        status: 'assigned',
        assignedAt: new Date().toISOString()
      } : mr)
    }));
  };

  const completeMaterialRequest = (id: string, completion: {
    startTime?: string;
    endTime: string;
    completionTime?: string;
    durationHours?: number;
    driverWage?: number;
    driverHourlyRate?: number;
    items?: import('@/types').MaterialRequestItem[];
    materialCost?: number;
    supplierPrice?: number;
    supplierMaterialCost?: number;
    clientMaterialCost?: number;
    customerMaterialCost?: number;
    totalCost?: number;
    clientTotalCost?: number;
    customerTotalCost?: number;
    petrolCharge: number;
    completionNotes?: string
  }) => {
    setState(s => {
      const targetReq = s.materialRequests.find(r => r.id === id);
      let updatedLogs = [...s.dailyLogs];

      if (targetReq && targetReq.sourceType === 'site' && targetReq.sourceSiteId) {
        const finalItems = completion.items || targetReq.items;
        const sourceSite = s.sites.find(site => site.id === targetReq.sourceSiteId);
        const destSite = s.sites.find(site => site.id === targetReq.siteId);
        const transferDate = format(new Date(), 'yyyy-MM-dd');

        // Avoid duplicate logging if already recorded for this requisition
        const alreadyLogged = updatedLogs.some(l => l.notes?.includes(`Transfer Ref #${targetReq.id}`));
        if (!alreadyLogged) {
          const sourceLog: DailyLog = {
            id: crypto.randomUUID(),
            siteId: targetReq.sourceSiteId,
            siteName: sourceSite?.name || 'Source Site',
            staffId: targetReq.requestedByStaffId,
            staffName: targetReq.requestedByStaffName,
            date: transferDate,
            incomeFromClient: 0,
            transportCost: 0,
            materials: finalItems.map(it => ({
              id: crypto.randomUUID(),
              name: `${it.name} (Transferred to ${destSite?.name || 'Site'})`,
              quantity: -Number(it.quantity),
              cost: Number(it.rate) || 0
            })),
            expenses: [],
            notes: `Material stock transferred out to ${destSite?.name || 'Site'} (Transfer Ref #${targetReq.id})`
          };

          const destLog: DailyLog = {
            id: crypto.randomUUID(),
            siteId: targetReq.siteId,
            siteName: destSite?.name || 'Destination Site',
            staffId: targetReq.requestedByStaffId,
            staffName: targetReq.requestedByStaffName,
            date: transferDate,
            incomeFromClient: 0,
            transportCost: 0,
            materials: finalItems.map(it => ({
              id: crypto.randomUUID(),
              name: `${it.name} (Transferred from ${sourceSite?.name || 'Site'})`,
              quantity: Number(it.quantity),
              cost: Number(it.rate) || 0
            })),
            expenses: [],
            notes: `Material stock received from ${sourceSite?.name || 'Site'} (Transfer Ref #${targetReq.id})`
          };

          updatedLogs = [sourceLog, destLog, ...updatedLogs];
        }
      }

      return {
        ...s,
        dailyLogs: updatedLogs,
        materialRequests: s.materialRequests.map(mr => {
          if (mr.id !== id) return mr;
          const finalStart = completion.startTime || mr.startTime || '';
          const finalEnd = completion.endTime || completion.completionTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const finalDuration = completion.duration || calculateDuration(finalStart, finalEnd);
          const finalItems = completion.items || mr.items;
          const computedMaterialCost = completion.materialCost !== undefined
            ? completion.materialCost
            : finalItems.reduce((sum, it) => sum + (Number(it.amount) || ((Number(it.quantity) || 0) * (Number(it.rate) || 0))), 0);
          const finalDriverWage = Number(completion.driverWage) || 0;
          const finalPetrol = Number(completion.petrolCharge) || 0;
          const computedTotalCost = completion.totalCost !== undefined
            ? completion.totalCost
            : (computedMaterialCost + finalDriverWage + finalPetrol);

          return {
            ...mr,
            ...completion,
            items: finalItems,
            materialCost: computedMaterialCost,
            driverWage: finalDriverWage,
            driverHourlyRate: completion.driverHourlyRate,
            durationHours: completion.durationHours,
            totalCost: computedTotalCost,
            startTime: finalStart,
            endTime: finalEnd,
            completionTime: finalEnd,
            duration: finalDuration,
            petrolCharge: finalPetrol,
            supplierPrice: completion.supplierPrice !== undefined ? completion.supplierPrice : (completion.supplierMaterialCost !== undefined ? completion.supplierMaterialCost : mr.supplierPrice),
            supplierMaterialCost: completion.supplierMaterialCost !== undefined ? completion.supplierMaterialCost : (completion.supplierPrice !== undefined ? completion.supplierPrice : mr.supplierMaterialCost),
            supplierPaidAmount: completion.supplierPaidAmount !== undefined ? completion.supplierPaidAmount : (mr.supplierPaidAmount || 0),
            supplierBalance: completion.supplierBalance !== undefined ? completion.supplierBalance : (
              Math.max(0, (completion.supplierPrice !== undefined ? completion.supplierPrice : (completion.supplierMaterialCost !== undefined ? completion.supplierMaterialCost : (mr.supplierPrice || computedMaterialCost))) - (completion.supplierPaidAmount !== undefined ? completion.supplierPaidAmount : (mr.supplierPaidAmount || 0)))
            ),
            status: 'completed',
            completedAt: new Date().toISOString()
          };
        })
      };
    });
  };

  return (
    <AppContext.Provider value={{
      ...state,
      login, logout,
      addStaff, deleteStaff, updateStaff,
      addSite, deleteSite, updateSite,
      addDailyLog, updateDailyLog,
      addCustomer, deleteCustomer, updateCustomer,
      addProduct, deleteProduct,
      addQuotation, updateQuotation, deleteQuotation,
      addInvoice, updateInvoice, deleteInvoice,
      addVendor, deleteVendor,
      addWorkEntry,
      saveAttendance,
      addMaterialSetting, updateMaterialSetting, deleteMaterialSetting,
      addSupplier, updateSupplier, deleteSupplier,
      addVehicle, updateVehicle, deleteVehicle,
      addMaterialRequest, updateMaterialRequest, deleteMaterialRequest,
      assignMaterialRequest, completeMaterialRequest,
      currentPortal, switchPortal,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
