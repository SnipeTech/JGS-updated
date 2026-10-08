import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import {
  CalendarDays, Clock, Users, UserCircle, Truck, ChevronLeft, ChevronRight,
  Plus, Minus, AlertCircle, Trash2, MapPin, CheckCircle2, IndianRupee, Search, Send, Lock
} from 'lucide-react';
import { Staff } from '@/types';

export const getLabourTypeMeta = (type: string) => {
  const lower = type.toLowerCase();
  let icon = '👷';
  if (lower.includes('paint')) icon = '🎨';
  else if (lower.includes('plumb')) icon = '🔧';
  else if (lower.includes('elect')) icon = '⚡';
  else if (lower.includes('carpent')) icon = '🪚';
  else if (lower.includes('weld')) icon = '🔩';
  else if (lower.includes('mason') || lower.includes('brick')) icon = '🧱';
  else if (lower.includes('labour') || lower.includes('labor')) icon = '🦺';
  else if (lower.includes('helper')) icon = '🤝';
  else if (lower.includes('driver')) icon = '🚚';
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return { icon, label };
};

interface StaffAttendanceTabProps {
  staff: Staff | undefined;
}

export const StaffAttendanceTab = ({ staff }: StaffAttendanceTabProps) => {
  const { attendances, saveAttendance, staffList, sites, materialRequests, currentUser, paymentStageMaster, labourTypes } = useApp();

  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [teamAttView, setTeamAttView] = useState<'daily' | 'history'>('daily');

  const isSupervisor = staff?.role === 'supervisor';
  const isDriver = staff?.role === 'driver';

  const effectiveLabourTypes = useMemo(() => {
    if (labourTypes && labourTypes.length > 0) return labourTypes;
    return ['painter', 'plumber', 'labour'];
  }, [labourTypes]);

  const supervisorAtt = useMemo(() => {
    return (attendances || []).find(a => a.staffId === staff?.id && a.date === attendanceDate);
  }, [attendances, staff?.id, attendanceDate]);

  const supervisorAssignedSite = useMemo(() => {
    return supervisorAtt?.siteId || localStorage.getItem('today_active_site_id') || '';
  }, [supervisorAtt]);

  const isDaySubmitted = useMemo(() => {
    if (!staff?.id) return false;
    return !!supervisorAtt?.isSubmitted;
  }, [staff?.id, supervisorAtt?.isSubmitted]);


  const handleSubmitDay = () => {
    if (!staff?.id) return;
    const current = supervisorAtt || { staffId: staff.id, date: attendanceDate, status: 'present' };
    saveAttendance({ ...current, isSubmitted: true });

    // Also assign and submit attendance for team members under this supervisor
    const myTeam = staffList.filter(m => m.supervisorId === staff?.id && m.id !== staff?.id);
    myTeam.forEach(m => {
      const existing = (attendances || []).find(a => a.staffId === m.id && a.date === attendanceDate);
      saveAttendance({
        staffId: m.id,
        date: attendanceDate,
        status: existing?.status || 'present',
        ...existing,
        siteId: existing?.siteId || current.siteId,
        siteName: existing?.siteName || sites.find(st => st.id === (existing?.siteId || current.siteId))?.name,
        isSubmitted: true,
      });
    });

    toast.success("Attendance submitted successfully for supervisor and team!");
  };

  const handleEditDay = () => {
    if (!staff?.id) return;
    const current = supervisorAtt || { staffId: staff.id, date: attendanceDate, status: 'present' };
    saveAttendance({ ...current, isSubmitted: false });

    const myTeam = staffList.filter(m => m.supervisorId === staff?.id && m.id !== staff?.id);
    myTeam.forEach(m => {
      const existing = (attendances || []).find(a => a.staffId === m.id && a.date === attendanceDate);
      if (existing) {
        saveAttendance({ ...existing, isSubmitted: false });
      }
    });

    toast.info("Attendance unlocked for editing.");
  };

  return (
    <div className="animate-slide-up w-full">
      {isSupervisor ? (
        /* SUPERVISOR VIEW */
        <div>
          {teamAttView === 'history' ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="section-header !mb-0.5">Team Attendance History</h2>
                  <p className="text-xs text-muted-foreground">Historical records of team attendance, presence, and overtime hours.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTeamAttView('daily')}
                  className="h-9 rounded-xl text-xs font-semibold gap-1.5 self-start sm:self-auto"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-primary" /> Back to Daily
                </Button>
              </div>

              <div className="space-y-4">
                {[staff]
                  .filter(Boolean)
                  .map(s => {
                    const historyLogs = attendances
                      .filter(a => a.staffId === s!.id)
                      .sort((a, b) => b.date.localeCompare(a.date));
                    if (historyLogs.length === 0) return null;

                    const isSup = s!.role === 'supervisor';
                    const isDrv = s!.role === 'driver';
                    const presentCount = historyLogs.filter(l => l.status === 'present').length;
                    const halfDayCount = historyLogs.filter(l => l.status === 'half-day').length;
                    const totalOt = historyLogs.reduce((sum, l) => sum + (l.otHours || 0), 0);

                    return (
                      <div key={s!.id} className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-muted/40 rounded-xl border border-border/50">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-foreground">{s!.name}</h4>
                            <span className="text-[10px] text-muted-foreground uppercase font-extrabold px-2 py-0.5 rounded-full bg-muted">
                              {s!.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                            <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-md">
                              {presentCount} Full Days
                            </span>
                            {halfDayCount > 0 && (
                              <span className="bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-md">
                                {halfDayCount} Half Days
                              </span>
                            )}
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                              {totalOt}h OT
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {historyLogs.map(log => {
                            let driverTrips: any[] = [];
                            if (isDrv) {
                              driverTrips = (materialRequests || []).filter(
                                r => (r.driverId === s!.id || r.driverName?.toLowerCase() === s!.name.toLowerCase()) &&
                                  (r.date === log.date || r.createdAt?.startsWith(log.date))
                              );
                            }

                            let unCount = 0;
                            let unFullCount = 0;
                            let unHalfCount = 0;
                            let unOtHours = 0;
                            let unOtStaff = 0;
                            let breakdownStr = '';
                            if (isSup && (log.presentCounts || log.halfDayCounts)) {
                              unFullCount = Object.values(log.presentCounts || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
                              unHalfCount = Object.values(log.halfDayCounts || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
                              unCount = unFullCount + unHalfCount;
                              const parts: string[] = [];
                              effectiveLabourTypes.forEach(t => {
                                const f = log.presentCounts?.[t] || 0;
                                const h = log.halfDayCounts?.[t] || 0;
                                if (f > 0 && h > 0) parts.push(`${f}F / ${h}H ${t}`);
                                else if (f > 0) parts.push(`${f} ${t}`);
                                else if (h > 0) parts.push(`${h} (½) ${t}`);
                              });
                              breakdownStr = parts.join(', ');
                              unOtHours = log.unnamedOtHours !== undefined ? log.unnamedOtHours : 0;
                              unOtStaff =
                                log.unnamedOtStaffCount !== undefined
                                  ? log.unnamedOtStaffCount
                                  : unOtHours > 0
                                    ? unCount
                                    : 0;
                            }

                            let formattedDate = log.date;
                            try {
                              formattedDate = format(new Date(log.date + 'T00:00:00'), 'dd MMM yyyy, EEEE');
                            } catch { }

                            const historySite = sites.find(st => st.id === log.siteId);

                            return (
                              <div key={log.id} className="p-3 rounded-2xl bg-card border border-border/50 space-y-2 shadow-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                                      <CalendarDays className="w-3.5 h-3.5 text-primary" /> {formattedDate}
                                    </p>
                                    {historySite && (
                                      <span className="text-[11px] font-bold text-foreground bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                        <MapPin className="w-3 h-3 text-primary" /> {historySite.name}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${log.status === 'present'
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                        : log.status === 'half-day'
                                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                          : 'bg-destructive/15 text-destructive'
                                        }`}
                                    >
                                      {log.status}
                                    </span>

                                    {log.otHours && log.otHours > 0 ? (
                                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                        ⏰ {log.otHours} hrs OT
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">
                                        No OT
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {(isDrv || isSup || (log.expenseAmount && log.expenseAmount > 0)) && (
                                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground border-t border-border/30">
                                    {isDrv && (
                                      <span>
                                        🚚 {driverTrips.length} dispatch delivery {driverTrips.length === 1 ? 'trip' : 'trips'}
                                      </span>
                                    )}
                                    {isSup && unCount > 0 && (
                                      <span>
                                        👥 {unFullCount} Full{unHalfCount > 0 ? `, ${unHalfCount} Half` : ''} crew ({unFullCount + (unHalfCount * 0.5)} Man-Days){breakdownStr ? ` · ${breakdownStr}` : ''}
                                        {unOtHours > 0 ? ` · ${unOtStaff} crew on ${unOtHours}h OT` : ''}
                                      </span>
                                    )}
                                    {log.expenseAmount && log.expenseAmount > 0 ? (
                                      <span className={`font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                        log.expenseStatus === 'paid'
                                          ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
                                          : log.expenseStatus === 'rejected'
                                            ? 'text-destructive bg-destructive/10 border-destructive/25'
                                            : 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25'
                                      }`}>
                                        <IndianRupee className="w-3 h-3" /> ₹{log.expenseAmount.toLocaleString()} Claim ({
                                          log.expenseStatus === 'paid' ? 'Paid' : log.expenseStatus === 'rejected' ? 'Rejected' : 'Pending Review'
                                        }) {log.expensePaymentMethod ? `[${log.expensePaymentMethod}]` : ''} {log.expenseNotes ? `(${log.expenseNotes})` : ''}
                                      </span>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* DAILY ATTENDANCE EDITOR (SUPERVISOR) */
            <div className="space-y-6">
              {/* Date Navigation Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3.5 rounded-2xl border border-border/50 shadow-xs">
                <div>
                  <h2 className="section-header !mb-0 text-base flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-primary" /> Team Attendance & Overtime
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Mark daily team presence and record supervisor & unnamed worker OT hours.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/50">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        try {
                          const cur = new Date(attendanceDate + 'T00:00:00');
                          setAttendanceDate(format(addDays(cur, -1), 'yyyy-MM-dd'));
                        } catch { }
                      }}
                      className="h-8 w-8 rounded-lg"
                      title="Previous Day"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttendanceDate(format(new Date(), 'yyyy-MM-dd'))}
                      className="h-8 px-2 rounded-lg text-xs font-bold"
                    >
                      Today
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        try {
                          const cur = new Date(attendanceDate + 'T00:00:00');
                          setAttendanceDate(format(addDays(cur, 1), 'yyyy-MM-dd'));
                        } catch { }
                      }}
                      className="h-8 w-8 rounded-lg"
                      title="Next Day"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  <Input
                    type="date"
                    value={attendanceDate}
                    onChange={e => setAttendanceDate(e.target.value)}
                    className="h-9 w-36 rounded-xl bg-card border-border/60 text-xs font-semibold shadow-xs"
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTeamAttView('history')}
                    className="h-9 rounded-xl text-xs font-semibold gap-1"
                  >
                    <Clock className="w-3.5 h-3.5 text-primary" /> History
                  </Button>
                </div>
              </div>

              {/* Lock Status Banner if submitted */}
              {isDaySubmitted && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-xs">Today's Attendance is Submitted & Locked</p>
                      <p className="text-[11px] opacity-80">All records for supervisor and crew have been submitted for admin verification.</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditDay}
                    className="h-8 px-3 rounded-xl text-xs font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shrink-0 self-end sm:self-auto"
                  >
                    Unlock to Edit
                  </Button>
                </div>
              )}

              {/* Attendance Cards for Supervisor */}
              <div className="space-y-3.5">
                {[staff].filter(Boolean).map(s => {
                  const att = (attendances || []).find(
                    a => a.staffId === s!.id && a.date === attendanceDate
                  );
                  const isSelf = s!.id === staff?.id;
                  const isSup = s!.role === 'supervisor';
                  const otHours = att?.otHours || 0;
                  const isActive = att?.status === 'present';
                  const showOt = att?.status === 'present';

                  return (
                    <Card
                      key={s!.id}
                      className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs w-full space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                            style={{
                              background: isSup
                                ? 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))'
                                : 'hsl(var(--muted-foreground)/0.3)'
                            }}
                          >
                            <UserCircle className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                              {s!.name}
                              {isSelf && (
                                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground uppercase font-extrabold px-2 py-0.5 rounded-full bg-muted">
                                {s!.role}
                              </span>
                              {att?.editedByAdmin && (
                                <span className="text-[10px] text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 font-bold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                                  Modified by Admin: {att.editedByAdminName || 'Admin'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Buttons */}
                        <div className="inline-flex rounded-xl border border-border/60 p-1 bg-muted/40 gap-1 self-start sm:self-auto">
                          {[
                            { id: 'present' as const, label: 'Present', activeColor: 'bg-emerald-600 text-white shadow-xs' },
                            { id: 'half-day' as const, label: 'Half Day', activeColor: 'bg-amber-500 text-white shadow-xs' },
                            { id: 'absent' as const, label: 'Absent', activeColor: 'bg-destructive text-white shadow-xs' }
                          ].map(opt => {
                            const isCurrent = (att?.status || 'present') === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={isDaySubmitted}
                                onClick={() => {
                                  const current = att || { staffId: s!.id, date: attendanceDate, status: 'present' };
                                  saveAttendance({ ...current, status: opt.id });
                                }}
                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${isDaySubmitted ? 'opacity-50 cursor-not-allowed' : ''} ${isCurrent ? opt.activeColor : 'text-muted-foreground hover:text-foreground'
                                  }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* OT Input */}
                      {showOt && (
                        <div className="pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <Label className="text-xs font-semibold text-muted-foreground">
                              {isSup ? 'Supervisor OT (Hours):' : 'OT Hours:'}
                            </Label>
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder="0"
                                disabled={isDaySubmitted}
                                value={att?.otHours?.toString() || ''}
                                onChange={e => {
                                  const current = att || { staffId: s!.id, date: attendanceDate, status: 'present' };
                                  saveAttendance({ ...current, otHours: Number(e.target.value) || 0 });
                                }}
                                className="h-9 rounded-xl text-xs font-semibold w-24 disabled:opacity-50"
                              />
                              <span className="text-xs text-muted-foreground">hrs</span>
                            </div>
                          </div>

                          {otHours > 0 ? (
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                              ⏰ {otHours} hrs Overtime
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg">
                              No Overtime
                            </span>
                          )}
                        </div>
                      )}

                      {/* Site Selection & Active Level Indicator for Supervisor */}
                      {isActive && isSup && (
                        <div className="pt-3 border-t border-border/40 space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-primary" /> Today's Assigned Project Site *
                            </Label>
                            <span className="text-[11px] text-muted-foreground">
                              Select where you are working today to auto-sync daily work & expenses
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(() => {
                              const currentSiteId = att?.siteId || localStorage.getItem('today_active_site_id') || '';
                              const selectedSiteObj = sites.find(st => st.id === currentSiteId);

                              return (
                                <>
                                  <Select
                                    value={currentSiteId || undefined}
                                    disabled={isDaySubmitted}
                                    onValueChange={(val) => {
                                      if (!val) return;
                                      const current = att || { staffId: s!.id, date: attendanceDate, status: 'present' };
                                      const siteName = sites.find(st => st.id === val)?.name;
                                      saveAttendance({ ...current, siteId: val, siteName });
                                      localStorage.setItem('today_active_site_id', val);

                                      // Also assign this site to all team members under this supervisor
                                      const myTeam = staffList.filter(m => m.supervisorId === staff?.id && m.id !== staff?.id);
                                      myTeam.forEach(m => {
                                        const existing = (attendances || []).find(a => a.staffId === m.id && a.date === attendanceDate);
                                        saveAttendance({
                                          staffId: m.id,
                                          date: attendanceDate,
                                          status: existing?.status || 'present',
                                          ...existing,
                                          siteId: val,
                                          siteName,
                                        });
                                      });

                                      toast.success("Today's site assigned to supervisor and team members!");
                                    }}
                                  >
                                    <SelectTrigger className="h-10 rounded-xl text-xs bg-muted/30 border-border/60">
                                      <SelectValue placeholder="Select Today's Site...">
                                        {selectedSiteObj ? `${selectedSiteObj.name}${selectedSiteObj.clientName ? ` (${selectedSiteObj.clientName})` : ''}` : undefined}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sites
                                        .filter(site => site.status !== 'completed')
                                        .map(site => (
                                          <SelectItem key={site.id} value={site.id}>
                                            {site.name} {site.clientName ? `(${site.clientName})` : ''}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>

                                  {/* Active Stage Pill for this site */}
                                  {!selectedSiteObj ? (
                                    <div className="flex items-center text-xs text-muted-foreground p-2.5 rounded-xl bg-muted/20 border border-dashed border-border/50">
                                      Select a site above to view its current active level
                                    </div>
                                  ) : (() => {
                                    const masterStages = (selectedSiteObj.paymentStages && selectedSiteObj.paymentStages.length > 0)
                                      ? selectedSiteObj.paymentStages.map(st => st.stageName)
                                      : paymentStageMaster;

                                    let activeStageName = '';
                                    let activeStageLevel = 1;
                                    let activeStageStatus = 'pending';

                                    for (let i = 0; i < masterStages.length; i++) {
                                      const name = masterStages[i];
                                      const stData = (selectedSiteObj.paymentStages || []).find(st => st.stageName === name);
                                      const isCompleted = stData?.completionStatus === 'completed';
                                      if (!isCompleted && !activeStageName) {
                                        activeStageName = name;
                                        activeStageLevel = i + 1;
                                        activeStageStatus = stData?.completionStatus || 'in_progress';
                                        break;
                                      }
                                    }

                                    return (
                                      <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-foreground">
                                            Active Stage: Level {activeStageLevel} ({activeStageName || 'Default'})
                                          </span>
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${activeStageStatus === 'in_progress' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                                            {activeStageStatus}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </>
                              );
                            })()}
                          </div>

                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>


              {/* Labour Distribution (Unnamed Staff) & Overtime Section */}
              {staff?.id && (
                <div className="mt-8 space-y-4">
                  <div>
                    <h3 className="section-header !mb-0.5 flex items-center gap-2 text-base">
                      <Users className="w-5 h-5 text-amber-500" /> Labour Distribution & Overtime
                      <span className="text-[10px] font-medium text-muted-foreground ml-1">
                        (Unnamed Staff Crew)
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Record unnamed workforce ({effectiveLabourTypes.map(t => getLabourTypeMeta(t).label).join(', ')}) present today and set their crew overtime hours. Configured in Admin Settings.
                    </p>
                  </div>

                  {(() => {
                    const myAtt = (attendances || []).find(
                      a => a.staffId === staff.id && a.date === attendanceDate
                    );
                    const presentCounts = (myAtt?.presentCounts || {}) as Record<string, number>;
                    const halfDayCounts = (myAtt?.halfDayCounts || {}) as Record<string, number>;
                    const unnamedOtHours = myAtt?.unnamedOtHours || 0;
                    const siteAssignments = myAtt?.siteAssignments || [];

                    const updateCounts = (cat: string, val: number) => {
                      const current = myAtt || { staffId: staff.id, date: attendanceDate, status: 'present' };
                      saveAttendance({ ...current, presentCounts: { ...presentCounts, [cat]: Math.max(0, val) } });
                    };

                    const updateHalfDayCounts = (cat: string, val: number) => {
                      const current = myAtt || { staffId: staff.id, date: attendanceDate, status: 'present' };
                      saveAttendance({ ...current, halfDayCounts: { ...halfDayCounts, [cat]: Math.max(0, val) } });
                    };

                    const updateUnnamedOt = (hrs: number) => {
                      const current = myAtt || { staffId: staff.id, date: attendanceDate, status: 'present' };
                      saveAttendance({ ...current, unnamedOtHours: Math.max(0, hrs) });
                    };

                    const updateUnnamedOtStaffCount = (count: number) => {
                      const current = myAtt || { staffId: staff.id, date: attendanceDate, status: 'present' };
                      saveAttendance({ ...current, unnamedOtStaffCount: Math.max(0, count) });
                    };

                    const addAssignment = () => {
                      const current = myAtt || { staffId: staff.id, date: attendanceDate, status: 'present' };
                      const defaultSite = myAtt?.siteId || localStorage.getItem('today_active_site_id') || '';
                      const initialCounts: Record<string, number> = {};
                      const initialHalf: Record<string, number> = {};
                      effectiveLabourTypes.forEach(t => {
                        initialCounts[t] = 0;
                        initialHalf[t] = 0;
                      });
                      saveAttendance({
                        ...current,
                        siteAssignments: [...siteAssignments, { siteId: defaultSite, counts: initialCounts, halfDayCounts: initialHalf }]
                      });
                    };

                    const updateAssignment = (index: number, siteId: string, counts: typeof presentCounts, halfCounts?: typeof halfDayCounts) => {
                      const newArr = [...siteAssignments];
                      newArr[index] = {
                        siteId,
                        counts,
                        halfDayCounts: halfCounts !== undefined ? halfCounts : (newArr[index].halfDayCounts || {})
                      };
                      const current = myAtt || { staffId: staff.id, date: attendanceDate, status: 'present' };
                      saveAttendance({ ...current, siteAssignments: newArr });
                    };

                    const removeAssignment = (index: number) => {
                      const newArr = siteAssignments.filter((_, i) => i !== index);
                      const current = myAtt || { staffId: staff.id, date: attendanceDate, status: 'present' };
                      saveAttendance({ ...current, siteAssignments: newArr });
                    };

                    const totalFull = Object.values(presentCounts).reduce((acc, v) => acc + (Number(v) || 0), 0);
                    const totalHalf = Object.values(halfDayCounts).reduce((acc, v) => acc + (Number(v) || 0), 0);
                    const totalUnnamed = totalFull + totalHalf;
                    const totalManDays = totalFull + (totalHalf * 0.5);
                    const actualOtStaff =
                      myAtt?.unnamedOtStaffCount !== undefined
                        ? myAtt.unnamedOtStaffCount
                        : unnamedOtHours > 0
                          ? totalUnnamed
                          : 0;

                    const usedFull: Record<string, number> = {};
                    const usedHalf: Record<string, number> = {};
                    effectiveLabourTypes.forEach(lt => {
                      usedFull[lt] = siteAssignments.reduce((acc, a) => acc + (Number(a.counts?.[lt]) || 0), 0);
                      usedHalf[lt] = siteAssignments.reduce((acc, a) => acc + (Number(a.halfDayCounts?.[lt]) || 0), 0);
                    });

                    return (
                      <div className="space-y-4">
                        <Card className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/40">
                            <div>
                              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                                Total Unnamed Crew Present Today
                              </h4>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Set Full Day and Half Day workers for each crew trade.
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold px-3 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                {totalFull} Full · {totalHalf} Half ({totalManDays} Man-Days)
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Dynamic Labour Types from Admin Settings with Full Day and Half Day */}
                            {effectiveLabourTypes.map(type => {
                              const meta = getLabourTypeMeta(type);
                              const countVal = presentCounts[type] || 0;
                              const halfVal = halfDayCounts[type] || 0;
                              const typeManDays = countVal + (halfVal * 0.5);

                              return (
                                <div key={type} className="bg-muted/30 p-3 rounded-xl border border-border/40 space-y-2.5">
                                  <div className="flex items-center justify-between gap-1">
                                    <Label className="text-[11px] font-bold text-foreground uppercase tracking-wider block truncate">
                                      {meta.icon} {meta.label}
                                    </Label>
                                    {(countVal > 0 || halfVal > 0) && (
                                      <span className="text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                                        {typeManDays}d
                                      </span>
                                    )}
                                  </div>

                                  {/* Full Day Row */}
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                                      <span>Full Day</span>
                                      <span className="font-bold text-foreground">{countVal}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => updateCounts(type, countVal - 1)}
                                        className="h-7 w-7 rounded-lg shrink-0"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </Button>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={countVal || ''}
                                        placeholder="0"
                                        onChange={e => updateCounts(type, Number(e.target.value) || 0)}
                                        className="h-7 rounded-lg text-center font-bold text-xs"
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => updateCounts(type, countVal + 1)}
                                        className="h-7 w-7 rounded-lg shrink-0"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Half Day Row */}
                                  <div className="space-y-1 pt-1.5 border-t border-border/30">
                                    <div className="flex items-center justify-between text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                                      <span>Half Day (½)</span>
                                      <span className="font-bold">{halfVal}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => updateHalfDayCounts(type, halfVal - 1)}
                                        className="h-7 w-7 rounded-lg shrink-0 border-amber-500/30 text-amber-600"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </Button>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={halfVal || ''}
                                        placeholder="0"
                                        onChange={e => updateHalfDayCounts(type, Number(e.target.value) || 0)}
                                        className="h-7 rounded-lg text-center font-bold text-xs border-amber-500/30 text-amber-700 dark:text-amber-300"
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => updateHalfDayCounts(type, halfVal + 1)}
                                        className="h-7 w-7 rounded-lg shrink-0 border-amber-500/30 text-amber-600"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Unnamed OT Staff Count & OT Hour Count */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/30 max-w-xl">
                            <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/30">
                              <Label className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block mb-1.5">
                                👥 OT Staff Count
                              </Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateUnnamedOtStaffCount(actualOtStaff - 1)}
                                  className="h-8 w-8 rounded-lg shrink-0"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  value={actualOtStaff || ''}
                                  placeholder="0"
                                  onChange={e => updateUnnamedOtStaffCount(Number(e.target.value) || 0)}
                                  className="h-8 rounded-lg text-center font-bold text-xs"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateUnnamedOtStaffCount(actualOtStaff + 1)}
                                  className="h-8 w-8 rounded-lg shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Unnamed OT Hour Count */}
                            <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/30">
                              <Label className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block mb-1.5">
                                ⏰ OT Hour Count
                              </Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateUnnamedOt(unnamedOtHours - 1)}
                                  className="h-8 w-8 rounded-lg shrink-0"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={unnamedOtHours || ''}
                                  placeholder="0"
                                  onChange={e => updateUnnamedOt(Number(e.target.value) || 0)}
                                  className="h-8 rounded-lg text-center font-bold text-xs"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateUnnamedOt(unnamedOtHours + 1)}
                                  className="h-8 w-8 rounded-lg shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>

                        {/* Site Labour Allocation */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Site Labour Allocation
                              </h4>
                              <p className="text-[11px] text-muted-foreground">
                                Assign unnamed workers to project sites for transparent cost tracking.
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={addAssignment}
                              className="h-8 text-xs font-semibold rounded-xl bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Assign Site
                            </Button>
                          </div>

                          {siteAssignments.map((assignment, idx) => (
                            <Card
                              key={idx}
                              className="p-4 rounded-2xl bg-card border border-border/50 shadow-sm relative animate-in fade-in"
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAssignment(idx)}
                                className="absolute top-2 right-2 h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                              <div className="mb-3 pr-8">
                                <Label className="text-[10px] uppercase font-bold mb-1.5 block">Select Destination Site</Label>
                                <Select
                                  value={assignment.siteId}
                                  onValueChange={v => updateAssignment(idx, v, assignment.counts, assignment.halfDayCounts)}
                                >
                                  <SelectTrigger className="h-10 rounded-xl text-xs bg-muted/30">
                                    <SelectValue placeholder="Select Site" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sites
                                      .filter(site => site.status !== 'completed')
                                      .map(site => (
                                        <SelectItem key={site.id} value={site.id}>
                                          {site.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {effectiveLabourTypes.map(cat => {
                                  const meta = getLabourTypeMeta(cat);
                                  const currentFull = assignment.counts?.[cat] || 0;
                                  const currentHalf = assignment.halfDayCounts?.[cat] || 0;
                                  const totalFullForCat = presentCounts[cat] || 0;
                                  const totalHalfForCat = halfDayCounts[cat] || 0;
                                  const remainingFull = totalFullForCat - (usedFull[cat] || 0) + currentFull;
                                  const remainingHalf = totalHalfForCat - (usedHalf[cat] || 0) + currentHalf;
                                  const isError = currentFull > remainingFull || currentHalf > remainingHalf;

                                  return (
                                    <div key={cat} className={`p-2.5 rounded-xl border space-y-2 ${isError ? 'bg-destructive/10 border-destructive/40' : 'bg-muted/20 border-border/40'}`}>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold flex items-center gap-1 truncate">
                                          {meta.icon} {meta.label}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                                          Logged: {totalFullForCat}F / {totalHalfForCat}H
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                          <Label className={`text-[10px] uppercase font-bold block mb-1 truncate ${currentFull > remainingFull ? 'text-destructive' : 'text-muted-foreground'}`}>
                                            Full (Max: {remainingFull})
                                          </Label>
                                          <Input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={currentFull || ''}
                                            onChange={e => {
                                              const newCounts = {
                                                ...assignment.counts,
                                                [cat]: Math.max(0, Number(e.target.value) || 0)
                                              };
                                              updateAssignment(idx, assignment.siteId, newCounts, assignment.halfDayCounts);
                                            }}
                                            className="h-8 rounded-lg text-xs"
                                          />
                                        </div>
                                        <div>
                                          <Label className={`text-[10px] uppercase font-bold block mb-1 truncate ${currentHalf > remainingHalf ? 'text-destructive' : 'text-amber-700 dark:text-amber-300'}`}>
                                            Half (Max: {remainingHalf})
                                          </Label>
                                          <Input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={currentHalf || ''}
                                            onChange={e => {
                                              const newHalf = {
                                                ...(assignment.halfDayCounts || {}),
                                                [cat]: Math.max(0, Number(e.target.value) || 0)
                                              };
                                              updateAssignment(idx, assignment.siteId, assignment.counts, newHalf);
                                            }}
                                            className="h-8 rounded-lg text-xs border-amber-500/30 text-amber-700 dark:text-amber-300"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </Card>
                          ))}
                          {siteAssignments.length === 0 && (
                            <div className="text-center py-6 border border-dashed border-border/50 rounded-2xl text-muted-foreground bg-muted/10">
                              <MapPin className="w-6 h-6 mx-auto mb-2 opacity-30" />
                              <p className="text-xs">No sites assigned yet. Click "Assign Site" to distribute headcount.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Submission Controls */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border/50 shadow-xs">
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    {isDaySubmitted ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-primary" />}
                    {isDaySubmitted ? "Today's Attendance Submitted & Locked" : "Submit Today's Attendance"}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isDaySubmitted
                      ? "Attendance records are saved. Click Edit Attendance to make updates."
                      : "Save and submit today's attendance and site labour allocation."}
                  </p>
                </div>
                <div className="shrink-0 self-end sm:self-auto">
                  {isDaySubmitted ? (
                    <Button onClick={handleEditDay} variant="outline" className="h-10 px-5 rounded-xl font-bold">
                      Edit Attendance
                    </Button>
                  ) : (
                    <Button onClick={handleSubmitDay} className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm">
                      Submit Today's Attendance
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* DRIVER & REGULAR STAFF PERSONAL ATTENDANCE VIEW */
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/50 shadow-xs">
            <div>
              <h2 className="section-header !mb-0 text-base flex items-center gap-2">
                {isDriver ? <Truck className="w-5 h-5 text-blue-500" /> : <CalendarDays className="w-5 h-5 text-primary" />}
                {isDriver ? 'Driver Attendance & Daily Overtime' : 'My Attendance & Overtime'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isDriver
                  ? 'Mark your daily driver presence, log overtime hours, and view your dispatch delivery runs.'
                  : 'View and record your daily attendance status and overtime hours.'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/50">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    try {
                      const cur = new Date(attendanceDate + 'T00:00:00');
                      setAttendanceDate(format(addDays(cur, -1), 'yyyy-MM-dd'));
                    } catch { }
                  }}
                  className="h-8 w-8 rounded-lg"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAttendanceDate(format(new Date(), 'yyyy-MM-dd'))}
                  className="h-8 px-2 rounded-lg text-xs font-bold"
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    try {
                      const cur = new Date(attendanceDate + 'T00:00:00');
                      setAttendanceDate(format(addDays(cur, 1), 'yyyy-MM-dd'));
                    } catch { }
                  }}
                  className="h-8 w-8 rounded-lg"
                  title="Next Day"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <Input
                type="date"
                value={attendanceDate}
                onChange={e => setAttendanceDate(e.target.value)}
                className="h-9 w-36 rounded-xl bg-card border-border/60 text-xs font-semibold shadow-xs"
              />
            </div>
          </div>

          {/* User's Card */}
          {(() => {
            if (!staff) return null;
            const att = (attendances || []).find(a => a.staffId === staff.id && a.date === attendanceDate);
            const otHours = att?.otHours || 0;
            const isActive = att?.status === 'present' || att?.status === 'half-day';

            return (
              <Card className="p-5 rounded-2xl bg-card border border-border/60 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 ${isDriver ? 'bg-blue-600' : 'bg-primary'
                        }`}
                    >
                      {isDriver ? <Truck className="w-6 h-6" /> : <UserCircle className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                        {staff.name}
                        <span className="text-[11px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full uppercase font-bold">
                          {staff.role}
                        </span>
                      </h3>
                    </div>
                  </div>

                  <div className="inline-flex rounded-xl border border-border/60 p-1 bg-muted/40 gap-1 self-start sm:self-auto">
                    {[
                      { id: 'present' as const, label: 'Present', activeColor: 'bg-emerald-600 text-white shadow-xs' },
                      { id: 'half-day' as const, label: 'Half Day', activeColor: 'bg-amber-500 text-white shadow-xs' },
                      { id: 'absent' as const, label: 'Absent', activeColor: 'bg-destructive text-white shadow-xs' }
                    ].map(opt => {
                      const isCurrent = (att?.status || 'present') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            const current = att || { staffId: staff.id, date: attendanceDate, status: 'present' };
                            saveAttendance({ ...current, status: opt.id });
                            toast.success(`Marked as ${opt.label} for ${attendanceDate}`);
                          }}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${isCurrent ? opt.activeColor : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isActive ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-muted/20 p-4 rounded-xl border border-border/40">
                    <div>
                      <Label className="text-xs font-semibold text-foreground mb-1.5 block">
                        ⏰ Overtime (OT Hours Worked)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const current = att || { staffId: staff.id, date: attendanceDate, status: 'present' };
                            saveAttendance({ ...current, otHours: Math.max(0, (att?.otHours || 0) - 0.5) });
                          }}
                          className="h-9 w-9 rounded-xl"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={att?.otHours?.toString() || ''}
                          placeholder="0"
                          onChange={e => {
                            const current = att || { staffId: staff.id, date: attendanceDate, status: 'present' };
                            saveAttendance({ ...current, otHours: Math.max(0, Number(e.target.value) || 0) });
                          }}
                          className="h-9 rounded-xl text-center font-bold text-sm w-24"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const current = att || { staffId: staff.id, date: attendanceDate, status: 'present' };
                            saveAttendance({ ...current, otHours: (att?.otHours || 0) + 0.5 });
                          }}
                          className="h-9 w-9 rounded-xl"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <span className="text-xs font-medium text-muted-foreground">Hours</span>
                      </div>
                    </div>

                    <div className="p-3 bg-card rounded-xl border border-border/50 text-xs space-y-1">
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Attendance Status:</span>
                        <span className="font-bold uppercase text-emerald-600 dark:text-emerald-400">{att?.status}</span>
                      </div>
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Overtime Logged:</span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {otHours > 0 ? `${otHours} hrs OT` : 'No OT'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Marked as <strong>Absent</strong> on this date.</span>
                  </div>
                )}
              </Card>
            );
          })()}

          {/* If Driver: show deliveries */}
          {isDriver && (
            <div className="space-y-3">
              <h3 className="section-header !mb-1 flex items-center gap-2 text-sm">
                <Truck className="w-4 h-4 text-primary" /> My Material Transport & Deliveries
              </h3>
              {(() => {
                const myTrips = (materialRequests || [])
                  .filter(
                    r =>
                      r.driverId === staff?.id ||
                      (r.driverName && r.driverName.toLowerCase() === staff?.name.toLowerCase())
                  )
                  .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

                if (myTrips.length === 0) {
                  return (
                    <div className="text-center py-8 bg-card rounded-2xl border border-border/50 text-muted-foreground text-xs">
                      <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>No dispatch deliveries assigned yet.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    {myTrips.map(trip => (
                      <Card key={trip.id} className="p-3.5 rounded-xl bg-card border border-border/50 text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-foreground">
                            <MapPin className="w-3.5 h-3.5 text-primary" /> {trip.siteName}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${trip.status === 'completed'
                              ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25'
                              : trip.status === 'assigned'
                                ? 'bg-blue-500/15 text-blue-600 border border-blue-500/25'
                                : 'bg-amber-500/15 text-amber-600 border border-amber-500/25'
                              }`}
                          >
                            {trip.status === 'completed'
                              ? 'Fulfilled'
                              : trip.status === 'assigned'
                                ? 'Dispatched / In Transit'
                                : 'Pending'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {trip.items.map((it, idx) => (
                            <span key={idx} className="bg-muted/60 px-2 py-0.5 rounded text-[11px] font-medium border border-border/40">
                              {it.name} × {it.quantity} {it.unit}
                            </span>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                          <div>
                            <span className="font-semibold text-foreground">Vehicle:</span>{' '}
                            {trip.vehicleNumber || trip.vehicle || 'Assigned'}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground">Supplier/Source:</span>{' '}
                            {trip.supplierName || '-'}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground">Dispatched:</span>{' '}
                            {trip.startTime || '-'}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Past attendance records for current staff */}
          <div className="space-y-3">
            <h3 className="section-header !mb-1 flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-primary" /> My Past Attendance Records
            </h3>
            {(() => {
              const myHistory = (attendances || [])
                .filter(a => a.staffId === staff?.id)
                .sort((a, b) => b.date.localeCompare(a.date));

              if (myHistory.length === 0) {
                return (
                  <div className="text-center py-8 bg-card rounded-2xl border border-border/50 text-muted-foreground text-xs">
                    <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>No past attendance logs recorded yet.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {myHistory.map(h => {
                    const isDrv = staff?.role === 'driver';
                    let driverTrips: any[] = [];
                    if (isDrv) {
                      driverTrips = (materialRequests || []).filter(
                        r => (r.driverId === staff?.id || r.driverName?.toLowerCase() === staff?.name.toLowerCase()) &&
                          (r.date === h.date || r.createdAt?.startsWith(h.date))
                      );
                    }

                    let formatted = h.date;
                    try {
                      formatted = format(new Date(h.date + 'T00:00:00'), 'dd MMM yyyy, EEEE');
                    } catch { }

                    return (
                      <Card
                        key={h.id}
                        className="p-3 bg-card rounded-2xl border border-border/50 space-y-2 shadow-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-primary" />
                            <p className="font-bold text-sm text-foreground">{formatted}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${h.status === 'present'
                                  ? 'bg-emerald-500/15 text-emerald-600'
                                  : h.status === 'half-day'
                                    ? 'bg-amber-500/15 text-amber-600'
                                    : 'bg-destructive/15 text-destructive'
                                }`}
                            >
                              {h.status}
                            </span>
                            {h.otHours && h.otHours > 0 ? (
                              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                ⏰ {h.otHours} hrs OT
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">
                                No OT
                              </span>
                            )}
                          </div>
                        </div>

                        {isDrv && driverTrips.length > 0 && (
                          <div className="pt-1.5 border-t border-border/30 text-xs text-muted-foreground flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-blue-500" />
                            <span>{driverTrips.length} material dispatch deliveries completed</span>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffAttendanceTab;
