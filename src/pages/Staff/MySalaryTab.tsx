import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import {
  Wallet, CalendarDays, Clock, Truck, ChevronLeft, ChevronRight,
  UserCircle, CheckCircle2, TrendingUp, Users, Printer, History, ShieldCheck, Banknote, CreditCard
} from 'lucide-react';
import { Staff } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MySalaryTabProps {
  staff: Staff | undefined;
}

export const MySalaryTab = ({ staff }: MySalaryTabProps) => {
  const { attendances, materialRequests, currentUser } = useApp();

  const [filterMode, setFilterMode] = useState<'weekly' | 'monthly' | 'custom'>('monthly');

  // Weekly state
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());

  // Monthly state
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  // Custom range state
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const isDriver = staff?.role === 'driver';
  const isSupervisor = staff?.role === 'supervisor';

  // Base daily rate calculation
  const dailyBase = staff?.salaryType === 'hourly'
    ? (staff.perHourSalary || 0) * 8
    : staff?.perDaySalary || 0;
  const otRate = staff?.incentivePerHour || 0;

  // Derive date bounds
  const { fromDate, toDate, periodLabel } = useMemo(() => {
    if (filterMode === 'weekly') {
      const s = startOfWeek(currentWeekDate, { weekStartsOn: 1 });
      const e = endOfWeek(currentWeekDate, { weekStartsOn: 1 });
      return {
        fromDate: format(s, 'yyyy-MM-dd'),
        toDate: format(e, 'yyyy-MM-dd'),
        periodLabel: `${format(s, 'dd MMM')} – ${format(e, 'dd MMM yyyy')}`
      };
    } else if (filterMode === 'monthly') {
      const s = startOfMonth(currentMonthDate);
      const e = endOfMonth(currentMonthDate);
      return {
        fromDate: format(s, 'yyyy-MM-dd'),
        toDate: format(e, 'yyyy-MM-dd'),
        periodLabel: format(currentMonthDate, 'MMMM yyyy')
      };
    } else {
      return {
        fromDate: customFrom,
        toDate: customTo,
        periodLabel: `${customFrom} to ${customTo}`
      };
    }
  }, [filterMode, currentWeekDate, currentMonthDate, customFrom, customTo]);

  // Filter logs for this staff in period
  const reportData = useMemo(() => {
    if (!staff) return { logs: [], fullDays: 0, halfDays: 0, absentDays: 0, totalOtHours: 0, basePayTotal: 0, otPayTotal: 0, transitPayTotal: 0, crewPayTotal: 0, totalNet: 0, tripCount: 0 };

    const myAtts = (attendances || [])
      .filter(a => a.staffId === (staff.id || currentUser?.id) && a.date >= fromDate && a.date <= toDate)
      .sort((a, b) => b.date.localeCompare(a.date));

    let fullDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let totalOtHours = 0;
    let basePayTotal = 0;
    let otPayTotal = 0;
    let transitPayTotal = 0;
    let crewPayTotal = 0;
    let tripCount = 0;

    const logs = myAtts.map(att => {
      const isPresent = att.status === 'present';
      const isHalf = att.status === 'half-day';
      const isAbsent = att.status === 'absent';

      if (isPresent) fullDays++;
      else if (isHalf) halfDays++;
      else if (isAbsent) absentDays++;

      const base = isHalf ? dailyBase / 2 : isPresent ? dailyBase : 0;
      const otHours = att.otHours || 0;
      const otPay = otHours * otRate;

      // Driver trips on that date
      let driverTrips: any[] = [];
      let transitPay = 0;
      if (isDriver) {
        driverTrips = (materialRequests || []).filter(
          r => (r.driverId === staff.id || r.driverName?.toLowerCase() === staff.name.toLowerCase()) &&
               (r.date === att.date || r.createdAt?.startsWith(att.date))
        );
        transitPay = driverTrips.reduce((acc, r) => acc + (r.driverCost || 0), 0);
        tripCount += driverTrips.length;
      }

      // Supervisor crew management
      let crewPay = 0;
      let crewCount = 0;
      if (isSupervisor && att.presentCounts) {
        crewCount = (att.presentCounts.painter || 0) + (att.presentCounts.plumber || 0) + (att.presentCounts.labour || 0);
        const crewReg = crewCount * (staff.underLabourSalary || 0);
        const unOtH = att.unnamedOtHours || 0;
        const unOtStaff = att.unnamedOtStaffCount !== undefined ? att.unnamedOtStaffCount : (unOtH > 0 ? crewCount : 0);
        const crewOt = unOtStaff * unOtH * (staff.underLabourOT || 0);
        crewPay = crewReg + crewOt;
      }

      const dayTotal = base + otPay + transitPay + crewPay;

      basePayTotal += base;
      otPayTotal += otPay;
      transitPayTotal += transitPay;
      crewPayTotal += crewPay;
      totalOtHours += otHours;

      return {
        ...att,
        base,
        otHours,
        otPay,
        transitPay,
        crewPay,
        crewCount,
        driverTrips,
        dayTotal
      };
    });

    const totalNet = basePayTotal + otPayTotal + transitPayTotal + crewPayTotal;

    return {
      logs,
      fullDays,
      halfDays,
      absentDays,
      totalOtHours,
      basePayTotal,
      otPayTotal,
      transitPayTotal,
      crewPayTotal,
      tripCount,
      totalNet
    };
  }, [staff, currentUser, attendances, materialRequests, fromDate, toDate, dailyBase, otRate, isDriver, isSupervisor]);

  // Read paid history records from localStorage
  const paidHistory: any[] = useMemo(() => {
    try {
      const stored = localStorage.getItem('edamari_payroll_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  // Check if current period has been recorded as paid
  const currentPeriodRecord = useMemo(() => {
    return paidHistory.find(h =>
      (h.staffId === staff?.id || h.staffId === `crew_team_${staff?.id}`) &&
      h.fromDate === fromDate && h.toDate === toDate
    );
  }, [paidHistory, staff?.id, fromDate, toDate]);

  // Check if admin marked this period paid
  const isPaid = useMemo(() => {
    if (currentPeriodRecord) return true;
    try {
      const stored = localStorage.getItem('edamari_payroll_paid');
      if (!stored) return false;
      const map = JSON.parse(stored);
      return !!map[`${staff?.id}_${fromDate}_${toDate}`] || !!map[`crew_team_${staff?.id}_${fromDate}_${toDate}`];
    } catch {
      return false;
    }
  }, [currentPeriodRecord, staff?.id, fromDate, toDate]);

  // Past payments for this staff member
  const myPaidRecords = useMemo(() => {
    return paidHistory.filter(h =>
      h.staffId === staff?.id || h.staffId === `crew_team_${staff?.id}`
    );
  }, [paidHistory, staff?.id]);

  // Download official salary slip PDF
  const downloadSlipPDF = (record: any) => {
    const doc = new jsPDF('portrait');

    doc.setFontSize(18);
    doc.setTextColor(184, 117, 26);
    doc.text('JGS INTERIOR & CONSTRUCTION', 105, 20, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text('Official Staff Salary & Wage Slip', 105, 27, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(14, 32, 196, 32);

    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text(`Slip / Voucher #: ${record.id.toUpperCase()}`, 14, 40);
    doc.text(`Payment Date: ${record.paidAt}`, 14, 46);
    doc.text(`Payment Mode: ${record.paymentMode}${record.referenceNo ? ` (${record.referenceNo})` : ''}`, 14, 52);

    doc.text(`Employee Name: ${record.staffName}`, 120, 40);
    doc.text(`Role: ${record.role.toUpperCase()}`, 120, 46);
    doc.text(`Period Covered: ${record.periodLabel}`, 120, 52);

    const head = [['Wage Component', 'Units / Days', 'Amount (Rs)']];
    const body: any[][] = [
      ['Base Wages', `${record.daysWorked} Days`, record.basePay.toLocaleString()],
      ['Overtime Pay', `${record.otHours} Hours OT`, record.otPay.toLocaleString()],
    ];

    if (record.extraPay > 0) {
      body.push(['Transit / Allowances', 'Recorded Runs', record.extraPay.toLocaleString()]);
    }

    body.push(['NET AMOUNT PAID', 'Settled & Verified', `Rs ${record.totalAmount.toLocaleString()}`]);

    autoTable(doc, {
      startY: 60,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [184, 117, 26], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: function(data) {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [236, 253, 245];
          data.cell.styles.textColor = [6, 95, 70];
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 130;
    if (record.notes) {
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(`Notes: ${record.notes}`, 14, finalY + 12);
    }

    const sigY = finalY + 45;
    doc.line(20, sigY, 75, sigY);
    doc.text('Authorized Signatory (Office)', 22, sigY + 6);

    doc.line(135, sigY, 190, sigY);
    doc.text('Employee Signature', 140, sigY + 6);

    doc.save(`Salary_Slip_${staff?.name?.replace(/\s+/g, '_') || 'Staff'}_${record.id.slice(-6)}.pdf`);
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Quick Period Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/50 shadow-xs">
        <div>
          <h3 className="section-header !mb-0 text-base flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> My Salary & Earnings Statement
          </h3>
          <p className="text-xs text-muted-foreground">
            Review your weekly, monthly, and customized date salary calculations and overtime pay.
          </p>
        </div>

        {/* Filter Mode Selector Pills */}
        <div className="inline-flex rounded-xl border border-border/60 p-1 bg-muted/40 gap-1 self-start sm:self-auto">
          {[
            { id: 'weekly' as const, label: 'Weekly' },
            { id: 'monthly' as const, label: 'Monthly' },
            { id: 'custom' as const, label: 'Custom Range' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilterMode(opt.id)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                filterMode === opt.id
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period Navigation Controller */}
      <div className="p-3 bg-card rounded-2xl border border-border/50 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {filterMode === 'weekly' && (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/50">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentWeekDate(subWeeks(currentWeekDate, 1))}
                className="h-8 w-8 rounded-lg"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentWeekDate(new Date())}
                className="h-8 px-2.5 rounded-lg text-xs font-bold"
              >
                This Week
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentWeekDate(addWeeks(currentWeekDate, 1))}
                className="h-8 w-8 rounded-lg"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <span className="text-xs font-bold text-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/40">
              📅 {periodLabel}
            </span>
          </div>
        )}

        {filterMode === 'monthly' && (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/50">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))}
                className="h-8 w-8 rounded-lg"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonthDate(new Date())}
                className="h-8 px-2.5 rounded-lg text-xs font-bold"
              >
                This Month
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}
                className="h-8 w-8 rounded-lg"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <span className="text-xs font-bold text-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/40">
              🗓️ {periodLabel}
            </span>
          </div>
        )}

        {filterMode === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Label className="text-muted-foreground font-semibold">From:</Label>
              <Input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="h-8 w-34 text-xs rounded-xl"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-muted-foreground font-semibold">To:</Label>
              <Input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="h-8 w-34 text-xs rounded-xl"
              />
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground ml-auto">
          Base: <strong className="text-foreground">₹{dailyBase.toLocaleString()}</strong>{staff?.salaryType === 'hourly' ? '/8h' : '/d'} · OT: <strong className="text-foreground">₹{otRate}</strong>/hr
        </div>
      </div>

      {/* Net Earnings Hero Banner */}
      <Card
        className="p-5 rounded-3xl text-white shadow-md border-0 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 48%))' }}
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] uppercase font-bold tracking-widest text-white/80 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> Total Earned Salary ({periodLabel})
            </span>
            <div className="text-3xl sm:text-4xl font-heading font-extrabold mt-1 tracking-tight">
              ₹{reportData.totalNet.toLocaleString()}
            </div>
            <p className="text-xs text-white/90 mt-1">
              {reportData.fullDays + reportData.halfDays > 0
                ? `${reportData.fullDays} full days + ${reportData.halfDays} half days worked · ${reportData.totalOtHours}h overtime`
                : 'No worked days recorded in this period'}
            </p>
            <div className="mt-2.5">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                isPaid
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'bg-black/25 text-white/90 border border-white/30'
              }`}>
                {isPaid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Paid on {currentPeriodRecord?.paidAt || 'Recent'} {currentPeriodRecord ? `via ${currentPeriodRecord.paymentMode}` : ''}
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    Pending Disbursement by Admin
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-xs p-3 rounded-2xl border border-white/20 text-xs space-y-1 self-start sm:self-auto min-w-[170px]">
            <div className="flex justify-between gap-3 text-white/80">
              <span>Base Wages:</span>
              <span className="font-bold text-white">₹{reportData.basePayTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-3 text-white/80">
              <span>OT Wages:</span>
              <span className="font-bold text-white">₹{reportData.otPayTotal.toLocaleString()}</span>
            </div>
            {isDriver && (
              <div className="flex justify-between gap-3 text-white/80">
                <span>Transit Pay:</span>
                <span className="font-bold text-white">₹{reportData.transitPayTotal.toLocaleString()}</span>
              </div>
            )}
            {isSupervisor && reportData.crewPayTotal > 0 && (
              <div className="flex justify-between gap-3 text-white/80">
                <span>Crew Pay:</span>
                <span className="font-bold text-white">₹{reportData.crewPayTotal.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 rounded-2xl bg-card border border-border/50 shadow-xs">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Days Worked</p>
          <p className="text-xl font-heading font-bold text-foreground mt-0.5">
            {reportData.fullDays + reportData.halfDays}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {reportData.fullDays} full · {reportData.halfDays} half
          </p>
        </Card>

        <Card className="p-3.5 rounded-2xl bg-card border border-border/50 shadow-xs">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Base Pay Earned</p>
          <p className="text-xl font-heading font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            ₹{reportData.basePayTotal.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            ₹{dailyBase}{staff?.salaryType === 'hourly' ? '/8h' : '/day'}
          </p>
        </Card>

        <Card className="p-3.5 rounded-2xl bg-card border border-border/50 shadow-xs">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Overtime Pay</p>
          <p className="text-xl font-heading font-bold text-amber-600 dark:text-amber-400 mt-0.5">
            +₹{reportData.otPayTotal.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {reportData.totalOtHours}h × ₹{otRate}/hr
          </p>
        </Card>

        {isDriver ? (
          <Card className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 shadow-xs">
            <p className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-bold tracking-wider">Transit Pay</p>
            <p className="text-xl font-heading font-bold text-blue-600 dark:text-blue-400 mt-0.5">
              +₹{reportData.transitPayTotal.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {reportData.tripCount} delivery run{reportData.tripCount === 1 ? '' : 's'}
            </p>
          </Card>
        ) : isSupervisor ? (
          <Card className="p-3.5 rounded-2xl bg-card border border-border/50 shadow-xs">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Crew Wages</p>
            <p className="text-xl font-heading font-bold text-primary mt-0.5">
              ₹{reportData.crewPayTotal.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Unnamed crew
            </p>
          </Card>
        ) : (
          <Card className="p-3.5 rounded-2xl bg-card border border-border/50 shadow-xs">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Avg Wage / Day</p>
            <p className="text-xl font-heading font-bold text-primary mt-0.5">
              ₹{reportData.fullDays + reportData.halfDays > 0
                ? Math.round(reportData.totalNet / (reportData.fullDays + (reportData.halfDays * 0.5))).toLocaleString()
                : 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Per working day
            </p>
          </Card>
        )}
      </div>

      {/* Day-by-Day Statement Table / List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="section-header !mb-0 text-sm flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-primary" /> Daily Earnings Statement
          </h3>
          <span className="text-xs text-muted-foreground">
            {reportData.logs.length} day records in period
          </span>
        </div>

        {reportData.logs.length === 0 ? (
          <div className="text-center py-10 bg-card rounded-2xl border border-border/50 text-muted-foreground text-xs">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium text-foreground">No attendance records found for this period.</p>
            <p className="mt-0.5">Choose another week, month, or adjust the date range above.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {reportData.logs.map(log => {
              let formattedDate = log.date;
              try {
                formattedDate = format(new Date(log.date + 'T00:00:00'), 'dd MMM yyyy, EEEE');
              } catch { }

              return (
                <Card
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-card border border-border/50 space-y-2.5 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      <span className="font-bold text-sm text-foreground">{formattedDate}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          log.status === 'present'
                            ? 'bg-emerald-500/15 text-emerald-600'
                            : log.status === 'half-day'
                            ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-destructive/15 text-destructive'
                        }`}
                      >
                        {log.status}
                      </span>
                      <span className="text-xs font-heading font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                        Day Total: ₹{log.dayTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {log.status !== 'absent' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40 text-xs bg-muted/20 p-2 rounded-xl">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                          Base Pay ({log.status})
                        </span>
                        <span className="font-semibold text-foreground">₹{log.base.toLocaleString()}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                          Overtime ({log.otHours}h)
                        </span>
                        <span className={log.otHours > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                          {log.otHours > 0 ? `+₹${log.otPay.toLocaleString()}` : '₹0'}
                        </span>
                      </div>

                      {isDriver && (
                        <div>
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold block">
                            Transit ({log.driverTrips.length} runs)
                          </span>
                          <span className={log.transitPay > 0 ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}>
                            {log.transitPay > 0 ? `+₹${log.transitPay.toLocaleString()}` : '₹0'}
                          </span>
                        </div>
                      )}

                      {isSupervisor && log.crewPay > 0 && (
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                            Crew ({log.crewCount} crew)
                          </span>
                          <span className="font-semibold text-foreground">
                            ₹{log.crewPay.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
                      <span>Rate: ₹{dailyBase}/d</span>
                      <span className="text-destructive font-semibold">Marked Absent — ₹0 earned</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Historical Payout Settlements & Slips */}
      <div className="space-y-3 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-heading font-bold text-sm text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" /> Past Payout Settlements & Slips
            </h4>
            <p className="text-xs text-muted-foreground">
              Official records of past salaries and crew disbursements received from admin.
            </p>
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-semibold">
            {myPaidRecords.length} Settlements
          </span>
        </div>

        {myPaidRecords.length === 0 ? (
          <div className="text-center py-8 bg-card rounded-2xl border border-border/50 text-xs text-muted-foreground">
            No past payout settlements recorded yet. Once office marks your salary paid, salary slips will be available here.
          </div>
        ) : (
          <div className="space-y-2.5">
            {myPaidRecords.map(record => (
              <Card
                key={record.id}
                className="p-3.5 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-foreground">{record.periodLabel}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> PAID
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase font-bold">
                      {record.paymentMode}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Paid on: <strong className="text-foreground">{record.paidAt}</strong></span>
                    <span>·</span>
                    <span>{record.daysWorked} Days worked</span>
                    {record.otHours > 0 && <span>· {record.otHours}h OT</span>}
                    {record.referenceNo && <span>· Ref: {record.referenceNo}</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      Amount Paid
                    </span>
                    <span className="text-base font-heading font-extrabold text-emerald-600 dark:text-emerald-400">
                      ₹{record.totalAmount.toLocaleString()}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadSlipPDF(record)}
                    className="h-8 rounded-xl text-xs font-semibold gap-1.5 border-border/60 hover:bg-muted"
                  >
                    <Printer className="w-3.5 h-3.5 text-primary" /> Salary Slip
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MySalaryTab;
