import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, MapPin, Users, TrendingUp, TrendingDown, IndianRupee,
  Building2, CheckCircle2, Clock, Send, Truck, Package,
  CalendarDays, Banknote, ArrowRightLeft, AlertCircle, Layers, UserCircle, Trash2, FileDown
} from 'lucide-react';
import { Material, MaterialRequest } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getSiteAvailableStock } from '@/lib/utils';
import { AssignMaterialModal, CompleteMaterialModal } from './LogisticsModals';

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    active: 'badge-success',
    'on-hold': 'badge-gold',
    completed: 'badge-neutral',
    pending: 'badge-gold',
    partial: 'badge-gold',
    paid: 'badge-success',
  };
  return map[status] ?? 'badge-neutral';
};

// ── Site Detail View ──────────────────────────────────────
export const SiteDetailView = ({ siteId, onBack }: { siteId: string; onBack: () => void }) => {
  const {
    sites, dailyLogs, updateSite, deleteSite, addDailyLog, currentUser, staffList, attendances,
    materialRequests, materialSettings, suppliers, vehicles, assignMaterialRequest, completeMaterialRequest, addMaterialRequest
  } = useApp();
  const site = sites.find(s => s.id === siteId);
  const today = format(new Date(), 'yyyy-MM-dd');

  const siteLogsAll = useMemo(() => {
    return dailyLogs.filter(l => l.siteId === siteId);
  }, [dailyLogs, siteId]);

  const defaultFromDate = useMemo(() => {
    const dates = siteLogsAll.map(l => l.date).filter(Boolean);
    if (site?.startDate) dates.push(site.startDate);
    if (dates.length === 0) return format(new Date(Date.now() - 60 * 86400000), 'yyyy-MM-dd');
    dates.sort();
    return dates[0];
  }, [siteLogsAll, site]);

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(today);

  // Material Hub & Logistics states
  const [assignModal, setAssignModal] = useState<{ open: boolean; request: MaterialRequest | null }>({ open: false, request: null });
  const [completeModal, setCompleteModal] = useState<{ open: boolean; request: MaterialRequest | null }>({ open: false, request: null });
  const [showInterSiteTransfer, setShowInterSiteTransfer] = useState(false);
  const [transferSourceSiteId, setTransferSourceSiteId] = useState('');
  const [transferMatName, setTransferMatName] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Requisition Modal State for this Site
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqItems, setReqItems] = useState<{ name: string; quantity: string; unit: string; rate: string }[]>([
    { name: '', quantity: '1', unit: 'Bags', rate: '' }
  ]);
  const [reqSupplierId, setReqSupplierId] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const driversList = useMemo(() => staffList.filter(s => s.role === 'driver'), [staffList]);

  // Sites that strictly have material stock (excluding current site)
  const sourceSitesWithStock = useMemo(() => {
    return sites.filter(s => {
      if (s.id === siteId) return false;
      const stock = getSiteAvailableStock(s.id, materialRequests, dailyLogs, materialSettings);
      return stock.length > 0;
    });
  }, [sites, siteId, materialRequests, dailyLogs, materialSettings]);

  // Available stock of selected source site
  const sourceSiteStock = useMemo(() => {
    if (!transferSourceSiteId) return [];
    return getSiteAvailableStock(transferSourceSiteId, materialRequests, dailyLogs, materialSettings);
  }, [transferSourceSiteId, materialRequests, dailyLogs, materialSettings]);

  const handleExecuteInterSiteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;
    if (!transferSourceSiteId) {
      toast.error('Please select a source site with stock');
      return;
    }
    const sourceSite = sites.find(s => s.id === transferSourceSiteId);
    if (!sourceSite) return;

    const stockItem = sourceSiteStock.find(m => m.name === transferMatName);
    if (!stockItem) {
      toast.error('Please select a material available in stock');
      return;
    }

    const qty = Number(transferQty);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (qty > stockItem.qty) {
      toast.error(`Limited stock! Max available at ${sourceSite.name} is ${stockItem.qty} ${stockItem.unit}`);
      return;
    }

    const computedMatCost = stockItem.rate ? stockItem.rate * qty : undefined;

    addMaterialRequest({
      siteId: site.id,
      siteName: site.name,
      requestedByStaffId: currentUser?.id || 'admin',
      requestedByStaffName: 'Admin',
      sourceType: 'site',
      sourceSiteId: sourceSite.id,
      sourceSiteName: sourceSite.name,
      items: [{
        name: stockItem.name,
        quantity: qty,
        unit: stockItem.unit,
        rate: stockItem.rate,
        amount: computedMatCost
      }],
      materialCost: computedMatCost,
      notes: `[Inter-Site Transfer from ${sourceSite.name}] ${transferNotes.trim()}`.trim(),
      status: 'pending',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'hh:mm a')
    });

    toast.success(`Inter-site material transfer created! Proceed to assign Driver & Vehicle.`);
    setShowInterSiteTransfer(false);
    setTransferSourceSiteId('');
    setTransferMatName('');
    setTransferQty('');
    setTransferNotes('');
  };

  const handleCreateSiteRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;
    const validItems = reqItems.filter(i => i.name.trim() && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      toast.error('Please enter at least one material item with a valid quantity');
      return;
    }
    const sup = suppliers.find(s => s.id === reqSupplierId);
    const totalMatCost = validItems.reduce((s, it) => s + (Number(it.rate) || 0) * (Number(it.quantity) || 0), 0);

    addMaterialRequest({
      siteId: site.id,
      siteName: site.name,
      requestedByStaffId: currentUser?.id || 'admin',
      requestedByStaffName: 'Admin',
      sourceType: 'supplier',
      supplierId: sup?.id,
      supplierName: sup?.name,
      items: validItems.map(i => ({
        name: i.name.trim(),
        quantity: Number(i.quantity),
        unit: i.unit.trim() || 'unit',
        rate: Number(i.rate) || 0,
        supplierRate: Number(i.rate) || 0,
        clientRate: Number(i.rate) || 0,
        amount: (Number(i.rate) || 0) * (Number(i.quantity) || 0),
        supplierAmount: (Number(i.rate) || 0) * (Number(i.quantity) || 0),
        clientAmount: (Number(i.rate) || 0) * (Number(i.quantity) || 0)
      })),
      materialCost: totalMatCost,
      supplierMaterialCost: totalMatCost,
      clientMaterialCost: totalMatCost,
      supplierPrice: totalMatCost,
      supplierBalance: totalMatCost,
      supplierPaidAmount: 0,
      notes: reqNotes.trim(),
      status: 'pending',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'hh:mm a')
    });

    toast.success(`Material requisition created for ${site.name}!`);
    setShowReqModal(false);
    setReqItems([{ name: '', quantity: '1', unit: 'Bags', rate: '' }]);
    setReqSupplierId('');
    setReqNotes('');
  };

  // Work Log Form in Site Details
  const [showAddLog, setShowAddLog] = useState(false);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [expenseMode, setExpenseMode] = useState('bus');
  const [expenseCustom, setExpenseCustom] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenses, setExpenses] = useState<{ itemName: string; amount: number }[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [matId, setMatId] = useState('');
  const [matName, setMatName] = useState('');
  const [matQty, setMatQty] = useState('');
  const [matCost, setMatCost] = useState('');
  const [income, setIncome] = useState('');
  const [logNotes, setLogNotes] = useState('');

  const addExpense = () => {
    const finalName = expenseMode === 'other' ? expenseCustom.trim() : expenseMode;
    if (!finalName) { toast.error('Enter expense type'); return; }
    if (!expenseAmount) { toast.error('Enter amount'); return; }
    setExpenses(prev => [...prev, { itemName: finalName, amount: Number(expenseAmount) || 0 }]);
    setExpenseMode('bus'); setExpenseCustom(''); setExpenseAmount('');
  };

  const removeExpense = (i: number) => setExpenses(prev => prev.filter((_, idx) => idx !== i));

  const handleMatSelection = (id: string) => {
    setMatId(id);
    if (id !== 'custom') {
      const setting = (materialSettings || []).find(m => m.id === id);
      if (setting) {
        setMatName(setting.name);
        if (setting.defaultRate) setMatCost(setting.defaultRate.toString());
      }
    } else {
      setMatName('');
      setMatCost('');
    }
  };

  const addMaterial = () => {
    let finalName = '';
    if (matId === 'custom') {
      finalName = matName.trim();
    } else {
      const setting = (materialSettings || []).find(m => m.id === matId);
      if (setting) {
        finalName = setting.name;
        if (setting.perUnitWeight) finalName += ` (${setting.perUnitWeight})`;
      } else {
        finalName = matName.trim();
      }
    }
    if (!finalName) { toast.error('Select or enter material'); return; }
    setMaterials(prev => [...prev, { name: finalName, quantity: Number(matQty) || 1, cost: Number(matCost) || 0 }]);
    setMatId(''); setMatName(''); setMatQty(''); setMatCost('');
  };

  const removeMaterial = (i: number) => setMaterials(prev => prev.filter((_, idx) => idx !== i));

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;
    addDailyLog({
      staffId: currentUser!.id,
      staffName: 'Admin',
      siteId: site.id,
      siteName: site.name,
      date: today,
      materials,
      expenses,
      incomeFromClient: Number(income) || 0,
      notes: logNotes,
      workerIds: selectedWorkers
    });
    toast.success('Work log added!');
    setMaterials([]); setExpenses([]); setIncome(''); setLogNotes(''); setShowAddLog(false);
  };

  // Filtered daily logs for this site
  const siteLogs = useMemo(() => {
    return dailyLogs
      .filter(l => l.siteId === siteId && l.date >= fromDate && l.date <= toDate)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [dailyLogs, siteId, fromDate, toDate]);

  // Grouped logs by date
  const groupedLogs = useMemo(() => {
    const map: Record<string, typeof siteLogs> = {};
    siteLogs.forEach(l => {
      if (!map[l.date]) map[l.date] = [];
      map[l.date].push(l);
    });
    return map;
  }, [siteLogs]);

  // Material requests for this site
  const siteRequests = useMemo(() => {
    return (materialRequests || [])
      .filter(r => r.siteId === siteId)
      .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
  }, [materialRequests, siteId]);

  // Available stock on this site
  const availableStock = useMemo(() => {
    return getSiteAvailableStock(siteId, materialRequests, dailyLogs, materialSettings);
  }, [siteId, materialRequests, dailyLogs, materialSettings]);

  // Report Modal state
  const [reportModal, setReportModal] = useState<{
    open: boolean;
    title: string;
    type: 'materials' | 'income' | 'expense' | null;
    itemName: string | null;
    data: any[];
  }>({ open: false, title: '', type: null, itemName: null, data: [] });

  // Site Financials: Income Given vs Total Expenses
  const siteFinancials = useMemo(() => {
    const incomeLogs = siteLogsAll.filter(l => (l.incomeFromClient || 0) > 0);
    const totalIncomeGiven = incomeLogs.reduce((sum, l) => sum + (l.incomeFromClient || 0), 0);

    const logMaterialCost = siteLogsAll.reduce(
      (sum, l) => sum + (l.materials || []).reduce((s, m) => s + (m.cost || 0) * (m.quantity || 0), 0),
      0
    );
    const reqMaterialCost = (materialRequests || [])
      .filter(r => r.siteId === siteId && (r.status === 'completed' || r.status === 'assigned'))
      .reduce((sum, r) => sum + (r.materialCost || r.supplierPrice || 0), 0);
    const totalMaterialExpense = logMaterialCost + reqMaterialCost;

    const logTransportCost = siteLogsAll.reduce((sum, l) => sum + (l.transportCost || 0), 0);
    const reqTransportCost = (materialRequests || [])
      .filter(r => r.siteId === siteId && (r.status === 'completed' || r.status === 'assigned'))
      .reduce((sum, r) => sum + (r.driverCost || 0) + (r.petrolCharge || 0), 0);
    const totalTransportExpense = logTransportCost + reqTransportCost;

    const totalMiscExpense = siteLogsAll.reduce(
      (sum, l) => sum + (l.expenses || []).reduce((s, e) => s + (e.amount || 0), 0),
      0
    );

    const totalSiteExpense = totalMaterialExpense + totalTransportExpense + totalMiscExpense;
    const netBalance = totalIncomeGiven - totalSiteExpense;

    return {
      incomeLogs,
      totalIncomeGiven,
      totalMaterialExpense,
      totalTransportExpense,
      totalMiscExpense,
      totalSiteExpense,
      netBalance
    };
  }, [siteLogsAll, materialRequests, siteId]);

  const downloadSiteFinancialPDF = () => {
    if (!site) return;
    const doc = new jsPDF();

    // Company Header
    doc.setFontSize(18);
    doc.setTextColor(184, 117, 26);
    doc.text('JGS INTERIOR & CONSTRUCTION', 14, 20);

    doc.setFontSize(13);
    doc.setTextColor(40);
    doc.text('SITE FINANCIAL STATEMENT', 14, 28);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Site: ${site.name}`, 14, 35);
    doc.text(`Client: ${site.clientName}`, 14, 41);
    if (site.address) doc.text(`Address: ${site.address}`, 14, 47);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, site.address ? 53 : 47);

    // Summary Box
    const startY = site.address ? 58 : 52;
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(14, startY, 182, 34, 2, 2, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.text(`Site Budget: Rs ${(site.budget || 0).toLocaleString()}`, 20, startY + 8);
    doc.text(`Total Income Given by Client: Rs ${siteFinancials.totalIncomeGiven.toLocaleString()}`, 20, startY + 16);
    doc.text(`Total Site Expenses Incurred: Rs ${siteFinancials.totalSiteExpense.toLocaleString()}`, 20, startY + 24);

    doc.setFontSize(10);
    if (siteFinancials.netBalance >= 0) {
      doc.setTextColor(6, 95, 70);
      doc.text(`Net In-Hand Balance: +Rs ${siteFinancials.netBalance.toLocaleString()} (Surplus)`, 20, startY + 31);
    } else {
      doc.setTextColor(153, 27, 27);
      doc.text(`Net Overspent / Due: -Rs ${Math.abs(siteFinancials.netBalance).toLocaleString()} (Due from Client)`, 20, startY + 31);
    }

    // Expense Breakdown Table
    const expHead = [['Category', 'Amount (Rs)', 'Notes']];
    const expBody = [
      ['Materials Expense', siteFinancials.totalMaterialExpense.toLocaleString(), 'Site daily logs + dispatch requisitions'],
      ['Transport & Vehicle Expense', siteFinancials.totalTransportExpense.toLocaleString(), 'Staff travel + driver transit & petrol'],
      ['Site Miscellaneous Expenses', siteFinancials.totalMiscExpense.toLocaleString(), 'Food, tea, tools & site incidentals'],
      ['TOTAL SITE EXPENSES', siteFinancials.totalSiteExpense.toLocaleString(), 'All operational site costs combined']
    ];

    autoTable(doc, {
      startY: startY + 38,
      head: expHead,
      body: expBody,
      theme: 'grid',
      headStyles: { fillColor: [184, 117, 26], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
        2: { cellWidth: 82 }
      },
      didParseCell: function(data) {
        if (data.row.index === expBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 243, 199];
        }
      }
    });

    // Income Received Log Table
    const lastY = (doc as any).lastAutoTable.finalY || 130;
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text('Client Income Received Logs (How Much Given)', 14, lastY + 12);

    const incHead = [['Date', 'Staff Member', 'Amount Given (Rs)', 'Notes']];
    const incBody = siteFinancials.incomeLogs.length === 0
      ? [['-', 'No income logged from client yet', '0', '-']]
      : siteFinancials.incomeLogs.map(l => [
          format(new Date(l.date), 'dd MMM yyyy'),
          l.staffName,
          l.incomeFromClient.toLocaleString(),
          l.notes || '-'
        ]);

    autoTable(doc, {
      startY: lastY + 16,
      head: incHead,
      body: incBody,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 45 },
        2: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
        3: { cellWidth: 62 }
      }
    });

    const safeName = site.name.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`${safeName}_Financial_Statement.pdf`);
  };

  const downloadPDF = () => {
    if (!reportModal.type) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(reportModal.title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Site: ${site?.name}`, 14, 30);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 36);

    let head: string[][] = [];
    let body: any[][] = [];

    if (reportModal.type === 'materials') {
      head = [['Date', 'Staff / Source', 'Material Item', 'Quantity', 'Unit Rate (Rs)', 'Total (Rs)']];
      body = reportModal.data.map(d => [
        format(new Date(d.date), 'dd MMM yyyy'),
        d.source ? `${d.staffName} (${d.source})` : d.staffName,
        d.item || reportModal.itemName || 'Material',
        d.quantity.toString(),
        `Rs ${d.cost}`,
        `Rs ${d.total}`
      ]);
    } else if (reportModal.type === 'income') {
      head = [['Date', 'Staff', 'Amount', 'Notes']];
      body = reportModal.data.map(d => [
        format(new Date(d.date), 'dd MMM yyyy'),
        d.staffName,
        `Rs ${d.amount}`,
        d.notes || '-'
      ]);
    } else if (reportModal.type === 'expense') {
      head = [['Date', 'Staff', 'Item', 'Amount']];
      body = reportModal.data.map(d => [
        format(new Date(d.date), 'dd MMM yyyy'),
        d.staffName,
        d.item,
        `Rs ${d.amount}`
      ]);
    }

    autoTable(doc, {
      startY: 42,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [184, 117, 26] },
    });

    doc.save(`${reportModal.title.replace(/ /g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  if (!site) return null;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 rounded-xl gap-1.5 text-xs font-semibold pl-2">
          ← Back
        </Button>
        <div className="flex-1">
          <h3 className="font-heading font-bold text-base leading-tight">{site.name}</h3>
          <p className="text-xs text-muted-foreground">{site.clientName}</p>
        </div>
        <span className={statusBadge(site.status)}>{site.status}</span>
      </div>

      {/* Site meta */}
      <div className="form-card space-y-2 !py-3">
        {[
          { l: 'Address', v: site.address },
          { l: 'Started', v: site.startDate || '—' },
          { l: 'Budget', v: site.budget > 0 ? `₹${site.budget.toLocaleString()}` : '—' },
        ].filter(x => x.v).map(({ l, v }) => (
          <div key={l} className="flex justify-between text-xs">
            <span className="text-muted-foreground font-medium">{l}</span>
            <span className="font-semibold">{v}</span>
          </div>
        ))}
        {/* Status change pills */}
        <div className="flex gap-2 pt-2 border-t border-border/50">
          {(['active', 'on-hold', 'completed'] as const).map(st => (
            <button
              key={st}
              onClick={() => updateSite(site.id, { status: st })}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize transition-all ${
                site.status === st ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Site Financial Statement: Income Given vs Total Expenses */}
      <Card className="p-4 sm:p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" />
              <h4 className="text-sm font-heading font-extrabold text-foreground uppercase tracking-wide">
                Site Financial Statement & Cost Tracking
              </h4>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Income received from client (how much given) vs total materials, transport, and site expenses.
            </p>
          </div>

          <Button
            size="sm"
            onClick={downloadSiteFinancialPDF}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 text-white shadow-xs self-start sm:self-auto"
            style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
          >
            <FileDown className="w-3.5 h-3.5" /> Convert / Export PDF Report
          </Button>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Income Received */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider block">
              💰 Income Received (How Much Given)
            </span>
            <div className="text-2xl font-heading font-extrabold text-emerald-600 dark:text-emerald-400">
              ₹{siteFinancials.totalIncomeGiven.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {siteFinancials.incomeLogs.length} client payment {siteFinancials.incomeLogs.length === 1 ? 'log' : 'logs'} recorded
            </p>
          </div>

          {/* Total Site Expenses */}
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/25 space-y-1">
            <span className="text-[10px] uppercase font-bold text-destructive tracking-wider block">
              📉 Total Site Expenses
            </span>
            <div className="text-2xl font-heading font-extrabold text-destructive">
              ₹{siteFinancials.totalSiteExpense.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Materials + Transport + Incidentals
            </p>
          </div>

          {/* Net In-Hand / Surplus or Deficit */}
          <div className={`p-3.5 rounded-xl border space-y-1 ${
            siteFinancials.netBalance >= 0
              ? 'bg-primary/10 border-primary/25'
              : 'bg-amber-500/10 border-amber-500/25'
          }`}>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              ⚖️ Net Balance (Income − Expenses)
            </span>
            <div className={`text-2xl font-heading font-extrabold ${
              siteFinancials.netBalance >= 0 ? 'text-primary' : 'text-amber-700 dark:text-amber-400'
            }`}>
              {siteFinancials.netBalance >= 0 ? '+' : ''}₹{siteFinancials.netBalance.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {siteFinancials.netBalance >= 0 ? 'Surplus / In-hand balance' : 'Deficit / Due from client'}
            </p>
          </div>
        </div>

        {/* Expense Category Breakdown Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/30 text-xs">
          <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40 border border-border/40">
            <span className="text-muted-foreground">🧱 Materials Cost:</span>
            <strong className="text-foreground">₹{siteFinancials.totalMaterialExpense.toLocaleString()}</strong>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40 border border-border/40">
            <span className="text-muted-foreground">🚚 Transport & Vehicle:</span>
            <strong className="text-foreground">₹{siteFinancials.totalTransportExpense.toLocaleString()}</strong>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40 border border-border/40">
            <span className="text-muted-foreground">☕ Miscellaneous / Food:</span>
            <strong className="text-foreground">₹{siteFinancials.totalMiscExpense.toLocaleString()}</strong>
          </div>
        </div>
      </Card>

      {/* Site Material Hub: Stock on Hand & Requisitions/Deliveries */}
      <div className="bg-card p-4 rounded-2xl border border-border/70 shadow-xs space-y-4">
        {/* Hub Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-heading font-black text-foreground uppercase tracking-wide">
                Materials & Logistics on Site
              </h4>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Available physical stock, pending requisitions, and incoming dispatches for {site.name}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setShowReqModal(true)}
              className="h-8 text-xs font-bold gap-1.5 rounded-xl text-white shadow-xs"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              <Plus className="w-3.5 h-3.5" /> Requisition Material
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowInterSiteTransfer(true)}
              className="h-8 text-xs font-bold gap-1 rounded-xl text-primary border-primary/25 bg-primary/5 hover:bg-primary/10"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer From Other Site
            </Button>
          </div>
        </div>

        {/* 1. Verified Stock on Hand */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" /> Stock on Hand ({availableStock.length})
            </span>
          </div>

          {availableStock.length === 0 ? (
            <div className="p-3 rounded-xl bg-muted/30 border border-border/40 text-xs text-muted-foreground italic flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground/60 shrink-0" />
              <span>No completed/delivered stock on hand currently logged at this site.</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableStock.map((stock, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 border border-border/60 text-xs font-bold shadow-2xs"
                >
                  <Package className="w-3.5 h-3.5 text-primary" />
                  <span>{stock.name}:</span>
                  <strong className="text-primary font-mono">{stock.qty} {stock.unit}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 2. Site Requisitions & Deliveries (Pending, Assigned, Completed) */}
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-blue-500" /> Requisitions & Deliveries for this Site ({siteRequests.length})
            </span>
          </div>

          {siteRequests.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 text-xs text-muted-foreground flex items-center justify-between">
              <span className="italic">No requisitions or deliveries registered for this site yet.</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowReqModal(true)}
                className="h-7 text-xs text-primary font-bold hover:underline p-0"
              >
                + Requisition now
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {siteRequests.map(req => {
                const isPending = req.status === 'pending';
                const isAssigned = req.status === 'assigned';
                const isCompleted = req.status === 'completed';

                return (
                  <div
                    key={req.id}
                    className={`p-3.5 rounded-2xl border text-xs space-y-2.5 transition-all ${
                      isAssigned
                        ? 'bg-blue-500/5 border-blue-500/30'
                        : isPending
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : 'bg-card border-border/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            isAssigned
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                              : isPending
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {isAssigned && <Truck className="w-3 h-3" />}
                          {isPending && <Clock className="w-3 h-3" />}
                          {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                          {isAssigned ? 'In Transit / Dispatched' : isPending ? 'Awaiting Dispatch' : 'Delivered & Completed'}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {req.date} {req.time}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPending && (
                          <Button
                            size="sm"
                            onClick={() => setAssignModal({ open: true, request: req })}
                            className="h-7 px-2.5 rounded-lg text-white font-bold text-[11px] shadow-xs"
                            style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                          >
                            <Truck className="w-3 h-3 mr-1" /> Assign Staff / Dispatch
                          </Button>
                        )}
                        {isAssigned && (
                          <Button
                            size="sm"
                            onClick={() => setCompleteModal({ open: true, request: req })}
                            className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Complete Delivery
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Materials Ordered */}
                    <div className="flex flex-wrap gap-1.5">
                      {req.items.map((it, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-card border border-border/60 font-semibold text-[11px] text-foreground flex items-center gap-1.5"
                        >
                          <Package className="w-3 h-3 text-primary" />
                          {it.name}: <strong className="text-primary font-mono">{it.quantity} {it.unit}</strong>
                          {it.rate ? <span className="text-muted-foreground text-[10px]">(₹{it.rate}/{it.unit})</span> : null}
                        </span>
                      ))}
                    </div>

                    {/* Logistics & Supplier Meta */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                      {req.supplierName && (
                        <span>🏢 Supplier: <strong className="text-foreground">{req.supplierName}</strong></span>
                      )}
                      {req.sourceSiteName && (
                        <span>🔄 Transferred From: <strong className="text-foreground">{req.sourceSiteName}</strong></span>
                      )}
                      {req.driverName && (
                        <span>👤 Driver: <strong className="text-foreground">{req.driverName}</strong></span>
                      )}
                      {req.vehicleName && (
                        <span>🚗 Vehicle: <strong className="text-foreground">{req.vehicleName}</strong></span>
                      )}
                      {req.supplierPrice ? (
                        <span>Supplier Bill: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">₹{req.supplierPrice.toLocaleString()}</strong></span>
                      ) : null}
                      {req.clientTotalCost ? (
                        <span>Client Bill: <strong className="text-primary font-mono">₹{req.clientTotalCost.toLocaleString()}</strong></span>
                      ) : null}
                    </div>

                    {req.notes && (
                      <p className="text-[11px] text-muted-foreground italic bg-muted/40 px-2.5 py-1 rounded-lg">
                        "{req.notes}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Work Entry Toggle */}
      <div className="animate-slide-up">
        {!showAddLog ? (
          <Button
            onClick={() => {
              setSelectedWorkers(site.assignedStaffIds || []);
              setShowAddLog(true);
            }}
            className="w-full h-11 rounded-xl text-white font-semibold flex items-center justify-center gap-2 shadow-sm"
            style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
          >
            <Plus className="w-4 h-4" /> Add Daily Work Entry
          </Button>
        ) : (
          <div className="form-card mb-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <p className="font-heading font-bold text-sm flex items-center gap-2 m-0">
                <Send className="w-4 h-4 text-primary" /> Daily Work Entry
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowAddLog(false)}
                className="w-7 h-7 rounded-full"
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleAddLog} className="space-y-4">
              {/* Workers on Duty */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <Users className="w-3.5 h-3.5" /> Workers on Duty ({selectedWorkers.length})
                </Label>
                <div className="grid grid-cols-2 gap-1.5 max-h-[130px] overflow-y-auto bg-muted/30 p-2 rounded-xl border border-border/50">
                  {staffList.filter(s => s.role !== 'supervisor').map(s => {
                    const isChecked = selectedWorkers.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-xs p-1 hover:bg-muted/50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          className="rounded"
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedWorkers(prev => [...prev, s.id]);
                            } else {
                              setSelectedWorkers(prev => prev.filter(id => id !== s.id));
                            }
                          }}
                        />
                        <span className="truncate font-medium">{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Materials Used / Added Today */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <Package className="w-3.5 h-3.5" /> Materials Used / Added Today
                </Label>
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <Select value={matId} onValueChange={handleMatSelection}>
                      <SelectTrigger className="h-10 rounded-xl text-xs">
                        <SelectValue placeholder="Select Material" />
                      </SelectTrigger>
                      <SelectContent>
                        {materialSettings.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} {m.perUnitWeight ? `(${m.perUnitWeight})` : ''}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">+ Custom Item</SelectItem>
                      </SelectContent>
                    </Select>

                    {matId === 'custom' && (
                      <Input
                        placeholder="Material Name"
                        value={matName}
                        onChange={e => setMatName(e.target.value)}
                        className="h-10 rounded-xl text-xs"
                      />
                    )}

                    <Input
                      type="number"
                      placeholder="Qty"
                      min="0.1"
                      step="any"
                      value={matQty}
                      onChange={e => setMatQty(e.target.value)}
                      className="h-10 rounded-xl text-xs"
                    />

                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Cost (₹)"
                        value={matCost}
                        onChange={e => setMatCost(e.target.value)}
                        className="h-10 rounded-xl text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={addMaterial}
                        className="h-10 w-10 rounded-xl shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {materials.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {materials.map((m, i) => (
                        <div key={i} className="flex items-center justify-between bg-muted/50 rounded-xl px-3 py-1.5 text-xs">
                          <span className="font-semibold text-foreground">{m.name} × {m.quantity}</span>
                          <div className="flex items-center gap-2">
                            {m.cost > 0 && <span className="font-semibold text-primary">₹{m.cost * m.quantity}</span>}
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeMaterial(i)} className="h-6 w-6">
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Expenses */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <Truck className="w-3.5 h-3.5" /> Expenses
                </Label>
                <div className="flex gap-2">
                  <Select value={expenseMode} onValueChange={setExpenseMode}>
                    <SelectTrigger className="w-32 h-10 rounded-xl capitalize shrink-0 text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bus">Bus / Travel</SelectItem>
                      <SelectItem value="petrol">Petrol Allowance / Fuel</SelectItem>
                      <SelectItem value="food">Food</SelectItem>
                      <SelectItem value="accommodation">Accommodation</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>

                  {expenseMode === 'other' && (
                    <Input
                      placeholder="Name"
                      value={expenseCustom}
                      onChange={e => setExpenseCustom(e.target.value)}
                      className="flex-1 h-10 rounded-xl text-xs"
                    />
                  )}

                  <Input
                    type="number"
                    placeholder="₹"
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    className="w-20 h-10 rounded-xl text-xs shrink-0"
                  />

                  <Button type="button" variant="outline" size="icon" onClick={addExpense} className="h-10 w-10 rounded-xl shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {expenses.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {expenses.map((e, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted/50 rounded-xl px-3 py-1.5 text-xs">
                        <span className="font-medium capitalize">{e.itemName}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-destructive">₹{e.amount}</span>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeExpense(i)} className="h-6 w-6">
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Income */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5" /> Income from Client
                </Label>
                <Input
                  type="number"
                  placeholder="₹ 0"
                  value={income}
                  onChange={e => setIncome(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Notes</Label>
                <Textarea
                  placeholder="Work done..."
                  value={logNotes}
                  onChange={e => setLogNotes(e.target.value)}
                  className="mt-1 min-h-[60px] rounded-xl text-xs"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl text-white font-semibold text-xs shadow-sm"
                style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
              >
                Submit Work Log
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Date Range Filter for Site History */}
      <div className="bg-card p-3 rounded-2xl border border-border/50 flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">History Range:</span>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="h-8 w-32 rounded-lg text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="h-8 w-32 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Grouped Logs by Date */}
      <div className="space-y-4">
        {Object.keys(groupedLogs).length === 0 ? (
          <div className="text-center py-10 bg-card rounded-2xl border border-border/50 text-muted-foreground text-xs">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No work logs found for this date range.</p>
          </div>
        ) : (
          Object.entries(groupedLogs).map(([date, logs]) => (
            <Card key={date} className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <span className="font-heading font-bold text-sm text-foreground">
                    {format(new Date(date + 'T00:00:00'), 'EEEE, dd MMMM yyyy')}
                  </span>
                </div>
                <span className="text-xs font-bold text-muted-foreground font-mono">
                  {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="p-3 bg-muted/30 rounded-xl border border-border/40 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <UserCircle className="w-3.5 h-3.5 text-primary" /> {log.staffName}
                      </span>
                      {log.incomeFromClient > 0 && (
                        <span className="text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                          +₹{log.incomeFromClient.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {log.workerIds && log.workerIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center pt-0.5">
                        <span className="text-[10px] text-muted-foreground font-semibold">Staff on site:</span>
                        {log.workerIds.map(wId => {
                          const wStaff = staffList.find(s => s.id === wId);
                          return wStaff ? (
                            <span key={wId} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium border border-primary/20">
                              {wStaff.name} ({wStaff.role})
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}

                    {log.materials && log.materials.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {log.materials.map((m, mIdx) => (
                          <span key={mIdx} className="bg-card px-2 py-0.5 rounded text-[11px] font-medium border border-border/50">
                            {m.name} × {m.quantity}
                          </span>
                        ))}
                      </div>
                    )}

                    {log.notes && <p className="text-muted-foreground italic text-[11px]">"{log.notes}"</p>}
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Inter-Site Transfer Dialog */}
      <Dialog open={showInterSiteTransfer} onOpenChange={setShowInterSiteTransfer}>
        <DialogContent className="max-w-md rounded-2xl p-5">
          <DialogHeader className="pb-2 border-b border-border/50">
            <DialogTitle className="text-base font-heading font-bold flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              Transfer Material from Another Site
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleExecuteInterSiteTransfer} className="space-y-3 mt-2">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Source Site (With Stock) *</Label>
              {sourceSitesWithStock.length === 0 ? (
                <p className="text-xs text-destructive mt-1">No other sites have available stock to transfer.</p>
              ) : (
                <Select
                  value={transferSourceSiteId}
                  onValueChange={val => {
                    setTransferSourceSiteId(val);
                    setTransferMatName('');
                    setTransferQty('');
                  }}
                >
                  <SelectTrigger className="mt-1 h-10 rounded-xl text-xs">
                    <SelectValue placeholder="Select Source Site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceSitesWithStock.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {transferSourceSiteId && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Material in Stock *</Label>
                <Select
                  value={transferMatName}
                  onValueChange={val => {
                    setTransferMatName(val);
                    const st = sourceSiteStock.find(m => m.name === val);
                    if (st) setTransferQty(Math.min(1, st.qty).toString());
                  }}
                >
                  <SelectTrigger className="mt-1 h-10 rounded-xl text-xs">
                    <SelectValue placeholder="Select Material" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceSiteStock.map((st, i) => (
                      <SelectItem key={i} value={st.name}>
                        {st.name} ({st.qty} {st.unit} available)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {transferMatName && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Quantity *</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="any"
                  value={transferQty}
                  onChange={e => setTransferQty(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={!transferSourceSiteId || !transferMatName || !transferQty}
              className="w-full h-10 rounded-xl text-white font-bold text-xs shadow-sm mt-2"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              Confirm Inter-Site Transfer
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Requisition Material for this Site Dialog */}
      <Dialog open={showReqModal} onOpenChange={setShowReqModal}>
        <DialogContent className="max-w-md rounded-2xl p-5">
          <DialogHeader className="pb-2 border-b border-border/50">
            <DialogTitle className="text-base font-heading font-bold flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Requisition Material for {site.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSiteRequisition} className="space-y-3.5 mt-2">
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {reqItems.map((it, idx) => (
                <div key={idx} className="p-3 bg-muted/30 rounded-xl border border-border/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-muted-foreground uppercase">Item {idx + 1}</span>
                    {reqItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setReqItems(prev => prev.filter((_, i) => i !== idx))}
                        className="text-destructive hover:underline text-[10px] font-bold"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <Label className="text-[10px] text-muted-foreground font-semibold">Material *</Label>
                    <Select
                      value={it.name}
                      onValueChange={val => {
                        const setting = materialSettings.find(m => m.name === val);
                        setReqItems(prev => {
                          const copy = [...prev];
                          copy[idx] = {
                            ...copy[idx],
                            name: val,
                            unit: setting?.unit || copy[idx].unit,
                            rate: setting?.defaultRate ? setting.defaultRate.toString() : copy[idx].rate
                          };
                          return copy;
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 rounded-xl text-xs mt-0.5">
                        <SelectValue placeholder="Select Material Preset" />
                      </SelectTrigger>
                      <SelectContent>
                        {materialSettings.map(m => (
                          <SelectItem key={m.id} value={m.name}>
                            {m.name} ({m.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-semibold">Quantity *</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder="Qty"
                        value={it.quantity}
                        onChange={e => {
                          const val = e.target.value;
                          setReqItems(prev => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], quantity: val };
                            return copy;
                          });
                        }}
                        className="h-8 rounded-lg text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground font-semibold">Unit</Label>
                      <Input
                        placeholder="e.g. Bags, Tons, Kg"
                        value={it.unit}
                        onChange={e => {
                          const val = e.target.value;
                          setReqItems(prev => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], unit: val };
                            return copy;
                          });
                        }}
                        className="h-8 rounded-lg text-xs mt-0.5"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px] text-muted-foreground font-semibold">Estimated Unit Rate (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 450"
                      value={it.rate}
                      onChange={e => {
                        const val = e.target.value;
                        setReqItems(prev => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], rate: val };
                          return copy;
                        });
                      }}
                      className="h-8 rounded-lg text-xs mt-0.5"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReqItems(prev => [...prev, { name: '', quantity: '1', unit: 'Bags', rate: '' }])}
              className="w-full h-8 text-xs font-semibold gap-1 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" /> Add Another Item
            </Button>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Select Supplier (Optional)</Label>
              <Select value={reqSupplierId} onValueChange={setReqSupplierId}>
                <SelectTrigger className="mt-1 h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Select Preferred Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(sup => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.name} ({sup.materialsSupplied})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Requisition Notes</Label>
              <Textarea
                placeholder="e.g. Needed urgently for foundation works..."
                value={reqNotes}
                onChange={e => setReqNotes(e.target.value)}
                className="mt-1 min-h-[50px] rounded-xl text-xs"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 rounded-xl text-white font-bold text-xs shadow-sm"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              Submit Material Requisition
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AssignMaterialModal
        open={assignModal.open}
        onOpenChange={open => setAssignModal(prev => ({ ...prev, open }))}
        request={assignModal.request}
        driversList={driversList}
        staffList={staffList}
        suppliers={suppliers}
        vehicles={vehicles}
        materialSettings={materialSettings}
        onAssign={(id, data) => assignMaterialRequest(id, data)}
      />

      <CompleteMaterialModal
        open={completeModal.open}
        onOpenChange={open => setCompleteModal(prev => ({ ...prev, open }))}
        request={completeModal.request}
        materialSettings={materialSettings}
        staffList={staffList}
        onComplete={(id, data) => completeMaterialRequest(id, data)}
      />
    </div>
  );
};

// ── Sites Tab Main Component ──────────────────────────────
export const SitesTab = () => {
  const { sites, addSite, customers, addCustomer, staffList, materialRequests } = useApp();
  const [name, setName] = useState('');
  const [addr, setAddr] = useState('');
  const [client, setClient] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [budget, setBudget] = useState('');
  const [start, setStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [supervisor, setSupervisor] = useState('none');
  const [show, setShow] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  if (selectedSiteId) {
    return <SiteDetailView siteId={selectedSiteId} onBack={() => setSelectedSiteId(null)} />;
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Site name required'); return; }
    if (!client.trim()) { toast.error('Client name required'); return; }

    const existingClient = customers.find(c => c.phone === clientPhone.trim());
    if (!existingClient && clientPhone.trim()) {
      addCustomer({
        name: client.trim(),
        phone: clientPhone.trim(),
        email: clientEmail.trim(),
        category: 'direct',
        address: clientAddress.trim(),
        notes: ''
      });
    }

    addSite({
      name,
      address: addr,
      clientName: client,
      status: 'active',
      startDate: start,
      budget: Number(budget) || 0,
      supervisorId: supervisor === 'none' ? undefined : supervisor
    });

    toast.success('Site added!');
    setName(''); setAddr(''); setClient(''); setClientPhone(''); setClientEmail(''); setClientAddress('');
    setBudget(''); setSupervisor('none'); setShow(false);
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="section-header">Site Management</h3>
        <Button
          size="sm"
          onClick={() => setShow(v => !v)}
          className="h-8 rounded-xl gap-1.5 text-xs font-semibold text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Site
        </Button>
      </div>

      {show && (
        <div className="form-card">
          <form onSubmit={handleAdd} className="space-y-3">
            {[
              { label: 'Site Name', val: name, set: setName, ph: 'Villa Renovation' },
              { label: 'Address', val: addr, set: setAddr, ph: 'MG Road, Bangalore' },
            ].map(({ label, val, set, ph }) => (
              <div key={label}>
                <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
                <Input
                  placeholder={ph}
                  value={val}
                  onChange={e => set(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>
            ))}

            <div className="pt-2 border-t border-border/50">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                Client Details
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Client Name *</Label>
                  <Input
                    placeholder="e.g. Ramesh Babu"
                    value={client}
                    onChange={e => setClient(e.target.value)}
                    className="h-9 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Client Phone</Label>
                  <Input
                    placeholder="9876543210"
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    className="h-9 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Budget (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={start}
                  onChange={e => setStart(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl text-white font-bold text-xs shadow-sm mt-2"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              Save Site
            </Button>
          </form>
        </div>
      )}

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sites.map(s => (
          <Card
            key={s.id}
            onClick={() => setSelectedSiteId(s.id)}
            className="p-5 rounded-3xl bg-card border border-border/60 hover:border-primary/50 shadow-luxury hover:shadow-luxury-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer space-y-3.5 group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-heading font-bold text-base text-foreground truncate">{s.name}</h4>
                  <p className="text-xs text-muted-foreground truncate">{s.clientName}</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize shrink-0 ${statusBadge(s.status)}`}>
                {s.status}
              </span>
            </div>

            {s.address && (
              <p className="text-xs text-muted-foreground/80 flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                {s.address}
              </p>
            )}

            <div className="flex items-center justify-between text-xs pt-3 border-t border-border/50 font-medium">
              <span className="text-muted-foreground font-semibold">Budget: ₹{s.budget.toLocaleString()}</span>
              {(() => {
                const sReqs = (materialRequests || []).filter(r => r.siteId === s.id && r.status !== 'cancelled');
                if (sReqs.length === 0) return null;
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    <Package className="w-3 h-3" /> {sReqs.length} {sReqs.length === 1 ? 'material order' : 'material orders'}
                  </span>
                );
              })()}
              <span className="text-primary font-bold group-hover:translate-x-0.5 transition-transform">View Details →</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SitesTab;
