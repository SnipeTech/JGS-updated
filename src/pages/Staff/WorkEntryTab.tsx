import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Send, MapPin, Users, Package, Clock, Plus, Trash2,
  Bike, Bus, Car, Footprints, AlertCircle, Search, Sparkles,
  Layers, CheckCircle2, SendHorizonal, Lock, Unlock, ShieldCheck, ArrowRight,
  PenLine, X, IndianRupee, UserCheck, ChevronDown, ChevronUp, History, Building2
} from 'lucide-react';
import { Material, TransportMode, TRANSPORT_RATES, Site, Staff } from '@/types';
import { getLabourTypeMeta } from './StaffAttendanceTab';

interface WorkEntryTabProps {
  staff: Staff | undefined;
  mySites: Site[];
  onSubmissionSuccess?: () => void;
  onNavigateToMaterialRequest?: (siteId?: string) => void;
  onNavigateToAttendance?: () => void;
}

export const WorkEntryTab = ({
  staff,
  mySites,
  onSubmissionSuccess,
  onNavigateToMaterialRequest,
  onNavigateToAttendance
}: WorkEntryTabProps) => {
  const { addDailyLog, updateDailyLog, dailyLogs, staffList, attendances, sites, paymentStageMaster, stageCompletionRequests, addStageCompletionRequest, updateSite, labourTypes } = useApp();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const effectiveLabourTypes = useMemo(() => {
    if (labourTypes && labourTypes.length > 0) return labourTypes;
    return ['painter', 'plumber', 'labour'];
  }, [labourTypes]);

  // Attendances for today
  const todayAttendances = (attendances || []).filter(a => a.date === todayStr);

  // Staff's own attendance for today
  const myAtt = todayAttendances.find(a => a.staffId === staff?.id);
  const isSelfPresent = myAtt?.status === 'present' || myAtt?.status === 'half-day';
  const availableCrew = (myAtt?.presentCounts || {}) as Record<string, number>;

  // Set of site IDs specifically assigned to this supervisor
  const assignedSiteIdSet = useMemo(() => {
    return new Set(mySites.map(s => s.id));
  }, [mySites]);

  // All sites available to view and log work entries for, prioritizing attendance active site and assigned sites
  const allAvailableSites = useMemo(() => {
    return [...sites].sort((a, b) => {
      if (myAtt?.siteId && a.id === myAtt.siteId) return -1;
      if (myAtt?.siteId && b.id === myAtt.siteId) return 1;
      const aAssigned = assignedSiteIdSet.has(a.id);
      const bAssigned = assignedSiteIdSet.has(b.id);
      if (aAssigned && !bAssigned) return -1;
      if (!aAssigned && bAssigned) return 1;
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [sites, assignedSiteIdSet, myAtt?.siteId]);

  const defaultSiteId = useMemo(() => {
    return myAtt?.siteId || localStorage.getItem('today_active_site_id') || (mySites.length > 0 ? mySites[0].id : (allAvailableSites.length > 0 ? allAvailableSites[0].id : ''));
  }, [myAtt?.siteId, mySites, allAvailableSites]);

  const [siteId, setSiteId] = useState(defaultSiteId);
  const [siteSearch, setSiteSearch] = useState('');
  const [siteFilterScope, setSiteFilterScope] = useState<'all' | 'assigned' | 'active'>('all');
  const [showRecentSiteLogs, setShowRecentSiteLogs] = useState(false);
  const [customSiteMode, setCustomSiteMode] = useState(false);
  const [customSiteName, setCustomSiteName] = useState('');
  const [visitReason, setVisitReason] = useState('');
  const [hoursWorked, setHoursWorked] = useState('8');
  const [workDesc, setWorkDesc] = useState('');
  const [income, setIncome] = useState('');
  const [incomePaymentMethod, setIncomePaymentMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card'>('Cash');
  const [workerCounts, setWorkerCounts] = useState<Record<string, number>>({});
  const [selectedWorkLevel, setSelectedWorkLevel] = useState('');
  const [completionNote, setCompletionNote] = useState('');
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);

  // Selected Workers / Employees on Duty for this site
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);

  // Salary breakdown toggle
  const [showSalaryBreakdown, setShowSalaryBreakdown] = useState(false);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Check if today's work log already exists for this site
  const todayLog = useMemo(() => {
    if (!siteId) return undefined;
    const myLog = (dailyLogs || []).find(l =>
      l.siteId === siteId &&
      l.date === todayStr &&
      staff?.id && (l.staffId === staff.id || l.staffName === staff.name)
    );
    if (myLog) return myLog;
    return (dailyLogs || []).find(l => l.siteId === siteId && l.date === todayStr);
  }, [dailyLogs, siteId, todayStr, staff]);

  // Pre-populate form when supervisor clicks Edit Entry
  const startEditLog = (log: typeof todayLog) => {
    if (!log) return;
    setEditingLogId(log.id);
    setWorkDesc(log.notes || '');
    if (log.workerCounts && Object.values(log.workerCounts).some(v => (Number(v) || 0) > 0)) {
      setWorkerCounts(log.workerCounts);
    } else if (siteLabourAllocation?.counts) {
      setWorkerCounts(siteLabourAllocation.counts);
    }
    setSelectedWorkers(log.workerIds || []);
    const manualExpenses = (log.expenses || []).filter(
      e => !e.itemName.includes('Supervisor Attendance Expense') && !e.itemName.includes('Supervisor Salary')
    );
    setExpenses(manualExpenses);
    setIncome(log.incomeFromClient ? log.incomeFromClient.toString() : '');
    setIncomePaymentMethod((log.incomePaymentMethod as any) || 'Cash');
    if (log.workLevelStage) {
      setSelectedWorkLevel(log.workLevelStage);
    }
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingLogId(null);
  };

  // Initialize siteId once on mount if empty (prevent forcing back when user selects another site)
  useEffect(() => {
    if (!siteId) {
      const attSite = myAtt?.siteId || localStorage.getItem('today_active_site_id');
      if (attSite) {
        setSiteId(attSite);
      } else if (defaultSiteId) {
        setSiteId(defaultSiteId);
      }
    }
  }, [myAtt?.siteId, defaultSiteId, siteId]);

  const displayedSites = useMemo(() => {
    let list = allAvailableSites;
    if (siteFilterScope === 'assigned' && mySites.length > 0) {
      list = list.filter(s => assignedSiteIdSet.has(s.id));
    } else if (siteFilterScope === 'active') {
      list = list.filter(s => s.status === 'active');
    }
    if (siteSearch.trim()) {
      const q = siteSearch.toLowerCase().trim();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.clientName && s.clientName.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allAvailableSites, siteFilterScope, mySites, assignedSiteIdSet, siteSearch]);

  // Previous work entries logged for the currently selected site
  const siteRecentLogs = useMemo(() => {
    if (!siteId || customSiteMode) return [];
    return (dailyLogs || [])
      .filter(l => l.siteId === siteId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [dailyLogs, siteId, customSiteMode]);

  // Effective supervisor attendance (handles both supervisor logged in or staff under a supervisor)
  const effectiveSupervisorAtt = useMemo(() => {
    if (staff?.role === 'supervisor') return myAtt;
    if (staff?.supervisorId) {
      const sup = todayAttendances.find(a => a.staffId === staff.supervisorId);
      if (sup) return sup;
    }
    return myAtt;
  }, [staff, myAtt, todayAttendances]);

  // Site labour allocation from Team Attendance for this site
  const siteLabourAllocation = useMemo(() => {
    const primaryAtt = effectiveSupervisorAtt || myAtt;
    // 1. Direct match in supervisor's siteAssignments with positive counts
    const directMatch = primaryAtt?.siteAssignments?.find(sa => sa.siteId === siteId);
    if (directMatch && (
      Object.values(directMatch.counts || {}).some(v => (Number(v) || 0) > 0) ||
      Object.values(directMatch.halfDayCounts || {}).some(v => (Number(v) || 0) > 0)
    )) {
      return directMatch;
    }

    // 2. Check any attendance record for today that allocated labour to this site
    for (const a of todayAttendances) {
      const match = a.siteAssignments?.find(sa => sa.siteId === siteId);
      if (match && (
        Object.values(match.counts || {}).some(v => (Number(v) || 0) > 0) ||
        Object.values(match.halfDayCounts || {}).some(v => (Number(v) || 0) > 0)
      )) {
        return match;
      }
    }

    if (directMatch) return directMatch;

    // 3. Fallback: if supervisor assigned this site as primary today and logged presentCounts
    if (primaryAtt?.siteId === siteId && (primaryAtt?.presentCounts || primaryAtt?.halfDayCounts)) {
      const hasPresent = Object.values(primaryAtt.presentCounts || {}).some(v => (Number(v) || 0) > 0);
      const hasHalf = Object.values(primaryAtt.halfDayCounts || {}).some(v => (Number(v) || 0) > 0);
      if (hasPresent || hasHalf) {
        return {
          siteId,
          counts: primaryAtt.presentCounts || {},
          halfDayCounts: primaryAtt.halfDayCounts || {}
        };
      }
    }

    return undefined;
  }, [effectiveSupervisorAtt, myAtt, siteId, todayAttendances]);

  // Strictly only the labour trades that were actually allocated in Team Attendance for this site
  const allocatedLabourTypes = useMemo(() => {
    if (siteLabourAllocation) {
      const fullTrades = Object.entries(siteLabourAllocation.counts || {})
        .filter(([_, v]) => (Number(v) || 0) > 0)
        .map(([k]) => k);
      const halfTrades = Object.entries(siteLabourAllocation.halfDayCounts || {})
        .filter(([_, v]) => (Number(v) || 0) > 0)
        .map(([k]) => k);
      return Array.from(new Set([...fullTrades, ...halfTrades]));
    }
    return [];
  }, [siteLabourAllocation]);

  // Auto-fill worker counts when siteId changes (strictly from Team Attendance site allocation)
  useEffect(() => {
    if (siteId && !todayLog && !isEditing) {
      if (siteLabourAllocation?.counts) {
        setWorkerCounts(siteLabourAllocation.counts);
      } else {
        setWorkerCounts({});
      }
    }
  }, [siteId, siteLabourAllocation, todayLog, isEditing]);

  // Auto-sync assigned workers when site changes or team attendance changes
  useEffect(() => {
    if (!siteId || isEditing) return;

    // If today's log already exists and has saved workerIds, use those
    if (todayLog && todayLog.workerIds && todayLog.workerIds.length > 0) {
      setSelectedWorkers(todayLog.workerIds);
      return;
    }

    // Otherwise (no log yet, or log exists but has no workerIds), auto-detect from attendance
    const currentSite = sites.find(s => s.id === siteId);

    // 1. Staff whose attendance today is allocated to this site
    const todaySiteStaff = todayAttendances
      .filter(a => a.siteId === siteId && a.status !== 'absent')
      .map(a => a.staffId);

    // 2. Team members under this supervisor who are present and not on another site
    const myTeamStaff = staffList
      .filter(s => s.supervisorId === staff?.id && s.id !== staff?.id)
      .filter(s => {
        const a = todayAttendances.find(att => att.staffId === s.id);
        if (a?.status === 'absent') return false;
        if (a?.siteId && a.siteId !== siteId) return false;
        return true;
      })
      .map(s => s.id);

    // 3. Site assigned staff (non-absent, not on another site)
    const siteStaff = (currentSite?.assignedStaffIds || []).filter(id => {
      const a = todayAttendances.find(att => att.staffId === id);
      return a?.status !== 'absent' && (!a?.siteId || a?.siteId === siteId);
    });

    const combined = Array.from(new Set([...todaySiteStaff, ...myTeamStaff, ...siteStaff]));
    setSelectedWorkers(combined);
  }, [siteId, sites, staffList, staff?.id, todayAttendances, todayLog, isEditing]);

  // Additional expenses
  const [expenses, setExpenses] = useState<{ itemName: string; amount: number }[]>([]);
  const [expenseMode, setExpenseMode] = useState<'food' | 'bike_petrol' | 'auto' | 'bus' | 'materials' | 'tools' | 'other'>('food');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseCustom, setExpenseCustom] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  const EXPENSE_LABELS: Record<string, string> = {
    food: 'Food & Tea for Crew',
    bike_petrol: 'Bike Petrol / Fuel',
    auto: 'Auto / Cab Fare',
    bus: 'Bus / Train Fare',
    materials: 'Local Materials / Hardware',
    tools: 'Tool Hire / Purchase',
    other: 'Other Misc Expense',
  };

  const addExpense = () => {
    const baseLabel = EXPENSE_LABELS[expenseMode] || expenseMode;
    const detail = (expenseMode === 'other' ? expenseCustom : expenseNote).trim();
    if (expenseMode === 'other' && !detail) {
      toast.error('Please enter the description of the expense');
      return;
    }
    if (!expenseAmount || Number(expenseAmount) <= 0) {
      toast.error('Enter a valid expense amount');
      return;
    }
    const finalName = detail ? `${baseLabel} - ${detail}` : baseLabel;
    setExpenses(prev => [...prev, { itemName: finalName, amount: Number(expenseAmount) || 0 }]);
    setExpenseCustom('');
    setExpenseNote('');
    setExpenseAmount('');
  };

  const removeExpense = (i: number) => setExpenses(prev => prev.filter((_, idx) => idx !== i));

  // Selected site object
  const selectedSite = useMemo(() => sites.find(s => s.id === siteId), [sites, siteId]);

  // Supervisor daily salary for this site based on today's Team Attendance
  const supervisorSalaryInfo = useMemo(() => {
    const supervisorStaff = (staff?.role === 'supervisor' ? staff : undefined) ||
      (staff?.supervisorId ? staffList.find(s => s.id === staff.supervisorId) : undefined) ||
      (selectedSite?.supervisorId ? staffList.find(s => s.id === selectedSite.supervisorId) : undefined) ||
      staff;

    if (!supervisorStaff) return null;

    // Check attendance for today
    const att = todayAttendances.find(a => a.staffId === supervisorStaff.id);

    // Supervisor is strictly allocated to this site only if:
    // Their own attendance record in Team Attendance has siteId === this site
    const isAllocatedToThisSite = Boolean(att?.siteId && att.siteId === siteId);

    if (!isAllocatedToThisSite) return null;
    if (att?.status === 'absent') return null;

    const baseSalary = Number(supervisorStaff.perDaySalary) ||
      (supervisorStaff.salaryType === 'hourly' ? (Number(supervisorStaff.perHourSalary) || 0) * 8 : 1200);

    const isHalfDay = att?.status === 'half-day';
    const multiplier = isHalfDay ? 0.5 : 1.0;
    const baseWage = baseSalary * multiplier;

    const otHours = Number(att?.otHours) || 0;
    const hourlyRate = Number(supervisorStaff.perHourSalary) || (baseSalary / 8) || 150;
    const otPay = otHours * hourlyRate;
    const totalSalary = baseWage + otPay;

    return {
      supervisorName: supervisorStaff.name,
      supervisorId: supervisorStaff.id,
      baseSalary,
      isHalfDay,
      otHours,
      otPay,
      totalSalary,
    };
  }, [staff, staffList, selectedSite, siteId, todayAttendances]);

  // Calculate salary for ALL employees on duty at this site today (supervisor + workers)
  const allEmployeeSalaries = useMemo(() => {
    const salaries: {
      staffId: string;
      staffName: string;
      role: string;
      baseSalary: number;
      isHalfDay: boolean;
      otHours: number;
      otPay: number;
      totalSalary: number;
    }[] = [];

    // 1. Add supervisor salary if allocated to this site
    if (supervisorSalaryInfo) {
      salaries.push({
        staffId: supervisorSalaryInfo.supervisorId,
        staffName: supervisorSalaryInfo.supervisorName,
        role: 'supervisor',
        baseSalary: supervisorSalaryInfo.baseSalary,
        isHalfDay: supervisorSalaryInfo.isHalfDay,
        otHours: supervisorSalaryInfo.otHours,
        otPay: supervisorSalaryInfo.otPay,
        totalSalary: supervisorSalaryInfo.totalSalary,
      });
    }

    // 2. ONLY add named employees the supervisor explicitly selected in "Employees on Duty"
    // (todayLog.workerIds = saved selections, selectedWorkers = current form state)
    const workerIds = todayLog?.workerIds || selectedWorkers || [];
    workerIds.forEach(wId => {
      if (salaries.some(s => s.staffId === wId)) return; // skip if already added
      const emp = staffList.find(s => s.id === wId);
      if (!emp || emp.role === 'admin') return;

      // Get their attendance for today to check status/OT
      const att = todayAttendances.find(a => a.staffId === wId);
      if (att?.status === 'absent') return;

      const empDailyRate = Number(emp.perDaySalary) ||
        (emp.salaryType === 'hourly' ? (Number(emp.perHourSalary) || 0) * 8 : 0) ||
        Number(emp.underLabourSalary) || 0;
      if (empDailyRate <= 0) return;

      const empIsHalfDay = att?.status === 'half-day';
      const empBaseWage = empDailyRate * (empIsHalfDay ? 0.5 : 1.0);
      const empOtHours = Number(att?.otHours) || 0;
      const empHourlyRate = Number(emp.perHourSalary) || (empDailyRate / 8) || 0;
      const empOtPay = empOtHours * empHourlyRate;

      salaries.push({
        staffId: wId,
        staffName: emp.name,
        role: emp.role || 'worker',
        baseSalary: empDailyRate,
        isHalfDay: empIsHalfDay,
        otHours: empOtHours,
        otPay: empOtPay,
        totalSalary: empBaseWage + empOtPay,
      });
    });

    return salaries;
  }, [supervisorSalaryInfo, todayLog?.workerIds, selectedWorkers, staffList, todayAttendances]);

  // Calculate salary for unnamed crew (from siteLabourAllocation counts)
  const unnamedCrewSalary = useMemo(() => {
    // Determine supervisor (either logged in or site supervisor)
    const supervisor = staff?.role === 'supervisor' ? staff : staffList.find(s => s.id === selectedSite?.supervisorId) || null;
    if (!supervisor) return 0;
    const crewRate = Number(supervisor.underLabourSalary) || 0;
    if (crewRate <= 0) return 0;
    const crewOtRate = Number((supervisor as any).underLabourOT) || 0;
    // Full and half counts for unnamed crew from site labour allocation
    const allocCounts = siteLabourAllocation?.counts || {};
    const allocHalf = siteLabourAllocation?.halfDayCounts || {};
    const fullCount = Object.values(allocCounts).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const halfCount = Object.values(allocHalf).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const totalWorkers = fullCount + halfCount;
    const crewReg = (fullCount * crewRate) + (halfCount * (crewRate / 2));
    // OT from attendance (if any)
    const att = effectiveSupervisorAtt || myAtt;
    const unOtHours = Number((att as any)?.unnamedOtHours) || 0;
    const unOtStaff = (att as any)?.unnamedOtStaffCount !== undefined
      ? Number((att as any).unnamedOtStaffCount)
      : (unOtHours > 0 ? totalWorkers : 0);
    const crewOt = unOtStaff * unOtHours * crewOtRate;
    return crewReg + crewOt;
  }, [siteLabourAllocation, effectiveSupervisorAtt, myAtt, staff, selectedSite, staffList]);

  // Itemized breakdown of unnamed crew workforce allocated to this site from Team Attendance
  const unnamedCrewBreakdown = useMemo(() => {
    if (!siteLabourAllocation) return [];
    const supervisor = staff?.role === 'supervisor' ? staff : staffList.find(s => s.id === selectedSite?.supervisorId) || null;
    const crewRate = Number(supervisor?.underLabourSalary) || 800;
    const crewOtRate = Number((supervisor as any)?.underLabourOT) || 100;
    const att = effectiveSupervisorAtt || myAtt;
    const unOtHours = Number((att as any)?.unnamedOtHours) || 0;

    const items: {
      trade: string;
      label: string;
      icon: string;
      fullCount: number;
      halfCount: number;
      totalCount: number;
      rate: number;
      otHours: number;
      otPay: number;
      basePay: number;
      totalPay: number;
    }[] = [];

    const allTrades = Array.from(new Set([
      ...Object.keys(siteLabourAllocation.counts || {}),
      ...Object.keys(siteLabourAllocation.halfDayCounts || {})
    ]));

    allTrades.forEach(trade => {
      const full = Number(siteLabourAllocation.counts?.[trade]) || 0;
      const half = Number(siteLabourAllocation.halfDayCounts?.[trade]) || 0;
      const count = full + half;
      if (count > 0) {
        const meta = getLabourTypeMeta(trade);
        const basePay = (full * crewRate) + (half * (crewRate / 2));
        const otPay = unOtHours > 0 ? (count * unOtHours * crewOtRate) : 0;
        items.push({
          trade,
          label: meta.label,
          icon: meta.icon,
          fullCount: full,
          halfCount: half,
          totalCount: count,
          rate: crewRate,
          otHours: unOtHours,
          otPay,
          basePay,
          totalPay: basePay + otPay,
        });
      }
    });

    return items;
  }, [siteLabourAllocation, staff, selectedSite, staffList, effectiveSupervisorAtt, myAtt]);

  const totalUnnamedWorkers = useMemo(() => {
    return unnamedCrewBreakdown.reduce((sum, item) => sum + item.totalCount, 0);
  }, [unnamedCrewBreakdown]);

  const totalTeamWorkerCount = useMemo(() => {
    return allEmployeeSalaries.length + totalUnnamedWorkers;
  }, [allEmployeeSalaries.length, totalUnnamedWorkers]);

  const totalTeamSalary = useMemo(() => {
    // Supervisor salary (named) + allocated unnamed crew salary for that day
    const namedTotal = allEmployeeSalaries.reduce((sum, s) => sum + s.totalSalary, 0);
    return namedTotal + unnamedCrewSalary;
  }, [allEmployeeSalaries, unnamedCrewSalary]);

  // Separated Supervisor Salary for today's log overview
  const todaySupervisorSalary = useMemo(() => {
    if (todayLog?.supervisorSalary && todayLog.supervisorSalary > 0) {
      return todayLog.supervisorSalary;
    }
    const inExp = (todayLog?.expenses || []).find(e => e.itemName?.toLowerCase().includes('supervisor salary'));
    if (inExp && inExp.amount > 0) return inExp.amount;
    return supervisorSalaryInfo?.totalSalary || 0;
  }, [todayLog?.supervisorSalary, todayLog?.expenses, supervisorSalaryInfo]);

  // Pure site expenses for today's log overview (excluding supervisor salary)
  const todaySiteExpenses = useMemo(() => {
    return (todayLog?.expenses || []).filter(e => !e.itemName?.toLowerCase().includes('supervisor salary'));
  }, [todayLog?.expenses]);

  const totalTodaySiteExpenses = useMemo(() => {
    return todaySiteExpenses.reduce((s, e) => s + (e.amount || 0), 0) + (todayLog?.transportCost || 0);
  }, [todaySiteExpenses, todayLog?.transportCost]);

  // Sequential stages calculation with strict sequential progression
  const siteStages = useMemo(() => {
    if (!selectedSite || customSiteMode) return [];

    // Master list of stages for this site: ALWAYS prioritize site's custom levels
    const masterStages = (selectedSite.paymentStages && selectedSite.paymentStages.length > 0)
      ? selectedSite.paymentStages.map(s => s.stageName)
      : paymentStageMaster;

    let previousStagesAllCompleted = true;

    return masterStages.map((stageName, idx) => {
      const stageData = (selectedSite.paymentStages || []).find(s => s.stageName === stageName);
      const pendingRequest = (stageCompletionRequests || []).find(
        r => r.siteId === siteId && r.stageName === stageName && r.status === 'pending'
      );
      const isCompleted = stageData?.completionStatus === 'completed';
      const isUnlocked = idx === 0 || previousStagesAllCompleted;
      const isLocked = !isUnlocked;
      const isApprovalPending = stageData?.completionStatus === 'completion_requested' || !!pendingRequest;
      const isInProgress = stageData?.completionStatus === 'in_progress';
      const isCurrentActive = isUnlocked && !isCompleted;

      const prerequisiteStageName = idx > 0 ? masterStages[idx - 1] : undefined;

      // If this stage is not completed, then all subsequent stages MUST be locked
      if (!isCompleted) {
        previousStagesAllCompleted = false;
      }

      return {
        stageName,
        idx,
        levelNumber: idx + 1,
        completionStatus: stageData?.completionStatus || 'pending',
        isCompleted,
        isUnlocked,
        isLocked,
        isCurrentActive,
        isApprovalPending,
        isInProgress,
        hasPendingRequest: !!pendingRequest,
        prerequisiteStageName,
      };
    });
  }, [selectedSite, paymentStageMaster, siteId, stageCompletionRequests, customSiteMode]);

  // Current active stage (the first uncompleted stage in sequential order)
  const currentActiveStage = useMemo(() => {
    return siteStages.find(s => s.isCurrentActive);
  }, [siteStages]);

  const allStagesCompleted = useMemo(() => {
    return siteStages.length > 0 && siteStages.every(s => s.isCompleted);
  }, [siteStages]);

  // Active stage statistics for completion modal
  const activeStageStats = useMemo(() => {
    if (!siteId || !currentActiveStage) return { daysWorked: 0, totalExpenses: 0 };
    const logs = (dailyLogs || []).filter(l => l.siteId === siteId && l.workLevelStage === currentActiveStage.stageName);
    const daysWorked = new Set(logs.map(l => l.date)).size;
    const totalExpenses = logs.reduce((sum, l) => {
      const misc = (l.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
      const transport = l.transportCost || 0;
      return sum + misc + transport;
    }, 0);
    return { daysWorked, totalExpenses };
  }, [dailyLogs, siteId, currentActiveStage]);

  // Auto-sync selectedWorkLevel to the current active unlocked stage whenever siteId or stages change
  useEffect(() => {
    if (siteId && !customSiteMode && siteStages.length > 0) {
      if (currentActiveStage) {
        setSelectedWorkLevel(currentActiveStage.stageName);
      } else if (allStagesCompleted) {
        setSelectedWorkLevel('');
      }
    }
  }, [siteId, siteStages, customSiteMode, currentActiveStage, allStagesCompleted]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSiteName = customSiteMode
      ? customSiteName.trim()
      : (sites.find(s => s.id === siteId)?.name || mySites.find(s => s.id === siteId)?.name || '');

    if (!finalSiteName) {
      toast.error(customSiteMode ? 'Enter the site/visit name' : 'Please select a site');
      return;
    }
    if (customSiteMode && !visitReason.trim()) {
      toast.error('Please enter the reason for this visit');
      return;
    }
    if (!workDesc.trim()) { toast.error('Enter work description'); return; }

    const effectiveStage = !customSiteMode
      ? (selectedWorkLevel || currentActiveStage?.stageName || (siteStages[0]?.stageName ?? ''))
      : undefined;

    const transportCost = 0;

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const sanitizedWorkerCounts: Record<string, number> = {};
    if (siteLabourAllocation?.counts) {
      Object.entries(siteLabourAllocation.counts).forEach(([k, v]) => {
        if (Number(v) > 0) sanitizedWorkerCounts[k] = Number(v);
      });
    }

    // Pure site expenses from form (cleanly separated from supervisor salary)
    const finalExpenses = [...expenses].filter(e => !e.itemName?.toLowerCase().includes('supervisor salary'));

    const finalSupervisorSalary = supervisorSalaryInfo?.totalSalary || 0;
    const finalEmployeeSalaries = allEmployeeSalaries.filter(s => s.totalSalary > 0);

    if (editingLogId) {
      updateDailyLog(editingLogId, {
        siteName: finalSiteName,
        expenses: finalExpenses,
        supervisorSalary: finalSupervisorSalary,
        employeeSalaries: finalEmployeeSalaries,
        incomeFromClient: Number(income) || 0,
        incomePaymentMethod: Number(income) > 0 ? incomePaymentMethod : undefined,
        notes: [
          customSiteMode ? `[New/Custom Visit: ${visitReason.trim()}]` : '',
          workDesc.trim()
        ].filter(Boolean).join('\n'),
        workerCounts: sanitizedWorkerCounts,
        workLevelStage: effectiveStage,
        workerIds: selectedWorkers,
      });
      toast.success(effectiveStage ? `Work entry for ${effectiveStage} updated successfully!` : 'Work entry updated successfully!');
      setIsEditing(false);
      setEditingLogId(null);
    } else {
      addDailyLog({
        staffId: staff?.id || '',
        staffName: staff?.name || '',
        siteId: customSiteMode ? `custom_${Date.now()}` : siteId,
        siteName: finalSiteName,
        date: todayStr,
        materials: [],
        transportMode: undefined,
        transportCost: 0,
        expenses: finalExpenses,
        supervisorSalary: finalSupervisorSalary,
        employeeSalaries: finalEmployeeSalaries,
        incomeFromClient: Number(income) || 0,
        incomePaymentMethod: Number(income) > 0 ? incomePaymentMethod : undefined,
        notes: [
          customSiteMode ? `[New/Custom Visit: ${visitReason.trim()}]` : '',
          workDesc.trim()
        ].filter(Boolean).join('\n'),
        workerCounts: sanitizedWorkerCounts,
        workLevelStage: effectiveStage,
        workerIds: selectedWorkers,
      });
      toast.success(effectiveStage ? `Work log & expenses recorded for ${effectiveStage}!` : 'Work entry submitted successfully!');
      setIsEditing(false);
      setEditingLogId(null);
    }

    // Auto-update stage completionStatus to 'in_progress' if still 'pending'
    if (!customSiteMode && effectiveStage && siteId) {
      const currentSite = sites.find(s => s.id === siteId);
      if (currentSite) {
        const stages = currentSite.paymentStages || [];
        const stageData = stages.find(s => s.stageName === effectiveStage);
        if (!stageData || !stageData.completionStatus || stageData.completionStatus === 'pending') {
          const existingStages = [...stages];
          const stageIdx = existingStages.findIndex(s => s.stageName === effectiveStage);
          if (stageIdx >= 0) {
            existingStages[stageIdx] = { ...existingStages[stageIdx], completionStatus: 'in_progress' };
          } else {
            existingStages.push({ stageName: effectiveStage, expectedAmount: 0, paidAmount: 0, payments: [], completionStatus: 'in_progress' });
          }
          updateSite(siteId, { paymentStages: existingStages });
        }
      }
    }

    setWorkDesc('');
    setIncome('');
    setExpenses([]);
    onSubmissionSuccess?.();
  };

  const handleRequestCompletion = () => {
    const targetStage = currentActiveStage?.stageName || selectedWorkLevel;
    if (!targetStage || !siteId) return;
    const existing = (stageCompletionRequests || []).find(
      r => r.siteId === siteId && r.stageName === targetStage && r.status === 'pending'
    );
    if (existing) {
      toast.info('A completion request for this stage is already pending admin approval.');
      return;
    }
    const site = sites.find(s => s.id === siteId);
    addStageCompletionRequest({
      siteId,
      siteName: site?.name || '',
      stageName: targetStage,
      requestedByStaffId: staff?.id || '',
      requestedByStaffName: staff?.name || '',
      requestedAt: new Date().toISOString(),
      notes: completionNote.trim() || undefined,
      status: 'pending',
    });
    // Update stage status to 'completion_requested'
    if (site) {
      const existingStages = [...(site.paymentStages || [])];
      const stageIdx = existingStages.findIndex(s => s.stageName === targetStage);
      if (stageIdx >= 0) {
        existingStages[stageIdx] = { ...existingStages[stageIdx], completionStatus: 'completion_requested' };
      } else {
        existingStages.push({ stageName: targetStage, expectedAmount: 0, paidAmount: 0, payments: [], completionStatus: 'completion_requested' });
      }
      updateSite(siteId, { paymentStages: existingStages });
    }
    toast.success(`Level "${targetStage}" completion request submitted to Admin!`);
    setCompletionNote('');
    setIsCompletionModalOpen(false);
  };

  const isSupervisor = staff?.role === 'supervisor';
  const otherStaff = staffList.filter(s => s.id !== staff?.id && s.role !== 'admin');

  return (
    <div className="animate-slide-up-delay-2 w-full">
      <form onSubmit={handleSubmit}>
        <div className="form-card mb-5">
          <div className="section-title flex items-center gap-2 text-base pb-3 border-b border-border/40">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}>
              <Send className="w-4 h-4 text-white" />
            </div>
            Daily Work Entry
          </div>

          <div className="space-y-6 pt-1">
            {/* Active Attendance Site Notice */}
            {myAtt?.siteId && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider block">
                      Active Site from Team Attendance
                    </span>
                    <strong className="font-bold text-sm text-foreground">
                      {sites.find(s => s.id === myAtt.siteId)?.name || 'Assigned Site'}
                    </strong>
                  </div>
                </div>
                {siteId !== myAtt.siteId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSiteId(myAtt.siteId!)}
                    className="h-8 text-xs font-bold rounded-xl border-emerald-500/40 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20 shrink-0 self-start sm:self-auto"
                  >
                    Switch to Assigned Site →
                  </Button>
                )}
              </div>
            )}
            {/* Site selection */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" /> Select Site ({allAvailableSites.length} Total Projects)
                </Label>
                
                {/* Scope Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSiteFilterScope('all')}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                      siteFilterScope === 'all'
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All Sites ({allAvailableSites.length})
                  </button>
                  {mySites.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSiteFilterScope('assigned')}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                        siteFilterScope === 'assigned'
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      ⭐ My Assigned ({mySites.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSiteFilterScope('active')}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                      siteFilterScope === 'active'
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🟢 Active ({allAvailableSites.filter(s => s.status === 'active').length})
                  </button>
                </div>
              </div>

              {/* Search input - always available for instant filtering */}
              <div className="relative mb-2.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search every site by project name, client, or address..."
                  value={siteSearch}
                  onChange={e => setSiteSearch(e.target.value)}
                  className="h-10 rounded-xl pl-8 pr-8 text-sm bg-card"
                />
                {siteSearch && (
                  <button
                    type="button"
                    onClick={() => setSiteSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {displayedSites.length === 0 ? (
                <div className="text-center py-6 bg-muted/40 rounded-xl border border-border/50">
                  <p className="text-xs text-muted-foreground">
                    {siteSearch ? `No sites match "${siteSearch}"` : 'No sites found in this filter'}
                  </p>
                  {siteFilterScope !== 'all' && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => { setSiteFilterScope('all'); setSiteSearch(''); }}
                      className="text-xs text-primary mt-1"
                    >
                      View All Sites
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {displayedSites.map(s => {
                    const isActive = s.status === 'active';
                    const isSelected = siteId === s.id;
                    const isMyAssigned = assignedSiteIdSet.has(s.id);
                    const isAttSite = myAtt?.siteId === s.id;
                    const hasTodayLog = (dailyLogs || []).some(l => l.siteId === s.id && l.date === todayStr);

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSiteId(s.id);
                          setCustomSiteMode(false);
                          setSiteSearch('');
                          // Auto-fill workerCounts from attendance siteAssignments
                          const assignment = myAtt?.siteAssignments?.find(sa => sa.siteId === s.id);
                          if (assignment?.counts) {
                            setWorkerCounts(assignment.counts);
                          } else if ((!myAtt?.siteAssignments || myAtt.siteAssignments.length === 0) && myAtt?.siteId === s.id && availableCrew) {
                            setWorkerCounts(availableCrew);
                          } else {
                            setWorkerCounts({});
                          }
                        }}
                        className={`w-full text-left rounded-xl px-3.5 py-3 border transition-all flex items-center justify-between gap-3
                          ${isSelected
                            ? 'border-[hsl(38_72%_42%)] bg-[hsl(38_72%_42%/0.1)] shadow-sm ring-1 ring-[hsl(38_72%_42%/0.4)]'
                            : 'border-border/60 bg-card hover:border-[hsl(38_72%_42%/0.5)] hover:bg-muted/40 active:scale-[0.98]'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? 'bg-green-500' : s.status === 'completed' ? 'bg-gray-400' : 'bg-amber-400'}`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold truncate leading-tight text-foreground">{s.name}</p>
                              {isAttSite && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                  📍 Today
                                </span>
                              )}
                              {isMyAssigned && !isAttSite && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                  ⭐ Assigned
                                </span>
                              )}
                              {hasTodayLog && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Logged Today
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground truncate mt-0.5">
                              {s.clientName && <span>Client: {s.clientName}</span>}
                              {s.address && <span>• {s.address}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${isActive
                            ? 'bg-green-500/15 text-green-600'
                            : s.status === 'completed'
                              ? 'bg-gray-400/15 text-gray-500'
                              : 'bg-amber-400/15 text-amber-600'
                            }`}>
                            {s.status.replace('-', ' ')}
                          </span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-[hsl(38_72%_42%)] text-white flex items-center justify-center text-xs font-bold">
                              ✓
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Recent Work Entries Collapsible for Selected Site */}
              {siteId && !customSiteMode && siteRecentLogs.length > 0 && (
                <div className="mt-3 p-3 rounded-2xl bg-muted/30 border border-border/50 text-xs space-y-2">
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setShowRecentSiteLogs(v => !v)}
                  >
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-primary" />
                      Past Work Entries on {selectedSite?.name || 'this site'} ({siteRecentLogs.length})
                    </span>
                    <button type="button" className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 font-semibold">
                      <span>{showRecentSiteLogs ? 'Hide' : 'Show Past Logs'}</span>
                      {showRecentSiteLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {showRecentSiteLogs && (
                    <div className="space-y-1.5 pt-1.5 border-t border-border/40">
                      {siteRecentLogs.map(log => {
                        const logWorkers = log.workerCounts ? Object.values(log.workerCounts).reduce((s, v) => s + (Number(v) || 0), 0) : 0;
                        const logExpenseTotal = (log.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
                        return (
                          <div key={log.id} className="p-2.5 rounded-xl bg-card border border-border/40 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-foreground text-xs">{log.date}</span>
                              <span className="text-[10px] text-muted-foreground">{log.staffName || 'Supervisor'}</span>
                            </div>
                            {log.notes && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2 italic">
                                "{log.notes}"
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5">
                              {log.workLevelStage && <span>🏷️ {log.workLevelStage}</span>}
                              {logWorkers > 0 && <span>👥 {logWorkers} crew</span>}
                              {logExpenseTotal > 0 && <span>💸 ₹{logExpenseTotal.toLocaleString()} expenses</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setCustomSiteMode(v => !v);
                  setSiteId('');
                  setCustomSiteName('');
                  setVisitReason('');
                  setSiteSearch('');
                }}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border/60 text-xs font-semibold text-muted-foreground hover:border-[hsl(38_72%_42%/0.5)] hover:text-foreground transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                {customSiteMode ? 'Choose from Sites list instead' : 'Visited a new / unlisted site or office? Click here'}
              </button>
            </div>

          {/* Custom site inputs */}
          {customSiteMode && (
            <div className="space-y-3 p-3.5 rounded-xl border border-[hsl(38_72%_42%/0.3)] bg-[hsl(38_72%_42%/0.04)] animate-slide-up">
              <div>
                <Label className="text-xs font-semibold text-foreground">Location / Site Name *</Label>
                <Input
                  placeholder="e.g. Client Office, New Plot - Anna Nagar, Material Yard..."
                  value={customSiteName}
                  onChange={e => setCustomSiteName(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-foreground">Reason for Visit *</Label>
                <Input
                  placeholder="e.g. Initial measurement, Client discussion, Material purchase..."
                  value={visitReason}
                  onChange={e => setVisitReason(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-sm"
                />
              </div>
            </div>
          )}

          {todayLog && !isEditing ? (
            /* ── 1. Submitted Entry View (Edit Only Mode) ── */
            <div className="space-y-4 animate-slide-up pt-1">
              <div className="border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] via-card to-card p-4 sm:p-5 rounded-2xl shadow-xs space-y-4">
                {/* Header with Title and Edit Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border/40">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading font-bold text-sm sm:text-base text-foreground">
                          Today's Work Entry Submitted
                        </h3>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          Recorded
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {todayStr} • {selectedSite?.name || todayLog.siteName}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => startEditLog(todayLog)}
                    className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 shadow-sm text-white self-start sm:self-auto hover:opacity-90 active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                  >
                    <PenLine className="w-3.5 h-3.5" /> Edit Entry
                  </Button>
                </div>

                {/* Level Milestone Banner if present */}
                {todayLog.workLevelStage && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs">
                    <Layers className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Recorded for Milestone:</span>
                    <strong className="text-foreground">{todayLog.workLevelStage}</strong>
                  </div>
                )}

                {/* Summary Stat Grid - Separated Salary & Expenses */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 text-xs">

                  {(() => {
                    const effectiveCounts: Record<string, number> = {};
                    if (todayLog.workerCounts && Object.values(todayLog.workerCounts).some(v => (Number(v) || 0) > 0)) {
                      Object.entries(todayLog.workerCounts).forEach(([k, v]) => {
                        if (Number(v) > 0) effectiveCounts[k] = Number(v);
                      });
                    } else if (siteLabourAllocation?.counts) {
                      Object.entries(siteLabourAllocation.counts).forEach(([k, v]) => {
                        if (Number(v) > 0) effectiveCounts[k] = Number(v);
                      });
                    }
                    const halfDayCounts = siteLabourAllocation?.halfDayCounts || {};
                    const totalCrewWorkers = Object.values(effectiveCounts).reduce((s, v) => s + (Number(v) || 0), 0) +
                      Object.values(halfDayCounts).reduce((s, v) => s + (Number(v) || 0), 0);

                    return (
                      <div className="p-3 rounded-xl bg-card border border-border/50">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Unnamed Crew
                        </span>
                        <p className="font-bold text-foreground text-sm">
                          {totalCrewWorkers} Workers
                        </p>
                      </div>
                    );
                  })()}

                  <div
                    className="p-3 rounded-xl bg-card border border-blue-500/30 bg-blue-500/[0.04] cursor-pointer hover:border-blue-500/50 transition-all"
                    onClick={() => setShowSalaryBreakdown(v => !v)}
                  >
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider block mb-1">
                      Team Daily Salary
                    </span>
                    <p className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                      ₹{totalTeamSalary.toLocaleString()}
                    </p>
                    <span className="text-[9px] font-semibold text-muted-foreground block mt-0.5">
                      {allEmployeeSalaries.length} Employee{allEmployeeSalaries.length !== 1 ? 's' : ''} • Click to {showSalaryBreakdown ? 'hide' : 'view'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                      Site Expenses
                    </span>
                    <p className="font-bold text-destructive text-sm">
                      ₹{totalTodaySiteExpenses.toLocaleString()}
                    </p>
                    <span className="text-[9px] font-semibold text-muted-foreground block mt-0.5">
                      Food, Fuel & Misc
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                      Client Income
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-emerald-600 text-sm">
                        ₹{(todayLog.incomeFromClient || 0).toLocaleString()}
                      </p>
                      {todayLog.incomePaymentMethod && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          {todayLog.incomePaymentMethod}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Unnamed Labour Workforce Breakdown */}
                {(() => {
                  const effectiveCounts: Record<string, number> = {};
                  if (todayLog.workerCounts && Object.values(todayLog.workerCounts).some(v => (Number(v) || 0) > 0)) {
                    Object.entries(todayLog.workerCounts).forEach(([k, v]) => {
                      if (Number(v) > 0) effectiveCounts[k] = Number(v);
                    });
                  } else if (siteLabourAllocation?.counts) {
                    Object.entries(siteLabourAllocation.counts).forEach(([k, v]) => {
                      if (Number(v) > 0) effectiveCounts[k] = Number(v);
                    });
                  }

                  const halfCounts = siteLabourAllocation?.halfDayCounts || {};
                  const activeTrades = Array.from(new Set([
                    ...Object.entries(effectiveCounts).filter(([_, count]) => Number(count) > 0).map(([k]) => k),
                    ...Object.entries(halfCounts).filter(([_, count]) => Number(count) > 0).map(([k]) => k)
                  ]));

                  const totalFull = activeTrades.reduce((acc, t) => acc + (Number(effectiveCounts[t]) || 0), 0);
                  const totalHalf = activeTrades.reduce((acc, t) => acc + (Number(halfCounts[t]) || 0), 0);
                  const totalCrew = totalFull + totalHalf;

                  return (
                    <div className="p-3.5 rounded-xl bg-card/80 border border-border/50 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-primary" /> Unnamed Labour Allocation ({totalCrew} Total)
                        </span>
                        {totalCrew > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                            {activeTrades.length} Trade{activeTrades.length > 1 ? 's' : ''} Allocated from Attendance
                          </span>
                        )}
                      </div>

                      {activeTrades.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-0.5">
                          {activeTrades.map(trade => {
                            const meta = getLabourTypeMeta(trade);
                            const count = effectiveCounts[trade] || 0;
                            const half = halfCounts[trade] || 0;
                            return (
                              <div key={trade} className="p-2.5 rounded-lg bg-muted/40 border border-border/40 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground truncate">
                                    <span className="text-sm">{meta.icon}</span>
                                    <span className="capitalize">{meta.label}</span>
                                  </span>
                                  <span className="font-extrabold text-xs px-2 py-0.5 rounded-md bg-background border border-border/60 text-primary">
                                    {count} Full
                                  </span>
                                </div>
                                {half > 0 && (
                                  <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold text-right">
                                    + {half} Half Day
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic py-0.5">
                          No unnamed crew allocated for this site in Team Attendance.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Named Employees List */}

                {/* Work Description */}
                <div className="space-y-1.5 pt-1 border-t border-border/40">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Work Completed / Description
                  </span>
                  <div className="text-xs text-foreground bg-card/60 p-3.5 rounded-xl border border-border/40 whitespace-pre-line leading-relaxed font-sans">
                    {todayLog.notes || 'No work description notes'}
                  </div>
                </div>

                {/* 1. Team Daily Salary Breakdown (Clickable) */}
                {(allEmployeeSalaries.length > 0 || unnamedCrewSalary > 0) && (
                  <div className="space-y-2 pt-1 border-t border-border/40">
                    <div
                      className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setShowSalaryBreakdown(v => !v)}
                    >
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-blue-500" /> Team Daily Salary
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          ₹{totalTeamSalary.toLocaleString()}
                        </span>
                        <span className={`text-[10px] text-muted-foreground transition-transform ${showSalaryBreakdown ? 'rotate-180' : ''}`}>▼</span>
                      </div>
                    </div>
                    {showSalaryBreakdown && (
                      <div className="space-y-1.5 animate-slide-up">
                        {allEmployeeSalaries.map((emp) => (
                          <div key={emp.staffId} className={`flex justify-between items-center text-xs p-3 rounded-xl border ${
                            emp.role === 'supervisor'
                              ? 'bg-blue-500/[0.07] border-blue-500/25'
                              : 'bg-violet-500/[0.05] border-violet-500/25'
                          }`}>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-foreground">{emp.staffName}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  emp.role === 'supervisor'
                                    ? 'bg-blue-500/20 text-blue-800 dark:text-blue-200'
                                    : 'bg-violet-500/20 text-violet-800 dark:text-violet-200'
                                }`}>
                                  {emp.role === 'supervisor' ? '👷 Supervisor' : `🧑‍💼 ${emp.role.charAt(0).toUpperCase() + emp.role.slice(1)}`}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  emp.isHalfDay ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200' : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                                }`}>
                                  {emp.isHalfDay ? 'Half Day' : 'Full Day'}
                                  {emp.otHours > 0 ? ` + ${emp.otHours}h OT` : ''}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Daily rate: ₹{emp.baseSalary.toLocaleString()}
                                {emp.otPay > 0 ? ` · OT: ₹${emp.otPay.toLocaleString()}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`text-sm font-extrabold ${
                                emp.role === 'supervisor'
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-violet-600 dark:text-violet-400'
                              }`}>
                                ₹{emp.totalSalary.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                        {/* Unnamed crew line item */}
                        {unnamedCrewSalary > 0 && (() => {
                          const supervisor = staff?.role === 'supervisor' ? staff : staffList.find(s => s.id === selectedSite?.supervisorId);
                          const fullCount = Object.values(siteLabourAllocation?.counts || {}).reduce((s, v) => s + (Number(v) || 0), 0);
                          const halfCount = Object.values(siteLabourAllocation?.halfDayCounts || {}).reduce((s, v) => s + (Number(v) || 0), 0);
                          const totalCrew = fullCount + halfCount;
                          const crewRate = Number(supervisor?.underLabourSalary) || 0;
                          return (
                            <div className="flex justify-between items-center text-xs p-3 rounded-xl border bg-amber-500/[0.06] border-amber-500/25">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-foreground">Unnamed Crew</span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200">
                                    🧑‍🔧 {totalCrew} Worker{totalCrew !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  Rate: ₹{crewRate.toLocaleString()}/day
                                  {halfCount > 0 ? ` · ${halfCount} half-day` : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                                  ₹{unnamedCrewSalary.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                        <div className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-blue-500/[0.12] border border-blue-500/35 font-bold">
                          <span className="text-blue-800 dark:text-blue-200">Total Team Salary</span>
                          <span className="text-blue-700 dark:text-blue-300 text-sm">₹{totalTeamSalary.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Itemized Daily Site Expenses (Separated) */}
                <div className="space-y-2 pt-1 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Itemized Daily Site Expenses ({todaySiteExpenses.length})
                    </span>
                    <span className="text-xs font-bold text-destructive">
                      Total Expenses: ₹{totalTodaySiteExpenses.toLocaleString()}
                    </span>
                  </div>
                  {todaySiteExpenses.length > 0 ? (
                    <div className="space-y-1.5">
                      {todaySiteExpenses.map((exp, i) => (
                        <div key={i} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-card/50 border border-border/30">
                          <span className="text-foreground font-medium flex items-center gap-1.5">
                            {exp.itemName.includes('Supervisor Attendance Expense') && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                Team Attendance
                              </span>
                            )}
                            {exp.itemName}
                          </span>
                          <span className="font-bold text-destructive">₹{exp.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/40 text-center text-xs text-muted-foreground">
                      No additional site expenses logged (Food, fuel, local materials).
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground italic text-center pt-2 border-t border-border/30">
                  ✓ Today's work entry has been submitted for this site. Click <strong>Edit Entry</strong> above to update any information.
                </p>
              </div>
            </div>
          ) : (
            /* ── 2. Work Entry Form (New or Editing) ── */
            <>
              {/* Editing Banner */}
              {isEditing && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <PenLine className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-amber-900 dark:text-amber-200">
                      Editing Today's Entry for {selectedSite?.name || todayLog?.siteName}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelEdit}
                    className="h-7 text-xs font-semibold hover:bg-amber-500/20"
                  >
                    Cancel Edit
                  </Button>
                </div>
              )}

              {/* ── Active Construction Milestone Banner ── */}
              {siteId && !customSiteMode && siteStages.length > 0 && (
                <div className="animate-slide-up">
                  {allStagesCompleted ? (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-xs text-emerald-700 dark:text-emerald-400 font-semibold shadow-xs">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">All Project Milestones Completed! 🎉</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          All construction stages for this site have been verified and marked completed by Admin.
                        </p>
                      </div>
                    </div>
                  ) : currentActiveStage ? (
                    <div className="p-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/[0.08] via-card to-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                          L{currentActiveStage.levelNumber}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                              Active Construction Milestone • Level {currentActiveStage.levelNumber} of {siteStages.length}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentActiveStage.isApprovalPending
                                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 animate-pulse'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              }`}>
                              {currentActiveStage.isApprovalPending ? '⏳ Approval Pending' : '⚡ In Progress'}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-foreground truncate mt-0.5">
                            {currentActiveStage.stageName}
                          </h3>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            Work descriptions, materials, and expenses logged today will be tracked under this level.
                          </p>
                        </div>
                      </div>

                      {/* Milestone Completion Action */}
                      <div className="shrink-0 self-start sm:self-auto">
                        {currentActiveStage.isApprovalPending ? (
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-400 text-xs font-bold">
                            <Clock className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                            <span>Completion Pending Admin Review</span>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsCompletionModalOpen(true)}
                            className="h-9 rounded-xl text-xs font-bold gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 border-primary/30 shadow-xs transition-all"
                          >
                            <SendHorizonal className="w-3.5 h-3.5" /> Request Level {currentActiveStage.levelNumber} Completion
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* No stages warning when site selected but no stages defined */}
              {siteId && !customSiteMode && siteStages.length === 0 && paymentStageMaster.length === 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-700 dark:text-amber-400 animate-slide-up">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No work levels have been set up by Admin yet. Please contact Admin to define Payment Stages in Settings.</span>
                </div>
              )}

              {/* Work Description */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-3.5 h-3.5" /> Work Description *
                </Label>
                <Textarea
                  placeholder="Describe work completed today, milestones, issues encountered..."
                  value={workDesc}
                  onChange={e => setWorkDesc(e.target.value)}
                  rows={4}
                  className="rounded-xl text-sm"
                  required
                />
              </div>

              {/* Assigned Employees on Duty (Named Staff) */}
              <div className="space-y-2.5 p-3.5 rounded-2xl bg-card border border-border/60 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div>
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" /> Employees on Duty for this Site ({selectedWorkers.length + totalUnnamedWorkers} Total{totalUnnamedWorkers > 0 ? `: ${selectedWorkers.length} Named + ${totalUnnamedWorkers} Crew` : ''})
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Select registered staff and verify unnamed crew workforce on duty today.
                    </p>
                  </div>
                  {(selectedWorkers.length > 0 || totalUnnamedWorkers > 0) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {selectedWorkers.length + totalUnnamedWorkers} on Duty {totalUnnamedWorkers > 0 ? `(${selectedWorkers.length} Named, ${totalUnnamedWorkers} Crew)` : 'Selected'}
                    </span>
                  )}
                </div>

                {totalUnnamedWorkers > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                    <span className="flex items-center gap-1.5 font-medium text-[11px]">
                      <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <strong>{totalUnnamedWorkers} Unnamed Crew Members</strong> allocated from Team Attendance ({unnamedCrewBreakdown.map(i => `${i.totalCount} ${i.label}`).join(', ')})
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 shrink-0">
                      Auto-Included
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {staffList
                    .filter(s => s.role !== 'supervisor' && s.role !== 'admin' && s.id !== staff?.id)
                    .filter(emp => {
                      const empAtt = todayAttendances.find(a => a.staffId === emp.id);
                      const isTodayAllocatedHere = empAtt?.siteId === siteId;
                      const isTodayAllocatedElsewhere = empAtt?.siteId && empAtt.siteId !== siteId;
                      if (isTodayAllocatedElsewhere) return false;
                      const isSiteAssigned = selectedSite?.assignedStaffIds?.includes(emp.id);
                      const isMyTeam = emp.supervisorId === staff?.id;
                      return isTodayAllocatedHere || isSiteAssigned || isMyTeam;
                    })
                    .map(emp => {
                      const isChecked = selectedWorkers.includes(emp.id);
                      const empAtt = todayAttendances.find(a => a.staffId === emp.id);
                      const isTodayAllocatedHere = empAtt?.siteId === siteId;
                      const isSiteAssigned = selectedSite?.assignedStaffIds?.includes(emp.id);
                      const isMyCrew = emp.supervisorId === staff?.id;

                      return (
                        <label
                          key={emp.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all text-xs ${
                            isChecked
                              ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-2xs'
                              : 'border-border/50 bg-muted/20 hover:bg-muted/40 text-muted-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedWorkers(prev => [...prev, emp.id]);
                                } else {
                                  setSelectedWorkers(prev => prev.filter(id => id !== emp.id));
                                }
                              }}
                              className="rounded accent-primary w-4 h-4"
                            />
                            <div className="min-w-0 truncate">
                              <p className="text-xs font-semibold truncate leading-tight">{emp.name}</p>
                              <p className="text-[10px] text-muted-foreground capitalize leading-tight">
                                {emp.role} {emp.phone ? `• ${emp.phone}` : ''}
                              </p>
                            </div>
                          </div>
                          {isTodayAllocatedHere && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 shrink-0">
                              Allocated Today
                            </span>
                          )}
                          {!isTodayAllocatedHere && isSiteAssigned && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 shrink-0">
                              Site Staff
                            </span>
                          )}
                          {!isTodayAllocatedHere && isMyCrew && !isSiteAssigned && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25 shrink-0">
                              Your Crew
                            </span>
                          )}
                        </label>
                      );
                    })}
                </div>
                {staffList.filter(s => s.role !== 'supervisor' && s.role !== 'admin' && s.id !== staff?.id).length === 0 && (
                  <p className="text-xs text-muted-foreground italic py-1">
                    No workers or employees added under Staff Management yet.
                  </p>
                )}
              </div>

              {/* Right Column (now bottom): Crew, Materials, Expenses, Income & Submission */}
              <div className="space-y-4">
                {/* Crew Members Included (Unnamed Workforce strictly from Team Attendance Site Labour Allocation) */}
                <div className="space-y-3 p-3.5 rounded-2xl bg-card border border-border/60 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-border/40">
                    <div>
                      <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" /> Unnamed Crew / Labour Workforce
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {allocatedLabourTypes.length > 0
                          ? 'Showing crew allocated in Team Attendance Site Labour Allocation for this site.'
                          : 'No crew allocated to this site in Team Attendance Site Labour Allocation.'}
                      </p>
                    </div>
                    {(() => {
                      const totalAlloc = allocatedLabourTypes.reduce((acc, t) => {
                        return acc + Number(siteLabourAllocation?.counts?.[t] || 0) + Number(siteLabourAllocation?.halfDayCounts?.[t] || 0);
                      }, 0);
                      return totalAlloc > 0 ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                          Total {totalAlloc} Crew Allocated from Attendance
                        </span>
                      ) : null;
                    })()}
                  </div>

                  {/* Attendance Status Alert if not marked yet */}
                  {!isSelfPresent && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Supervisor attendance for today ({todayStr}) is not marked yet.</span>
                      </div>
                      {onNavigateToAttendance && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={onNavigateToAttendance}
                          className="h-7 text-[11px] font-bold rounded-lg bg-amber-500/20 border-amber-500/40 text-amber-900 dark:text-amber-200 shrink-0 hover:bg-amber-500/30"
                        >
                          Mark Attendance First →
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Strictly only display trades allocated in Team Attendance */}
                  {allocatedLabourTypes.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {allocatedLabourTypes.map(type => {
                        const meta = getLabourTypeMeta(type);
                        const currentVal = Number(workerCounts[type] ?? siteLabourAllocation?.counts?.[type] ?? 0);
                        const halfVal = Number(siteLabourAllocation?.halfDayCounts?.[type] || 0);

                        return (
                          <div key={type} className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <Label className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                                <span className="text-base">{meta.icon}</span>
                                <span className="capitalize truncate">{meta.label}</span>
                              </Label>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                Allocated
                              </span>
                            </div>
                            <div className="pt-1 flex items-center justify-between">
                              <span className="text-xs font-extrabold px-3 py-1.5 rounded-lg bg-card border border-border/60 text-primary shadow-2xs">
                                {currentVal} Full Day
                              </span>
                              {halfVal > 0 && (
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                                  + {halfVal} Half Day
                                </span>
                              )}
                            </div>
                            {halfVal > 0 && (
                              <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold pt-0.5">
                                + {halfVal} Half Day allocated
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-border/60 text-center space-y-2 bg-muted/10">
                      <p className="text-xs text-muted-foreground">
                        No unnamed labour was allocated to this site in <strong>Team Attendance → Site Labour Allocation</strong>.
                      </p>
                      {onNavigateToAttendance && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={onNavigateToAttendance}
                          className="h-8 text-xs font-bold gap-1.5 rounded-xl bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                        >
                          <Users className="w-3.5 h-3.5" /> Allocate Labour in Team Attendance →
                        </Button>
                      )}
                    </div>
                  )}

                  {(() => {
                    const totalAlloc = Object.values(siteLabourAllocation?.counts || {}).reduce((a, b) => a + (Number(b) || 0), 0) +
                      Object.values(siteLabourAllocation?.halfDayCounts || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                    return totalAlloc > 0 ? (
                      <p className="text-[11px] text-primary font-medium pt-1">
                        ✓ {totalAlloc} crew member{totalAlloc > 1 ? 's' : ''} allocated from Team Attendance for this site
                      </p>
                    ) : null;
                  })()}
                </div>

                <div>
                  <div className="space-y-2">
                    {onNavigateToMaterialRequest && (
                      <div className="pt-2 border-t border-border/40">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onNavigateToMaterialRequest(siteId)}
                          className="w-full h-10 rounded-xl text-xs font-bold gap-2 bg-primary/10 text-primary hover:bg-primary/20 border-primary/30 shadow-xs transition-all"
                        >
                          <Package className="w-4 h-4 text-primary shrink-0" />
                          <span>Need Materials from Store/Supplier? Go to Material Request Page →</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 1. Team Daily Salary */}
                {(allEmployeeSalaries.length > 0 || unnamedCrewBreakdown.length > 0) && (
                  <div className="space-y-1.5">
                    <div
                      className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setShowSalaryBreakdown(v => !v)}
                    >
                      <Label className="text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer">
                        <UserCheck className="w-3.5 h-3.5 text-blue-500" /> Team Daily Salary ({totalTeamWorkerCount} Worker{totalTeamWorkerCount !== 1 ? 's' : ''}{totalUnnamedWorkers > 0 ? `: ${allEmployeeSalaries.length} Named, ${totalUnnamedWorkers} Crew` : ''})
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          ₹{totalTeamSalary.toLocaleString()}
                        </span>
                        <span className={`text-[10px] text-muted-foreground transition-transform ${showSalaryBreakdown ? 'rotate-180' : ''}`}>▼</span>
                      </div>
                    </div>
                    {showSalaryBreakdown && (
                      <div className="space-y-1.5 animate-slide-up">
                        {allEmployeeSalaries.map((emp) => (
                          <div key={emp.staffId} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                            emp.role === 'supervisor'
                              ? 'bg-blue-500/[0.07] border-blue-500/30'
                              : 'bg-violet-500/[0.05] border-violet-500/25'
                          }`}>
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                emp.role === 'supervisor'
                                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                  : 'bg-violet-500/20 text-violet-600 dark:text-violet-400'
                              }`}>
                                <UserCheck className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-foreground">{emp.staffName}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    emp.role === 'supervisor'
                                      ? 'bg-blue-500/20 text-blue-800 dark:text-blue-200'
                                      : 'bg-violet-500/20 text-violet-800 dark:text-violet-200'
                                  }`}>
                                    {emp.role === 'supervisor' ? '👷 Supervisor' : `🧑‍💼 ${emp.role.charAt(0).toUpperCase() + emp.role.slice(1)}`}
                                  </span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    emp.isHalfDay ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200' : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                                  }`}>
                                    {emp.isHalfDay ? 'Half Day' : 'Full Day'}
                                    {emp.otHours > 0 ? ` + ${emp.otHours}h OT` : ''}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Daily rate: ₹{emp.baseSalary.toLocaleString()}
                                  {emp.otPay > 0 ? ` · OT: ₹${emp.otPay.toLocaleString()}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-sm font-extrabold ${
                                emp.role === 'supervisor'
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-violet-600 dark:text-violet-400'
                              }`}>
                                ₹{emp.totalSalary.toLocaleString()}
                              </span>
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                                ✓ Added to Level Cost
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* Unnamed Crew Members from Labour Allocation */}
                        {unnamedCrewBreakdown.map((item) => (
                          <div key={item.trade} className="p-3 rounded-xl border flex items-center justify-between text-xs bg-amber-500/[0.06] border-amber-500/25">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/20 text-base">
                                {item.icon}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-foreground">{item.label} ({item.totalCount} Crew)</span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200">
                                    👷 Unnamed Crew
                                  </span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-200">
                                    {item.fullCount > 0 ? `${item.fullCount} Full Day` : ''}{item.halfCount > 0 ? ` · ${item.halfCount} Half Day` : ''}
                                    {item.otHours > 0 ? ` + ${item.otHours}h OT` : ''}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Daily rate: ₹{item.rate.toLocaleString()} / worker
                                  {item.otPay > 0 ? ` · Total OT: ₹${item.otPay.toLocaleString()}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400">
                                ₹{item.totalPay.toLocaleString()}
                              </span>
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                                ✓ Added to Level Cost
                              </span>
                            </div>
                          </div>
                        ))}

                        <div className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-blue-500/[0.12] border border-blue-500/35 font-bold">
                          <span className="text-blue-800 dark:text-blue-200">
                            Total Team Salary ({totalTeamWorkerCount} Workers: {allEmployeeSalaries.length} Named, {totalUnnamedWorkers} Unnamed)
                          </span>
                          <span className="text-blue-700 dark:text-blue-300 text-sm">₹{totalTeamSalary.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Site Daily Expenses */}
                <div className="space-y-2 pt-1 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5 text-amber-500" /> Site Daily Expenses (Food, Petrol, Materials)
                    </Label>
                    <span className="text-xs font-bold text-destructive">
                      Total Expenses: ₹{expenses.reduce((s, e) => s + (e.amount || 0), 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={expenseMode}
                        onChange={e => setExpenseMode(e.target.value as any)}
                        className="h-10 rounded-xl border border-input bg-card px-3 text-xs font-semibold"
                      >
                        <option value="food">Site Food & Tea for Crew</option>
                        <option value="bike_petrol">Bike Petrol / Fuel</option>
                        <option value="auto">Auto / Cab Fare</option>
                        <option value="bus">Bus / Train Fare</option>
                        <option value="materials">Local Materials / Hardware</option>
                        <option value="tools">Tool Hire / Purchase</option>
                        <option value="other">Other Site Expense</option>
                      </select>
                      <Input
                        placeholder={expenseMode === 'other' ? 'Expense description *' : 'Detail/Note (e.g. 5 teas, 2 brushes)'}
                        value={expenseMode === 'other' ? expenseCustom : expenseNote}
                        onChange={e => expenseMode === 'other' ? setExpenseCustom(e.target.value) : setExpenseNote(e.target.value)}
                        className="h-10 rounded-xl text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Amount (₹) *"
                        value={expenseAmount}
                        onChange={e => setExpenseAmount(e.target.value)}
                        className="h-10 rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addExpense}
                      className="w-full h-9 rounded-xl text-xs gap-1 font-semibold bg-muted/30 hover:bg-muted"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Expense Item
                    </Button>

                    {expenses.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {expenses.map((exp, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-muted/40 p-2.5 rounded-xl border border-border/40 text-xs">
                            <span className="text-foreground font-medium">{exp.itemName}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">₹{exp.amount.toLocaleString()}</span>
                              <button type="button" onClick={() => removeExpense(idx)} className="text-destructive hover:opacity-70 p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Client Income Received */}
                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5 text-emerald-600" /> Income Collected from Client Today (if any)
                    </Label>
                    <span className="text-[10px] text-muted-foreground">Select payment mode if received</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                        Amount (₹)
                      </Label>
                      <Input
                        type="number"
                        placeholder="₹ 0"
                        value={income}
                        onChange={e => setIncome(e.target.value)}
                        className="h-10 rounded-xl text-xs font-bold bg-card"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                        Payment Method
                      </Label>
                      <Select
                        value={incomePaymentMethod}
                        onValueChange={(val: any) => setIncomePaymentMethod(val)}
                      >
                        <SelectTrigger className="h-10 rounded-xl text-xs bg-card border-border/60">
                          <SelectValue placeholder="Payment Mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">💵 Cash</SelectItem>
                          <SelectItem value="UPI">📱 UPI / GPay / PhonePe</SelectItem>
                          <SelectItem value="Bank Transfer">🏦 Bank Transfer (NEFT/IMPS)</SelectItem>
                          <SelectItem value="Cheque">📝 Cheque</SelectItem>
                          <SelectItem value="Card">💳 Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl font-bold text-white text-sm shadow-md mt-2"
                  style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                >
                  {editingLogId ? 'Update Daily Work Entry' : 'Submit Daily Work Entry'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </form>

      {/* Level Completion Request Modal */}
      <Dialog open={isCompletionModalOpen} onOpenChange={setIsCompletionModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold font-heading">
              Request Completion Approval for Level {currentActiveStage?.levelNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {currentActiveStage?.stageName} • {selectedSite?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Milestone Summary Stats */}
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/50 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Days Logged on Level</span>
                <p className="font-bold text-foreground text-sm">{activeStageStats.daysWorked} Days</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Expenses Logged</span>
                <p className="font-bold text-foreground text-sm">₹{activeStageStats.totalExpenses.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Supervisor Inspection & Completion Note *
              </Label>
              <Textarea
                placeholder="e.g. All foundation columns cured for 14 days, structural checks completed, ready for backfilling and ground floor slab work..."
                value={completionNote}
                onChange={e => setCompletionNote(e.target.value)}
                rows={3}
                className="text-xs rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">
                Admin will review your work history and approve this milestone. Once approved, Level {Number(currentActiveStage?.levelNumber || 0) + 1} will unlock automatically.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCompletionModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRequestCompletion}
              className="rounded-xl text-xs font-bold gap-1.5 bg-primary text-white"
            >
              <SendHorizonal className="w-3.5 h-3.5" /> Submit to Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default WorkEntryTab;
