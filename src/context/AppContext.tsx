import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Staff, Site, DailyLog, AppState, Customer, Product, Quotation, Invoice, Vendor, WorkEntry, Attendance, Supplier, MaterialRequest, Vehicle, VehicleMaintenanceRecord, MaterialRental, StageCompletionRequest, MaterialSetting } from '@/types';
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
  // Vehicle Maintenance
  addVehicleMaintenance: (rec: Omit<VehicleMaintenanceRecord, 'id' | 'createdAt'>) => void;
  updateVehicleMaintenance: (id: string, updates: Partial<VehicleMaintenanceRecord>) => void;
  deleteVehicleMaintenance: (id: string) => void;
  // Material Requests
  addMaterialRequest: (request: Omit<MaterialRequest, 'id' | 'status'>) => void;
  updateMaterialRequest: (id: string, updates: Partial<MaterialRequest>) => void;
  deleteMaterialRequest: (id: string) => void;
  assignMaterialRequest: (id: string, assignment: { driverId: string; driverName: string; supplierId: string; supplierName: string; vehicle?: string; vehicleNumber?: string; vehicleType?: string; startTime?: string; supplierPrice?: number; supplierPaidAmount?: number; supplierBalance?: number }) => void;
  completeMaterialRequest: (id: string, completion: {
    startTime?: string;
    endTime?: string;
    completionTime?: string;
    duration?: string;
    durationHours?: number;
    driverWage?: number;
    driverHourlyRate?: number;
    items?: import('@/types').MaterialRequestItem[];
    gstType?: 'none' | 'igst' | 'cgst_sgst';
    igstRate?: number;
    cgstRate?: number;
    sgstRate?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    gstAmount?: number;
    materialCost?: number;
    totalCost?: number;
    petrolCharge: number;
    completionNotes?: string;
    supplierPrice?: number;
    supplierMaterialCost?: number;
    clientMaterialCost?: number;
    customerMaterialCost?: number;
    clientTotalCost?: number;
    customerTotalCost?: number;
    supplierPaidAmount?: number;
    supplierBalance?: number;
  }) => void;
  // Master Data
  addLabourType: (type: string) => void;
  removeLabourType: (type: string) => void;
  addPaymentStageMaster: (stage: string) => void;
  removePaymentStageMaster: (stage: string) => void;
  // Units Master
  unitMaster: string[];
  addUnit: (unit: string) => void;
  removeUnit: (unit: string) => void;
  // Stage Completion Requests
  stageCompletionRequests: StageCompletionRequest[];
  addStageCompletionRequest: (request: Omit<StageCompletionRequest, 'id'>) => void;
  updateStageCompletionRequest: (id: string, updates: Partial<StageCompletionRequest>) => void;
  currentPortal: 'admin' | 'staff';
  switchPortal: (portal: 'admin' | 'staff') => void;
}

const ADMIN = { id: 'admin', name: 'JGS', phone: '0000000000', role: 'admin', password: 'jgsconstruction*$' };

export const DEFAULT_UNITS = ['Kg', 'Tons', 'Bags', 'Liters', 'Nos', 'Sets', 'Sq.Ft', 'Boxes', 'Meters', 'Loads', 'Units'];

export const DEFAULT_MATERIAL_SETTINGS: MaterialSetting[] = [
  { id: 'mat_cement', name: 'Cement Bag (50kg)', category: 'Masonry & Concrete', unit: 'Bags', defaultRate: 420 },
  { id: 'mat_msand', name: 'M-Sand (Manufactured Sand)', category: 'Civil & Structural', unit: 'Tons', defaultRate: 1200 },
  { id: 'mat_jalli', name: 'Jalli (Aggregate 20mm)', category: 'Civil & Structural', unit: 'Tons', defaultRate: 950 },
  { id: 'mat_redbricks', name: 'Red Bricks', category: 'Masonry & Concrete', unit: 'Nos', defaultRate: 9 },
  { id: 'mat_blocks', name: 'Solid Concrete Blocks (6")', category: 'Masonry & Concrete', unit: 'Nos', defaultRate: 42 },
  { id: 'mat_steel', name: 'Steel TMT Bars (12mm)', category: 'Civil & Structural', unit: 'Kg', defaultRate: 68 },
  { id: 'mat_paint_white', name: 'Interior Paint (White)', category: 'Paints & Finishing', unit: 'Liters', defaultRate: 280 },
  { id: 'mat_putty', name: 'Wall Putty (40kg)', category: 'Paints & Finishing', unit: 'Bags', defaultRate: 750 },
  { id: 'mat_primer', name: 'Exterior / Interior Primer', category: 'Paints & Finishing', unit: 'Liters', defaultRate: 220 },
  { id: 'mat_pvc', name: 'PVC Drainage Pipes (4")', category: 'Plumbing & Sanitary', unit: 'Nos', defaultRate: 480 },
  { id: 'mat_cpvc', name: 'CPVC Water Pipes (1")', category: 'Plumbing & Sanitary', unit: 'Nos', defaultRate: 320 },
  { id: 'mat_wire_15', name: 'Copper Wire (1.5 sq mm)', category: 'Electrical & Wiring', unit: 'Boxes', defaultRate: 1650 },
  { id: 'mat_conduit', name: 'Electrical Conduit Pipes (25mm)', category: 'Electrical & Wiring', unit: 'Nos', defaultRate: 90 },
  { id: 'mat_plywood', name: 'Plywood Sheet (18mm)', category: 'Carpentry & Woodwork', unit: 'Nos', defaultRate: 2200 },
  { id: 'mat_scaffolding', name: 'Scaffolding Pipes & Clamps', category: 'Scaffolding & Rental Tools', unit: 'Sets', defaultRate: 150, isRental: true, rentalRatePerDay: 50 },
  { id: 'mat_mixer', name: 'Concrete Mixer Machine', category: 'Scaffolding & Rental Tools', unit: 'Units', defaultRate: 5000, isRental: true, rentalRatePerDay: 800 },
];

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
  materialSettings: DEFAULT_MATERIAL_SETTINGS,
  suppliers: [],
  vehicles: [],
  vehicleMaintenance: [],
  materialRequests: [],
  labourTypes: ['painter', 'plumber', 'electrician', 'labour'],
  paymentStageMaster: ['Level 1: Foundation', 'Level 2: Ground Floor Slab', 'Level 3: Plastering', 'Level 4: Finishing & Handover'],
  unitMaster: DEFAULT_UNITS,
  materialRentals: [],
  stageCompletionRequests: [],
  currentUser: null,
};

function sanitizeDailyLogs(logs: any[]): any[] {
  if (!Array.isArray(logs)) return [];
  const cleaned = logs.map(l => {
    const cleanedExpenses = (l.expenses || []).filter((e: any) => !(e.itemName?.toLowerCase() === 'bike' && e.amount === 5));
    const isLegacyBikeCost = (l.transportCost === 5 && (l.transportMode === 'bike' || !l.transportMode));
    const cleanedTransportCost = isLegacyBikeCost ? 0 : (l.transportCost || 0);
    return {
      ...l,
      expenses: cleanedExpenses,
      transportCost: cleanedTransportCost,
      transportMode: cleanedTransportCost > 0 ? l.transportMode : undefined,
    };
  });

  // Consolidate into 1 daily log per site per date
  const uniqueSiteDateMap = new Map<string, any>();
  for (const log of cleaned) {
    const key = `${log.siteId || log.siteName}_${log.date}`;
    if (!uniqueSiteDateMap.has(key)) {
      uniqueSiteDateMap.set(key, log);
    } else {
      const existing = uniqueSiteDateMap.get(key);
      const combinedExpenses = [
        ...(existing.expenses || []),
        ...(log.expenses || []).filter((e2: any) =>
          !(existing.expenses || []).some((e1: any) => e1.itemName === e2.itemName && e1.amount === e2.amount)
        )
      ];
      const combinedMaterials = [
        ...(existing.materials || []),
        ...(log.materials || []).filter((m2: any) =>
          !(existing.materials || []).some((m1: any) => m1.name === m2.name)
        )
      ];
      const combinedWorkerIds = Array.from(new Set([...(existing.workerIds || []), ...(log.workerIds || [])]));
      const combinedNotes = [existing.notes, log.notes]
        .filter(Boolean)
        .filter((n, idx, arr) => arr.indexOf(n) === idx)
        .join(' · ');

      uniqueSiteDateMap.set(key, {
        ...existing,
        incomeFromClient: Math.max(existing.incomeFromClient || 0, log.incomeFromClient || 0),
        workLevelStage: log.workLevelStage || existing.workLevelStage,
        expenses: combinedExpenses,
        materials: combinedMaterials,
        notes: combinedNotes,
        workerIds: combinedWorkerIds,
      });
    }
  }

  return Array.from(uniqueSiteDateMap.values());
}

function getStoredUser() {
  try {
    const sessionUser = sessionStorage.getItem('edamari_current_user');
    if (sessionUser) return JSON.parse(sessionUser);
    // Migrate legacy localStorage user once to this tab session and clear from localStorage
    const localUser = localStorage.getItem('edamari_current_user');
    if (localUser) {
      sessionStorage.setItem('edamari_current_user', localUser);
      localStorage.removeItem('edamari_current_user');
      return JSON.parse(localUser);
    }
  } catch {}
  return null;
}

function mergeById<T extends { id?: string; key?: string }>(backendItems: T[] | undefined, localItems: T[] | undefined): T[] {
  const bList = Array.isArray(backendItems) ? backendItems : [];
  const lList = Array.isArray(localItems) ? localItems : [];
  if (bList.length === 0) return lList;
  if (lList.length === 0) return bList;
  const map = new Map<string, T>();
  lList.forEach(item => {
    const k = item?.id || item?.key;
    if (k) map.set(k, item);
  });
  bList.forEach(item => {
    const k = item?.id || item?.key;
    if (k) {
      const existing = map.get(k);
      if (existing) {
        map.set(k, {
          ...existing,
          ...item,
          createdAt: (item as any).createdAt || (existing as any).createdAt
        });
      } else {
        map.set(k, item);
      }
    }
  });
  return Array.from(map.values());
}

function loadState(): AppState {
  const savedUser = getStoredUser();

  try {
    const saved = localStorage.getItem('edamari_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.staffList)) {
        parsed.staffList = parsed.staffList.filter((s: any) => s.id !== 'staff_1772771203700');
      }
      if (Array.isArray(parsed.sites)) {
        parsed.sites = parsed.sites.filter((s: any) => s.id !== 'site_1772771203701');
      }

      return {
        ...defaultState,
        ...parsed,
        materialSettings: Array.isArray(parsed.materialSettings) && parsed.materialSettings.length > 0 ? parsed.materialSettings : DEFAULT_MATERIAL_SETTINGS,
        vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [],
        vehicleMaintenance: Array.isArray(parsed.vehicleMaintenance) ? parsed.vehicleMaintenance : [],
        dailyLogs: sanitizeDailyLogs(parsed.dailyLogs || []),
        unitMaster: parsed.unitMaster && parsed.unitMaster.length > 0 ? parsed.unitMaster : DEFAULT_UNITS,
        currentUser: savedUser,
      };
    }
  } catch { }
  return { ...defaultState, currentUser: savedUser };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [currentPortal, setCurrentPortal] = useState<'admin' | 'staff'>(() => {
    const u = getStoredUser();
    return u?.role === 'staff' ? 'staff' : 'admin';
  });
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState<boolean>(false);
  const lastSyncedDataRef = useRef<string>('');
  const deletedItemsRef = useRef<Record<string, string[]>>({});
  const syncChannelRef = useRef<BroadcastChannel | null>(null);

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
            const activeUser = getStoredUser();
            setState(prev => {
              const mergedStaffList = mergeById(backendState.staffList, prev.staffList);
              const latestStaff = activeUser && activeUser.id !== 'admin'
                ? mergedStaffList.find((st: Staff) => st.id === activeUser.id)
                : null;
              const syncedUser = latestStaff
                ? {
                    ...activeUser,
                    name: latestStaff.name || activeUser.name,
                    role: latestStaff.role === 'admin' ? ('admin' as const) : ('staff' as const),
                    adminPermissions: latestStaff.adminPermissions
                  }
                : activeUser;

              const merged: AppState = {
                ...prev,
                ...backendState,
                staffList: mergedStaffList,
                sites: mergeById(backendState.sites, prev.sites),
                customers: mergeById(backendState.customers, prev.customers),
                products: mergeById(backendState.products, prev.products),
                quotations: mergeById(backendState.quotations, prev.quotations),
                manualExpenses: mergeById(backendState.manualExpenses, prev.manualExpenses),
                vendors: mergeById(backendState.vendors, prev.vendors),
                workEntries: mergeById(backendState.workEntries, prev.workEntries),
                dailyLogs: sanitizeDailyLogs(mergeById(backendState.dailyLogs, prev.dailyLogs)),
                attendances: mergeById(backendState.attendances, prev.attendances),
                suppliers: mergeById(backendState.suppliers, prev.suppliers),
                vehicles: mergeById(backendState.vehicles, prev.vehicles),
                vehicleMaintenance: mergeById(backendState.vehicleMaintenance, prev.vehicleMaintenance),
                materialRequests: mergeById(backendState.materialRequests, prev.materialRequests),
                materialRentals: mergeById(backendState.materialRentals, prev.materialRentals),
                stageCompletionRequests: mergeById(backendState.stageCompletionRequests, prev.stageCompletionRequests),
                materialSettings: Array.isArray(backendState.materialSettings) && backendState.materialSettings.length > 0
                  ? backendState.materialSettings
                  : (prev.materialSettings && prev.materialSettings.length > 0 ? prev.materialSettings : DEFAULT_MATERIAL_SETTINGS),
                unitMaster: backendState.unitMaster && backendState.unitMaster.length > 0 ? backendState.unitMaster : (prev.unitMaster || DEFAULT_UNITS),
                currentUser: syncedUser || prev.currentUser,
              };
              const { currentUser: _, ...dataOnly } = merged;
              lastSyncedDataRef.current = JSON.stringify(dataOnly);
              return merged;
            });
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

  // 2. Persist to Backend & localStorage on actual state changes (debounced to avoid UI freeze while typing)
  useEffect(() => {
    if (!isInitialLoadDone) return;

    const timeout = setTimeout(() => {
      try {
        localStorage.setItem('edamari_data', JSON.stringify(state));
      } catch (err) {
        console.warn('Failed to save to localStorage:', err);
      }

      const { currentUser, ...dataToSync } = state;
      const serialized = JSON.stringify(dataToSync);

      // Broadcast state update to other tabs
      try {
        syncChannelRef.current?.postMessage({
          type: 'STATE_UPDATE',
          payload: dataToSync,
        });
      } catch {}

      // Prevent redundant sync loop if payload has not changed
      if (lastSyncedDataRef.current === serialized && Object.keys(deletedItemsRef.current).length === 0) {
        return;
      }

      const payload = {
        ...dataToSync,
        deletedItems: { ...deletedItemsRef.current }
      };
      deletedItemsRef.current = {};

      api.syncAppState(payload)
        .then(() => {
          lastSyncedDataRef.current = serialized;
          setIsBackendConnected(true);
        })
        .catch(err => {
          console.warn('Failed to sync changes with backend:', err);
          setIsBackendConnected(false);
        });
    }, 400);

    return () => clearTimeout(timeout);
  }, [
    state.staffList, state.sites, state.dailyLogs, state.customers,
    state.products, state.quotations, state.manualExpenses, state.vendors,
    state.workEntries, state.attendances, state.materialSettings,
    state.suppliers, state.vehicles, state.vehicleMaintenance, state.materialRequests,
    state.labourTypes, state.paymentStageMaster, state.unitMaster, state.materialRentals,
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
        const { currentUser: _, ...dataOnly } = backendState;
        lastSyncedDataRef.current = JSON.stringify(dataOnly);
        setState(prev => ({ ...prev, ...backendState, currentUser: prev.currentUser }));
        setIsBackendConnected(true);
      }
    } catch (err) {
      console.error('Refresh from backend failed:', err);
    }
  };

  // 3. Real-time Multi-Tab Sync (preserves each tab's unique user session)
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('jgs_multi_tab_sync');
        syncChannelRef.current = channel;
        channel.onmessage = (event) => {
          if (event.data?.type === 'STATE_UPDATE' && event.data.payload) {
            const payload = event.data.payload;
            lastSyncedDataRef.current = JSON.stringify(payload);
            setState(prev => ({
              ...prev,
              ...payload,
              currentUser: prev.currentUser, // Keep this tab's own user!
            }));
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel failed to initialize:', err);
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'edamari_data' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const { currentUser: _, ...dataOnly } = parsed;
          lastSyncedDataRef.current = JSON.stringify(dataOnly);
          setState(prev => ({
            ...prev,
            ...parsed,
            currentUser: prev.currentUser, // Keep this tab's own user!
          }));
        } catch (err) {
          console.error('Error syncing data from storage event:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) {
        channel.close();
        syncChannelRef.current = null;
      }
    };
  }, []);

  const login = (id: string, password: string): boolean => {
    const input = id.trim().toLowerCase();
    if ((input === 'jgs' || input === 'admin') && (password === 'jgsconstruction*$' || password === 'admin123')) {
      const user = { id: 'admin', name: 'JGS', role: 'admin' as const, adminPermissions: [] };
      sessionStorage.setItem('edamari_current_user', JSON.stringify(user));
      localStorage.removeItem('edamari_current_user');
      setState(s => ({ ...s, currentUser: user }));
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
      const user = { id: staff.id, name: staff.name, role: userRole as 'admin' | 'staff', adminPermissions: staff.adminPermissions };
      sessionStorage.setItem('edamari_current_user', JSON.stringify(user));
      localStorage.removeItem('edamari_current_user');
      setState(s => ({ ...s, currentUser: user }));
      setCurrentPortal(userRole === 'admin' ? 'admin' : 'staff');
      return true;
    }
    return false;
  };

  const logout = () => {
    sessionStorage.removeItem('edamari_current_user');
    localStorage.removeItem('edamari_current_user');
    setState(s => ({ ...s, currentUser: null }));
    // Clear Google Translate cookie to prevent admin page from translating
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const markDeleted = (resourceKey: string, id: string) => {
    if (!deletedItemsRef.current[resourceKey]) {
      deletedItemsRef.current[resourceKey] = [];
    }
    deletedItemsRef.current[resourceKey].push(id);
  };

  const addStaff = (staff: Omit<Staff, 'id'>) => {
    const id = 'staff_' + Date.now();
    setState(s => ({ ...s, staffList: [...s.staffList, { ...staff, id }] }));
  };
  const deleteStaff = (id: string) => {
    markDeleted('staffList', id);
    setState(s => ({ ...s, staffList: s.staffList.filter(x => x.id !== id) }));
  };
  const updateStaff = (id: string, updates: Partial<Staff>) =>
    setState(s => {
      const updatedStaffList = s.staffList.map(x => x.id === id ? { ...x, ...updates } : x);
      let updatedCurrentUser = s.currentUser;
      if (s.currentUser && s.currentUser.id === id) {
        updatedCurrentUser = {
          ...s.currentUser,
          name: updates.name !== undefined ? updates.name : s.currentUser.name,
          role: updates.role === 'admin' ? 'admin' : (updates.role ? 'staff' : s.currentUser.role),
          adminPermissions: updates.adminPermissions !== undefined ? updates.adminPermissions : s.currentUser.adminPermissions,
        };
        sessionStorage.setItem('edamari_current_user', JSON.stringify(updatedCurrentUser));
      }
      return {
        ...s,
        staffList: updatedStaffList,
        currentUser: updatedCurrentUser
      };
    });

  const addSite = (site: Omit<Site, 'id'>) => {
    const id = 'site_' + Date.now();
    setState(s => ({ ...s, sites: [...s.sites, { ...site, id }] }));
  };
  const deleteSite = (id: string) => {
    markDeleted('sites', id);
    setState(s => ({ ...s, sites: s.sites.filter(x => x.id !== id) }));
  };
  const updateSite = (id: string, updates: Partial<Site>) =>
    setState(s => ({ ...s, sites: s.sites.map(x => x.id === id ? { ...x, ...updates } : x) }));

  const addDailyLog = (log: Omit<DailyLog, 'id'>) => {
    setState(prev => {
      let updatedSites = prev.sites;
      if (log.siteId && !prev.sites.some(s => s.id === log.siteId)) {
        const autoSite: Site = {
          id: log.siteId,
          name: log.siteName || 'Custom Site Visit',
          clientName: 'Site Visit / Field Work',
          address: log.siteName || 'External Site',
          status: 'active',
          budget: 0,
          paymentStages: [
            {
              stageName: log.workLevelStage || 'General Site Work',
              expectedAmount: 0,
              paidAmount: 0,
              payments: [],
              completionStatus: 'in_progress',
            }
          ],
          assignedStaffIds: log.staffId ? [log.staffId] : [],
          supervisorId: log.staffId || '',
          startDate: log.date || format(new Date(), 'yyyy-MM-dd'),
        };
        updatedSites = [...prev.sites, autoSite];
      }

      // Check if a daily log already exists for this site and date
      const existingIndex = prev.dailyLogs.findIndex(l =>
        ((l.siteId && log.siteId && l.siteId === log.siteId) ||
         (l.siteName && log.siteName && l.siteName.trim().toLowerCase() === log.siteName.trim().toLowerCase())) &&
        l.date === log.date
      );

      if (existingIndex >= 0) {
        const existing = prev.dailyLogs[existingIndex];
        const combinedExpenses = [
          ...(existing.expenses || []),
          ...(log.expenses || []).filter(e2 =>
            !(existing.expenses || []).some(e1 => e1.itemName === e2.itemName && e1.amount === e2.amount)
          )
        ];
        const combinedMaterials = [
          ...(existing.materials || []),
          ...(log.materials || []).filter(m2 =>
            !(existing.materials || []).some(m1 => m1.name === m2.name)
          )
        ];
        const combinedWorkerIds = Array.from(new Set([...(existing.workerIds || []), ...(log.workerIds || [])]));
        const combinedNotes = [existing.notes, log.notes]
          .filter(Boolean)
          .filter((n, idx, arr) => arr.indexOf(n) === idx)
          .join(' · ');

        const mergedLog: DailyLog = {
          ...existing,
          ...log,
          id: existing.id,
          incomeFromClient: Math.max(existing.incomeFromClient || 0, log.incomeFromClient || 0),
          workLevelStage: log.workLevelStage || existing.workLevelStage,
          expenses: combinedExpenses,
          materials: combinedMaterials,
          notes: combinedNotes,
          workerIds: combinedWorkerIds,
          workerCounts: log.workerCounts && Object.values(log.workerCounts).some(v => (Number(v) || 0) > 0)
            ? log.workerCounts
            : existing.workerCounts,
        };

        const updatedDailyLogs = [...prev.dailyLogs];
        updatedDailyLogs[existingIndex] = mergedLog;

        return {
          ...prev,
          sites: updatedSites,
          dailyLogs: updatedDailyLogs,
        };
      }

      return {
        ...prev,
        sites: updatedSites,
        dailyLogs: [...prev.dailyLogs, { ...log, id: `log_${Date.now()}` }]
      };
    });
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
  const deleteCustomer = (id: string) => {
    markDeleted('customers', id);
    setState(s => ({ ...s, customers: s.customers.filter(x => x.id !== id) }));
  };
  const updateCustomer = (id: string, updates: Partial<Customer>) =>
    setState(s => ({ ...s, customers: s.customers.map(x => x.id === id ? { ...x, ...updates } : x) }));

  const addProduct = (product: Omit<Product, 'id'>) => {
    const id = 'prod_' + Date.now();
    setState(s => ({ ...s, products: [...s.products, { ...product, id }] }));
  };
  const deleteProduct = (id: string) => {
    markDeleted('products', id);
    setState(s => ({ ...s, products: s.products.filter(x => x.id !== id) }));
  };

  const addQuotation = (quotation: Omit<Quotation, 'id' | 'quotationNumber' | 'createdAt'>) => {
    const id = 'quot_' + Date.now();
    const quotationNumber = 'QT-' + String(state.quotations.length + 1).padStart(4, '0');
    setState(s => ({ ...s, quotations: [...s.quotations, { ...quotation, id, quotationNumber, createdAt: new Date().toISOString() }] }));
  };
  const updateQuotation = (id: string, updates: Partial<Quotation>) =>
    setState(s => ({ ...s, quotations: s.quotations.map(x => x.id === id ? { ...x, ...updates } : x) }));
  const deleteQuotation = (id: string) => {
    markDeleted('quotations', id);
    setState(s => ({ ...s, quotations: s.quotations.filter(x => x.id !== id) }));
  };

  const addExpense = (expense: Omit<import('@/types').ManualExpense, 'id'>) => {
    const id = 'exp_' + Date.now();
    setState(s => ({ ...s, manualExpenses: [...(s.manualExpenses || []), { ...expense, id }] }));
  };
  const deleteExpense = (id: string) => {
    markDeleted('manualExpenses', id);
    setState(s => ({ ...s, manualExpenses: (s.manualExpenses || []).filter(x => x.id !== id) }));
  };

  const addVendor = (vendor: Omit<Vendor, 'id'>) => {
    const id = 'vend_' + Date.now();
    setState(s => ({ ...s, vendors: [...s.vendors, { ...vendor, id }] }));
  };
  const deleteVendor = (id: string) => {
    markDeleted('vendors', id);
    setState(s => ({ ...s, vendors: s.vendors.filter(x => x.id !== id) }));
  };

  const addWorkEntry = (entry: Omit<WorkEntry, 'id'>) => {
    const id = 'work_' + Date.now();
    setState(s => ({ ...s, workEntries: [...s.workEntries, { ...entry, id }] }));
  };

  const saveAttendance = (data: Omit<Attendance, 'id'> & { id?: string }) => {
    setState(s => {
      const exists = s.attendances.find(a => a.staffId === data.staffId && a.date === data.date);
      let updatedAttendances: Attendance[];
      const attId = exists?.id || data.id || `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      if (exists) {
        updatedAttendances = s.attendances.map(a => a.id === exists.id ? { ...a, ...data, id: exists.id } : a);
      } else {
        updatedAttendances = [{ ...data, id: attId }, ...s.attendances];
      }

      // Automatically sync supervisor attendance expense to site's manualExpenses
      const expId = `att_exp_${data.staffId}_${data.date}`;
      const effectiveSiteId = data.siteId || (exists ? exists.siteId : undefined);
      const effectiveExpense = data.expenseAmount !== undefined ? data.expenseAmount : (exists?.expenseAmount || 0);
      const effectiveNotes = data.expenseNotes !== undefined ? data.expenseNotes : (exists?.expenseNotes || '');

      let newManualExpenses = [...(s.manualExpenses || [])];
      if (effectiveSiteId && effectiveExpense > 0) {
        const staffObj = s.staffList.find(st => st.id === data.staffId);
        const staffName = staffObj?.name || 'Supervisor';
        const siteObj = s.sites.find(st => st.id === effectiveSiteId);
        const siteName = siteObj?.name || data.siteName || 'Site';

        const activeStage = siteObj?.paymentStages?.find(ps => ps.completionStatus === 'in_progress')
          || siteObj?.paymentStages?.find(ps => ps.completionStatus !== 'completed')
          || siteObj?.paymentStages?.[0];

        const effectivePaymentMethod = data.expensePaymentMethod !== undefined ? data.expensePaymentMethod : (exists?.expensePaymentMethod || 'Cash');

        const expItem: ManualExpense = {
          id: expId,
          siteId: effectiveSiteId,
          siteName: siteName,
          date: data.date,
          amount: effectiveExpense,
          category: 'Supervisor Attendance Expense',
          description: effectiveNotes ? `${effectiveNotes} (${staffName})` : `Supervisor Attendance Expense - ${staffName}`,
          workLevelStage: activeStage?.stageName || '',
          paymentMethod: effectivePaymentMethod
        };
        const existsExpIndex = newManualExpenses.findIndex(e => e.id === expId);
        if (existsExpIndex >= 0) {
          newManualExpenses[existsExpIndex] = expItem;
        } else {
          newManualExpenses.push(expItem);
        }
      } else {
        newManualExpenses = newManualExpenses.filter(e => e.id !== expId);
      }

      return {
        ...s,
        attendances: updatedAttendances,
        manualExpenses: newManualExpenses
      };
    });
  };

  const addMaterialSetting = (setting: Omit<import('@/types').MaterialSetting, 'id'>) => {
    setState(s => ({ ...s, materialSettings: [{ ...setting, id: `ms_${Date.now()}` }, ...s.materialSettings] }));
  };

  const updateMaterialSetting = (id: string, updates: Partial<import('@/types').MaterialSetting>) => {
    setState(s => ({ ...s, materialSettings: s.materialSettings.map(m => m.id === id ? { ...m, ...updates } : m) }));
  };

  const deleteMaterialSetting = (id: string) => {
    markDeleted('materialSettings', id);
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
    markDeleted('suppliers', id);
    setState(s => ({ ...s, suppliers: s.suppliers.filter(sup => sup.id !== id) }));
  };

  // Vehicles
  const addVehicle = (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => {
    const id = `veh_${Date.now()}`;
    const createdAt = new Date().toISOString();
    const newVehicle: Vehicle = {
      id,
      name: vehicle.name.trim(),
      number: vehicle.number.trim(),
      type: vehicle.type || 'Pickup',
      status: vehicle.status || 'Active',
      fuelType: vehicle.fuelType || 'Diesel',
      assignedDriverId: vehicle.assignedDriverId || '',
      assignedDriverName: vehicle.assignedDriverName || '',
      odometer: Number(vehicle.odometer) || 0,
      insuranceExpiry: vehicle.insuranceExpiry || '',
      fitnessExpiry: vehicle.fitnessExpiry || '',
      notes: vehicle.notes || '',
      createdAt,
    };
    setState(s => ({ ...s, vehicles: [newVehicle, ...(s.vehicles || [])] }));
  };

  const updateVehicle = (id: string, updates: Partial<Vehicle>) => {
    setState(s => ({ ...s, vehicles: (s.vehicles || []).map(v => v.id === id ? { ...v, ...updates } : v) }));
  };

  const deleteVehicle = (id: string) => {
    markDeleted('vehicles', id);
    setState(s => ({ ...s, vehicles: (s.vehicles || []).filter(v => v.id !== id) }));
  };

  // Vehicle Maintenance
  const addVehicleMaintenance = (rec: Omit<VehicleMaintenanceRecord, 'id' | 'createdAt'>) => {
    const id = `vm_${Date.now()}`;
    const createdAt = new Date().toISOString();
    const newRecord: VehicleMaintenanceRecord = {
      ...rec,
      id,
      createdAt,
    };
    setState(s => {
      // Also if odometer is provided and higher, optionally update vehicle's odometer
      const updatedVehicles = (s.vehicles || []).map(v => {
        if (v.id === rec.vehicleId && rec.odometerReading && Number(rec.odometerReading) > (v.odometer || 0)) {
          return { ...v, odometer: Number(rec.odometerReading) };
        }
        return v;
      });
      return {
        ...s,
        vehicles: updatedVehicles,
        vehicleMaintenance: [newRecord, ...(s.vehicleMaintenance || [])]
      };
    });
  };

  const updateVehicleMaintenance = (id: string, updates: Partial<VehicleMaintenanceRecord>) => {
    setState(s => ({
      ...s,
      vehicleMaintenance: (s.vehicleMaintenance || []).map(m => m.id === id ? { ...m, ...updates } : m)
    }));
  };

  const deleteVehicleMaintenance = (id: string) => {
    markDeleted('vehicleMaintenance', id);
    setState(s => ({
      ...s,
      vehicleMaintenance: (s.vehicleMaintenance || []).filter(m => m.id !== id)
    }));
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
    markDeleted('materialRequests', id);
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
    endTime?: string;
    completionTime?: string;
    duration?: string;
    durationHours?: number;
    driverWage?: number;
    driverHourlyRate?: number;
    items?: import('@/types').MaterialRequestItem[];
    gstType?: 'none' | 'igst' | 'cgst_sgst';
    igstRate?: number;
    cgstRate?: number;
    sgstRate?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    gstAmount?: number;
    materialCost?: number;
    supplierPrice?: number;
    supplierMaterialCost?: number;
    clientMaterialCost?: number;
    customerMaterialCost?: number;
    totalCost?: number;
    clientTotalCost?: number;
    customerTotalCost?: number;
    petrolCharge: number;
    completionNotes?: string;
    supplierPaidAmount?: number;
    supplierBalance?: number;
  }) => {
    setState(s => {
      const targetReq = s.materialRequests.find(r => r.id === id);
      let updatedLogs = [...s.dailyLogs];

      if (targetReq && targetReq.sourceType === 'site' && targetReq.sourceSiteId) {
        const finalItems = completion.items || targetReq.items;
        const sourceSite = s.sites.find(site => site.id === targetReq.sourceSiteId);
        const destSite = s.sites.find(site => site.id === targetReq.siteId);
        const transferDate = format(new Date(), 'yyyy-MM-dd');
        const refTag = `(Transfer Ref #${targetReq.id})`;

        // Avoid duplicate logging if already recorded for this requisition, update existing if present
        const hasExisting = updatedLogs.some(l => l.notes?.includes(refTag));
        if (hasExisting) {
          updatedLogs = updatedLogs.map(log => {
            if (!log.notes?.includes(refTag)) return log;
            const isSource = log.siteId === targetReq.sourceSiteId;
            return {
              ...log,
              materials: finalItems.map(it => ({
                id: crypto.randomUUID(),
                name: `${it.name} (${isSource ? 'Transferred to' : 'Transferred from'} ${isSource ? (destSite?.name || 'Site') : (sourceSite?.name || 'Site')})`,
                quantity: isSource ? -Number(it.quantity) : Number(it.quantity),
                cost: Number(it.rate) || 0
              }))
            };
          });
        } else {
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
          const finalEnd = completion.endTime || completion.completionTime || mr.endTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const finalDuration = completion.duration || calculateDuration(finalStart, finalEnd);
          const finalItems = completion.items || mr.items;
          const computedMaterialCost = completion.materialCost !== undefined
            ? completion.materialCost
            : finalItems.reduce((sum, it) => sum + (Number(it.amount) || ((Number(it.quantity) || 0) * (Number(it.rate) || 0))), 0);
          const finalDriverWage = Number(completion.driverWage) || 0;
          const finalPetrol = Number(completion.petrolCharge) || 0;
          const computedTotalCost = completion.totalCost !== undefined
            ? completion.totalCost
            : (computedMaterialCost + finalDriverWage);

          const finalSupPrice = completion.supplierPrice !== undefined ? completion.supplierPrice : (completion.supplierMaterialCost !== undefined ? completion.supplierMaterialCost : (mr.supplierPrice || computedMaterialCost));
          const finalPaid = completion.supplierPaidAmount !== undefined ? completion.supplierPaidAmount : (mr.supplierPaidAmount || 0);
          const finalBal = completion.supplierBalance !== undefined ? completion.supplierBalance : Math.max(0, finalSupPrice - finalPaid);

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
            supplierPrice: finalSupPrice,
            supplierMaterialCost: completion.supplierMaterialCost !== undefined ? completion.supplierMaterialCost : finalSupPrice,
            supplierPaidAmount: finalPaid,
            supplierBalance: finalBal,
            status: 'completed',
            completedAt: mr.completedAt || new Date().toISOString()
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

  const addUnit = (unit: string) => {
    const trimmed = unit.trim();
    if (!trimmed) return;
    setState(s => {
      const list = s.unitMaster || DEFAULT_UNITS;
      if (list.some(u => u.toLowerCase() === trimmed.toLowerCase())) return s;
      return { ...s, unitMaster: [...list, trimmed] };
    });
  };

  const removeUnit = (unit: string) => {
    setState(s => ({
      ...s,
      unitMaster: (s.unitMaster || DEFAULT_UNITS).filter(u => u.toLowerCase() !== unit.toLowerCase())
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
    markDeleted('materialRentals', id);
    setState(s => ({
      ...s,
      materialRentals: (s.materialRentals || []).filter(r => r.id !== id)
    }));
  };

  return (
    <AppContext.Provider value={{
      ...state,
      unitMaster: state.unitMaster || DEFAULT_UNITS,
      addUnit, removeUnit,
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
      vehicles: state.vehicles || [],
      addVehicle, updateVehicle, deleteVehicle,
      vehicleMaintenance: state.vehicleMaintenance || [],
      addVehicleMaintenance, updateVehicleMaintenance, deleteVehicleMaintenance,
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
