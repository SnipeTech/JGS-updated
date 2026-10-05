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
  Plus, Minus, AlertCircle, MapPin, CheckCircle2, Receipt, Search, ArrowRight, IndianRupee,
  PenLine, Lock, Unlock
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Staff, Attendance } from '@/types';
import { getLabourTypeMeta } from '@/pages/Staff/StaffAttendanceTab';

export const AttendanceTab = () => {
  const { staffList, attendances, materialRequests, saveAttendance, currentUser, sites, dailyLogs, vehicles, labourTypes } = useApp();
  const { t } = useTranslation();
  const [view, setView] = useState<'daily' | 'history'>('daily');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [historyStaffId, setHistoryStaffId] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'driver' | 'supervisor' | 'worker'>('all');
  const [staffSearch, setStaffSearch] = useState('');
  const [editingStaffIds, setEditingStaffIds] = useState<Set<string>>(new Set());

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

  const isDayFullySubmitted = useMemo(() => {
    const activeStaff = staffList.filter(s => s.role !== 'admin');
    if (activeStaff.length === 0) return false;
    const dayAtts = (attendances || []).filter(a => a.date === date);
    return activeStaff.every(s => {
      const att = dayAtts.find(a => a.staffId === s.id);
      return !!att?.isSubmitted;
    });
  }, [staffList, attendances, date]);

  const handleSubmitDay = () => {
    const activeStaff = staffList.filter(s => s.role !== 'admin');
    activeStaff.forEach(s => {
      const existing = (attendances || []).find(a => a.staffId === s.id && a.date === date);
      saveAttendance({
        staffId: s.id,
        date,
        status: existing?.status || 'present',
        ...existing,
        isSubmitted: true,
        ...getAdminEditProps(existing)
      });
    });
    setEditingStaffIds(new Set());
    toast.success(`Attendance for ${format(new Date(date + 'T00:00:00'), 'dd MMM yyyy')} submitted successfully by Admin!`);
  };

  const handleUnlockDay = () => {
    const activeStaff = staffList.filter(s => s.role !== 'admin');
    activeStaff.forEach(s => {
      const existing = (attendances || []).find(a => a.staffId === s.id && a.date === date);
      if (existing) {
        saveAttendance({
          ...existing,
          isSubmitted: false
        });
      }
    });
    toast.info(`Day attendance unlocked for editing.`);
  };

  const handleSubmitStaff = (staffId: string) => {
    const existing = (attendances || []).find(a => a.staffId === staffId && a.date === date);
    saveAttendance({
      staffId,
      date,
      status: existing?.status || 'present',
      ...existing,
      isSubmitted: true,
      ...getAdminEditProps(existing)
    });
    setEditingStaffIds(prev => {
      const next = new Set(prev);
      next.delete(staffId);
      return next;
    });
    const staffName = staffList.find(s => s.id === staffId)?.name || 'Staff';
    toast.success(`Attendance for ${staffName} submitted!`);
  };

  const effectiveLabourTypes = useMemo(() => {
    if (labourTypes && labourTypes.length > 0) return labourTypes;
    return ['painter', 'plumber', 'labour'];
  }, [labourTypes]);

  const handleUnnamedCountChange = (supervisorId: string, cat: string, val: number) => {
    const existing = (attendances || []).find(a => a.staffId === supervisorId && a.date === date);
    const presentCounts = {
      ...(existing?.presentCounts || {}),
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

  const handleUnnamedHalfDayCountChange = (supervisorId: string, cat: string, val: number) => {
    const existing = (attendances || []).find(a => a.staffId === supervisorId && a.date === date);
    const halfDayCounts = {
      ...(existing?.halfDayCounts || {}),
      [cat]: Math.max(0, val)
    };
    saveAttendance({
      staffId: supervisorId,
      date,
      status: existing?.status || 'present',
      ...existing,
      halfDayCounts,
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
    if (!att || staff.role !== 'supervisor' || (!att.presentCounts && !att.halfDayCounts)) {
      return {
        count: 0,
        fullCount: 0,
        halfCount: 0,
        manDays: 0,
        counts: {} as Record<string, number>,
        halfDayCounts: {} as Record<string, number>,
        dailyRate: 0,
        regular: 0,
        otHours: 0,
        otStaffCount: 0,
        otRate: 0,
        ot: 0,
        total: 0
      };
    }
    const counts = att.presentCounts || {};
    const halfDayCounts = att.halfDayCounts || {};
    const fullCount = Object.values(counts).reduce((s, v) => s + (Number(v) || 0), 0);
    const halfCount = Object.values(halfDayCounts).reduce((s, v) => s + (Number(v) || 0), 0);
    const count = fullCount + halfCount;
    const manDays = fullCount + (halfCount * 0.5);

    const dailyRate = staff.underLabourSalary || 0;
    const halfDayRate = dailyRate / 2;
    const otRate = staff.underLabourOT || 0;
    const otHours = att.unnamedOtHours || 0;
    const otStaffCount =
      att.unnamedOtStaffCount !== undefined ? att.unnamedOtStaffCount : otHours > 0 ? count : 0;
    const regular = (fullCount * dailyRate) + (halfCount * halfDayRate);
    const ot = otStaffCount * otHours * otRate;
    return {
      count,
      fullCount,
      halfCount,
      manDays,
      counts,
      halfDayCounts,
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
    const staff = staffList.find(s => s.id === driverId);
    const trips = (materialRequests || []).filter(
      r => (r.driverId === driverId || (staff && r.driverName?.toLowerCase() === staff.name.toLowerCase())) &&
        r.date === logDate
    );
    const completedTrips = trips.filter(r => r.status === 'completed');
    const count = trips.length;
    const transitWages = completedTrips.reduce((sum, r) => sum + (Number(r.driverWage) || 0), 0);
    return { trips, count, completedTrips, transitWages };
  };

  const dayStats = useMemo(() => {
    const dayAtts = (attendances || []).filter(a => a.date === date);
    let presentCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let totalSupervisorOT = 0;
    let totalUnnamedOT = 0;
    let totalWages = 0;
    let totalDriverTrips = 0;
    let totalDriverTransitWages = 0;

    staffList.forEach(s => {
      const att = dayAtts.find(a => a.staffId === s.id);
      const drvInfo = calcDriverTransit(s.id, date);
      totalDriverTrips += drvInfo.count;
      totalDriverTransitWages += drvInfo.transitWages;

      if (att) {
        if (att.status === 'present') presentCount++;
        else if (att.status === 'half-day') halfDayCount++;
        else if (att.status === 'absent') absentCount++;

        if (att.status !== 'absent') {
          totalSupervisorOT += att.otHours || 0;
          const supPay = calcSupervisorPay(s, att);
          const unPay = calcUnnamedPay(s, att);
          totalUnnamedOT += unPay.otStaffCount * unPay.otHours;
          totalWages += supPay.total + unPay.total + drvInfo.transitWages;
        }
      } else if (drvInfo.transitWages > 0) {
        totalWages += drvInfo.transitWages;
      }
    });

    return {
      totalTracked: staffList.length,
      presentCount,
      halfDayCount,
      absentCount,
      totalSupervisorOT,
      totalUnnamedOT,
      totalDriverTrips,
      totalDriverTransitWages,
      totalWages
    };
  }, [attendances, staffList, materialRequests, date]);

  // Role counts
  const roleCounts = useMemo(() => {
    let drivers = 0;
    let supervisors = 0;
    let workers = 0;

    staffList.forEach(s => {
      if (s.role === 'admin') return;
      if (s.role === 'driver') drivers++;
      else if (s.role === 'supervisor') supervisors++;
      else workers++;
    });

    return { all: staffList.filter(s => s.role !== 'admin').length, drivers, supervisors, workers };
  }, [staffList]);

  const filteredStaffList = useMemo(() => {
    return staffList.filter(s => {
      if (s.role === 'admin') return false;

      const isDriver = s.role === 'driver';
      const isSupervisor = s.role === 'supervisor';
      const isWorker = !isDriver && !isSupervisor;

      if (roleFilter === 'driver' && !isDriver) return false;
      if (roleFilter === 'supervisor' && !isSupervisor) return false;
      if (roleFilter === 'worker' && !isWorker) return false;

      if (staffSearch.trim()) {
        const q = staffSearch.toLowerCase();
        const matches = s.name.toLowerCase().includes(q) || (s.role || '').toLowerCase().includes(q) || (s.phone || '').includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [staffList, roleFilter, staffSearch]);

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
                      {(() => {
                        const histSite = sites.find(s => s.id === log.siteId);
                        const histLog = (dailyLogs || []).find(l => l.staffId === staff.id && l.date === log.date);
                        const sName = histSite?.name || histLog?.siteName;
                        if (!sName && !histLog?.workLevelStage) return null;
                        return (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                            {sName && (
                              <span className="font-semibold text-foreground flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md">
                                <MapPin className="w-3 h-3 text-primary" /> {sName}
                              </span>
                            )}
                            {histLog?.workLevelStage && (
                              <span className="font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                {histLog.workLevelStage}
                              </span>
                            )}
                          </div>
                        );
                      })()}
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

          {/* Admin Submit Day Attendance Button */}
          {isDayFullySubmitted ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Submitted
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnlockDay}
                className="h-9 rounded-xl text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
                title="Unlock day attendance for modification"
              >
                <Unlock className="w-3.5 h-3.5" /> Reopen
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmitDay}
              className="h-9 px-3.5 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" /> Submit Attendance
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Driver Trips & Wages</p>
          <p className="text-xl font-heading font-bold text-blue-600 mt-1">
            {dayStats.totalDriverTrips}{' '}
            <span className="text-xs text-muted-foreground font-semibold">(+₹{dayStats.totalDriverTransitWages.toLocaleString()})</span>
          </p>
        </div>
        <div className="stat-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Supervisor OT</p>
          <p className="text-xl font-heading font-bold text-primary mt-1">{dayStats.totalSupervisorOT} hrs</p>
        </div>
        <div className="stat-card p-3 col-span-2 sm:col-span-1">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Daily Wages</p>
          <p className="text-xl font-heading font-bold text-foreground mt-1">₹{dayStats.totalWages.toLocaleString()}</p>
        </div>
      </div>

      {/* Role Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/50 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/50 w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all' as const, label: `All Staff (${roleCounts.all})`, icon: <Users className="w-3.5 h-3.5" /> },
            { id: 'driver' as const, label: `Drivers (${roleCounts.drivers})`, icon: <Truck className="w-3.5 h-3.5 text-blue-500" /> },
            { id: 'supervisor' as const, label: `Supervisors (${roleCounts.supervisors})`, icon: <UserCircle className="w-3.5 h-3.5 text-primary" /> },
            { id: 'worker' as const, label: `Workers (${roleCounts.workers})`, icon: <Users className="w-3.5 h-3.5 text-amber-500" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setRoleFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                roleFilter === tab.id
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search staff by name, phone..."
            value={staffSearch}
            onChange={e => setStaffSearch(e.target.value)}
            className="pl-8 h-9 rounded-xl text-xs bg-muted/20 border-border/50"
          />
        </div>
      </div>

      {/* Attendance Cards */}
      <div className="space-y-3.5">
        {filteredStaffList.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-semibold">
              No staff members found matching "{roleFilter}" filter.
            </p>
          </div>
        ) : (
          filteredStaffList.map(staff => {
          const att = (attendances || []).find(a => a.staffId === staff.id && a.date === date);
          const isSup = staff.role === 'supervisor';
          const drvInfo = calcDriverTransit(staff.id, date);
          const isDriverRole = staff.role === 'driver';
          const hasDrivingTrips = drvInfo.count > 0;
          const assignedVeh = vehicles.find(v => v.assignedDriverId === staff.id || (drvInfo.trips[0] && (v.name === drvInfo.trips[0].vehicle || v.number === drvInfo.trips[0].vehicleNumber)));

          const supPay = calcSupervisorPay(staff, att);
          const unPay = calcUnnamedPay(staff, att);
          const totalPay = supPay.total + unPay.total + drvInfo.transitWages;
          const isActive = att?.status === 'present' || att?.status === 'half-day';

          const isSupervisorEntered = isSup && !!att && (
            !!att.isSubmitted ||
            !!att.siteId ||
            (att.expenseAmount || 0) > 0 ||
            (att.presentCounts && Object.values(att.presentCounts).some(v => (v || 0) > 0)) ||
            (att.halfDayCounts && Object.values(att.halfDayCounts).some(v => (v || 0) > 0))
          );
          const isEditing = editingStaffIds.has(staff.id);

          return (
            <Card key={staff.id} className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${isDriverRole ? 'bg-blue-600' : isSup ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                  >
                    {isDriverRole ? <Truck className="w-5 h-5" /> : <UserCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                      {staff.name}
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {staff.role}
                      </span>
                      {hasDrivingTrips && staff.role !== 'driver' && (
                        <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                          <Truck className="w-3 h-3" /> Drove Today
                        </span>
                      )}
                      {assignedVeh && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          {assignedVeh.name} ({assignedVeh.number})
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Base: ₹{staff.perDaySalary || 0}/d · OT: ₹{staff.incentivePerHour || 0}/hr
                      {isDriverRole && staff.customerHourlyRate ? ` · Transit Rate: ₹${staff.customerHourlyRate}/hr` : ''}
                    </p>
                  </div>
                </div>

                {/* Status selector or Supervisor Read-Only + Edit button */}
                {isSupervisorEntered && !isEditing ? (
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <span
                      className={`px-3 py-1 text-xs font-bold rounded-xl border uppercase tracking-wider flex items-center gap-1.5 shadow-2xs ${
                        att.status === 'present'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : att.status === 'half-day'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-destructive/15 text-destructive border-destructive/30'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        att.status === 'present' ? 'bg-emerald-500' : att.status === 'half-day' ? 'bg-amber-500' : 'bg-destructive'
                      }`} />
                      {att.status === 'half-day' ? 'Half Day' : att.status}
                    </span>

                    {att.isSubmitted && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Submitted
                      </span>
                    )}

                    {att.editedByAdmin && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center gap-1">
                        <PenLine className="w-3 h-3" /> Admin Edited
                      </span>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingStaffIds(prev => new Set(prev).add(staff.id))}
                      className="h-8 rounded-xl text-xs font-bold gap-1.5 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary shadow-2xs"
                    >
                      <PenLine className="w-3.5 h-3.5" /> Edit Attendance
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                    <div className="inline-flex rounded-xl border border-border/60 p-1 bg-muted/40 gap-1">
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

                    {!att?.isSubmitted && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSubmitStaff(staff.id)}
                        className="h-8 px-3 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                        title="Submit attendance for this staff member"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Submit
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Driver Active Dispatches Banner */}
              {drvInfo.count > 0 && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="text-xs">
                      <span className="font-bold text-blue-900 dark:text-blue-300">
                        Active Driver on {date}: {drvInfo.count} Material Delivery Trip{drvInfo.count === 1 ? '' : 's'} Logged
                      </span>
                      <span className="text-muted-foreground ml-2">
                        ({drvInfo.completedTrips.length} completed · +₹{drvInfo.transitWages.toLocaleString()} transit wages)
                      </span>
                    </div>
                  </div>
                  {att?.status === 'absent' && (
                    <Button
                      size="sm"
                      onClick={() => handleAttendanceChange(staff.id, { status: 'present' })}
                      className="h-7 px-3 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
                    >
                      Mark Present (Trips Detected)
                    </Button>
                  )}
                </div>
              )}

              {isActive && (
                <div className="pt-3 border-t border-border/40 space-y-3">
                  {/* 1. Driver Delivery Trips & Vehicle Section */}
                  {(isDriverRole || hasDrivingTrips) && (
                    <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-blue-600" /> Driver Delivery Trips ({drvInfo.count})
                        </span>
                        {assignedVeh && (
                          <span className="text-[11px] text-muted-foreground">
                            Assigned Fleet Vehicle: <strong className="text-foreground">{assignedVeh.name} ({assignedVeh.number})</strong>
                          </span>
                        )}
                      </div>

                      {drvInfo.trips.length === 0 ? (
                        <div className="p-2.5 rounded-lg bg-card border border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
                          <span>No material delivery dispatches logged on {date}</span>
                          {assignedVeh && <span className="font-semibold text-foreground">{assignedVeh.name}</span>}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {drvInfo.trips.map((trip, tIdx) => {
                            const matSummary = (trip.items || []).map(i => `${i.name || i.materialName} (${i.quantity} ${i.unit || ''})`).join(', ');
                            return (
                              <div key={trip.id || tIdx} className="p-2.5 rounded-lg bg-card border border-blue-500/20 text-xs space-y-1.5 shadow-2xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-foreground">Trip #{tIdx + 1}:</span>
                                    <span className="font-mono font-bold text-primary px-2 py-0.5 rounded bg-muted text-[11px] border border-border/50">
                                      {trip.vehicle || 'Company Vehicle'} {trip.vehicleNumber && `(${trip.vehicleNumber})`}
                                    </span>
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      Route: <strong>{trip.supplierName ? `Supplier: ${trip.supplierName}` : trip.sourceSiteName ? `Site: ${trip.sourceSiteName}` : 'Warehouse Depot'}</strong>
                                      <ArrowRight className="w-3 h-3 text-primary" />
                                      <strong className="text-foreground">{trip.siteName}</strong>
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                      trip.status === 'completed'
                                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                        : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                                    }`}>
                                      {trip.status}
                                    </span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                                      +₹{(Number(trip.driverWage) || 0).toLocaleString()}
                                    </span>
                                  </div>
                                </div>

                                {trip.duration && (
                                  <div className="text-[11px] text-muted-foreground">
                                    Transit Duration: <strong>{trip.duration}</strong> ({trip.startTime || 'Start'} → {trip.endTime || trip.completionTime || 'Delivered'})
                                    {trip.petrolCharge && <span className="ml-3 text-amber-600 font-semibold">Petrol: ₹{trip.petrolCharge}</span>}
                                  </div>
                                )}

                                {matSummary && (
                                  <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                                    <span className="font-semibold text-foreground mr-1">Materials Transported:</span>
                                    {matSummary}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Live Work Tracking, Assigned Site, Level & Expenses (for Supervisors/Staff) */}
                  {isSup && (() => {
                    const staffDailyLogs = (dailyLogs || []).filter(l => l.staffId === staff.id && l.date === date);
                    const assignedSite = sites.find(s => s.id === att?.siteId);

                    if (isSupervisorEntered && !isEditing) {
                      // Locked Supervisor View for Admin (shows edit button only above)
                      return (
                        <div className="space-y-3">
                          {/* Locked Banner */}
                          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="font-semibold text-foreground">
                                Supervisor Attendance Locked ({staff.name})
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Click "Edit Attendance" above to modify site, expenses, or crew counts.
                              </span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingStaffIds(prev => new Set(prev).add(staff.id))}
                              className="h-7 text-xs font-bold gap-1 text-primary hover:text-primary border-primary/30"
                            >
                              <PenLine className="w-3 h-3" /> Edit Attendance
                            </Button>
                          </div>

                          {/* Read-Only Site & Expenses */}
                          <div className="p-3 rounded-xl bg-card border border-border/40 space-y-2 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-primary" /> Working Site:
                                </span>
                                <span className="font-bold text-foreground bg-muted/50 px-2.5 py-0.5 rounded-lg border border-border/40">
                                  {assignedSite?.name || att?.siteName || 'No site assigned'}
                                </span>
                              </div>
                              {att?.isSubmitted && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Submitted by Staff
                                </span>
                              )}
                            </div>

                            {((att?.expenseAmount || 0) > 0 || att?.expenseNotes) ? (
                              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30 text-xs">
                                <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                  <IndianRupee className="w-3 h-3 text-amber-500" /> Site Daily Expense:
                                </span>
                                <span className="font-bold text-amber-600 dark:text-amber-400">
                                  ₹{(att?.expenseAmount || 0).toLocaleString()}
                                </span>
                                {att?.expenseNotes && (
                                  <span className="text-muted-foreground italic">({att.expenseNotes})</span>
                                )}
                                {att?.siteId && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                                    ✓ Saved on site
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/30 italic">
                                No site daily expenses logged.
                              </div>
                            )}
                          </div>

                          {/* Daily logs if any */}
                          {staffDailyLogs.map((staffDailyLog, logIdx) => {
                            const siteObj = sites.find(s => s.id === staffDailyLog.siteId);
                            const siteName = siteObj?.name || staffDailyLog.siteName || assignedSite?.name;
                            const stageName = staffDailyLog.workLevelStage;
                            const miscExpenses = (staffDailyLog.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
                            const transport = staffDailyLog.transportCost || 0;
                            const totalDayExpenses = miscExpenses + transport;

                            return (
                              <div key={staffDailyLog.id || logIdx} className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1.5 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                      Site Log #{logIdx + 1}:
                                    </span>
                                    <span className="font-bold text-foreground">{siteName || 'Unlisted'}</span>
                                    {stageName && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                        {stageName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {staffDailyLog.notes && (
                                  <div className="text-[11px] text-muted-foreground">
                                    {staffDailyLog.notes}
                                  </div>
                                )}
                                {totalDayExpenses > 0 && (
                                  <div className="text-[11px] text-amber-600 font-semibold pt-1 border-t border-border/20">
                                    Site incidental: ₹{totalDayExpenses.toLocaleString()}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Read-Only Wage & Supervisor OT Preview */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center p-3 rounded-xl bg-card border border-border/40 text-xs">
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                                Supervisor OT
                              </span>
                              <span className="text-xs font-bold text-foreground">
                                {att?.otHours ? `${att.otHours} hrs` : '0 hrs'}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                Wage Breakdown
                              </span>
                              <p className="text-foreground">
                                Base: <strong>₹{supPay.base.toLocaleString()}</strong> ({att?.status})
                              </p>
                              {supPay.otHours > 0 && (
                                <p className="text-amber-600 dark:text-amber-400 font-semibold">
                                  OT: {supPay.otHours}h × ₹{supPay.otRate} = +₹{supPay.ot.toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div className="sm:text-right">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                                Total Supervisor Pay
                              </span>
                              <span className="text-sm font-heading font-bold text-primary">
                                ₹{totalPay.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Read-Only Unnamed Labour Crew */}
                          <div className="p-3 bg-card rounded-xl border border-border/40 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-amber-500" /> Unnamed Crew Under {staff.name}
                              </Label>
                              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                {unPay.fullCount} Full · {unPay.halfCount} Half ({unPay.manDays} Man-Days)
                              </span>
                            </div>

                            {unPay.count === 0 ? (
                              <p className="text-xs text-muted-foreground italic py-1">
                                No unnamed crew logged by supervisor for this date.
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                                {effectiveLabourTypes.map(type => {
                                  const countVal = (att?.presentCounts && att.presentCounts[type]) || 0;
                                  const halfVal = (att?.halfDayCounts && att.halfDayCounts[type]) || 0;
                                  if (countVal === 0 && halfVal === 0) return null;
                                  const meta = getLabourTypeMeta(type);
                                  const typeManDays = countVal + (halfVal * 0.5);

                                  return (
                                    <div key={type} className="bg-muted/30 p-2.5 rounded-xl border border-border/40 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-muted-foreground truncate">
                                          {meta.icon} {meta.label}
                                        </span>
                                        <span className="text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                                          {typeManDays}d
                                        </span>
                                      </div>
                                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                        <span>{countVal} Full</span>
                                        {halfVal > 0 && (
                                          <span className="text-amber-600 dark:text-amber-400">· {halfVal} Half</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

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
                        </div>
                      );
                    }

                    // Editable Mode (either supervisor didn't enter or Admin clicked Edit Attendance)
                    return (
                      <div className="space-y-3">
                        {/* Admin Editing Active Banner */}
                        {isEditing && (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <PenLine className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                              <div>
                                <span className="font-bold text-foreground">Editing Supervisor Attendance</span>
                                <p className="text-[11px] text-muted-foreground">
                                  Modifying supervisor submission for {staff.name}. Click Save & Lock when finished.
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingStaffIds(prev => {
                                    const next = new Set(prev);
                                    next.delete(staff.id);
                                    return next;
                                  });
                                }}
                                className="h-7 text-xs rounded-lg"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  handleAttendanceChange(staff.id, { editedByAdmin: true });
                                  setEditingStaffIds(prev => {
                                    const next = new Set(prev);
                                    next.delete(staff.id);
                                    return next;
                                  });
                                  toast.success(`Saved and locked attendance for ${staff.name}`);
                                }}
                                className="h-7 text-xs font-semibold rounded-lg"
                              >
                                Save Changes & Lock
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  handleAttendanceChange(staff.id, { isSubmitted: true, editedByAdmin: true });
                                  setEditingStaffIds(prev => {
                                    const next = new Set(prev);
                                    next.delete(staff.id);
                                    return next;
                                  });
                                  toast.success(`Saved and submitted attendance for ${staff.name}`);
                                }}
                                className="h-7 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-2xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Save & Submit Attendance
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* 1. Working Site Selection & Site Daily Expense */}
                        <div className="p-3 rounded-xl bg-muted/25 border border-border/40 space-y-2.5 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[240px]">
                              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-primary" /> Working Site:
                              </span>
                              <Select
                                value={att?.siteId || ''}
                                onValueChange={v => {
                                  const chosen = sites.find(s => s.id === v);
                                  handleAttendanceChange(staff.id, { siteId: v, siteName: chosen?.name || '' });
                                }}
                              >
                                <SelectTrigger className="h-8 rounded-lg text-xs bg-card border-border/60 min-w-[200px]">
                                  <SelectValue placeholder="Select working site..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {sites.filter(s => s.status !== 'completed').map(s => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.name} {s.clientName ? `(${s.clientName})` : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {att?.isSubmitted && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Submitted by Staff
                              </span>
                            )}
                          </div>

                          {/* Site Daily Expense */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
                            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <IndianRupee className="w-3 h-3 text-amber-500" /> Site Daily Expense:
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground font-bold">₹</span>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={att?.expenseAmount !== undefined && att?.expenseAmount !== 0 ? att.expenseAmount : ''}
                                onChange={e => handleAttendanceChange(staff.id, { expenseAmount: Number(e.target.value) || 0 })}
                                className="h-8 w-24 text-xs font-bold rounded-lg bg-card"
                              />
                            </div>
                            <Input
                              placeholder="Expense purpose (e.g. Travel, Materials, Refreshment)"
                              value={att?.expenseNotes || ''}
                              onChange={e => handleAttendanceChange(staff.id, { expenseNotes: e.target.value })}
                              className="h-8 text-xs rounded-lg bg-card flex-1 min-w-[180px]"
                            />
                            {att?.expenseAmount && att.expenseAmount > 0 && att?.siteId && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                                ✓ Saved on {sites.find(s => s.id === att.siteId)?.name || 'site'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Supervisor OT Hours Input & Wage Preview */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                          <div>
                            <Label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                              Supervisor OT (Hours)
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
                            {supPay.otHours > 0 && (
                              <p className="text-amber-600 dark:text-amber-400 font-semibold">
                                OT: {supPay.otHours}h × ₹{supPay.otRate} = +₹{supPay.ot.toLocaleString()}
                              </p>
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

                        {/* Supervisor's Unnamed Labour Force with Full Day and Half Day */}
                        <div className="p-3 bg-muted/30 rounded-xl border border-border/40 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div>
                              <Label className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-amber-500" /> Unnamed Crew Under {staff.name}
                              </Label>
                              <span className="text-[11px] text-muted-foreground">
                                Set Full Day and Half Day count for each labour type.
                              </span>
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 self-start sm:self-auto">
                              {unPay.fullCount} Full · {unPay.halfCount} Half ({unPay.manDays} Man-Days)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 text-xs">
                            {/* Dynamic Labour Types with Full Day and Half Day rows */}
                            {effectiveLabourTypes.map(type => {
                              const meta = getLabourTypeMeta(type);
                              const countVal = (att?.presentCounts && att.presentCounts[type]) || 0;
                              const halfVal = (att?.halfDayCounts && att.halfDayCounts[type]) || 0;
                              const typeManDays = countVal + (halfVal * 0.5);

                              return (
                                <div key={type} className="bg-card p-2.5 rounded-xl border border-border/50 space-y-2 shadow-2xs">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-bold text-foreground block truncate">
                                      {meta.icon} {meta.label}
                                    </span>
                                    {(countVal > 0 || halfVal > 0) && (
                                      <span className="text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                                        {typeManDays}d
                                      </span>
                                    )}
                                  </div>

                                  {/* Full Day Row */}
                                  <div className="space-y-0.5">
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                                      <span>Full Day</span>
                                      <span className="font-bold text-foreground">{countVal}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleUnnamedCountChange(staff.id, type, countVal - 1)}
                                        className="h-7 w-7 rounded-lg shrink-0"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </Button>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={countVal || ''}
                                        placeholder="0"
                                        onChange={e => handleUnnamedCountChange(staff.id, type, Number(e.target.value) || 0)}
                                        className="h-7 text-center font-bold text-xs rounded-lg bg-card"
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleUnnamedCountChange(staff.id, type, countVal + 1)}
                                        className="h-7 w-7 rounded-lg shrink-0"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Half Day Row */}
                                  <div className="space-y-0.5 pt-1.5 border-t border-border/30">
                                    <div className="flex items-center justify-between text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                                      <span>Half Day (½)</span>
                                      <span className="font-bold">{halfVal}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleUnnamedHalfDayCountChange(staff.id, type, halfVal - 1)}
                                        className="h-7 w-7 rounded-lg shrink-0"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </Button>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={halfVal || ''}
                                        placeholder="0"
                                        onChange={e => handleUnnamedHalfDayCountChange(staff.id, type, Number(e.target.value) || 0)}
                                        className="h-7 text-center font-bold text-xs rounded-lg text-amber-700 dark:text-amber-300 bg-card"
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleUnnamedHalfDayCountChange(staff.id, type, halfVal + 1)}
                                        className="h-7 w-7 rounded-lg shrink-0"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* OT Staff Count & OT Hours */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-border/30">
                            <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/25">
                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 block mb-1">
                                Crew OT Staff Count
                              </span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleUnnamedOtStaffCountChange(staff.id, (unPay.otStaffCount || 0) - 1)}
                                  className="h-7 w-7 rounded-lg"
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  value={unPay.otStaffCount || ''}
                                  placeholder="0"
                                  onChange={e => handleUnnamedOtStaffCountChange(staff.id, Number(e.target.value) || 0)}
                                  className="h-7 text-center font-bold text-xs rounded-lg bg-card"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleUnnamedOtStaffCountChange(staff.id, (unPay.otStaffCount || 0) + 1)}
                                  className="h-7 w-7 rounded-lg"
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>

                            <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/25">
                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 block mb-1">
                                Crew OT Hours
                              </span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleUnnamedOtChange(staff.id, (unPay.otHours || 0) - 1)}
                                  className="h-7 w-7 rounded-lg"
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
                                  className="h-7 text-center font-bold text-xs rounded-lg bg-card"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleUnnamedOtChange(staff.id, (unPay.otHours || 0) + 1)}
                                  className="h-7 w-7 rounded-lg"
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
                      </div>
                    );
                  })()}

                  {/* Non-Supervisor Staff OT Hours Input */}
                  {!isSup && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      <div>
                        <Label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                          OT Hours
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
                        {supPay.otHours > 0 && (
                          <p className="text-amber-600 dark:text-amber-400 font-semibold">
                            OT: {supPay.otHours}h × ₹{supPay.otRate} = +₹{supPay.ot.toLocaleString()}
                          </p>
                        )}
                        {drvInfo.transitWages > 0 && (
                          <p className="text-blue-600 dark:text-blue-400 font-semibold">
                            Transit Wages: +₹{drvInfo.transitWages.toLocaleString()} ({drvInfo.completedTrips.length} trips)
                          </p>
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
                  )}
                </div>
              )}
            </Card>
          );
        }))}
      </div>
    </div>
  );
};

export default AttendanceTab;
