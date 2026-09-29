import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import {
  CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, Plus,
  IndianRupee, XCircle, SendHorizonal, User, UserCircle, Layers, TrendingUp,
  TrendingDown, Package, Users, ShieldCheck, ArrowRight, Lock,
  AlertTriangle, DollarSign, Receipt
} from 'lucide-react';
import {
  Site, SitePaymentStage, SitePayment, StageCompletionRequest,
  DailyLog, MaterialRequest, MaterialRental, Staff,
  ManualExpense, Attendance
} from '@/types';
import { toast } from 'sonner';

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
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  // Form states for currently expanded stage setup
  const [expectedAmount, setExpectedAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
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
  };

  const handleAddPayment = (stageName: string) => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid payment amount');

    const data = getStageData(stageName);
    const newPayment: SitePayment = {
      id: `pay_${Date.now()}`,
      amount: amt,
      date: payDate,
      note: payNote
    };

    saveStageData(stageName, {
      paidAmount: data.paidAmount + amt,
      payments: [...(data.payments || []), newPayment]
    });
    toast.success('Payment recorded successfully');
    setPayAmount('');
    setPayNote('');
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
  const getStageFinancials = (stageName: string, stageData: SitePaymentStage) => {
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

    const supervisorDailyExpenses = dailyMiscExpenses + dailyTransportExpenses;

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

    // 2. Material requests linked to this stage
    const stageReqs = materialRequests.filter(
      r => r.siteId === site.id && isStageMatch(r.workLevelStage) && (r.status === 'completed' || r.status === 'assigned')
    );
    const stageReqCost = stageReqs.reduce(
      (sum, r) => sum + (r.materialCost || r.supplierPrice || 0) + (r.driverWage || 0) + (r.petrolCharge || 0),
      0
    );

    // 3. Admin manual expenses linked to this stage
    const stageManualExpenses = manualExpenses.filter(
      e => e.siteId === site.id && isStageMatch(e.workLevelStage)
    );
    const manualExpenseCost = stageManualExpenses.reduce(
      (sum, e) => sum + (e.amount || 0),
      0
    );

    // 4. Labour salary costs estimation from supervisor crew worker counts
    let labourSalaryCost = 0;
    const supervisorWorkLogs = stageLogs.map(log => {
      const counts = log.workerCounts || { painter: 0, plumber: 0, labour: 0 };
      const supervisor = staffList.find(s => s.id === log.staffId);
      const dailySalary = supervisor?.underLabourSalary || 800; // default ₹800/day if not set
      const totalWorkers = (counts.painter || 0) + (counts.plumber || 0) + (counts.labour || 0);
      const dayLabourCost = totalWorkers * dailySalary;
      labourSalaryCost += dayLabourCost;

      return {
        id: log.id,
        date: log.date,
        staffName: log.staffName || 'Supervisor',
        counts,
        totalWorkers,
        dayLabourCost,
        dailySalary,
        notes: log.notes || '',
        miscExpenses: (log.expenses || []).reduce((s, e) => s + (e.amount || 0), 0) + (log.transportCost || 0),
      };
    });

    const totalStageExpenses = supervisorDailyExpenses + stageReqCost + manualExpenseCost + labourSalaryCost;
    const expected = stageData.expectedAmount || 0;
    const paid = stageData.paidAmount || 0;
    const balance = Math.max(0, expected - paid);

    // Net profit / margin
    const netMargin = expected > 0 ? expected - totalStageExpenses : paid - totalStageExpenses;
    const marginPercent = expected > 0 ? Math.round((netMargin / expected) * 100) : 0;
    const isOverBudget = expected > 0 && totalStageExpenses > expected;

    // Workforce stats
    const totalDaysWorked = new Set(stageLogs.map(l => l.date)).size;
    const totalPainterDays = stageLogs.reduce((sum, l) => sum + (l.workerCounts?.painter || 0), 0);
    const totalPlumberDays = stageLogs.reduce((sum, l) => sum + (l.workerCounts?.plumber || 0), 0);
    const totalLabourDays = stageLogs.reduce((sum, l) => sum + (l.workerCounts?.labour || 0), 0);
    const totalCrewManDays = totalPainterDays + totalPlumberDays + totalLabourDays;

    return {
      stageLogs,
      stageReqs,
      stageManualExpenses,
      supervisorDailyExpenses,
      supervisorExpenseItems,
      supervisorWorkLogs,
      dailyMiscExpenses,
      dailyTransportExpenses,
      stageReqCost,
      manualExpenseCost,
      labourSalaryCost,
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

    masterStages.forEach((stageName, idx) => {
      const data = getStageData(stageName);
      const fin = getStageFinancials(stageName, data);
      totalExpected += fin.expected;
      totalPaid += fin.paid;
      totalExpenses += fin.totalStageExpenses;

      if (data.completionStatus === 'completed') {
        completedCount++;
      } else if (!activeStageName) {
        activeStageName = `Level ${idx + 1}: ${stageName}`;
      }
    });

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

          // Payment Status
          let paymentStatusBadge: 'paid' | 'pending' | 'overdue' = 'pending';
          if (data.expectedAmount > 0 && data.paidAmount >= data.expectedAmount) {
            paymentStatusBadge = 'paid';
          } else if (data.dueDate && new Date(data.dueDate) < new Date() && fin.balance > 0) {
            paymentStatusBadge = 'overdue';
          }

          return (
            <div
              key={stageName}
              className={`rounded-2xl border transition-all ${
                hasPendingApproval
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
                    completionStatus === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                      : hasPendingApproval
                        ? 'bg-blue-500 text-white animate-pulse'
                        : isLocked
                          ? 'bg-muted text-muted-foreground border border-border/50'
                          : 'bg-primary/15 text-primary border border-primary/30'
                  }`}>
                    {completionStatus === 'completed' ? (
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
                    </div>

                    <div className="flex items-center gap-2.5 sm:gap-4 text-[11px] text-muted-foreground mt-1 flex-wrap font-medium">
                      <span>Milestone: <strong className="text-foreground">₹{data.expectedAmount.toLocaleString()}</strong></span>
                      <span>Paid: <strong className="text-emerald-600">₹{data.paidAmount.toLocaleString()}</strong></span>
                      <span>Level Expenses: <strong className={fin.isOverBudget ? 'text-destructive' : 'text-foreground'}>₹{fin.totalStageExpenses.toLocaleString()}</strong></span>
                      {fin.totalDaysWorked > 0 && (
                        <span className="hidden sm:inline text-muted-foreground">• {fin.totalDaysWorked} Days Logged</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Badges & Expand Icon */}
                <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
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

                  <div className="w-6 h-6 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* ── Expanded Detail View ── */}
              {isExpanded && (
                <div className="p-4 sm:p-5 border-t border-border/40 space-y-5 bg-card/50 rounded-b-2xl animate-slide-up">
                  {/* ── 1. Pending Stage Completion Request Action ── */}
                  {pendingRequests.length > 0 && (
                    <div className="space-y-2">
                      {pendingRequests.map(req => (
                        <div key={req.id} className="p-4 rounded-2xl border border-blue-500/40 bg-blue-500/10 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0">
                                <SendHorizonal className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-foreground">
                                  Stage Completion Approval Requested
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  Supervisor <strong className="text-blue-600 dark:text-blue-400 font-semibold">{req.requestedByStaffName}</strong> has finished work on Level {idx + 1} ({stageName})
                                  {req.requestedAt && ` on ${format(new Date(req.requestedAt), 'dd MMM yyyy, hh:mm a')}`}.
                                </p>
                              </div>
                            </div>
                          </div>

                          {req.notes && (
                            <div className="p-2.5 rounded-xl bg-background/80 border border-border/50 text-xs text-foreground italic">
                              "{req.notes}"
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() => handleApproveRequest(req.id, stageName)}
                              className="h-9 px-4 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Approve & Complete Level {idx + 1}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectRequest(req.id, stageName)}
                              className="h-9 px-4 text-xs font-bold gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                            >
                              <XCircle className="w-4 h-4" /> Reject / Incomplete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Fallback approval banner if stage status is completion_requested but no pending request record */}
                  {completionStatus === 'completion_requested' && pendingRequests.length === 0 && (
                    <div className="p-4 rounded-2xl border border-blue-500/40 bg-blue-500/10 space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0">
                          <SendHorizonal className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            Stage Completion Approval Requested
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Supervisor has requested completion review for Level {idx + 1} ({stageName}).
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleApproveRequest('', stageName)}
                          className="h-9 px-4 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Approve & Complete Level {idx + 1}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRequest('', stageName)}
                          className="h-9 px-4 text-xs font-bold gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <XCircle className="w-4 h-4" /> Reject / Incomplete
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── 2. Stage Financials & Profitability Breakdown ── */}
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-primary" /> Level Financials & Margin Analysis
                      </Label>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        fin.isOverBudget
                          ? 'bg-destructive/15 text-destructive border-destructive/30'
                          : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                      }`}>
                        {fin.isOverBudget ? '⚠️ Budget Exceeded' : '✓ Expenses Under Control'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-2.5 bg-card rounded-xl border border-border/50">
                        <span className="text-[10px] text-muted-foreground block">Client Milestone Target</span>
                        <span className="font-bold text-foreground text-sm">₹{fin.expected.toLocaleString()}</span>
                      </div>
                      <div className="p-2.5 bg-card rounded-xl border border-border/50">
                        <span className="text-[10px] text-muted-foreground block">Client Paid to Date</span>
                        <span className="font-bold text-emerald-600 text-sm">₹{fin.paid.toLocaleString()}</span>
                      </div>
                      <div className="p-2.5 bg-card rounded-xl border border-border/50">
                        <span className="text-[10px] text-muted-foreground block">Total Expenses Incurred</span>
                        <span className={`font-bold text-sm ${fin.isOverBudget ? 'text-destructive' : 'text-foreground'}`}>
                          ₹{fin.totalStageExpenses.toLocaleString()}
                        </span>
                      </div>
                      <div className="p-2.5 bg-card rounded-xl border border-border/50">
                        <span className="text-[10px] text-muted-foreground block">Estimated Stage Margin</span>
                        <span className={`font-bold text-sm ${fin.netMargin >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                          {fin.netMargin >= 0 ? '+' : ''}₹{fin.netMargin.toLocaleString()} ({fin.marginPercent}%)
                        </span>
                      </div>
                    </div>

                    {/* Cost Breakdown Details */}
                    <div className="p-4 bg-card rounded-2xl border border-border/50 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                          Expense Breakdown for Level {idx + 1}
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {fin.stageLogs.length} Supervisor Log{fin.stageLogs.length === 1 ? '' : 's'} Linked
                        </span>
                      </div>

                      {/* Focused Category Summary (Strictly Supervisor & Level Costs) */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between py-1 border-b border-border/20">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            • Supervisor Daily Expenses (Food, Travel, Petrol, Local Purchases)
                          </span>
                          <span className="font-semibold text-foreground">₹{fin.supervisorDailyExpenses.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/20">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            • Labour Salary Cost (from Supervisor Worker Counts: {fin.totalCrewManDays} Man-Days)
                          </span>
                          <span className="font-semibold text-foreground">₹{fin.labourSalaryCost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/20">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            • Dispatched Material Requisitions (Requested by Supervisor)
                          </span>
                          <span className="font-semibold text-foreground">₹{fin.stageReqCost.toLocaleString()}</span>
                        </div>
                        {fin.manualExpenseCost > 0 && (
                          <div className="flex justify-between py-1 border-b border-border/20">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              • Admin Manual Expenses
                            </span>
                            <span className="font-semibold text-foreground">₹{fin.manualExpenseCost.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-border/40 font-bold text-sm">
                          <span>TOTAL LEVEL EXPENSES</span>
                          <span className={fin.isOverBudget ? 'text-destructive font-black' : 'text-foreground'}>
                            ₹{fin.totalStageExpenses.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* ── Itemized Supervisor Expense Details ── */}
                      {fin.supervisorExpenseItems.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              📋 Supervisor Daily Expense Items ({fin.supervisorExpenseItems.length})
                            </span>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md">
                              Total: ₹{fin.supervisorDailyExpenses.toLocaleString()}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {fin.supervisorExpenseItems.map((item, itemIdx) => (
                              <div key={itemIdx} className="p-2.5 rounded-xl bg-muted/20 border border-border/40 flex items-center justify-between text-xs">
                                <div className="space-y-0.5 min-w-0 pr-2">
                                  <span className="font-semibold text-foreground block truncate">{item.itemName}</span>
                                  <span className="text-[10px] text-muted-foreground block">
                                    {format(new Date(item.date), 'dd MMM yyyy')} • by {item.staffName}
                                  </span>
                                </div>
                                <span className="font-bold text-foreground shrink-0">₹{item.amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Itemized Supervisor Labour & Daily Work Logs ── */}
                      {fin.supervisorWorkLogs.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              👷 Supervisor Daily Work & Crew Logs ({fin.supervisorWorkLogs.length} Days)
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                              Labour Wages: ₹{fin.labourSalaryCost.toLocaleString()}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {fin.supervisorWorkLogs.map((log) => (
                              <div key={log.id} className="p-2.5 rounded-xl bg-muted/20 border border-border/40 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between flex-wrap gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground">{format(new Date(log.date), 'dd MMM yyyy')}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                      by {log.staffName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="font-semibold text-muted-foreground">
                                      {[
                                        log.counts.painter ? `${log.counts.painter} Painter${log.counts.painter > 1 ? 's' : ''}` : '',
                                        log.counts.plumber ? `${log.counts.plumber} Plumber${log.counts.plumber > 1 ? 's' : ''}` : '',
                                        log.counts.labour ? `${log.counts.labour} Labourer${log.counts.labour > 1 ? 's' : ''}` : ''
                                      ].filter(Boolean).join(', ') || '0 Crew'} ({log.totalWorkers} workers)
                                    </span>
                                    <span className="font-bold text-foreground">• ₹{log.dayLabourCost.toLocaleString()}</span>
                                  </div>
                                </div>
                                {log.notes && (
                                  <p className="text-[11px] text-muted-foreground italic border-l-2 border-primary/40 pl-2">
                                    "{log.notes}"
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Itemized Material Requisitions ── */}
                      {fin.stageReqs.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              📦 Material Requisitions for Level {idx + 1} ({fin.stageReqs.length})
                            </span>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-md">
                              Total: ₹{fin.stageReqCost.toLocaleString()}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {fin.stageReqs.map((req) => (
                              <div key={req.id} className="p-2.5 rounded-xl bg-muted/20 border border-border/40 flex items-center justify-between text-xs">
                                <div className="space-y-0.5 min-w-0 pr-2">
                                  <span className="font-semibold text-foreground block truncate">
                                    {req.items.map(it => `${it.name} (${it.quantity} ${it.unit || 'Units'})`).join(', ')}
                                  </span>
                                  <div className="text-[10px] text-muted-foreground">
                                    {format(new Date(req.date), 'dd MMM yyyy')} • Requested by {req.requestedByStaffName} • <span className="capitalize font-semibold text-blue-600">{req.status}</span>
                                  </div>
                                </div>
                                <span className="font-bold text-foreground shrink-0">
                                  ₹{((req.materialCost || req.supplierPrice || 0) + (req.driverWage || 0) + (req.petrolCharge || 0)).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty state when supervisor hasn't logged anything yet */}
                      {fin.stageLogs.length === 0 && fin.stageReqs.length === 0 && (
                        <div className="mt-2 p-3 rounded-xl border border-dashed border-border/60 bg-muted/10 text-center text-xs text-muted-foreground">
                          ℹ️ No supervisor entries or expenses recorded for Level {idx + 1} yet. Once the supervisor logs daily work, incidental expenses (food, travel, local tools), or crew worker counts, they will be itemized here.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── 3. Stage Setup & Admin Controls ── */}
                  <div className="p-4 bg-muted/20 rounded-2xl border border-border/50 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Stage Setup & Admin Status
                      </Label>
                      {/* Manual Admin Status Changer */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground font-semibold">Stage Status:</span>
                        <select
                          value={completionStatus}
                          onChange={e => saveStageData(stageName, { completionStatus: e.target.value as any })}
                          className="h-7 text-xs rounded-lg border border-input bg-card px-2 font-bold text-foreground"
                        >
                          <option value="pending">Pending / Not Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completion_requested">Approval Requested</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Expected Milestone Amount (₹)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 250000"
                          value={expectedAmount}
                          onChange={e => setExpectedAmount(e.target.value)}
                          className="h-9 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Due Date (Optional)</Label>
                        <Input
                          type="date"
                          value={dueDate}
                          onChange={e => setDueDate(e.target.value)}
                          className="h-9 text-xs mt-1"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Work Description</Label>
                        <Textarea
                          placeholder="Scope of work for this level..."
                          value={workDescription}
                          onChange={e => setWorkDescription(e.target.value)}
                          className="min-h-[60px] text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Milestone Notes / Checklist</Label>
                        <Textarea
                          placeholder="Inspection requirements or handover checklist..."
                          value={stepsTaken}
                          onChange={e => setStepsTaken(e.target.value)}
                          className="min-h-[60px] text-xs mt-1"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            placeholder="e.g. Extra steel reinforcement or unexpected earthwork..."
                            value={highExpenseReason}
                            onChange={e => setHighExpenseReason(e.target.value)}
                            className="h-9 text-xs mt-1 border-destructive/50"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-border/40">
                      <Button size="sm" onClick={() => handleSaveSetup(stageName)} className="h-8 px-5 text-xs font-bold">
                        Save Setup
                      </Button>
                    </div>
                  </div>

                  {/* ── 4. Supervisor Work Activity & Logs for this Level (Requirement 2) ── */}
                  <div className="space-y-3 p-4 bg-muted/20 rounded-2xl border border-border/50">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        Supervisor Daily Work Activity for Level {idx + 1} ({fin.stageLogs.length} Days Logged)
                      </Label>
                      {fin.totalCrewManDays > 0 && (
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          Total Crew: {fin.totalCrewManDays} Man-Days ({fin.totalPainterDays}P, {fin.totalPlumberDays}Pl, {fin.totalLabourDays}L)
                        </span>
                      )}
                    </div>

                    {fin.stageLogs.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground bg-card rounded-xl border border-dashed border-border/60">
                        No supervisor work logs recorded for Level {idx + 1} yet.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {fin.stageLogs.map((log) => {
                          const logDayExpenses = (log.expenses || []).reduce((s, e) => s + (e.amount || 0), 0) + (log.transportCost || 0);
                          return (
                            <div key={log.id} className="p-3 rounded-xl bg-card border border-border/50 text-xs space-y-1.5 shadow-2xs">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                    <User className="w-3 h-3" />
                                  </div>
                                  <span className="font-bold text-foreground">{log.staffName}</span>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-muted-foreground font-mono font-semibold">{log.date}</span>
                                </div>
                                {logDayExpenses > 0 && (
                                  <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                                    Day Expense: ₹{logDayExpenses.toLocaleString()}
                                  </span>
                                )}
                              </div>

                              {/* Work description */}
                              <p className="text-muted-foreground whitespace-pre-line pl-7">
                                {log.notes || 'No work description notes'}
                              </p>

                              {/* Crew counts */}
                              {log.workerCounts && (log.workerCounts.painter > 0 || log.workerCounts.plumber > 0 || log.workerCounts.labour > 0) && (
                                <div className="flex gap-1.5 pl-7 flex-wrap pt-0.5">
                                  {log.workerCounts.painter > 0 && <span className="text-[10px] bg-muted px-2 py-0.5 rounded-md text-muted-foreground">{log.workerCounts.painter} Painters</span>}
                                  {log.workerCounts.plumber > 0 && <span className="text-[10px] bg-muted px-2 py-0.5 rounded-md text-muted-foreground">{log.workerCounts.plumber} Plumbers</span>}
                                  {log.workerCounts.labour > 0 && <span className="text-[10px] bg-muted px-2 py-0.5 rounded-md text-muted-foreground">{log.workerCounts.labour} Labourers</span>}
                                </div>
                              )}

                              {/* Materials Used in this log */}
                              {log.materials && log.materials.length > 0 && (
                                <div className="pl-7 text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Package className="w-3 h-3 text-primary shrink-0" />
                                  <span>Materials: {log.materials.map(m => `${m.name} × ${m.quantity}`).join(', ')}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── 5. Materials & Requisitions for this Level ── */}
                  {fin.stageReqs.length > 0 && (
                    <div className="space-y-2 p-4 bg-muted/20 rounded-2xl border border-border/50">
                      <Label className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-primary" /> Material Requisitions for Level {idx + 1} ({fin.stageReqs.length})
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {fin.stageReqs.map(req => (
                          <div key={req.id} className="p-2.5 rounded-xl bg-card border border-border/50 text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-foreground">
                                {req.items.map(i => `${i.name} (${i.quantity} ${i.unit || ''})`).join(', ')}
                              </span>
                              <span className="text-[10px] font-bold text-primary">
                                ₹{(req.materialCost || req.supplierPrice || 0).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex justify-between">
                              <span>Req by {req.requestedByStaffName} • {req.date}</span>
                              <span className="capitalize">{req.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 5b. Admin Manual Expenses for this Level ── */}
                  {fin.stageManualExpenses.length > 0 && (
                    <div className="space-y-2 p-4 bg-muted/20 rounded-2xl border border-border/50">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-amber-500" /> Admin Expenses Tagged to Level {idx + 1} ({fin.stageManualExpenses.length})
                        </Label>
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          Total: ₹{fin.manualExpenseCost.toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {fin.stageManualExpenses.map(exp => (
                          <div key={exp.id} className="p-2.5 rounded-xl bg-card border border-border/50 text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-foreground truncate">{exp.description || exp.category}</span>
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">₹{exp.amount.toLocaleString()}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex justify-between">
                              <span className="capitalize">{exp.category}</span>
                              <span>{exp.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 5c. Labour & Workforce Cost Analysis for this Level ── */}
                  {fin.totalCrewManDays > 0 && (
                    <div className="space-y-2 p-4 bg-muted/20 rounded-2xl border border-border/50">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-blue-500" /> Workforce & Labour Cost Analysis
                        </Label>
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          Estimated Labour Cost: ₹{fin.labourSalaryCost.toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 rounded-xl bg-card border border-border/50 text-center">
                          <div className="text-[10px] text-muted-foreground uppercase font-bold">Painters</div>
                          <div className="text-sm font-bold text-foreground mt-0.5">{fin.totalPainterDays} <span className="text-[10px] font-normal text-muted-foreground">man-days</span></div>
                        </div>
                        <div className="p-2 rounded-xl bg-card border border-border/50 text-center">
                          <div className="text-[10px] text-muted-foreground uppercase font-bold">Plumbers</div>
                          <div className="text-sm font-bold text-foreground mt-0.5">{fin.totalPlumberDays} <span className="text-[10px] font-normal text-muted-foreground">man-days</span></div>
                        </div>
                        <div className="p-2 rounded-xl bg-card border border-border/50 text-center">
                          <div className="text-[10px] text-muted-foreground uppercase font-bold">Labourers</div>
                          <div className="text-sm font-bold text-foreground mt-0.5">{fin.totalLabourDays} <span className="text-[10px] font-normal text-muted-foreground">man-days</span></div>
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Total Workforce: <strong className="text-foreground">{fin.totalCrewManDays} man-days</strong> across <strong className="text-foreground">{fin.totalDaysWorked} working days</strong>. Calculated based on supervisor daily logs and daily labour wage rates.
                      </div>
                    </div>
                  )}

                  {/* ── 6. Client Payments Received for this Milestone ── */}
                  <div className="space-y-3 p-4 bg-muted/20 rounded-2xl border border-border/50">
                    <Label className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5 text-emerald-600" /> Client Payments Received for this Milestone
                    </Label>

                    {data.payments && data.payments.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {data.payments.map(p => (
                          <div key={p.id} className="flex justify-between items-center p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs">
                            <div>
                              <div className="font-bold text-emerald-700 dark:text-emerald-400">₹{p.amount.toLocaleString()}</div>
                              <div className="text-[10px] text-muted-foreground">{p.date} • {p.note || 'No reference note'}</div>
                            </div>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No payments recorded from client for this milestone yet.</p>
                    )}

                    {/* Record New Payment Form */}
                    {fin.balance > 0 && (
                      <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-2.5">
                        <Label className="text-[10px] uppercase font-bold text-primary">Record Payment Received from Client</Label>
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="w-28">
                            <Input
                              type="number"
                              placeholder="Amount (₹)"
                              value={payAmount}
                              onChange={e => setPayAmount(e.target.value)}
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                          <div className="w-32">
                            <Input
                              type="date"
                              value={payDate}
                              onChange={e => setPayDate(e.target.value)}
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                          <div className="flex-1 min-w-[150px]">
                            <Input
                              placeholder="Cheque / UPI Ref / Note"
                              value={payNote}
                              onChange={e => setPayNote(e.target.value)}
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddPayment(stageName)}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add Payment
                          </Button>
                        </div>
                      </div>
                    )}
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

                  {log.workerCounts && (Number(log.workerCounts.painter) > 0 || Number(log.workerCounts.plumber) > 0 || Number(log.workerCounts.labour) > 0) && (
                    <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Crew on site:</span>
                      {Number(log.workerCounts.painter) > 0 && <span className="px-2 py-0.5 rounded bg-muted font-medium">🎨 {log.workerCounts.painter} Painters</span>}
                      {Number(log.workerCounts.plumber) > 0 && <span className="px-2 py-0.5 rounded bg-muted font-medium">🔧 {log.workerCounts.plumber} Plumbers</span>}
                      {Number(log.workerCounts.labour) > 0 && <span className="px-2 py-0.5 rounded bg-muted font-medium">🔨 {log.workerCounts.labour} Labourers</span>}
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
    </Card>
  );
};
