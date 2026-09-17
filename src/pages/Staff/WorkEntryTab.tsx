import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Send, MapPin, Users, Package, Clock, Plus, Trash2,
  Bike, Bus, Car, Footprints, AlertCircle, Search, Sparkles
} from 'lucide-react';
import { Material, TransportMode, TRANSPORT_RATES, Site, Staff } from '@/types';

interface WorkEntryTabProps {
  staff: Staff | undefined;
  mySites: Site[];
  onSubmissionSuccess?: () => void;
  onNavigateToMaterialRequest?: () => void;
  onNavigateToAttendance?: () => void;
}

export const WorkEntryTab = ({
  staff,
  mySites,
  onSubmissionSuccess,
  onNavigateToMaterialRequest,
  onNavigateToAttendance
}: WorkEntryTabProps) => {
  const { addDailyLog, staffList, attendances } = useApp();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const [siteId, setSiteId] = useState('');
  const [siteSearch, setSiteSearch] = useState('');
  const [customSiteMode, setCustomSiteMode] = useState(false);
  const [customSiteName, setCustomSiteName] = useState('');
  const [visitReason, setVisitReason] = useState('');
  const [hoursWorked, setHoursWorked] = useState('8');
  const [workDesc, setWorkDesc] = useState('');
  const [income, setIncome] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);

  // Attendances for today
  const todayAttendances = (attendances || []).filter(a => a.date === todayStr);

  // List of crew / staff members who can be included
  const candidateStaff = staffList.filter(s => s.role !== 'admin');

  // Staff marked present or half-day today
  const presentStaffIds = todayAttendances
    .filter(a => a.status === 'present' || a.status === 'half-day')
    .map(a => a.staffId);

  // Materials list
  const [materials, setMaterials] = useState<Material[]>([]);
  const [matName, setMatName] = useState('');
  const [matQty, setMatQty] = useState('');

  // Transport
  const [transportMode, setTransportMode] = useState<TransportMode>('bike');
  const [transportCustomCost, setTransportCustomCost] = useState('');

  // Additional expenses
  const [expenses, setExpenses] = useState<{ itemName: string; amount: number }[]>([]);
  const [expenseMode, setExpenseMode] = useState<'bus' | 'auto' | 'bike_petrol' | 'food' | 'other'>('bus');
  const [expenseCustom, setExpenseCustom] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  const addMaterial = () => {
    if (!matName.trim()) { toast.error('Enter material name'); return; }
    if (!matQty || Number(matQty) <= 0) { toast.error('Enter a valid quantity'); return; }
    setMaterials(prev => [...prev, { name: matName.trim(), quantity: Number(matQty), cost: 0 }]);
    setMatName(''); setMatQty('');
  };

  const removeMaterial = (i: number) => setMaterials(prev => prev.filter((_, idx) => idx !== i));

  const addExpense = () => {
    const finalName = expenseMode === 'other' ? expenseCustom.trim() : expenseMode;
    if (!finalName) { toast.error('Enter expense type/name'); return; }
    if (!expenseAmount) { toast.error('Enter the amount'); return; }
    setExpenses(prev => [...prev, { itemName: finalName, amount: Number(expenseAmount) || 0 }]);
    setExpenseMode('bus'); setExpenseCustom(''); setExpenseAmount('');
  };

  const removeExpense = (i: number) => setExpenses(prev => prev.filter((_, idx) => idx !== i));

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
      materials,
      transportMode,
      transportCost,
      expenses,
      incomeFromClient: Number(income) || 0,
      notes: [
        customSiteMode ? `[New/Custom Visit: ${visitReason.trim()}]` : '',
        workDesc.trim()
      ].filter(Boolean).join('\n'),
      workerIds: selectedWorkers,
    });

    toast.success('Work entry submitted successfully!');
    setSiteId(''); setCustomSiteMode(false); setCustomSiteName(''); setVisitReason('');
    setWorkDesc(''); setIncome(''); setMaterials([]); setExpenses([]);
    setSelectedWorkers([]); setTransportCustomCost('');
    onSubmissionSuccess?.();
  };

  const isSupervisor = staff?.role === 'supervisor';
  const otherStaff = staffList.filter(s => s.id !== staff?.id && s.role !== 'admin');

  return (
    <div className="animate-slide-up-delay-2 max-w-3xl">
      <form onSubmit={handleSubmit}>
        <div className="form-card mb-5">
          <div className="section-title flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}>
              <Send className="w-4 h-4 text-white" />
            </div>
            Daily Work Entry
          </div>

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
                        onClick={() => { if (isActive) { setSiteId(s.id); setSiteSearch(''); } }}
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

          {/* Work Description */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Clock className="w-3.5 h-3.5" /> Work Description *
            </Label>
            <Textarea
              placeholder="Describe work completed today, milestones, issues encountered..."
              value={workDesc}
              onChange={e => setWorkDesc(e.target.value)}
              rows={3}
              className="rounded-xl text-sm"
              required
            />
          </div>

          {/* Staff & Crew Included (Based on Attendance) */}
          <div className="space-y-2 pt-1 border-t border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" /> Staff & Crew Included (Based on Attendance)
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Select staff members who worked on this site today. Present staff are highlighted.
                </p>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                {presentStaffIds.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Select all who are present
                      setSelectedWorkers(Array.from(new Set([...selectedWorkers, ...presentStaffIds])));
                    }}
                    className="h-7 text-[11px] px-2.5 rounded-lg font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                  >
                    Select All Present ({presentStaffIds.length})
                  </Button>
                )}
                {selectedWorkers.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedWorkers([])}
                    className="h-7 text-[11px] px-2 rounded-lg text-muted-foreground hover:text-destructive"
                  >
                    Clear ({selectedWorkers.length})
                  </Button>
                )}
              </div>
            </div>

            {/* Attendance Status Alert if not marked yet */}
            {todayAttendances.length === 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Attendance has not been marked yet for today ({todayStr}).</span>
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

            {/* Candidate Staff Chips Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {candidateStaff.map(s => {
                const isSelected = selectedWorkers.includes(s.id);
                const att = todayAttendances.find(a => a.staffId === s.id);
                const isPresent = att?.status === 'present';
                const isHalf = att?.status === 'half-day';
                const isAbsent = att?.status === 'absent';

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedWorkers(prev =>
                        prev.includes(s.id)
                          ? prev.filter(id => id !== s.id)
                          : [...prev, s.id]
                      );
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-primary/10 border-primary shadow-xs font-semibold'
                        : isPresent || isHalf
                        ? 'bg-card border-emerald-500/30 hover:border-primary/50'
                        : isAbsent
                        ? 'bg-muted/30 border-border/40 opacity-60 hover:opacity-100'
                        : 'bg-card border-border/50 hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent div onClick
                        className="rounded accent-primary w-3.5 h-3.5"
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground truncate block">{s.name}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">{s.role}</span>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2 text-right">
                      {isPresent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          ✅ Present
                        </span>
                      )}
                      {isHalf && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          ⚡ Half-Day
                        </span>
                      )}
                      {isAbsent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 text-destructive">
                          ❌ Absent
                        </span>
                      )}
                      {!att && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                          Not Marked
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedWorkers.length > 0 && (
              <p className="text-[11px] text-primary font-medium pt-1">
                ✓ {selectedWorkers.length} staff member{selectedWorkers.length === 1 ? '' : 's'} attached to this work entry
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Package className="w-3.5 h-3.5" /> Materials Used Today
            </Label>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Material name"
                  value={matName}
                  onChange={e => setMatName(e.target.value)}
                  className="col-span-2 h-10 rounded-xl text-xs"
                />
                <Input
                  type="number"
                  placeholder="Qty"
                  value={matQty}
                  onChange={e => setMatQty(e.target.value)}
                  className="h-10 rounded-xl text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMaterial}
                className="w-full h-9 rounded-xl text-xs gap-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Add Material
              </Button>

              {materials.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {materials.map((m, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-xl text-xs">
                      <span className="font-semibold text-foreground">{m.name} × {m.quantity}</span>
                      <button type="button" onClick={() => removeMaterial(i)} className="text-destructive hover:opacity-70">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {onNavigateToMaterialRequest && (
                <div className="pt-2 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onNavigateToMaterialRequest}
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
      </form>
    </div>
  );
};
export default WorkEntryTab;
