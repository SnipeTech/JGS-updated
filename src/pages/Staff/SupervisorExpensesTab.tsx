import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  IndianRupee, Send, CheckCircle2, Clock, AlertCircle, Trash2,
  Calendar, Receipt, Sparkles, HelpCircle, FileText
} from 'lucide-react';
import { Staff } from '@/types';

interface SupervisorExpensesTabProps {
  staff: Staff | undefined;
}

const QUICK_EXPENSE_PRESETS = [
  { label: '⛽ Petrol / Fuel', text: 'Petrol & fuel for supervisor travel and site inspections' },
  { label: '🚗 Conveyance / Travel', text: 'Supervisor conveyance fare and travel transit' },
  { label: '🍵 Crew Refreshment', text: 'Daily tea and snacks for on-duty workforce crew' },
  { label: '🛠️ Urgent Consumables', text: 'Emergency local consumables, tape, screws, minor site items' },
  { label: '📋 Supervisor Allowance', text: 'Daily supervisor site expense allowance' },
];

export const SupervisorExpensesTab = ({ staff }: SupervisorExpensesTabProps) => {
  const { attendances, submitSupervisorExpenseClaim, deleteSupervisorExpenseClaim } = useApp();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [claimDate, setClaimDate] = useState<string>(todayStr);
  const [claimAmount, setClaimAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [expenseNotes, setExpenseNotes] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'rejected'>('all');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Existing claims for this supervisor: strictly records where expenseAmount > 0
  const myClaims = useMemo(() => {
    if (!staff?.id) return [];
    return (attendances || [])
      .filter(a => a.staffId === staff.id && Number(a.expenseAmount) > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendances, staff?.id]);

  // Existing claim for the currently selected date
  const existingClaimForSelectedDate = useMemo(() => {
    if (!staff?.id) return null;
    return (attendances || []).find(a => a.staffId === staff.id && a.date === claimDate && Number(a.expenseAmount) > 0);
  }, [attendances, staff?.id, claimDate]);

  // Aggregated KPIs
  const kpis = useMemo(() => {
    let pendingCount = 0;
    let pendingTotal = 0;
    let paidTotal = 0;
    let rejectedCount = 0;

    myClaims.forEach(c => {
      const amt = Number(c.expenseAmount) || 0;
      const paidAmt = Number(c.expensePaidAmount ?? c.expenseAmount) || 0;
      if (c.expenseStatus === 'paid') {
        paidTotal += paidAmt;
      } else if (c.expenseStatus === 'rejected') {
        rejectedCount += 1;
      } else {
        pendingCount += 1;
        pendingTotal += amt;
      }
    });

    return { pendingCount, pendingTotal, paidTotal, rejectedCount, totalClaims: myClaims.length };
  }, [myClaims]);

  // Filtered claims list
  const filteredClaims = useMemo(() => {
    if (statusFilter === 'all') return myClaims;
    return myClaims.filter(c => {
      if (statusFilter === 'pending') return !c.expenseStatus || c.expenseStatus === 'pending';
      return c.expenseStatus === statusFilter;
    });
  }, [myClaims, statusFilter]);

  const handleSubmitClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff?.id) {
      toast.error('Supervisor details missing');
      return;
    }

    const amt = Number(claimAmount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid claim amount greater than ₹0');
      return;
    }

    if (!expenseNotes.trim()) {
      toast.error('Please enter the reason and explanation for why this amount is required');
      return;
    }

    setIsSubmitting(true);
    try {
      submitSupervisorExpenseClaim({
        staffId: staff.id,
        date: claimDate,
        amount: amt,
        notes: expenseNotes.trim(),
        paymentMethod,
        siteId: '',
        siteName: 'General / Supervisor Expense',
      });

      toast.success(`Supervisor expense of ₹${amt.toLocaleString()} submitted to Admin for approval & payout!`);
      // Reset form fields
      setClaimAmount('');
      setExpenseNotes('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit expense claim');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClaim = (dateToDelete: string) => {
    if (!staff?.id) return;
    if (window.confirm(`Are you sure you want to cancel and delete the supervisor expense for ${dateToDelete}?`)) {
      deleteSupervisorExpenseClaim(staff.id, dateToDelete);
      toast.info(`Claim for ${dateToDelete} deleted permanently.`);
    }
  };

  const handleApplyPreset = (presetText: string) => {
    setExpenseNotes(prev => (prev ? `${prev}, ${presetText}` : presetText));
  };

  return (
    <div className="space-y-6 animate-slide-up pb-12">
      {/* ── Top Header Banner ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/20 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-extrabold text-foreground tracking-tight flex items-center gap-2">
              Supervisor Expenses
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Supervisor Portal
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Submit supervisor out-of-pocket expenses (petrol, conveyance, tea & snacks, allowance). Not site related. Admin verifies and reimburses before adding to company expenses.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Logged as:</span>
          <span className="text-xs font-bold text-foreground bg-card px-3 py-1.5 rounded-xl border border-border/60 shadow-2xs">
            {staff?.name} (Supervisor)
          </span>
        </div>
      </div>

      {/* ── KPI Overview Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-4 rounded-2xl border-border/60 bg-card/80 backdrop-blur-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending Payout</p>
            <h3 className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
              ₹{kpis.pendingTotal.toLocaleString()}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{kpis.pendingCount} claim(s) awaiting Admin</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border-border/60 bg-card/80 backdrop-blur-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Verified & Paid</p>
            <h3 className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
              ₹{kpis.paidTotal.toLocaleString()}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Reimbursed to you</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border-border/60 bg-card/80 backdrop-blur-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rejected Claims</p>
            <h3 className="text-xl font-extrabold text-destructive mt-0.5">
              {kpis.rejectedCount}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Adjust reason & resubmit</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border-border/60 bg-card/80 backdrop-blur-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Records</p>
            <h3 className="text-xl font-extrabold text-foreground mt-0.5">
              {kpis.totalClaims}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Supervisor expenses</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left Column: Submit Supervisor Expense (5 cols) ── */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 rounded-3xl border-border/60 bg-card shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="font-heading font-extrabold text-sm text-foreground">
                  Submit Supervisor Expense
                </h3>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                General Expense
              </span>
            </div>

            {existingClaimForSelectedDate && (
              <div className={`p-3 rounded-2xl text-xs border ${
                existingClaimForSelectedDate.expenseStatus === 'paid'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : existingClaimForSelectedDate.expenseStatus === 'rejected'
                    ? 'bg-destructive/10 border-destructive/30 text-destructive'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
              }`}>
                <div className="flex items-center justify-between gap-1 font-bold">
                  <span>Current Claim for {claimDate}:</span>
                  <span className="uppercase text-[10px] px-2 py-0.5 rounded-md bg-background/80">
                    {existingClaimForSelectedDate.expenseStatus || 'pending'}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span>Claimed: ₹{(existingClaimForSelectedDate.expenseAmount || 0).toLocaleString()}</span>
                  {existingClaimForSelectedDate.expenseStatus === 'paid' && (
                    <span className="font-semibold text-[11px]">Paid: ₹{(existingClaimForSelectedDate.expensePaidAmount || existingClaimForSelectedDate.expenseAmount || 0).toLocaleString()}</span>
                  )}
                </div>
                {existingClaimForSelectedDate.expenseRejectionReason && (
                  <p className="mt-1 text-[11px] font-semibold text-destructive">
                    Reason: {existingClaimForSelectedDate.expenseRejectionReason}
                  </p>
                )}
                {existingClaimForSelectedDate.expenseStatus === 'paid' ? (
                  <p className="mt-1 text-[10px] opacity-80">
                    This claim has been approved & paid by Admin.
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] opacity-80">
                    Submitting below will update this claim for {claimDate}.
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleSubmitClaim} className="space-y-4">
              {/* Date & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Expense Date *
                  </Label>
                  <Input
                    type="date"
                    value={claimDate}
                    onChange={e => setClaimDate(e.target.value)}
                    className="h-10 text-xs rounded-xl bg-muted/20 border-border/60 font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-amber-600" /> Amount Required (₹) *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      min="1"
                      placeholder="e.g. 350"
                      value={claimAmount}
                      onChange={e => setClaimAmount(e.target.value)}
                      className="h-10 text-sm font-extrabold pl-7 rounded-xl bg-muted/20 border-border/60"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Requested Payout Mode */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Preferred Reimbursement Mode
                </Label>
                <Select
                  value={paymentMethod}
                  onValueChange={setPaymentMethod}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl bg-muted/20 border-border/60">
                    <SelectValue placeholder="Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">💵 Cash</SelectItem>
                    <SelectItem value="UPI">📱 UPI / GPay / PhonePe</SelectItem>
                    <SelectItem value="Bank Transfer">🏦 Bank Transfer</SelectItem>
                    <SelectItem value="Card">💳 Card</SelectItem>
                    <SelectItem value="Cheque">📝 Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quick Category Presets */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                  Quick Purpose Presets
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_EXPENSE_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p.text)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300 border border-border/50 transition-all text-muted-foreground"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Required Notes / Reason for Expense */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-500" />
                    Why this amount is required (Reason / Notes) *
                  </Label>
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    Required for Admin
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={expenseNotes}
                  onChange={e => setExpenseNotes(e.target.value)}
                  placeholder="Explain why this expense is required (e.g. Petrol for visiting multiple sites & meetings, tea and snacks for workforce, urgent local hardware purchase)..."
                  className="w-full text-xs p-3 rounded-xl bg-muted/20 border border-border/60 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500 outline-hidden font-medium resize-none transition-all"
                  required
                />
              </div>

              {/* How it works info */}
              <div className="p-3 rounded-2xl bg-amber-500/[0.07] border border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-200/90 leading-relaxed">
                <p className="font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                  Admin Verification Notice:
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  This claim is sent directly to Admin's <span className="font-bold text-foreground">Supervisor Expenses</span> tab. Admin reviews your reason and verifies & reimburses the amount before adding it to company expenses.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || existingClaimForSelectedDate?.expenseStatus === 'paid'}
                className="w-full h-11 rounded-xl text-xs font-bold gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-md shadow-amber-600/20 transition-all"
              >
                <Send className="w-4 h-4" />
                {existingClaimForSelectedDate?.expenseStatus === 'rejected'
                  ? 'Re-submit Supervisor Expense to Admin'
                  : existingClaimForSelectedDate
                    ? 'Update Supervisor Expense to Admin'
                    : 'Submit Supervisor Expense to Admin'}
              </Button>
            </form>
          </Card>
        </div>

        {/* ── Right Column: Claims History & Status (7 cols) ── */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-5 rounded-3xl border-border/60 bg-card shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
              <div>
                <h3 className="font-heading font-extrabold text-sm text-foreground flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  Supervisor Claims & Payout History
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Track the status and reimbursement of your submitted supervisor expenses.
                </p>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/50 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    statusFilter === 'all'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All ({myClaims.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    statusFilter === 'pending'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Pending ({kpis.pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('paid')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    statusFilter === 'paid'
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Paid
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('rejected')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    statusFilter === 'rejected'
                      ? 'bg-destructive/20 text-destructive font-extrabold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Rejected
                </button>
              </div>
            </div>

            {/* Claims List */}
            {filteredClaims.length === 0 ? (
              <div className="p-12 text-center space-y-3 rounded-2xl bg-muted/20 border border-dashed border-border/60">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mx-auto">
                  <Receipt className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-foreground">No Supervisor Expenses Recorded</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {statusFilter === 'all'
                    ? "You haven't submitted any supervisor expenses yet. Use the form on the left to submit an expense."
                    : `No supervisor expenses with status "${statusFilter}".`}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                {filteredClaims.map((claim) => {
                  const isPaid = claim.expenseStatus === 'paid';
                  const isRejected = claim.expenseStatus === 'rejected';
                  const isPending = !isPaid && !isRejected;

                  return (
                    <div
                      key={claim.date}
                      className={`p-4 rounded-2xl border transition-all ${
                        isPaid
                          ? 'bg-emerald-500/[0.04] border-emerald-500/30 hover:border-emerald-500/50'
                          : isRejected
                            ? 'bg-destructive/[0.04] border-destructive/30 hover:border-destructive/50'
                            : 'bg-card border-border/60 hover:border-amber-500/40 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            {format(new Date(claim.date), 'dd MMM yyyy')}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-lg">
                            General Expense
                          </span>
                        </div>

                        {/* Status Badge & Actions */}
                        <div className="shrink-0 flex items-center gap-2">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wide">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Approved & Paid
                            </span>
                          ) : isRejected ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/15 text-destructive border border-destructive/30 text-[10px] font-extrabold uppercase tracking-wide">
                              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                              Rejected by Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wide">
                              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                              Pending Verification
                            </span>
                          )}

                          {/* Delete/Cancel Button if pending */}
                          {isPending && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClaim(claim.date)}
                              title="Delete claim"
                              className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Amounts & Payment info */}
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-2.5 rounded-xl bg-muted/40 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Claimed</span>
                          <p className="font-extrabold text-foreground text-sm mt-0.5">
                            ₹{(claim.expenseAmount || 0).toLocaleString()}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payout Mode</span>
                          <p className="font-semibold text-foreground text-xs mt-0.5">
                            {claim.expensePaymentMethod || 'Cash'}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Disbursed</span>
                          <p className={`font-extrabold text-sm mt-0.5 ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                            {isPaid ? `₹${(claim.expensePaidAmount || claim.expenseAmount || 0).toLocaleString()}` : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Why Required / Notes */}
                      {claim.expenseNotes && (
                        <div className="mt-2.5 text-xs text-muted-foreground bg-card/60 p-2.5 rounded-xl border border-border/40">
                          <span className="font-bold text-foreground">Why Required: </span>
                          {claim.expenseNotes}
                        </div>
                      )}

                      {/* Paid Details Feedback */}
                      {isPaid && (
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold px-2">
                          <span>
                            ✓ Paid on {claim.expensePaidAt || 'recently'} {claim.expenseVerifiedBy ? `by ${claim.expenseVerifiedBy}` : ''}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                            Added to Company Expenses
                          </span>
                        </div>
                      )}

                      {/* Rejection Details Feedback */}
                      {isRejected && (
                        <div className="mt-2.5 p-2 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center justify-between gap-2">
                          <span>
                            <span className="font-bold">Rejection Reason:</span> {claim.expenseRejectionReason || 'Not approved'}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setClaimDate(claim.date);
                              setClaimAmount(String(claim.expenseAmount || ''));
                              setExpenseNotes(claim.expenseNotes || '');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="h-6 text-[10px] px-2 rounded-lg font-bold border-destructive/40 hover:bg-destructive/15 text-destructive"
                          >
                            Edit & Resubmit
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
