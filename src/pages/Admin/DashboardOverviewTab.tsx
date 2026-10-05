import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import {
  Building2, Users, UserCircle, FileText, Package, MapPin,
  TrendingUp, TrendingDown, IndianRupee, Clock, AlertCircle,
  CalendarDays, CheckCircle2, ChevronRight, ArrowRight, SendHorizonal,
  CreditCard, Wallet, RefreshCw
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getLabourTypeMeta } from '../Staff/StaffAttendanceTab';

export const DashboardOverviewTab = () => {
  const { sites, dailyLogs, staffList, invoices, customers, materialRequests, stageCompletionRequests, attendances, materialRentals } = useApp();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { t } = useTranslation();

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const pendingStageApprovals = useMemo(() => {
    return (stageCompletionRequests || []).filter(r => r.status === 'pending');
  }, [stageCompletionRequests]);

  // Overdue Site Payment Milestones
  const overdueMilestones = useMemo(() => {
    const list: {
      siteId: string;
      siteName: string;
      clientName: string;
      stageName: string;
      dueDate: string;
      expectedAmount: number;
      paidAmount: number;
      balance: number;
      daysOverdue: number;
    }[] = [];

    sites.forEach(site => {
      (site.paymentStages || []).forEach(stage => {
        const expected = stage.expectedAmount || 0;
        const paid = (stage.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        const balance = Math.max(0, expected - paid);
        if (stage.dueDate && stage.dueDate < todayStr && balance > 0) {
          const dueDateTime = new Date(stage.dueDate + 'T00:00:00').getTime();
          const todayDateTime = new Date(todayStr + 'T00:00:00').getTime();
          const daysOverdue = Math.max(1, Math.floor((todayDateTime - dueDateTime) / 86400000));
          list.push({
            siteId: site.id,
            siteName: site.name,
            clientName: site.clientName || 'Client',
            stageName: stage.stageName,
            dueDate: stage.dueDate,
            expectedAmount: expected,
            paidAmount: paid,
            balance,
            daysOverdue
          });
        }
      });
    });

    return list.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [sites, todayStr]);

  // Overdue Invoices
  const overdueInvoices = useMemo(() => {
    return (invoices || [])
      .filter((i: any) => i && i.status !== 'paid' && i.dueDate && i.dueDate < todayStr)
      .map((i: any) => {
        const dueDateTime = new Date(i.dueDate + 'T00:00:00').getTime();
        const todayDateTime = new Date(todayStr + 'T00:00:00').getTime();
        const daysOverdue = Math.max(1, Math.floor((todayDateTime - dueDateTime) / 86400000));
        const total = Number(i.total ?? i.totalAmount ?? i.grandTotal ?? i.balance ?? i.amount ?? 0) || 0;
        return {
          ...i,
          total,
          daysOverdue
        };
      })
      .sort((a: any, b: any) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
  }, [invoices, todayStr]);

  const totalOverdueMilestones = useMemo(() => overdueMilestones.reduce((s, m) => s + (m.balance || 0), 0), [overdueMilestones]);
  const totalOverdueInvoices = useMemo(() => overdueInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0), [overdueInvoices]);
  const totalOverdueAmount = (totalOverdueMilestones || 0) + (totalOverdueInvoices || 0);
  const totalOverdueCount = overdueMilestones.length + overdueInvoices.length;

  // All unpaid balances for COMPLETED levels only (work done, payment not yet received)
  const dueMilestones = useMemo(() => {
    const list: {
      siteId: string; siteName: string; clientName: string;
      stageName: string; dueDate?: string; expectedAmount: number;
      paidAmount: number; balance: number; paymentsCount: number;
      completionStatus: string;
    }[] = [];
    sites.forEach(site => {
      (site.paymentStages || []).forEach(stage => {
        const expected = stage.expectedAmount || 0;
        const paid = stage.paidAmount || 0;
        const balance = Math.max(0, expected - paid);
        // Only show completed levels where client still owes money
        if (balance > 0 && expected > 0 && stage.completionStatus === 'completed') {
          list.push({
            siteId: site.id, siteName: site.name,
            clientName: site.clientName || 'Client',
            stageName: stage.stageName, dueDate: stage.dueDate,
            expectedAmount: expected, paidAmount: paid, balance,
            paymentsCount: (stage.payments || []).length,
            completionStatus: stage.completionStatus || 'pending',
          });
        }
      });
    });
    return list.sort((a, b) => b.balance - a.balance);
  }, [sites]);


  const totalDueBalance = useMemo(() => dueMilestones.reduce((s, m) => s + m.balance, 0), [dueMilestones]);

  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [showDueModal, setShowDueModal] = useState(false);

  const todayLogs = useMemo(() => {
    const rawLogs = dailyLogs.filter(l => l.date === selectedDate);
    // Group by siteId so each site has exactly ONE daily log card
    const siteMap = new Map<string, typeof rawLogs[0]>();

    for (const log of rawLogs) {
      const key = log.siteId || log.siteName || log.id;
      if (!siteMap.has(key)) {
        siteMap.set(key, { ...log });
      } else {
        const existing = siteMap.get(key)!;
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

        const mergedWorkerCounts = { ...(existing.workerCounts || {}) };
        if (log.workerCounts) {
          Object.entries(log.workerCounts).forEach(([k, v]) => {
            mergedWorkerCounts[k] = Math.max(Number(mergedWorkerCounts[k] || 0), Number(v || 0));
          });
        }

        siteMap.set(key, {
          ...existing,
          incomeFromClient: Math.max(existing.incomeFromClient || 0, log.incomeFromClient || 0),
          workLevelStage: log.workLevelStage || existing.workLevelStage,
          expenses: combinedExpenses,
          materials: combinedMaterials,
          notes: combinedNotes,
          workerIds: combinedWorkerIds,
          workerCounts: mergedWorkerCounts,
        });
      }
    }

    return Array.from(siteMap.values());
  }, [dailyLogs, selectedDate]);
  const totalIncome = useMemo(
    () => todayLogs.reduce((s, l) => s + l.incomeFromClient, 0),
    [todayLogs]
  );
  const todayCompletedRequests = useMemo(
    () => (materialRequests || []).filter(r => r.date === selectedDate && r.status === 'completed'),
    [materialRequests, selectedDate]
  );
  const todayPetrolAllowance = useMemo(
    () => todayCompletedRequests.reduce((sum, r) => sum + (Number(r.petrolCharge) || 0), 0),
    [todayCompletedRequests]
  );
  const todayDriverWage = useMemo(
    () => todayCompletedRequests.reduce((sum, r) => sum + (Number(r.driverWage) || 0), 0),
    [todayCompletedRequests]
  );
  const todayRentalExpense = useMemo(() => {
    return (materialRentals || []).reduce((sum, r) => {
      if (r.status !== 'active') return sum;
      if (r.startDate && r.startDate > selectedDate) return sum;
      if (r.endDate && r.endDate < selectedDate) return sum;
      const rate = Number(r.rentalRatePerDay) || 0;
      const qty = Number(r.quantity) || 1;
      return sum + (rate * qty);
    }, 0);
  }, [materialRentals, selectedDate]);

  const totalExpense = useMemo(
    () =>
      todayLogs.reduce(
        (s, l) =>
          s +
          (l.transportCost || 0) +
          (l.expenses?.reduce((a, e) => a + e.amount, 0) || 0) +
          l.materials.reduce((a, m) => a + m.cost * m.quantity, 0),
        0
      ) +
      todayPetrolAllowance +
      todayDriverWage +
      todayRentalExpense,
    [todayLogs, todayPetrolAllowance, todayDriverWage, todayRentalExpense]
  );
  const profit = totalIncome - totalExpense;
  const activeSites = sites.filter(s => s.status === 'active').length;
  const pendingRequests = (materialRequests || []).filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-5 animate-slide-up">
      {pendingRequests > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-slide-up shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {pendingRequests} Site Material {pendingRequests === 1 ? 'Request' : 'Requests'} Waiting!
              </p>
              <p className="text-xs text-muted-foreground">
                Go to Materials & Suppliers to assign driver, supplier, and vehicle.
              </p>
            </div>
          </div>
          <span className="badge-gold text-[10px] px-2.5 py-1 font-bold shrink-0">{t('dashboard.actionRequired')}</span>
        </div>
      )}

      {pendingStageApprovals.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-slide-up shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
              <SendHorizonal className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {pendingStageApprovals.length} Milestone Level Completion {pendingStageApprovals.length === 1 ? 'Request' : 'Requests'} Waiting for Approval!
              </p>
              <p className="text-xs text-muted-foreground">
                {pendingStageApprovals.map(r => `${r.requestedByStaffName} on ${r.siteName} (${r.stageName})`).join(' • ')}
              </p>
            </div>
          </div>
          <span className="bg-blue-600 text-white text-[10px] px-2.5 py-1 rounded-full font-bold shrink-0 animate-pulse">
            Review in Sites Tab
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: t('dashboard.activeSites'), value: String(activeSites), subtext: null, subtextColor: '', icon: <Building2 className="w-5 h-5" />, gradient: 'from-emerald-500/20 to-emerald-500/5', iconColor: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', onClick: undefined as (() => void) | undefined },
          { label: t('dashboard.totalStaff'), value: String(staffList.length), subtext: null, subtextColor: '', icon: <Users className="w-5 h-5" />, gradient: 'from-amber-500/20 to-amber-500/5', iconColor: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', onClick: undefined as (() => void) | undefined },
          { label: t('dashboard.clientAccounts'), value: String(customers.length), subtext: null, subtextColor: '', icon: <UserCircle className="w-5 h-5" />, gradient: 'from-blue-500/20 to-blue-500/5', iconColor: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20', onClick: undefined as (() => void) | undefined },
          {
            label: 'Client Due',
            value: `₹${totalDueBalance.toLocaleString()}`,
            subtext: dueMilestones.length > 0 ? `${dueMilestones.length} completed level${dueMilestones.length !== 1 ? 's' : ''} unpaid · Click to view` : 'All collected',
            subtextColor: dueMilestones.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
            icon: <Wallet className="w-5 h-5" />,
            gradient: 'from-amber-500/20 to-amber-500/5',
            iconColor: 'text-amber-600 dark:text-amber-400',
            border: dueMilestones.length > 0 ? 'border-amber-500/30 hover:border-amber-500/60' : 'border-amber-500/20',
            onClick: () => setShowDueModal(true),
          },
          {
            label: 'Overdue Amount',
            value: `₹${totalOverdueAmount.toLocaleString()}`,
            subtext: totalOverdueCount > 0 ? `${totalOverdueCount} overdue item${totalOverdueCount !== 1 ? 's' : ''} • Click for details` : 'No overdue items',
            subtextColor: totalOverdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
            icon: <AlertCircle className="w-5 h-5" />,
            gradient: 'from-rose-500/20 to-rose-500/5',
            iconColor: 'text-rose-600 dark:text-rose-400',
            border: totalOverdueCount > 0 ? 'border-rose-500/30 hover:border-rose-500/60' : 'border-rose-500/20',
            onClick: () => setShowOverdueModal(true),
          },
        ].map(({ label, value, subtext, subtextColor, icon, gradient, iconColor, border, onClick }) => (
          <div
            key={label}
            onClick={onClick}
            className={`bg-card rounded-3xl p-5 border ${border} shadow-luxury hover:shadow-luxury-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group ${onClick ? 'cursor-pointer' : ''}`}
          >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${gradient} rounded-bl-full pointer-events-none transition-transform group-hover:scale-110`} />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{label}</span>
              <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center ${iconColor} shadow-xs shrink-0`}>
                {icon}
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-heading font-extrabold text-foreground tracking-tight relative z-10">{value}</p>
            {subtext && (
              <p className={`text-[11px] font-medium mt-1 relative z-10 flex items-center gap-1 ${subtextColor}`}>
                {subtext}
              </p>
            )}
            {onClick && (
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* All Sites live status */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-header mb-0">Live Site Status</h3>
          <span className="text-xs font-semibold text-muted-foreground">
            {sites.filter(s => s.status === 'active').length} Active of {sites.length} Total
          </span>
        </div>

        {sites.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-3xl border border-border/60 shadow-sm">
            <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No interior sites recorded yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              const siteIds = new Set(sites.map(s => s.id));
              const allSitesList = [...sites];
              todayLogs.forEach(log => {
                if (log.siteId && !siteIds.has(log.siteId)) {
                  siteIds.add(log.siteId);
                  allSitesList.push({
                    id: log.siteId,
                    name: log.siteName || 'Custom Site Visit',
                    clientName: 'Field Visit / External Log',
                    address: log.siteName || '',
                    status: 'active',
                    budget: 0,
                    paymentStages: [],
                    assignedStaffIds: log.staffId ? [log.staffId] : [],
                    supervisorId: log.staffId || '',
                    startDate: log.date || selectedDate,
                  });
                }
              });

              return allSitesList.map(site => {
                const logsForSite = todayLogs.filter(l => l.siteId === site.id);

                // Attendance for today that assigned staff to this site
                const todaySiteAttendances = (attendances || []).filter(a =>
                  a.date === selectedDate &&
                  a.status !== 'absent' &&
                  (a.siteId === site.id || a.siteAssignments?.some(sa => sa.siteId === site.id))
                );

                // Collect all supervisors physically assigned to THIS site today
                const supervisorNamesSet = new Set<string>();

                // 1. Supervisors who explicitly allocated THIS site in Team Attendance
                (attendances || []).filter(a =>
                  a.date === selectedDate &&
                  a.status !== 'absent' &&
                  a.siteId === site.id
                ).forEach(a => {
                  const staffObj = staffList.find(s => s.id === a.staffId);
                  if (staffObj && staffObj.role === 'supervisor') {
                    supervisorNamesSet.add(staffObj.name);
                  }
                });

                // 2. Or from daily logs if supervisor was explicitly allocated / had supervisor salary on this site
                logsForSite.forEach(l => {
                  if (Number(l.supervisorSalary) > 0) {
                    const supStaff = staffList.find(s => s.id === l.staffId) || staffList.find(s => s.name === l.staffName);
                    if (supStaff && supStaff.role === 'supervisor') {
                      supervisorNamesSet.add(supStaff.name);
                    } else if (l.staffName) {
                      supervisorNamesSet.add(l.staffName);
                    }
                  }
                });

                // Collect named workers (excluding supervisors so they don't appear twice)
                const workerIdsSet = new Set<string>();
                logsForSite.forEach(l => {
                  (l.workerIds || []).forEach(wId => {
                    const wStaff = staffList.find(s => s.id === wId);
                    if (wStaff && !supervisorNamesSet.has(wStaff.name)) {
                      workerIdsSet.add(wId);
                    }
                  });
                });
                todaySiteAttendances.forEach(a => {
                  const staffObj = staffList.find(s => s.id === a.staffId);
                  if (staffObj && staffObj.role !== 'supervisor' && !supervisorNamesSet.has(staffObj.name)) {
                    workerIdsSet.add(a.staffId);
                  }
                });

                // Aggregate unnamed labour counts across logs and attendance
                const siteLabourCounts: Record<string, number> = {};
                logsForSite.forEach(l => {
                  if (l.workerCounts) {
                    Object.entries(l.workerCounts).forEach(([k, v]) => {
                      siteLabourCounts[k] = Math.max(siteLabourCounts[k] || 0, Number(v) || 0);
                    });
                  }
                });
                todaySiteAttendances.forEach(a => {
                  const assignment = a.siteAssignments?.find(sa => sa.siteId === site.id);
                  if (assignment?.counts) {
                    Object.entries(assignment.counts).forEach(([k, v]) => {
                      siteLabourCounts[k] = Math.max(siteLabourCounts[k] || 0, Number(v) || 0);
                    });
                  } else if (!a.siteAssignments || a.siteAssignments.length === 0) {
                    if (a.presentCounts) {
                      Object.entries(a.presentCounts).forEach(([k, v]) => {
                        siteLabourCounts[k] = Math.max(siteLabourCounts[k] || 0, Number(v) || 0);
                      });
                    }
                  }
                });

                const uniqueSupervisors = Array.from(supervisorNamesSet);
                const uniqueWorkerIds = Array.from(workerIdsSet);
                const hasLabourCounts = Object.values(siteLabourCounts).some(v => v > 0);

                // Active Rental Materials & Machinery on this site
                const activeRentalsForSite = (materialRentals || []).filter(r =>
                  r.siteId === site.id &&
                  r.status === 'active' &&
                  (!r.startDate || r.startDate <= selectedDate) &&
                  (!r.endDate || r.endDate >= selectedDate)
                );

                const staffWorkedToday = logsForSite.length > 0 || uniqueSupervisors.length > 0 || uniqueWorkerIds.length > 0 || hasLabourCounts || activeRentalsForSite.length > 0;

              let displayStatus: string;
              let badgeClass: string;
              let dotColor: string;

              if (site.status === 'completed') {
                displayStatus = 'Completed';
                badgeClass = 'badge-neutral';
                dotColor = 'hsl(30 10% 60%)';
              } else if (staffWorkedToday) {
                displayStatus = 'Active Today';
                badgeClass = 'badge-success';
                dotColor = 'hsl(152 55% 35%)';
              } else {
                displayStatus = 'No Work Today';
                badgeClass = 'badge-gold';
                dotColor = 'hsl(38 72% 42%)';
              }

              return (
                <Card key={site.id} className="bg-card rounded-3xl p-5 border border-border/60 shadow-luxury hover:shadow-luxury-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs"
                          style={{ background: `${dotColor}18` }}
                        >
                          <MapPin className="w-5 h-5" style={{ color: dotColor }} />
                        </div>
                        {staffWorkedToday && site.status !== 'completed' && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                            <span
                              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70"
                              style={{ background: 'hsl(152 55% 35%)' }}
                            />
                            <span
                              className="relative inline-flex rounded-full h-3 w-3 shadow-xs"
                              style={{ background: 'hsl(152 55% 35%)' }}
                            />
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-bold text-base text-foreground truncate">{site.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{site.clientName}</p>
                        {site.address && (
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{site.address}</p>
                        )}
                      </div>
                    </div>
                    <span className={`${badgeClass} shrink-0`}>{displayStatus}</span>
                  </div>

                  {/* Staff who worked at this site today */}
                  {staffWorkedToday && (
                    <div className="mt-4 pt-3.5 border-t border-border/50">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-2">
                        Crew On Site Today
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {uniqueSupervisors.map((supName, sIdx) => (
                          <div key={`sup_${sIdx}`} className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 border border-primary/20 shadow-2xs">
                            <UserCircle className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold">{supName} (Supervisor)</span>
                          </div>
                        ))}
                        {uniqueWorkerIds.map(workerId => {
                          const worker = staffList.find(s => s.id === workerId);
                          return worker ? (
                            <div
                              key={workerId}
                              className="flex items-center gap-1 bg-muted/60 text-foreground/80 rounded-full px-2.5 py-1 border border-border/60 text-[11px] font-medium"
                            >
                              <Users className="w-3 h-3 text-muted-foreground" />
                              <span>{worker.name}</span>
                            </div>
                          ) : null;
                        })}
                        {Object.entries(siteLabourCounts).map(([trade, count]) => {
                          if (!count || Number(count) <= 0) return null;
                          const meta = getLabourTypeMeta(trade);
                          return (
                            <span
                              key={trade}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-muted/60 text-foreground/80 border border-border/60"
                            >
                              {meta.icon} {count} {meta.label}{Number(count) > 1 ? 's' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Active Rental Equipment & Machinery on this site */}
                  {activeRentalsForSite.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold tracking-wider mb-1.5 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Active Rentals On Site ({activeRentalsForSite.length})
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {activeRentalsForSite.map(rental => (
                          <div
                            key={rental.id}
                            className="flex items-center gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-full px-2.5 py-1 border border-amber-500/25 text-[11px] font-semibold shadow-2xs"
                          >
                            <Package className="w-3 h-3 text-amber-600" />
                            <span>{rental.materialName} ({rental.quantity} {rental.unit || 'Nos'})</span>
                            {rental.rentalRatePerDay ? (
                              <span className="text-[10px] text-muted-foreground font-mono font-medium">
                                ₹{rental.rentalRatePerDay}/d
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            });
          })()}
        </div>
        )}
      </div>

      {/* Date Filter & Financial Summary */}
      <div className="pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="section-header mb-0">Financial Overview</h3>
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Filter Date:</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-10 w-44 rounded-2xl bg-card border-border/60 text-xs font-semibold"
            />
          </div>
        </div>

        {/* Income / Expense / Profit Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: 'Daily Client Inflow',
              val: totalIncome,
              color: 'text-emerald-600 dark:text-emerald-400',
              bgColor: 'from-emerald-500/15 via-card to-card',
              borderColor: 'border-emerald-500/25',
              iconBg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
              icon: <TrendingUp className="w-5 h-5" />
            },
            {
              label: 'Daily Site Expenses',
              val: totalExpense,
              subtitle: todayRentalExpense > 0 ? `Includes ₹${todayRentalExpense.toLocaleString()} active rentals` : undefined,
              color: 'text-rose-600 dark:text-rose-400',
              bgColor: 'from-rose-500/15 via-card to-card',
              borderColor: 'border-rose-500/25',
              iconBg: 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
              icon: <TrendingDown className="w-5 h-5" />
            },
            {
              label: 'Net Daily Margin',
              val: profit,
              color: profit >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400',
              bgColor: profit >= 0 ? 'from-amber-500/15 via-card to-card' : 'from-rose-500/15 via-card to-card',
              borderColor: profit >= 0 ? 'border-amber-500/30' : 'border-rose-500/30',
              iconBg: profit >= 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
              icon: <IndianRupee className="w-5 h-5" />
            },
          ].map(({ label, val, subtitle, color, bgColor, borderColor, iconBg, icon }) => (
            <div
              key={label}
              className={`bg-gradient-to-br ${bgColor} rounded-3xl p-5 border ${borderColor} shadow-luxury relative overflow-hidden`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${iconBg} shadow-xs`}>
                  {icon}
                </div>
              </div>
              <p className={`text-2xl md:text-3xl font-heading font-extrabold ${color} tracking-tight`}>
                ₹{val.toLocaleString()}
              </p>
              {subtitle && <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">{subtitle}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Daily Logs */}
      <div>
        <h3 className="section-header">Daily Logs</h3>
        {todayLogs.length === 0 ? (
          <div className="text-center py-10 bg-card rounded-2xl border border-border/50">
            <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-medium">No logs for this date</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayLogs.map(log => {
              const miscExp = (log.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
              const matCost = (log.materials || []).reduce((a, m) => a + m.cost * m.quantity, 0);
              const siteDayRentals = (materialRentals || []).filter(r =>
                (r.siteId === log.siteId || (r.siteName && log.siteName && r.siteName.toLowerCase() === log.siteName.toLowerCase())) &&
                r.status === 'active' &&
                (!r.startDate || r.startDate <= selectedDate) &&
                (!r.endDate || r.endDate >= selectedDate)
              );
              const dayRentalCost = siteDayRentals.reduce((sum, r) => sum + ((r.quantity || 1) * (r.rentalRatePerDay || 0)), 0);
              const totalLogExpense = (log.transportCost || 0) + miscExp + matCost + dayRentalCost;
              const hasCrewCounts = log.workerCounts && (Number(log.workerCounts.painter) > 0 || Number(log.workerCounts.plumber) > 0 || Number(log.workerCounts.labour) > 0);
              const hasCrew = Boolean(log.staffName) || (log.workerIds && log.workerIds.length > 0) || hasCrewCounts;

              return (
                <Card key={log.id} className="list-card space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <UserCircle className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading font-semibold text-sm truncate">{log.staffName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{log.siteName}</span>
                        </p>
                      </div>
                    </div>
                    {log.workLevelStage && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                        {log.workLevelStage}
                      </span>
                    )}
                  </div>

                  {/* Worker counts / crew on site */}
                  {hasCrew && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] p-2 rounded-xl bg-muted/40 border border-border/40">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Crew:</span>
                      {log.staffName && (
                        <span className="inline-flex items-center gap-1 font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                          <UserCircle className="w-3.5 h-3.5" />
                          {log.staffName} (Supervisor)
                        </span>
                      )}
                      {(log.workerIds || []).map(wId => {
                        const worker = staffList.find(s => s.id === wId);
                        if (!worker || (log.staffName && worker.name.toLowerCase() === log.staffName.toLowerCase())) return null;
                        return (
                          <span key={wId} className="inline-flex items-center gap-1 font-medium text-foreground/80 bg-background px-2 py-0.5 rounded-md border border-border/60">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            {worker.name}
                          </span>
                        );
                      })}
                      {Number(log.workerCounts?.painter) > 0 && <span className="font-semibold text-amber-700 dark:text-amber-300">🎨 {log.workerCounts.painter} Painters</span>}
                      {Number(log.workerCounts?.plumber) > 0 && <span className="font-semibold text-sky-700 dark:text-sky-300">🔧 {log.workerCounts.plumber} Plumbers</span>}
                      {Number(log.workerCounts?.labour) > 0 && <span className="font-semibold text-orange-700 dark:text-orange-300">🔨 {log.workerCounts.labour} Labourers</span>}
                    </div>
                  )}

                  {/* Materials */}
                  {log.materials && log.materials.length > 0 && (
                    <div className="bg-muted/40 rounded-xl p-2.5 space-y-1">
                      {log.materials.map((m, i) => (
                        <div key={i} className="flex justify-between text-xs py-0.5">
                          <span>{m.name} × {m.quantity}</span>
                          <span className="font-semibold">₹{m.cost * m.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Active Site Rentals linked to this site */}
                  {(() => {
                    const siteRentals = (materialRentals || []).filter(r =>
                      (r.siteId === log.siteId || (r.siteName && log.siteName && r.siteName.toLowerCase() === log.siteName.toLowerCase())) &&
                      r.status === 'active' &&
                      (!r.startDate || r.startDate <= selectedDate) &&
                      (!r.endDate || r.endDate >= selectedDate)
                    );
                    if (siteRentals.length === 0) return null;
                    return (
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 text-amber-600" /> Active Rentals Deployed ({siteRentals.length}):
                        </span>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {siteRentals.map(r => (
                            <span key={r.id} className="text-[10px] font-semibold bg-card px-2 py-0.5 rounded-md border border-amber-500/20 text-foreground">
                              {r.materialName} ({r.quantity} {r.unit || 'Nos'}) {r.rentalRatePerDay ? `· ₹${r.rentalRatePerDay}/d` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Itemized Expenses */}
                  {log.expenses && log.expenses.length > 0 && (
                    <div className="bg-rose-500/5 rounded-xl p-2 border border-rose-500/15 space-y-1">
                      <span className="text-[10px] font-bold text-destructive uppercase tracking-wider block">
                        Site Expenses:
                      </span>
                      {log.expenses.map((e, i) => (
                        <div key={i} className="flex justify-between text-xs text-muted-foreground">
                          <span className="truncate">{e.itemName}</span>
                          <span className="font-semibold text-destructive font-mono">₹{e.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between text-xs pt-1.5 border-t border-border/50">
                    <span className="text-destructive font-medium flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" />₹{totalLogExpense.toLocaleString()}
                      {dayRentalCost > 0 && (
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-normal">
                          (incl. ₹{dayRentalCost.toLocaleString()} rent)
                        </span>
                      )}
                    </span>
                    <span className="text-success font-medium flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />₹{(log.incomeFromClient || 0).toLocaleString()}
                    </span>
                  </div>
                  {log.notes && <p className="text-xs text-muted-foreground italic whitespace-pre-line">"{log.notes}"</p>}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Total Due Detail Modal ── */}
      <Dialog open={showDueModal} onOpenChange={setShowDueModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader className="pb-3 border-b border-border/50">
            <DialogTitle className="text-base font-heading font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Wallet className="w-5 h-5" />
              Payment Due — Completed Work, Awaiting Client Payment
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Levels where work is <strong>completed</strong> but the client has not yet fully paid the milestone amount.
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Summary */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 block tracking-wider">Total Uncollected Balance</span>
                <span className="font-heading font-extrabold text-2xl text-amber-600 dark:text-amber-400">₹{totalDueBalance.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="text-right">
                  <span className="text-muted-foreground block text-[10px]">Levels Unpaid:</span>
                  <span className="font-bold text-foreground">{dueMilestones.length}</span>
                </div>
                <div className="h-6 w-px bg-border/60" />
                <div className="text-right">
                  <span className="text-muted-foreground block text-[10px]">Of which Overdue:</span>
                  <span className="font-bold text-destructive">{overdueMilestones.length}</span>
                </div>
              </div>
            </div>

            {dueMilestones.length === 0 ? (
              <div className="p-6 rounded-2xl bg-muted/20 border border-border/40 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">All payments collected!</p>
                <p className="text-xs text-muted-foreground mt-1">No outstanding balances across any site.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dueMilestones.map((m, idx) => {
                  const isOverdue = m.dueDate && m.dueDate < todayStr;
                  const pct = m.expectedAmount > 0 ? Math.min(100, Math.round((m.paidAmount / m.expectedAmount) * 100)) : 0;
                  return (
                    <div key={idx} className={`p-4 rounded-2xl bg-card border shadow-2xs space-y-3 ${
                      isOverdue ? 'border-destructive/30 hover:border-destructive/50' : 'border-amber-500/25 hover:border-amber-500/40'
                    } transition-colors`}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <span className="font-heading font-bold text-sm text-foreground block">{m.siteName}</span>
                          <span className="text-xs text-muted-foreground">
                            Client: <strong className="text-foreground">{m.clientName}</strong> &bull; <span className="font-semibold text-primary">{m.stageName}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isOverdue && (
                            <span className="bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full text-[10px] font-bold">Overdue</span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border ${
                            m.completionStatus === 'completed' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' :
                            m.completionStatus === 'in_progress' ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' :
                            'bg-muted text-muted-foreground border-border/50'
                          }`}>{m.completionStatus.replace('_', ' ')}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 rounded-xl p-2.5">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Milestone</span>
                          <span className="font-bold text-foreground">₹{m.expectedAmount.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Collected</span>
                          <span className="font-bold text-emerald-600">₹{m.paidAmount.toLocaleString()}</span>
                          {m.paymentsCount > 0 && <span className="text-[9px] text-muted-foreground block">{m.paymentsCount} payment{m.paymentsCount !== 1 ? 's' : ''}</span>}
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-bold block ${isOverdue ? 'text-destructive' : 'text-amber-700 dark:text-amber-300'}`}>Balance Due</span>
                          <span className={`font-extrabold text-sm ${isOverdue ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>₹{m.balance.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Payment Progress</span>
                          <span className="font-bold">{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : isOverdue ? 'bg-destructive' : 'bg-amber-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {m.dueDate && (
                          <p className={`text-[10px] font-semibold ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                            Due date: {(() => { try { return format(new Date(m.dueDate + 'T00:00:00'), 'dd MMM yyyy'); } catch { return m.dueDate; } })()} {isOverdue ? '⚠️ Overdue' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Overdue Amount Explanation Dialog ── */}
      <Dialog open={showOverdueModal} onOpenChange={setShowOverdueModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader className="pb-3 border-b border-border/50">
            <DialogTitle className="text-base font-heading font-bold flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Overdue Amount Details & Explanation
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Detailed breakdown of site milestone payment stages and customer invoices that have passed their target due dates without complete payment.
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Summary Banner */}
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-destructive block tracking-wider">
                  Total Outstanding Overdue
                </span>
                <span className="font-heading font-extrabold text-2xl text-destructive">
                  ₹{totalOverdueAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right text-xs">
                  <span className="text-muted-foreground block text-[10px]">Site Milestones:</span>
                  <span className="font-bold text-foreground">₹{totalOverdueMilestones.toLocaleString()}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">({overdueMilestones.length})</span>
                </div>
                <div className="h-6 w-px bg-border/60 mx-1" />
                <div className="text-right text-xs">
                  <span className="text-muted-foreground block text-[10px]">Invoices:</span>
                  <span className="font-bold text-foreground">₹{totalOverdueInvoices.toLocaleString()}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">({overdueInvoices.length})</span>
                </div>
              </div>
            </div>

            {/* SECTION 1: SITE STAGE PAYMENT MILESTONES */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-heading font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  Site Payment Milestones Overdue ({overdueMilestones.length})
                </h4>
                <span className="text-[10px] text-muted-foreground">From Site Level of Completion Stages</span>
              </div>

              {overdueMilestones.length === 0 ? (
                <div className="p-4 rounded-xl bg-muted/20 border border-border/40 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  All site payment milestone stages are paid or on schedule!
                </div>
              ) : (
                <div className="space-y-2">
                  {overdueMilestones.map((m, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-card border border-destructive/25 hover:border-destructive/40 transition-colors shadow-2xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-heading font-bold text-sm text-foreground block">
                            {m.siteName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Client: <strong className="text-foreground">{m.clientName}</strong> • Stage: <span className="font-semibold text-primary">{m.stageName}</span>
                          </span>
                        </div>
                        <span className="bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0">
                          Overdue by {m.daysOverdue} {m.daysOverdue === 1 ? 'day' : 'days'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-muted/30 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Target Date:</span>
                          <span className="font-semibold">
                            {(() => {
                              try {
                                return format(new Date(m.dueDate + 'T00:00:00'), 'dd MMM yyyy');
                              } catch {
                                return m.dueDate || 'N/A';
                              }
                            })()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Stage Expected:</span>
                          <span className="font-semibold">₹{(m.expectedAmount || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground block">Paid: ₹{(m.paidAmount || 0).toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-destructive font-bold block">Overdue Balance:</span>
                          <span className="font-extrabold text-sm text-destructive">₹{(m.balance || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 2: CUSTOMER INVOICES */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-heading font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Overdue Customer Invoices ({overdueInvoices.length})
                </h4>
                <span className="text-[10px] text-muted-foreground">Unpaid Invoices past Due Date</span>
              </div>

              {overdueInvoices.length === 0 ? (
                <div className="p-4 rounded-xl bg-muted/20 border border-border/40 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  No customer invoices are overdue!
                </div>
              ) : (
                <div className="space-y-2">
                  {overdueInvoices.map((inv: any) => {
                    const totalVal = Number(inv.total ?? inv.totalAmount ?? inv.grandTotal ?? inv.balance ?? inv.amount ?? 0) || 0;
                    let dueFormatted = inv.dueDate;
                    try {
                      dueFormatted = format(new Date(inv.dueDate + 'T00:00:00'), 'dd MMM yyyy');
                    } catch {
                      dueFormatted = inv.dueDate || 'N/A';
                    }
                    return (
                      <div key={inv.id || Math.random()} className="p-3 rounded-2xl bg-card border border-destructive/25 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="font-bold text-foreground block">
                            {inv.invoiceNumber || 'Invoice'} — {inv.customerName || 'Customer'}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Due Date: {dueFormatted}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-sm text-destructive block">
                            ₹{totalVal.toLocaleString()}
                          </span>
                          <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                            Overdue by {inv.daysOverdue || 1} days
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardOverviewTab;
