import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  FileText, Plus, Trash2, CheckCircle2, Copy
} from 'lucide-react';
import { QuotationItem, Invoice } from '@/types';

const PRESET_PRODUCTS = [
  { name: 'False Ceiling (Gypsum)', unit: 'sqft', rate: 55 },
  { name: 'False Ceiling (PVC)', unit: 'sqft', rate: 45 },
  { name: 'False Ceiling (Grid)', unit: 'sqft', rate: 40 },
  { name: 'Wall Putty Work', unit: 'sqft', rate: 12 },
  { name: 'Interior Paint (2 Coat)', unit: 'sqft', rate: 18 },
  { name: 'Texture Paint', unit: 'sqft', rate: 35 },
  { name: 'Wallpaper Installation', unit: 'sqft', rate: 60 },
  { name: 'Wooden Flooring', unit: 'sqft', rate: 110 },
  { name: 'Vitrified Tile Flooring', unit: 'sqft', rate: 55 },
  { name: 'Marble Flooring', unit: 'sqft', rate: 180 },
  { name: 'Modular Kitchen', unit: 'rft', rate: 1800 },
  { name: 'Wardrobe (Sliding)', unit: 'sqft', rate: 900 },
  { name: 'TV Unit / Feature Wall', unit: 'rft', rate: 1200 },
  { name: 'POP Cornice / Moulding', unit: 'rft', rate: 40 },
  { name: 'Glass Partition', unit: 'sqft', rate: 150 },
  { name: 'Electrical Wiring', unit: 'point', rate: 350 },
  { name: 'Light Fitting', unit: 'piece', rate: 250 },
  { name: 'Curtain Rod Fitting', unit: 'rft', rate: 80 },
  { name: 'Plumbing Work', unit: 'point', rate: 500 },
  { name: 'Door Frame & Shutter', unit: 'piece', rate: 4500 },
  { name: 'Window Grill', unit: 'sqft', rate: 120 },
  { name: 'Custom Item', unit: '', rate: 0 },
];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    paid: 'badge-success',
    partial: 'badge-gold',
    pending: 'badge-neutral',
  };
  return map[status] ?? 'badge-neutral';
};

const printInvoice = (inv: Invoice) => {
  const win = window.open('', '_blank');
  if (!win) return;
  const itemsHtml = inv.items
    .map(
      it =>
        `<tr><td>${it.productName}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right">₹${it.rate.toLocaleString()}</td><td style="text-align:right">₹${it.total.toLocaleString()}</td></tr>`
    )
    .join('');
  const balance = inv.totalAmount - inv.paidAmount;
  win.document.write(`<!DOCTYPE html><html><head><title>${inv.invoiceNumber}</title>
  <style>
    body{font-family:sans-serif;padding:32px;color:#1a1a1a;max-width:700px;margin:0 auto}
    h1{color:#b8751a;font-size:28px;margin:0}
    .sub{color:#666;font-size:13px}
    table{width:100%;border-collapse:collapse;margin:20px 0}
    th{background:#fdf3e0;padding:10px;text-align:left;font-size:12px;text-transform:uppercase;border-bottom:2px solid #e8c87a}
    td{padding:9px 10px;font-size:13px;border-bottom:1px solid #f0e6d0}
    .total-row td{font-weight:bold;font-size:14px;border-top:2px solid #e8c87a;border-bottom:none}
    .badge{display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase}
    .paid{background:#d1fae5;color:#065f46}.partial{background:#fef3c7;color:#92400e}.pending{background:#fee2e2;color:#991b1b}
    .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e8c87a;font-size:12px;color:#999}
    @media print{body{padding:16px}}
  </style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
    <div><h1>JGS</h1><div class="sub">Interior Management</div></div>
    <div style="text-align:right">
      <div style="font-size:20px;font-weight:700">${inv.invoiceNumber}</div>
      <div class="sub">Date: ${format(new Date(inv.createdAt), 'dd MMM yyyy')}</div>
      ${inv.dueDate ? `<div class="sub">Due: ${format(new Date(inv.dueDate + 'T00:00:00'), 'dd MMM yyyy')}</div>` : ''}
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
    <div><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#999;margin-bottom:4px">Bill To</div>
      <div style="font-weight:600">${inv.customerName}</div>
      ${inv.customerPhone ? `<div class="sub">${inv.customerPhone}</div>` : ''}
    </div>
  </div>
  <table><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${itemsHtml}
  <tr class="total-row"><td colspan="3">Total</td><td style="text-align:right">₹${inv.totalAmount.toLocaleString()}</td></tr>
  ${inv.paidAmount > 0 ? `<tr class="total-row"><td colspan="3">Paid</td><td style="text-align:right" style="color:#065f46">₹${inv.paidAmount.toLocaleString()}</td></tr>` : ''}
  ${balance > 0 ? `<tr class="total-row"><td colspan="3">Balance Due</td><td style="text-align:right;color:#991b1b">₹${balance.toLocaleString()}</td></tr>` : ''}
  </tbody></table>
  <div>Status: <span class="badge ${inv.status}">${inv.status.toUpperCase()}</span>
  ${inv.paymentType === 'partial' && inv.partialDueDate ? `&nbsp;&nbsp;Partial due by: <strong>${format(new Date(inv.partialDueDate + 'T00:00:00'), 'dd MMM yyyy')}</strong>` : ''}
  </div>
  ${inv.notes ? `<div style="margin-top:16px;padding:12px;background:#fdf3e0;border-radius:8px;font-size:13px"><strong>Notes:</strong> ${inv.notes}</div>` : ''}
  <div class="footer">JGS Interior Management &bull; Thank you for your business!</div>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 400);
};

const shareWhatsApp = (inv: Invoice) => {
  const balance = inv.totalAmount - inv.paidAmount;
  const lines = [
    `*JGS — Invoice ${inv.invoiceNumber}*`,
    `Customer: ${inv.customerName}`,
    ``,
    `*Items:*`,
    ...inv.items.map(it => `• ${it.productName} × ${it.quantity} = ₹${it.total.toLocaleString()}`),
    ``,
    `*Total: ₹${inv.totalAmount.toLocaleString()}*`,
    inv.paidAmount > 0 ? `Paid: ₹${inv.paidAmount.toLocaleString()}` : '',
    balance > 0 ? `*Balance Due: ₹${balance.toLocaleString()}*` : '',
    inv.paymentType === 'partial' && inv.partialDueDate
      ? `Payment due by: ${format(new Date(inv.partialDueDate + 'T00:00:00'), 'dd MMM yyyy')}`
      : '',
    ``,
    inv.notes ? `Note: ${inv.notes}` : '',
    `Thank you! 🙏`,
  ].filter(Boolean).join('\n');

  const phone = inv.customerPhone ? inv.customerPhone.replace(/\D/g, '') : '';
  const url = `https://wa.me/${phone ? '91' + phone : ''}?text=${encodeURIComponent(lines)}`;
  window.open(url, '_blank');
};

export const InvoicesTab = () => {
  const { invoices, addInvoice, updateInvoice, customers } = useApp();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [view, setView] = useState<'list' | 'new'>('list');

  // New invoice state
  const [custId, setCustId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<QuotationItem[]>([
    { id: '1', productName: '', quantity: 1, unit: 'sqft', rate: 0, total: 0 },
  ]);
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [paidAmount, setPaidAmount] = useState('');
  const [partialDueDate, setPartialDueDate] = useState('');

  // Record payment inline state
  const [recordingPaymentFor, setRecordingPaymentFor] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other'>('cash');

  const totalAmount = items.reduce((s, it) => s + it.total, 0);

  const addItem = () => {
    setItems(prev => [
      ...prev,
      { id: String(Date.now()), productName: '', quantity: 1, unit: 'sqft', rate: 0, total: 0 },
    ]);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(it => it.id !== id));

  const updateItem = (id: string, field: keyof QuotationItem, val: any) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: val };
        if (field === 'quantity' || field === 'rate') {
          updated.total = (Number(updated.quantity) || 0) * (Number(updated.rate) || 0);
        }
        return updated;
      })
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custId) { toast.error('Select a customer'); return; }
    const validItems = items.filter(it => it.productName.trim() && it.total > 0);
    if (validItems.length === 0) { toast.error('Add at least one item with name and rate'); return; }

    const cust = customers.find(c => c.id === custId);
    const paid = paymentType === 'partial' ? Number(paidAmount) || 0 : 0;
    const status = paid >= totalAmount ? 'paid' : paid > 0 ? 'partial' : 'pending';

    addInvoice({
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      customerId: custId,
      customerName: cust?.name || '',
      customerPhone: cust?.phone,
      items: validItems,
      totalAmount,
      paidAmount: paid,
      status,
      paymentType,
      partialDueDate: paymentType === 'partial' ? partialDueDate : undefined,
      dueDate: dueDate || undefined,
      notes,
    });

    toast.success('Invoice generated!');
    setView('list');
    setItems([{ id: '1', productName: '', quantity: 1, unit: 'sqft', rate: 0, total: 0 }]);
    setPaidAmount('');
    setNotes('');
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingPaymentFor) return;
    const inv = invoices.find(i => i.id === recordingPaymentFor);
    if (!inv) return;

    const amt = Number(paymentAmount) || 0;
    if (amt <= 0) { toast.error('Enter a valid payment amount'); return; }

    const newPaid = inv.paidAmount + amt;
    const newStatus = newPaid >= inv.totalAmount ? 'paid' : 'partial';

    const historyEntry = {
      id: Date.now().toString(),
      amount: amt,
      date: paymentDate,
      mode: paymentMode,
      note: paymentNote.trim() || undefined,
    };

    updateInvoice(inv.id, {
      paidAmount: newPaid,
      status: newStatus,
      paymentHistory: [...(inv.paymentHistory || []), historyEntry],
    });

    toast.success(`Payment of ₹${amt.toLocaleString()} recorded!`);
    setRecordingPaymentFor(null);
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="section-header">Invoices & Quotations</h3>
        {view === 'list' ? (
          <Button
            size="sm"
            onClick={() => setView('new')}
            className="h-8 rounded-xl gap-1.5 text-xs font-semibold text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
          >
            <Plus className="w-3.5 h-3.5" /> Create Invoice
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setView('list')} className="h-8 rounded-xl text-xs font-semibold">
            ← Back to Invoices
          </Button>
        )}
      </div>

      {view === 'new' ? (
        <div className="form-card">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Customer *</Label>
              <Select value={custId} onValueChange={setCustId}>
                <SelectTrigger className="mt-1 h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Items</Label>
              {items.map((it, idx) => (
                <div key={it.id} className="flex gap-2 items-center">
                  <Input
                    placeholder="Item description..."
                    value={it.productName}
                    onChange={e => updateItem(it.id, 'productName', e.target.value)}
                    className="flex-2 h-9 text-xs rounded-xl"
                  />
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={it.quantity}
                    onChange={e => updateItem(it.id, 'quantity', Number(e.target.value) || 1)}
                    className="w-16 h-9 text-xs rounded-xl"
                  />
                  <Input
                    type="number"
                    placeholder="Rate"
                    value={it.rate || ''}
                    onChange={e => updateItem(it.id, 'rate', Number(e.target.value) || 0)}
                    className="w-24 h-9 text-xs rounded-xl"
                  />
                  <span className="text-xs font-bold w-20 text-right">₹{it.total.toLocaleString()}</span>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(it.id)}
                      className="h-8 w-8 text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 text-xs rounded-xl gap-1">
                <Plus className="w-3 h-3" /> Add Item
              </Button>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border/40 font-bold text-sm">
              <span>Total Invoice Amount:</span>
              <span className="text-primary font-heading text-base">₹{totalAmount.toLocaleString()}</span>
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl text-white font-bold text-xs shadow-sm"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              Generate Invoice
            </Button>
          </form>
        </div>
      ) : (
        /* Invoices List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {invoices.map(inv => {
            const balance = inv.totalAmount - inv.paidAmount;

            return (
              <Card key={inv.id} className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{inv.customerName}</h4>
                    <p className="text-xs text-muted-foreground">{inv.invoiceNumber}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${statusBadge(inv.status)}`}>
                    {inv.status}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-1 border-t border-border/40">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Total</span>
                    <span className="font-bold text-sm">₹{inv.totalAmount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Paid</span>
                    <span className="font-bold text-sm text-emerald-600">₹{inv.paidAmount.toLocaleString()}</span>
                  </div>
                  {balance > 0 && (
                    <div className="text-right">
                      <span className="text-muted-foreground block text-[10px] uppercase">Balance</span>
                      <span className="font-bold text-sm text-destructive">₹{balance.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Inline Payment Form */}
                {recordingPaymentFor === inv.id ? (
                  <form onSubmit={handleRecordPayment} className="space-y-2 bg-muted/40 p-3 rounded-xl border border-border/50 text-xs">
                    <p className="font-bold text-[10px] uppercase text-muted-foreground">Record Client Payment</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                        className="h-8 rounded-lg text-xs"
                      />
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={e => setPaymentDate(e.target.value)}
                        className="h-8 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="flex-1 h-8 rounded-lg text-xs text-white"
                        style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRecordingPaymentFor(null)}
                        className="h-8 rounded-lg text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex gap-2 pt-1">
                    {inv.status !== 'paid' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRecordingPaymentFor(inv.id);
                          setPaymentAmount(String(balance));
                        }}
                        className="flex-1 h-8 rounded-xl text-xs font-semibold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Record Pay
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareWhatsApp(inv)}
                      className="h-8 rounded-xl text-xs font-semibold px-2.5"
                    >
                      💬 WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => printInvoice(inv)}
                      className="h-8 rounded-xl text-xs font-semibold px-2.5"
                    >
                      🖨️ Print
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InvoicesTab;
