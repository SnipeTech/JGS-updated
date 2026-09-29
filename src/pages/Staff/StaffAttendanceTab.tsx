import { useState, useMemo } from 'react';
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
  Plus, Minus, AlertCircle, Trash2, MapPin, CheckCircle2
} from 'lucide-react';
import { Staff } from '@/types';

interface StaffAttendanceTabProps {
  staff: Staff | undefined;
}

export const StaffAttendanceTab = ({ staff }: StaffAttendanceTabProps) => {
  const { attendances, saveAttendance, staffList, sites, materialRequests, currentUser, paymentStageMaster } = useApp();

  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [teamAttView, setTeamAttView] = useState<'daily' | 'history'>('daily');

  const isSupervisor = staff?.role === 'supervisor';
  const isDriver = staff?.role === 'driver';

  const driversList = useMemo(() => staffList.filter(s => s.role === 'driver'), [staffList]);
  const subStaff = useMemo(
    () => staffList.filter(s => s.role !== 'supervisor' && s.role !== 'driver'),
    [staffList]
  );

  const isDaySubmitted = useMemo(() => {
    if (!staff?.id) return false;
    const myAtt = attendances.find(a => a.staffId === staff.id && a.date === attendanceDate);
    return !!myAtt?.isSubmitted;
  }, [attendances, staff?.id, attendanceDate]);

  const handleSubmitDay = () => {
    const teamIds = [staff].filter(Boolean).map(s => s!.id);
    teamIds.forEach(id => {
      const existing = attendances.find(a => a.staffId === id && a.date === attendanceDate);
      if (existing) {
        saveAttendance({ ...existing, isSubmitted: true });
      } else {
        saveAttendance({ staffId: id, date: attendanceDate, status: 'present', isSubmitted: true } as any);
      }
    });
    toast.success("Attendance submitted successfully!");
  };

  const handleEditDay = () => {
    const teamIds = [staff].filter(Boolean).map(s => s!.id);
    teamIds.forEach(id => {
      const existing = attendances.find(a => a.staffId === id && a.date === attendanceDate);
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
                            let unOtHours = 0;
                            let unOtStaff = 0;
                            if (isSup && log.presentCounts) {
                              unCount =
                                (log.presentCounts.painter || 0) +
                                (log.presentCounts.plumber || 0) +
                                (log.presentCounts.labour || 0);
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

                            return (
                              <div key={log.id} className="p-3 rounded-2xl bg-card border border-border/50 space-y-2 shadow-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                                    <CalendarDays className="w-3.5 h-3.5 text-primary" /> {formattedDate}
                                  </p>
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

                                {(isDrv || isSup) && (
                                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground border-t border-border/30">
                                    {isDrv && (
                                      <span>
                                        🚚 {driverTrips.length} dispatch delivery {driverTrips.length === 1 ? 'trip' : 'trips'}
                                      </span>
                                    )}
                                    {isSup && unCount > 0 && (
                                      <span>
                                        👥 {unCount} unnamed workers ({log.presentCounts?.painter || 0} painters, {log.presentCounts?.plumber || 0} plumbers, {log.presentCounts?.labour || 0} labourers)
                                        {unOtHours > 0 ? ` · ${unOtStaff} crew on ${unOtHours}h OT` : ''}
                                      </span>
                                    )}
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
                            <Select
                              value={att?.siteId || ''}
                              disabled={isDaySubmitted}
                              onValueChange={(val) => {
                                const current = att || { staffId: s!.id, date: attendanceDate, status: 'present' };
                                saveAttendance({ ...current, siteId: val });
                                localStorage.setItem('today_active_site_id', val);
                                toast.success("Today's site assigned!");
                              }}
                            >
                              <SelectTrigger className="h-10 rounded-xl text-xs bg-muted/30 border-border/60">
                                <SelectValue placeholder="Select Today's Site..." />
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
                            {(() => {
                              const selectedSiteObj = sites.find(st => st.id === att?.siteId);
                              if (!selectedSiteObj) {
                                return (
                                  <div className="flex items-center text-xs text-muted-foreground p-2.5 rounded-xl bg-muted/20 border border-dashed border-border/50">
                                    Select a site above to view its current active level
                                  </div>
                                );
                              }

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

                              if (!activeStageName) {
                                return (
                                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 rounded-xl">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" /> All project milestones completed!
                                  </div>
                                );
                              }

                              return (
                                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/25 text-xs">
                                  <div className="min-w-0">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                      Current Active Construction Level
                                    </p>
                                    <p className="font-bold text-foreground truncate">
                                      Level {activeStageLevel}: {activeStageName}
                                    </p>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white shrink-0">
                                    {activeStageStatus === 'completion_requested' ? 'Pending Approval' : 'In Progress'}
                                  </span>
                                </div>
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
                      Record unnamed painters, plumbers, and labourers present today and set their crew overtime hours.
                    </p>
                  </div>

                  {(() => {
                    const myAtt = (attendances || []).find(
                      a => a.staffId === staff.id && a.date === attendanceDate
                    );
                    const presentCounts = myAtt?.presentCounts || { painter: 0, plumber: 0, labour: 0 };
                    const unnamedOtHours = myAtt?.unnamedOtHours || 0;
                    const siteAssignments = myAtt?.siteAssignments || [];

                    const updateCounts = (cat: keyof typeof presentCounts, val: number) => {
                      const current = myAtt || { staffId: staff.id, date: attendanceDate, status: 'present' };
                      saveAttendance({ ...current, presentCounts: { ...presentCounts, [cat]: Math.max(0, val) } });
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
                      saveAttendance({
                        ...current,
                        siteAssignments: [...siteAssignments, { siteId: defaultSite, counts: { painter: 0, plumber: 0, labour: 0 } }]
                      });
                    };

                    const updateAssignment = (index: number, siteId: string, counts: typeof presentCounts) => {
                      const newArr = [...siteAssignments];
                      newArr[index] = { siteId, counts };
                      const current = myAtt || { staffId: staff.id, date: attendanceDate, status: 'present' };
                      saveAttendance({ ...current, siteAssignments: newArr });
                    };

                    const removeAssignment = (index: number) => {
                      const newArr = siteAssignments.filter((_, i) => i !== index);
                      const current = myAtt || { staffId: staff.id, date: attendanceDate, status: 'present' };
                      saveAttendance({ ...current, siteAssignments: newArr });
                    };

                    const totalUnnamed =
                      (presentCounts.painter || 0) +
                      (presentCounts.plumber || 0) +
                      (presentCounts.labour || 0);
                    const actualOtStaff =
                      myAtt?.unnamedOtStaffCount !== undefined
                        ? myAtt.unnamedOtStaffCount
                        : unnamedOtHours > 0
                          ? totalUnnamed
                          : 0;

                    const used = {
                      painter: siteAssignments.reduce((acc, a) => acc + (a.counts.painter || 0), 0),
                      plumber: siteAssignments.reduce((acc, a) => acc + (a.counts.plumber || 0), 0),
                      labour: siteAssignments.reduce((acc, a) => acc + (a.counts.labour || 0), 0)
                    };

                    return (
                      <div className="space-y-4">
                        <Card className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/40">
                            <div>
                              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                                Total Unnamed Crew Present Today
                              </h4>

                            </div>
                            <span className="text-xs font-bold px-3 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                              {totalUnnamed} Workers Logged
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {/* Painters */}
                            <div className="bg-muted/30 p-3 rounded-xl border border-border/40">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                🎨 Painters
                              </Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateCounts('painter', (presentCounts.painter || 0) - 1)}
                                  className="h-8 w-8 rounded-lg"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  value={presentCounts.painter || ''}
                                  placeholder="0"
                                  onChange={e => updateCounts('painter', Number(e.target.value) || 0)}
                                  className="h-8 rounded-lg text-center font-bold text-xs"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateCounts('painter', (presentCounts.painter || 0) + 1)}
                                  className="h-8 w-8 rounded-lg"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Plumbers */}
                            <div className="bg-muted/30 p-3 rounded-xl border border-border/40">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                🔧 Plumbers
                              </Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateCounts('plumber', (presentCounts.plumber || 0) - 1)}
                                  className="h-8 w-8 rounded-lg"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  value={presentCounts.plumber || ''}
                                  placeholder="0"
                                  onChange={e => updateCounts('plumber', Number(e.target.value) || 0)}
                                  className="h-8 rounded-lg text-center font-bold text-xs"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateCounts('plumber', (presentCounts.plumber || 0) + 1)}
                                  className="h-8 w-8 rounded-lg"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Labourers */}
                            <div className="bg-muted/30 p-3 rounded-xl border border-border/40">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                🧱 Labourers
                              </Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateCounts('labour', (presentCounts.labour || 0) - 1)}
                                  className="h-8 w-8 rounded-lg"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  value={presentCounts.labour || ''}
                                  placeholder="0"
                                  onChange={e => updateCounts('labour', Number(e.target.value) || 0)}
                                  className="h-8 rounded-lg text-center font-bold text-xs"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => updateCounts('labour', (presentCounts.labour || 0) + 1)}
                                  className="h-8 w-8 rounded-lg"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Unnamed OT Staff Count */}
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
                                  className="h-8 w-8 rounded-lg"
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
                                  className="h-8 w-8 rounded-lg"
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
                                  className="h-8 w-8 rounded-lg"
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
                                  className="h-8 w-8 rounded-lg"
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
                                  onValueChange={v => updateAssignment(idx, v, assignment.counts)}
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
                              <div className="grid grid-cols-3 gap-3">
                                {['painter', 'plumber', 'labour'].map(cat => {
                                  const key = cat as keyof typeof presentCounts;
                                  const currentVal = assignment.counts[key] || 0;
                                  const remaining = (presentCounts[key] || 0) - used[key] + currentVal;
                                  const isError = currentVal > remaining;
                                  return (
                                    <div key={cat} className="flex flex-col gap-1">
                                      <Label
                                        className={`text-[10px] uppercase font-bold flex justify-between ${isError ? 'text-destructive' : ''
                                          }`}
                                      >
                                        <span>{cat}</span>
                                        <span className="font-normal opacity-60">Max: {remaining}</span>
                                      </Label>
                                      <Input
                                        type="number"
                                        placeholder="0"
                                        value={currentVal || ''}
                                        onChange={e => {
                                          const newCounts = {
                                            ...assignment.counts,
                                            [key]: Number(e.target.value) || 0
                                          };
                                          updateAssignment(idx, assignment.siteId, newCounts);
                                        }}
                                        className={`h-9 rounded-xl text-xs font-semibold ${isError ? 'border-destructive/50 bg-destructive/10' : ''
                                          }`}
                                      />
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
              <div className="mt-4 flex justify-end">
                {isDaySubmitted ? (
                  <Button onClick={handleEditDay} variant="outline" className="h-10 rounded-xl font-bold">
                    Edit Attendance
                  </Button>
                ) : (
                  <Button onClick={handleSubmitDay} className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm">
                    Submit Today's Attendance
                  </Button>
                )}
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
