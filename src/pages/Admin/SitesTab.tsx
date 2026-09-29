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
  Receipt, FileText, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Material, MaterialRequest, MaterialRental, Site } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getSiteAvailableStock } from '@/lib/utils';
import { AssignMaterialModal, CompleteMaterialModal } from './LogisticsModals';
import { SitePaymentMilestones } from './SitePaymentMilestones';

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
    sites, dailyLogs, updateSite, deleteSite, addDailyLog, currentUser, staffList, attendances,
    materialRequests, materialSettings, suppliers, vehicles, assignMaterialRequest, completeMaterialRequest, addMaterialRequest, paymentStageMaster,
    materialRentals, addMaterialRental, updateMaterialRental, deleteMaterialRental,
    stageCompletionRequests, updateStageCompletionRequest,
    manualExpenses
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

  // Rentals for this site
  const siteRentals = useMemo(() => {
    return (materialRentals || [])
      .filter(r => r.siteId === siteId)
      .sort((a, b) => new Date(b.startDate + 'T00:00:00').getTime() - new Date(a.startDate + 'T00:00:00').getTime());
  }, [materialRentals, siteId]);

  const activeSiteRentals = useMemo(() => {
    return siteRentals.filter(r => r.status === 'active');
  }, [siteRentals]);

  const returnedSiteRentals = useMemo(() => {
    return siteRentals.filter(r => r.status === 'returned');
  }, [siteRentals]);

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
    setReturnEndDate(today);
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
  const [logNotes, setLogNotes] = useState('');

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
    addDailyLog({
      staffId: currentUser!.id,
      staffName: 'Admin',
      siteId: site.id,
      siteName: site.name,
      date: today,
      materials,
      expenses,
      incomeFromClient: Number(income) || 0,
      notes: logNotes,
      workerIds: selectedWorkers
    });
    toast.success('Work log added!');
    setMaterials([]); setExpenses([]); setIncome(''); setLogNotes(''); setShowAddLog(false);
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

      // Crew counts (painters, plumbers, labourers)
      let painterCount = 0;
      let plumberCount = 0;
      let labourCount = 0;

      logs.forEach(l => {
        if (l.workerCounts) {
          painterCount += l.workerCounts.painter || 0;
          plumberCount += l.workerCounts.plumber || 0;
          labourCount += l.workerCounts.labour || 0;
        }
      });

      // Check attendance siteAssignments if logs didn't specify crew counts
      dayAttendances.forEach(a => {
        const assignment = a.siteAssignments?.find(sa => sa.siteId === siteId);
        if (assignment && assignment.counts) {
          if (logs.every(l => !l.workerCounts || (l.workerCounts.painter === 0 && l.workerCounts.plumber === 0 && l.workerCounts.labour === 0))) {
            painterCount += assignment.counts.painter || 0;
            plumberCount += assignment.counts.plumber || 0;
            labourCount += assignment.counts.labour || 0;
          }
        }
      });

      const totalCrew = painterCount + plumberCount + labourCount;
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
      const reqTransportCost = dayRequests.reduce((sum, r) => sum + (r.driverCost || 0) + (r.petrolCharge || 0), 0);
      const dayTransportCost = logTransportCost + reqTransportCost;

      // C. Misc Expenses
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
      const dayMiscCost = miscExpensesList.reduce((sum, e) => sum + e.amount, 0);

      const dayTotalExpense = dayMaterialsCost + dayTransportCost + dayMiscCost;

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
      rangeTotalIncome += dayTotalIncome;

      return {
        date,
        logs,
        dayAttendances,
        dayRequests,
        dayMilestonePayments,
        namedStaff,
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
      totalIncome: rangeTotalIncome,
      rangeNetBalance: rangeTotalIncome - rangeTotalExpenses
    };
  }, [dailyLogs, attendances, materialRequests, site?.paymentStages, siteId, fromDate, toDate, staffList, materialSettings]);

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
    const reqMaterialCost = (materialRequests || [])
      .filter(r => r.siteId === siteId && (r.status === 'completed' || r.status === 'assigned'))
      .reduce((sum, r) => sum + (r.materialCost || r.supplierPrice || 0), 0);
    const totalMaterialExpense = logMaterialCost + reqMaterialCost;

    const logTransportCost = siteLogsAll.reduce((sum, l) => sum + (l.transportCost || 0), 0);
    const reqTransportCost = (materialRequests || [])
      .filter(r => r.siteId === siteId && (r.status === 'completed' || r.status === 'assigned'))
      .reduce((sum, r) => sum + (r.driverCost || 0) + (r.petrolCharge || 0), 0);
    const totalTransportExpense = logTransportCost + reqTransportCost;

    const totalMiscExpense = siteLogsAll.reduce(
      (sum, l) => sum + (l.expenses || []).reduce((s, e) => s + (e.amount || 0), 0),
      0
    );

    const totalRentalExpense = (materialRentals || [])
      .filter(r => r.siteId === siteId)
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

    const totalSiteExpense = totalMaterialExpense + totalTransportExpense + totalMiscExpense + totalRentalExpense;
    const netBalance = totalIncomeGiven - totalSiteExpense;

    return {
      incomeLogs: allIncomeLogs,
      totalIncomeGiven,
      totalMaterialExpense,
      totalTransportExpense,
      totalRentalExpense,
      totalMiscExpense,
      totalSiteExpense,
      netBalance
    };
  }, [siteLogsAll, materialRequests, materialRentals, siteId, site?.paymentStages]);

  const downloadSiteFinancialPDF = () => {
    if (!site) return;
    const doc = new jsPDF();

    // Company Header
    doc.setFontSize(18);
    doc.setTextColor(184, 117, 26);
    doc.text('JGS INTERIOR & CONSTRUCTION', 14, 20);

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
    doc.roundedRect(14, 44, 182, 38, 2, 2, 'FD');

    const startY = 46;
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text(`Client Income Received: Rs ${siteFinancials.totalIncomeGiven.toLocaleString()} (${siteFinancials.incomeLogs.length} logs)`, 20, startY + 7);
    doc.text(`Total Site Expenses: Rs ${siteFinancials.totalSiteExpense.toLocaleString()} (All operational costs)`, 20, startY + 13);
    doc.text(`- Materials: Rs ${siteFinancials.totalMaterialExpense.toLocaleString()}`, 25, startY + 18);
    doc.text(`- Transport & Driver: Rs ${siteFinancials.totalTransportExpense.toLocaleString()}`, 25, startY + 22);
    doc.text(`- Rental Products & Scaffolding: Rs ${siteFinancials.totalRentalExpense.toLocaleString()}`, 25, startY + 26);
    doc.text(`- Incidentals / Tea / Misc: Rs ${siteFinancials.totalMiscExpense.toLocaleString()}`, 25, startY + 30);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    if (siteFinancials.netBalance >= 0) {
      doc.setTextColor(6, 95, 70);
      doc.text(`Net In-Hand Balance: +Rs ${siteFinancials.netBalance.toLocaleString()} (Surplus)`, 20, startY + 36);
    } else {
      doc.setTextColor(153, 27, 27);
      doc.text(`Net Overspent / Due: -Rs ${Math.abs(siteFinancials.netBalance).toLocaleString()} (Due from Client)`, 20, startY + 36);
    }

    // Expense Breakdown Table
    const expHead = [['Category', 'Amount (Rs)', 'Notes']];
    const expBody = [
      ['Materials Expense', siteFinancials.totalMaterialExpense.toLocaleString(), 'Site daily logs + dispatch requisitions'],
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
    doc.text('JGS INTERIOR & CONSTRUCTION', 14, 20);

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
      const crewParts = [];
      if (d.painterCount > 0) crewParts.push(`${d.painterCount} Painter`);
      if (d.plumberCount > 0) crewParts.push(`${d.plumberCount} Plumber`);
      if (d.labourCount > 0) crewParts.push(`${d.labourCount} Labour`);
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
              Materials + Transport + Rentals + Incidentals
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/30 text-xs">
          <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40 border border-border/40">
            <span className="text-muted-foreground">🧱 Materials:</span>
            <strong className="text-foreground font-mono">₹{siteFinancials.totalMaterialExpense.toLocaleString()}</strong>
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
                          {it.rate ? <span className="text-muted-foreground text-[10px]">(₹{it.rate}/{it.unit})</span> : null}
                        </span>
                      ))}
                    </div>

                    {/* Logistics & Supplier Meta */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground pt-1 border-t border-border/30">
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
                      {req.supplierPrice !== undefined ? (
                        <div className="w-full mt-2 border-t border-border/40 pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-black text-foreground uppercase tracking-wider">Site Total Bill</span>
                            <span className="font-bold text-primary text-sm font-mono">₹{req.supplierPrice.toLocaleString()}</span>
                          </div>
                          
                          <div className="p-3 bg-muted/30 rounded-xl border border-border/50 space-y-1.5 text-[11px]">
                            <div className="flex justify-between items-center text-muted-foreground">
                              <span>Material Subtotal:</span>
                              <span className="font-mono font-semibold text-foreground">
                                ₹{((req.supplierPrice || 0) - (req.gstAmount || 0)).toLocaleString()}
                              </span>
                            </div>
                            
                            {(req.gstAmount || 0) > 0 && (
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
      </div>

      {/* ── SITE RENTAL PRODUCTS & EQUIPMENT TRACKER ── */}
      <div className="bg-card p-4 rounded-2xl border border-border/70 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-600" />
              <h4 className="text-sm font-heading font-black text-foreground uppercase tracking-wide">
                Rental Products & Equipment on Site
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                {activeSiteRentals.length} Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scaffolding, machinery, and daily rental tools deployed to this site.
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
            <Plus className="w-3.5 h-3.5" /> Deploy Rental to Site
          </Button>
        </div>

        {/* Quick Summary Pill Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-muted/40 rounded-xl border border-border/40 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground">Active Deployments:</span>
            <strong className="text-foreground font-mono">{activeSiteRentals.length} items</strong>
            <span className="text-muted-foreground">•</span>
            <span className="font-semibold text-muted-foreground">Past / Settled:</span>
            <strong className="text-foreground font-mono">{returnedSiteRentals.length} records</strong>
          </div>

          <div className="text-xs font-bold text-foreground">
            Total Site Rental Cost: <span className="font-mono text-amber-600 dark:text-amber-400">₹{siteFinancials.totalRentalExpense.toLocaleString()}</span>
          </div>
        </div>

        {/* Active Rentals List */}
        {activeSiteRentals.length === 0 ? (
          <div className="p-4 rounded-xl bg-muted/20 border border-border/40 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">No active rental materials currently on this site</p>
            <p className="text-[11px]">Click "Deploy Rental to Site" to dispatch scaffolding, generators, or machines.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeSiteRentals.map(rental => {
              const startMs = new Date(rental.startDate + 'T00:00:00').getTime();
              const endMs = new Date(today + 'T00:00:00').getTime();
              const daysActive = Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1);
              const runningRent = (daysActive * rental.quantity * (rental.rentalRatePerDay || 0)) + (rental.transitCost || 0);

              return (
                <div
                  key={rental.id}
                  className="p-3.5 rounded-2xl bg-card border border-amber-500/30 shadow-2xs space-y-2.5 transition-all hover:border-amber-500/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/40 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-sm text-foreground">{rental.materialName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                          Active On Site
                        </span>
                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary">
                          {rental.quantity} {rental.unit}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-1">
                        <span>📅 Deployed: <strong className="text-foreground font-mono">{rental.startDate}</strong></span>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold">
                          ⏱️ {daysActive} {daysActive === 1 ? 'day' : 'days'} on site
                        </span>
                        <span>•</span>
                        <span>Daily Rate: <strong className="text-foreground font-mono">₹{rental.rentalRatePerDay || 0}</strong> / day per {rental.unit}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block">Running Total:</span>
                      <span className="font-heading font-extrabold text-sm text-amber-600 dark:text-amber-400 font-mono">
                        ₹{runningRent.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {rental.requiresDriver && (
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-xl border border-border/40">
                      <span className="flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-blue-500" /> Driver: <strong className="text-foreground">{rental.driverName || 'Assigned'}</strong>
                      </span>
                      {rental.vehicleNumber && (
                        <span>Vehicle: <strong className="text-foreground">{rental.vehicleNumber}</strong></span>
                      )}
                      {rental.transitCost ? (
                        <span>Transit Allowance: <strong className="text-foreground font-mono">₹{rental.transitCost.toLocaleString()}</strong></span>
                      ) : null}
                    </div>
                  )}

                  {rental.notes && (
                    <p className="text-[11px] text-muted-foreground italic bg-muted/40 px-2.5 py-1 rounded-lg">
                      "{rental.notes}"
                    </p>
                  )}

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={() => openReturnRentalModal(rental)}
                      className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Returned & Settle Rental
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Returned / Settled Rentals History */}
        {returnedSiteRentals.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Settled / Returned Rentals History ({returnedSiteRentals.length})
            </span>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {returnedSiteRentals.map(r => (
                <div key={r.id} className="p-3 rounded-xl bg-muted/20 border border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-foreground mr-2">{r.materialName}</span>
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {r.quantity} {r.unit}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Duration: {r.startDate} to {r.endDate} ({r.totalDays || 1} {r.totalDays === 1 ? 'day' : 'days'}) @ ₹{r.rentalRatePerDay}/day
                      {r.transitCost ? ` + ₹${r.transitCost} transit` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-xs text-foreground font-mono block">
                      ₹{(r.totalRentalCost || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Settled
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Work Entry Toggle */}
      <div className="animate-slide-up">
        {!showAddLog ? (
          <Button
            onClick={() => {
              setSelectedWorkers(site.assignedStaffIds || []);
              setShowAddLog(true);
            }}
            className="w-full h-11 rounded-xl text-white font-semibold flex items-center justify-center gap-2 shadow-sm"
            style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
          >
            <Plus className="w-4 h-4" /> Add Daily Work Entry
          </Button>
        ) : (
          <div className="form-card mb-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <p className="font-heading font-bold text-sm flex items-center gap-2 m-0">
                <Send className="w-4 h-4 text-primary" /> Daily Work Entry
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowAddLog(false)}
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
                <Input
                  type="number"
                  placeholder="₹ 0"
                  value={income}
                  onChange={e => setIncome(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
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
                Submit Work Log
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
                    {day.painterCount > 0 && (
                      <span className="bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                        🎨 {day.painterCount} {day.painterCount === 1 ? 'Painter' : 'Painters'}
                      </span>
                    )}
                    {day.plumberCount > 0 && (
                      <span className="bg-sky-500/10 text-sky-800 dark:text-sky-200 border border-sky-500/20 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                        🔧 {day.plumberCount} {day.plumberCount === 1 ? 'Plumber' : 'Plumbers'}
                      </span>
                    )}
                    {day.labourCount > 0 && (
                      <span className="bg-orange-500/10 text-orange-800 dark:text-orange-200 border border-orange-500/20 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                        🔨 {day.labourCount} {day.labourCount === 1 ? 'Labourer' : 'Labourers'}
                      </span>
                    )}
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
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                    <span>Materials: ₹{day.dayMaterialsCost.toLocaleString()}</span>
                    <span>•</span>
                    <span>Transport: ₹{day.dayTransportCost.toLocaleString()}</span>
                    <span>•</span>
                    <span>Misc: ₹{day.dayMiscCost.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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

                  {/* Column C: Miscellaneous Incidentals */}
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
                            ₹{( (r.materialCost || r.supplierPrice || 0) + (r.driverCost || 0) + (r.petrolCharge || 0) ).toLocaleString()}
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
                            {m.name} ({m.unit})
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
                      {materialSettings.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} {m.isRental ? '★ Rental' : ''} {m.rentalRatePerDay ? `(₹${m.rentalRatePerDay}/day)` : ''}
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
  const { sites, addSite, customers, addCustomer, staffList, materialRequests, materialRentals, stageCompletionRequests, dailyLogs } = useApp();
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

      {/* Sites Grid */}
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

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allSites.map(s => (
          <Card
            key={s.id}
            onClick={() => setSelectedSiteId(s.id)}
            className="p-5 rounded-3xl bg-card border border-border/60 hover:border-primary/50 shadow-luxury hover:shadow-luxury-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer space-y-3.5 group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-heading font-bold text-base text-foreground truncate">{s.name}</h4>
                  <p className="text-xs text-muted-foreground truncate">{s.clientName}</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize shrink-0 ${statusBadge(s.status)}`}>
                {s.status}
              </span>
            </div>

            {s.address && (
              <p className="text-xs text-muted-foreground/80 flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                {s.address}
              </p>
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
                  const activeRentals = (materialRentals || []).filter(r => r.siteId === s.id && r.status === 'active');
                  if (activeRentals.length === 0) return null;
                  return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      <RefreshCw className="w-3 h-3" /> {activeRentals.length} {activeRentals.length === 1 ? 'rental' : 'rentals'}
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
        ))}
      </div>
    );
  })()}
    </div>
  );
};

export default SitesTab;
