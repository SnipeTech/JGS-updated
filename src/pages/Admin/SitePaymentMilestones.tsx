import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import {
  CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, Plus,
  IndianRupee, XCircle, SendHorizonal, User, UserCircle, Layers, TrendingUp,
  TrendingDown, Package, Users, ShieldCheck, ArrowRight, Lock,
  AlertTriangle, DollarSign, Receipt, FileText, Printer, Settings,
  CreditCard, Calendar, BarChart3, Check, Wallet, RefreshCw, Truck, ChevronRight
} from 'lucide-react';
import {
  Site, SitePaymentStage, SitePayment, StageCompletionRequest,
  DailyLog, MaterialRequest, MaterialRental, Staff,
  ManualExpense, Attendance
} from '@/types';
import { toast } from 'sonner';
import { useApp } from '@/context/AppContext';
import { getLabourTypeMeta } from '../Staff/StaffAttendanceTab';

interface Props {
  site: Site;
  updateSite: (id: string, updates: Partial<Site>) => void;
  paymentStageMaster: string[];
  stageCompletionRequests?: StageCompletionRequest[];
  updateStageCompletionRequest?: (id: string, updates: Partial<StageCompletionRequest>) => void;
  dailyLogs?: DailyLog[];
  materialRequests?: MaterialRequest[];
  materialRentals?: MaterialRental[];
  staffList?: Staff[];
  manualExpenses?: ManualExpense[];
  attendances?: Attendance[];
}

export const SitePaymentMilestones = ({
  site,
  updateSite,
  paymentStageMaster,
  stageCompletionRequests = [],
  updateStageCompletionRequest,
  dailyLogs = [],
  materialRequests = [],
  materialRentals = [],
  staffList = [],
  manualExpenses = [],
  attendances = []
}: Props) => {
  const { addMaterialRental, materialSettings = [], vehicles = [], storeRoomDispatches = [] } = useApp();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [reportModalStage, setReportModalStage] = useState<string | null>(null);
  const [recordPayStage, setRecordPayStage] = useState<string | null>(null);
  const [setupStage, setSetupStage] = useState<string | null>(null);
  const [deployRentalStage, setDeployRentalStage] = useState<string | null>(null);
  const [selectedReqForDetail, setSelectedReqForDetail] = useState<MaterialRequest | null>(null);
  const [showAllStageReqsModal, setShowAllStageReqsModal] = useState(false);

  // Form states for rental deployment to stage
  const [stageRentalMatId, setStageRentalMatId] = useState('');
  const [stageRentalMatName, setStageRentalMatName] = useState('');
  const [stageRentalQty, setStageRentalQty] = useState('1');
  const [stageRentalUnit, setStageRentalUnit] = useState('Nos');
  const [stageRentalRate, setStageRentalRate] = useState('');
  const [stageRentalStartDate, setStageRentalStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [stageRentalEndDate, setStageRentalEndDate] = useState('');
  const [stageRentalRequiresDriver, setStageRentalRequiresDriver] = useState(false);
  const [stageRentalDriverId, setStageRentalDriverId] = useState('');
  const [stageRentalDriverName, setStageRentalDriverName] = useState('');
  const [stageRentalVehicleId, setStageRentalVehicleId] = useState('');
  const [stageRentalVehicleNumber, setStageRentalVehicleNumber] = useState('');
  const [stageRentalTransitCost, setStageRentalTransitCost] = useState('');
  const [stageRentalNotes, setStageRentalNotes] = useState('');

  const openDeployRental = (stageName: string) => {
    setDeployRentalStage(stageName);
    setStageRentalMatId('');
    setStageRentalMatName('');
    setStageRentalQty('1');
    setStageRentalUnit('Nos');
    setStageRentalRate('');
    setStageRentalStartDate(format(new Date(), 'yyyy-MM-dd'));
    setStageRentalEndDate('');
    setStageRentalRequiresDriver(false);
    setStageRentalDriverId('');
    setStageRentalDriverName('');
    setStageRentalVehicleId('');
    setStageRentalVehicleNumber('');
    setStageRentalTransitCost('');
    setStageRentalNotes('');
  };

  const handleDeployRentalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageRentalMatName.trim()) {
      toast.error('Please enter or select rental equipment');
      return;
    }
    if (!stageRentalRate || Number(stageRentalRate) <= 0) {
      toast.error('Please enter a valid daily rental rate');
      return;
    }
    addMaterialRental({
      materialId: stageRentalMatId || `custom-${Date.now()}`,
      materialName: stageRentalMatName.trim(),
      siteId: site.id,
      siteName: site.name,
      startDate: stageRentalStartDate,
      endDate: stageRentalEndDate || undefined,
      quantity: Number(stageRentalQty) || 1,
      unit: stageRentalUnit || 'Nos',
      requiresDriver: stageRentalRequiresDriver,
      driverId: stageRentalRequiresDriver ? stageRentalDriverId : undefined,
      driverName: stageRentalRequiresDriver ? stageRentalDriverName : undefined,
      vehicleId: stageRentalRequiresDriver ? stageRentalVehicleId : undefined,
      vehicleNumber: stageRentalRequiresDriver ? stageRentalVehicleNumber : undefined,
      transitCost: stageRentalRequiresDriver ? (Number(stageRentalTransitCost) || 0) : 0,
      rentalRatePerDay: Number(stageRentalRate) || 0,
      status: 'active',
      notes: `[Stage: ${deployRentalStage}] ${stageRentalNotes}`.trim()
    });
    toast.success(`Rental ${stageRentalMatName} deployed to ${site.name} for ${deployRentalStage}`);
    setDeployRentalStage(null);
  };

  // Form states for currently expanded stage setup
  const [expectedAmount, setExpectedAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [payMethod, setPayMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card' | 'Other'>('Cash');
  const [payNote, setPayNote] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [stepsTaken, setStepsTaken] = useState('');
  const [expenseStatus, setExpenseStatus] = useState<'under_control' | 'high' | ''>('');
  const [highExpenseReason, setHighExpenseReason] = useState('');

  // Master ordered stages list
  const masterStages = useMemo(() => {
    return (site.paymentStages && site.paymentStages.length > 0)
      ? site.paymentStages.map(s => s.stageName)
      : paymentStageMaster;
  }, [paymentStageMaster, site.paymentStages]);

  // Identify any general / unmatched daily logs for this site
  const unmatchedLogs = useMemo(() => {
    return (dailyLogs || []).filter(l => {
      if (l.siteId !== site.id) return false;
      const matched = masterStages.some(stageName => {
        const clean = (s: string) => s.replace(/^level\s*\d+\s*:\s*/i, '').toLowerCase().trim();
        const normLog = (l.workLevelStage || '').toLowerCase().trim();
        const normTarget = stageName.toLowerCase().trim();
        const cleanLog = clean(normLog);
        const cleanTarget = clean(normTarget);
        if (normLog === normTarget || cleanLog === cleanTarget) return true;
        if (cleanLog && cleanTarget && (cleanLog.includes(cleanTarget) || cleanTarget.includes(cleanLog))) return true;
        return false;
      });
      return !matched;
    });
  }, [dailyLogs, site.id, masterStages]);

  // All rental materials & equipment deployed to this site
  const allSiteRentals = useMemo(() => {
    return (materialRentals || []).filter(r => {
      const matchSite = (r.siteId && (r.siteId === site.id || String(r.siteId) === String(site.id))) ||
                        (r.siteName && site.name && r.siteName.trim().toLowerCase() === site.name.trim().toLowerCase());
      return matchSite;
    }).sort((a, b) => new Date(b.startDate + 'T00:00:00').getTime() - new Date(a.startDate + 'T00:00:00').getTime());
  }, [materialRentals, site.id, site.name]);

  const [auditRentalView, setAuditRentalView] = useState<'stage' | 'all'>('stage');

  const getStageData = (stageName: string): SitePaymentStage => {
    return (site.paymentStages || []).find((s) => s.stageName === stageName) || {
      stageName, expectedAmount: 0, paidAmount: 0, payments: [], completionStatus: 'pending'
    };
  };

  const saveStageData = (stageName: string, updates: Partial<SitePaymentStage>) => {
    const existing = site.paymentStages || [];
    const stageIndex = existing.findIndex((s) => s.stageName === stageName);
    const newStages = [...existing];
    if (stageIndex >= 0) {
      newStages[stageIndex] = { ...newStages[stageIndex], ...updates };
    } else {
      newStages.push({
        stageName,
        expectedAmount: 0,
        paidAmount: 0,
        payments: [],
        completionStatus: 'pending',
        ...updates
      });
    }
    updateSite(site.id, { paymentStages: newStages });
  };

  const handleExpand = (stageName: string) => {
    if (expandedStage === stageName) {
      setExpandedStage(null);
    } else {
      const data = getStageData(stageName);
      setExpectedAmount(data.expectedAmount ? data.expectedAmount.toString() : '');
      setDueDate(data.dueDate || '');
      setPayAmount('');
      setPayNote('');
      setWorkDescription(data.workDescription || '');
      setStepsTaken(data.stepsTaken || '');
      setExpenseStatus(data.expenseStatus || '');
      setHighExpenseReason(data.highExpenseReason || '');
      setExpandedStage(stageName);
    }
  };

  const openRecordPay = (stageName: string) => {
    setPayAmount('');
    setPayNote('');
    setPayMethod('Cash');
    setPayDate(format(new Date(), 'yyyy-MM-dd'));
    setRecordPayStage(stageName);
  };

  const openSetup = (stageName: string) => {
    const data = getStageData(stageName);
    setExpectedAmount(data.expectedAmount ? data.expectedAmount.toString() : '');
    setDueDate(data.dueDate || '');
    setWorkDescription(data.workDescription || '');
    setStepsTaken(data.stepsTaken || '');
    setExpenseStatus(data.expenseStatus || '');
    setHighExpenseReason(data.highExpenseReason || '');
    setSetupStage(stageName);
  };

  const handleSaveSetup = (stageName: string) => {
    saveStageData(stageName, {
      expectedAmount: Number(expectedAmount) || 0,
      dueDate: dueDate || undefined,
      workDescription,
      stepsTaken,
      expenseStatus: expenseStatus as 'under_control' | 'high' | undefined,
      highExpenseReason: expenseStatus === 'high' ? highExpenseReason : ''
    });
    toast.success(`Level "${stageName}" details saved`);
    setSetupStage(null);
  };

  const handleAddPayment = (stageName: string) => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid payment amount');

    const data = getStageData(stageName);
    const newPayment: SitePayment = {
      id: `pay_${Date.now()}`,
      amount: amt,
      date: payDate,
      paymentMethod: payMethod,
      note: payNote
    };

    saveStageData(stageName, {
      paidAmount: data.paidAmount + amt,
      payments: [...(data.payments || []), newPayment]
    });
    toast.success(`Payment of ₹${amt.toLocaleString()} via ${payMethod} recorded successfully`);
    setPayAmount('');
    setPayNote('');
    setPayMethod('Cash');
    setRecordPayStage(null);
  };

  const handleApproveRequest = (requestId: string, stageName: string) => {
    if (updateStageCompletionRequest) {
      updateStageCompletionRequest(requestId, {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
      });
    }

    const currentStages = site.paymentStages || [];
    const stageIdx = masterStages.indexOf(stageName);
    const nextStageName = stageIdx >= 0 && stageIdx < masterStages.length - 1 ? masterStages[stageIdx + 1] : null;

    let updatedStages = [...currentStages];
    const curIdx = updatedStages.findIndex(s => s.stageName === stageName);
    if (curIdx >= 0) {
      updatedStages[curIdx] = { ...updatedStages[curIdx], completionStatus: 'completed' };
    } else {
      updatedStages.push({ stageName, expectedAmount: 0, paidAmount: 0, payments: [], completionStatus: 'completed' });
    }

    if (nextStageName) {
      const nxtIdx = updatedStages.findIndex(s => s.stageName === nextStageName);
      if (nxtIdx >= 0) {
        if (!updatedStages[nxtIdx].completionStatus || updatedStages[nxtIdx].completionStatus === 'pending') {
          updatedStages[nxtIdx] = { ...updatedStages[nxtIdx], completionStatus: 'in_progress' };
        }
      } else {
        updatedStages.push({ stageName: nextStageName, expectedAmount: 0, paidAmount: 0, payments: [], completionStatus: 'in_progress' });
      }
    }

    updateSite(site.id, { paymentStages: updatedStages });
    toast.success(`Level "${stageName}" marked as Completed! Next level (${nextStageName || 'All Milestones Done'}) is now unlocked.`);
  };

  const handleRejectRequest = (requestId: string, stageName: string) => {
    if (updateStageCompletionRequest) {
      updateStageCompletionRequest(requestId, {
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
      });
    }
    saveStageData(stageName, { completionStatus: 'in_progress' });
    toast.info(`Completion request for "${stageName}" rejected. Stage reverted to In Progress.`);
  };

  // Helper to compute deep level finances & workforce
  const getStageFinancials = (stageName: string, passedStageData?: SitePaymentStage) => {
    const stageData = passedStageData || getStageData(stageName);
    const currentStageIdx = masterStages.indexOf(stageName);

    // Robust stage matching helper
    const isStageMatch = (workLevelStage?: string) => {
      if (!workLevelStage) {
        // Fallback: if log doesn't have a stage tag, match to active or first stage
        const stages = (site.paymentStages && site.paymentStages.length > 0)
          ? site.paymentStages
          : paymentStageMaster.map(s => ({ stageName: s }));
        if (stages.length <= 1) return true;
        const activeStage = stages.find(s => s.completionStatus === 'in_progress') || stages[0];
        return activeStage?.stageName === stageName;
      }

      const clean = (s: string) => s.replace(/^level\s*\d+\s*:\s*/i, '').toLowerCase().trim();
      const normLog = workLevelStage.toLowerCase().trim();
      const normTarget = stageName.toLowerCase().trim();
      const cleanLog = clean(normLog);
      const cleanTarget = clean(normTarget);

      // Exact name match or stripped level match
      if (normLog === normTarget || cleanLog === cleanTarget) return true;
      if (cleanLog && cleanTarget && (cleanLog.includes(cleanTarget) || cleanTarget.includes(cleanLog))) return true;

      // Match by level index if tagged as "Level X"
      const levelMatch = normLog.match(/level\s*(\d+)/i);
      if (levelMatch && currentStageIdx >= 0) {
        const loggedLevelNum = parseInt(levelMatch[1], 10);
        if (loggedLevelNum === currentStageIdx + 1) return true;
      }

      return false;
    };

    // 1. Daily work logs for this stage
    const stageLogs = dailyLogs.filter(
      l => l.siteId === site.id && isStageMatch(l.workLevelStage)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Daily supervisor incidental expenses (Food, Tea, Auto, Bus, Petrol, Other)
    const dailyMiscExpenses = stageLogs.reduce(
      (sum, l) => sum + (l.expenses || []).filter(e => !(e.itemName?.toLowerCase() === 'bike' && e.amount === 5)).reduce((s, e) => s + (e.amount || 0), 0),
      0
    );

    // Daily supervisor travel & transport (ignoring legacy default 5 for bike)
    const dailyTransportExpenses = stageLogs.reduce(
      (sum, l) => {
        const isLegacyBikeCost = l.transportCost === 5 && (l.transportMode === 'bike' || !l.transportMode);
        return sum + (!isLegacyBikeCost ? (l.transportCost || 0) : 0);
      },
      0
    );

    // Itemized supervisor incidental expenses
    const supervisorExpenseItems: {
      logId: string;
      date: string;
      staffName: string;
      itemName: string;
      amount: number;
    }[] = [];

    stageLogs.forEach(log => {
      (log.expenses || []).forEach(exp => {
        if (exp.amount && exp.amount > 0) {
          // Skip legacy default 5 bike expense
          if (exp.itemName?.toLowerCase() === 'bike' && exp.amount === 5) return;
          // Skip supervisor salary item here to avoid double counting with labourSalaryCost
          if (exp.itemName?.toLowerCase().includes('supervisor salary')) return;
          supervisorExpenseItems.push({
            logId: log.id,
            date: log.date,
            staffName: log.staffName || 'Supervisor',
            itemName: exp.itemName || 'Site Expense',
            amount: exp.amount,
          });
        }
      });
      const isLegacyBikeCost = log.transportCost === 5 && (log.transportMode === 'bike' || !log.transportMode);
      if (log.transportCost && log.transportCost > 0 && !isLegacyBikeCost) {
        supervisorExpenseItems.push({
          logId: log.id,
          date: log.date,
          staffName: log.staffName || 'Supervisor',
          itemName: `Travel (${(log.transportMode || 'Travel').toUpperCase()})`,
          amount: log.transportCost,
        });
      }
    });

    // 1b. Also include Supervisor Attendance Site Expenses if verified and paid by Admin
    attendances
      .filter(a => (a.siteId === site.id || a.siteAssignments?.some(sa => sa.siteId === site.id)) && (a.expenseAmount || 0) > 0 && a.expenseStatus === 'paid')
      .forEach(a => {
        const finalAmount = a.expensePaidAmount || a.expenseAmount || 0;
        const alreadyIn = supervisorExpenseItems.some(item => 
          item.date === a.date && item.amount === finalAmount
        );
        if (!alreadyIn) {
          const staffObj = staffList.find(s => s.id === a.staffId);
          supervisorExpenseItems.push({
            logId: a.id,
            date: a.date,
            staffName: staffObj?.name || 'Supervisor',
            itemName: a.expenseNotes ? `Supervisor Attendance (Paid: ${a.expenseNotes})` : 'Supervisor Attendance Expense (Paid)',
            amount: finalAmount,
          });
        }
      });

    const supervisorDailyExpenses = supervisorExpenseItems.reduce((sum, item) => sum + item.amount, 0);

    // 2. Material requests linked to this stage
    const stageReqs = materialRequests.filter(
      r => r.siteId === site.id && isStageMatch(r.workLevelStage) && (r.status === 'completed' || r.status === 'assigned')
    );
    const stageReqCost = stageReqs.reduce(
      (sum, r) => sum + (r.materialCost || r.supplierPrice || r.storeRoomAmount || 0) + (r.driverWage || 0),
      0
    );

    // 2b. Direct materials logged in supervisor daily work logs for this stage
    const stageLogMaterialCost = stageLogs.reduce(
      (sum, l) => sum + (l.materials || []).reduce((s, m) => s + ((m.cost || 0) * (m.quantity || 1)), 0),
      0
    );

    // 2b-2. Store Room equipment & materials linked to this stage
    const stageStoreRoomDispatches = (storeRoomDispatches || []).filter(d => {
      const matchSite = (d.siteId && (d.siteId === site.id || String(d.siteId) === String(site.id))) ||
                        (d.siteName && site.name && d.siteName.trim().toLowerCase() === site.name.trim().toLowerCase());
      if (!matchSite) return false;
      if (d.workLevelStage && isStageMatch(d.workLevelStage)) return true;
      if (d.notes && isStageMatch(d.notes)) return true;
      if (masterStages.indexOf(stageName) === 0 && !d.workLevelStage) return true;
      return false;
    });

    const stageStoreRoomCost = stageStoreRoomDispatches.reduce((sum, d) => {
      if (stageReqs.some(r => r.id === d.id)) return sum;
      if (d.storeRoomAmount !== undefined && d.storeRoomAmount > 0) return sum + d.storeRoomAmount;
      if (d.perDayRate && d.perDayRate > 0) {
        const sDate = d.deliveryDate || d.startDate || d.date || format(new Date(), 'yyyy-MM-dd');
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

    const totalMaterialsCost = stageReqCost + stageLogMaterialCost + stageStoreRoomCost;

    // 2c. Rental materials & machinery deployed to site for this stage
    const siteRentalsForSite = (materialRentals || []).filter(r => {
      const matchSite = (r.siteId && (r.siteId === site.id || String(r.siteId) === String(site.id))) ||
                        (r.siteName && site.name && r.siteName.trim().toLowerCase() === site.name.trim().toLowerCase());
      return matchSite;
    });

    const stageRentals = siteRentalsForSite.filter(r => {
      if (r.notes && isStageMatch(r.notes)) return true;
      if ((r as any).workLevelStage && isStageMatch((r as any).workLevelStage)) return true;
      if (stageLogs.length > 0) {
        const stageDates = stageLogs.map(l => l.date).sort();
        const firstDate = stageDates[0];
        const lastDate = stageDates[stageDates.length - 1];
        const rStart = r.startDate || firstDate;
        const rEnd = r.endDate || (r.status === 'active' ? format(new Date(), 'yyyy-MM-dd') : rStart);
        if (rStart <= lastDate && rEnd >= firstDate) return true;
      }
      // If untagged general site rental, assign to stage 0 (Level 1) so it is accounted for in milestone financials
      const hasAnyStageTag = masterStages.some(sName => {
        const p = sName.toLowerCase().replace(/[^a-z0-9]/g, '');
        return r.notes && r.notes.toLowerCase().replace(/[^a-z0-9]/g, '').includes(p);
      });
      if (!hasAnyStageTag && masterStages.indexOf(stageName) === 0) {
        return true;
      }
      return false;
    });

    const stageRentalCost = stageRentals.reduce((sum, r) => {
      if (r.totalRentalCost !== undefined && r.status === 'returned') {
        return sum + r.totalRentalCost;
      }
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const startMs = new Date(r.startDate + 'T00:00:00').getTime();
      const endMs = new Date((r.endDate || todayStr) + 'T00:00:00').getTime();
      const days = Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1);
      return sum + (days * (r.quantity || 1) * (r.rentalRatePerDay || 0)) + (r.transitCost || 0);
    }, 0);

    // 3. Admin manual expenses linked to this stage
    const stageManualExpenses = manualExpenses.filter(
      e => e.siteId === site.id && isStageMatch(e.workLevelStage)
    );
    const manualExpenseCost = stageManualExpenses.reduce(
      (sum, e) => sum + (e.amount || 0),
      0
    );

    // 4. Labour salary costs estimation from supervisor crew worker counts AND supervisor daily salary
    let labourSalaryCost = 0;
    let totalCrewSalaryCost = 0;
    let totalSupervisorSalaryCost = 0;

    const supervisorWorkLogs = stageLogs.map(log => {
      let counts: Record<string, number> = { ...(log.workerCounts || {}) };
      let totalWorkers = Object.values(counts).reduce((sum, v) => sum + (Number(v) || 0), 0);

      // Fallback: If counts are 0, check supervisor's Team Attendance site allocation for this site and date
      const matchingAtt = attendances.find(a => 
        (a.staffId === log.staffId || a.staffId === site.supervisorId) && a.date === log.date
      ) || attendances.find(a => a.date === log.date && a.siteAssignments?.some(sa => sa.siteId === site.id));

      if (totalWorkers === 0) {
        const siteAlloc = matchingAtt?.siteAssignments?.find(sa => sa.siteId === site.id);
        if (siteAlloc?.counts && Object.values(siteAlloc.counts).some(v => (Number(v) || 0) > 0)) {
          counts = siteAlloc.counts;
          totalWorkers = Object.values(counts).reduce((sum, v) => sum + (Number(v) || 0), 0);
        } else if (matchingAtt?.siteId === site.id && matchingAtt?.presentCounts) {
          counts = matchingAtt.presentCounts;
          totalWorkers = Object.values(counts).reduce((sum, v) => sum + (Number(v) || 0), 0);
        }
      }

      const supervisor = staffList.find(s => s.id === log.staffId) || staffList.find(s => s.id === site.supervisorId);
      const dailySalary = supervisor?.underLabourSalary || 800; // default ₹800/day if not set
      const dayCrewCost = totalWorkers * dailySalary;

      // Supervisor daily salary based on Team Attendance site allocation for this date
      // Strictly check if the supervisor was personally assigned to THIS site in Team Attendance on this date (not just crew siteAssignments)
      const isSupervisorAllocatedToThisSite = Boolean(
        matchingAtt && matchingAtt.siteId === site.id
      );

      let daySupervisorSalary = 0;
      let supAttStatus: string | undefined = undefined;

      if (isSupervisorAllocatedToThisSite && supervisor) {
        daySupervisorSalary = Number(log.supervisorSalary) || 0;
        if (daySupervisorSalary === 0 && matchingAtt && matchingAtt.status !== 'absent') {
          supAttStatus = matchingAtt.status;
          const baseSalary = Number(supervisor.perDaySalary) ||
            (supervisor.salaryType === 'hourly' ? (Number(supervisor.perHourSalary) || 0) * 8 : 1200);
          const mult = matchingAtt.status === 'half-day' ? 0.5 : 1.0;
          const otHours = Number(matchingAtt.otHours) || 0;
          const hourlyRate = Number(supervisor.perHourSalary) || (baseSalary / 8) || 150;
          daySupervisorSalary = (baseSalary * mult) + (otHours * hourlyRate);
        }
      }

      // Also include all named employee salaries if stored (excluding supervisor if not assigned to this site)
      let dayAllEmployeeSalary = 0;
      if (log.employeeSalaries && log.employeeSalaries.length > 0) {
        dayAllEmployeeSalary = log.employeeSalaries
          .filter(e => e.role !== 'supervisor' || isSupervisorAllocatedToThisSite)
          .reduce((s, e) => s + e.totalSalary, 0);

        if (isSupervisorAllocatedToThisSite) {
          const empSup = log.employeeSalaries.filter(e => e.role === 'supervisor').reduce((s, e) => s + e.totalSalary, 0);
          if (empSup > 0) daySupervisorSalary = empSup;
        }
      }

      const dayTotalWages = dayCrewCost + Math.max(dayAllEmployeeSalary, daySupervisorSalary);
      labourSalaryCost += dayTotalWages;
      totalCrewSalaryCost += dayCrewCost;
      totalSupervisorSalaryCost += (isSupervisorAllocatedToThisSite ? (dayAllEmployeeSalary > 0 ? dayAllEmployeeSalary : daySupervisorSalary) : 0);

      return {
        id: log.id,
        date: log.date,
        staffName: log.staffName || supervisor?.name || 'Supervisor',
        isSupervisorAllocated: isSupervisorAllocatedToThisSite,
        counts,
        totalWorkers,
        dayCrewCost,
        daySupervisorSalary,
        dayTotalWages,
        dayLabourCost: dayTotalWages,
        dailySalary,
        supAttStatus,
        notes: log.notes || '',
        workerIds: log.workerIds || [],
        materials: log.materials || [],
        miscExpenses: (log.expenses || []).reduce((s, e) => s + (e.amount || 0), 0) + (log.transportCost || 0),
      };
    });

    const totalStageExpenses = supervisorDailyExpenses + totalMaterialsCost + stageRentalCost + manualExpenseCost + labourSalaryCost;
    const expected = stageData?.expectedAmount || 0;
    const paid = stageData?.paidAmount || 0;
    const balance = Math.max(0, expected - paid);

    // Net profit / margin
    const netMargin = expected > 0 ? expected - totalStageExpenses : paid - totalStageExpenses;
    const marginPercent = expected > 0 ? Math.round((netMargin / expected) * 100) : 0;
    const isOverBudget = expected > 0 && totalStageExpenses > expected;

    // Workforce stats
    const totalDaysWorked = new Set(stageLogs.map(l => l.date)).size;
    const totalPainterDays = supervisorWorkLogs.reduce((sum, l) => sum + (Number(l.counts.painter) || 0), 0);
    const totalPlumberDays = supervisorWorkLogs.reduce((sum, l) => sum + (Number(l.counts.plumber) || 0), 0);
    const totalLabourDays = supervisorWorkLogs.reduce((sum, l) => sum + (Number(l.counts.labour) || 0), 0);
    const totalCrewManDays = supervisorWorkLogs.reduce((sum, l) => sum + l.totalWorkers, 0);

    return {
      stageLogs,
      stageReqs,
      stageManualExpenses,
      stageRentals,
      supervisorDailyExpenses,
      supervisorExpenseItems,
      supervisorWorkLogs,
      dailyMiscExpenses,
      dailyTransportExpenses,
      stageReqCost,
      stageLogMaterialCost,
      totalMaterialsCost,
      stageRentalCost,
      manualExpenseCost,
      labourSalaryCost,
      totalCrewSalaryCost,
      totalSupervisorSalaryCost,
      totalStageExpenses,
      expected,
      paid,
      balance,
      netMargin,
      marginPercent,
      isOverBudget,
      totalDaysWorked,
      totalCrewManDays,
      totalPainterDays,
      totalPlumberDays,
      totalLabourDays
    };
  };

  // Top level overall milestone calculations
  const overallMetrics = useMemo(() => {
    let totalExpected = 0;
    let totalPaid = 0;
    let totalExpenses = 0;
    let completedCount = 0;
    let activeStageName = '';

    const underDueStages: {
      stageName: string;
      balance: number;
      isOverdue: boolean;
      completionStatus: string;
    }[] = [];

    masterStages.forEach((stageName, idx) => {
      const data = getStageData(stageName);
      const fin = getStageFinancials(stageName, data);
      totalExpected += fin.expected;
      totalPaid += fin.paid;
      totalExpenses += fin.totalStageExpenses;

      const isOverdue = !!(data.dueDate && new Date(data.dueDate) < new Date() && fin.balance > 0);
      const isCompletedWithDue = data.completionStatus === 'completed' && fin.balance > 0;
      if (isOverdue || isCompletedWithDue) {
        underDueStages.push({
          stageName,
          balance: fin.balance,
          isOverdue,
          completionStatus: data.completionStatus || 'pending'
        });
      }

      if (data.completionStatus === 'completed') {
        completedCount++;
      } else if (!activeStageName) {
        activeStageName = `Level ${idx + 1}: ${stageName}`;
      }
    });

    const underDueAmount = underDueStages.reduce((sum, s) => sum + s.balance, 0);
    const netProfit = totalPaid > 0 ? totalPaid - totalExpenses : totalExpected - totalExpenses;
    const overallMarginPct = totalExpected > 0 ? Math.round(((totalExpected - totalExpenses) / totalExpected) * 100) : 0;

    return {
      totalExpected,
      totalPaid,
      totalExpenses,
      netProfit,
      overallMarginPct,
      completedCount,
      totalStages: masterStages.length,
      underDueStages,
      underDueAmount,
      activeStageName: activeStageName || (completedCount === masterStages.length && masterStages.length > 0 ? 'All Levels Completed' : 'Not Started')
    };
  }, [masterStages, site.paymentStages, dailyLogs, materialRequests, manualExpenses, attendances]);

  return (
    <Card className="p-4 sm:p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}>
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-heading font-extrabold text-foreground uppercase tracking-wide">
              Sequential Construction Stages & Milestone Costing
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Client billing by stage, supervisor daily work activity, and level-wise expense & profit tracking.
            </p>
          </div>
        </div>

        {/* Overall Progress Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            {overallMetrics.completedCount} of {overallMetrics.totalStages} Levels Completed
          </span>
        </div>
      </div>

      {/* ── Summary Financial Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Contract Milestones</span>
          <span className="text-sm sm:text-base font-extrabold text-foreground mt-0.5 block">
            ₹{overallMetrics.totalExpected.toLocaleString()}
          </span>
          <span className="text-[10px] text-muted-foreground">Expected from Client</span>
        </div>

        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Client Paid</span>
          <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            ₹{overallMetrics.totalPaid.toLocaleString()}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Balance: ₹{Math.max(0, overallMetrics.totalExpected - overallMetrics.totalPaid).toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <span className="text-[10px] font-bold text-destructive uppercase tracking-wider block">Level Expenses</span>
          <span className="text-sm sm:text-base font-extrabold text-destructive mt-0.5 block">
            ₹{overallMetrics.totalExpenses.toLocaleString()}
          </span>
          <span className="text-[10px] text-muted-foreground">Supervisor costs & materials</span>
        </div>

        <div className={`p-3 rounded-xl border ${overallMetrics.netProfit >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Net Stage Margin</span>
          <div className="flex items-center gap-1 mt-0.5">
            {overallMetrics.netProfit >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-destructive" />
            )}
            <span className={`text-sm sm:text-base font-extrabold ${overallMetrics.netProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
              ₹{overallMetrics.netProfit.toLocaleString()}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {overallMetrics.overallMarginPct}% Est. Margin
          </span>
        </div>
      </div>

      {/* ── LEVEL PAYMENT DUES ALERT STRIP (SHOW UNIQUE IF ANY LEVEL IS UNDER DUE) ── */}
      {overallMetrics.underDueStages.length > 0 && (
        <div className="p-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-card border border-amber-500/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-foreground">
                  Levels Under Due: <strong className="text-amber-600 dark:text-amber-400 font-extrabold font-mono text-base">₹{overallMetrics.underDueAmount.toLocaleString()}</strong>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {overallMetrics.underDueStages.length} Level{overallMetrics.underDueStages.length > 1 ? 's' : ''} Awaiting Payment
                </span>
                {overallMetrics.underDueStages.some(s => s.isOverdue) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30 animate-pulse">
                    Overdue
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Client collection pending on: {overallMetrics.underDueStages.map(s => `${s.stageName} (₹${s.balance.toLocaleString()})`).join(' • ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Stages List (Sequential) ── */}
      <div className="space-y-3">
        {masterStages.map((stageName, idx) => {
          const data = getStageData(stageName);
          const isExpanded = expandedStage === stageName;
          const fin = getStageFinancials(stageName, data);

          // Work status
          const completionStatus = data.completionStatus || 'pending';
          const stageRequests = stageCompletionRequests.filter(
            r => r.siteId === site.id && r.stageName === stageName
          );
          const pendingRequests = stageRequests.filter(r => r.status === 'pending');
          const hasPendingApproval = pendingRequests.length > 0 || completionStatus === 'completion_requested';

          // Sequential unlock check
          let previousStagesAllCompleted = true;
          for (let i = 0; i < idx; i++) {
            const prevData = getStageData(masterStages[i]);
            if (prevData.completionStatus !== 'completed') {
              previousStagesAllCompleted = false;
              break;
            }
          }
          const isUnlocked = idx === 0 || previousStagesAllCompleted;
          const isLocked = !isUnlocked;

          // Payment Status & Under Due Check (Unique Highlighting)
          const isOverdue = !!(data.dueDate && new Date(data.dueDate) < new Date() && fin.balance > 0);
          const isCompletedWithDue = completionStatus === 'completed' && fin.balance > 0;
          const isUnderDue = isOverdue || isCompletedWithDue;

          let paymentStatusBadge: 'paid' | 'pending' | 'due' | 'overdue' = 'pending';
          if (data.expectedAmount > 0 && data.paidAmount >= data.expectedAmount) {
            paymentStatusBadge = 'paid';
          } else if (isOverdue) {
            paymentStatusBadge = 'overdue';
          } else if (isCompletedWithDue) {
            paymentStatusBadge = 'due';
          }

          return (
            <div
              key={stageName}
              className={`rounded-2xl border transition-all ${
                isOverdue
                  ? 'border-destructive/70 bg-gradient-to-r from-destructive/[0.08] via-destructive/[0.02] to-card ring-2 ring-destructive/40 shadow-md'
                  : isCompletedWithDue
                    ? 'border-amber-500/70 bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.02] to-card ring-2 ring-amber-500/40 shadow-md'
                    : hasPendingApproval
                      ? 'border-blue-500/60 bg-blue-500/[0.02] shadow-sm ring-1 ring-blue-500/30'
                      : isExpanded
                        ? 'border-primary/60 shadow-md bg-card ring-1 ring-primary/20'
                        : completionStatus === 'completed'
                          ? 'border-emerald-500/30 bg-emerald-500/[0.02] hover:border-emerald-500/50'
                          : isLocked
                            ? 'border-border/40 bg-muted/20 opacity-75'
                            : 'border-border/60 hover:border-primary/40 bg-card'
              }`}
            >
              {/* Header / Summary Card */}
              <div
                className="p-3.5 sm:p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                onClick={() => handleExpand(stageName)}
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-xs ${
                    isOverdue
                      ? 'bg-destructive text-white shadow-xs animate-pulse ring-2 ring-destructive/30'
                      : isCompletedWithDue
                        ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-500/30'
                        : completionStatus === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                          : hasPendingApproval
                            ? 'bg-blue-500 text-white animate-pulse'
                            : isLocked
                              ? 'bg-muted text-muted-foreground border border-border/50'
                              : 'bg-primary/15 text-primary border border-primary/30'
                  }`}>
                    {isOverdue ? (
                      <AlertCircle className="w-4 h-4 text-white" />
                    ) : isCompletedWithDue ? (
                      <Wallet className="w-4 h-4 text-white" />
                    ) : completionStatus === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : isLocked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      idx + 1
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="text-xs sm:text-sm font-bold text-foreground">
                        {stageName.toLowerCase().startsWith('level') ? stageName : `Level ${idx + 1}: ${stageName}`}
                      </h5>

                      {/* Unique Eye-Catching Under-Due Badges */}
                      {isOverdue && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-destructive/15 text-destructive border border-destructive/30 flex items-center gap-1 animate-pulse">
                          <AlertCircle className="w-3 h-3" /> Overdue: ₹{fin.balance.toLocaleString()} Due
                        </span>
                      )}
                      {!isOverdue && isCompletedWithDue && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-2xs">
                          <Wallet className="w-3 h-3 text-amber-600" /> Payment Due: ₹{fin.balance.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 sm:gap-4 text-[11px] text-muted-foreground mt-1 flex-wrap font-medium">
                      <span>Milestone: <strong className="text-foreground">₹{data.expectedAmount.toLocaleString()}</strong></span>
                      <span>Paid: <strong className="text-emerald-600">₹{data.paidAmount.toLocaleString()}</strong></span>
                      {fin.balance > 0 && (
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                          isOverdue ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                        }`}>
                          Balance Due: ₹{fin.balance.toLocaleString()}
                        </span>
                      )}
                      <span>Level Expenses: <strong className={fin.isOverBudget ? 'text-destructive' : 'text-foreground'}>₹{fin.totalStageExpenses.toLocaleString()}</strong></span>
                      {fin.totalDaysWorked > 0 && (
                        <span className="hidden sm:inline text-muted-foreground">• {fin.totalDaysWorked} Days Logged</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Badges & Expand Icon */}
                <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                  {/* Collect Payment 1-Click Action if Balance Due */}
                  {fin.balance > 0 && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRecordPay(stageName);
                      }}
                      className="h-7 px-2.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 gap-1 rounded-lg shadow-2xs"
                    >
                      <IndianRupee className="w-3 h-3" /> Record Payment
                    </Button>
                  )}

                  {/* Work Completion Badge */}
                  {completionStatus === 'completed' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Completed
                    </span>
                  )}
                  {hasPendingApproval && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 rounded-full animate-pulse">
                      <SendHorizonal className="w-3 h-3 text-blue-600" /> Approval Needed
                    </span>
                  )}
                  {completionStatus === 'in_progress' && !hasPendingApproval && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                      <Layers className="w-3 h-3" /> In Progress
                    </span>
                  )}
                  {completionStatus === 'pending' && !hasPendingApproval && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted border border-border/50 px-2.5 py-0.5 rounded-full">
                      {isLocked ? '🔒 Locked' : '▶ Ready to Start'}
                    </span>
                  )}

                  {/* Payment Status Badge */}
                  {paymentStatusBadge === 'paid' && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Paid
                    </span>
                  )}
                  {paymentStatusBadge === 'overdue' && (
                    <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Overdue
                    </span>
                  )}

                  {/* Expense Health Indicator */}
                  {fin.isOverBudget && (
                    <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/30 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Over Budget
                    </span>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReportModalStage(stageName);
                    }}
                    className="h-7 px-2.5 text-[11px] font-bold gap-1 text-primary border-primary/30 hover:bg-primary/10 shadow-2xs rounded-lg"
                  >
                    <FileText className="w-3 h-3" /> Detail Report
                  </Button>

                  <div className="w-6 h-6 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* ── Short & Sweet Stage Detail View ── */}
              {isExpanded && (
                <div className="p-4 sm:p-5 border-t border-border/40 space-y-4 bg-muted/15 rounded-b-2xl animate-slide-up">
                  {/* Pending Stage Completion Request Action */}
                  {pendingRequests.length > 0 && (
                    <div className="p-3.5 rounded-xl border border-blue-500/40 bg-blue-500/10 space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0">
                          <SendHorizonal className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">Stage Completion Approval Requested</p>
                          <p className="text-[11px] text-muted-foreground">
                            Supervisor <strong className="text-blue-600 dark:text-blue-400 font-semibold">{pendingRequests[0].requestedByStaffName}</strong> has finished work on Level {idx + 1}
                            {pendingRequests[0].requestedAt && ` on ${format(new Date(pendingRequests[0].requestedAt), 'dd MMM yyyy')}`}.
                          </p>
                        </div>
                      </div>
                      {pendingRequests[0].notes && (
                        <div className="p-2 rounded-lg bg-background/80 border border-border/50 text-xs italic">
                          "{pendingRequests[0].notes}"
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleApproveRequest(pendingRequests[0].id, stageName)}
                          className="h-8 px-3.5 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRequest(pendingRequests[0].id, stageName)}
                          className="h-8 px-3.5 text-xs font-bold gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </div>
                    </div>
                  )}

                  {completionStatus === 'completion_requested' && pendingRequests.length === 0 && (
                    <div className="p-3.5 rounded-xl border border-blue-500/40 bg-blue-500/10 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <SendHorizonal className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold">Stage Completion Review Requested</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApproveRequest('', stageName)}
                          className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRequest('', stageName)}
                          className="h-8 px-3 text-xs font-bold text-destructive"
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Short and Sweet Metric Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-card border border-border/50 shadow-2xs">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Milestone Target</span>
                      <span className="text-sm sm:text-base font-extrabold text-foreground mt-0.5 block">
                        ₹{fin.expected.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Due: {data.dueDate ? format(new Date(data.dueDate), 'dd MMM yyyy') : 'Not set'}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-card border border-border/50 shadow-2xs">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Client Paid</span>
                      <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                        ₹{fin.paid.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {fin.balance > 0 ? `Bal: ₹${fin.balance.toLocaleString()}` : 'Fully Paid'} ({fin.paidPercent}%)
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-card border border-border/50 shadow-2xs">
                      <span className="text-[10px] font-bold text-destructive uppercase tracking-wider block">Level Cost</span>
                      <span className="text-sm sm:text-base font-extrabold text-destructive mt-0.5 block">
                        ₹{fin.totalStageExpenses.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {fin.isOverBudget ? '⚠️ Over Budget' : '✓ Under Control'}
                      </span>
                    </div>

                    <div className={`p-3 rounded-xl bg-card border shadow-2xs ${fin.netMargin >= 0 ? 'border-emerald-500/30' : 'border-destructive/30'}`}>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Net Margin</span>
                      <span className={`text-sm sm:text-base font-extrabold mt-0.5 block ${fin.netMargin >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                        {fin.netMargin >= 0 ? '+' : ''}₹{fin.netMargin.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{fin.marginPercent}% Estimated Margin</span>
                    </div>
                  </div>

                  {/* Short & Sweet Expense Breakdown Pills */}
                  <div className="p-3 rounded-xl bg-card border border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-semibold flex items-center gap-1.5 flex-wrap">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        Wages & Salary: <strong className="text-foreground">₹{fin.labourSalaryCost.toLocaleString()}</strong>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          (Crew: ₹{fin.totalCrewSalaryCost.toLocaleString()} • Sup: ₹{fin.totalSupervisorSalaryCost.toLocaleString()})
                        </span>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-semibold flex items-center gap-1.5 flex-wrap">
                        <Package className="w-3.5 h-3.5 text-primary" />
                        Materials: <strong className="text-foreground">₹{fin.totalMaterialsCost.toLocaleString()}</strong>
                        {fin.stageLogMaterialCost > 0 ? (
                          <span className="text-[10px] text-muted-foreground font-normal">
                            (Reqs: ₹{fin.stageReqCost.toLocaleString()} • Log: ₹{fin.stageLogMaterialCost.toLocaleString()})
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({fin.stageReqs.length} reqs)
                          </span>
                        )}
                      </span>
                      {fin.stageRentalCost > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/20 flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                          Rentals: <strong className="text-amber-700 dark:text-amber-400 font-mono">₹{fin.stageRentalCost.toLocaleString()}</strong>
                          <span className="text-[10px] font-normal">({fin.stageRentals.length})</span>
                        </span>
                      )}
                      <span className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-semibold flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                        Incidentals: <strong className="text-foreground">₹{fin.supervisorDailyExpenses.toLocaleString()}</strong>
                      </span>
                      {fin.manualExpenseCost > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-semibold flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-purple-500" />
                          Admin Misc: <strong className="text-foreground">₹{fin.manualExpenseCost.toLocaleString()}</strong>
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-muted-foreground font-medium">
                      📅 {fin.totalDaysWorked} Days Active
                    </div>
                  </div>

                  {/* Scope / Notes preview if any */}
                  {data.workDescription && (
                    <div className="px-3 py-2 rounded-xl bg-card border border-border/40 text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-[10px] font-bold text-foreground uppercase tracking-wider shrink-0 mt-0.5">Scope:</span>
                      <span className="truncate">{data.workDescription}</span>
                    </div>
                  )}

                  {/* ── Balance Due Alert ── */}
                  {fin.balance > 0 && fin.expected > 0 && (
                    <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/[0.07] flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">Balance Due from Client</p>
                          <p className="text-[11px] text-muted-foreground">
                            ₹{fin.paid.toLocaleString()} paid of ₹{fin.expected.toLocaleString()} milestone
                            {data.dueDate && ` · Due: ${format(new Date(data.dueDate), 'dd MMM yyyy')}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold uppercase tracking-wider">Remaining</p>
                        <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400">₹{fin.balance.toLocaleString()}</p>
                      </div>
                    </div>
                  )}

                  {/* ── Payment History ── */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <CreditCard className="w-3 h-3" /> Payment History
                        {data.payments && data.payments.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-[9px]">
                            {data.payments.length} payment{data.payments.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => openRecordPay(stageName)}
                        className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                      >
                        <IndianRupee className="w-3 h-3" /> + Record Payment
                      </button>
                    </div>
                    {(!data.payments || data.payments.length === 0) ? (
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/40 text-center text-xs text-muted-foreground italic">
                        No payments recorded yet for this level.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {[...data.payments].reverse().map((pmt, pi) => (
                          <div key={pi} className="flex items-center justify-between bg-card rounded-xl px-3 py-2.5 border border-border/50">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                                <IndianRupee className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-foreground">₹{pmt.amount.toLocaleString()}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-[10px] text-muted-foreground">{pmt.date}</p>
                                  {pmt.paymentMethod && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                      {pmt.paymentMethod}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {pmt.note && (
                              <p className="text-[10px] text-muted-foreground italic truncate max-w-[40%] text-right">{pmt.note}</p>
                            )}
                          </div>
                        ))}
                        {/* Running total */}
                        <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 text-xs">
                          <span className="font-semibold text-muted-foreground">Total Collected</span>
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">₹{fin.paid.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Short & Sweet Action Bar */}

                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-border/30">
                    <Button
                      onClick={() => setReportModalStage(stageName)}
                      className="h-9 px-4 text-xs font-bold gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-sm rounded-xl"
                    >
                      <FileText className="w-4 h-4" />
                      View Detailed Level Report
                      <ArrowRight className="w-3.5 h-3.5 opacity-70" />
                    </Button>

                    <div className="flex items-center gap-2 flex-wrap">
                      

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRecordPay(stageName)}
                        className="h-9 px-3 text-xs font-semibold gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 rounded-xl"
                      >
                        <IndianRupee className="w-3.5 h-3.5" />
                        Record Payment
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openSetup(stageName)}
                        className="h-9 px-3 text-xs font-semibold gap-1.5 rounded-xl border-border/60"
                      >
                        <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                        Settings
                      </Button>

                      <div className="flex items-center gap-1.5 bg-card border border-border/60 rounded-xl px-2.5 h-9">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Status:</span>
                        <select
                          value={completionStatus}
                          onChange={e => saveStageData(stageName, { completionStatus: e.target.value as any })}
                          className="text-xs font-bold text-foreground bg-transparent focus:outline-hidden cursor-pointer"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completion_requested">Approval Req.</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {unmatchedLogs.length > 0 && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                  <SendHorizonal className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-foreground">
                    Additional Site Work Logs & Field Entries ({unmatchedLogs.length})
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Work entries & expenses recorded by supervisors for this site.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {unmatchedLogs.map((log, idx) => (
                <div key={log.id || idx} className="p-3 bg-card rounded-xl border border-border/60 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-1.5">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <UserCircle className="w-3.5 h-3.5 text-primary" />
                      {log.staffName || 'Supervisor'}
                    </span>
                    <span className="font-mono text-muted-foreground text-[11px]">
                      📅 {log.date} {log.workLevelStage ? `• [${log.workLevelStage}]` : ''}
                    </span>
                  </div>

                  {log.notes && (
                    <p className="text-muted-foreground text-xs whitespace-pre-line bg-muted/30 p-2 rounded-lg">
                      {log.notes}
                    </p>
                  )}

                  {log.workerCounts && Object.values(log.workerCounts).some(v => Number(v) > 0) && (
                    <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Crew on site:</span>
                      {Object.entries(log.workerCounts).map(([k, v]) => {
                        const num = Number(v);
                        if (!num || num <= 0) return null;
                        const meta = getLabourTypeMeta(k);
                        return (
                          <span key={k} className="px-2 py-0.5 rounded bg-muted font-medium">
                            {meta.icon} {num} {meta.label}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {log.expenses && log.expenses.length > 0 && (
                    <div className="pt-1.5 border-t border-border/40 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-destructive block">
                        Itemized Daily Expenses:
                      </span>
                      {log.expenses.map((e, eIdx) => (
                        <div key={eIdx} className="flex justify-between items-center text-[11px]">
                          <span className="text-muted-foreground">{e.itemName}:</span>
                          <span className="font-semibold text-destructive font-mono">₹{e.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {log.incomeFromClient > 0 && (
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-border/40 text-emerald-600 font-semibold">
                      <span>Client Payment Received:</span>
                      <span className="font-mono font-bold">+₹{log.incomeFromClient.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {masterStages.length === 0 && unmatchedLogs.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
            No construction stages or payment milestones defined in Settings. Please add them in Master Data.
          </div>
        )}
      </div>

      {/* ── 1. Comprehensive Detailed Level Report Modal ── */}
      <Dialog open={reportModalStage !== null} onOpenChange={(open) => !open && setReportModalStage(null)}>
        {reportModalStage && (() => {
          const stName = reportModalStage;
          const modalFin = getStageFinancials(stName);
          const modalData = getStageData(stName);
          const modalIdx = masterStages.indexOf(stName);
          const modalTitle = stName.toLowerCase().startsWith('level') ? stName : `Level ${modalIdx + 1}: ${stName}`;

          return (
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-border/70 shadow-2xl">
              <DialogHeader className="p-5 border-b border-border/60 bg-muted/20 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                        Site Audit Report
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        modalFin.isOverBudget
                          ? 'bg-destructive/15 text-destructive border-destructive/30'
                          : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                      }`}>
                        {modalFin.isOverBudget ? '⚠️ Budget Exceeded' : '✓ Expenses Under Control'}
                      </span>
                    </div>
                    <DialogTitle className="text-lg sm:text-xl font-heading font-black text-foreground mt-1">
                      {modalTitle}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Site: <strong className="text-foreground">{site.name}</strong> • Location: {site.location || 'Not specified'}
                    </DialogDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.print()}
                      className="h-8 px-3 text-xs gap-1.5 rounded-xl border-border/60"
                    >
                      <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                      Print
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              {/* Modal Body */}
              <div className="overflow-y-auto flex-1 p-5 space-y-6">
                {/* 1. Executive Financial Summary */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                    Executive Financial Summary
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
                      <span className="text-[10px] text-muted-foreground block uppercase font-bold">Client Target</span>
                      <span className="text-base font-black text-foreground mt-0.5 block">₹{modalFin.expected.toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground">Due: {modalData.dueDate ? format(new Date(modalData.dueDate), 'dd MMM yyyy') : 'No due date'}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-2xs">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block uppercase font-bold">Client Paid</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">₹{modalFin.paid.toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {modalFin.balance > 0 ? `Balance: ₹${modalFin.balance.toLocaleString()}` : 'Fully Paid'} ({modalFin.paidPercent}%)
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 shadow-2xs">
                      <span className="text-[10px] text-destructive block uppercase font-bold">Total Expenses</span>
                      <span className="text-base font-black text-destructive mt-0.5 block">₹{modalFin.totalStageExpenses.toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground">Labour, Materials & Incidentals</span>
                    </div>

                    <div className={`p-3 rounded-xl border shadow-2xs ${modalFin.netMargin >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-destructive/10 border-destructive/20'}`}>
                      <span className="text-[10px] text-primary block uppercase font-bold">Estimated Net Margin</span>
                      <span className={`text-base font-black mt-0.5 block ${modalFin.netMargin >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                        {modalFin.netMargin >= 0 ? '+' : ''}₹{modalFin.netMargin.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{modalFin.marginPercent}% Net Profit Margin</span>
                    </div>
                  </div>

                  {/* Categorized Cost Breakdown Table */}
                  <div className="rounded-xl border border-border/60 overflow-hidden bg-card text-xs">
                    <div className="bg-muted/40 px-3.5 py-2 font-bold uppercase tracking-wider text-[11px] text-foreground flex justify-between">
                      <span>Expense Category</span>
                      <span>Total Incurred</span>
                    </div>
                    <div className="divide-y divide-border/30">
                      <div className="px-3.5 py-2.5 flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-blue-500" />
                            Crew Wages & Supervisor Salary
                          </span>
                          <span className="text-[11px] text-muted-foreground block pl-5">
                            Crew: ₹{modalFin.totalCrewSalaryCost.toLocaleString()} ({modalFin.totalCrewManDays} man-days) • Supervisor Salary: ₹{modalFin.totalSupervisorSalaryCost.toLocaleString()}
                          </span>
                        </div>
                        <span className="font-bold text-foreground">₹{modalFin.labourSalaryCost.toLocaleString()}</span>
                      </div>

                      <div
                        onClick={() => {
                          const el = document.getElementById('section-stage-requisitions');
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth' });
                          }
                          setShowAllStageReqsModal(true);
                        }}
                        className="px-3.5 py-2.5 flex justify-between items-center cursor-pointer hover:bg-primary/5 transition-colors group"
                        title="Click to view detailed requisitions, deliveries and remaining balances"
                      >
                        <div>
                          <span className="font-semibold text-foreground flex items-center gap-1.5 group-hover:text-primary transition-colors">
                            <Package className="w-3.5 h-3.5 text-primary" />
                            Material Requisitions & Deliveries
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ml-1">
                              View Details <ChevronRight className="w-3 h-3" />
                            </span>
                          </span>
                          <span className="text-[11px] text-muted-foreground block pl-5">
                            {modalFin.stageReqs.length} material requisition order{modalFin.stageReqs.length === 1 ? '' : 's'} • Click to view breakdown
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors block">
                            ₹{modalFin.stageReqCost.toLocaleString()}
                          </span>
                          {modalFin.stageReqs.length > 0 && (() => {
                            const totSupplierPrice = modalFin.stageReqs.reduce((s, r) => s + (r.supplierPrice ?? ((r.items || []).reduce((sum, it) => sum + (it.amount || (it.rate || 0) * it.quantity), 0))), 0);
                            const totPaid = modalFin.stageReqs.reduce((s, r) => s + (r.supplierPaidAmount || 0), 0);
                            const totRemaining = Math.max(0, totSupplierPrice - totPaid);
                            return totRemaining > 0 ? (
                              <span className="block text-[10px] font-mono text-destructive font-semibold">
                                Remaining: ₹{totRemaining.toLocaleString()}
                              </span>
                            ) : (
                              <span className="block text-[10px] text-emerald-600 font-semibold">
                                Fully Settled
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {modalFin.stageLogMaterialCost > 0 && (
                        <div className="px-3.5 py-2.5 flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 text-blue-500" />
                              Daily Work Log Direct Materials
                            </span>
                            <span className="text-[11px] text-muted-foreground block pl-5">
                              Materials purchased & logged on-site by supervisor
                            </span>
                          </div>
                          <span className="font-bold text-foreground">₹{modalFin.stageLogMaterialCost.toLocaleString()}</span>
                        </div>
                      )}

                      {modalFin.stageRentalCost > 0 && (
                        <div className="px-3.5 py-2.5 flex justify-between items-center bg-amber-500/[0.04]">
                          <div>
                            <span className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                              <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                              Rental Equipment & Machinery
                            </span>
                            <span className="text-[11px] text-muted-foreground block pl-5">
                              Scaffolding, tools & machinery active during this stage ({modalFin.stageRentals.length} deployments)
                            </span>
                          </div>
                          <span className="font-bold text-amber-700 dark:text-amber-400 font-mono">₹{modalFin.stageRentalCost.toLocaleString()}</span>
                        </div>
                      )}

                      <div className="px-3.5 py-2.5 flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                            Supervisor Field Incidentals
                          </span>
                          <span className="text-[11px] text-muted-foreground block pl-5">
                            Food, tea, fuel, bus/auto fares, and local purchases ({modalFin.supervisorExpenseItems.length} items)
                          </span>
                        </div>
                        <span className="font-bold text-foreground">₹{modalFin.supervisorDailyExpenses.toLocaleString()}</span>
                      </div>

                      {modalFin.manualExpenseCost > 0 && (
                        <div className="px-3.5 py-2.5 flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <Receipt className="w-3.5 h-3.5 text-purple-500" />
                              Admin Manual Expenses
                            </span>
                            <span className="text-[11px] text-muted-foreground block pl-5">
                              {modalFin.stageManualExpenses.length} admin entries
                            </span>
                          </div>
                          <span className="font-bold text-foreground">₹{modalFin.manualExpenseCost.toLocaleString()}</span>
                        </div>
                      )}

                      <div className="px-3.5 py-3 flex justify-between items-center bg-muted/20 font-black text-sm">
                        <span>TOTAL LEVEL EXPENDITURE</span>
                        <span className={modalFin.isOverBudget ? 'text-destructive font-black' : 'text-foreground'}>
                          ₹{modalFin.totalStageExpenses.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Scope of Work & Milestones Notes */}
                {(modalData.workDescription || modalData.stepsTaken || modalData.highExpenseReason) && (
                  <div className="space-y-2 p-3.5 rounded-xl bg-muted/20 border border-border/50 text-xs">
                    <h4 className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                      Scope, Inspection Checklist & Notes
                    </h4>
                    {modalData.workDescription && (
                      <div>
                        <span className="font-bold text-foreground">Work Scope: </span>
                        <span className="text-muted-foreground">{modalData.workDescription}</span>
                      </div>
                    )}
                    {modalData.stepsTaken && (
                      <div>
                        <span className="font-bold text-foreground">Handover Checklist: </span>
                        <span className="text-muted-foreground">{modalData.stepsTaken}</span>
                      </div>
                    )}
                    {modalData.highExpenseReason && (
                      <div className="text-destructive font-semibold">
                        <span>⚠️ Reason for High Expense: </span>
                        <span>{modalData.highExpenseReason}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Itemized Supervisor Field Incidental Expenses */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-amber-500" />
                      Supervisor Field Incidental Expenses ({modalFin.supervisorExpenseItems.length})
                    </h4>
                    <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md">
                      Subtotal: ₹{modalFin.supervisorDailyExpenses.toLocaleString()}
                    </span>
                  </div>

                  {modalFin.supervisorExpenseItems.length === 0 ? (
                    <div className="p-4 rounded-xl bg-card border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                      No incidental expenses logged by supervisor for this level.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {modalFin.supervisorExpenseItems.map((item, itmIdx) => (
                        <div key={itmIdx} className="p-2.5 rounded-xl bg-card border border-border/50 flex items-center justify-between shadow-2xs">
                          <div className="space-y-0.5 min-w-0 pr-2">
                            <span className="font-bold text-foreground block truncate">{item.itemName}</span>
                            <span className="text-[10px] text-muted-foreground block">
                              {format(new Date(item.date), 'dd MMM yyyy')} • Logged by {item.staffName}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-foreground shrink-0">₹{item.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Supervisor Daily Work & Crew Logs */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      Supervisor Daily Work & Crew Logs ({modalFin.supervisorWorkLogs.length} Days)
                    </h4>
                    <span className="text-xs font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-md">
                      Wages & Salary: ₹{modalFin.labourSalaryCost.toLocaleString()}
                    </span>
                  </div>

                  {modalFin.supervisorWorkLogs.length === 0 ? (
                    <div className="p-4 rounded-xl bg-card border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                      No daily supervisor work logs recorded for this level yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {modalFin.supervisorWorkLogs.map((log) => (
                        <div key={log.id} className="p-3 rounded-xl bg-card border border-border/50 space-y-1.5 text-xs shadow-2xs">
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{format(new Date(log.date), 'dd MMM yyyy')}</span>
                              {log.isSupervisorAllocated ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold border border-blue-500/20">
                                  Supervisor: {log.staffName}
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium border border-border/40">
                                  Crew Only (No Supervisor Assigned)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <span className="font-semibold text-muted-foreground">
                                {(() => {
                                  const tradeEntries = Object.entries(log.counts).filter(([_, c]) => (Number(c) || 0) > 0);
                                  if (tradeEntries.length === 0) return '0 Crew';
                                  return tradeEntries.map(([t, c]) => {
                                    const meta = getLabourTypeMeta(t);
                                    return `${c} ${meta.label}${Number(c) > 1 ? 's' : ''}`;
                                  }).join(', ');
                                })()} ({log.totalWorkers} worker{log.totalWorkers !== 1 ? 's' : ''} • Crew: ₹{log.dayCrewCost.toLocaleString()})
                              </span>
                              {log.daySupervisorSalary > 0 && (
                                <span className="font-semibold text-blue-600 dark:text-blue-400">
                                  • Sup Salary: ₹{log.daySupervisorSalary.toLocaleString()}
                                </span>
                              )}
                              <span className="font-bold text-foreground">• Total: ₹{log.dayTotalWages.toLocaleString()}</span>
                            </div>
                          </div>

                          {log.notes && (
                            <p className="text-muted-foreground italic border-l-2 border-primary/40 pl-2 text-[11px]">
                              "{log.notes}"
                            </p>
                          )}

                          {log.workerIds && log.workerIds.length > 0 && (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap pt-0.5">
                              <Users className="w-3 h-3 text-primary shrink-0" />
                              <span className="font-semibold text-foreground">Employees on Duty:</span>
                              <span>
                                {log.workerIds.map(id => staffList.find(s => s.id === id)?.name || id).join(', ')}
                              </span>
                            </div>
                          )}

                          {log.materials && log.materials.length > 0 && (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5">
                              <Package className="w-3 h-3 text-primary shrink-0" />
                              <span>Materials Used: {log.materials.map(m => `${m.name} × ${m.quantity}`).join(', ')}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Material Requisitions & Deliveries */}
                <div id="section-stage-requisitions" className="space-y-3 scroll-mt-6">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-primary" />
                      Material Requisitions & Deliveries for this Level ({modalFin.stageReqs.length})
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                        Total: ₹{modalFin.stageReqCost.toLocaleString()}
                      </span>
                      {modalFin.stageReqs.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAllStageReqsModal(true)}
                          className="h-7 text-[11px] font-bold gap-1 border-primary/30 text-primary hover:bg-primary/10 rounded-lg shadow-2xs"
                        >
                          <FileText className="w-3 h-3" /> Full Order Details
                        </Button>
                      )}
                    </div>
                  </div>

                  {modalFin.stageReqs.length === 0 ? (
                    <div className="p-4 rounded-xl bg-card border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                      No material requisitions placed for this level.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {modalFin.stageReqs.map(req => {
                        const totalItemCost = (req.items || []).reduce((sum, it) => sum + (it.amount || (it.rate || 0) * it.quantity), 0);
                        const supplierPrice = req.supplierPrice ?? totalItemCost;
                        const paid = req.supplierPaidAmount || 0;
                        const remaining = Math.max(0, supplierPrice - paid);

                        return (
                          <div
                            key={req.id}
                            onClick={() => setSelectedReqForDetail(req)}
                            className="p-3 rounded-xl bg-card border border-border/60 text-xs space-y-2 shadow-2xs cursor-pointer hover:border-primary/50 hover:bg-primary/[0.02] transition-all group"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                {req.items.map(i => `${i.name} (${i.quantity} ${i.unit || ''})`).join(', ')}
                              </span>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-bold text-primary font-mono block">
                                  ₹{((req.materialCost || req.supplierPrice || 0) + (req.driverWage || 0)).toLocaleString()}
                                </span>
                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                  req.status === 'completed'
                                    ? 'bg-emerald-500/15 text-emerald-600'
                                    : req.status === 'assigned'
                                    ? 'bg-blue-500/15 text-blue-600'
                                    : 'bg-amber-500/15 text-amber-600'
                                }`}>
                                  {req.status}
                                </span>
                              </div>
                            </div>

                            {/* Logistics & Supplier Detail */}
                            <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/40">
                              <div className="flex justify-between items-center">
                                <span>Req by: <strong className="text-foreground">{req.requestedByStaffName}</strong></span>
                                <span>{format(new Date(req.date), 'dd MMM yyyy')}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Supplier: <strong className="text-foreground">{req.supplierName || (req.sourceType === 'site' ? `Transfer: ${req.sourceSiteName}` : 'Direct')}</strong></span>
                                {req.driverName && (
                                  <span>Driver: <strong className="text-foreground">{req.driverName}</strong></span>
                                )}
                              </div>
                            </div>

                            {/* Financial & Remaining Balance pill */}
                            <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[10px]">
                              <span className="text-muted-foreground">
                                Paid: <strong className="text-emerald-600 font-mono">₹{paid.toLocaleString()}</strong>
                              </span>
                              <span className={`font-semibold font-mono ${remaining > 0 ? 'text-destructive font-bold' : 'text-emerald-600'}`}>
                                {remaining > 0 ? `Remaining: ₹${remaining.toLocaleString()}` : '✓ Fully Paid'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5b. Direct Daily Work Log Materials (if any) */}
                {modalFin.stageLogMaterialCost > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-blue-500" />
                        Daily Work Log Materials for this Level
                      </h4>
                      <span className="text-xs font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-md">
                        Total: ₹{modalFin.stageLogMaterialCost.toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {modalFin.stageLogs.flatMap(log => (log.materials || []).map((m, mIdx) => (
                        <div key={`${log.id}-${mIdx}`} className="p-2.5 rounded-xl bg-card border border-border/50 text-xs space-y-1 shadow-2xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-foreground">
                              {m.name} × {m.quantity}
                            </span>
                            <span className="text-[10px] font-bold text-blue-600">
                              ₹{((m.cost || 0) * (m.quantity || 1)).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex justify-between">
                            <span>Logged by {log.staffName} • {format(new Date(log.date), 'dd MMM yyyy')}</span>
                            <span>Rate: ₹{m.cost || 0}</span>
                          </div>
                        </div>
                      )))}
                    </div>
                  </div>
                )}

                {/* 5c. Rental Materials & Machinery on this Level / Site */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                        Rental Equipment & Machinery ({auditRentalView === 'all' ? allSiteRentals.length : modalFin.stageRentals.length})
                      </h4>
                      {allSiteRentals.length > 0 && allSiteRentals.length !== modalFin.stageRentals.length && (
                        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg text-[10px] font-semibold border border-border/40">
                          <button
                            type="button"
                            onClick={() => setAuditRentalView('stage')}
                            className={`px-2 py-0.5 rounded-md transition-all ${
                              auditRentalView === 'stage'
                                ? 'bg-amber-600 text-white shadow-2xs font-bold'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            This Level ({modalFin.stageRentals.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuditRentalView('all')}
                            className={`px-2 py-0.5 rounded-md transition-all ${
                              auditRentalView === 'all'
                                ? 'bg-amber-600 text-white shadow-2xs font-bold'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            All on Site ({allSiteRentals.length})
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-mono">
                        Level Cost: ₹{modalFin.stageRentalCost.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const listToDisplay = (auditRentalView === 'all' || modalFin.stageRentals.length === 0) && allSiteRentals.length > 0
                      ? allSiteRentals
                      : modalFin.stageRentals;

                    if (listToDisplay.length === 0) {
                      return (
                        <div className="p-3.5 rounded-xl bg-card/60 border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                          No rental equipment or machinery deployed for this site or level yet.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {modalFin.stageRentals.length === 0 && allSiteRentals.length > 0 && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 flex items-center justify-between">
                            <span>Showing all {allSiteRentals.length} rental deployments for this site:</span>
                            <span className="font-bold">Site Total: ₹{allSiteRentals.reduce((s, r) => s + (r.totalRentalCost || 0), 0).toLocaleString()}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {listToDisplay.map(rental => {
                            const todayStr = format(new Date(), 'yyyy-MM-dd');
                            const startMs = new Date(rental.startDate + 'T00:00:00').getTime();
                            const endMs = new Date((rental.endDate || todayStr) + 'T00:00:00').getTime();
                            const daysActive = Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1);
                            const runningCost = (rental.totalRentalCost !== undefined && rental.status === 'returned')
                              ? rental.totalRentalCost
                              : (daysActive * (rental.quantity || 1) * (rental.rentalRatePerDay || 0)) + (rental.transitCost || 0);

                            return (
                              <div key={rental.id} className="p-2.5 rounded-xl bg-card border border-amber-500/30 text-xs space-y-1.5 shadow-2xs">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-bold text-foreground truncate">{rental.materialName}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold">
                                      {rental.quantity} {rental.unit}
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 font-mono">
                                    ₹{runningCost.toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground flex items-center justify-between flex-wrap gap-1">
                                  <span>
                                    📅 {rental.startDate} {rental.endDate ? `to ${rental.endDate}` : '(Active on site)'} • {rental.totalDays || daysActive} days
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    rental.status === 'active'
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25'
                                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25'
                                  }`}>
                                    {rental.status === 'active' ? 'Active On Site' : 'Returned'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-0.5 border-t border-border/30">
                                  <span>Rate: ₹{rental.rentalRatePerDay || 0}/day {rental.transitCost ? `+ ₹${rental.transitCost} transit` : ''}</span>
                                  {rental.driverName && <span>Driver: {rental.driverName}</span>}
                                </div>
                                {rental.notes && (
                                  <div className="text-[10px] text-muted-foreground italic bg-muted/40 px-2 py-0.5 rounded">
                                    "{rental.notes}"
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 6. Client Payments Received for this Milestone */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                      Client Payment Receipts ({(modalData.payments || []).length})
                    </h4>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      Paid: ₹{modalFin.paid.toLocaleString()}
                    </span>
                  </div>

                  {(!modalData.payments || modalData.payments.length === 0) ? (
                    <div className="p-4 rounded-xl bg-card border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                      No payments received from client for this milestone yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {modalData.payments.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 shadow-2xs">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">₹{p.amount.toLocaleString()}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                                {p.paymentMethod === 'Cash' ? '💵 Cash' :
                                 p.paymentMethod === 'UPI' ? '📱 UPI' :
                                 p.paymentMethod === 'Bank Transfer' ? '🏦 Bank Transfer' :
                                 p.paymentMethod === 'Cheque' ? '📝 Cheque' :
                                 p.paymentMethod === 'Card' ? '💳 Card' : (p.paymentMethod || '💵 Cash')}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {format(new Date(p.date), 'dd MMM yyyy')} • {p.note || 'No reference note'}
                            </div>
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex sm:justify-between items-center">
                <span className="text-[11px] text-muted-foreground">
                  Comprehensive Level Audit • Generated for Admin
                </span>
                <Button onClick={() => setReportModalStage(null)} className="h-8 px-4 text-xs font-bold">
                  Close Report
                </Button>
              </DialogFooter>
            </DialogContent>
          );
        })()}
      </Dialog>

      {/* ── Material Requisitions & Deliveries Detail Dialog ── */}
      <Dialog
        open={showAllStageReqsModal || !!selectedReqForDetail}
        onOpenChange={(open) => {
          if (!open) {
            setShowAllStageReqsModal(false);
            setSelectedReqForDetail(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-border/70 shadow-2xl">
          {(() => {
            const currentStageName = reportModalStage || (selectedReqForDetail?.workLevelStage) || 'Site Requisitions';
            const reqsToShow = selectedReqForDetail
              ? [selectedReqForDetail]
              : (reportModalStage ? getStageFinancials(reportModalStage).stageReqs : []);

            const totalItemCost = reqsToShow.reduce((s, r) => s + ((r.items || []).reduce((sum, it) => sum + (it.amount || (it.rate || 0) * it.quantity), 0)), 0);
            const totalBill = reqsToShow.reduce((s, r) => s + (r.supplierPrice ?? totalItemCost), 0);
            const totalPaid = reqsToShow.reduce((s, r) => s + (r.supplierPaidAmount || 0), 0);
            const totalRemaining = Math.max(0, totalBill - totalPaid);

            return (
              <>
                <DialogHeader className="p-5 border-b border-border/60 bg-muted/20">
                  <div className="flex items-center justify-between pr-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                          Material Delivery & Billing Audit
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          totalRemaining > 0
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                        }`}>
                          {totalRemaining > 0 ? `₹${totalRemaining.toLocaleString()} Remaining Due` : '✓ All Supplier Bills Settled'}
                        </span>
                      </div>
                      <DialogTitle className="text-lg font-heading font-black text-foreground flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" />
                        Material Requisitions & Deliveries
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        Level: <strong className="text-foreground">{currentStageName}</strong> • Site: <strong className="text-foreground">{site.name}</strong>
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-muted/10 border-b border-border/50 text-xs">
                  <div className="p-2.5 rounded-xl bg-card border border-border/50 shadow-2xs">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Requisitions</span>
                    <span className="text-sm font-black text-foreground mt-0.5 block">{reqsToShow.length} Orders</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-card border border-border/50 shadow-2xs">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Total Billed</span>
                    <span className="text-sm font-black text-foreground mt-0.5 block font-mono">₹{totalBill.toLocaleString()}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-2xs">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold block">Paid to Vendors</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block font-mono">₹{totalPaid.toLocaleString()}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl shadow-2xs ${totalRemaining > 0 ? 'bg-destructive/10 border border-destructive/25' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                    <span className={`text-[10px] uppercase font-bold block ${totalRemaining > 0 ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-400'}`}>Remaining Balance</span>
                    <span className={`text-sm font-black mt-0.5 block font-mono ${totalRemaining > 0 ? 'text-destructive' : 'text-emerald-600'}`}>₹{totalRemaining.toLocaleString()}</span>
                  </div>
                </div>

                {/* Requisitions List */}
                <div className="overflow-y-auto flex-1 p-4 space-y-4">
                  {reqsToShow.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground bg-card border border-dashed rounded-xl">
                      No material requisitions found for this level.
                    </div>
                  ) : (
                    reqsToShow.map(req => {
                      const reqItemCost = (req.items || []).reduce((sum, it) => sum + (it.amount || (it.rate || 0) * it.quantity), 0);
                      const reqPrice = req.supplierPrice ?? reqItemCost;
                      const reqPaid = req.supplierPaidAmount || 0;
                      const reqBal = Math.max(0, reqPrice - reqPaid);

                      return (
                        <div key={req.id} className="p-4 rounded-xl bg-card border border-border/60 shadow-xs space-y-3">
                          {/* Order Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border/40">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-foreground">
                                  Order #{req.id.slice(-6).toUpperCase()}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  req.status === 'completed'
                                    ? 'bg-emerald-500/15 text-emerald-600'
                                    : req.status === 'assigned'
                                    ? 'bg-blue-500/15 text-blue-600'
                                    : 'bg-amber-500/15 text-amber-600'
                                }`}>
                                  {req.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Requested by <strong className="text-foreground">{req.requestedByStaffName}</strong> on {req.date} {req.time ? `at ${req.time}` : ''}
                              </p>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Bill Total</span>
                              <span className="text-base font-extrabold text-foreground font-mono">
                                ₹{reqPrice.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Sourcing & Logistics Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-muted/20 rounded-lg text-xs">
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Source / Supplier</span>
                              <span className="font-semibold text-foreground">
                                {req.sourceType === 'site'
                                  ? `Transferred from: ${req.sourceSiteName || 'Other Site'}`
                                  : (req.supplierName || 'Direct Purchase / Unassigned')}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Driver & Dispatch</span>
                              <span className="font-semibold text-foreground flex items-center gap-1">
                                <Truck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                {req.driverName ? `${req.driverName} (${req.vehicle || 'Vehicle'})` : 'No Driver Assigned'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Timings / Duration</span>
                              <span className="font-semibold text-foreground">
                                {req.startTime ? `${req.startTime} → ${req.endTime || 'Active'}` : 'Not recorded'}
                                {req.duration ? ` (${req.duration})` : ''}
                              </span>
                            </div>
                          </div>

                          {/* Itemized Materials Table */}
                          <div className="rounded-lg border border-border/50 overflow-hidden text-xs">
                            <div className="bg-muted/40 px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground grid grid-cols-12 gap-2">
                              <span className="col-span-6">Material Item</span>
                              <span className="col-span-2 text-center">Quantity</span>
                              <span className="col-span-2 text-right">Unit Rate</span>
                              <span className="col-span-2 text-right">Amount</span>
                            </div>
                            <div className="divide-y divide-border/30 bg-card">
                              {req.items.map((it, idx) => {
                                const rate = it.rate ?? it.supplierRate ?? it.clientRate ?? 0;
                                const amt = it.amount ?? (rate * it.quantity);
                                return (
                                  <div key={idx} className="px-3 py-2 grid grid-cols-12 gap-2 items-center text-xs">
                                    <div className="col-span-6">
                                      <span className="font-semibold text-foreground">{it.name}</span>
                                      {it.notes && (
                                        <p className="text-[10px] text-muted-foreground italic">{it.notes}</p>
                                      )}
                                    </div>
                                    <span className="col-span-2 text-center font-mono font-medium">
                                      {it.quantity} {it.unit || ''}
                                    </span>
                                    <span className="col-span-2 text-right font-mono text-muted-foreground">
                                      {rate > 0 ? `₹${rate.toLocaleString()}` : '-'}
                                    </span>
                                    <span className="col-span-2 text-right font-mono font-bold text-foreground">
                                      {amt > 0 ? `₹${amt.toLocaleString()}` : '-'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Payment & Remaining Balance Ledger */}
                          <div className="p-3 bg-muted/30 rounded-xl border border-border/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-muted-foreground">
                                Supplier Bill: <strong className="text-foreground font-mono">₹{reqPrice.toLocaleString()}</strong>
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-emerald-700 dark:text-emerald-400">
                                Paid: <strong className="font-mono">₹{reqPaid.toLocaleString()}</strong>
                                {req.supplierPaymentMethod && (
                                  <span className="text-[10px] ml-1 px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 font-sans">
                                    {req.supplierPaymentMethod}
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-muted-foreground uppercase">Remaining:</span>
                              <span className={`text-sm font-black font-mono px-2.5 py-0.5 rounded-lg border ${
                                reqBal > 0
                                  ? 'bg-destructive/10 text-destructive border-destructive/30'
                                  : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                              }`}>
                                {reqBal > 0 ? `₹${reqBal.toLocaleString()}` : '✓ Fully Paid'}
                              </span>
                            </div>
                          </div>

                          {req.notes && (
                            <p className="text-[11px] text-muted-foreground italic border-l-2 border-primary/40 pl-2">
                              "{req.notes}"
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground">
                    Level Requisitions & Deliveries Audit
                  </span>
                  <Button
                    onClick={() => {
                      setShowAllStageReqsModal(false);
                      setSelectedReqForDetail(null);
                    }}
                    className="h-8 px-4 text-xs font-bold"
                  >
                    Close
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── 2. Clean Record Payment Dialog ── */}
      <Dialog open={recordPayStage !== null} onOpenChange={(open) => !open && setRecordPayStage(null)}>
        {recordPayStage && (
          <DialogContent className="max-w-md rounded-2xl border-border/70 p-5 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
                Record Client Payment: {recordPayStage}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Enter payment received from client for this milestone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 50000"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="h-9 text-xs mt-1"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Payment Date</Label>
                  <Input
                    type="date"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Payment Method *</Label>
                  <select
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value as any)}
                    className="flex h-9 w-full rounded-xl border border-input bg-card px-2.5 text-xs shadow-xs mt-1 font-semibold text-foreground cursor-pointer"
                  >
                    <option value="Cash">💵 Cash</option>
                    <option value="UPI">📱 UPI / GPay / PhonePe</option>
                    <option value="Bank Transfer">🏦 Bank Transfer (NEFT/RTGS)</option>
                    <option value="Cheque">📝 Cheque</option>
                    <option value="Card">💳 Card</option>
                    <option value="Other">🌐 Other Method</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Reference / Notes (Cheque / UPI / Bank Ref)</Label>
                <Input
                  placeholder="e.g. Cheque #40291 HDFC Bank, GPay Ref 4029103"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  className="h-9 text-xs mt-1"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setRecordPayStage(null)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleAddPayment(recordPayStage)}
                className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Save Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ── 3. Milestone Setup & Settings Dialog ── */}
      <Dialog open={setupStage !== null} onOpenChange={(open) => !open && setSetupStage(null)}>
        {setupStage && (
          <DialogContent className="max-w-lg rounded-2xl border-border/70 p-5 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                Milestone Settings: {setupStage}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Configure milestone target amount, scope of work, and expense monitoring.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Milestone Target (₹)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 250000"
                    value={expectedAmount}
                    onChange={e => setExpectedAmount(e.target.value)}
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="h-9 text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Scope of Work</Label>
                <Textarea
                  placeholder="Scope of work for this level..."
                  value={workDescription}
                  onChange={e => setWorkDescription(e.target.value)}
                  className="min-h-[60px] text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Milestone Notes / Handover Checklist</Label>
                <Textarea
                  placeholder="Inspection requirements or handover checklist..."
                  value={stepsTaken}
                  onChange={e => setStepsTaken(e.target.value)}
                  className="min-h-[60px] text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Expense Status Tag</Label>
                  <select
                    value={expenseStatus}
                    onChange={e => setExpenseStatus(e.target.value as any)}
                    className="flex h-9 w-full rounded-xl border border-input bg-card px-3 text-xs shadow-xs mt-1"
                  >
                    <option value="">Select Status</option>
                    <option value="under_control">Under Control</option>
                    <option value="high">High Expense</option>
                  </select>
                </div>

                {expenseStatus === 'high' && (
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-destructive">Reason for High Expense</Label>
                    <Input
                      type="text"
                      placeholder="e.g. Extra steel reinforcement..."
                      value={highExpenseReason}
                      onChange={e => setHighExpenseReason(e.target.value)}
                      className="h-9 text-xs mt-1 border-destructive/50"
                    />
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setSetupStage(null)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleSaveSetup(setupStage)}
                className="h-8 text-xs font-bold"
              >
                Save Settings
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ── 4. Deploy Rental Equipment to Milestone Dialog ── */}
      <Dialog open={deployRentalStage !== null} onOpenChange={(open) => !open && setDeployRentalStage(null)}>
        {deployRentalStage && (
          <DialogContent className="max-w-md rounded-2xl border-border/70 p-5 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-600" />
                Deploy Rental Equipment: {deployRentalStage}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Deploy scaffolding, machinery, or tools to {site.name} for this level. Daily rent will be added to this level's expenses.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleDeployRentalSubmit} className="space-y-3 text-xs">
              {/* Material Selection from catalog or custom */}
              {materialSettings.filter(m => m.isRental).length > 0 && (
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                    Select from Rental Catalog
                  </Label>
                  <select
                    value={stageRentalMatId}
                    onChange={e => {
                      const sel = materialSettings.find(m => m.id === e.target.value);
                      if (sel) {
                        setStageRentalMatId(sel.id);
                        setStageRentalMatName(sel.name);
                        setStageRentalUnit(sel.unit || 'Nos');
                        setStageRentalRate(sel.rentalRatePerDay ? sel.rentalRatePerDay.toString() : (sel.defaultRate ? sel.defaultRate.toString() : ''));
                      } else {
                        setStageRentalMatId('');
                      }
                    }}
                    className="flex h-9 w-full rounded-xl border border-input bg-card px-3 text-xs shadow-xs mt-1 font-medium"
                  >
                    <option value="">-- Choose from Rental Catalog or type below --</option>
                    {materialSettings.filter(m => m.isRental).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.unit || 'Nos'}) - ₹{m.rentalRatePerDay || m.defaultRate || 0}/day
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Equipment / Machine Name *
                </Label>
                <Input
                  placeholder="e.g. MS Scaffolding 20 Sets, Concrete Mixer, Generator"
                  value={stageRentalMatName}
                  onChange={e => setStageRentalMatName(e.target.value)}
                  required
                  className="h-9 text-xs mt-1 font-semibold"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Qty *</Label>
                  <Input
                    type="number"
                    min="0.1"
                    step="any"
                    value={stageRentalQty}
                    onChange={e => setStageRentalQty(e.target.value)}
                    required
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Unit</Label>
                  <Input
                    placeholder="Nos / Sets"
                    value={stageRentalUnit}
                    onChange={e => setStageRentalUnit(e.target.value)}
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Rent/Day (₹) *</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g. 350"
                    value={stageRentalRate}
                    onChange={e => setStageRentalRate(e.target.value)}
                    required
                    className="h-9 text-xs mt-1 border-amber-500/50 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Start Date *</Label>
                  <Input
                    type="date"
                    value={stageRentalStartDate}
                    onChange={e => setStageRentalStartDate(e.target.value)}
                    required
                    className="h-9 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Return Date (Optional)</Label>
                  <Input
                    type="date"
                    value={stageRentalEndDate}
                    onChange={e => setStageRentalEndDate(e.target.value)}
                    className="h-9 text-xs mt-1"
                  />
                </div>
              </div>

              {/* Transit & Driver toggle */}
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stageRentalRequiresDriver}
                    onChange={e => setStageRentalRequiresDriver(e.target.checked)}
                    className="rounded border-input text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-semibold text-foreground">Dispatched with Driver & Vehicle</span>
                </label>

                {stageRentalRequiresDriver && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                    <div>
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Driver</Label>
                      <select
                        value={stageRentalDriverId}
                        onChange={e => {
                          const drv = staffList.find(s => s.id === e.target.value);
                          setStageRentalDriverId(e.target.value);
                          setStageRentalDriverName(drv ? drv.name : '');
                        }}
                        className="flex h-8 w-full rounded-lg border border-input bg-card px-2 text-xs shadow-xs mt-1"
                      >
                        <option value="">Select Driver</option>
                        {staffList.filter(s => s.role === 'driver' || s.role === 'staff').map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Transit Cost (₹)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 500"
                        value={stageRentalTransitCost}
                        onChange={e => setStageRentalTransitCost(e.target.value)}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Remarks / Location on Site</Label>
                <Input
                  placeholder="e.g. For front exterior scaffolding, ground floor mixer"
                  value={stageRentalNotes}
                  onChange={e => setStageRentalNotes(e.target.value)}
                  className="h-9 text-xs mt-1"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDeployRentalStage(null)} className="h-8 text-xs">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Deploy to {deployRentalStage}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
};
