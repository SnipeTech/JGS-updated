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
  FileDown, Building2, Package, Truck, Wallet, Coffee, CheckCircle2, AlertTriangle, RefreshCw, Users
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const ReportsTab = () => {
  const { dailyLogs, sites, manualExpenses, materialRequests, materialRentals, staffList, attendances, addExpense, deleteExpense } = useApp();

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
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card' | 'Other'>('Cash');

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDate || !expenseAmount || !expenseCategory) return;
    addExpense({
      siteId: expenseSiteId,
      siteName: expenseSiteId ? sites.find(s => s.id === expenseSiteId)?.name : 'Office / General',
      date: expenseDate,
      amount: Number(expenseAmount),
      category: expenseCategory,
      description: expenseDescription,
      paymentMethod: expensePaymentMethod
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

  // B) Client Payments from Site Payment Milestones
  const milestoneIncome = useMemo(() => {
    return sites
      .filter(s => selectedSiteId === 'all' || s.id === selectedSiteId)
      .reduce((sum, site) => {
        const stageSum = (site.paymentStages || []).reduce((stSum, stage) => {
          const pSum = (stage.payments || []).filter(p => {
            const pDate = p.date || '';
            return pDate >= fromDate && pDate <= toDate;
          }).reduce((ps, p) => ps + (p.amount || 0), 0);
          return stSum + pSum;
        }, 0);
        return sum + stageSum;
      }, 0);
  }, [sites, selectedSiteId, fromDate, toDate]);

  const totalInflow = directClientIncome + milestoneIncome;

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
    return filteredRequests.reduce((sum, r) => {
      // Petrol charge is excluded from site expenses as per site requirement
      const pet = selectedSiteId === 'all' ? (Number(r.petrolCharge) || 0) : 0;
      return sum + (r.driverCost || 0) + pet;
    }, 0);
  }, [filteredRequests, selectedSiteId]);

  const totalTransportExpense = logTransportCost + reqTransportCost;

  // C) Site Miscellaneous (Food, Tea, Tools, Incidentals)
  const totalMiscExpense = useMemo(() => {
    return filteredLogs.reduce(
      (sum, l) => sum + (l.expenses || []).reduce((s, e) => s + (e.amount || 0), 0),
      0
    );
  }, [filteredLogs]);

  // D) Staff & Crew Payroll Breakdown & Expenses for the period
  const payrollData = useMemo(() => {
    let supervisorTotal = 0;
    let driverTotal = 0;
    let registeredCrewTotal = 0;
    let siteCrewTeamTotal = 0;

    const staffCards: {
      id: string;
      name: string;
      role: string;
      category: 'supervisor' | 'driver' | 'crew' | 'crew_team';
      days: number;
      otHours: number;
      basePay: number;
      otPay: number;
      extraPay: number;
      totalEarned: number;
    }[] = [];

    // 1. Individual Named Staff (Supervisors, Drivers, Registered Staff)
    staffList.forEach(staff => {
      const staffAtts = (attendances || []).filter(
        a => a.staffId === staff.id && a.date >= fromDate && a.date <= toDate
      );

      const relevantAtts = selectedSiteId === 'all'
        ? staffAtts
        : staffAtts.filter(a => {
            if (a.siteId) {
              return a.siteId === selectedSiteId;
            }
            if (a.siteAssignments && a.siteAssignments.length > 0 && staff.role !== 'supervisor') {
              return a.siteAssignments.some(sa => sa.siteId === selectedSiteId);
            }
            return false;
          });

      if (relevantAtts.length === 0 && selectedSiteId !== 'all') return;

      const dailyBase =
        staff.salaryType === 'hourly'
          ? (staff.perHourSalary || 0) * 8
          : (staff.perDaySalary || (staff.role === 'supervisor' ? 800 : staff.role === 'driver' ? 700 : 650));
      const otRate = staff.incentivePerHour || (staff.role === 'supervisor' ? 100 : 80);

      let fullDays = 0;
      let halfDays = 0;
      let otHours = 0;
      let basePay = 0;
      let otPay = 0;
      let extraPay = 0;

      relevantAtts.forEach(att => {
        if (att.status === 'present') {
          fullDays += 1;
          basePay += dailyBase;
        } else if (att.status === 'half-day') {
          halfDays += 1;
          basePay += dailyBase / 2;
        }
        const ot = att.otHours || 0;
        otHours += ot;
        otPay += ot * otRate;
      });

      // Extra allowances for drivers (transit trips from logs)
      if (staff.role === 'driver') {
        const driverLogs = filteredLogs.filter(l => l.driverId === staff.id || l.staffId === staff.id);
        const transitFromLogs = driverLogs.reduce((sum, l) => sum + (l.transportCost || 0), 0);
        extraPay += transitFromLogs;
      }

      const totalEarned = basePay + otPay + extraPay;
      if (fullDays > 0 || halfDays > 0 || otHours > 0 || totalEarned > 0) {
        if (staff.role === 'supervisor') supervisorTotal += totalEarned;
        else if (staff.role === 'driver') driverTotal += totalEarned;
        else registeredCrewTotal += totalEarned;

        staffCards.push({
          id: staff.id,
          name: staff.name,
          role: staff.role,
          category: staff.role === 'supervisor' ? 'supervisor' : staff.role === 'driver' ? 'driver' : 'crew',
          days: fullDays + (halfDays * 0.5),
          otHours,
          basePay,
          otPay,
          extraPay,
          totalEarned
        });
      }
    });

    // 2. Supervisor-Managed Site Crew Teams (Under-Labour: Painters, Plumbers, Helpers)
    const supervisors = staffList.filter(s => s.role === 'supervisor');
    supervisors.forEach(sup => {
      const supAtts = (attendances || []).filter(
        a => a.staffId === sup.id && a.date >= fromDate && a.date <= toDate && (a.presentCounts || a.halfDayCounts || (a.siteAssignments && a.siteAssignments.length > 0))
      );

      const relevantSupAtts = selectedSiteId === 'all'
        ? supAtts
        : supAtts.filter(a => {
            if (a.siteId) {
              return a.siteId === selectedSiteId;
            }
            if (a.siteAssignments && a.siteAssignments.length > 0) {
              return a.siteAssignments.some(sa => sa.siteId === selectedSiteId);
            }
            return false;
          });

      if (relevantSupAtts.length === 0) return;

      const crewRate = sup.underLabourSalary || 700;
      const crewOtRate = sup.underLabourOT || 100;

      let teamDays = 0;
      let teamOtHours = 0;
      let teamBasePay = 0;
      let teamOtPay = 0;

      relevantSupAtts.forEach(att => {
        let fullCount = Object.values(att.presentCounts || {}).reduce((s, c) => s + (c || 0), 0);
        let halfCount = Object.values(att.halfDayCounts || {}).reduce((s, c) => s + (c || 0), 0);

        // If site selected, check site-specific assignment
        if (selectedSiteId !== 'all' && att.siteAssignments && att.siteAssignments.length > 0) {
          const siteAlloc = att.siteAssignments.find(sa => sa.siteId === selectedSiteId);
          if (siteAlloc && siteAlloc.counts) {
            fullCount = Object.values(siteAlloc.counts).reduce((s, c) => s + (Number(c) || 0), 0);
            halfCount = 0;
          }
        }

        const ot = att.unnamedOtHours || 0;
        const otStaff = att.unnamedOtStaffCount !== undefined ? att.unnamedOtStaffCount : (ot > 0 ? (fullCount + halfCount) : 0);

        const dayCrewBase = (fullCount * crewRate) + (halfCount * (crewRate / 2));
        const dayCrewOt = otStaff * ot * crewOtRate;

        teamDays += fullCount + (halfCount * 0.5);
        teamOtHours += ot;
        teamBasePay += dayCrewBase;
        teamOtPay += dayCrewOt;
      });

      const teamTotal = teamBasePay + teamOtPay;
      if (teamDays > 0 || teamTotal > 0) {
        siteCrewTeamTotal += teamTotal;
        staffCards.push({
          id: `crew_team_${sup.id}`,
          name: `${sup.name}'s Site Crew Team`,
          role: 'Site Crew (Painters, Plumbers, Helpers)',
          category: 'crew_team',
          days: teamDays,
          otHours: teamOtHours,
          basePay: teamBasePay,
          otPay: teamOtPay,
          extraPay: 0,
          totalEarned: teamTotal
        });
      }
    });

    // 3. Worker Counts and Employee Salaries from Daily Logs
    filteredLogs.forEach(log => {
      // Check for named employee salaries stored on log (excluding supervisor who is already tracked above)
      if (log.employeeSalaries && Array.isArray(log.employeeSalaries)) {
        log.employeeSalaries.filter(emp => emp.role !== 'supervisor').forEach(emp => {
          const empSalary = Number(emp.totalSalary) || 0;
          if (empSalary > 0) {
            registeredCrewTotal += empSalary;
            staffCards.push({
              id: `emp_${emp.name}_${log.id}`,
              name: emp.name || 'Crew Member',
              role: emp.role || 'Crew Worker',
              category: 'crew',
              days: 1,
              otHours: 0,
              basePay: empSalary,
              otPay: 0,
              extraPay: 0,
              totalEarned: empSalary
            });
          }
        });
      }

      // Check for workerCounts if attendance didn't capture crew for this date & supervisor
      if (log.workerCounts && Object.values(log.workerCounts).some(v => (Number(v) || 0) > 0)) {
        const alreadyCountedInAtt = (attendances || []).some(
          a => (a.staffId === log.staffId || a.siteId === log.siteId) && a.date === log.date && (a.presentCounts || a.halfDayCounts)
        );
        if (!alreadyCountedInAtt) {
          const sup = staffList.find(s => s.id === log.staffId) || staffList.find(s => s.role === 'supervisor');
          const crewRate = sup?.underLabourSalary || 700;
          const logCrewCount = Object.values(log.workerCounts).reduce((s, c) => s + (Number(c) || 0), 0);
          const logCrewCost = logCrewCount * crewRate;

          siteCrewTeamTotal += logCrewCost;
          const existingTeam = staffCards.find(c => c.id === `crew_team_${sup?.id || 'daily_logs'}`);
          if (existingTeam) {
            existingTeam.days += logCrewCount;
            existingTeam.basePay += logCrewCost;
            existingTeam.totalEarned += logCrewCost;
          } else {
            staffCards.push({
              id: `crew_team_${sup?.id || 'daily_logs'}`,
              name: `${sup?.name || 'Site'} Crew Team (Work Logs)`,
              role: 'Site Crew (Painters, Plumbers, Helpers)',
              category: 'crew_team',
              days: logCrewCount,
              otHours: 0,
              basePay: logCrewCost,
              otPay: 0,
              extraPay: 0,
              totalEarned: logCrewCost
            });
          }
        }
      }
    });

    const crewTotal = registeredCrewTotal + siteCrewTeamTotal;
    const totalPayroll = supervisorTotal + driverTotal + crewTotal;

    return {
      supervisorTotal,
      driverTotal,
      crewTotal,
      siteCrewTeamTotal,
      registeredCrewTotal,
      totalPayroll,
      staffCards
    };
  }, [staffList, attendances, filteredLogs, fromDate, toDate, selectedSiteId, sites]);

  const totalPayrollExpense = payrollData.totalPayroll;

  // Paid payroll settlements from History
  const paidHistoryRecords = useMemo(() => {
    try {
      const stored = localStorage.getItem('edamari_payroll_history');
      const allHistory: any[] = stored ? JSON.parse(stored) : [];
      return allHistory.filter(h => {
        const pDate = h.fromDate || (h.paidAt ? h.paidAt.split(',')[0] : '');
        const inDate = (h.fromDate && h.fromDate >= fromDate && h.toDate <= toDate) ||
                       (pDate && pDate >= fromDate && pDate <= toDate);
        if (!inDate) return false;
        if (selectedSiteId !== 'all') {
          const staffWorkedOnSite = (attendances || []).some(
            a => a.staffId === h.staffId && (a.siteId === selectedSiteId || a.siteAssignments?.some(sa => sa.siteId === selectedSiteId))
          ) || (filteredLogs || []).some(
            l => (l.staffId === h.staffId || l.driverId === h.staffId) && l.siteId === selectedSiteId
          );
          return staffWorkedOnSite;
        }
        return true;
      });
    } catch {
      return [];
    }
  }, [fromDate, toDate, selectedSiteId, attendances, filteredLogs]);

  const totalPaidPayroll = useMemo(() => {
    return paidHistoryRecords.reduce((sum, h) => sum + (h.totalAmount || 0), 0);
  }, [paidHistoryRecords]);

  const totalManualExpense = useMemo(() => {
    return filteredManualExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredManualExpenses]);

  // E) Rental Equipment & Machinery on Site
  const filteredRentals = useMemo(() => {
    return (materialRentals || []).filter(r => {
      if (selectedSiteId !== 'all' && r.siteId !== selectedSiteId) return false;
      const rStart = r.startDate || fromDate;
      const rEnd = r.endDate || (r.status === 'active' ? format(new Date(), 'yyyy-MM-dd') : rStart);
      return rStart <= toDate && rEnd >= fromDate;
    });
  }, [materialRentals, selectedSiteId, fromDate, toDate]);

  const totalRentalExpense = useMemo(() => {
    return filteredRentals.reduce((sum, r) => {
      if (r.totalRentalCost !== undefined && r.status === 'returned') {
        return sum + r.totalRentalCost;
      }
      const effStart = r.startDate && r.startDate > fromDate ? r.startDate : fromDate;
      const effEnd = r.endDate && r.endDate < toDate ? r.endDate : toDate;
      const startMs = new Date(effStart + 'T00:00:00').getTime();
      const endMs = new Date(effEnd + 'T00:00:00').getTime();
      const days = Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1);
      return sum + (days * (r.quantity || 1) * (r.rentalRatePerDay || 0)) + (r.transitCost || 0);
    }, 0);
  }, [filteredRentals, fromDate, toDate]);

  // Total Outflow
  const totalOutflow = totalMaterialsExpense + totalTransportExpense + totalRentalExpense + totalMiscExpense + totalPayrollExpense + totalManualExpense;

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
    doc.text('JGS CONSTRUCTION & INTERIORS', 14, 20);

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
      ['Rental Equipment & Machinery', totalRentalExpense.toLocaleString(), totalOutflow > 0 ? `${((totalRentalExpense / totalOutflow) * 100).toFixed(1)}%` : '0%', 'Scaffolding, machines & equipment deployed'],
      ['Staff Payroll (Supervisors & Drivers)', (payrollData.supervisorTotal + payrollData.driverTotal).toLocaleString(), totalOutflow > 0 ? `${(((payrollData.supervisorTotal + payrollData.driverTotal) / totalOutflow) * 100).toFixed(1)}%` : '0%', 'Supervisor & Driver salaries, OT & transit'],
      ['Site Crew Team Wages', payrollData.crewTotal.toLocaleString(), totalOutflow > 0 ? `${((payrollData.crewTotal / totalOutflow) * 100).toFixed(1)}%` : '0%', 'Under-labour crew: Painters, Plumbers, Helpers'],
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

    // 3. Staff & Crew Payroll Breakdown Table
    const lastY2 = (doc as any).lastAutoTable?.finalY || 200;
    const startYPay = lastY2 > 210 ? 25 : lastY2 + 14;
    if (lastY2 > 210) {
      doc.addPage();
    }
    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.text('3. Itemized Staff & Crew Payroll Ledger', 14, startYPay - 4);

    const payHead = [['Staff / Crew Member', 'Role / Category', 'Man-Days', 'OT (Hrs)', 'Total Amount (Rs)', 'Status']];
    const payBody = payrollData.staffCards.map(s => {
      const isPaid = paidHistoryRecords.some(h => h.staffId === s.id);
      return [
        s.name,
        s.role,
        `${s.days}d`,
        s.otHours > 0 ? `${s.otHours}h` : '-',
        s.totalEarned.toLocaleString(),
        isPaid ? 'PAID' : 'PENDING'
      ];
    });

    if (payBody.length > 0) {
      payBody.push([
        'TOTAL PAYROLL',
        'All staff & crew teams',
        `${payrollData.staffCards.reduce((sum, s) => sum + s.days, 0)}d`,
        `${payrollData.staffCards.reduce((sum, s) => sum + s.otHours, 0)}h`,
        payrollData.totalPayroll.toLocaleString(),
        totalPaidPayroll > 0 ? `Paid: Rs ${totalPaidPayroll.toLocaleString()}` : 'PENDING'
      ]);
    }

    autoTable(doc, {
      startY: startYPay,
      head: payHead,
      body: payBody.length > 0 ? payBody : [['No staff or crew payroll entries found for this period', '-', '-', '-', '0', '-']],
      theme: 'grid',
      headStyles: { fillColor: [124, 58, 237], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 45 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
        5: { halign: 'center', cellWidth: 19 }
      },
      didParseCell: function(data) {
        if (payBody.length > 0 && data.row.index === payBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [243, 232, 255];
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
                {(() => {
                  const siteIds = new Set(sites.map(s => s.id));
                  const allSiteOptions = [...sites];
                  (dailyLogs || []).forEach(log => {
                    if (log.siteId && !siteIds.has(log.siteId)) {
                      siteIds.add(log.siteId);
                      allSiteOptions.push({
                        id: log.siteId,
                        name: log.siteName || 'Custom Site',
                        clientName: 'Field Visit',
                        address: '',
                        status: 'active',
                        budget: 0,
                        paymentStages: [],
                        assignedStaffIds: [],
                        supervisorId: '',
                        startDate: log.date || '',
                      });
                    }
                  });
                  return allSiteOptions.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.clientName})
                    </SelectItem>
                  ));
                })()}
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

      {/* 5 Financial Pillar KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

        {/* Rentals on Site Card */}
        <Card className="p-4 rounded-2xl bg-amber-500/[0.08] border border-amber-500/25 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 tracking-wider flex items-center gap-1">
            <RefreshCw className="w-3 h-3 text-amber-600" /> Rentals on Site
          </span>
          <p className="text-2xl font-heading font-bold text-amber-700 dark:text-amber-400">
            ₹{totalRentalExpense.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {filteredRentals.length} machinery & rental items
          </p>
        </Card>

        {/* Payroll Card */}
        <Card className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center justify-between">
            <span>👷 Staff & Crew Payroll</span>
            {totalPaidPayroll > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                ✓ Disbursed
              </span>
            )}
          </span>
          <p className="text-2xl font-heading font-bold text-foreground">
            ₹{totalPayrollExpense.toLocaleString()}
          </p>
          <div className="text-[10px] text-muted-foreground space-y-0.5 pt-0.5">
            <div>Sup: ₹{payrollData.supervisorTotal.toLocaleString()} · Drv: ₹{payrollData.driverTotal.toLocaleString()}</div>
            <div className="text-amber-700 dark:text-amber-300 font-medium">Crew Teams: ₹{payrollData.crewTotal.toLocaleString()}</div>
            {totalPaidPayroll > 0 && (
              <div className="text-emerald-600 dark:text-emerald-400 font-semibold pt-0.5 border-t border-border/30">
                Disbursed: ₹{totalPaidPayroll.toLocaleString()}
              </div>
            )}
          </div>
        </Card>

        {/* Transport & Misc */}
        <Card className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs space-y-1 col-span-2 sm:col-span-1">
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

            <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
              <div>
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                  Rental Equipment & Machinery
                </span>
                <span className="text-[10px] text-muted-foreground">Scaffolding, tools & machinery on site ({filteredRentals.length} deployments)</span>
              </div>
              <span className="font-bold text-sm text-amber-700 dark:text-amber-400 font-mono">₹{totalRentalExpense.toLocaleString()}</span>
            </div>

            {/* Staff & Crew Payroll Breakdown */}
            <div className="p-2.5 rounded-xl bg-purple-500/[0.05] border border-purple-500/20 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-600" />
                  Staff Wages & Crew Payroll
                </span>
                <span className="font-bold text-sm text-destructive font-mono">
                  ₹{totalPayrollExpense.toLocaleString()}
                </span>
              </div>
              <div className="pl-5 space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>· Supervisors (Base & Overtime):</span>
                  <span className="font-medium text-foreground">₹{payrollData.supervisorTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>· Drivers (Base & Transit Runs):</span>
                  <span className="font-medium text-foreground">₹{payrollData.driverTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>· Site Crew & Trade Wages (Painters, Plumbers, Helpers):</span>
                  <span className="font-medium text-foreground">₹{payrollData.crewTotal.toLocaleString()}</span>
                </div>
                {totalPaidPayroll > 0 && (
                  <div className="flex justify-between pt-1 border-t border-purple-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>✓ Actual Settled & Disbursed in Period:</span>
                    <span>₹{totalPaidPayroll.toLocaleString()}</span>
                  </div>
                )}
              </div>
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

      {/* Detailed Staff & Crew Payroll Ledger Card */}
      <Card className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h4 className="font-heading font-bold text-sm text-foreground">
              Itemized Staff & Crew Payroll Breakdown ({payrollData.staffCards.length})
            </h4>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span>Total Incurred: <strong className="text-foreground">₹{totalPayrollExpense.toLocaleString()}</strong></span>
            {totalPaidPayroll > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Settled: <strong>₹{totalPaidPayroll.toLocaleString()}</strong>
              </span>
            )}
          </div>
        </div>

        {payrollData.staffCards.length === 0 ? (
          <div className="text-center py-8 bg-muted/20 rounded-xl text-muted-foreground text-xs border border-dashed border-border/50">
            No payroll or attendance wages recorded for this period & scope.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {payrollData.staffCards.map(staff => {
                const isPaid = paidHistoryRecords.some(h => h.staffId === staff.id);

                return (
                  <div
                    key={staff.id}
                    className="p-3 bg-muted/25 hover:bg-muted/40 rounded-xl border border-border/50 space-y-2 transition-all shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-xs text-foreground flex items-center gap-1.5 flex-wrap">
                          <span>{staff.name}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                            staff.category === 'supervisor'
                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                              : staff.category === 'driver'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          }`}>
                            {staff.category === 'supervisor' ? 'Supervisor' : staff.category === 'driver' ? 'Driver' : 'Site Crew'}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{staff.role}</span>
                      </div>

                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        isPaid
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      }`}>
                        {isPaid ? '✓ PAID' : '⏳ PENDING'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                      <div>
                        <span>{staff.days} Days</span>
                        {staff.otHours > 0 && <span className="text-amber-600"> · {staff.otHours}h OT</span>}
                        {staff.extraPay > 0 && <span className="text-blue-600"> · +₹{staff.extraPay}</span>}
                      </div>
                      <span className="font-heading font-extrabold text-xs text-foreground">
                        ₹{staff.totalEarned.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

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
                <Label className="text-xs">Payment Method</Label>
                <Select value={expensePaymentMethod} onValueChange={(val: any) => setExpensePaymentMethod(val)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Payment Mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">💵 Cash</SelectItem>
                    <SelectItem value="UPI">📱 UPI / GPay / PhonePe</SelectItem>
                    <SelectItem value="Bank Transfer">🏦 Bank Transfer</SelectItem>
                    <SelectItem value="Cheque">📝 Cheque</SelectItem>
                    <SelectItem value="Card">💳 Card</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{exp.category}</span>
                        <span className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border border-border/30">
                          {format(new Date(exp.date), 'dd MMM yyyy')}
                        </span>
                        {exp.paymentMethod && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            {exp.paymentMethod === 'Cash' ? '💵 Cash' :
                             exp.paymentMethod === 'UPI' ? '📱 UPI' :
                             exp.paymentMethod === 'Bank Transfer' ? '🏦 Bank Transfer' :
                             exp.paymentMethod === 'Cheque' ? '📝 Cheque' :
                             exp.paymentMethod === 'Card' ? '💳 Card' : exp.paymentMethod}
                          </span>
                        )}
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
