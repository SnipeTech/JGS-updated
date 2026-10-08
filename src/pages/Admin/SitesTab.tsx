import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, MapPin, Users, TrendingUp, TrendingDown, IndianRupee,
  Building2, CheckCircle2, Clock, Send, Truck, Package,
  CalendarDays, Banknote, ArrowRightLeft, AlertCircle, Layers, UserCircle, Trash2, FileDown,
  Receipt, FileText, ChevronDown, ChevronUp, RefreshCw, PenLine, Wallet, Warehouse
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Material, MaterialRequest, MaterialRental, Site } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getSiteAvailableStock } from '@/lib/utils';
import { AssignMaterialModal, CompleteMaterialModal } from './LogisticsModals';
import { SitePaymentMilestones } from './SitePaymentMilestones';
import { getLabourTypeMeta } from '../Staff/StaffAttendanceTab';

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    active: 'badge-success',
    'on-hold': 'badge-gold',
    completed: 'badge-neutral',
    pending: 'badge-gold',
    partial: 'badge-gold',
    paid: 'badge-success',
  };
  return map[status] ?? 'badge-neutral';
};

// ── Site Detail View ──────────────────────────────────────
export const SiteDetailView = ({ siteId, onBack }: { siteId: string; onBack: () => void }) => {
  const {
    sites, dailyLogs, updateSite, deleteSite, addDailyLog, updateDailyLog, currentUser, staffList, attendances,
    materialRequests, materialSettings, suppliers, vehicles, assignMaterialRequest, completeMaterialRequest, addMaterialRequest, paymentStageMaster,
    materialRentals, addMaterialRental, updateMaterialRental, deleteMaterialRental,
    stageCompletionRequests, updateStageCompletionRequest,
    manualExpenses, storeRoomDispatches
  } = useApp();
  const fallbackSite: Site = useMemo(() => ({
    id: siteId,
    name: 'Site Detail',
    clientName: 'Field Visit',
    address: '',
    status: 'active',
    budget: 0,
    paymentStages: [],
    assignedStaffIds: [],
    supervisorId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
  }), [siteId]);
  const site = sites.find(s => s.id === siteId) || fallbackSite;
  const today = format(new Date(), 'yyyy-MM-dd');

  // Helper to determine if a rental belongs to this site
  const isRentalForSite = (r: MaterialRental) => {
    if (!r) return false;
    if (r.siteId && (r.siteId === siteId || String(r.siteId) === String(siteId) || (site?.id && String(r.siteId) === String(site.id)))) return true;
    if (r.siteName && site?.name && r.siteName.trim().toLowerCase() === site.name.trim().toLowerCase()) return true;
    return false;
  };

  const [siteRentalFilter, setSiteRentalFilter] = useState<'all' | 'active' | 'returned'>('all');
  const [siteRentalSearch, setSiteRentalSearch] = useState('');

  // Rentals for this site
  const siteRentals = useMemo(() => {
    return (materialRentals || [])
      .filter(r => isRentalForSite(r))
      .sort((a, b) => new Date(b.startDate + 'T00:00:00').getTime() - new Date(a.startDate + 'T00:00:00').getTime());
  }, [materialRentals, siteId, site?.name, site?.id]);

  const activeSiteRentals = useMemo(() => {
    return siteRentals.filter(r => r.status === 'active');
  }, [siteRentals]);

  const returnedSiteRentals = useMemo(() => {
    return siteRentals.filter(r => r.status === 'returned');
  }, [siteRentals]);

  const displayedSiteRentals = useMemo(() => {
    let list = siteRentals;
    if (siteRentalFilter === 'active') list = activeSiteRentals;
    else if (siteRentalFilter === 'returned') list = returnedSiteRentals;
    if (siteRentalSearch.trim()) {
      const q = siteRentalSearch.toLowerCase().trim();
      list = list.filter(r => 
        (r.materialName || '').toLowerCase().includes(q) ||
        (r.driverName || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [siteRentals, activeSiteRentals, returnedSiteRentals, siteRentalFilter, siteRentalSearch]);

  const siteStoreRoomDispatches = useMemo(() => {
    return (storeRoomDispatches || [])
      .filter(d => 
        (d.siteId && (d.siteId === siteId || String(d.siteId) === String(siteId))) ||
        (site?.name && d.siteName && d.siteName.trim().toLowerCase() === site.name.trim().toLowerCase())
      )
      .sort((a, b) => new Date((b.deliveryDate || b.startDate || b.date || today) + 'T00:00:00').getTime() - new Date((a.deliveryDate || a.startDate || a.date || today) + 'T00:00:00').getTime());
  }, [storeRoomDispatches, siteId, site?.name, today]);

  // Site Rental Deploy Modal State
  const [showDeployRental, setShowDeployRental] = useState(false);
  const [rentalMatId, setRentalMatId] = useState('');
  const [rentalMatName, setRentalMatName] = useState('');
  const [rentalStartDate, setRentalStartDate] = useState(today);
  const [rentalQuantity, setRentalQuantity] = useState('1');
  const [rentalUnit, setRentalUnit] = useState('Sets');
  const [rentalRatePerDay, setRentalRatePerDay] = useState('');
  const [rentalRequiresDriver, setRentalRequiresDriver] = useState(false);
  const [rentalDriverId, setRentalDriverId] = useState('');
  const [rentalVehicleId, setRentalVehicleId] = useState('');
  const [rentalTransitCost, setRentalTransitCost] = useState('');
  const [rentalNotes, setRentalNotes] = useState('');

  // Return Rental Modal State
  const [returnRentalModal, setReturnRentalModal] = useState<{ open: boolean; rental: MaterialRental | null }>({
    open: false,
    rental: null
  });
  const [returnEndDate, setReturnEndDate] = useState(today);
  const [returnRatePerDay, setReturnRatePerDay] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  const handleSelectRentalPreset = (id: string) => {
    setRentalMatId(id);
    const setting = (materialSettings || []).find(m => m.id === id);
    if (setting) {
      setRentalMatName(setting.name);
      setRentalUnit(setting.unit || 'Sets');
      setRentalRatePerDay((setting.rentalRatePerDay || setting.defaultRate || '').toString());
    }
  };

  const handleDeployRentalToSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;
    const finalName = rentalMatName.trim();
    if (!finalName) { toast.error('Enter rental material name'); return; }
    const qty = Number(rentalQuantity) || 1;
    const rate = Number(rentalRatePerDay) || 0;
    const driverObj = rentalRequiresDriver ? staffList.find(s => s.id === rentalDriverId) : undefined;
    const vehObj = rentalRequiresDriver ? vehicles.find(v => v.id === rentalVehicleId) : undefined;

    addMaterialRental({
      materialId: rentalMatId || `m_${Date.now()}`,
      materialName: finalName,
      siteId: site.id,
      siteName: site.name,
      startDate: rentalStartDate || today,
      quantity: qty,
      unit: rentalUnit || 'Sets',
      requiresDriver: rentalRequiresDriver,
      driverId: driverObj?.id,
      driverName: driverObj?.name,
      vehicleId: vehObj?.id,
      vehicleNumber: vehObj?.number,
      transitCost: rentalRequiresDriver ? (Number(rentalTransitCost) || 0) : 0,
      rentalRatePerDay: rate,
      status: 'active',
      notes: rentalNotes.trim() || undefined
    });

    toast.success(`Deployed ${qty} ${rentalUnit} ${finalName} to ${site.name}!`);
    setShowDeployRental(false);
    setRentalMatId(''); setRentalMatName(''); setRentalQuantity('1');
    setRentalRatePerDay(''); setRentalRequiresDriver(false);
    setRentalDriverId(''); setRentalVehicleId(''); setRentalTransitCost('');
    setRentalNotes('');
  };

  const openReturnRentalModal = (rental: MaterialRental) => {
    setReturnRentalModal({ open: true, rental });
    setReturnEndDate(rental.endDate || today);
    setReturnRatePerDay((rental.rentalRatePerDay || 0).toString());
    setReturnNotes(rental.notes || '');
  };

  const handleConfirmReturnRental = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnRentalModal.rental) return;
    const r = returnRentalModal.rental;
    const startMs = new Date(r.startDate + 'T00:00:00').getTime();
    const endMs = new Date(returnEndDate + 'T00:00:00').getTime();
    const totalDays = Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1);
    const rate = Number(returnRatePerDay) || 0;
    const materialCost = totalDays * r.quantity * rate;
    const totalCost = materialCost + (r.transitCost || 0);

    updateMaterialRental(r.id, {
      endDate: returnEndDate,
      rentalRatePerDay: rate,
      totalDays,
      totalRentalCost: totalCost,
      status: 'returned',
      notes: returnNotes.trim() || r.notes
    });

    toast.success(`Rental settled for ${r.materialName}! Total calculated: ₹${totalCost.toLocaleString()}`);
    setReturnRentalModal({ open: false, rental: null });
  };

  const siteLogsAll = useMemo(() => {
    return dailyLogs.filter(l => l.siteId === siteId);
  }, [dailyLogs, siteId]);

  const defaultFromDate = useMemo(() => {
    const dates = siteLogsAll.map(l => l.date).filter(Boolean);
    if (site?.startDate && site.startDate <= today) dates.push(site.startDate);
    if (dates.length === 0) return format(new Date(Date.now() - 60 * 86400000), 'yyyy-MM-dd');
    dates.sort();
    const earliest = dates[0];
    return earliest <= today ? earliest : format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd');
  }, [siteLogsAll, site, today]);

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(today);

  // Synchronize date range whenever site changes or logs update
  useEffect(() => {
    setFromDate(defaultFromDate);
    setToDate(today);
  }, [siteId, defaultFromDate, today]);

  // Material Hub & Logistics states
  const [assignModal, setAssignModal] = useState<{ open: boolean; request: MaterialRequest | null }>({ open: false, request: null });
  const [completeModal, setCompleteModal] = useState<{ open: boolean; request: MaterialRequest | null }>({ open: false, request: null });
  const [showInterSiteTransfer, setShowInterSiteTransfer] = useState(false);
  const [transferSourceSiteId, setTransferSourceSiteId] = useState('');
  const [transferMatName, setTransferMatName] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Requisition Modal State for this Site
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqItems, setReqItems] = useState<{ name: string; quantity: string; unit: string; rate: string }[]>([
    { name: '', quantity: '1', unit: 'Bags', rate: '' }
  ]);
  const [reqSupplierId, setReqSupplierId] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const driversList = useMemo(() => staffList.filter(s => s.role === 'driver'), [staffList]);

  // Sites that strictly have material stock (excluding current site)
  const sourceSitesWithStock = useMemo(() => {
    return sites.filter(s => {
      if (s.id === siteId) return false;
      const stock = getSiteAvailableStock(s.id, materialRequests, dailyLogs, materialSettings);
      return stock.length > 0;
    });
  }, [sites, siteId, materialRequests, dailyLogs, materialSettings]);

  // Available stock of selected source site
  const sourceSiteStock = useMemo(() => {
    if (!transferSourceSiteId) return [];
    return getSiteAvailableStock(transferSourceSiteId, materialRequests, dailyLogs, materialSettings);
  }, [transferSourceSiteId, materialRequests, dailyLogs, materialSettings]);

  const handleExecuteInterSiteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;
    if (!transferSourceSiteId) {
      toast.error('Please select a source site with stock');
      return;
    }
    const sourceSite = sites.find(s => s.id === transferSourceSiteId);
    if (!sourceSite) return;

    const stockItem = sourceSiteStock.find(m => m.name === transferMatName);
    if (!stockItem) {
      toast.error('Please select a material available in stock');
      return;
    }

    const qty = Number(transferQty);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (qty > stockItem.qty) {
      toast.error(`Limited stock! Max available at ${sourceSite.name} is ${stockItem.qty} ${stockItem.unit}`);
      return;
    }

    const computedMatCost = stockItem.rate ? stockItem.rate * qty : undefined;

    addMaterialRequest({
      siteId: site.id,
      siteName: site.name,
      requestedByStaffId: currentUser?.id || 'admin',
      requestedByStaffName: 'Admin',
      sourceType: 'site',
      sourceSiteId: sourceSite.id,
      sourceSiteName: sourceSite.name,
      items: [{
        name: stockItem.name,
        quantity: qty,
        unit: stockItem.unit,
        rate: stockItem.rate,
        amount: computedMatCost
      }],
      materialCost: computedMatCost,
      notes: `[Inter-Site Transfer from ${sourceSite.name}] ${transferNotes.trim()}`.trim(),
      status: 'pending',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'hh:mm a')
    });

    toast.success(`Inter-site material transfer created! Proceed to assign Driver & Vehicle.`);
    setShowInterSiteTransfer(false);
    setTransferSourceSiteId('');
    setTransferMatName('');
    setTransferQty('');
    setTransferNotes('');
  };

  const handleCreateSiteRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;
    const validItems = reqItems.filter(i => i.name.trim() && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      toast.error('Please enter at least one material item with a valid quantity');
      return;
    }
    const sup = suppliers.find(s => s.id === reqSupplierId);
    const totalMatCost = validItems.reduce((s, it) => s + (Number(it.rate) || 0) * (Number(it.quantity) || 0), 0);

    addMaterialRequest({
      siteId: site.id,
      siteName: site.name,
      requestedByStaffId: currentUser?.id || 'admin',
      requestedByStaffName: 'Admin',
      sourceType: 'supplier',
      supplierId: sup?.id,
      supplierName: sup?.name,
      items: validItems.map(i => ({
        name: i.name.trim(),
        quantity: Number(i.quantity),
        unit: i.unit.trim() || 'unit',
        rate: Number(i.rate) || 0,
        supplierRate: Number(i.rate) || 0,
        clientRate: Number(i.rate) || 0,
        amount: (Number(i.rate) || 0) * (Number(i.quantity) || 0),
        supplierAmount: (Number(i.rate) || 0) * (Number(i.quantity) || 0),
        clientAmount: (Number(i.rate) || 0) * (Number(i.quantity) || 0)
      })),
      materialCost: totalMatCost,
      supplierMaterialCost: totalMatCost,
      clientMaterialCost: totalMatCost,
      supplierPrice: totalMatCost,
      supplierBalance: totalMatCost,
      supplierPaidAmount: 0,
      notes: reqNotes.trim(),
      status: 'pending',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'hh:mm a')
    });

    toast.success(`Material requisition created for ${site.name}!`);
    setShowReqModal(false);
    setReqItems([{ name: '', quantity: '1', unit: 'Bags', rate: '' }]);
    setReqSupplierId('');
    setReqNotes('');
  };

  // Work Log Form in Site Details
  const [showAddLog, setShowAddLog] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [expenseMode, setExpenseMode] = useState('bus');
  const [expenseCustom, setExpenseCustom] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenses, setExpenses] = useState<{ itemName: string; amount: number }[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [matId, setMatId] = useState('');
  const [matName, setMatName] = useState('');
  const [matQty, setMatQty] = useState('');
  const [matCost, setMatCost] = useState('');
  const [income, setIncome] = useState('');
  const [incomePaymentMethod, setIncomePaymentMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card'>('Cash');
  const [logNotes, setLogNotes] = useState('');

  // Check if today's work log already exists for this site
  const todayLog = useMemo(() => {
    return dailyLogs.find(l => l.siteId === siteId && l.date === today);
  }, [dailyLogs, siteId, today]);

  // Pre-populate form with existing log data for editing
  const startEditLog = (log: typeof todayLog) => {
    if (!log) return;
    setEditingLogId(log.id);
    setSelectedWorkers(log.workerIds || []);
    setMaterials(log.materials || []);
    setExpenses(log.expenses || []);
    setIncome(log.incomeFromClient ? log.incomeFromClient.toString() : '');
    setIncomePaymentMethod((log.incomePaymentMethod as any) || 'Cash');
    setLogNotes(log.notes || '');
    setShowAddLog(true);
  };

  const addExpense = () => {
    const finalName = expenseMode === 'other' ? expenseCustom.trim() : expenseMode;
    if (!finalName) { toast.error('Enter expense type'); return; }
    if (!expenseAmount) { toast.error('Enter amount'); return; }
    setExpenses(prev => [...prev, { itemName: finalName, amount: Number(expenseAmount) || 0 }]);
    setExpenseMode('bus'); setExpenseCustom(''); setExpenseAmount('');
  };

  const removeExpense = (i: number) => setExpenses(prev => prev.filter((_, idx) => idx !== i));

  const handleMatSelection = (id: string) => {
    setMatId(id);
    if (id !== 'custom') {
      const setting = (materialSettings || []).find(m => m.id === id);
      if (setting) {
        setMatName(setting.name);
        if (setting.defaultRate) setMatCost(setting.defaultRate.toString());
      }
    } else {
      setMatName('');
      setMatCost('');
    }
  };

  const addMaterial = () => {
    let finalName = '';
    if (matId === 'custom') {
      finalName = matName.trim();
    } else {
      const setting = (materialSettings || []).find(m => m.id === matId);
      if (setting) {
        finalName = setting.name;
        if (setting.perUnitWeight) finalName += ` (${setting.perUnitWeight})`;
      } else {
        finalName = matName.trim();
      }
    }
    if (!finalName) { toast.error('Select or enter material'); return; }
    setMaterials(prev => [...prev, { name: finalName, quantity: Number(matQty) || 1, cost: Number(matCost) || 0 }]);
    setMatId(''); setMatName(''); setMatQty(''); setMatCost('');
  };

  const removeMaterial = (i: number) => setMaterials(prev => prev.filter((_, idx) => idx !== i));

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;

    const logData = {
      staffId: currentUser!.id,
      staffName: 'Admin',
      siteId: site.id,
      siteName: site.name,
      date: today,
      materials,
      expenses,
      incomeFromClient: Number(income) || 0,
      incomePaymentMethod: Number(income) > 0 ? incomePaymentMethod : undefined,
      notes: logNotes,
      workerIds: selectedWorkers
    };

    if (editingLogId) {
      updateDailyLog(editingLogId, logData);
      toast.success('Work log updated!');
    } else {
      addDailyLog(logData);
      toast.success('Work log added!');
    }
    setMaterials([]); setExpenses([]); setIncome(''); setIncomePaymentMethod('Cash'); setLogNotes(''); setShowAddLog(false); setEditingLogId(null);
  };

  // Filtered daily logs for this site
  const siteLogs = useMemo(() => {
    return dailyLogs
      .filter(l => l.siteId === siteId && l.date >= fromDate && l.date <= toDate)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [dailyLogs, siteId, fromDate, toDate]);

  // Grouped logs by date
  const groupedLogs = useMemo(() => {
    const map: Record<string, typeof siteLogs> = {};
    siteLogs.forEach(l => {
      if (!map[l.date]) map[l.date] = [];
      map[l.date].push(l);
    });
    return map;
  }, [siteLogs]);

  // Detailed History Ledger Data for the selected Date Range
  const rangeHistoryData = useMemo(() => {
    // 1. Identify all active dates in range for this site
    const dateSet = new Set<string>();

    dailyLogs.forEach(l => {
      if (l.siteId === siteId && l.date >= fromDate && l.date <= toDate) {
        dateSet.add(l.date);
      }
    });

    (attendances || []).forEach(a => {
      if (a.date >= fromDate && a.date <= toDate && (a.siteId === siteId || a.siteAssignments?.some(sa => sa.siteId === siteId)) && a.status !== 'absent') {
        dateSet.add(a.date);
      }
    });

    (materialRequests || []).forEach(r => {
      const d = r.date || r.createdAt?.slice(0, 10);
      if (r.siteId === siteId && d && d >= fromDate && d <= toDate && (r.status === 'completed' || r.status === 'assigned')) {
        dateSet.add(d);
      }
    });

    (site?.paymentStages || []).forEach(st => {
      (st.payments || []).forEach(p => {
        if (p.date >= fromDate && p.date <= toDate) {
          dateSet.add(p.date);
        }
      });
    });

    const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

    let rangeTotalStaffDays = 0;
    let rangeTotalCrewDays = 0;
    let rangeTotalExpenses = 0;
    let rangeTotalMaterialsCost = 0;
    let rangeTotalTransportCost = 0;
    let rangeTotalMiscCost = 0;
    let rangeTotalRentalCost = 0;
    let rangeTotalIncome = 0;

    const days = sortedDates.map(date => {
      const logs = dailyLogs.filter(l => l.siteId === siteId && l.date === date);
      const dayAttendances = (attendances || []).filter(a =>
        a.date === date && (a.siteId === siteId || a.siteAssignments?.some(sa => sa.siteId === siteId)) && a.status !== 'absent'
      );
      const dayRequests = (materialRequests || []).filter(r => {
        const d = r.date || r.createdAt?.slice(0, 10);
        return r.siteId === siteId && d === date && (r.status === 'completed' || r.status === 'assigned');
      });
      const dayMilestonePayments = (site?.paymentStages || []).flatMap(st =>
        (st.payments || []).filter(p => p.date === date).map(p => ({ ...p, stageName: st.stageName }))
      );

      // 1. Employees / Workforce calculation
      const namedStaffMap = new Map<string, { id: string; name: string; role: string; source: string }>();

      // From logs: submitter + workerIds
      logs.forEach(l => {
        if (l.staffId) {
          const s = staffList.find(st => st.id === l.staffId);
          namedStaffMap.set(l.staffId, {
            id: l.staffId,
            name: s ? s.name : l.staffName || 'Staff',
            role: s ? s.role : 'Staff',
            source: 'Log Submitter'
          });
        }
        (l.workerIds || []).forEach(wId => {
          const s = staffList.find(st => st.id === wId);
          if (s) {
            namedStaffMap.set(wId, {
              id: wId,
              name: s.name,
              role: s.role,
              source: 'Assigned on Site'
            });
          }
        });
      });

      // From attendances
      dayAttendances.forEach(a => {
        const s = staffList.find(st => st.id === a.staffId);
        if (s && !namedStaffMap.has(a.staffId)) {
          namedStaffMap.set(a.staffId, {
            id: a.staffId,
            name: s.name,
            role: s.role,
            source: 'Attendance'
          });
        }
      });

      const namedStaff = Array.from(namedStaffMap.values());

      // Crew counts (dynamic labour types from admin settings)
      const crewTypeCounts: Record<string, number> = {};

      logs.forEach(l => {
        if (l.workerCounts) {
          Object.entries(l.workerCounts).forEach(([k, v]) => {
            if (v && v > 0) {
              crewTypeCounts[k] = (crewTypeCounts[k] || 0) + v;
            }
          });
        }
      });

      // Check attendance siteAssignments if logs didn't specify crew counts
      dayAttendances.forEach(a => {
        const assignment = a.siteAssignments?.find(sa => sa.siteId === siteId);
        if (assignment) {
          const logsHaveCrew = logs.some(l => l.workerCounts && Object.values(l.workerCounts).some(v => (v || 0) > 0));
          if (!logsHaveCrew) {
            if (assignment.counts) {
              Object.entries(assignment.counts).forEach(([k, v]) => {
                if (v && v > 0) {
                  crewTypeCounts[k] = (crewTypeCounts[k] || 0) + v;
                }
              });
            }
            if (assignment.halfDayCounts) {
              Object.entries(assignment.halfDayCounts).forEach(([k, v]) => {
                if (v && v > 0) {
                  crewTypeCounts[k] = (crewTypeCounts[k] || 0) + (v * 0.5);
                }
              });
            }
          }
        }
      });

      const painterCount = crewTypeCounts.painter || 0;
      const plumberCount = crewTypeCounts.plumber || 0;
      const labourCount = crewTypeCounts.labour || 0;
      const totalCrew = Object.values(crewTypeCounts).reduce((sum, v) => sum + v, 0);
      const totalWorkers = namedStaff.length + totalCrew;

      // 2. Costs & Expenses calculation
      // A. Materials
      let dayMaterialsCost = 0;
      const materialsList: { name: string; quantity: number; cost: number; total: number }[] = [];
      logs.forEach(l => {
        (l.materials || []).forEach(m => {
          const defRate = materialSettings.find(s => s.name.toLowerCase() === m.name.toLowerCase())?.defaultRate || 0;
          const unitRate = m.cost && m.cost > 0 ? m.cost : defRate;
          const itemTotal = unitRate * (m.quantity || 1);
          dayMaterialsCost += itemTotal;
          materialsList.push({
            name: m.name,
            quantity: m.quantity || 1,
            cost: unitRate,
            total: itemTotal
          });
        });
      });

      // Material requests completed / delivered to site
      dayRequests.forEach(r => {
        const reqMatCost = r.materialCost || r.supplierPrice || 0;
        dayMaterialsCost += reqMatCost;
      });

      // B. Transport
      const logTransportCost = logs.reduce((sum, l) => sum + (l.transportCost || 0), 0);
      const reqTransportCost = dayRequests.reduce((sum, r) => sum + (r.driverCost || 0), 0);
      const dayTransportCost = logTransportCost + reqTransportCost;

      // C. Misc Expenses (from Daily Logs + Supervisor Attendance Site Expenses)
      const miscExpensesList: { itemName: string; amount: number; staffName?: string }[] = [];
      logs.forEach(l => {
        (l.expenses || []).forEach(e => {
          miscExpensesList.push({
            itemName: e.itemName,
            amount: e.amount || 0,
            staffName: l.staffName
          });
        });
      });

      // Include supervisor attendance daily expenses marked for this site
      dayAttendances.forEach(a => {
        if (a.siteId === siteId) {
          const s = staffList.find(st => st.id === a.staffId);
          const staffName = s ? s.name : a.staffName || 'Supervisor';
          if (a.expenseAmount && a.expenseAmount > 0 && a.expenseStatus === 'paid') {
            miscExpensesList.push({
              itemName: a.expenseNotes ? `Attendance Expense: ${a.expenseNotes}` : 'Supervisor Attendance Expense',
              amount: a.expensePaidAmount || a.expenseAmount,
              staffName: staffName
            });
          }
          if (a.expenses && Array.isArray(a.expenses)) {
            a.expenses.forEach(e => {
              miscExpensesList.push({
                itemName: e.itemName ? `Attendance: ${e.itemName}` : 'Supervisor Attendance Expense',
                amount: e.amount || 0,
                staffName: staffName
              });
            });
          }
        }
      });

      const dayMiscCost = miscExpensesList.reduce((sum, e) => sum + e.amount, 0);

      // D. Rentals & Equipment deployed to site for this day
      const dayRentalsList: { name: string; quantity: number; unit: string; rate: number; transit: number; total: number }[] = [];
      let dayRentalCost = 0;
      (materialRentals || []).forEach(r => {
        if (!isRentalForSite(r)) return;
        const rStart = r.startDate || '';
        const rEnd = r.endDate || (r.status === 'active' ? format(new Date(), 'yyyy-MM-dd') : rStart);
        if (rStart && rStart <= date && rEnd >= date) {
          const dailyRate = (r.quantity || 1) * (r.rentalRatePerDay || 0);
          const transit = (r.startDate === date) ? (r.transitCost || 0) : 0;
          const dayTotal = dailyRate + transit;
          dayRentalCost += dayTotal;
          dayRentalsList.push({
            name: r.materialName,
            quantity: r.quantity || 1,
            unit: r.unit || 'Nos',
            rate: r.rentalRatePerDay || 0,
            transit,
            total: dayTotal
          });
        }
      });

      const dayTotalExpense = dayMaterialsCost + dayTransportCost + dayMiscCost + dayRentalCost;

      // 3. Income
      const logIncome = logs.reduce((sum, l) => sum + (l.incomeFromClient || 0), 0);
      const milestoneIncome = dayMilestonePayments.reduce((sum, p) => sum + p.amount, 0);
      const dayTotalIncome = logIncome + milestoneIncome;

      const dayNetBalance = dayTotalIncome - dayTotalExpense;

      // Add to range totals
      rangeTotalStaffDays += namedStaff.length;
      rangeTotalCrewDays += totalCrew;
      rangeTotalExpenses += dayTotalExpense;
      rangeTotalMaterialsCost += dayMaterialsCost;
      rangeTotalTransportCost += dayTransportCost;
      rangeTotalMiscCost += dayMiscCost;
      rangeTotalRentalCost += dayRentalCost;
      rangeTotalIncome += dayTotalIncome;

      return {
        date,
        logs,
        dayAttendances,
        dayRequests,
        dayMilestonePayments,
        namedStaff,
        crewTypeCounts,
        painterCount,
        plumberCount,
        labourCount,
        totalCrew,
        totalWorkers,
        dayMaterialsCost,
        materialsList,
        dayTransportCost,
        logTransportCost,
        reqTransportCost,
        dayMiscCost,
        miscExpensesList,
        dayRentalCost,
        dayRentalsList,
        dayTotalExpense,
        dayTotalIncome,
        logIncome,
        milestoneIncome,
        dayNetBalance
      };
    });

    return {
      days,
      totalActiveDays: days.length,
      totalStaffDays: rangeTotalStaffDays,
      totalCrewDays: rangeTotalCrewDays,
      totalManDays: rangeTotalStaffDays + rangeTotalCrewDays,
      totalExpenses: rangeTotalExpenses,
      totalMaterialsCost: rangeTotalMaterialsCost,
      totalTransportCost: rangeTotalTransportCost,
      totalMiscCost: rangeTotalMiscCost,
      totalRentalsCost: rangeTotalRentalCost,
      totalIncome: rangeTotalIncome,
      rangeNetBalance: rangeTotalIncome - rangeTotalExpenses
    };
  }, [dailyLogs, attendances, materialRequests, materialRentals, site?.paymentStages, siteId, fromDate, toDate, staffList, materialSettings]);

  // Material requests for this site
  const siteRequests = useMemo(() => {
    return (materialRequests || [])
      .filter(r => r.siteId === siteId)
      .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
  }, [materialRequests, siteId]);

  // Available stock on this site
  const availableStock = useMemo(() => {
    return getSiteAvailableStock(siteId, materialRequests, dailyLogs, materialSettings);
  }, [siteId, materialRequests, dailyLogs, materialSettings]);

  // Report Modal state
  const [reportModal, setReportModal] = useState<{
    open: boolean;
    title: string;
    type: 'materials' | 'income' | 'expense' | null;
    itemName: string | null;
    data: any[];
  }>({ open: false, title: '', type: null, itemName: null, data: [] });

  // Site Financials: Income Given vs Total Expenses
  const siteFinancials = useMemo(() => {
    // 1. Income from Daily Logs
    const logIncome = siteLogsAll.filter(l => (l.incomeFromClient || 0) > 0).map(l => ({
      date: l.date,
      staffName: l.staffName,
      amount: l.incomeFromClient || 0,
      notes: l.notes
    }));

    // 2. Income from Payment Milestones
    const milestoneIncome = (site?.paymentStages || []).flatMap(stage => 
      (stage.payments || []).map(p => ({
        date: p.date,
        staffName: 'Admin (Milestone)',
        amount: p.amount,
        notes: `[${stage.stageName}] ${p.note || ''}`
      }))
    );

    const allIncomeLogs = [...logIncome, ...milestoneIncome].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const totalIncomeGiven = allIncomeLogs.reduce((sum, l) => sum + l.amount, 0);

    const logMaterialCost = siteLogsAll.reduce(
      (sum, l) => sum + (l.materials || []).reduce((s, m) => s + (m.cost || 0) * (m.quantity || 0), 0),
      0
    );

    // External supplier orders (excluding central store room to prevent duplication)
    const supplierReqCost = (materialRequests || [])
      .filter(r => r.siteId === siteId && (r.status === 'completed' || r.status === 'assigned') && !r.isStoreRoom && r.sourceType !== 'store_room')
      .reduce((sum, r) => sum + (r.materialCost || r.supplierPrice || 0), 0);

    // Store Room Equipment & Materials deployed or billed to this site
    const siteStoreRoomDispatches = (storeRoomDispatches || []).filter(d => 
      (d.siteId && (d.siteId === siteId || String(d.siteId) === String(siteId))) ||
      (site?.name && d.siteName && d.siteName.trim().toLowerCase() === site.name.trim().toLowerCase())
    );

    const storeRoomDispatchAmount = siteStoreRoomDispatches.reduce((sum, d) => {
      if (d.status === 'returned' || (d.storeRoomAmount !== undefined && d.storeRoomAmount > 0)) {
        return sum + (Number(d.storeRoomAmount) || Number(d.storeRoomProfit) || 0);
      }
      // If actively deployed on site, calculate accumulated usage fee if perDayRate is configured
      if (d.perDayRate && d.perDayRate > 0) {
        const sDate = d.deliveryDate || d.startDate || d.date || today;
        let days = 1;
        try {
          const s = new Date(sDate);
          const now = new Date();
          if (!isNaN(s.getTime())) {
            days = Math.max(1, Math.ceil((now.getTime() - s.getTime()) / 86400000));
          }
        } catch {
          days = 1;
        }
        return sum + (days * (Number(d.quantity) || 1) * Number(d.perDayRate));
      }
      return sum;
    }, 0);

    const storeRoomReqAmount = (materialRequests || [])
      .filter(r => r.siteId === siteId && (r.status === 'completed' || r.status === 'assigned') && (r.isStoreRoom || r.sourceType === 'store_room') && !siteStoreRoomDispatches.some(d => d.id === r.id))
      .reduce((sum, r) => sum + (Number(r.storeRoomAmount) || Number(r.materialCost) || Number(r.supplierPrice) || 0), 0);

    const storeRoomManualExpenses = (manualExpenses || [])
      .filter(e => (e.siteId === siteId || (site?.name && e.siteName && e.siteName.trim().toLowerCase() === site.name.trim().toLowerCase())) && e.category === 'Store Room Equipment & Materials')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Store Room total expense for this site (preventing double counting between dispatch, request and manualExpense)
    const totalStoreRoomExpense = Math.max(
      storeRoomDispatchAmount + storeRoomReqAmount,
      storeRoomManualExpenses
    );

    const totalMaterialExpense = logMaterialCost + supplierReqCost + totalStoreRoomExpense;

    const logTransportCost = siteLogsAll.reduce((sum, l) => sum + (l.transportCost || 0), 0);
    const reqTransportCost = (materialRequests || [])
      .filter(r => r.siteId === siteId && (r.status === 'completed' || r.status === 'assigned'))
      .reduce((sum, r) => sum + (r.driverCost || 0), 0);
    const totalTransportExpense = logTransportCost + reqTransportCost;

    const logMiscExpense = siteLogsAll.reduce(
      (sum, l) => sum + (l.expenses || []).reduce((s, e) => s + (e.amount || 0), 0),
      0
    );

    const attendanceMiscExpense = (attendances || [])
      .filter(a => a.siteId === siteId && a.status !== 'absent' && a.expenseStatus === 'paid')
      .reduce((sum, a) => {
        let amt = a.expensePaidAmount || a.expenseAmount || 0;
        if (a.expenses && Array.isArray(a.expenses)) {
          amt += a.expenses.reduce((s, e) => s + (e.amount || 0), 0);
        }
        return sum + amt;
      }, 0);

    const otherSiteManualExpenses = (manualExpenses || [])
      .filter(e => (e.siteId === siteId || (site?.name && e.siteName && e.siteName.trim().toLowerCase() === site.name.trim().toLowerCase())) && e.category !== 'Store Room Equipment & Materials' && !e.id?.startsWith('att_exp_'))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const totalMiscExpense = logMiscExpense + attendanceMiscExpense + otherSiteManualExpenses;

    const totalRentalExpense = (materialRentals || [])
      .filter(r => isRentalForSite(r))
      .reduce((sum, r) => {
        if (r.totalRentalCost !== undefined && r.status === 'returned') {
          return sum + r.totalRentalCost;
        }
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const startMs = new Date(r.startDate + 'T00:00:00').getTime();
        const endMs = new Date((r.endDate || todayStr) + 'T00:00:00').getTime();
        const days = Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1);
        return sum + (days * (r.quantity || 1) * (r.rentalRatePerDay || 0)) + (r.transitCost || 0);
      }, 0);

    // 5. Staff & Crew Labour Salary / Wages for this site
    const supervisor = staffList.find(s => s.id === site?.supervisorId);
    const defaultSupRate = supervisor?.underLabourSalary || 800;

    let totalLabourExpense = 0;

    // A) From Daily Logs on this site
    siteLogsAll.forEach(log => {
      let logLabour = 0;
      const supSal = Number(log.supervisorSalary) || 0;
      const empSalaries = (log.employeeSalaries && Array.isArray(log.employeeSalaries)) ? log.employeeSalaries : [];
      // Strictly verify if supervisor was assigned to this site on that date in Team Attendance
      const supAttForDate = (attendances || []).find(a => (a.staffId === log.staffId || a.staffId === site?.supervisorId) && a.date === log.date);
      const isSupAssignedToThisSite = supAttForDate ? supAttForDate.siteId === siteId : (!supAttForDate && site?.supervisorId === log.staffId);

      const empWithoutSup = empSalaries.filter(e => e.role !== 'supervisor').reduce((s, e) => s + (Number(e.totalSalary) || 0), 0);
      const empSup = isSupAssignedToThisSite ? empSalaries.filter(e => e.role === 'supervisor').reduce((s, e) => s + (Number(e.totalSalary) || 0), 0) : 0;
      const effectiveSupSal = isSupAssignedToThisSite ? supSal : 0;

      logLabour += Math.max(effectiveSupSal, empSup) + empWithoutSup;

      if (log.workerCounts) {
        const counts = log.workerCounts;
        const totalW = Object.values(counts).reduce((s, v) => s + (Number(v) || 0), 0);
        logLabour += totalW * defaultSupRate;
      }
      totalLabourExpense += logLabour;
    });

    // B) From Attendances assigned to this site
    (attendances || []).filter(a => (a.siteId === siteId || a.siteAssignments?.some(sa => sa.siteId === siteId)) && a.status !== 'absent').forEach(att => {
      const staff = staffList.find(s => s.id === att.staffId);
      if (staff) {
        // A supervisor's own daily salary only belongs to this site if they were assigned to this site (att.siteId === siteId), NOT just crew siteAssignments
        const isSupervisorForThisSite = staff.role === 'supervisor' ? att.siteId === siteId : true;
        if (isSupervisorForThisSite) {
          const hasLogSupervisorSalary = staff.role === 'supervisor' && siteLogsAll.some(l => 
            l.date === att.date && (
              (Number(l.supervisorSalary) || 0) > 0 ||
              (l.employeeSalaries && Array.isArray(l.employeeSalaries) && l.employeeSalaries.some(e => e.role === 'supervisor' && (Number(e.totalSalary) || 0) > 0))
            )
          );
          if (!hasLogSupervisorSalary) {
            const dailyBase = staff.salaryType === 'hourly'
              ? (staff.perHourSalary || 0) * 8
              : (staff.perDaySalary || (staff.role === 'supervisor' ? 800 : staff.role === 'driver' ? 700 : 650));
            const otRate = staff.incentivePerHour || (staff.role === 'supervisor' ? 100 : 80);
            const mult = att.status === 'half-day' ? 0.5 : 1.0;
            const base = dailyBase * mult;
            const ot = (att.otHours || 0) * otRate;
            totalLabourExpense += base + ot;
          }
        }
      }

      // Supervisor crew counts from attendance if not already in daily logs for this date
      if (att.presentCounts || att.halfDayCounts) {
        const fullCount = Object.values(att.presentCounts || {}).reduce((s, c) => s + (c || 0), 0);
        const halfCount = Object.values(att.halfDayCounts || {}).reduce((s, c) => s + (c || 0), 0);
        const ot = att.unnamedOtHours || 0;
        const otStaff = att.unnamedOtStaffCount !== undefined ? att.unnamedOtStaffCount : (ot > 0 ? (fullCount + halfCount) : 0);
        const cRate = staff?.underLabourSalary || defaultSupRate;
        const cOtRate = staff?.underLabourOT || 100;
        const cBase = (fullCount * cRate) + (halfCount * (cRate / 2));
        const cOt = otStaff * ot * cOtRate;
        const hasLogCounts = siteLogsAll.some(l => l.date === att.date && l.workerCounts && Object.values(l.workerCounts).some(v => (Number(v) || 0) > 0));
        if (!hasLogCounts) {
          totalLabourExpense += cBase + cOt;
        }
      }
    });

    // C) Driver transit wages for dispatches to this site
    const driverWagesForSite = (materialRequests || [])
      .filter(r => r.siteId === siteId && (r.status === 'completed' || r.status === 'assigned'))
      .reduce((sum, r) => sum + (Number(r.driverWage) || 0), 0);
    totalLabourExpense += driverWagesForSite;

    const totalSiteExpense = totalMaterialExpense + totalTransportExpense + totalMiscExpense + totalRentalExpense + totalLabourExpense;
    const netBalance = totalIncomeGiven - totalSiteExpense;

    return {
      incomeLogs: allIncomeLogs,
      totalIncomeGiven,
      totalMaterialExpense,
      totalStoreRoomExpense,
      totalTransportExpense,
      totalRentalExpense,
      totalMiscExpense,
      totalLabourExpense,
      totalSiteExpense,
      netBalance
    };
  }, [siteLogsAll, materialRequests, materialRentals, siteId, site?.paymentStages, site?.supervisorId, staffList, attendances, storeRoomDispatches, manualExpenses]);

  const downloadSiteFinancialPDF = () => {
    if (!site) return;
    const doc = new jsPDF();

    // Company Header
    doc.setFontSize(18);
    doc.setTextColor(184, 117, 26);
    doc.text('JGS CONSTRUCTION & INTERIORS', 14, 20);

    doc.setFontSize(13);
    doc.setTextColor(40);
    doc.text('SITE FINANCIAL STATEMENT', 14, 28);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Site: ${site.name} | Client: ${site.clientName}`, 14, 35);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 40);

    // Summary Box
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(14, 44, 182, 48, 2, 2, 'FD');

    const startY = 46;
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text(`Client Income Received: Rs ${siteFinancials.totalIncomeGiven.toLocaleString()} (${siteFinancials.incomeLogs.length} logs)`, 20, startY + 6);
    doc.text(`Total Site Expenses: Rs ${siteFinancials.totalSiteExpense.toLocaleString()} (All operational costs)`, 20, startY + 12);
    doc.text(`- Materials (Supplier/Logs): Rs ${(siteFinancials.totalMaterialExpense - (siteFinancials.totalStoreRoomExpense || 0)).toLocaleString()}`, 25, startY + 17);
    doc.text(`- Store Room Materials & Tools: Rs ${(siteFinancials.totalStoreRoomExpense || 0).toLocaleString()}`, 25, startY + 21);
    doc.text(`- Staff Wages & Crew Payroll: Rs ${siteFinancials.totalLabourExpense.toLocaleString()}`, 25, startY + 25);
    doc.text(`- Transport & Driver: Rs ${siteFinancials.totalTransportExpense.toLocaleString()}`, 25, startY + 29);
    doc.text(`- Rental Products & Scaffolding: Rs ${siteFinancials.totalRentalExpense.toLocaleString()}`, 25, startY + 33);
    doc.text(`- Incidentals / Tea / Misc: Rs ${siteFinancials.totalMiscExpense.toLocaleString()}`, 25, startY + 37);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    if (siteFinancials.netBalance >= 0) {
      doc.setTextColor(6, 95, 70);
      doc.text(`Net In-Hand Balance: +Rs ${siteFinancials.netBalance.toLocaleString()} (Surplus)`, 20, startY + 44);
    } else {
      doc.setTextColor(153, 27, 27);
      doc.text(`Net Overspent / Due: -Rs ${Math.abs(siteFinancials.netBalance).toLocaleString()} (Due from Client)`, 20, startY + 44);
    }

    // Expense Breakdown Table
    const expHead = [['Category', 'Amount (Rs)', 'Notes']];
    const expBody = [
      ['Materials Expense', (siteFinancials.totalMaterialExpense - (siteFinancials.totalStoreRoomExpense || 0)).toLocaleString(), 'Site daily logs + vendor orders'],
      ['Store Room Materials & Tools', (siteFinancials.totalStoreRoomExpense || 0).toLocaleString(), 'Warehouse inventory deployed & billed to site'],
      ['Staff Wages & Crew Payroll', siteFinancials.totalLabourExpense.toLocaleString(), 'Supervisor salary, driver transit & site crew team wages'],
      ['Transport & Vehicle Expense', siteFinancials.totalTransportExpense.toLocaleString(), 'Staff travel + driver transit & petrol'],
      ['Rental Equipment & Products', siteFinancials.totalRentalExpense.toLocaleString(), 'Scaffolding, machines & rental items deployed to site'],
      ['Site Miscellaneous Expenses', siteFinancials.totalMiscExpense.toLocaleString(), 'Food, tea, tools & site incidentals'],
      ['TOTAL SITE EXPENSES', siteFinancials.totalSiteExpense.toLocaleString(), 'All operational site costs combined']
    ];

    autoTable(doc, {
      startY: startY + 38,
      head: expHead,
      body: expBody,
      theme: 'grid',
      headStyles: { fillColor: [184, 117, 26], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
        2: { cellWidth: 82 }
      },
      didParseCell: function (data) {
        if (data.row.index === expBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 243, 199];
        }
      }
    });

    // Income Received Log Table
    const lastY = (doc as any).lastAutoTable.finalY || 130;
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text('Client Income Received Logs (How Much Given)', 14, lastY + 12);

    const incHead = [['Date', 'Staff Member', 'Amount Given (Rs)', 'Notes']];
    const incBody = siteFinancials.incomeLogs.length === 0
      ? [['-', 'No income logged from client yet', '0', '-']]
      : siteFinancials.incomeLogs.map(l => [
        format(new Date(l.date), 'dd MMM yyyy'),
        l.staffName,
        l.amount.toLocaleString(),
        l.notes || '-'
      ]);

    autoTable(doc, {
      startY: lastY + 16,
      head: incHead,
      body: incBody,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 45 },
        2: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
        3: { cellWidth: 62 }
      }
    });

    // Rental Equipment Table in Financial PDF
    if (siteRentals.length > 0) {
      const rentalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 12 : 180;
      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.text(`Site Material Rentals & Scaffolding Tracker (${siteRentals.length})`, 14, rentalY);

      const rentHead = [['Material', 'Quantity', 'Start Date', 'End Date', 'Days', 'Rate/Day', 'Total Cost (Rs)', 'Status']];
      const rentBody = siteRentals.map(r => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const startMs = new Date(r.startDate + 'T00:00:00').getTime();
        const endMs = new Date((r.endDate || todayStr) + 'T00:00:00').getTime();
        const days = r.totalDays || Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1);
        const cost = (r.totalRentalCost !== undefined && r.status === 'returned')
          ? r.totalRentalCost
          : (days * (r.quantity || 1) * (r.rentalRatePerDay || 0)) + (r.transitCost || 0);

        return [
          r.materialName,
          `${r.quantity} ${r.unit}`,
          r.startDate,
          r.endDate || 'Active On Site',
          `${days}d`,
          `Rs ${r.rentalRatePerDay || 0}`,
          cost.toLocaleString(),
          r.status === 'active' ? 'Active On Site' : 'Returned / Settled'
        ];
      });

      autoTable(doc, {
        startY: rentalY + 4,
        head: rentHead,
        body: rentBody,
        theme: 'grid',
        headStyles: { fillColor: [217, 119, 6], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          1: { cellWidth: 20 },
          2: { cellWidth: 24 },
          3: { cellWidth: 24 },
          4: { cellWidth: 15 },
          5: { cellWidth: 20 },
          6: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
          7: { cellWidth: 25 }
        }
      });
    }

    const safeName = site.name.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`${safeName}_Financial_Statement.pdf`);
  };

  const downloadPDF = () => {
    if (!reportModal.type) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(reportModal.title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Site: ${site?.name}`, 14, 30);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 36);

    let head: string[][] = [];
    let body: any[][] = [];

    if (reportModal.type === 'materials') {
      head = [['Date', 'Staff / Source', 'Material Item', 'Quantity', 'Unit Rate (Rs)', 'Total (Rs)']];
      body = reportModal.data.map(d => [
        format(new Date(d.date), 'dd MMM yyyy'),
        d.source ? `${d.staffName} (${d.source})` : d.staffName,
        d.item || reportModal.itemName || 'Material',
        d.quantity.toString(),
        `Rs ${d.cost}`,
        `Rs ${d.total}`
      ]);
    } else if (reportModal.type === 'income') {
      head = [['Date', 'Staff', 'Amount', 'Notes']];
      body = reportModal.data.map(d => [
        format(new Date(d.date), 'dd MMM yyyy'),
        d.staffName,
        `Rs ${d.amount}`,
        d.notes || '-'
      ]);
    } else if (reportModal.type === 'expense') {
      head = [['Date', 'Staff', 'Item', 'Amount']];
      body = reportModal.data.map(d => [
        format(new Date(d.date), 'dd MMM yyyy'),
        d.staffName,
        d.item,
        `Rs ${d.amount}`
      ]);
    }

    autoTable(doc, {
      startY: 42,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [184, 117, 26] },
    });

    doc.save(`${reportModal.title.replace(/ /g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const downloadSiteHistoryPDF = () => {
    if (!site) return;
    const doc = new jsPDF();

    // Company Header
    doc.setFontSize(18);
    doc.setTextColor(184, 117, 26);
    doc.text('JGS CONSTRUCTION & INTERIORS', 14, 20);

    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(`SITE ACTIVITY & EXPENSE REPORT (${format(new Date(fromDate + 'T00:00:00'), 'dd MMM yyyy')} - ${format(new Date(toDate + 'T00:00:00'), 'dd MMM yyyy')})`, 14, 28);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Site: ${site.name} | Client: ${site.clientName}`, 14, 35);
    doc.text(`Report Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 40);

    // Summary Box
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(14, 44, 182, 28, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text(`Active Days: ${rangeHistoryData.totalActiveDays} Days`, 20, 52);
    doc.text(`Total Workforce: ${rangeHistoryData.totalManDays} Man-Days (${rangeHistoryData.totalStaffDays} Staff + ${rangeHistoryData.totalCrewDays} Crew)`, 20, 58);
    doc.text(`Total Expenses: Rs ${rangeHistoryData.totalExpenses.toLocaleString()} (Mat: Rs ${rangeHistoryData.totalMaterialsCost.toLocaleString()}, Trnsp: Rs ${rangeHistoryData.totalTransportCost.toLocaleString()}, Misc: Rs ${rangeHistoryData.totalMiscCost.toLocaleString()})`, 20, 64);

    doc.text(`Client Income Received: Rs ${rangeHistoryData.totalIncome.toLocaleString()}`, 115, 52);
    const isSurplus = rangeHistoryData.rangeNetBalance >= 0;
    doc.setTextColor(isSurplus ? 6 : 153, isSurplus ? 95 : 27, isSurplus ? 70 : 27);
    doc.text(`Net Period Balance: ${isSurplus ? '+' : ''}Rs ${rangeHistoryData.rangeNetBalance.toLocaleString()}`, 115, 58);

    // Daily breakdown table
    const head = [['Date', 'Employees Coming', 'Expenses (Rs)', 'Materials Used', 'Client Income (Rs)', 'Notes / Summary']];
    const body = rangeHistoryData.days.map(d => {
      const staffNames = d.namedStaff.map(s => `${s.name} (${s.role})`).join(', ');
      const crewParts: string[] = [];
      Object.entries(d.crewTypeCounts || {}).forEach(([typeKey, count]) => {
        if (count && count > 0) {
          const meta = getLabourTypeMeta(typeKey);
          crewParts.push(`${count} ${meta.label}`);
        }
      });
      const crewStr = crewParts.length > 0 ? `Crew: ${crewParts.join(', ')}` : '';
      const empStr = `${d.totalWorkers} Total\n${[staffNames, crewStr].filter(Boolean).join('\n')}`;

      const expParts = [];
      if (d.dayMaterialsCost > 0) expParts.push(`Mat: Rs ${d.dayMaterialsCost.toLocaleString()}`);
      if (d.dayTransportCost > 0) expParts.push(`Trnsp: Rs ${d.dayTransportCost.toLocaleString()}`);
      if (d.dayMiscCost > 0) expParts.push(`Misc: Rs ${d.dayMiscCost.toLocaleString()}`);
      const expStr = `Total: Rs ${d.dayTotalExpense.toLocaleString()}\n${expParts.join('\n')}`;

      const matStr = d.materialsList.map(m => `${m.name} × ${m.quantity}`).join(', ') || '-';
      const incStr = d.dayTotalIncome > 0 ? `+Rs ${d.dayTotalIncome.toLocaleString()}` : '-';
      const notes = d.logs.map(l => l.notes).filter(Boolean).join('; ') || '-';

      return [
        format(new Date(d.date + 'T00:00:00'), 'dd MMM yyyy'),
        empStr,
        expStr,
        matStr,
        incStr,
        notes
      ];
    });

    autoTable(doc, {
      startY: 76,
      head: head,
      body: body.length === 0 ? [['-', 'No activity in this range', '-', '-', '-', '-']] : body,
      theme: 'grid',
      headStyles: { fillColor: [184, 117, 26], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 42 },
        2: { cellWidth: 32 },
        3: { cellWidth: 30 },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 30 }
      }
    });

    const safeSite = site.name.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`${safeSite}_History_${fromDate}_to_${toDate}.pdf`);
  };

  if (!site) return null;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 rounded-xl gap-1.5 text-xs font-semibold pl-2">
          ← Back
        </Button>
        <div className="flex-1">
          <h3 className="font-heading font-bold text-base leading-tight">{site.name}</h3>
          <p className="text-xs text-muted-foreground">{site.clientName}</p>
        </div>
        <span className={statusBadge(site.status)}>{site.status}</span>
      </div>

      {/* Site meta */}
      <div className="form-card space-y-2 !py-3">
        {[
          { l: 'Address', v: site.address },
          { l: 'Started', v: site.startDate || '—' },
          { l: 'Budget', v: site.budget > 0 ? `₹${site.budget.toLocaleString()}` : '—' },
        ].filter(x => x.v).map(({ l, v }) => (
          <div key={l} className="flex justify-between text-xs">
            <span className="text-muted-foreground font-medium">{l}</span>
            <span className="font-semibold">{v}</span>
          </div>
        ))}
        {/* Status change pills */}
        <div className="flex gap-2 pt-2 border-t border-border/50">
          {(['active', 'on-hold', 'completed'] as const).map(st => (
            <button
              key={st}
              onClick={() => updateSite(site.id, { status: st })}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize transition-all ${site.status === st ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* ── UNIQUE LEVEL PAYMENT DUES ALERT IN SITE DETAIL VIEW ── */}
      {(() => {
        let totalDue = 0;
        let overdueCount = 0;
        const dueLevels: { stageName: string; balance: number; isOverdue: boolean }[] = [];

        (site.paymentStages || []).forEach(stage => {
          const expected = stage.expectedAmount || 0;
          const paid = stage.paidAmount || 0;
          const balance = Math.max(0, expected - paid);
          if (balance > 0 && expected > 0) {
            const isOverdue = !!(stage.dueDate && new Date(stage.dueDate) < new Date());
            if (isOverdue) overdueCount++;
            if (stage.completionStatus === 'completed' || isOverdue) {
              totalDue += balance;
              dueLevels.push({ stageName: stage.stageName, balance, isOverdue });
            }
          }
        });

        if (dueLevels.length === 0) return null;

        return (
          <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-card border border-amber-500/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-foreground">
                    Level Payments Under Due: <strong className="text-amber-600 dark:text-amber-400 font-extrabold font-mono text-base">₹{totalDue.toLocaleString()}</strong>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    {dueLevels.length} Level{dueLevels.length > 1 ? 's' : ''} Awaiting Collection
                  </span>
                  {overdueCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-destructive/15 text-destructive border border-destructive/30 animate-pulse">
                      {overdueCount} Overdue
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Client balance pending: {dueLevels.map(l => `${l.stageName} (₹${l.balance.toLocaleString()})`).join(' • ')}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      <SitePaymentMilestones
        site={site}
        updateSite={updateSite}
        paymentStageMaster={paymentStageMaster}
        stageCompletionRequests={stageCompletionRequests}
        updateStageCompletionRequest={updateStageCompletionRequest}
        dailyLogs={dailyLogs}
        materialRequests={materialRequests}
        materialRentals={materialRentals}
        staffList={staffList}
        manualExpenses={manualExpenses}
        attendances={attendances}
      />

      {/* Site Financial Statement: Income Given vs Total Expenses */}
      <Card className="p-4 sm:p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" />
              <h4 className="text-sm font-heading font-extrabold text-foreground uppercase tracking-wide">
                Site Financial Statement & Cost Tracking
              </h4>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Income received from client (how much given) vs total materials, transport, and site expenses.
            </p>
          </div>

          <Button
            size="sm"
            onClick={downloadSiteFinancialPDF}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 text-white shadow-xs self-start sm:self-auto"
            style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
          >
            <FileDown className="w-3.5 h-3.5" /> Convert / Export PDF Report
          </Button>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Income Received */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider block">
              💰 Income Received (How Much Given)
            </span>
            <div className="text-2xl font-heading font-extrabold text-emerald-600 dark:text-emerald-400">
              ₹{siteFinancials.totalIncomeGiven.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {siteFinancials.incomeLogs.length} client payment {siteFinancials.incomeLogs.length === 1 ? 'log' : 'logs'} recorded
            </p>
          </div>

          {/* Total Site Expenses */}
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/25 space-y-1">
            <span className="text-[10px] uppercase font-bold text-destructive tracking-wider block">
              📉 Total Site Expenses
            </span>
            <div className="text-2xl font-heading font-extrabold text-destructive">
              ₹{siteFinancials.totalSiteExpense.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Materials + Wages + Transport + Rentals + Incidentals
            </p>
          </div>

          {/* Net In-Hand / Surplus or Deficit */}
          <div className={`p-3.5 rounded-xl border space-y-1 ${siteFinancials.netBalance >= 0
              ? 'bg-primary/10 border-primary/25'
              : 'bg-amber-500/10 border-amber-500/25'
            }`}>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              ⚖️ Net Balance (Income − Expenses)
            </span>
            <div className={`text-2xl font-heading font-extrabold ${siteFinancials.netBalance >= 0 ? 'text-primary' : 'text-amber-700 dark:text-amber-400'
              }`}>
              {siteFinancials.netBalance >= 0 ? '+' : ''}₹{siteFinancials.netBalance.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {siteFinancials.netBalance >= 0 ? 'Surplus / In-hand balance' : 'Deficit / Due from client'}
            </p>
          </div>
        </div>

        {/* Expense Category Breakdown Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-border/30 text-xs">
          <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40 border border-border/40">
            <span className="text-muted-foreground">🧱 Materials:</span>
            <strong className="text-foreground font-mono">₹{(siteFinancials.totalMaterialExpense - (siteFinancials.totalStoreRoomExpense || 0)).toLocaleString()}</strong>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1">
              <Warehouse className="w-3 h-3 text-emerald-600" /> Store Room:
            </span>
            <strong className="text-emerald-700 dark:text-emerald-400 font-mono">₹{(siteFinancials.totalStoreRoomExpense || 0).toLocaleString()}</strong>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <span className="text-purple-800 dark:text-purple-300 font-semibold flex items-center gap-1">
              <Users className="w-3 h-3 text-purple-600" /> Wages:
            </span>
            <strong className="text-purple-700 dark:text-purple-400 font-mono">₹{siteFinancials.totalLabourExpense.toLocaleString()}</strong>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40 border border-border/40">
            <span className="text-muted-foreground">🚚 Transport:</span>
            <strong className="text-foreground font-mono">₹{siteFinancials.totalTransportExpense.toLocaleString()}</strong>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-amber-600" /> Rentals:
            </span>
            <strong className="text-amber-700 dark:text-amber-400 font-mono">₹{siteFinancials.totalRentalExpense.toLocaleString()}</strong>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40 border border-border/40">
            <span className="text-muted-foreground">☕ Incidentals:</span>
            <strong className="text-foreground font-mono">₹{siteFinancials.totalMiscExpense.toLocaleString()}</strong>
          </div>
        </div>
      </Card>

      {/* Site Material Hub: Stock on Hand & Requisitions/Deliveries */}
      <div className="bg-card p-4 rounded-2xl border border-border/70 shadow-xs space-y-4">
        {/* Hub Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-heading font-black text-foreground uppercase tracking-wide">
                Materials & Logistics on Site
              </h4>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Available physical stock, pending requisitions, and incoming dispatches for {site.name}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setShowReqModal(true)}
              className="h-8 text-xs font-bold gap-1.5 rounded-xl text-white shadow-xs"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              <Plus className="w-3.5 h-3.5" /> Requisition Material
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowInterSiteTransfer(true)}
              className="h-8 text-xs font-bold gap-1 rounded-xl text-primary border-primary/25 bg-primary/5 hover:bg-primary/10"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer From Other Site
            </Button>
          </div>
        </div>

        {/* 1. Verified Stock on Hand */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" /> Stock on Hand ({availableStock.length})
            </span>
          </div>

          {availableStock.length === 0 ? (
            <div className="p-3 rounded-xl bg-muted/30 border border-border/40 text-xs text-muted-foreground italic flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground/60 shrink-0" />
              <span>No completed/delivered stock on hand currently logged at this site.</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableStock.map((stock, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 border border-border/60 text-xs font-bold shadow-2xs"
                >
                  <Package className="w-3.5 h-3.5 text-primary" />
                  <span>{stock.name}:</span>
                  <strong className="text-primary font-mono">{stock.qty} {stock.unit}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 2. Site Requisitions & Deliveries (Pending, Assigned, Completed) */}
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-blue-500" /> Requisitions & Deliveries for this Site ({siteRequests.length})
            </span>
          </div>

          {siteRequests.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 text-xs text-muted-foreground flex items-center justify-between">
              <span className="italic">No requisitions or deliveries registered for this site yet.</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowReqModal(true)}
                className="h-7 text-xs text-primary font-bold hover:underline p-0"
              >
                + Requisition now
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {siteRequests.map(req => {
                const isPending = req.status === 'pending';
                const isAssigned = req.status === 'assigned';
                const isCompleted = req.status === 'completed';

                return (
                  <div
                    key={req.id}
                    className={`p-3.5 rounded-2xl border text-xs space-y-2.5 transition-all ${isAssigned
                        ? 'bg-blue-500/5 border-blue-500/30'
                        : isPending
                          ? 'bg-amber-500/5 border-amber-500/30'
                          : 'bg-card border-border/60'
                      }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${isAssigned
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                              : isPending
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            }`}
                        >
                          {isAssigned && <Truck className="w-3 h-3" />}
                          {isPending && <Clock className="w-3 h-3" />}
                          {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                          {isAssigned ? 'In Transit / Dispatched' : isPending ? 'Awaiting Dispatch' : 'Delivered & Completed'}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {req.date} {req.time}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPending && (
                          <Button
                            size="sm"
                            onClick={() => setAssignModal({ open: true, request: req })}
                            className="h-7 px-2.5 rounded-lg text-white font-bold text-[11px] shadow-xs"
                            style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                          >
                            <Truck className="w-3 h-3 mr-1" /> Assign Staff / Dispatch
                          </Button>
                        )}
                        {isAssigned && (
                          <Button
                            size="sm"
                            onClick={() => setCompleteModal({ open: true, request: req })}
                            className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Complete Delivery
                          </Button>
                        )}
                        {isCompleted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCompleteModal({ open: true, request: req })}
                            className="h-7 px-2.5 rounded-lg border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold text-[11px] shadow-xs"
                          >
                            <PenLine className="w-3 h-3 mr-1" /> Edit Rates & GST
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Materials Ordered */}
                    <div className="flex flex-wrap gap-1.5">
                      {req.items.map((it, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-card border border-border/60 font-semibold text-[11px] text-foreground flex items-center gap-1.5"
                        >
                          <Package className="w-3 h-3 text-primary" />
                          {it.name}: <strong className="text-primary font-mono">{it.quantity} {it.unit}</strong>
                          {it.rate ? <span className="text-muted-foreground text-[10px]">(₹{it.supplierRate ?? it.rate}/{it.unit})</span> : null}
                          {(it.gstAmount || 0) > 0 && (
                            it.gstType === 'cgst_sgst' ? (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold border border-blue-500/20">
                                CGST {it.cgstRate}% + SGST {it.sgstRate}%
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold border border-primary/20">
                                +{it.gstRate}% GST
                              </span>
                            )
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Logistics & Supplier Meta */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                      {(req.isStoreRoom || req.sourceType === 'store_room') && (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Warehouse className="w-3 h-3" /> Central Store Room / Warehouse
                        </span>
                      )}
                      {req.supplierName && (
                        <span>🏢 Supplier: <strong className="text-foreground">{req.supplierName}</strong></span>
                      )}
                      {req.sourceSiteName && (
                        <span>🔄 Transferred From: <strong className="text-foreground">{req.sourceSiteName}</strong></span>
                      )}
                      {req.driverName && (
                        <span>👤 Driver: <strong className="text-foreground">{req.driverName}</strong></span>
                      )}
                      {req.vehicleName && (
                        <span>🚗 Vehicle: <strong className="text-foreground">{req.vehicleName}</strong></span>
                      )}
                    </div>

                    {(req.supplierPrice !== undefined || req.storeRoomAmount !== undefined || (req.isStoreRoom && req.materialCost !== undefined)) ? (
                      <div className="w-full mt-2 border-t border-border/40 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-black text-foreground uppercase tracking-wider flex items-center gap-1">
                            {req.isStoreRoom || req.sourceType === 'store_room' ? (
                              <>
                                <Warehouse className="w-3.5 h-3.5 text-emerald-600" />
                                Store Room Billed to Site
                              </>
                            ) : 'Site Total Bill'}
                          </span>
                          <span className={`font-bold text-sm font-mono ${req.isStoreRoom || req.sourceType === 'store_room' ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}`}>
                            ₹{(req.storeRoomAmount ?? req.supplierPrice ?? req.materialCost ?? 0).toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="p-3 bg-muted/30 rounded-xl border border-border/50 space-y-1.5 text-[11px]">
                          {req.isStoreRoom || req.sourceType === 'store_room' ? (
                            <div className="flex justify-between items-center text-muted-foreground">
                              <span>Warehouse Item / Usage Value:</span>
                              <span className="font-mono font-semibold text-foreground">
                                ₹{(req.storeRoomAmount ?? req.materialCost ?? 0).toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center text-muted-foreground">
                              <span>Material Subtotal:</span>
                              <span className="font-mono font-semibold text-foreground">
                                ₹{((req.supplierPrice || 0) - (req.gstAmount || 0)).toLocaleString()}
                              </span>
                            </div>
                          )}
                          
                          {(req.gstAmount || 0) > 0 && !(req.isStoreRoom || req.sourceType === 'store_room') && (
                            req.gstType === 'inter-state' ? (
                              <div className="flex justify-between items-center text-muted-foreground">
                                <span>IGST ({req.igstRate || 0}%):</span>
                                <span className="font-mono font-semibold text-foreground">₹{req.gstAmount?.toLocaleString()}</span>
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between items-center text-muted-foreground">
                                  <span>CGST ({req.cgstRate || ((req.igstRate || 0) / 2)}%):</span>
                                  <span className="font-mono font-semibold text-foreground">₹{((req.gstAmount || 0) / 2).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-muted-foreground">
                                  <span>SGST ({req.sgstRate || ((req.igstRate || 0) / 2)}%):</span>
                                  <span className="font-mono font-semibold text-foreground">₹{((req.gstAmount || 0) / 2).toLocaleString()}</span>
                                </div>
                              </>
                            )
                          )}
                        </div>
                      </div>
                    ) : null}

                    {req.notes && (
                      <p className="text-[11px] text-muted-foreground italic bg-muted/40 px-2.5 py-1 rounded-lg">
                        "{req.notes}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Central Store Room Inventory & Equipment Deployed on Site */}
        <div className="space-y-2 pt-3 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Central Store Room Items on Site ({siteStoreRoomDispatches.length})
            </span>
            {(siteFinancials.totalStoreRoomExpense || 0) > 0 && (
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                Total Billed / Active: ₹{(siteFinancials.totalStoreRoomExpense || 0).toLocaleString()}
              </span>
            )}
          </div>

          {siteStoreRoomDispatches.length === 0 ? (
            <div className="p-3 rounded-xl bg-muted/20 border border-border/40 text-xs text-muted-foreground italic flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-muted-foreground/60 shrink-0" />
              <span>No Store Room materials or equipment deployed to this site yet.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {siteStoreRoomDispatches.map(record => {
                const isReturned = record.status === 'returned';
                const sDate = record.deliveryDate || record.startDate || record.date || today;
                let days = record.totalDays || 1;
                if (!isReturned) {
                  try {
                    const s = new Date(sDate);
                    const now = new Date();
                    if (!isNaN(s.getTime())) {
                      days = Math.max(1, Math.ceil((now.getTime() - s.getTime()) / 86400000));
                    }
                  } catch {
                    days = 1;
                  }
                }
                const billedVal = Number(record.storeRoomAmount) || Number(record.storeRoomProfit) || ((record.perDayRate || 0) * days * (record.quantity || 1));

                return (
                  <div
                    key={record.id}
                    className={`p-3 rounded-2xl border text-xs space-y-2 ${
                      isReturned ? 'bg-card border-border/60' : 'bg-emerald-500/5 border-emerald-500/30'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${
                          isReturned
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          <Warehouse className="w-3 h-3" />
                          {isReturned ? (record.destinationType === 'other_site' ? 'Transferred to Other Site' : 'Returned to Warehouse') : 'Active on Site'}
                        </span>
                        <span className="font-bold text-foreground text-sm">
                          {record.materialName}
                        </span>
                        <span className="text-primary font-mono font-bold">
                          ({record.quantity} {record.unit})
                        </span>
                      </div>

                      {billedVal > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground mr-1">{isReturned ? 'Billed to Site:' : 'Current Cost:'}</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                            ₹{billedVal.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground bg-muted/20 p-2 rounded-xl">
                      <div>
                        <span>Delivered / Start:</span> <strong className="text-foreground">{record.deliveryDate || record.startDate || record.date}</strong>
                      </div>
                      <div>
                        <span>Duration:</span> <strong className="text-foreground">{days} {days === 1 ? 'day' : 'days'}</strong>
                      </div>
                      <div>
                        <span>Daily Rate:</span> <strong className="text-foreground">{record.perDayRate ? `₹${record.perDayRate}/${record.unit}/day` : 'N/A'}</strong>
                      </div>
                      <div>
                        <span>{isReturned ? 'Return / Transfer Date:' : 'Status:'}</span>{' '}
                        <strong className="text-foreground">{isReturned ? (record.returnDate || 'Completed') : 'In Use'}</strong>
                      </div>
                    </div>

                    {(record.driverName || record.vehicleNumber || record.notes) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        {record.driverName && <span>👤 Driver: <strong className="text-foreground">{record.driverName}</strong></span>}
                        {record.vehicleNumber && <span>🚛 Vehicle: <strong className="text-foreground">{record.vehicleNumber}</strong></span>}
                        {record.notes && <span className="italic">Notes: {record.notes}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SITE RENTAL PRODUCTS & EQUIPMENT TRACKER ── */}
      <div className="bg-card p-4 sm:p-5 rounded-2xl border border-amber-500/30 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-600" />
              <h4 className="text-sm font-heading font-extrabold text-foreground uppercase tracking-wide">
                Site Material Rentals & Scaffolding Tracker
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                {activeSiteRentals.length} Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Deploy rental materials to this site, assign transit drivers, track daily duration, and calculate closing rental costs.
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setRentalMatId('');
              setRentalMatName('');
              setRentalQuantity('1');
              setRentalRatePerDay('');
              setRentalStartDate(today);
              setRentalRequiresDriver(false);
              setShowDeployRental(true);
            }}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 text-white shadow-xs self-start sm:self-auto bg-amber-600 hover:bg-amber-700"
          >
            <Plus className="w-3.5 h-3.5" /> Deploy Material to Site
          </Button>
        </div>

        {/* Filter Pills + Search Bar + Quick KPI Summary */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-muted/40 rounded-xl border border-border/40 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-muted-foreground mr-1">Status:</span>
            <button
              type="button"
              onClick={() => setSiteRentalFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                siteRentalFilter === 'all'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border/50'
              }`}
            >
              All ({siteRentals.length})
            </button>
            <button
              type="button"
              onClick={() => setSiteRentalFilter('active')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                siteRentalFilter === 'active'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border/50'
              }`}
            >
              Active On Site ({activeSiteRentals.length})
            </button>
            <button
              type="button"
              onClick={() => setSiteRentalFilter('returned')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                siteRentalFilter === 'returned'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border/50'
              }`}
            >
              Returned / Settled ({returnedSiteRentals.length})
            </button>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            <div className="relative w-48 sm:w-56">
              <Input
                value={siteRentalSearch}
                onChange={e => setSiteRentalSearch(e.target.value)}
                placeholder="Search rentals by name or note..."
                className="h-8 text-xs rounded-lg pr-6"
              />
              {siteRentalSearch && (
                <button
                  type="button"
                  onClick={() => setSiteRentalSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ×
                </button>
              )}
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] text-muted-foreground block font-semibold uppercase">Total Rental Cost:</span>
              <span className="font-mono text-sm font-extrabold text-amber-600 dark:text-amber-400">
                ₹{siteFinancials.totalRentalExpense.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Formula Hint */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
          <span>Formula: (Days on site) × (Qty) × (Rate/day per product) + Transit Cost</span>
          <span className="font-mono font-medium">Site: {site.name}</span>
        </div>

        {/* Rental Cards List */}
        {displayedSiteRentals.length === 0 ? (
          <div className="text-center py-10 bg-muted/20 rounded-2xl border border-dashed border-border/60">
            <RefreshCw className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">
              {siteRentalSearch ? `No rental items matching "${siteRentalSearch}"` : 'No rental records for this site'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {siteRentalSearch ? 'Try another search term or change the status filter.' : 'Scaffolding, machinery, and equipment deployed to this site will show here with full rate & duration tracking.'}
            </p>
            <Button
              size="sm"
              onClick={() => {
                setRentalMatId('');
                setRentalMatName('');
                setRentalQuantity('1');
                setRentalRatePerDay('');
                setRentalStartDate(today);
                setRentalRequiresDriver(false);
                setShowDeployRental(true);
              }}
              className="mt-3 h-8 text-xs font-bold gap-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Deploy Material to Site
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {displayedSiteRentals.map(rental => {
              const todayStr = format(new Date(), 'yyyy-MM-dd');
              const startMs = new Date(rental.startDate + 'T00:00:00').getTime();
              const currentEnd = rental.endDate || todayStr;
              const currentEndMs = new Date(currentEnd + 'T00:00:00').getTime();
              const daysActive = Math.max(1, Math.floor((currentEndMs - startMs) / 86400000) + 1);
              const isActive = rental.status === 'active';
              const calculatedRent = (rental.totalRentalCost !== undefined && !isActive)
                ? rental.totalRentalCost
                : (daysActive * rental.quantity * (rental.rentalRatePerDay || 0)) + (rental.transitCost || 0);

              return (
                <Card
                  key={rental.id}
                  className={`p-4 rounded-2xl bg-card border shadow-xs space-y-3 transition-all ${
                    isActive ? 'border-amber-500/40 hover:border-amber-500/60 shadow-2xs' : 'border-border/60 opacity-95'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border/40">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-heading font-bold text-base text-foreground">
                          {rental.materialName}
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 font-mono">
                          {rental.quantity} {rental.unit}
                        </span>
                        {isActive ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active On Site ({daysActive} Days)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted text-muted-foreground border border-border/50 flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Returned ({rental.totalDays || daysActive} Days Total)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-semibold text-foreground">{rental.siteName || site.name}</span>
                        <span>•</span>
                        <span>Start Date: <strong>{format(new Date(rental.startDate + 'T00:00:00'), 'dd MMM yyyy')}</strong></span>
                        {rental.endDate && (
                          <>
                            <span>•</span>
                            <span>End Date: <strong>{format(new Date(rental.endDate + 'T00:00:00'), 'dd MMM yyyy')}</strong></span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right Amount Badge & Actions */}
                    <div className="flex items-center gap-2 sm:self-center flex-wrap justify-end">
                      <div className="text-right mr-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          {isActive ? 'Accrued Rent to Date' : 'Final Total Rental Cost'}
                        </span>
                        <span className={`font-heading font-black text-lg ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                          ₹{calculatedRent.toLocaleString()}
                        </span>
                      </div>

                      {isActive ? (
                        <Button
                          size="sm"
                          onClick={() => openReturnRentalModal(rental)}
                          className="h-9 px-3 rounded-xl text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Return & Settle
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openReturnRentalModal(rental)}
                          className="h-9 px-3 rounded-xl text-xs font-semibold gap-1"
                        >
                          <PenLine className="w-3.5 h-3.5" /> Adjust Calculation
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete rental record for "${rental.materialName}"?`)) {
                            deleteMaterialRental(rental.id);
                            toast.success('Rental record deleted');
                          }
                        }}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Calculation Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl bg-muted/20 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Rate per Unit/Day:</span>
                      <span className="font-bold text-foreground">₹{rental.rentalRatePerDay || 0} / day</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Duration on Site:</span>
                      <span className="font-bold text-foreground">
                        {isActive ? `${daysActive} Days (Running)` : `${rental.totalDays || daysActive} Days Total`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Driver & Transit:</span>
                      {rental.requiresDriver ? (
                        <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          {rental.driverName || 'Assigned Driver'} {rental.transitCost ? `(₹${rental.transitCost.toLocaleString()})` : ''}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not Required</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Material Rent Subtotal:</span>
                      <span className="font-bold font-mono text-foreground">
                        {isActive ? daysActive : (rental.totalDays || daysActive)}d × {rental.quantity} × ₹{rental.rentalRatePerDay || 0} = ₹{((isActive ? daysActive : (rental.totalDays || daysActive)) * rental.quantity * (rental.rentalRatePerDay || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Notes / Comments */}
                  {rental.notes && (
                    <p className="text-[11px] text-muted-foreground italic bg-muted/40 px-3 py-1.5 rounded-xl border border-border/30">
                      "{rental.notes}"
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Work Entry Toggle */}
      <div className="animate-slide-up">
        {!showAddLog ? (
          todayLog ? (
            /* ── Today's Entry Exists: Show Summary + Edit ── */
            <Card className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Today's Work Entry Submitted</p>
                    <p className="text-[11px] text-muted-foreground">{today} · {site.name}</p>
                  </div>
                </div>
                <Button
                  onClick={() => startEditLog(todayLog)}
                  variant="outline"
                  className="h-9 px-4 rounded-xl text-xs font-bold border-primary/40 text-primary hover:bg-primary/10 flex items-center gap-1.5"
                >
                  <PenLine className="w-3.5 h-3.5" /> Edit Entry
                </Button>
              </div>

              {/* Summary of today's log */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-card border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Workers</span>
                  <p className="font-bold text-foreground">{todayLog.workerIds?.length || 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Materials</span>
                  <p className="font-bold text-foreground">{todayLog.materials?.length || 0} items</p>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Expenses</span>
                  <p className="font-bold text-foreground">₹{(todayLog.expenses || []).reduce((s, e) => s + e.amount, 0).toLocaleString()}</p>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Income</span>
                  <p className="font-bold text-foreground">₹{(todayLog.incomeFromClient || 0).toLocaleString()}</p>
                </div>
              </div>

              {todayLog.notes && (
                <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">
                  <strong className="text-foreground">Notes:</strong> {todayLog.notes}
                </p>
              )}
            </Card>
          ) : (
            /* ── No Entry Today: Show Add Button ── */
            <Button
              onClick={() => {
                setEditingLogId(null);
                setSelectedWorkers(site.assignedStaffIds || []);
                setShowAddLog(true);
              }}
              className="w-full h-11 rounded-xl text-white font-semibold flex items-center justify-center gap-2 shadow-sm"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              <Plus className="w-4 h-4" /> Add Daily Work Entry
            </Button>
          )
        ) : (
          <div className="form-card mb-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <p className="font-heading font-bold text-sm flex items-center gap-2 m-0">
                <Send className="w-4 h-4 text-primary" /> {editingLogId ? 'Edit Work Entry' : 'Daily Work Entry'}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => { setShowAddLog(false); setEditingLogId(null); }}
                className="w-7 h-7 rounded-full"
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleAddLog} className="space-y-4">
              {/* Workers on Duty */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <Users className="w-3.5 h-3.5" /> Workers on Duty ({selectedWorkers.length})
                </Label>
                <div className="grid grid-cols-2 gap-1.5 max-h-[130px] overflow-y-auto bg-muted/30 p-2 rounded-xl border border-border/50">
                  {staffList.filter(s => s.role !== 'supervisor').map(s => {
                    const isChecked = selectedWorkers.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-xs p-1 hover:bg-muted/50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          className="rounded"
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedWorkers(prev => [...prev, s.id]);
                            } else {
                              setSelectedWorkers(prev => prev.filter(id => id !== s.id));
                            }
                          }}
                        />
                        <span className="truncate font-medium">{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Materials Used / Added Today */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <Package className="w-3.5 h-3.5" /> Materials Used / Added Today
                </Label>
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <Select value={matId} onValueChange={handleMatSelection}>
                      <SelectTrigger className="h-10 rounded-xl text-xs">
                        <SelectValue placeholder="Select Material" />
                      </SelectTrigger>
                      <SelectContent>
                        {materialSettings.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} {m.perUnitWeight ? `(${m.perUnitWeight})` : ''}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">+ Custom Item</SelectItem>
                      </SelectContent>
                    </Select>

                    {matId === 'custom' && (
                      <Input
                        placeholder="Material Name"
                        value={matName}
                        onChange={e => setMatName(e.target.value)}
                        className="h-10 rounded-xl text-xs"
                      />
                    )}

                    <Input
                      type="number"
                      placeholder="Qty"
                      min="0.1"
                      step="any"
                      value={matQty}
                      onChange={e => setMatQty(e.target.value)}
                      className="h-10 rounded-xl text-xs"
                    />

                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Cost (₹)"
                        value={matCost}
                        onChange={e => setMatCost(e.target.value)}
                        className="h-10 rounded-xl text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={addMaterial}
                        className="h-10 w-10 rounded-xl shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {materials.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {materials.map((m, i) => (
                        <div key={i} className="flex items-center justify-between bg-muted/50 rounded-xl px-3 py-1.5 text-xs">
                          <span className="font-semibold text-foreground">{m.name} × {m.quantity}</span>
                          <div className="flex items-center gap-2">
                            {m.cost > 0 && <span className="font-semibold text-primary">₹{m.cost * m.quantity}</span>}
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeMaterial(i)} className="h-6 w-6">
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Expenses */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <Truck className="w-3.5 h-3.5" /> Expenses
                </Label>
                <div className="flex gap-2">
                  <Select value={expenseMode} onValueChange={setExpenseMode}>
                    <SelectTrigger className="w-32 h-10 rounded-xl capitalize shrink-0 text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bus">Bus / Travel</SelectItem>
                      <SelectItem value="petrol">Petrol Allowance / Fuel</SelectItem>
                      <SelectItem value="food">Food</SelectItem>
                      <SelectItem value="accommodation">Accommodation</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>

                  {expenseMode === 'other' && (
                    <Input
                      placeholder="Name"
                      value={expenseCustom}
                      onChange={e => setExpenseCustom(e.target.value)}
                      className="flex-1 h-10 rounded-xl text-xs"
                    />
                  )}

                  <Input
                    type="number"
                    placeholder="₹"
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    className="w-20 h-10 rounded-xl text-xs shrink-0"
                  />

                  <Button type="button" variant="outline" size="icon" onClick={addExpense} className="h-10 w-10 rounded-xl shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {expenses.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {expenses.map((e, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted/50 rounded-xl px-3 py-1.5 text-xs">
                        <span className="font-medium capitalize">{e.itemName}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-destructive">₹{e.amount}</span>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeExpense(i)} className="h-6 w-6">
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Income */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5" /> Income from Client
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <Input
                    type="number"
                    placeholder="₹ 0"
                    value={income}
                    onChange={e => setIncome(e.target.value)}
                    className="h-10 rounded-xl text-xs font-semibold"
                  />
                  <Select value={incomePaymentMethod} onValueChange={(v: any) => setIncomePaymentMethod(v)}>
                    <SelectTrigger className="h-10 rounded-xl text-xs bg-card">
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">💵 Cash</SelectItem>
                      <SelectItem value="UPI">📱 UPI / GPay / PhonePe</SelectItem>
                      <SelectItem value="Bank Transfer">🏦 Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">📝 Cheque</SelectItem>
                      <SelectItem value="Card">💳 Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Notes</Label>
                <Textarea
                  placeholder="Work done..."
                  value={logNotes}
                  onChange={e => setLogNotes(e.target.value)}
                  className="mt-1 min-h-[60px] rounded-xl text-xs"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl text-white font-semibold text-xs shadow-sm"
                style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
              >
                {editingLogId ? 'Update Work Log' : 'Submit Work Log'}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Date Range Filter & History Header */}
      <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-heading font-bold text-sm text-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Site Work & Expense History
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Daily employee attendance, crew counts, itemized expenses, and client collections
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadSiteHistoryPDF}
              className="h-8 rounded-xl text-xs gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/5"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export History (PDF)
            </Button>
          </div>
        </div>

        {/* Date Inputs + Quick Preset Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Range:</span>
            <Input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-8 w-32 rounded-lg text-xs"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-8 w-32 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setFromDate(format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd'));
                setToDate(today);
              }}
              className="text-[10px] font-semibold px-2 py-1 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => {
                setFromDate(format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd'));
                setToDate(today);
              }}
              className="text-[10px] font-semibold px-2 py-1 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => {
                setFromDate(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
                setToDate(today);
              }}
              className="text-[10px] font-semibold px-2 py-1 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => {
                setFromDate(defaultFromDate);
                setToDate(today);
              }}
              className="text-[10px] font-semibold px-2 py-1 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              All Time
            </button>
          </div>
        </div>

        {/* Selected Range Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40">
          <div className="p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/15">
            <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300 block">Active Days</span>
            <span className="font-heading font-bold text-base text-foreground">
              {rangeHistoryData.totalActiveDays} <span className="text-xs font-normal text-muted-foreground">Days</span>
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 block">Total Workforce</span>
            <span className="font-heading font-bold text-base text-foreground">
              {rangeHistoryData.totalManDays} <span className="text-xs font-normal text-muted-foreground">Man-Days</span>
            </span>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {rangeHistoryData.totalStaffDays} Staff • {rangeHistoryData.totalCrewDays} Crew
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/15">
            <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300 block">Total Expenses</span>
            <span className="font-heading font-bold text-base text-destructive">
              ₹{rangeHistoryData.totalExpenses.toLocaleString()}
            </span>
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
              Mat: ₹{rangeHistoryData.totalMaterialsCost.toLocaleString()} • Trnsp: ₹{rangeHistoryData.totalTransportCost.toLocaleString()}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">Client Income</span>
            <span className="font-heading font-bold text-base text-emerald-600">
              ₹{rangeHistoryData.totalIncome.toLocaleString()}
            </span>
            <div className={`text-[10px] font-semibold mt-0.5 ${rangeHistoryData.rangeNetBalance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
              Net: {rangeHistoryData.rangeNetBalance >= 0 ? '+' : ''}₹{rangeHistoryData.rangeNetBalance.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Grouped Logs by Date */}
      <div className="space-y-4">
        {rangeHistoryData.days.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border/50 text-muted-foreground text-xs">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium text-foreground">No site activity or logs found</p>
            <p className="text-[11px] text-muted-foreground mt-1">Try expanding the date range above to view earlier records.</p>
          </div>
        ) : (
          rangeHistoryData.days.map(day => (
            <Card key={day.date} className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3.5">
              {/* Day Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-heading font-bold text-sm text-foreground block leading-tight">
                      {format(new Date(day.date + 'T00:00:00'), 'EEEE, dd MMMM yyyy')}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground font-mono">
                      {day.logs.length} {day.logs.length === 1 ? 'work entry' : 'work entries'}
                      {day.dayRequests.length > 0 ? ` • ${day.dayRequests.length} dispatch` : ''}
                    </span>
                  </div>
                </div>

                {/* Day Summary Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Workers Count Badge */}
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-500/20">
                    <Users className="w-3.5 h-3.5" />
                    {day.totalWorkers} {day.totalWorkers === 1 ? 'Worker' : 'Workers'}
                  </span>

                  {/* Daily Expenses Badge */}
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-500/20">
                    <TrendingDown className="w-3.5 h-3.5" />
                    ₹{day.dayTotalExpense.toLocaleString()}
                  </span>

                  {/* Daily Income Badge (if any) */}
                  {day.dayTotalIncome > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-500/20">
                      <IndianRupee className="w-3.5 h-3.5" />
                      +₹{day.dayTotalIncome.toLocaleString()}
                    </span>
                  )}

                  {/* Day Net Balance */}
                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold border ${
                    day.dayNetBalance >= 0
                      ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/20'
                      : 'bg-muted/80 text-muted-foreground border-border/50'
                  }`}>
                    Net: {day.dayNetBalance >= 0 ? '+' : ''}₹{day.dayNetBalance.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* SECTION 1: WORKFORCE ON SITE */}
              <div className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    Workforce on Site ({day.totalWorkers} Total)
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {day.namedStaff.length} Staff • {day.totalCrew} Crew Members
                  </span>
                </div>

                {/* Named Staff Chips */}
                {day.namedStaff.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Staff:</span>
                    {day.namedStaff.map(s => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 bg-card px-2 py-1 rounded-lg text-xs font-semibold border border-border/60 shadow-2xs"
                      >
                        <UserCircle className="w-3.5 h-3.5 text-primary" />
                        <span>{s.name}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">({s.role})</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Crew Breakdown Chips */}
                {day.totalCrew > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-border/30">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Crew:</span>
                    {Object.entries(day.crewTypeCounts || {}).map(([typeKey, count]) => {
                      if (!count || count <= 0) return null;
                      const meta = getLabourTypeMeta(typeKey);
                      return (
                        <span key={typeKey} className="bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                          {meta.icon} {count} {meta.label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {day.totalWorkers === 0 && (
                  <p className="text-[11px] text-muted-foreground italic">No staff or crew logged for this date.</p>
                )}
              </div>

              {/* SECTION 2: COST & EXPENSES BREAKDOWN */}
              <div className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                    Daily Costs & Expenses (₹{day.dayTotalExpense.toLocaleString()} Total)
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground flex-wrap">
                    <span>Materials: ₹{day.dayMaterialsCost.toLocaleString()}</span>
                    <span>•</span>
                    <span>Transport: ₹{day.dayTransportCost.toLocaleString()}</span>
                    {day.dayRentalCost > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-amber-700 dark:text-amber-400 font-bold">Rentals: ₹{day.dayRentalCost.toLocaleString()}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>Misc: ₹{day.dayMiscCost.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {/* Column A: Materials Used */}
                  <div className="p-2 rounded-lg bg-card border border-border/50 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                      <span>Materials Used</span>
                      <span className="text-foreground font-semibold">₹{day.dayMaterialsCost.toLocaleString()}</span>
                    </span>
                    {day.materialsList.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">No materials logged</p>
                    ) : (
                      <div className="space-y-1">
                        {day.materialsList.map((m, mIdx) => (
                          <div key={mIdx} className="flex items-center justify-between text-[11px]">
                            <span className="truncate">{m.name} × {m.quantity}</span>
                            {m.total > 0 && (
                              <span className="font-semibold text-muted-foreground shrink-0">₹{m.total.toLocaleString()}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Column B: Transport & Travel */}
                  <div className="p-2 rounded-lg bg-card border border-border/50 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                      <span>Transport & Travel</span>
                      <span className="text-foreground font-semibold">₹{day.dayTransportCost.toLocaleString()}</span>
                    </span>
                    {day.dayTransportCost === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">No transport costs</p>
                    ) : (
                      <div className="space-y-1 text-[11px]">
                        {day.logTransportCost > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Staff Site Travel:</span>
                            <span className="font-semibold">₹{day.logTransportCost.toLocaleString()}</span>
                          </div>
                        )}
                        {day.reqTransportCost > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Requisition Transit & Fuel:</span>
                            <span className="font-semibold">₹{day.reqTransportCost.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Column C: Rental Materials & Machinery */}
                  <div className="p-2 rounded-lg bg-amber-500/[0.05] border border-amber-500/25 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 text-amber-600" /> Rentals on Site
                      </span>
                      <span className="font-semibold font-mono text-amber-700 dark:text-amber-400">₹{day.dayRentalCost.toLocaleString()}</span>
                    </span>
                    {day.dayRentalsList.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">No rentals active today</p>
                    ) : (
                      <div className="space-y-1">
                        {day.dayRentalsList.map((r, rIdx) => (
                          <div key={rIdx} className="flex items-center justify-between text-[11px]">
                            <span className="truncate text-foreground font-medium">{r.name} ({r.quantity} {r.unit})</span>
                            <span className="font-semibold font-mono text-amber-700 dark:text-amber-400 shrink-0">₹{r.total.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Column D: Miscellaneous Incidentals */}
                  <div className="p-2 rounded-lg bg-card border border-border/50 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                      <span>Site Misc Expenses</span>
                      <span className="text-foreground font-semibold">₹{day.dayMiscCost.toLocaleString()}</span>
                    </span>
                    {day.miscExpensesList.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">No misc expenses</p>
                    ) : (
                      <div className="space-y-1">
                        {day.miscExpensesList.map((e, eIdx) => (
                          <div key={eIdx} className="flex items-center justify-between text-[11px]">
                            <span className="capitalize text-muted-foreground truncate">{e.itemName}:</span>
                            <span className="font-semibold text-destructive shrink-0">₹{e.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 3: MATERIAL REQUISITIONS / DELIVERIES ARRIVED */}
              {day.dayRequests.length > 0 && (
                <div className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-1.5">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-primary" />
                    Material Dispatches Delivered ({day.dayRequests.length})
                  </span>
                  <div className="space-y-1.5">
                    {day.dayRequests.map(r => (
                      <div key={r.id} className="p-2 bg-card rounded-lg border border-border/50 text-xs flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            {r.items.map(it => `${it.name} (${it.quantity} ${it.unit})`).join(', ')}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {r.sourceType === 'site' ? `Transferred from ${r.sourceSiteName}` : `Supplier: ${r.supplierName || 'Direct'}`}
                            {r.driverName ? ` • Driver: ${r.driverName} (${r.vehicle || 'Vehicle'})` : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-destructive">
                            ₹{((r.materialCost || r.supplierPrice || 0) + (r.driverCost || 0)).toLocaleString()}
                          </span>
                          <span className="text-[10px] block text-emerald-600 font-semibold capitalize">{r.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 4: CLIENT INCOME RECEIVED */}
              {day.dayTotalIncome > 0 && (
                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <IndianRupee className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-emerald-800 dark:text-emerald-200 block">
                        Income Received from Client
                      </span>
                      {day.dayMilestonePayments.map((p, pIdx) => (
                        <span key={pIdx} className="text-[11px] text-muted-foreground block">
                          Milestone [{p.stageName}]: ₹{p.amount.toLocaleString()} {p.note ? `(${p.note})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="font-heading font-bold text-sm text-emerald-600">
                    +₹{day.dayTotalIncome.toLocaleString()}
                  </span>
                </div>
              )}

              {/* SECTION 5: WORK LOG ENTRIES & NOTES */}
              {day.logs.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-border/30">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Detailed Work Logs & Descriptions:
                  </span>
                  {day.logs.map((log, lIdx) => (
                    <div key={log.id || lIdx} className="p-2.5 bg-muted/10 rounded-lg border border-border/30 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <UserCircle className="w-3.5 h-3.5 text-primary" />
                          {log.staffName}
                        </span>
                        {log.incomeFromClient > 0 && (
                          <span className="text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-[11px]">
                            +₹{log.incomeFromClient.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {log.notes && (
                        <p className="text-muted-foreground text-xs whitespace-pre-line bg-card/60 p-2 rounded-md border border-border/40">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Inter-Site Transfer Dialog */}
      <Dialog open={showInterSiteTransfer} onOpenChange={setShowInterSiteTransfer}>
        <DialogContent className="max-w-md rounded-2xl p-5">
          <DialogHeader className="pb-2 border-b border-border/50">
            <DialogTitle className="text-base font-heading font-bold flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              Transfer Material from Another Site
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleExecuteInterSiteTransfer} className="space-y-3 mt-2">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Source Site (With Stock) *</Label>
              {sourceSitesWithStock.length === 0 ? (
                <p className="text-xs text-destructive mt-1">No other sites have available stock to transfer.</p>
              ) : (
                <Select
                  value={transferSourceSiteId}
                  onValueChange={val => {
                    setTransferSourceSiteId(val);
                    setTransferMatName('');
                    setTransferQty('');
                  }}
                >
                  <SelectTrigger className="mt-1 h-10 rounded-xl text-xs">
                    <SelectValue placeholder="Select Source Site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceSitesWithStock.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {transferSourceSiteId && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Material in Stock *</Label>
                <Select
                  value={transferMatName}
                  onValueChange={val => {
                    setTransferMatName(val);
                    const st = sourceSiteStock.find(m => m.name === val);
                    if (st) setTransferQty(Math.min(1, st.qty).toString());
                  }}
                >
                  <SelectTrigger className="mt-1 h-10 rounded-xl text-xs">
                    <SelectValue placeholder="Select Material" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceSiteStock.map((st, i) => (
                      <SelectItem key={i} value={st.name}>
                        {st.name} ({st.qty} {st.unit} available)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {transferMatName && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Quantity *</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="any"
                  value={transferQty}
                  onChange={e => setTransferQty(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={!transferSourceSiteId || !transferMatName || !transferQty}
              className="w-full h-10 rounded-xl text-white font-bold text-xs shadow-sm mt-2"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              Confirm Inter-Site Transfer
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Requisition Material for this Site Dialog */}
      <Dialog open={showReqModal} onOpenChange={setShowReqModal}>
        <DialogContent className="max-w-md rounded-2xl p-5">
          <DialogHeader className="pb-2 border-b border-border/50">
            <DialogTitle className="text-base font-heading font-bold flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Requisition Material for {site.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSiteRequisition} className="space-y-3.5 mt-2">
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {reqItems.map((it, idx) => (
                <div key={idx} className="p-3 bg-muted/30 rounded-xl border border-border/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-muted-foreground uppercase">Item {idx + 1}</span>
                    {reqItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setReqItems(prev => prev.filter((_, i) => i !== idx))}
                        className="text-destructive hover:underline text-[10px] font-bold"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <Label className="text-[10px] text-muted-foreground font-semibold">Material *</Label>
                    <Select
                      value={it.name}
                      onValueChange={val => {
                        const setting = materialSettings.find(m => m.name === val);
                        setReqItems(prev => {
                          const copy = [...prev];
                          copy[idx] = {
                            ...copy[idx],
                            name: val,
                            unit: setting?.unit || copy[idx].unit,
                            rate: setting?.defaultRate ? setting.defaultRate.toString() : copy[idx].rate
                          };
                          return copy;
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 rounded-xl text-xs mt-0.5">
                        <SelectValue placeholder="Select Material Preset" />
                      </SelectTrigger>
                      <SelectContent>
                        {materialSettings.map(m => (
                          <SelectItem key={m.id} value={m.name}>
                            {m.name} · [{m.category || 'General'}] ({m.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-semibold">Quantity *</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder="Qty"
                        value={it.quantity}
                        onChange={e => {
                          const val = e.target.value;
                          setReqItems(prev => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], quantity: val };
                            return copy;
                          });
                        }}
                        className="h-8 rounded-lg text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-semibold">Unit</Label>
                      <Input
                        placeholder="e.g. Bags, Tons, Kg"
                        value={it.unit}
                        onChange={e => {
                          const val = e.target.value;
                          setReqItems(prev => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], unit: val };
                            return copy;
                          });
                        }}
                        className="h-8 rounded-lg text-xs mt-0.5"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px] text-muted-foreground font-semibold">Estimated Unit Rate (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 450"
                      value={it.rate}
                      onChange={e => {
                        const val = e.target.value;
                        setReqItems(prev => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], rate: val };
                          return copy;
                        });
                      }}
                      className="h-8 rounded-lg text-xs mt-0.5"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReqItems(prev => [...prev, { name: '', quantity: '1', unit: 'Bags', rate: '' }])}
              className="w-full h-8 text-xs font-semibold gap-1 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" /> Add Another Item
            </Button>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Select Supplier (Optional)</Label>
              <Select value={reqSupplierId} onValueChange={setReqSupplierId}>
                <SelectTrigger className="mt-1 h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Select Preferred Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(sup => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.name} ({sup.materialsSupplied})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Requisition Notes</Label>
              <Textarea
                placeholder="e.g. Needed urgently for foundation works..."
                value={reqNotes}
                onChange={e => setReqNotes(e.target.value)}
                className="mt-1 min-h-[50px] rounded-xl text-xs"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 rounded-xl text-white font-bold text-xs shadow-sm"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              Submit Material Requisition
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DEPLOY RENTAL MATERIAL TO THIS SITE MODAL ── */}
      <Dialog open={showDeployRental} onOpenChange={setShowDeployRental}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-600" />
              Deploy Rental Material to {site.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleDeployRentalToSite} className="space-y-4 pt-1 text-xs">
            {/* Quick Material Selection or Entry */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Rental Material / Equipment *</Label>
              {materialSettings.filter(m => m.isRental).length > 0 ? (
                <div className="space-y-2">
                  <Select
                    value={rentalMatId}
                    onValueChange={val => {
                      if (val === 'custom') {
                        setRentalMatId('');
                        setRentalMatName('');
                      } else {
                        handleSelectRentalPreset(val);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select from Rental Material Catalog" />
                    </SelectTrigger>
                    <SelectContent>
                      {materialSettings.filter(m => m.isRental).map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} {m.rentalRatePerDay ? `(₹${m.rentalRatePerDay}/day)` : ''}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">+ Custom / Enter Name Manually</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Material Name (e.g. Scaffolding Pipes, Concrete Mixer, Shuttering Plates)"
                    value={rentalMatName}
                    onChange={e => setRentalMatName(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>
              ) : (
                <Input
                  placeholder="Material Name (e.g. Scaffolding Pipes, Concrete Mixer Machine)"
                  value={rentalMatName}
                  onChange={e => setRentalMatName(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              )}
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Deployment Start Date on Site *</Label>
              <Input
                type="date"
                value={rentalStartDate}
                onChange={e => setRentalStartDate(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            {/* Quantity & Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Quantity Deployed *</Label>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  value={rentalQuantity}
                  onChange={e => setRentalQuantity(e.target.value)}
                  placeholder="e.g. 50"
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Unit</Label>
                <Select value={rentalUnit} onValueChange={setRentalUnit}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Sets', 'Nos', 'Units', 'Pieces', 'Boxes', 'Tons', 'Kg'].map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Daily Rental Rate */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Rental Rate Per Day (Per Unit / Product)</Label>
                <span className="text-[10px] text-muted-foreground">Adjustable at return time</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">₹</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={rentalRatePerDay}
                  onChange={e => setRentalRatePerDay(e.target.value)}
                  placeholder="e.g. 15 per day per set"
                  className="pl-7 h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Driver Requirement Section */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rentalRequiresDriver}
                    onChange={e => setRentalRequiresDriver(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-600" />
                    Driver & Vehicle Required for Transit
                  </span>
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {rentalRequiresDriver ? 'Driver will be assigned' : 'Direct on-site deployment'}
                </span>
              </div>

              {rentalRequiresDriver && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/40">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Assign Driver</Label>
                    <Select value={rentalDriverId} onValueChange={setRentalDriverId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select Driver" />
                      </SelectTrigger>
                      <SelectContent>
                        {driversList.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Assign Vehicle</Label>
                    <Select value={rentalVehicleId} onValueChange={setRentalVehicleId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select Vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.name} ({v.number})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Transit Cost (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={rentalTransitCost}
                      onChange={e => setRentalTransitCost(e.target.value)}
                      placeholder="e.g. 500"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notes / Identification / Serial No.</Label>
              <Textarea
                value={rentalNotes}
                onChange={e => setRentalNotes(e.target.value)}
                placeholder="e.g. 50 sets scaffolding pipes, delivered in good condition"
                className="text-xs min-h-[60px]"
              />
            </div>

            {/* Estimated Daily Cost Banner */}
            {(Number(rentalQuantity) > 0 && Number(rentalRatePerDay) > 0) && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                <span className="text-amber-800 dark:text-amber-300 font-semibold">Estimated Daily Cost:</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                  ₹{(Number(rentalQuantity) * Number(rentalRatePerDay)).toLocaleString()} / day
                </span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 rounded-xl text-white font-bold text-xs bg-amber-600 hover:bg-amber-700 shadow-sm"
            >
              Deploy Rental to Site
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── RETURN & CLOSE RENTAL CALCULATION MODAL FOR THIS SITE ── */}
      <Dialog
        open={returnRentalModal.open}
        onOpenChange={open => !open && setReturnRentalModal({ open: false, rental: null })}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Close Rental & Settle Calculations
            </DialogTitle>
          </DialogHeader>

          {returnRentalModal.rental && (() => {
            const r = returnRentalModal.rental;
            const startMs = new Date(r.startDate + 'T00:00:00').getTime();
            const endMs = new Date(returnEndDate + 'T00:00:00').getTime();
            const totalDays = Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1);
            const rateNum = Number(returnRatePerDay) || 0;
            const matRent = totalDays * r.quantity * rateNum;
            const transitCost = r.transitCost || 0;
            const totalCost = matRent + transitCost;

            return (
              <form onSubmit={handleConfirmReturnRental} className="space-y-4 pt-1 text-xs">
                {/* Deployment Overview Card */}
                <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{r.materialName}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                      {r.quantity} {r.unit}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-primary" /> Site: <span className="font-semibold text-foreground">{r.siteName}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <CalendarDays className="w-3 h-3" /> Deployed on: <span className="font-mono font-semibold text-foreground">{r.startDate}</span>
                  </div>
                  {r.requiresDriver && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <Truck className="w-3 h-3 text-blue-500" /> Driver: <span className="font-semibold text-foreground">{r.driverName || 'Assigned'}</span>
                      {r.vehicleNumber && ` (${r.vehicleNumber})`}
                      {r.transitCost ? ` • Transit: ₹${r.transitCost.toLocaleString()}` : ''}
                    </div>
                  )}
                </div>

                {/* Return Date & Rental Rate Input */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">End / Return Date *</Label>
                    <Input
                      type="date"
                      value={returnEndDate}
                      onChange={e => setReturnEndDate(e.target.value)}
                      className="h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Rate / Day per {r.unit || 'Product'} (₹)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">₹</span>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={returnRatePerDay}
                        onChange={e => setReturnRatePerDay(e.target.value)}
                        placeholder="Rate per day"
                        className="pl-7 h-9 text-xs font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Return Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Closing Notes / Condition on Return</Label>
                  <Textarea
                    value={returnNotes}
                    onChange={e => setReturnNotes(e.target.value)}
                    placeholder="e.g. Returned in good condition, no damage"
                    className="text-xs min-h-[50px]"
                  />
                </div>

                {/* Realtime Calculation Breakdown */}
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                    Final Cost Calculation Breakdown
                  </div>

                  <div className="space-y-1 pt-1 text-xs">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Deployment Duration:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {totalDays} {totalDays === 1 ? 'day' : 'days'} ({r.startDate} to {returnEndDate})
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Material Rental Calculation:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {totalDays} days × {r.quantity} {r.unit} × ₹{rateNum} = ₹{matRent.toLocaleString()}
                      </span>
                    </div>
                    {transitCost > 0 && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Transit / Driver Delivery Cost:</span>
                        <span className="font-mono font-semibold text-foreground">
                          + ₹{transitCost.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-border/50 flex justify-between items-center font-bold text-sm">
                      <span className="text-foreground">Total Rental Cost:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 text-base">
                        ₹{totalCost.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 rounded-xl text-white font-bold text-xs bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                >
                  Confirm Return & Settle Rental
                </Button>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AssignMaterialModal
        open={assignModal.open}
        onOpenChange={open => setAssignModal(prev => ({ ...prev, open }))}
        request={assignModal.request}
        driversList={driversList}
        staffList={staffList}
        suppliers={suppliers}
        vehicles={vehicles}
        materialSettings={materialSettings}
        onAssign={(id, data) => assignMaterialRequest(id, data)}
      />

      <CompleteMaterialModal
        open={completeModal.open}
        onOpenChange={open => setCompleteModal(prev => ({ ...prev, open }))}
        request={completeModal.request}
        materialSettings={materialSettings}
        staffList={staffList}
        onComplete={(id, data) => completeMaterialRequest(id, data)}
      />
    </div>
  );
};

// ── Sites Tab Main Component ──────────────────────────────
export const SitesTab = () => {
  const { sites, addSite, customers, addCustomer, staffList, materialRequests, materialRentals, stageCompletionRequests, dailyLogs, storeRoomDispatches = [] } = useApp();
  const { t } = useTranslation();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [name, setName] = useState('');
  const [addr, setAddr] = useState('');
  const [client, setClient] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [budget, setBudget] = useState('');
  const [totalLevels, setTotalLevels] = useState('5');
  const [levelDetails, setLevelDetails] = useState<string[]>(Array(10).fill(''));
  const [start, setStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [supervisor, setSupervisor] = useState('none');
  const [show, setShow] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('new');
  const [siteFilter, setSiteFilter] = useState<'all' | 'due' | 'active' | 'completed'>('all');
  const [siteSearch, setSiteSearch] = useState('');

  if (selectedSiteId) {
    return <SiteDetailView siteId={selectedSiteId} onBack={() => setSelectedSiteId(null)} />;
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Site name required'); return; }

    let finalClientName = '';

    if (selectedCustomerId === 'new') {
      if (!client.trim()) { toast.error('Client name required'); return; }
      finalClientName = client.trim();
      const existingClient = customers.find(c => c.phone === clientPhone.trim());
      if (!existingClient && clientPhone.trim()) {
        addCustomer({
          name: client.trim(),
          phone: clientPhone.trim(),
          email: clientEmail.trim(),
          category: 'direct',
          address: clientAddress.trim(),
          notes: ''
        });
      }
    } else {
      const selectedCust = customers.find(c => c.id === selectedCustomerId);
      if (!selectedCust) { toast.error('Please select a valid customer'); return; }
      finalClientName = selectedCust.name;
    }

    const levelsCount = Number(totalLevels) || 1;
    const initialStages = Array.from({ length: levelsCount }, (_, i) => {
      const detail = levelDetails[i]?.trim();
      return {
        stageName: detail ? `Level ${i + 1}: ${detail}` : `Level ${i + 1}`,
        expectedAmount: 0,
        paidAmount: 0,
        payments: [],
        completionStatus: (i === 0 ? 'in_progress' : 'pending') as 'in_progress' | 'pending'
      };
    });

    addSite({
      name,
      address: addr,
      clientName: finalClientName,
      status: 'active',
      startDate: start,
      budget: Number(budget) || 0,
      supervisorId: supervisor === 'none' ? undefined : supervisor,
      totalLevels: levelsCount,
      paymentStages: initialStages
    });

    toast.success('Site added!');
    setName(''); setAddr(''); setClient(''); setClientPhone(''); setClientEmail(''); setClientAddress('');
    setBudget(''); setTotalLevels('5'); setLevelDetails(Array(10).fill('')); setSupervisor('none'); setShow(false);
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="section-header">{t('sites.siteManagement')}</h3>
        <Button
          size="sm"
          onClick={() => setShow(v => !v)}
          className="h-8 rounded-xl gap-1.5 text-xs font-semibold text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Site
        </Button>
      </div>

      {show && (
        <div className="form-card">
          <form onSubmit={handleAdd} className="space-y-3">
            {[
              { label: 'Site Name', val: name, set: setName, ph: 'Villa Renovation' },
              { label: 'Address', val: addr, set: setAddr, ph: 'MG Road, Bangalore' },
            ].map(({ label, val, set, ph }) => (
              <div key={label}>
                <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
                <Input
                  placeholder={ph}
                  value={val}
                  onChange={e => set(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>
            ))}

            <div className="pt-2 border-t border-border/50">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                Client Details
              </Label>

              <div className="mb-3">
                <Label className="text-[10px] text-muted-foreground">Select Customer *</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="h-9 rounded-xl text-xs font-semibold">
                    <SelectValue placeholder="Select or Create New Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">+ Create New Customer</SelectItem>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.phone || 'No phone'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCustomerId === 'new' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">New Client Name *</Label>
                    <Input
                      placeholder="e.g. Ramesh Babu"
                      value={client}
                      onChange={e => setClient(e.target.value)}
                      className="h-9 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">New Client Phone</Label>
                    <Input
                      placeholder="9876543210"
                      value={clientPhone}
                      onChange={e => setClientPhone(e.target.value)}
                      className="h-9 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Budget (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Total Levels</Label>
                <Input
                  type="number"
                  min="1"
                  value={totalLevels}
                  onChange={e => {
                    setTotalLevels(e.target.value);
                  }}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={start}
                  onChange={e => setStart(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border/50">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                Level Breakdown (Work Details)
              </Label>
              <div className="space-y-2">
                {Array.from({ length: Math.min(Number(totalLevels) || 1, 20) }).map((_, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Label className="text-xs font-semibold whitespace-nowrap w-16 text-muted-foreground">Level {i + 1}</Label>
                    <Input
                      placeholder="e.g. Foundation, Roofing, Plastering..."
                      value={levelDetails[i] || ''}
                      onChange={e => {
                        const newDetails = [...levelDetails];
                        newDetails[i] = e.target.value;
                        setLevelDetails(newDetails);
                      }}
                      className="h-9 rounded-xl text-xs flex-1"
                    />
                  </div>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl text-white font-bold text-xs shadow-sm mt-2"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              Save Site
            </Button>
          </form>
        </div>
      )}

      {/* Sites Grid with Unique Under-Due Highlighting */}
      {(() => {
        const siteIds = new Set(sites.map(s => s.id));
        const allSites = [...sites];
        (dailyLogs || []).forEach(log => {
          if (log.siteId && !siteIds.has(log.siteId)) {
            siteIds.add(log.siteId);
            allSites.push({
              id: log.siteId,
              name: log.siteName || 'Custom Site Visit',
              clientName: 'Field Visit / External Log',
              address: log.siteName || 'External Site',
              status: 'active',
              budget: 0,
              paymentStages: [],
              assignedStaffIds: log.staffId ? [log.staffId] : [],
              supervisorId: log.staffId || '',
              startDate: log.date || today,
            });
          }
        });

        // Helper to check if any level is under due
        const getSiteDueInfo = (s: typeof allSites[0]) => {
          let totalDue = 0;
          let overdueCount = 0;
          const dueLevels: { stageName: string; balance: number; isOverdue: boolean }[] = [];

          (s.paymentStages || []).forEach(stage => {
            const expected = stage.expectedAmount || 0;
            const paid = stage.paidAmount || 0;
            const balance = Math.max(0, expected - paid);
            if (balance > 0 && expected > 0) {
              const isOverdue = !!(stage.dueDate && new Date(stage.dueDate) < new Date());
              if (isOverdue) overdueCount++;
              if (stage.completionStatus === 'completed' || isOverdue) {
                totalDue += balance;
                dueLevels.push({ stageName: stage.stageName, balance, isOverdue });
              }
            }
          });

          return {
            totalDue,
            overdueCount,
            dueLevels,
            hasDue: dueLevels.length > 0,
            hasOverdue: overdueCount > 0
          };
        };

        const sitesWithDue = allSites.filter(s => getSiteDueInfo(s).hasDue);
        const grandTotalDue = sitesWithDue.reduce((sum, s) => sum + getSiteDueInfo(s).totalDue, 0);

        // Filter and search
        const filteredSites = allSites.filter(s => {
          if (siteFilter === 'due' && !getSiteDueInfo(s).hasDue) return false;
          if (siteFilter === 'active' && s.status !== 'active') return false;
          if (siteFilter === 'completed' && s.status !== 'completed') return false;
          if (siteSearch.trim()) {
            const q = siteSearch.toLowerCase().trim();
            const matchName = s.name.toLowerCase().includes(q);
            const matchClient = (s.clientName || '').toLowerCase().includes(q);
            const matchAddr = (s.address || '').toLowerCase().includes(q);
            return matchName || matchClient || matchAddr;
          }
          return true;
        });

        return (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setSiteFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    siteFilter === 'all'
                      ? 'bg-foreground text-background shadow-xs'
                      : 'bg-muted/70 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All Sites ({allSites.length})
                </button>

                <button
                  onClick={() => setSiteFilter('due')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    siteFilter === 'due'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : sitesWithDue.length > 0
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                        : 'bg-muted/70 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Levels Under Due ({sitesWithDue.length})
                  {grandTotalDue > 0 && <span className="font-mono opacity-90">₹{grandTotalDue.toLocaleString()}</span>}
                </button>

                <button
                  onClick={() => setSiteFilter('active')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    siteFilter === 'active'
                      ? 'bg-foreground text-background shadow-xs'
                      : 'bg-muted/70 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Active ({allSites.filter(s => s.status === 'active').length})
                </button>

                <button
                  onClick={() => setSiteFilter('completed')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    siteFilter === 'completed'
                      ? 'bg-foreground text-background shadow-xs'
                      : 'bg-muted/70 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Completed ({allSites.filter(s => s.status === 'completed').length})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Input
                  value={siteSearch}
                  onChange={e => setSiteSearch(e.target.value)}
                  placeholder="Search site, client, or address..."
                  className="h-9 text-xs rounded-xl pr-7"
                />
                {siteSearch && (
                  <button
                    onClick={() => setSiteSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Global Alert Banner if Sites Have Levels Under Due */}
            {sitesWithDue.length > 0 && siteFilter !== 'due' && (
              <div className="p-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-card border border-amber-500/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-up">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground">
                      Level Dues Pending: <strong className="text-amber-600 dark:text-amber-400 font-extrabold font-mono text-sm">₹{grandTotalDue.toLocaleString()}</strong> across {sitesWithDue.length} site(s)
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Milestone work is completed or overdue. Sites with unpaid levels are highlighted with unique warning borders.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSiteFilter('due')}
                  className="h-7 text-xs font-bold rounded-lg border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 shrink-0"
                >
                  View Due Sites ({sitesWithDue.length})
                </Button>
              </div>
            )}

            {filteredSites.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-3xl border border-border/60">
                <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">No sites found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {siteFilter === 'due' ? 'No sites currently have levels under due.' : 'Try adjusting your search or filters.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSites.map(s => {
                  const dueInfo = getSiteDueInfo(s);

                  return (
                    <Card
                      key={s.id}
                      onClick={() => setSelectedSiteId(s.id)}
                      className={`p-5 rounded-3xl bg-card border shadow-luxury hover:shadow-luxury-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer space-y-3.5 group ${
                        dueInfo.hasOverdue
                          ? 'border-destructive/70 hover:border-destructive ring-2 ring-destructive/30 bg-gradient-to-br from-destructive/[0.05] via-destructive/[0.01] to-card shadow-md'
                          : dueInfo.hasDue
                            ? 'border-amber-500/70 hover:border-amber-500 ring-2 ring-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] via-amber-500/[0.01] to-card shadow-md'
                            : 'border-border/60 hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform ${
                            dueInfo.hasOverdue
                              ? 'bg-destructive/15 text-destructive ring-1 ring-destructive/30'
                              : dueInfo.hasDue
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30'
                                : 'bg-primary/10 text-primary'
                          }`}>
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-heading font-bold text-base text-foreground truncate">{s.name}</h4>
                            <p className="text-xs text-muted-foreground truncate">{s.clientName}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {/* Unique Status Badges For Levels Under Due */}
                          {dueInfo.hasOverdue ? (
                            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase bg-destructive/15 text-destructive border border-destructive/30 flex items-center gap-1 animate-pulse shadow-2xs">
                              <AlertCircle className="w-3 h-3" /> Overdue: ₹{dueInfo.totalDue.toLocaleString()}
                            </span>
                          ) : dueInfo.hasDue ? (
                            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-2xs">
                              <Wallet className="w-3 h-3 text-amber-600" /> Due: ₹{dueInfo.totalDue.toLocaleString()}
                            </span>
                          ) : null}

                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize shrink-0 ${statusBadge(s.status)}`}>
                            {s.status}
                          </span>
                        </div>
                      </div>

                      {s.address && (
                        <p className="text-xs text-muted-foreground/80 flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                          {s.address}
                        </p>
                      )}

                      {/* Unique Level Under Due Breakdown Strip */}
                      {dueInfo.hasDue && (
                        <div className={`p-2.5 rounded-2xl border text-xs space-y-1.5 ${
                          dueInfo.hasOverdue ? 'bg-destructive/10 border-destructive/30' : 'bg-amber-500/10 border-amber-500/30'
                        }`}>
                          <div className="flex items-center justify-between font-bold">
                            <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-foreground">
                              <Wallet className="w-3.5 h-3.5 text-amber-600" /> Level Under Due:
                            </span>
                            <span className={`font-mono text-sm font-extrabold ${dueInfo.hasOverdue ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'}`}>
                              ₹{dueInfo.totalDue.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            {dueInfo.dueLevels.map((st, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-lg bg-card/90 border border-border/60 font-semibold text-foreground">
                                {st.stageName}: <strong className={dueInfo.hasOverdue ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}>₹{st.balance.toLocaleString()}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs pt-3 border-t border-border/50 font-medium">
                        <span className="text-muted-foreground font-semibold">Budget: ₹{s.budget.toLocaleString()}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(() => {
                            const sReqs = (materialRequests || []).filter(r => r.siteId === s.id && r.status !== 'cancelled');
                            if (sReqs.length === 0) return null;
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                <Package className="w-3 h-3" /> {sReqs.length} {sReqs.length === 1 ? 'order' : 'orders'}
                              </span>
                            );
                          })()}
                          {(() => {
                            const sRentals = (materialRentals || []).filter(r => 
                              (r.siteId && (r.siteId === s.id || String(r.siteId) === String(s.id))) ||
                              (r.siteName && s.name && r.siteName.trim().toLowerCase() === s.name.trim().toLowerCase())
                            );
                            if (sRentals.length === 0) return null;
                            const activeCount = sRentals.filter(r => r.status === 'active').length;
                            const totalCost = sRentals.reduce((sum, r) => {
                              if (r.totalRentalCost !== undefined && r.status === 'returned') return sum + r.totalRentalCost;
                              const todayStr = format(new Date(), 'yyyy-MM-dd');
                              const startMs = new Date(r.startDate + 'T00:00:00').getTime();
                              const endMs = new Date((r.endDate || todayStr) + 'T00:00:00').getTime();
                              const days = Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1);
                              return sum + (days * (r.quantity || 1) * (r.rentalRatePerDay || 0)) + (r.transitCost || 0);
                            }, 0);

                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                <RefreshCw className="w-3 h-3" />
                                {activeCount > 0
                                  ? `${activeCount} active rental${activeCount > 1 ? 's' : ''}`
                                  : `${sRentals.length} rental${sRentals.length > 1 ? 's' : ''} (₹${totalCost.toLocaleString()})`
                                }
                              </span>
                            );
                          })()}
                          {(() => {
                            const sStoreItems = (storeRoomDispatches || []).filter(d => 
                              (d.siteId && (d.siteId === s.id || String(d.siteId) === String(s.id))) ||
                              (d.siteName && s.name && d.siteName.trim().toLowerCase() === s.name.trim().toLowerCase())
                            );
                            if (sStoreItems.length === 0) return null;
                            const activeCount = sStoreItems.filter(d => d.status !== 'returned').length;
                            const billedTotal = sStoreItems.filter(d => d.status === 'returned').reduce((sum, d) => sum + (Number(d.storeRoomAmount) || Number(d.storeRoomProfit) || 0), 0);
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                <Warehouse className="w-3 h-3" />
                                {activeCount > 0
                                  ? `${activeCount} store room active`
                                  : `${sStoreItems.length} store items (₹${billedTotal.toLocaleString()})`
                                }
                              </span>
                            );
                          })()}
                          {(() => {
                            const pendingForThisSite = (stageCompletionRequests || []).filter(r => r.siteId === s.id && r.status === 'pending');
                            const hasStageApproval = pendingForThisSite.length > 0 || (s.paymentStages || []).some(st => st.completionStatus === 'completion_requested');
                            if (!hasStageApproval) return null;
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 animate-pulse">
                                <CheckCircle2 className="w-3 h-3" /> Approval Requested
                              </span>
                            );
                          })()}
                        </div>
                        <span className="text-primary font-bold group-hover:translate-x-0.5 transition-transform">View Details →</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default SitesTab;
