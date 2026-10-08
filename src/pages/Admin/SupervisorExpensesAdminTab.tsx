import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  IndianRupee, CheckCircle2, Clock, AlertCircle, Trash2,
  Calendar, Receipt, Search, DollarSign, FileText
} from 'lucide-react';
import { Attendance } from '@/types';

export const SupervisorExpensesAdminTab = () => {
  const {
    attendances,
    staffList,
    verifyAndPaySupervisorExpense,
    rejectSupervisorExpense,
    deleteSupervisorExpenseClaim,
  } = useApp();

  // Filter States
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'rejected'>('pending');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [payModalClaim, setPayModalClaim] = useState<Attendance | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('Cash');
  const [payNotes, setPayNotes] = useState<string>('');

  const [rejectModalClaim, setRejectModalClaim] = useState<Attendance | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Supervisors list
  const supervisors = useMemo(() => {
    return staffList.filter(s => s.role === 'supervisor');
  }, [staffList]);

  // All claims from attendance records: strictly only records where expenseAmount > 0
  const allClaims = useMemo(() => {
    return (attendances || [])
      .filter(a => Number(a.expenseAmount) > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendances]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    let pendingCount = 0;
    let pendingTotal = 0;
    let paidCount = 0;
    let paidTotal = 0;
    let rejectedCount = 0;

    allClaims.forEach(c => {
      const amt = Number(c.expenseAmount) || 0;
      const paidAmt = Number(c.expensePaidAmount ?? c.expenseAmount) || 0;
      if (c.expenseStatus === 'paid') {
        paidCount += 1;
        paidTotal += paidAmt;
      } else if (c.expenseStatus === 'rejected') {
        rejectedCount += 1;
      } else {
        pendingCount += 1;
        pendingTotal += amt;
      }
    });

    return {
      pendingCount,
      pendingTotal,
      paidCount,
      paidTotal,
      rejectedCount,
      totalClaims: allClaims.length,
    };
  }, [allClaims]);

  // Filtered Claims
  const filteredClaims = useMemo(() => {
    return allClaims.filter(claim => {
      // Status filter
      if (statusFilter === 'pending') {
        if (claim.expenseStatus === 'paid' || claim.expenseStatus === 'rejected') return false;
      } else if (statusFilter !== 'all') {
        if (claim.expenseStatus !== statusFilter) return false;
      }

      // Staff filter
      if (selectedStaffId !== 'all' && claim.staffId !== selectedStaffId) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const staffObj = staffList.find(s => s.id === claim.staffId);
        const matchStaff = staffObj?.name.toLowerCase().includes(query);
        const matchNotes = (claim.expenseNotes || '').toLowerCase().includes(query);
        const matchDate = claim.date.includes(query);
        if (!matchStaff && !matchNotes && !matchDate) return false;
      }

      return true;
    });
  }, [allClaims, statusFilter, selectedStaffId, searchQuery, staffList]);

  // Open Pay Modal
  const handleOpenPayModal = (claim: Attendance) => {
    setPayModalClaim(claim);
    setPayAmount(String(claim.expensePaidAmount || claim.expenseAmount || ''));
    setPayMethod(claim.expensePaymentMethod || 'Cash');
    setPayNotes(claim.expenseNotes || '');
  };

  // Submit Pay
  const handleConfirmPayout = () => {
    if (!payModalClaim) return;
    const amountNum = Number(payAmount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Please enter a valid disbursement amount greater than ₹0');
      return;
    }

    try {
      verifyAndPaySupervisorExpense(payModalClaim.staffId, payModalClaim.date, {
        paidAmount: amountNum,
        paymentMethod: payMethod,
        notes: payNotes.trim(),
      });

      const staffObj = staffList.find(s => s.id === payModalClaim.staffId);
      toast.success(
        `Approved & Paid ₹${amountNum.toLocaleString()} to ${staffObj?.name || 'Supervisor'}! Added to company expense report.`
      );
      setPayModalClaim(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to disburse expense');
    }
  };

  // Open Reject Modal
  const handleOpenRejectModal = (claim: Attendance) => {
    setRejectModalClaim(claim);
    setRejectionReason(claim.expenseRejectionReason || '');
  };

  // Submit Reject
  const handleConfirmReject = () => {
    if (!rejectModalClaim) return;
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejecting this claim');
      return;
    }

    try {
      rejectSupervisorExpense(rejectModalClaim.staffId, rejectModalClaim.date, rejectionReason.trim());
      const staffObj = staffList.find(s => s.id === rejectModalClaim.staffId);
      toast.info(`Claim rejected for ${staffObj?.name || 'Supervisor'}.`);
      setRejectModalClaim(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject claim');
    }
  };

  const handleDeleteClaim = (claim: Attendance) => {
    const staffObj = staffList.find(s => s.id === claim.staffId);
    if (window.confirm(`Permanently delete supervisor expense claim of ₹${claim.expenseAmount} from ${staffObj?.name || 'Supervisor'} on ${claim.date}?`)) {
      deleteSupervisorExpenseClaim(claim.staffId, claim.date);
      toast.info('Supervisor expense permanently deleted.');
    }
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
              {kpis.pendingCount > 0 && (
                <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                  {kpis.pendingCount} Pending Action
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review supervisor claims (travel, petrol, conveyance, allowance). Not site related. Once verified & paid, claims automatically reflect in the company P&L expense report.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-semibold">Total Verified:</span>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 shadow-2xs">
            ₹{kpis.paidTotal.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card
          onClick={() => setStatusFilter('pending')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'pending'
              ? 'border-amber-500/80 bg-amber-500/10 ring-2 ring-amber-500/20'
              : 'border-border/60 bg-card/80 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending Review</p>
              <h3 className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                ₹{kpis.pendingTotal.toLocaleString()}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">
                {kpis.pendingCount} claim(s) awaiting payout
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
          </div>
        </Card>

        <Card
          onClick={() => setStatusFilter('paid')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'paid'
              ? 'border-emerald-500/80 bg-emerald-500/10 ring-2 ring-emerald-500/20'
              : 'border-border/60 bg-card/80 hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Verified & Paid</p>
              <h3 className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{kpis.paidTotal.toLocaleString()}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">
                {kpis.paidCount} claims disbursed & in ledger
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card
          onClick={() => setStatusFilter('rejected')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'rejected'
              ? 'border-destructive/80 bg-destructive/10 ring-2 ring-destructive/20'
              : 'border-border/60 bg-card/80 hover:border-destructive/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rejected Claims</p>
              <h3 className="text-xl font-extrabold text-destructive mt-0.5">
                {kpis.rejectedCount}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Declined / Needs correction</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'all'
              ? 'border-primary/80 bg-primary/10 ring-2 ring-primary/20'
              : 'border-border/60 bg-card/80 hover:border-primary/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Records</p>
              <h3 className="text-xl font-extrabold text-foreground mt-0.5">
                {kpis.totalClaims}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">All time supervisor claims</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* ── Filters & Controls Bar ── */}
      <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/50 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Pending Review</span>
              {kpis.pendingCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${statusFilter === 'pending' ? 'bg-white text-amber-700' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'}`}>
                  {kpis.pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Verified & Paid</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${statusFilter === 'paid' ? 'bg-white text-emerald-700' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'}`}>
                {kpis.paidCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'rejected'
                  ? 'bg-destructive text-destructive-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Rejected ({kpis.rejectedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({kpis.totalClaims})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search supervisor, reason, date..."
              className="h-9 pl-8 text-xs rounded-xl bg-muted/20 border-border/60"
            />
          </div>
        </div>

        {/* Dropdowns for Supervisor Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/40 text-xs">
          <div className="flex items-center gap-2">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase whitespace-nowrap">Filter Supervisor:</Label>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger className="h-8 text-xs rounded-xl bg-muted/20 border-border/60 min-w-[160px]">
                <SelectValue placeholder="All Supervisors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Supervisors</SelectItem>
                {supervisors.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground font-semibold">
            Showing <span className="font-bold text-foreground mx-1">{filteredClaims.length}</span> of {allClaims.length} claims
          </div>
        </div>
      </Card>

      {/* ── Claims List ── */}
      {filteredClaims.length === 0 ? (
        <Card className="p-12 text-center space-y-3 rounded-3xl border border-dashed border-border/60 bg-card/60">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mx-auto">
            <Receipt className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">No Supervisor Expenses Match Filter</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {statusFilter === 'pending'
              ? 'Great! There are no pending supervisor expenses waiting for verification right now.'
              : 'Try clearing your search query or selecting a different status filter.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredClaims.map((claim) => {
            const staffObj = staffList.find(s => s.id === claim.staffId);
            const isPaid = claim.expenseStatus === 'paid';
            const isRejected = claim.expenseStatus === 'rejected';
            const isPending = !isPaid && !isRejected;

            return (
              <Card
                key={`${claim.staffId}_${claim.date}`}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  isPaid
                    ? 'bg-emerald-500/[0.03] border-emerald-500/30 hover:border-emerald-500/50'
                    : isRejected
                      ? 'bg-destructive/[0.03] border-destructive/30 hover:border-destructive/50'
                      : 'bg-card border-amber-500/30 hover:border-amber-500/60 shadow-xs'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Supervisor & Details */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-sm shrink-0 shadow-2xs">
                      {staffObj?.name ? staffObj.name.slice(0, 2).toUpperCase() : 'SP'}
                    </div>

                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-heading font-extrabold text-sm text-foreground">
                          {staffObj?.name || 'Supervisor'}
                        </h4>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded-full">
                          Supervisor
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          {format(new Date(claim.date), 'dd MMM yyyy')}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted/60 px-2 py-0.5 rounded-md">
                          General Expense
                        </span>
                      </div>

                      {/* Prominent Reason / Why Required */}
                      <div className="p-2.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/25 max-w-xl text-xs space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 text-[11px]">
                          <FileText className="w-3.5 h-3.5" />
                          Why this amount is required (Supervisor Reason):
                        </div>
                        <p className="text-foreground font-semibold pl-5">
                          {claim.expenseNotes || <span className="italic text-muted-foreground">No explanation entered</span>}
                        </p>
                      </div>

                      {/* Feedback banners */}
                      {isPaid && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-emerald-800 dark:text-emerald-300 font-bold pt-0.5">
                          <span>✓ Verified & Paid by {claim.expenseVerifiedBy || 'Admin'}</span>
                          {claim.expensePaidAt && <span className="opacity-80 font-normal">on {claim.expensePaidAt}</span>}
                          <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md uppercase text-[10px] tracking-wide">
                            ✓ Added to Company Expenses
                          </span>
                        </div>
                      )}

                      {isRejected && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-destructive font-bold pt-0.5">
                          <span>❌ Rejected:</span>
                          <span className="font-medium">{claim.expenseRejectionReason || 'Declined'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle / Right: Amount & Actions */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-4 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-border/40">
                    <div className="text-left lg:text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {isPaid ? 'Approved Amount' : 'Claimed Amount'}
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold text-foreground">
                          ₹{(isPaid ? (claim.expensePaidAmount || claim.expenseAmount) : claim.expenseAmount || 0).toLocaleString()}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-semibold flex items-center lg:justify-end gap-1">
                        Mode: <span className="text-foreground font-bold">{claim.expensePaymentMethod || 'Cash'}</span>
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {isPending && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleOpenPayModal(claim)}
                            className="h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Verify & Pay
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenRejectModal(claim)}
                            className="h-9 px-3 text-xs font-bold gap-1.5 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            Reject
                          </Button>
                        </>
                      )}

                      {isPaid && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenPayModal(claim)}
                          className="h-9 px-3 text-xs font-bold gap-1.5 rounded-xl border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Adjust Payout
                        </Button>
                      )}

                      {isRejected && (
                        <Button
                          size="sm"
                          onClick={() => handleOpenPayModal(claim)}
                          className="h-9 px-3 text-xs font-bold gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Re-open & Pay
                        </Button>
                      )}

                      {/* Delete Claim Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClaim(claim)}
                        title="Permanently delete claim"
                        className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Dialog: Verify & Pay Modal ── */}
      <Dialog open={!!payModalClaim} onOpenChange={open => !open && setPayModalClaim(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-extrabold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Verify & Disburse Supervisor Expense
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Confirm the payout amount and payment method. Once confirmed, this amount is immediately recorded under company expenses.
            </DialogDescription>
          </DialogHeader>

          {payModalClaim && (() => {
            const staffObj = staffList.find(s => s.id === payModalClaim.staffId);

            return (
              <div className="space-y-4 py-2">
                {/* Summary Card */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span>Supervisor:</span>
                    <span className="text-foreground">{staffObj?.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expense Date:</span>
                    <span className="font-semibold text-foreground">{format(new Date(payModalClaim.date), 'dd MMM yyyy')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Claimed Amount:</span>
                    <span className="font-extrabold text-amber-600 dark:text-amber-400">₹{(payModalClaim.expenseAmount || 0).toLocaleString()}</span>
                  </div>

                  {/* Why required reason in modal */}
                  <div className="pt-2 border-t border-border/40 text-xs">
                    <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      Why Amount Required (Supervisor Justification):
                    </span>
                    <p className="mt-1 font-semibold text-foreground p-2 rounded-lg bg-background/80 border border-border/50">
                      {payModalClaim.expenseNotes || <span className="italic text-muted-foreground">No explanation entered</span>}
                    </p>
                  </div>
                </div>

                {/* Amount to Pay */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    Verified Payout Amount (₹) *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      min="1"
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      className="h-10 pl-7 text-sm font-extrabold rounded-xl bg-muted/20 border-border/60"
                      required
                    />
                  </div>
                </div>

                {/* Payout Mode */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    Disbursement Payment Mode *
                  </Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
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

                {/* Admin Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    Admin Approval Notes / Reference
                  </Label>
                  <Input
                    value={payNotes}
                    onChange={e => setPayNotes(e.target.value)}
                    placeholder="e.g. Paid via UPI ref #1234, petrol receipt verified"
                    className="h-10 text-xs rounded-xl bg-muted/20 border-border/60"
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPayModalClaim(null)}
              className="h-10 rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPayout}
              className="h-10 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm Payout & Add to Expenses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Reject Claim Modal ── */}
      <Dialog open={!!rejectModalClaim} onOpenChange={open => !open && setRejectModalClaim(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-extrabold flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Reject Supervisor Expense Claim
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Provide a clear reason for rejecting this claim so the supervisor can make corrections and re-submit if appropriate.
            </DialogDescription>
          </DialogHeader>

          {rejectModalClaim && (() => {
            const staffObj = staffList.find(s => s.id === rejectModalClaim.staffId);
            return (
              <div className="space-y-4 py-2">
                <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>Supervisor:</span>
                    <span>{staffObj?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Claim Amount:</span>
                    <span className="font-bold">₹{(rejectModalClaim.expenseAmount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span>{format(new Date(rejectModalClaim.date), 'dd MMM yyyy')}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    Reason for Rejection *
                  </Label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    placeholder="e.g. Receipt missing, justification unclear, please resubmit with details..."
                    className="w-full text-xs p-3 rounded-xl bg-muted/20 border border-border/60 focus:border-destructive focus:ring-1 focus:ring-destructive outline-hidden font-medium resize-none"
                    required
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRejectModalClaim(null)}
              className="h-10 rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmReject}
              className="h-10 rounded-xl text-xs font-bold gap-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm"
            >
              <AlertCircle className="w-4 h-4" />
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
