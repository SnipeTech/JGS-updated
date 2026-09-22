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
  CalendarDays, CheckCircle2, ChevronRight, ArrowRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const DashboardOverviewTab = () => {
  const { sites, dailyLogs, staffList, invoices, customers, materialRequests } = useApp();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { t } = useTranslation();

  const todayStr = format(new Date(), 'yyyy-MM-dd');

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

  const [showOverdueModal, setShowOverdueModal] = useState(false);

  const todayLogs = useMemo(
    () => dailyLogs.filter(l => l.date === selectedDate),
    [dailyLogs, selectedDate]
  );
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
      todayDriverWage,
    [todayLogs, todayPetrolAllowance, todayDriverWage]
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('dashboard.activeSites'), value: activeSites, subtext: null, icon: <Building2 className="w-5 h-5" />, gradient: 'from-emerald-500/20 to-emerald-500/5', iconColor: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', onClick: undefined },
          { label: t('dashboard.totalStaff'), value: staffList.length, subtext: null, icon: <Users className="w-5 h-5" />, gradient: 'from-amber-500/20 to-amber-500/5', iconColor: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', onClick: undefined },
          { label: t('dashboard.clientAccounts'), value: customers.length, subtext: null, icon: <UserCircle className="w-5 h-5" />, gradient: 'from-blue-500/20 to-blue-500/5', iconColor: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20', onClick: undefined },
          {
            label: 'Overdue Amount',
            value: `₹${totalOverdueAmount.toLocaleString()}`,
            subtext: totalOverdueCount > 0 ? `${totalOverdueCount} Overdue Items • Click for details` : 'No overdue items',
            icon: <AlertCircle className="w-5 h-5" />,
            gradient: 'from-rose-500/20 to-rose-500/5',
            iconColor: 'text-rose-600 dark:text-rose-400',
            border: 'border-rose-500/30 hover:border-rose-500/60 cursor-pointer',
            onClick: () => setShowOverdueModal(true),
          },
        ].map(({ label, value, subtext, icon, gradient, iconColor, border, onClick }) => (
          <div
            key={label}
            onClick={onClick}
            className={`bg-card rounded-3xl p-5 border ${border} shadow-luxury hover:shadow-luxury-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group ${onClick ? 'cursor-pointer' : ''}`}
          >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${gradient} rounded-bl-full pointer-events-none transition-transform group-hover:scale-110`} />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
              <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center ${iconColor} shadow-xs`}>
                {icon}
              </div>
            </div>
            <p className="text-3xl font-heading font-extrabold text-foreground tracking-tight relative z-10">{value}</p>
            {subtext && (
              <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1 relative z-10 flex items-center gap-1">
                {subtext}
              </p>
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
            {sites.map(site => {
              const logsForSite = todayLogs.filter(l => l.siteId === site.id);
              const staffWorkedToday = logsForSite.length > 0;

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
                  {logsForSite.length > 0 && (
                    <div className="mt-4 pt-3.5 border-t border-border/50">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-2">
                        Crew On Site Today
                      </p>
                      <div className="flex flex-col gap-2">
                        {logsForSite.map((log, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-1.5">
                            <div className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 border border-primary/20 shadow-2xs">
                              <UserCircle className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-bold">{log.staffName} (Supervisor)</span>
                            </div>
                            {log.workerIds?.map(workerId => {
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
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
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
          ].map(({ label, val, color, bgColor, borderColor, iconBg, icon }) => (
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
            {todayLogs.map(log => (
              <Card key={log.id} className="list-card space-y-2.5">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <UserCircle className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-heading font-semibold text-sm">{log.staffName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {log.siteName}
                      </p>
                    </div>
                  </div>
                  <span className="badge-neutral capitalize">{log.transportMode}</span>
                </div>
                {log.materials && log.materials.length > 0 && (
                  <div className="bg-muted/40 rounded-xl p-2.5">
                    {log.materials.map((m, i) => (
                      <div key={i} className="flex justify-between text-xs py-0.5">
                        <span>
                          {m.name} × {m.quantity}
                        </span>
                        <span className="font-semibold">₹{m.cost * m.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between text-xs pt-1.5 border-t border-border/50">
                  <span className="text-destructive font-medium flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" />₹{log.transportCost || 0}
                  </span>
                  <span className="text-success font-medium flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />₹{log.incomeFromClient || 0}
                  </span>
                </div>
                {log.notes && <p className="text-xs text-muted-foreground italic">"{log.notes}"</p>}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Overdue Amount Explanation Dialog */}
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
