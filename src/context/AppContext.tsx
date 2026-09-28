import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Staff, Site, DailyLog, AppState, Customer, Product, Quotation, Invoice, Vendor, WorkEntry, Attendance, Supplier, MaterialRequest, Vehicle, MaterialRental, StageCompletionRequest } from '@/types';
import { calculateDuration } from '@/lib/utils';
import { format } from 'date-fns';

import { api } from '@/services/api';

interface AppContextType extends AppState {
  login: (id: string, password: string) => boolean;
  logout: () => void;
  isBackendConnected: boolean;
  clearAllData: () => Promise<void>;
  refreshFromBackend: () => Promise<void>;
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
  // Manual Expenses
  addExpense: (expense: Omit<import('@/types').ManualExpense, 'id'>) => void;
  deleteExpense: (id: string) => void;
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
  // Material Rentals
  materialRentals: MaterialRental[];
  addMaterialRental: (rental: Omit<MaterialRental, 'id' | 'createdAt'>) => void;
  updateMaterialRental: (id: string, updates: Partial<MaterialRental>) => void;
  deleteMaterialRental: (id: string) => void;
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
  // Master Data
  addLabourType: (type: string) => void;
  removeLabourType: (type: string) => void;
  addPaymentStageMaster: (stage: string) => void;
  removePaymentStageMaster: (stage: string) => void;
  // Stage Completion Requests
  stageCompletionRequests: StageCompletionRequest[];
  addStageCompletionRequest: (request: Omit<StageCompletionRequest, 'id'>) => void;
  updateStageCompletionRequest: (id: string, updates: Partial<StageCompletionRequest>) => void;
  currentPortal: 'admin' | 'staff';
  switchPortal: (portal: 'admin' | 'staff') => void;
}

const ADMIN = { id: 'admin', name: 'JGS', phone: '0000000000', role: 'admin', password: 'jgsconstruction*$' };

const defaultState: AppState = {
  staffList: [],
  sites: [],
  dailyLogs: [],
  customers: [],
  products: [],
  quotations: [],
  manualExpenses: [],
  vendors: [],
  workEntries: [],
  attendances: [],
  materialSettings: [],
  suppliers: [],
  vehicles: [],
  materialRequests: [],
  labourTypes: ['painter', 'plumber', 'electrician', 'labour'],
  paymentStageMaster: ['Level 1: Foundation', 'Level 2: Ground Floor Slab', 'Level 3: Plastering', 'Level 4: Finishing & Handover'],
  materialRentals: [],
  stageCompletionRequests: [],
  currentUser: null,
};

function loadState(): AppState {
  try {
    const saved = localStorage.getItem('edamari_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Auto-clear legacy demo records if present in browser localStorage
      const hasOldDemoData =
        parsed.staffList?.some((s: any) => s.id === 'staff_1772771203700') ||
        parsed.sites?.some((s: any) => s.id === 'site_1772771203701');
      if (hasOldDemoData) {
        localStorage.removeItem('edamari_data');
        localStorage.removeItem('edamari_payroll_paid');
        localStorage.removeItem('edamari_payroll_history');
        return defaultState;
      }
      return {
        ...defaultState,
        ...parsed,
        currentUser: null,
      };
    }
  } catch { }
  return defaultState;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [currentPortal, setCurrentPortal] = useState<'admin' | 'staff'>('admin');
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState<boolean>(false);
  const switchPortal = (portal: 'admin' | 'staff') => setCurrentPortal(portal);

  // 1. Initial Load: Fetch live PostgreSQL data from Django backend
  useEffect(() => {
    let isMounted = true;
    async function loadFromBackend() {
      try {
        const health = await api.checkHealth();
        if (health.status === 'online' && health.database === 'connected') {
          if (isMounted) setIsBackendConnected(true);
          const backendState = await api.fetchAppState();
          if (isMounted && backendState) {
            setState(prev => ({
              ...prev,
              ...backendState,
              currentUser: prev.currentUser,
            }));
          }
        }
      } catch (err) {
        console.warn('Backend not reachable on initial load, using offline store:', err);
      } finally {
        if (isMounted) setIsInitialLoadDone(true);
      }
    }
    loadFromBackend();
    return () => { isMounted = false; };
  }, []);

  // 2. Persist to Backend & localStorage on any state changes
  useEffect(() => {
    if (!isInitialLoadDone) return;
    const { currentUser, ...dataToSync } = state;
    localStorage.setItem('edamari_data', JSON.stringify(dataToSync));

    const timeout = setTimeout(() => {
      api.syncAppState(dataToSync)
        .then(() => setIsBackendConnected(true))
        .catch(err => {
          console.warn('Failed to sync changes with backend:', err);
          setIsBackendConnected(false);
        });
    }, 350);

    return () => clearTimeout(timeout);
  }, [
    state.staffList, state.sites, state.dailyLogs, state.customers,
    state.products, state.quotations, state.manualExpenses, state.vendors,
    state.workEntries, state.attendances, state.materialSettings,
    state.suppliers, state.vehicles, state.materialRequests,
    state.labourTypes, state.paymentStageMaster, state.materialRentals,
    state.stageCompletionRequests, isInitialLoadDone
  ]);

  const clearAllData = async () => {
    try {
      await api.clearBackendData();
    } catch (err) {
      console.warn('Could not clear backend data:', err);
    }
    localStorage.removeItem('edamari_data');
    localStorage.removeItem('edamari_payroll_paid');
    localStorage.removeItem('edamari_payroll_history');
    setState({ ...defaultState, currentUser: state.currentUser });
  };

  const refreshFromBackend = async () => {
    try {
      const backendState = await api.fetchAppState();
      if (backendState) {
        setState(prev => ({ ...prev, ...backendState, currentUser: prev.currentUser }));
        setIsBackendConnected(true);
      }
    } catch (err) {
      console.error('Refresh from backend failed:', err);
    }
  };

  // 3. Real-time Multi-Tab Sync (storage event) & Focus Refresh & Periodic Poll
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'edamari_data' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setState(prev => ({
            ...prev,
            ...parsed,
            currentUser: prev.currentUser,
          }));
        } catch (err) {
          console.error('Error syncing data from storage event:', err);
        }
      }
    };

    const handleFocus = () => {
      refreshFromBackend();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    const pollInterval = setInterval(() => {
      if (isBackendConnected) {
        refreshFromBackend();
      }
    }, 12000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(pollInterval);
    };
  }, [isBackendConnected]);

  const login = (id: string, password: string): boolean => {
    const input = id.trim().toLowerCase();
    if ((input === 'jgs' || input === 'admin') && (password === 'jgsconstruction*$' || password === 'admin123')) {
      setState(s => ({ ...s, currentUser: { id: 'admin', role: 'admin', adminPermissions: [] } }));
      setCurrentPortal('admin');
      return true;
    }
    // Staff can log in using their Name OR Phone Number OR raw ID — all case-insensitive
    const staff = state.staffList.find(s =>
      s.password && s.password === password && (
        s.id === id.trim() ||
        s.name.toLowerCase() === input ||
        (s.phone && s.phone === id.trim())
      )
    );
    if (staff) {
      const userRole = staff.role === 'admin' ? 'admin' : 'staff';
      setState(s => ({ ...s, currentUser: { id: staff.id, role: userRole, adminPermissions: staff.adminPermissions } }));
      setCurrentPortal(userRole === 'admin' ? 'admin' : 'staff');
      return true;
    }
    return false;
  };

  const logout = () => {
    setState(s => ({ ...s, currentUser: null }));
    // Clear Google Translate cookie to prevent admin page from translating
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

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

  const addExpense = (expense: Omit<import('@/types').ManualExpense, 'id'>) => {
    const id = 'exp_' + Date.now();
    setState(s => ({ ...s, manualExpenses: [...(s.manualExpenses || []), { ...expense, id }] }));
  };
  const deleteExpense = (id: string) => setState(s => ({ ...s, manualExpenses: (s.manualExpenses || []).filter(x => x.id !== id) }));

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

  const addLabourType = (type: string) => {
    setState(s => {
      if (s.labourTypes.includes(type.toLowerCase())) return s;
      return { ...s, labourTypes: [...s.labourTypes, type.toLowerCase()] };
    });
  };

  const removeLabourType = (type: string) => {
    setState(s => ({ ...s, labourTypes: s.labourTypes.filter(t => t !== type) }));
  };

  const addPaymentStageMaster = (stage: string) => {
    setState(prev => ({
      ...prev,
      paymentStageMaster: [...prev.paymentStageMaster, stage]
    }));
  };

  const removePaymentStageMaster = (stage: string) => {
    setState(prev => ({
      ...prev,
      paymentStageMaster: prev.paymentStageMaster.filter(s => s !== stage)
    }));
  };

  const addStageCompletionRequest = (request: Omit<StageCompletionRequest, 'id'>) => {
    const newRequest: StageCompletionRequest = {
      ...request,
      id: `scr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    };
    setState(s => ({
      ...s,
      stageCompletionRequests: [newRequest, ...(s.stageCompletionRequests || [])]
    }));
  };

  const updateStageCompletionRequest = (id: string, updates: Partial<StageCompletionRequest>) => {
    setState(s => ({
      ...s,
      stageCompletionRequests: (s.stageCompletionRequests || []).map(r => r.id === id ? { ...r, ...updates } : r)
    }));
  };

  const addMaterialRental = (rental: Omit<MaterialRental, 'id' | 'createdAt'>) => {
    const newRental: MaterialRental = {
      ...rental,
      id: `rent_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setState(s => ({
      ...s,
      materialRentals: [newRental, ...(s.materialRentals || [])]
    }));
  };

  const updateMaterialRental = (id: string, updates: Partial<MaterialRental>) => {
    setState(s => ({
      ...s,
      materialRentals: (s.materialRentals || []).map(r => r.id === id ? { ...r, ...updates } : r)
    }));
  };

  const deleteMaterialRental = (id: string) => {
    setState(s => ({
      ...s,
      materialRentals: (s.materialRentals || []).filter(r => r.id !== id)
    }));
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
      addExpense, deleteExpense,
      addVendor, deleteVendor,
      addWorkEntry,
      saveAttendance,
      addMaterialSetting, updateMaterialSetting, deleteMaterialSetting,
      materialRentals: state.materialRentals || [],
      addMaterialRental, updateMaterialRental, deleteMaterialRental,
      addSupplier, updateSupplier, deleteSupplier,
      addVehicle, updateVehicle, deleteVehicle,
      addMaterialRequest, updateMaterialRequest, deleteMaterialRequest,
      assignMaterialRequest, completeMaterialRequest,
      addLabourType, removeLabourType,
      addPaymentStageMaster, removePaymentStageMaster,
      stageCompletionRequests: state.stageCompletionRequests || [],
      addStageCompletionRequest, updateStageCompletionRequest,
      currentPortal, switchPortal,
      isBackendConnected, clearAllData, refreshFromBackend,
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
