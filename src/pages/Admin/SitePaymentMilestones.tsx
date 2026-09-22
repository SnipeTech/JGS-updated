import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, Plus, IndianRupee } from 'lucide-react';
import { Site, SitePaymentStage, SitePayment } from '@/types';
import { toast } from 'sonner';

interface Props {
  site: Site;
  updateSite: (id: string, updates: Partial<Site>) => void;
  paymentStageMaster: string[];
}

export const SitePaymentMilestones = ({ site, updateSite, paymentStageMaster }: Props) => {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  
  // Form states for the currently expanded stage
  const [expectedAmount, setExpectedAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [payNote, setPayNote] = useState('');

  const getStageData = (stageName: string): SitePaymentStage => {
    return (site.paymentStages || []).find((s) => s.stageName === stageName) || {
      stageName, expectedAmount: 0, paidAmount: 0, payments: []
    };
  };

  const saveStageData = (stageName: string, updates: Partial<SitePaymentStage>) => {
    const existing = site.paymentStages || [];
    const stageIndex = existing.findIndex((s) => s.stageName === stageName);
    const newStages = [...existing];
    if (stageIndex >= 0) {
      newStages[stageIndex] = { ...newStages[stageIndex], ...updates };
    } else {
      newStages.push({ stageName, expectedAmount: 0, paidAmount: 0, payments: [], ...updates });
    }
    updateSite(site.id, { paymentStages: newStages });
  };

  const handleExpand = (stageName: string) => {
    if (expandedStage === stageName) {
      setExpandedStage(null);
    } else {
      const data = getStageData(stageName);
      setExpectedAmount(data.expectedAmount ? data.expectedAmount.toString() : '');
      setDueDate(data.dueDate || '');
      setPayAmount('');
      setPayNote('');
      setExpandedStage(stageName);
    }
  };

  const handleSaveSetup = (stageName: string) => {
    saveStageData(stageName, {
      expectedAmount: Number(expectedAmount) || 0,
      dueDate: dueDate || undefined
    });
    toast.success('Stage details updated');
  };

  const handleAddPayment = (stageName: string) => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    
    const data = getStageData(stageName);
    const newPayment: SitePayment = {
      id: `pay_${Date.now()}`,
      amount: amt,
      date: payDate,
      note: payNote
    };
    
    saveStageData(stageName, {
      paidAmount: data.paidAmount + amt,
      payments: [...data.payments, newPayment]
    });
    toast.success('Payment recorded successfully');
    setPayAmount('');
    setPayNote('');
  };

  return (
    <Card className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border/40">
        <CheckCircle2 className="w-5 h-5 text-primary" />
        <div>
          <h4 className="text-sm font-heading font-extrabold text-foreground uppercase tracking-wide">
            Payment Stages & Milestones
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Track expected amounts, client payments, and overdue milestones.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {paymentStageMaster.map((stageName, idx) => {
          const data = getStageData(stageName);
          const isExpanded = expandedStage === stageName;
          const balance = data.expectedAmount - data.paidAmount;
          
          let status: 'pending' | 'completed' | 'overdue' = 'pending';
          if (data.expectedAmount > 0 && data.paidAmount >= data.expectedAmount) {
            status = 'completed';
          } else if (data.dueDate && new Date(data.dueDate) < new Date() && balance > 0) {
            status = 'overdue';
          }

          return (
            <div key={stageName} className={`rounded-xl border transition-all ${isExpanded ? 'border-primary/50 shadow-sm' : 'border-border/60 hover:border-primary/30'}`}>
              {/* Header / Summary */}
              <div 
                className="flex items-center justify-between p-3 cursor-pointer bg-muted/10 rounded-xl"
                onClick={() => handleExpand(stageName)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold">{stageName}</h5>
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                      <span>Expected: ₹{data.expectedAmount.toLocaleString()}</span>
                      <span>Paid: ₹{data.paidAmount.toLocaleString()}</span>
                      {balance > 0 && <span className="text-amber-600 font-semibold">Balance: ₹{balance.toLocaleString()}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {status === 'completed' && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Completed</span>}
                  {status === 'overdue' && <span className="flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" /> Overdue</span>}
                  {status === 'pending' && <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Pending</span>}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Expanded Edit Area */}
              {isExpanded && (
                <div className="p-4 border-t border-border/40 space-y-4 bg-card rounded-b-xl">
                  
                  {/* Setup Expected Amount & Due Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/20 rounded-xl border border-border/50">
                    <div>
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Expected Amount (₹)</Label>
                      <Input type="number" value={expectedAmount} onChange={e => setExpectedAmount(e.target.value)} className="h-8 text-xs mt-1" />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Due Date (Optional)</Label>
                      <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-8 text-xs mt-1" />
                    </div>
                    <div className="flex items-end">
                      <Button size="sm" onClick={() => handleSaveSetup(stageName)} className="h-8 w-full text-xs font-bold">Save Setup</Button>
                    </div>
                  </div>

                  {/* Payments List */}
                  {data.payments.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Client Payments Received</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {data.payments.map(p => (
                          <div key={p.id} className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs">
                            <div>
                              <div className="font-bold text-emerald-700 dark:text-emerald-400">₹{p.amount.toLocaleString()}</div>
                              <div className="text-[10px] text-muted-foreground">{p.date} • {p.note || 'No note'}</div>
                            </div>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500/50" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add New Payment */}
                  {balance > 0 && (
                    <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-3">
                      <Label className="text-[10px] uppercase font-bold text-primary">Record New Payment from Client</Label>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="w-24">
                          <Input type="number" placeholder="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="h-8 text-xs bg-background" />
                        </div>
                        <div className="w-32">
                          <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="h-8 text-xs bg-background" />
                        </div>
                        <div className="flex-1 min-w-[150px]">
                          <Input placeholder="Note / Ref (Optional)" value={payNote} onChange={e => setPayNote(e.target.value)} className="h-8 text-xs bg-background" />
                        </div>
                        <Button size="sm" onClick={() => handleAddPayment(stageName)} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1">
                          <Plus className="w-3 h-3" /> Add Payment
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {paymentStageMaster.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
            No payment stages defined in Settings. Please add them in Master Data.
          </div>
        )}
      </div>
    </Card>
  );
};
