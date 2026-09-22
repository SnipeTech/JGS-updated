import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import {
  TrendingUp, TrendingDown, IndianRupee, MapPin, UserCircle, Clock,
  FileDown, Building2, Package, Truck, Wallet, Coffee, CheckCircle2, AlertTriangle
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const ReportsTab = () => {
  const { dailyLogs, sites, manualExpenses, materialRequests, staffList, attendances, addExpense, deleteExpense } = useApp();

  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [fromDate, setFromDate] = useState(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [toDate, setToDate] = useState(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );

  // Manual Expense Form State
  const [expenseSiteId, setExpenseSiteId] = useState('');
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDate || !expenseAmount || !expenseCategory) return;
    addExpense({
      siteId: expenseSiteId,
      siteName: expenseSiteId ? sites.find(s => s.id === expenseSiteId)?.name : 'Office / General',
      date: expenseDate,
      amount: Number(expenseAmount),
      category: expenseCategory,
      description: expenseDescription
    });
    setExpenseAmount('');
    setExpenseDescription('');
  };

  // Quick period presets
  const applyPreset = (type: 'this_month' | 'last_month' | 'this_year') => {
    const now = new Date();
    if (type === 'this_month') {
      setFromDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setToDate(format(endOfMonth(now), 'yyyy-MM-dd'));
    } else if (type === 'last_month') {
      const prev = subMonths(now, 1);
      setFromDate(format(startOfMonth(prev), 'yyyy-MM-dd'));
      setToDate(format(endOfMonth(prev), 'yyyy-MM-dd'));
    } else if (type === 'this_year') {
      setFromDate(format(startOfYear(now), 'yyyy-MM-dd'));
      setToDate(format(endOfYear(now), 'yyyy-MM-dd'));
    }
  };

  // Filtered daily logs
  const filteredLogs = useMemo(() => {
    return dailyLogs.filter(l => {
      const inDate = l.date >= fromDate && l.date <= toDate;
      const inSite = selectedSiteId === 'all' || l.siteId === selectedSiteId;
      return inDate && inSite;
    });
  }, [dailyLogs, fromDate, toDate, selectedSiteId]);

  // Filtered logistics / material requests
  const filteredRequests = useMemo(() => {
    return (materialRequests || []).filter(r => {
      const rDate = r.date || r.createdAt?.split('T')[0] || '';
      const inDate = rDate >= fromDate && rDate <= toDate;
      const inSite = selectedSiteId === 'all' || r.siteId === selectedSiteId;
      return inDate && inSite && (r.status === 'completed' || r.status === 'assigned');
    });
  }, [materialRequests, fromDate, toDate, selectedSiteId]);

  // Filtered manual expenses
  const filteredManualExpenses = useMemo(() => {
    return (manualExpenses || []).filter(e => {
      const eDate = e.date || '';
      const inDate = eDate >= fromDate && eDate <= toDate;
      const inSite = selectedSiteId === 'all' || e.siteId === selectedSiteId;
      return inDate && inSite;
    });
  }, [manualExpenses, fromDate, toDate, selectedSiteId]);

  // 1. INCOMES
  // A) Direct Client Receipts from Daily Logs
  const directClientIncome = useMemo(() => {
    return filteredLogs.reduce((sum, l) => sum + (l.incomeFromClient || 0), 0);
  }, [filteredLogs]);

  const totalInflow = directClientIncome;

  // 2. EXPENSES
  // A) Materials Expense (daily logs + store & supplier requisitions)
  const logMaterialCost = useMemo(() => {
    return filteredLogs.reduce(
      (sum, l) => sum + (l.materials || []).reduce((s, m) => s + (m.cost || 0) * (m.quantity || 0), 0),
      0
    );
  }, [filteredLogs]);

  const reqMaterialCost = useMemo(() => {
    return filteredRequests.reduce((sum, r) => sum + (r.materialCost || r.supplierPrice || 0), 0);
  }, [filteredRequests]);

  const totalMaterialsExpense = logMaterialCost + reqMaterialCost;

  // B) Transport, Logistics Transit & Petrol
  const logTransportCost = useMemo(() => {
    return filteredLogs.reduce((sum, l) => sum + (l.transportCost || 0), 0);
  }, [filteredLogs]);

  const reqTransportCost = useMemo(() => {
    return filteredRequests.reduce((sum, r) => sum + (r.driverCost || 0) + (Number(r.petrolCharge) || 0), 0);
  }, [filteredRequests]);

  const totalTransportExpense = logTransportCost + reqTransportCost;

  // C) Site Miscellaneous (Food, Tea, Tools, Incidentals)
  const totalMiscExpense = useMemo(() => {
    return filteredLogs.reduce(
      (sum, l) => sum + (l.expenses || []).reduce((s, e) => s + (e.amount || 0), 0),
      0
    );
  }, [filteredLogs]);

  // D) Staff Payroll & Labor Wages for the period
  const totalPayrollExpense = useMemo(() => {
    return staffList.reduce((sum, staff) => {
      const staffAtts = (attendances || []).filter(
        a => a.staffId === staff.id && a.date >= fromDate && a.date <= toDate
      );
      if (selectedSiteId !== 'all') {
        // Only count if assigned to this site or worked on this site
        const workedSiteAtts = staffAtts.filter(a => a.siteId === selectedSiteId);
        if (workedSiteAtts.length === 0) return sum;
      }

      const dailyBase =
        staff.salaryType === 'hourly'
          ? (staff.perHourSalary || 0) * 8
          : staff.perDaySalary || 0;
      const otRate = staff.incentivePerHour || 0;

      let staffWages = 0;
      staffAtts.forEach(att => {
        if (att.status === 'present' || att.status === 'half-day') {
          staffWages += att.status === 'half-day' ? dailyBase / 2 : dailyBase;
          staffWages += (att.otHours || 0) * otRate;
        }
      });

      return sum + staffWages;
    }, 0);
  }, [staffList, attendances, fromDate, toDate, selectedSiteId]);

  const totalManualExpense = useMemo(() => {
    return filteredManualExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredManualExpenses]);

  // Total Outflow
  const totalOutflow = totalMaterialsExpense + totalTransportExpense + totalMiscExpense + totalPayrollExpense + totalManualExpense;

  // 3. NET PROFIT OR LOSS
  const netProfitLoss = totalInflow - totalOutflow;
  const isProfit = netProfitLoss >= 0;
  const profitMargin = totalInflow > 0 ? ((netProfitLoss / totalInflow) * 100).toFixed(1) : '0.0';

  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const siteScopeLabel = selectedSite ? `${selectedSite.name} (${selectedSite.clientName})` : 'All Company Sites & Operations';

  // Export PDF Statement
  const exportPLReportPDF = () => {
    const doc = new jsPDF();

    // Company Header
    doc.setFontSize(18);
    doc.setTextColor(184, 117, 26);
    doc.text('JGS INTERIOR & CONSTRUCTION', 14, 20);

    doc.setFontSize(13);
    doc.setTextColor(40);
    doc.text('EXECUTIVE PROFIT & LOSS (P&L) STATEMENT', 14, 28);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Scope: ${siteScopeLabel}`, 14, 35);
    doc.text(`Period: ${fromDate} to ${toDate}`, 14, 41);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 47);

    // Summary Box
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(14, 52, 182, 36, 2, 2, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.text(`Total Company Incomes (Receipts): Rs ${totalInflow.toLocaleString()}`, 20, 60);
    doc.text(`Total Operational Expenses: Rs ${totalOutflow.toLocaleString()}`, 20, 68);

    doc.setFontSize(11);
    if (isProfit) {
      doc.setTextColor(6, 95, 70);
      doc.text(`NET PROFIT: +Rs ${netProfitLoss.toLocaleString()} (${profitMargin}% Margin)`, 20, 78);
    } else {
      doc.setTextColor(185, 28, 28);
      doc.text(`NET LOSS / DEFICIT: -Rs ${Math.abs(netProfitLoss).toLocaleString()} (Expenditure exceeds receipts)`, 20, 78);
    }

    // Incomes Table
    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.text('1. Total Company Inflow / Income Streams', 14, 98);

    const incHead = [['Income Source', 'Amount (Rs)', 'Share %']];
    const incBody = [
      ['Direct Client Site Income (Work Entries)', directClientIncome.toLocaleString(), totalInflow > 0 ? `${((directClientIncome / totalInflow) * 100).toFixed(1)}%` : '0%'],
      ['TOTAL INFLOW', totalInflow.toLocaleString(), '100%']
    ];

    autoTable(doc, {
      startY: 102,
      head: incHead,
      body: incBody,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 100 },
        1: { halign: 'right', fontStyle: 'bold', cellWidth: 45 },
        2: { halign: 'center', cellWidth: 37 }
      },
      didParseCell: function(data) {
        if (data.row.index === incBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [209, 250, 229];
        }
      }
    });

    // Expenses Table
    const lastY = (doc as any).lastAutoTable.finalY || 135;
    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.text('2. Total Company Outflow / Operational Expenses', 14, lastY + 12);

    const expHead = [['Expense Category', 'Amount (Rs)', 'Share %', 'Scope']];
    const expBody = [
      ['Materials & Requisitions', totalMaterialsExpense.toLocaleString(), totalOutflow > 0 ? `${((totalMaterialsExpense / totalOutflow) * 100).toFixed(1)}%` : '0%', 'Site logs + Store & Supplier dispatches'],
      ['Staff Payroll & Labor Wages', totalPayrollExpense.toLocaleString(), totalOutflow > 0 ? `${((totalPayrollExpense / totalOutflow) * 100).toFixed(1)}%` : '0%', 'Supervisor, Driver & Crew payroll'],
      ['Transport, Transit & Petrol', totalTransportExpense.toLocaleString(), totalOutflow > 0 ? `${((totalTransportExpense / totalOutflow) * 100).toFixed(1)}%` : '0%', 'Daily travel + Driver dispatches & fuel'],
      ['Site Incidentals & Miscellaneous', totalMiscExpense.toLocaleString(), totalOutflow > 0 ? `${((totalMiscExpense / totalOutflow) * 100).toFixed(1)}%` : '0%', 'Food, tea, site tools & misc'],
      ['Manual General Expenses', totalManualExpense.toLocaleString(), totalOutflow > 0 ? `${((totalManualExpense / totalOutflow) * 100).toFixed(1)}%` : '0%', 'Office rent, tools, custom entries'],
      ['TOTAL EXPENSES', totalOutflow.toLocaleString(), '100%', 'All operational expenditures']
    ];

    autoTable(doc, {
      startY: lastY + 16,
      head: expHead,
      body: expBody,
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 55 },
        1: { halign: 'right', fontStyle: 'bold', cellWidth: 35 },
        2: { halign: 'center', cellWidth: 25 },
        3: { cellWidth: 67 }
      },
      didParseCell: function(data) {
        if (data.row.index === expBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 226, 226];
        }
      }
    });

    const safePeriod = `${fromDate}_to_${toDate}`;
    doc.save(`JGS_Company_Profit_Loss_${safePeriod}.pdf`);
  };

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/50 shadow-xs">
        <div>
          <h3 className="section-header !mb-0 text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> Company Profit & Loss (P&L) Ledger
          </h3>
          <p className="text-xs text-muted-foreground">
            Overall financial health: Total income received vs total operational expenses (materials, transport, staff wages, and incidentals).
          </p>
        </div>

        <Button
          size="sm"
          onClick={exportPLReportPDF}
          className="h-8 rounded-xl text-xs font-bold gap-1.5 text-white shadow-xs self-start sm:self-auto"
          style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
        >
          <FileDown className="w-3.5 h-3.5" /> Convert / Export P&L PDF
        </Button>
      </div>

      {/* Filter Controllers Toolbar */}
      <div className="form-card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Site Filter */}
          <div>
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Filter by Site / Scope
            </Label>
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger className="mt-1 h-9 rounded-xl text-xs font-semibold">
                <SelectValue placeholder="All Sites (Company Overall)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🌐 All Sites (Company Overall View)</SelectItem>
                {sites.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.clientName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preset Buttons */}
          <div>
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Period Presets
            </Label>
            <div className="flex gap-1.5 mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset('this_month')}
                className="flex-1 h-9 text-xs rounded-xl font-semibold"
              >
                This Month
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset('last_month')}
                className="flex-1 h-9 text-xs rounded-xl font-semibold"
              >
                Last Month
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset('this_year')}
                className="flex-1 h-9 text-xs rounded-xl font-semibold"
              >
                This Year
              </Button>
            </div>
          </div>
        </div>

        {/* Custom Date Bounds */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
          <div>
            <Label className="text-[10px] font-semibold text-muted-foreground">From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="mt-1 h-9 rounded-xl text-xs font-semibold"
            />
          </div>
          <div>
            <Label className="text-[10px] font-semibold text-muted-foreground">To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="mt-1 h-9 rounded-xl text-xs font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Net Profit or Loss Hero Banner */}
      <Card
        className={`p-5 rounded-3xl text-white shadow-md border-0 relative overflow-hidden transition-all ${
          isProfit
            ? 'bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700'
            : 'bg-gradient-to-r from-rose-900 via-red-800 to-rose-800'
        }`}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] uppercase font-extrabold tracking-widest text-white/80 flex items-center gap-1.5">
              {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {isProfit ? 'NET COMPANY PROFIT' : 'NET OPERATIONAL DEFICIT / LOSS'}
            </span>
            <div className="text-3xl sm:text-4xl font-heading font-extrabold mt-1 tracking-tight">
              {isProfit ? '+' : '-'}₹{Math.abs(netProfitLoss).toLocaleString()}
            </div>
            <p className="text-xs text-white/90 mt-1">
              Scope: <strong>{siteScopeLabel}</strong> · {fromDate} to {toDate}
              {isProfit && ` · Profit Margin: ${profitMargin}%`}
            </p>
          </div>

          <div className="bg-white/15 backdrop-blur-xs p-3.5 rounded-2xl border border-white/20 text-xs space-y-1.5 min-w-[220px]">
            <div className="flex justify-between gap-3 text-white/85">
              <span>Total Incomes:</span>
              <span className="font-bold text-white">+₹{totalInflow.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-3 text-white/85">
              <span>Total Expenses:</span>
              <span className="font-bold text-white">-₹{totalOutflow.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-3 pt-1 border-t border-white/25 text-white font-bold">
              <span>Net Balance:</span>
              <span className={isProfit ? 'text-emerald-200' : 'text-rose-200'}>
                {isProfit ? '+' : '-'}₹{Math.abs(netProfitLoss).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* 4 Financial Pillar KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Income Card */}
        <Card className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider block">
            💰 Total Inflow (Income)
          </span>
          <p className="text-2xl font-heading font-extrabold text-emerald-600 dark:text-emerald-400">
            ₹{totalInflow.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Site work payments
          </p>
        </Card>

        {/* Materials Card */}
        <Card className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
            📦 Materials Expense
          </span>
          <p className="text-2xl font-heading font-bold text-foreground">
            ₹{totalMaterialsExpense.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Logs + Supplier requisitions
          </p>
        </Card>

        {/* Payroll Card */}
        <Card className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
            👷 Staff & Crew Payroll
          </span>
          <p className="text-2xl font-heading font-bold text-foreground">
            ₹{totalPayrollExpense.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Attendance wages & overtime
          </p>
        </Card>

        {/* Transport & Misc */}
        <Card className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
            🚚 Transit & Site Food
          </span>
          <p className="text-2xl font-heading font-bold text-foreground">
            ₹{(totalTransportExpense + totalMiscExpense).toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Travel, fuel & incidentals
          </p>
        </Card>
      </div>

      {/* Detailed Breakdown Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Income Sources Table */}
        <Card className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border/40">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h4 className="font-heading font-bold text-sm text-foreground">Income Breakdown</h4>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-muted/40">
              <div>
                <span className="font-semibold text-foreground block">Client Site Receipts</span>
                <span className="text-[10px] text-muted-foreground">Recorded in daily work entries</span>
              </div>
              <span className="font-bold text-sm text-emerald-600">₹{directClientIncome.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border/50 font-bold">
              <span>Total Revenue / Inflow:</span>
              <span className="text-base text-emerald-600 font-heading">₹{totalInflow.toLocaleString()}</span>
            </div>
          </div>
        </Card>

        {/* Expenses Breakdown Table */}
        <Card className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border/40">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <h4 className="font-heading font-bold text-sm text-foreground">Expense Breakdown</h4>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-muted/40">
              <div>
                <span className="font-semibold text-foreground block">Materials & Store Purchases</span>
                <span className="text-[10px] text-muted-foreground">Daily logs + requisitions</span>
              </div>
              <span className="font-bold text-sm text-destructive">₹{totalMaterialsExpense.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-muted/40">
              <div>
                <span className="font-semibold text-foreground block">Staff Wages & Crew Payroll</span>
                <span className="text-[10px] text-muted-foreground">Base pay, OT, driver & crew pay</span>
              </div>
              <span className="font-bold text-sm text-destructive">₹{totalPayrollExpense.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-muted/40">
              <div>
                <span className="font-semibold text-foreground block">Transport & Vehicle Transit</span>
                <span className="text-[10px] text-muted-foreground">Travel tickets, vehicle runs & petrol</span>
              </div>
              <span className="font-bold text-sm text-destructive">₹{totalTransportExpense.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-muted/40">
              <div>
                <span className="font-semibold text-foreground block">Food, Tea & Site Incidentals</span>
                <span className="text-[10px] text-muted-foreground">Daily misc operational expenses</span>
              </div>
              <span className="font-bold text-sm text-destructive">₹{totalMiscExpense.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-muted/40">
              <div>
                <span className="font-semibold text-foreground block">Manual General Expenses</span>
                <span className="text-[10px] text-muted-foreground">Custom/office expenses</span>
              </div>
              <span className="font-bold text-sm text-destructive">₹{totalManualExpense.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border/50 font-bold">
              <span>Total Outflow / Cost:</span>
              <span className="text-base text-destructive font-heading">₹{totalOutflow.toLocaleString()}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Manual Expenses Section */}
      <div className="mt-8 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Wallet className="w-4 h-4" /> Manual General Expenses
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm lg:col-span-1 h-fit">
            <h4 className="font-heading font-bold text-sm mb-4">Record New Expense</h4>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={expenseCategory} onValueChange={setExpenseCategory} required>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Office Rent">Office Rent</SelectItem>
                    <SelectItem value="Travel & Fuel">Travel & Fuel</SelectItem>
                    <SelectItem value="Tools & Equipment">Tools & Equipment</SelectItem>
                    <SelectItem value="Utilities & Bills">Utilities & Bills</SelectItem>
                    <SelectItem value="Other/Misc">Other/Misc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (₹)</Label>
                <Input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} required min="1" className="h-9 text-xs" placeholder="e.g. 500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} className="h-9 text-xs" placeholder="What was this for?" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Assign to Site (Optional)</Label>
                <Select value={expenseSiteId} onValueChange={setExpenseSiteId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Office / General (No Site)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Office / General (No Site)</SelectItem>
                    {sites.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full h-9 text-xs font-bold rounded-xl mt-2">Add Expense</Button>
            </form>
          </Card>

          <Card className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm lg:col-span-2">
            <h4 className="font-heading font-bold text-sm mb-4">Recorded Expenses ({filteredManualExpenses.length})</h4>
            {filteredManualExpenses.length === 0 ? (
              <div className="text-center py-10 bg-muted/20 rounded-xl text-muted-foreground text-xs border border-dashed border-border/50">
                No manual expenses recorded for this period.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredManualExpenses.map((exp) => (
                  <div key={exp.id} className="flex flex-col sm:flex-row justify-between p-3 bg-muted/30 rounded-xl border border-border/50 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{exp.category}</span>
                        <span className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border border-border/30">
                          {format(new Date(exp.date), 'dd MMM yyyy')}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        {exp.description || 'No description'}
                      </p>
                      {exp.siteName && exp.siteName !== 'Office / General' && (
                        <div className="text-[10px] text-primary/80 font-bold mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {exp.siteName}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3">
                      <span className="font-bold text-destructive">₹{exp.amount.toLocaleString()}</span>
                      <Button variant="ghost" size="sm" onClick={() => deleteExpense(exp.id)} className="h-6 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg">
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReportsTab;
