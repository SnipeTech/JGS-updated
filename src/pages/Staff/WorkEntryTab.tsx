import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Send, MapPin, Users, Package, Clock, Plus, Trash2,
  Bike, Bus, Car, Footprints, AlertCircle, Search, Sparkles,
  Layers, CheckCircle2, SendHorizonal, Lock, Unlock, ShieldCheck, ArrowRight
} from 'lucide-react';
import { Material, TransportMode, TRANSPORT_RATES, Site, Staff } from '@/types';

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
  const { addDailyLog, dailyLogs, staffList, attendances, sites, paymentStageMaster, stageCompletionRequests, addStageCompletionRequest, updateSite } = useApp();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Attendances for today
  const todayAttendances = (attendances || []).filter(a => a.date === todayStr);

  // Staff's own attendance for today
  const myAtt = todayAttendances.find(a => a.staffId === staff?.id);
  const isSelfPresent = myAtt?.status === 'present' || myAtt?.status === 'half-day';
  const availableCrew = myAtt?.presentCounts || { painter: 0, plumber: 0, labour: 0 };

  const defaultSiteId = useMemo(() => {
    return myAtt?.siteId || localStorage.getItem('today_active_site_id') || (mySites.length > 0 ? mySites[0].id : '');
  }, [myAtt?.siteId, mySites]);

  const [siteId, setSiteId] = useState(defaultSiteId);
  const [siteSearch, setSiteSearch] = useState('');
  const [customSiteMode, setCustomSiteMode] = useState(false);
  const [customSiteName, setCustomSiteName] = useState('');
  const [visitReason, setVisitReason] = useState('');
  const [hoursWorked, setHoursWorked] = useState('8');
  const [workDesc, setWorkDesc] = useState('');
  const [income, setIncome] = useState('');
  const [workerCounts, setWorkerCounts] = useState({ painter: 0, plumber: 0, labour: 0 });
  const [selectedWorkLevel, setSelectedWorkLevel] = useState('');
  const [completionNote, setCompletionNote] = useState('');
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);

  // Auto-sync defaultSiteId if siteId is empty
  useEffect(() => {
    if (!siteId && defaultSiteId) {
      setSiteId(defaultSiteId);
    }
  }, [defaultSiteId, siteId]);

  // Auto-fill worker counts when siteId changes
  useEffect(() => {
    if (siteId && myAtt) {
      const assignment = myAtt.siteAssignments?.find(sa => sa.siteId === siteId);
      if (assignment) {
        setWorkerCounts(assignment.counts);
      } else if (availableCrew && (availableCrew.painter > 0 || availableCrew.plumber > 0 || availableCrew.labour > 0)) {
        setWorkerCounts(availableCrew);
      }
    }
  }, [siteId, myAtt, availableCrew]);

  // Transport
  const [transportMode, setTransportMode] = useState<TransportMode>('bike');
  const [transportCustomCost, setTransportCustomCost] = useState('');

  // Additional expenses
  const [expenses, setExpenses] = useState<{ itemName: string; amount: number }[]>([]);
  const [expenseMode, setExpenseMode] = useState<'bus' | 'auto' | 'bike_petrol' | 'food' | 'other'>('bus');
  const [expenseCustom, setExpenseCustom] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  const addExpense = () => {
    const finalName = expenseMode === 'other' ? expenseCustom.trim() : expenseMode;
    if (!finalName) { toast.error('Enter expense type/name'); return; }
    if (!expenseAmount) { toast.error('Enter the amount'); return; }
    setExpenses(prev => [...prev, { itemName: finalName, amount: Number(expenseAmount) || 0 }]);
    setExpenseMode('bus'); setExpenseCustom(''); setExpenseAmount('');
  };

  const removeExpense = (i: number) => setExpenses(prev => prev.filter((_, idx) => idx !== i));

  // Selected site object
  const selectedSite = useMemo(() => sites.find(s => s.id === siteId), [sites, siteId]);

  // Sequential stages calculation with strict sequential progression
  const siteStages = useMemo(() => {
    if (!selectedSite || customSiteMode) return [];

    // Master list of stages for this site
    const masterStages = paymentStageMaster.length > 0
      ? paymentStageMaster
      : (selectedSite.paymentStages || []).map(s => s.stageName);

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
      : mySites.find(s => s.id === siteId)?.name || '';

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

    const transportCost = transportMode === 'car' && transportCustomCost
      ? Number(transportCustomCost)
      : TRANSPORT_RATES[transportMode];

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    addDailyLog({
      staffId: staff?.id || '',
      staffName: staff?.name || '',
      siteId: customSiteMode ? `custom_${Date.now()}` : siteId,
      siteName: finalSiteName,
      date: todayStr,
      materials: [],
      transportMode,
      transportCost,
      expenses,
      incomeFromClient: Number(income) || 0,
      notes: [
        customSiteMode ? `[New/Custom Visit: ${visitReason.trim()}]` : '',
        workDesc.trim()
      ].filter(Boolean).join('\n'),
      workerCounts: {
        painter: Math.min(workerCounts.painter, availableCrew.painter),
        plumber: Math.min(workerCounts.plumber, availableCrew.plumber),
        labour: Math.min(workerCounts.labour, availableCrew.labour),
      },
      workLevelStage: effectiveStage,
    });

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

    toast.success(effectiveStage ? `Work log & expenses recorded for ${effectiveStage}!` : 'Work entry submitted successfully!');
    setWorkDesc('');
    setIncome('');
    setExpenses([]);
    setTransportCustomCost('');
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
            {/* Left Column (now top): Site Selection, Milestone & Description */}
            <div className="space-y-4">

          {/* Site selection */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
              <MapPin className="w-3.5 h-3.5" /> Select Site
            </Label>

            {mySites.length > 3 && (
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search site or client..."
                  value={siteSearch}
                  onChange={e => setSiteSearch(e.target.value)}
                  className="h-10 rounded-xl pl-8 text-sm"
                />
              </div>
            )}

            {mySites.length === 0 ? (
              <div className="text-center py-6 bg-muted/40 rounded-xl border border-border/50">
                <p className="text-xs text-muted-foreground">No sites assigned to you</p>
              </div>
            ) : (() => {
              const filtered = mySites.filter(s =>
                s.name.toLowerCase().includes(siteSearch.toLowerCase()) ||
                s.clientName.toLowerCase().includes(siteSearch.toLowerCase())
              );
              return filtered.length === 0 ? (
                <div className="text-center py-5 bg-muted/40 rounded-xl border border-border/50">
                  <p className="text-xs text-muted-foreground">No sites match "{siteSearch}"</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(s => {
                    const isActive = s.status === 'active';
                    const isSelected = siteId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!isActive}
                        onClick={() => {
                          if (isActive) {
                            setSiteId(s.id);
                            setSiteSearch('');
                            // Auto-fill workerCounts from attendance siteAssignments
                            const assignment = myAtt?.siteAssignments?.find(sa => sa.siteId === s.id);
                            if (assignment) {
                              setWorkerCounts(assignment.counts);
                            } else {
                              setWorkerCounts({ painter: 0, plumber: 0, labour: 0 });
                            }
                          }
                        }}
                        className={`w-full text-left rounded-xl px-3.5 py-3 border transition-all flex items-center justify-between gap-3
                          ${isSelected
                            ? 'border-[hsl(38_72%_42%)] bg-[hsl(38_72%_42%/0.08)] shadow-sm'
                            : isActive
                              ? 'border-border/60 bg-card hover:border-[hsl(38_72%_42%/0.5)] hover:bg-muted/40 active:scale-[0.98]'
                              : 'border-border/30 bg-muted/20 opacity-50 cursor-not-allowed'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? 'bg-green-500' : s.status === 'completed' ? 'bg-gray-400' : 'bg-amber-400'}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate leading-tight">{s.name}</p>
                            {s.clientName && (
                              <p className="text-[10px] text-muted-foreground truncate">{s.clientName}</p>
                            )}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 capitalize ${isActive
                          ? 'bg-green-500/15 text-green-600'
                          : s.status === 'completed'
                            ? 'bg-gray-400/15 text-gray-500'
                            : 'bg-amber-400/15 text-amber-600'
                          }`}>
                          {s.status.replace('-', ' ')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

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
              {customSiteMode ? 'Choose from My Sites list instead' : 'Visited a new / unlisted site or office? Click here'}
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
        </div>

        {/* Right Column (now bottom): Crew, Materials, Expenses, Income & Submission */}
        <div className="space-y-4">
          {/* Crew Members Included (Based on Attendance) */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" /> Crew Members Present at this Site
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Assign your available crew members to this site. <br />
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">✨ Auto-filled based on your Team Attendance site assignments.</span><br />
                (Available: {availableCrew.painter} Painters, {availableCrew.plumber} Plumbers, {availableCrew.labour} Labourers)
              </p>
            </div>

            {/* Attendance Status Alert if not marked yet */}
            {!isSelfPresent && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>You have not marked your attendance for today ({todayStr}).</span>
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

            {/* Crew Counts Inputs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'painter' as const, label: 'Painters' },
                { id: 'plumber' as const, label: 'Plumbers' },
                { id: 'labour' as const, label: 'Labourers' }
              ].map(cat => {
                const maxAvailable = availableCrew[cat.id];
                return (
                  <div key={cat.id} className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-muted-foreground">{cat.label}</Label>
                    <Input
                      type="number"
                      readOnly
                      value={workerCounts[cat.id] || 0}
                      className="h-9 text-xs rounded-xl bg-muted/50 text-muted-foreground cursor-not-allowed focus-visible:ring-0"
                    />
                    <p className="text-[9px] text-muted-foreground text-center">
                      Auto-synced
                    </p>
                  </div>
                );
              })}
            </div>

            {Object.values(workerCounts).reduce((a, b) => a + b, 0) > 0 && (
              <p className="text-[11px] text-primary font-medium pt-1">
                ✓ {Object.values(workerCounts).reduce((a, b) => a + b, 0)} crew members assigned to this site
              </p>
            )}
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


          {/* Extra Expenses */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Additional Daily Expenses</Label>
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <select
                  value={expenseMode}
                  onChange={e => setExpenseMode(e.target.value as any)}
                  className="h-10 rounded-xl border border-input bg-card px-3 text-xs font-medium"
                >
                  <option value="bus">Bus Ticket</option>
                  <option value="auto">Auto Fare</option>
                  <option value="bike_petrol">Bike Petrol</option>
                  <option value="food">Site Food/Tea</option>
                  <option value="other">Other Expense</option>
                </select>
                {expenseMode === 'other' && (
                  <Input
                    placeholder="Expense name"
                    value={expenseCustom}
                    onChange={e => setExpenseCustom(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                  />
                )}
                <Input
                  type="number"
                  placeholder="Amount (₹)"
                  value={expenseAmount}
                  onChange={e => setExpenseAmount(e.target.value)}
                  className="h-10 rounded-xl text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addExpense}
                className="w-full h-9 rounded-xl text-xs gap-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Add Expense
              </Button>

              {expenses.length > 0 && (
                <div className="space-y-1 pt-1">
                  {expenses.map((exp, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-muted/40 p-2 rounded-xl text-xs">
                      <span className="capitalize text-foreground font-medium">{exp.itemName}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">₹{exp.amount}</span>
                        <button type="button" onClick={() => removeExpense(idx)} className="text-destructive hover:opacity-70">
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
          <div>
            <Label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Income Collected from Client Today (if any)
            </Label>
            <Input
              type="number"
              placeholder="₹ 0"
              value={income}
              onChange={e => setIncome(e.target.value)}
              className="h-10 rounded-xl text-xs font-semibold"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 rounded-xl font-bold text-white text-sm shadow-md mt-2"
            style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
          >
            Submit Daily Work Entry
          </Button>
            </div>
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
