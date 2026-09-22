import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { format, addDays } from 'date-fns';
import {
  CalendarDays, Clock, Users, UserCircle, Truck, ChevronLeft, ChevronRight,
  Plus, Minus, AlertCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Staff, Attendance } from '@/types';

export const AttendanceTab = () => {
  const { staffList, attendances, materialRequests, saveAttendance, currentUser } = useApp();
  const { t } = useTranslation();
  const [view, setView] = useState<'daily' | 'history'>('daily');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [historyStaffId, setHistoryStaffId] = useState<string>('all');

  const getAdminEditProps = (existing?: Attendance) => {
    if (existing?.isSubmitted) {
      return {
        editedByAdmin: true,
        editedByAdminName: currentUser?.role === 'admin' ? 'Administrator' : 'Admin'
      };
    }
    return {};
  };

  const handleAttendanceChange = (staffId: string, updates: Partial<Attendance>) => {
    const existing = (attendances || []).find(a => a.staffId === staffId && a.date === date);
    saveAttendance({
      staffId,
      date,
      status: existing?.status || 'present',
      ...existing,
      ...updates,
      ...getAdminEditProps(existing)
    });
  };

  const handleUnnamedCountChange = (supervisorId: string, cat: 'painter' | 'plumber' | 'labour', val: number) => {
    const existing = (attendances || []).find(a => a.staffId === supervisorId && a.date === date);
    const presentCounts = {
      ...(existing?.presentCounts || { painter: 0, plumber: 0, labour: 0 }),
      [cat]: Math.max(0, val)
    };
    saveAttendance({
      staffId: supervisorId,
      date,
      status: existing?.status || 'present',
      ...existing,
      presentCounts,
      ...getAdminEditProps(existing)
    });
  };

  const handleUnnamedOtChange = (supervisorId: string, otHours: number) => {
    const existing = (attendances || []).find(a => a.staffId === supervisorId && a.date === date);
    saveAttendance({
      staffId: supervisorId,
      date,
      status: existing?.status || 'present',
      ...existing,
      unnamedOtHours: Math.max(0, otHours),
      ...getAdminEditProps(existing)
    });
  };

  const handleUnnamedOtStaffCountChange = (supervisorId: string, count: number) => {
    const existing = (attendances || []).find(a => a.staffId === supervisorId && a.date === date);
    saveAttendance({
      staffId: supervisorId,
      date,
      status: existing?.status || 'present',
      ...existing,
      unnamedOtStaffCount: Math.max(0, count),
      ...getAdminEditProps(existing)
    });
  };

  const calcSupervisorPay = (staff: Staff, att?: Attendance) => {
    if (!att || !att.status || att.status === 'absent') {
      return { base: 0, ot: 0, otHours: 0, otRate: 0, total: 0 };
    }
    const baseDaily =
      staff.salaryType === 'hourly' ? (staff.perHourSalary || 0) * 8 : staff.perDaySalary || 0;
    const base = att.status === 'half-day' ? baseDaily / 2 : baseDaily;
    const otHours = att.otHours || 0;
    const otRate = staff.incentivePerHour || 0;
    const ot = otHours * otRate;
    return { base, ot, otHours, otRate, total: base + ot };
  };

  const calcUnnamedPay = (staff: Staff, att?: Attendance) => {
    if (!att || staff.role !== 'supervisor' || !att.presentCounts) {
      return {
        count: 0,
        painters: 0,
        plumbers: 0,
        labour: 0,
        dailyRate: 0,
        regular: 0,
        otHours: 0,
        otStaffCount: 0,
        otRate: 0,
        ot: 0,
        total: 0
      };
    }
    const painters = att.presentCounts.painter || 0;
    const plumbers = att.presentCounts.plumber || 0;
    const labour = att.presentCounts.labour || 0;
    const count = painters + plumbers + labour;
    const dailyRate = staff.underLabourSalary || 0;
    const otRate = staff.underLabourOT || 0;
    const otHours = att.unnamedOtHours || 0;
    const otStaffCount =
      att.unnamedOtStaffCount !== undefined ? att.unnamedOtStaffCount : otHours > 0 ? count : 0;
    const regular = count * dailyRate;
    const ot = otStaffCount * otHours * otRate;
    return {
      count,
      painters,
      plumbers,
      labour,
      dailyRate,
      regular,
      otHours,
      otStaffCount,
      otRate,
      ot,
      total: regular + ot
    };
  };

  const calcDriverTransit = (driverId: string, logDate: string) => {
    const trips = (materialRequests || []).filter(
      r => r.driverId === driverId && r.date === logDate && r.status === 'completed'
    );
    const count = trips.length;
    const transitWages = trips.reduce((sum, r) => sum + (Number(r.driverWage) || 0), 0);
    return { trips, count, transitWages };
  };

  const dayStats = useMemo(() => {
    const dayAtts = (attendances || []).filter(a => a.date === date);
    let presentCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let totalSupervisorOT = 0;
    let totalUnnamedOT = 0;
    let totalWages = 0;

    staffList.forEach(s => {
      const att = dayAtts.find(a => a.staffId === s.id);
      if (att) {
        if (att.status === 'present') presentCount++;
        else if (att.status === 'half-day') halfDayCount++;
        else if (att.status === 'absent') absentCount++;

        if (att.status !== 'absent') {
          totalSupervisorOT += att.otHours || 0;
          const supPay = calcSupervisorPay(s, att);
          const unPay = calcUnnamedPay(s, att);
          totalUnnamedOT += unPay.otStaffCount * unPay.otHours;
          totalWages += supPay.total + unPay.total;
        }
      }
    });

    return {
      totalTracked: staffList.length,
      presentCount,
      halfDayCount,
      absentCount,
      totalSupervisorOT,
      totalUnnamedOT,
      totalWages
    };
  }, [attendances, staffList, date]);

  const handlePrevDay = () => {
    try {
      const cur = new Date(date + 'T00:00:00');
      setDate(format(addDays(cur, -1), 'yyyy-MM-dd'));
    } catch { }
  };
  const handleNextDay = () => {
    try {
      const cur = new Date(date + 'T00:00:00');
      setDate(format(addDays(cur, 1), 'yyyy-MM-dd'));
    } catch { }
  };
  const handleToday = () => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
  };

  if (view === 'history') {
    const historyLogs = attendances
      .filter(a => historyStaffId === 'all' || a.staffId === historyStaffId)
      .sort((a, b) => b.date.localeCompare(a.date));

    return (
      <div className="space-y-4 animate-slide-up">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <div>
            <h3 className="section-header !mb-0.5">Attendance History</h3>
            <p className="text-xs text-muted-foreground">
              Historical records of presence, supervisor overtime, and unnamed labour wages.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView('daily')}
            className="h-9 rounded-xl text-xs font-semibold gap-1.5"
          >
            <CalendarDays className="w-3.5 h-3.5 text-primary" /> Back to Daily View
          </Button>
        </div>

        <div className="flex gap-3 mb-4">
          <Select value={historyStaffId} onValueChange={setHistoryStaffId}>
            <SelectTrigger className="w-full sm:w-[280px] h-10 rounded-xl bg-card font-medium text-xs">
              <SelectValue placeholder="All Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff Members</SelectItem>
              {staffList.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {historyLogs.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
            <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-medium">No attendance records found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {historyLogs.map(log => {
              const staff = staffList.find(s => s.id === log.staffId);
              if (!staff) return null;
              const supPay = calcSupervisorPay(staff, log);
              const unPay = calcUnnamedPay(staff, log);
              const isDrv = staff.role === 'driver';
              const driverInfo = isDrv
                ? calcDriverTransit(staff.id, log.date)
                : { trips: [], count: 0, transitWages: 0 };
              const totalCombined = supPay.total + unPay.total + driverInfo.transitWages;
              const dailyRate =
                staff.salaryType === 'hourly' ? (staff.perHourSalary || 0) * 8 : staff.perDaySalary || 0;

              let formattedDate = log.date;
              try {
                formattedDate = format(new Date(log.date + 'T00:00:00'), 'dd MMM yyyy, EEEE');
              } catch { }

              return (
                <Card key={log.id} className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{staff.name}</span>
                        <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {staff.role}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                          Rate: ₹{dailyRate}{staff.salaryType === 'hourly' ? '/8h' : '/d'} · OT: ₹{staff.incentivePerHour || 0}/hr
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5 flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-primary" /> {formattedDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${log.status === 'present'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : log.status === 'half-day'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-destructive/15 text-destructive border border-destructive/30'
                          }`}
                      >
                        {log.status}
                      </span>
                      <div className="bg-primary/10 border border-primary/20 rounded-xl px-3 py-1 text-right">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold block tracking-wider">
                          Total Day Wage
                        </span>
                        <span className="text-sm font-heading font-bold text-primary">
                          ₹{totalCombined.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {log.status !== 'absent' ? (
                    <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40 space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center justify-between">
                          <span>Base Salary ({log.status})</span>
                          <span className="text-foreground font-semibold">₹{supPay.base.toLocaleString()}</span>
                        </p>
                        <div className="text-[11px] text-muted-foreground">
                          Rate: ₹{dailyRate}{staff.salaryType === 'hourly' ? '/8h' : '/d'}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40 space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center justify-between">
                          <span>Overtime Pay</span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            {supPay.otHours > 0 ? `+₹${supPay.ot.toLocaleString()}` : '₹0'}
                          </span>
                        </p>
                        <div className="text-[11px] text-muted-foreground">
                          {supPay.otHours > 0 ? `${supPay.otHours}h × ₹${supPay.otRate}/hr` : '0 hrs OT'}
                        </div>
                      </div>

                      {isDrv && (
                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                          <p className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300 tracking-wider flex items-center justify-between">
                            <span>Delivery Transit</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              +₹{driverInfo.transitWages.toLocaleString()}
                            </span>
                          </p>
                          <div className="text-[11px] text-muted-foreground">
                            {driverInfo.count} dispatch trip{driverInfo.count === 1 ? '' : 's'}
                          </div>
                        </div>
                      )}

                      {staff.role === 'supervisor' && unPay.count > 0 && (
                        <div className="col-span-full p-2.5 rounded-xl bg-muted/40 border border-border/40 space-y-1">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center justify-between">
                            <span>Unnamed Crew ({unPay.count} workers)</span>
                            <span className="text-foreground font-semibold">₹{unPay.total.toLocaleString()}</span>
                          </p>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Regular Wages</span>
                            <span>₹{unPay.regular.toLocaleString()}</span>
                          </div>
                          {unPay.ot > 0 && (
                            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 font-medium">
                              <span>
                                OT ({unPay.otStaffCount} staff · {unPay.otHours}h)
                              </span>
                              <span>+₹{unPay.ot.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pt-2 text-xs text-muted-foreground flex items-center justify-between">
                      <span>Configured Base: ₹{dailyRate}/day</span>
                      <span className="text-destructive font-semibold">Marked Absent — ₹0 wage</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Daily View
  return (
    <div className="space-y-4 animate-slide-up">
      {/* Date Header & Quick Jump Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/50 shadow-xs">
        <div>
          <h3 className="section-header !mb-0 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" /> {t('attendance.dailyAttendance')}
          </h3>
          <p className="text-xs text-muted-foreground">Track employee presence, daily wages, and overtime hours.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/50">
            <Button variant="ghost" size="icon" onClick={handlePrevDay} className="h-8 w-8 rounded-lg" title="Previous Day">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleToday} className="h-8 px-2 rounded-lg text-xs font-bold">
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNextDay} className="h-8 w-8 rounded-lg" title="Next Day">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-9 w-36 rounded-xl bg-card border-border/60 text-xs font-semibold shadow-xs"
          />

          <Button variant="outline" size="sm" onClick={() => setView('history')} className="h-9 rounded-xl text-xs font-semibold gap-1">
            <Clock className="w-3.5 h-3.5 text-primary" /> History
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Present / Half-Day</p>
          <p className="text-xl font-heading font-bold text-emerald-600 mt-1">
            {dayStats.presentCount}{' '}
            <span className="text-xs text-amber-500 font-medium">({dayStats.halfDayCount} half)</span>
          </p>
        </div>
        <div className="stat-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Absent Staff</p>
          <p className="text-xl font-heading font-bold text-destructive mt-1">{dayStats.absentCount}</p>
        </div>
        <div className="stat-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Supervisor OT</p>
          <p className="text-xl font-heading font-bold text-primary mt-1">{dayStats.totalSupervisorOT} hrs</p>
        </div>
        <div className="stat-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Daily Wages</p>
          <p className="text-xl font-heading font-bold text-foreground mt-1">₹{dayStats.totalWages.toLocaleString()}</p>
        </div>
      </div>

      {/* Attendance Cards */}
      <div className="space-y-3.5">
        {staffList.map(staff => {
          const att = (attendances || []).find(a => a.staffId === staff.id && a.date === date);
          const isSup = staff.role === 'supervisor';
          const supPay = calcSupervisorPay(staff, att);
          const unPay = calcUnnamedPay(staff, att);
          const totalPay = supPay.total + unPay.total;
          const isActive = att?.status === 'present' || att?.status === 'half-day';

          return (
            <Card key={staff.id} className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${staff.role === 'driver' ? 'bg-blue-600' : isSup ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                  >
                    {staff.role === 'driver' ? <Truck className="w-5 h-5" /> : <UserCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      {staff.name}
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {staff.role}
                      </span>
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Base: ₹{staff.perDaySalary || 0}/d · OT: ₹{staff.incentivePerHour || 0}/hr
                    </p>
                  </div>
                </div>

                {/* Status selector buttons */}
                <div className="inline-flex rounded-xl border border-border/60 p-1 bg-muted/40 gap-1 self-start sm:self-auto">
                  {[
                    { id: 'present' as const, label: 'Present', activeColor: 'bg-emerald-600 text-white shadow-xs' },
                    { id: 'half-day' as const, label: 'Half Day', activeColor: 'bg-amber-500 text-white shadow-xs' },
                    { id: 'absent' as const, label: 'Absent', activeColor: 'bg-destructive text-white shadow-xs' },
                  ].map(opt => {
                    const isCurrent = (att?.status || 'present') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleAttendanceChange(staff.id, { status: opt.id })}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${isCurrent ? opt.activeColor : 'text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isActive && (
                <div className="pt-3 border-t border-border/40 space-y-3">
                  {/* Supervisor / Staff OT Hours Input */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <div>
                      <Label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                        {isSup ? 'Supervisor OT (Hours)' : 'OT Hours'}
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="0"
                          value={att?.otHours?.toString() || ''}
                          onChange={e =>
                            handleAttendanceChange(staff.id, { otHours: Number(e.target.value) || 0 })
                          }
                          className="h-9 rounded-xl text-xs font-semibold w-28"
                        />
                        <span className="text-xs text-muted-foreground">hrs</span>
                      </div>
                    </div>

                    <div className="text-xs space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Wage Preview
                      </span>
                      <p className="text-foreground">
                        Base: <strong>₹{supPay.base.toLocaleString()}</strong> ({att?.status})
                      </p>
                      {supPay.otHours > 0 ? (
                        <p className="text-amber-600 dark:text-amber-400 font-semibold">
                          OT: {supPay.otHours}h × ₹{supPay.otRate} = +₹{supPay.ot.toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-[11px]">No OT logged</p>
                      )}
                    </div>

                    <div className="sm:text-right">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                        Total Day Pay
                      </span>
                      <span className="text-sm font-heading font-bold text-primary">
                        ₹{totalPay.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Supervisor's Unnamed Labour Force */}
                  {isSup && (
                    <div className="p-3 bg-muted/30 rounded-xl border border-border/40 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-amber-500" /> Unnamed Crew Under {staff.name}
                        </Label>
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                          {unPay.count} Workers Logged
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                        {/* Painters */}
                        <div className="bg-card p-2 rounded-lg border border-border/40">
                          <span className="text-[10px] font-bold text-muted-foreground block mb-1">Painters</span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleUnnamedCountChange(staff.id, 'painter', (unPay.painters || 0) - 1)}
                              className="h-7 w-7 rounded"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              value={unPay.painters || ''}
                              placeholder="0"
                              onChange={e => handleUnnamedCountChange(staff.id, 'painter', Number(e.target.value) || 0)}
                              className="h-7 text-center font-bold text-xs"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleUnnamedCountChange(staff.id, 'painter', (unPay.painters || 0) + 1)}
                              className="h-7 w-7 rounded"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Plumbers */}
                        <div className="bg-card p-2 rounded-lg border border-border/40">
                          <span className="text-[10px] font-bold text-muted-foreground block mb-1">Plumbers</span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleUnnamedCountChange(staff.id, 'plumber', (unPay.plumbers || 0) - 1)}
                              className="h-7 w-7 rounded"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              value={unPay.plumbers || ''}
                              placeholder="0"
                              onChange={e => handleUnnamedCountChange(staff.id, 'plumber', Number(e.target.value) || 0)}
                              className="h-7 text-center font-bold text-xs"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleUnnamedCountChange(staff.id, 'plumber', (unPay.plumbers || 0) + 1)}
                              className="h-7 w-7 rounded"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Labourers */}
                        <div className="bg-card p-2 rounded-lg border border-border/40">
                          <span className="text-[10px] font-bold text-muted-foreground block mb-1">Labourers</span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleUnnamedCountChange(staff.id, 'labour', (unPay.labour || 0) - 1)}
                              className="h-7 w-7 rounded"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              value={unPay.labour || ''}
                              placeholder="0"
                              onChange={e => handleUnnamedCountChange(staff.id, 'labour', Number(e.target.value) || 0)}
                              className="h-7 text-center font-bold text-xs"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleUnnamedCountChange(staff.id, 'labour', (unPay.labour || 0) + 1)}
                              className="h-7 w-7 rounded"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Unnamed OT Staff Count */}
                        <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/25">
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 block mb-1">
                            OT Staff Count
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleUnnamedOtStaffCountChange(staff.id, (unPay.otStaffCount || 0) - 1)}
                              className="h-7 w-7 rounded"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              value={unPay.otStaffCount || ''}
                              placeholder="0"
                              onChange={e => handleUnnamedOtStaffCountChange(staff.id, Number(e.target.value) || 0)}
                              className="h-7 text-center font-bold text-xs"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleUnnamedOtStaffCountChange(staff.id, (unPay.otStaffCount || 0) + 1)}
                              className="h-7 w-7 rounded"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Unnamed OT Hours */}
                        <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/25">
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 block mb-1">
                            OT Hours
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleUnnamedOtChange(staff.id, (unPay.otHours || 0) - 1)}
                              className="h-7 w-7 rounded"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={unPay.otHours || ''}
                              placeholder="0"
                              onChange={e => handleUnnamedOtChange(staff.id, Number(e.target.value) || 0)}
                              className="h-7 text-center font-bold text-xs"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleUnnamedOtChange(staff.id, (unPay.otHours || 0) + 1)}
                              className="h-7 w-7 rounded"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {unPay.count > 0 && (
                        <div className="flex justify-between items-center text-xs pt-1 border-t border-border/40 text-muted-foreground">
                          <span>
                            Regular: ₹{unPay.regular.toLocaleString()}
                            {unPay.ot > 0 && (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold ml-2">
                                + OT: ₹{unPay.ot.toLocaleString()} ({unPay.otStaffCount} staff · {unPay.otHours}h)
                              </span>
                            )}
                          </span>
                          <span className="font-bold text-foreground">
                            Crew Pay: ₹{unPay.total.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AttendanceTab;
