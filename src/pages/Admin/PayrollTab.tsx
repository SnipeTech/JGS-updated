import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addWeeks, subWeeks, addMonths, subMonths
} from 'date-fns';
import {
  Users, UserCircle, ChevronDown, ChevronUp, MapPin, Wallet,
  CalendarDays, Truck, ChevronLeft, ChevronRight, TrendingUp, FileDown,
  CheckCircle2, History, RotateCcw, Search, Printer, DollarSign,
  AlertCircle, ShieldCheck, CreditCard, Banknote, HardHat, Sparkles,
  Clock, X, Check, ArrowRight, ClipboardList
} from 'lucide-react';
import { Staff } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface SalaryPaymentRecord {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  periodType: 'weekly' | 'monthly' | 'custom';
  periodLabel: string;
  fromDate: string;
  toDate: string;
  daysWorked: number;
  otHours: number;
  basePay: number;
  otPay: number;
  extraPay: number; // transit or crew pay
  totalAmount: number;
  paidAt: string;
  paymentMode: 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque';
  referenceNo?: string;
  notes?: string;
  paidBy: string;
  category: 'staff' | 'crew';
}

export const PayrollTab = () => {
  const { staffList, attendances, dailyLogs, materialRequests } = useApp();

  // Top level views: 'current' (Active Statements) vs 'history' (History of Paid Salaries)
  const [mainTab, setMainTab] = useState<'current' | 'history'>('current');

  const [filterType, setFilterType] = useState<'weekly' | 'monthly' | 'custom'>('monthly');
  const [selectedStaffId, setSelectedStaffId] = useState('all');
  const [selectedRole, setSelectedRole] = useState<'all' | 'supervisor' | 'driver' | 'crew'>('all');

  // Weekly filter state
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());

  // Monthly filter state
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  // Custom filter state
  const [customFrom, setCustomFrom] = useState(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [customTo, setCustomTo] = useState(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );

  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  // Paid Status Map persisted in localStorage: key = `${staffId}_${fromDate}_${toDate}`
  const [paidStatusMap, setPaidStatusMap] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('edamari_payroll_paid');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Paid Salary History persisted in localStorage
  const [paidHistory, setPaidHistory] = useState<SalaryPaymentRecord[]>(() => {
    try {
      const stored = localStorage.getItem('edamari_payroll_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // History search & filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyModeFilter, setHistoryModeFilter] = useState<'all' | 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque'>('all');
  const [historyRoleFilter, setHistoryRoleFilter] = useState<'all' | 'supervisor' | 'driver' | 'crew'>('all');

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [targetPayout, setTargetPayout] = useState<{
    staffId: string;
    staffName: string;
    role: string;
    daysWorked: number;
    otHours: number;
    basePay: number;
    otPay: number;
    extraPay: number;
    totalAmount: number;
    category: 'staff' | 'crew';
  } | null>(null);

  const [payMode, setPayMode] = useState<'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque'>('Cash');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');

  // Detailed Attendance Modal State
  const [selectedStaffAttendance, setSelectedStaffAttendance] = useState<any | null>(null);

  const formatDuration = (inTime?: string, outTime?: string): string => {
    if (!inTime || !outTime || inTime === '-' || outTime === '-') return '';
    try {
      const [inH, inM] = inTime.split(':').map(Number);
      const [outH, outM] = outTime.split(':').map(Number);
      let diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
      if (diffMinutes < 0) diffMinutes += 24 * 60;
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`.trim();
    } catch {
      return '';
    }
  };

  // Derive date bounds and human label
  const { fromDate, toDate, periodLabel } = useMemo(() => {
    if (filterType === 'weekly') {
      const s = startOfWeek(currentWeekDate, { weekStartsOn: 1 });
      const e = endOfWeek(currentWeekDate, { weekStartsOn: 1 });
      return {
        fromDate: format(s, 'yyyy-MM-dd'),
        toDate: format(e, 'yyyy-MM-dd'),
        periodLabel: `Week: ${format(s, 'dd MMM')} – ${format(e, 'dd MMM yyyy')}`
      };
    } else if (filterType === 'monthly') {
      const s = startOfMonth(currentMonthDate);
      const e = endOfMonth(currentMonthDate);
      return {
        fromDate: format(s, 'yyyy-MM-dd'),
        toDate: format(e, 'yyyy-MM-dd'),
        periodLabel: `Month: ${format(currentMonthDate, 'MMMM yyyy')}`
      };
    } else {
      return {
        fromDate: customFrom,
        toDate: customTo,
        periodLabel: `Period: ${customFrom} to ${customTo}`
      };
    }
  }, [filterType, currentWeekDate, currentMonthDate, customFrom, customTo]);

  const getPaidKey = (staffId: string) => `${staffId}_${fromDate}_${toDate}`;
  const isStaffPaid = (staffId: string) => !!paidStatusMap[getPaidKey(staffId)];

  // Open payment dialog for individual staff or crew
  const openPaymentModal = (item: {
    staffId: string;
    staffName: string;
    role: string;
    daysWorked: number;
    otHours: number;
    basePay: number;
    otPay: number;
    extraPay: number;
    totalAmount: number;
    category: 'staff' | 'crew';
  }, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTargetPayout(item);
    setPayMode('Cash');
    setPayRef('');
    setPayNote('');
    setPaymentModalOpen(true);
  };

  // Confirm payment in modal
  const confirmPayment = () => {
    if (!targetPayout) return;
    const paidAtFormatted = format(new Date(), 'dd MMM yyyy, hh:mm a');
    const newRecord: SalaryPaymentRecord = {
      id: `pay_${Date.now()}_${targetPayout.staffId}`,
      staffId: targetPayout.staffId,
      staffName: targetPayout.staffName,
      role: targetPayout.role,
      periodType: filterType,
      periodLabel,
      fromDate,
      toDate,
      daysWorked: targetPayout.daysWorked,
      otHours: targetPayout.otHours,
      basePay: targetPayout.basePay,
      otPay: targetPayout.otPay,
      extraPay: targetPayout.extraPay,
      totalAmount: targetPayout.totalAmount,
      paidAt: paidAtFormatted,
      paymentMode: payMode,
      referenceNo: payRef.trim() || undefined,
      notes: payNote.trim() || undefined,
      paidBy: 'Admin',
      category: targetPayout.category
    };

    // Update history
    setPaidHistory(prev => {
      const filtered = prev.filter(r => !(r.staffId === targetPayout.staffId && r.fromDate === fromDate && r.toDate === toDate));
      const next = [newRecord, ...filtered];
      localStorage.setItem('edamari_payroll_history', JSON.stringify(next));
      return next;
    });

    // Update paid status map
    setPaidStatusMap(prev => {
      const key = getPaidKey(targetPayout.staffId);
      const updated = { ...prev, [key]: true };
      localStorage.setItem('edamari_payroll_paid', JSON.stringify(updated));
      return updated;
    });

    toast.success(`₹${targetPayout.totalAmount.toLocaleString()} paid to ${targetPayout.staffName} recorded in History!`);
    setPaymentModalOpen(false);
    setTargetPayout(null);
  };

  // Revoke payment (mark unpaid)
  const revokePayment = (staffId: string, fDate = fromDate, tDate = toDate, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPaidHistory(prev => {
      const next = prev.filter(r => !(r.staffId === staffId && r.fromDate === fDate && r.toDate === tDate));
      localStorage.setItem('edamari_payroll_history', JSON.stringify(next));
      return next;
    });

    setPaidStatusMap(prev => {
      const key = `${staffId}_${fDate}_${tDate}`;
      const next = { ...prev };
      delete next[key];
      localStorage.setItem('edamari_payroll_paid', JSON.stringify(next));
      return next;
    });

    toast.info('Payment revoked and status reset to PENDING');
  };

  // Mark all pending as paid
  const markAllAsPaid = () => {
    const paidAtFormatted = format(new Date(), 'dd MMM yyyy, hh:mm a');
    const newRecords: SalaryPaymentRecord[] = [];
    const updatedStatus = { ...paidStatusMap };

    // Include standard staff and crew teams
    allCards.forEach(p => {
      const key = getPaidKey(p.id);
      if (!updatedStatus[key]) {
        updatedStatus[key] = true;
        newRecords.push({
          id: `pay_${Date.now()}_${p.id}_${Math.floor(Math.random() * 1000)}`,
          staffId: p.id,
          staffName: p.name,
          role: p.role,
          periodType: filterType,
          periodLabel,
          fromDate,
          toDate,
          daysWorked: p.presentDays + (p.halfDays * 0.5),
          otHours: p.totalOtHours,
          basePay: p.basePay,
          otPay: p.otPay,
          extraPay: p.transitPay || p.crewPay || 0,
          totalAmount: p.totalEarned,
          paidAt: paidAtFormatted,
          paymentMode: 'Cash',
          notes: 'Bulk payout marked by Admin',
          paidBy: 'Admin',
          category: p.isCrewTeam ? 'crew' : 'staff'
        });
      }
    });

    if (newRecords.length === 0) {
      toast.info('All entries for this period are already marked as PAID');
      return;
    }

    setPaidHistory(prev => {
      const next = [...newRecords, ...prev];
      localStorage.setItem('edamari_payroll_history', JSON.stringify(next));
      return next;
    });

    setPaidStatusMap(updatedStatus);
    localStorage.setItem('edamari_payroll_paid', JSON.stringify(updatedStatus));
    toast.success(`Marked all ${newRecords.length} payouts as PAID and recorded in History!`);
  };

  // 1. STANDARD STAFF PAYROLL (Supervisors, Drivers, and Registered Crew Staff)
  const staffPayrollData = useMemo(() => {
    return staffList
      .filter(s => {
        if (selectedStaffId !== 'all' && s.id !== selectedStaffId) return false;
        if (selectedRole === 'supervisor' && s.role !== 'supervisor') return false;
        if (selectedRole === 'driver' && s.role !== 'driver') return false;
        if (selectedRole === 'crew' && (s.role === 'supervisor' || s.role === 'driver' || s.role === 'admin')) return false;
        return true;
      })
      .map(staff => {
        const staffAtts = (attendances || []).filter(
          a => a.staffId === staff.id && a.date >= fromDate && a.date <= toDate
        );

        let presentDays = 0;
        let halfDays = 0;
        let absentDays = 0;
        let totalOtHours = 0;
        let basePay = 0;
        let otPay = 0;
        let transitPay = 0;
        let supervisorCrewPay = 0;
        let totalDriverTrips = 0;

        const dailyBase =
          staff.salaryType === 'hourly'
            ? (staff.perHourSalary || 0) * 8
            : (staff.perDaySalary || (staff.role === 'supervisor' ? 800 : staff.role === 'driver' ? 700 : 650));
        const otRate = staff.incentivePerHour || (staff.role === 'supervisor' ? 100 : 80);
        const isDrv = staff.role === 'driver';
        const isSup = staff.role === 'supervisor';
        const isNamedCrew = staff.role !== 'supervisor' && staff.role !== 'driver' && staff.role !== 'admin';

        const breakdown: {
          date: string;
          status: string;
          base: number;
          otHours: number;
          otPay: number;
          transitPay: number;
          crewPay: number;
          tripCount: number;
          dayTotal: number;
          siteName?: string;
        }[] = [];

        staffAtts.forEach(att => {
          if (att.status === 'present' || att.status === 'half-day') {
            const isHalf = att.status === 'half-day';
            if (isHalf) halfDays++;
            else presentDays++;

            const dayBase = isHalf ? dailyBase / 2 : dailyBase;
            const dayOtHours = att.otHours || 0;
            const dayOt = dayOtHours * otRate;

            // Driver transit runs on this day
            let dayTrips: any[] = [];
            let dayTransit = 0;
            if (isDrv) {
              dayTrips = (materialRequests || []).filter(
                r => (r.driverId === staff.id || r.driverName?.toLowerCase() === staff.name.toLowerCase()) &&
                     (r.date === att.date || r.createdAt?.startsWith(att.date))
              );
              dayTransit = dayTrips.reduce((sum, r) => sum + (r.driverCost || 0), 0);
              totalDriverTrips += dayTrips.length;
            }

            // Supervisor under-labour crew count on this day
            let dayCrew = 0;
            if (isSup && att.presentCounts) {
              const unCount =
                (att.presentCounts.painter || 0) +
                (att.presentCounts.plumber || 0) +
                (att.presentCounts.labour || 0);
              const crewSalaryRate = staff.underLabourSalary || 700;
              const crewOtRate = staff.underLabourOT || 100;

              const unDaily = unCount * crewSalaryRate;
              const unOtStaff =
                att.unnamedOtStaffCount !== undefined
                  ? att.unnamedOtStaffCount
                  : (att.unnamedOtHours || 0) > 0
                  ? unCount
                  : 0;
              const unOt = unOtStaff * (att.unnamedOtHours || 0) * crewOtRate;
              dayCrew = unDaily + unOt;
            }

            basePay += dayBase;
            otPay += dayOt;
            transitPay += dayTransit;
            supervisorCrewPay += dayCrew;
            totalOtHours += dayOtHours;

            const matchingLog = dailyLogs.find(
              l => l.date === att.date && (l.staffId === staff.id || l.workerIds?.includes(staff.id))
            );

            const inTimeStr = att.inTime || staff.inTime || '09:00';
            const outTimeStr = att.outTime || staff.outTime || (isHalf ? '13:30' : '18:00');
            const dur = formatDuration(inTimeStr, outTimeStr);

            breakdown.push({
              date: att.date,
              status: att.status,
              base: dayBase,
              otHours: dayOtHours,
              otPay: dayOt,
              transitPay: dayTransit,
              crewPay: dayCrew,
              tripCount: dayTrips.length,
              dayTotal: dayBase + dayOt + dayTransit,
              siteName: matchingLog?.siteName || (isDrv ? 'Logistics Delivery' : 'Site Operation'),
              workDescription: matchingLog?.notes,
              notes: att.notes,
              inTime: inTimeStr,
              outTime: outTimeStr,
              duration: dur,
              painters: att.presentCounts?.painter || 0,
              plumbers: att.presentCounts?.plumber || 0,
              labour: att.presentCounts?.labour || 0
            });
          } else if (att.status === 'absent') {
            absentDays++;
            breakdown.push({
              date: att.date,
              status: 'absent',
              base: 0,
              otHours: 0,
              otPay: 0,
              transitPay: 0,
              crewPay: 0,
              tripCount: 0,
              dayTotal: 0,
              siteName: 'Absent / Off Duty',
              notes: att.notes || 'Marked Absent',
              inTime: '-',
              outTime: '-',
              duration: '-'
            });
          }
        });

        // Driver transit on dates without explicit attendance
        if (isDrv) {
          const tripsInPeriod = (materialRequests || []).filter(
            r => (r.driverId === staff.id || r.driverName?.toLowerCase() === staff.name.toLowerCase()) &&
                 ((r.date && r.date >= fromDate && r.date <= toDate) ||
                  (r.createdAt && r.createdAt.substring(0, 10) >= fromDate && r.createdAt.substring(0, 10) <= toDate))
          );

          tripsInPeriod.forEach(t => {
            const tripDate = t.date || t.createdAt?.substring(0, 10);
            if (tripDate && !breakdown.some(b => b.date === tripDate)) {
              const tripCost = t.driverCost || 0;
              transitPay += tripCost;
              totalDriverTrips += 1;
              breakdown.push({
                date: tripDate,
                status: 'delivery-only',
                base: 0,
                otHours: 0,
                otPay: 0,
                transitPay: tripCost,
                crewPay: 0,
                tripCount: 1,
                dayTotal: tripCost,
                siteName: `Dispatch: ${t.siteName || 'Site'}`
              });
            }
          });
        }

        // Crew member worked in dailyLogs on dates without explicit attendance
        if (isNamedCrew) {
          const logsInPeriod = dailyLogs.filter(
            l => (l.staffId === staff.id || l.workerIds?.includes(staff.id)) &&
                 l.date >= fromDate && l.date <= toDate
          );

          logsInPeriod.forEach(l => {
            if (!breakdown.some(b => b.date === l.date)) {
              presentDays++;
              basePay += dailyBase;
              breakdown.push({
                date: l.date,
                status: 'present',
                base: dailyBase,
                otHours: 0,
                otPay: 0,
                transitPay: 0,
                crewPay: 0,
                tripCount: 0,
                dayTotal: dailyBase,
                siteName: l.siteName || 'Site Work Entry'
              });
            }
          });
        }

        breakdown.sort((a, b) => b.date.localeCompare(a.date));
        const totalEarned = isSup ? (basePay + otPay) : (basePay + otPay + transitPay);

        return {
          ...staff,
          isCrewTeam: false,
          dailyBase,
          presentDays,
          halfDays,
          absentDays,
          totalOtHours,
          basePay,
          otPay,
          transitPay,
          crewPay: supervisorCrewPay,
          totalDriverTrips,
          totalEarned,
          breakdown
        };
      })
      .filter(d => d.presentDays > 0 || d.halfDays > 0 || d.totalEarned > 0 || (d.role === 'supervisor' && d.crewPay > 0));
  }, [staffList, attendances, dailyLogs, materialRequests, fromDate, toDate, selectedStaffId, selectedRole]);

  // 2. SUPERVISOR-MANAGED SITE CREW TEAMS (Under-Labour Teams)
  const supervisorCrewTeams = useMemo(() => {
    if (selectedRole !== 'all' && selectedRole !== 'crew') return [];

    const supervisors = staffList.filter(s => s.role === 'supervisor');
    const teams: any[] = [];

    supervisors.forEach(sup => {
      if (selectedStaffId !== 'all' && selectedStaffId !== sup.id) return;

      const supAtts = (attendances || []).filter(
        a => a.staffId === sup.id && a.date >= fromDate && a.date <= toDate && a.presentCounts
      );

      let totalPainterManDays = 0;
      let totalPlumberManDays = 0;
      let totalLabourManDays = 0;
      let totalOtHours = 0;
      let totalCrewBasePay = 0;
      let totalCrewOtPay = 0;

      const crewRate = sup.underLabourSalary || 700;
      const crewOtRate = sup.underLabourOT || 100;

      const crewBreakdown: {
        date: string;
        painters: number;
        plumbers: number;
        labour: number;
        totalCrewCount: number;
        otHours: number;
        otStaff: number;
        crewBase: number;
        crewOt: number;
        dayTotal: number;
        siteName?: string;
      }[] = [];

      supAtts.forEach(att => {
        if (!att.presentCounts) return;
        const p = att.presentCounts.painter || 0;
        const pl = att.presentCounts.plumber || 0;
        const l = att.presentCounts.labour || 0;
        const dayHeadcount = p + pl + l;

        if (dayHeadcount === 0 && (!att.unnamedOtHours || att.unnamedOtHours === 0)) return;

        totalPainterManDays += p;
        totalPlumberManDays += pl;
        totalLabourManDays += l;

        const dayCrewBase = dayHeadcount * crewRate;
        const otHours = att.unnamedOtHours || 0;
        const otStaff =
          att.unnamedOtStaffCount !== undefined
            ? att.unnamedOtStaffCount
            : otHours > 0
            ? dayHeadcount
            : 0;
        const dayCrewOt = otStaff * otHours * crewOtRate;

        totalOtHours += otHours;
        totalCrewBasePay += dayCrewBase;
        totalCrewOtPay += dayCrewOt;

        const matchingLog = dailyLogs.find(
          dl => dl.staffId === sup.id && dl.date === att.date
        );

        crewBreakdown.push({
          date: att.date,
          status: 'present',
          painters: p,
          plumbers: pl,
          labour: l,
          totalCrewCount: dayHeadcount,
          otHours,
          otStaff,
          base: dayCrewBase,
          crewBase: dayCrewBase,
          otPay: dayCrewOt,
          crewOt: dayCrewOt,
          dayTotal: dayCrewBase + dayCrewOt,
          siteName: matchingLog?.siteName || 'Multiple Sites'
        });
      });

      const totalCrewPay = totalCrewBasePay + totalCrewOtPay;
      const totalManDays = totalPainterManDays + totalPlumberManDays + totalLabourManDays;

      if (totalManDays > 0 || totalCrewPay > 0) {
        teams.push({
          id: `crew_team_${sup.id}`,
          isCrewTeam: true,
          supervisorId: sup.id,
          supervisorName: sup.name,
          name: `${sup.name}'s Site Crew Team`,
          role: 'Site Crew (Painters, Plumbers, Labourers)',
          dailyBase: crewRate,
          otRate: crewOtRate,
          presentDays: totalManDays,
          halfDays: 0,
          absentDays: 0,
          totalOtHours: totalOtHours,
          painterDays: totalPainterManDays,
          plumberDays: totalPlumberManDays,
          labourDays: totalLabourManDays,
          basePay: totalCrewBasePay,
          otPay: totalCrewOtPay,
          transitPay: 0,
          crewPay: 0,
          totalEarned: totalCrewPay,
          breakdown: crewBreakdown
        });
      }
    });

    return teams;
  }, [staffList, attendances, dailyLogs, fromDate, toDate, selectedStaffId, selectedRole]);

  // Combined cards list
  const allCards = useMemo(() => {
    if (selectedRole === 'crew') {
      const namedCrew = staffPayrollData.filter(s => s.role !== 'supervisor' && s.role !== 'driver');
      return [...supervisorCrewTeams, ...namedCrew];
    } else if (selectedRole === 'supervisor') {
      return staffPayrollData.filter(s => s.role === 'supervisor');
    } else if (selectedRole === 'driver') {
      return staffPayrollData.filter(s => s.role === 'driver');
    } else {
      return [...staffPayrollData, ...supervisorCrewTeams];
    }
  }, [staffPayrollData, supervisorCrewTeams, selectedRole]);

  // Executive summary metrics
  const totalPayroll = allCards.reduce((s, p) => s + p.totalEarned, 0);
  const totalDays = allCards.reduce((s, p) => s + p.presentDays + (p.halfDays * 0.5), 0);
  const totalOtHours = allCards.reduce((s, p) => s + p.totalOtHours, 0);
  const totalOtPay = allCards.reduce((s, p) => s + p.otPay, 0);
  const totalTransitPay = allCards.reduce((s, p) => s + (p.transitPay || 0), 0);
  const totalPaid = allCards.filter(p => isStaffPaid(p.id)).reduce((s, p) => s + p.totalEarned, 0);
  const totalPending = totalPayroll - totalPaid;

  // Weekly Crew Summary Metrics
  const crewSummary = useMemo(() => {
    let painterDays = 0;
    let plumberDays = 0;
    let labourDays = 0;
    let crewOtPay = 0;
    let crewBasePay = 0;
    let totalCrewCost = 0;

    supervisorCrewTeams.forEach(t => {
      painterDays += t.painterDays;
      plumberDays += t.plumberDays;
      labourDays += t.labourDays;
      crewOtPay += t.otPay;
      crewBasePay += t.basePay;
      totalCrewCost += t.totalEarned;
    });

    const individualCrew = staffPayrollData.filter(s => s.role !== 'supervisor' && s.role !== 'driver');
    individualCrew.forEach(c => {
      if (c.role === 'painter') painterDays += c.presentDays + (c.halfDays * 0.5);
      else if (c.role === 'plumber') plumberDays += c.presentDays + (c.halfDays * 0.5);
      else labourDays += c.presentDays + (c.halfDays * 0.5);
      crewOtPay += c.otPay;
      crewBasePay += c.basePay;
      totalCrewCost += c.totalEarned;
    });

    return {
      painterDays,
      plumberDays,
      labourDays,
      totalHeadcountDays: painterDays + plumberDays + labourDays,
      crewOtPay,
      crewBasePay,
      totalCrewCost
    };
  }, [supervisorCrewTeams, staffPayrollData]);

  // Export Current Statement PDF
  const exportPayrollPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.setTextColor(184, 117, 26);
    doc.text('JGS INTERIOR & CONSTRUCTION', 14, 18);

    doc.setFontSize(13);
    doc.setTextColor(40);
    doc.text(
      selectedRole === 'crew'
        ? 'WEEKLY SITE CREW PAYROLL & WAGE STATEMENT'
        : 'STAFF & CREW PAYROLL STATEMENT',
      14, 26
    );

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${periodLabel}`, 14, 32);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 37);

    // Summary Box
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(14, 42, 268, 16, 2, 2, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text(`Total Payout: Rs ${totalPayroll.toLocaleString()}`, 20, 52);
    doc.text(`Paid: Rs ${totalPaid.toLocaleString()}`, 80, 52);
    doc.text(`Pending: Rs ${totalPending.toLocaleString()}`, 130, 52);
    doc.text(`Entries: ${allCards.length}`, 180, 52);
    doc.text(`Manpower Days: ${totalDays}`, 215, 52);

    const head = [
      ['#', 'Name / Crew Team', 'Role / Category', 'Rate', 'Man Days', 'Base Wages (Rs)', 'OT Hours', 'OT Pay (Rs)', 'Transit (Rs)', 'Net Payable (Rs)', 'Status']
    ];

    const body: any[][] = allCards.map((p, idx) => {
      const isPaid = isStaffPaid(p.id);
      return [
        (idx + 1).toString(),
        p.name,
        p.isCrewTeam ? 'Site Crew Team' : p.role.toUpperCase(),
        `Rs ${p.dailyBase}/d`,
        p.presentDays.toString(),
        p.basePay.toLocaleString(),
        `${p.totalOtHours}h`,
        p.otPay.toLocaleString(),
        (p.transitPay || 0) > 0 ? p.transitPay.toLocaleString() : '-',
        p.totalEarned.toLocaleString(),
        isPaid ? 'PAID' : 'PENDING'
      ];
    });

    body.push([
      '',
      'TOTAL DISBURSEMENT',
      '',
      '',
      allCards.reduce((s, p) => s + p.presentDays, 0).toString(),
      allCards.reduce((s, p) => s + p.basePay, 0).toLocaleString(),
      `${totalOtHours}h`,
      totalOtPay.toLocaleString(),
      totalTransitPay.toLocaleString(),
      totalPayroll.toLocaleString(),
      `Paid: Rs ${totalPaid.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 63,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [184, 117, 26], fontSize: 8, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { fontStyle: 'bold' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'center' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right', fontStyle: 'bold' },
        10: { halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: function(data) {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 243, 199];
        } else if (data.column.index === 10) {
          const val = data.cell.raw;
          if (val === 'PAID') {
            data.cell.styles.textColor = [6, 95, 70];
          } else if (val === 'PENDING') {
            data.cell.styles.textColor = [180, 83, 9];
          }
        }
      }
    });

    const safePeriod = periodLabel.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`JGS_Payroll_${safePeriod}.pdf`);
  };

  // Export Single Receipt Voucher PDF
  const downloadPaymentReceiptPDF = (record: SalaryPaymentRecord) => {
    const doc = new jsPDF('portrait');

    doc.setFontSize(18);
    doc.setTextColor(184, 117, 26);
    doc.text('JGS INTERIOR & CONSTRUCTION', 105, 20, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text('Official Salary & Crew Wage Payment Receipt', 105, 27, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(14, 32, 196, 32);

    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text(`Receipt / Voucher #: ${record.id.toUpperCase()}`, 14, 40);
    doc.text(`Payment Date: ${record.paidAt}`, 14, 46);
    doc.text(`Payment Mode: ${record.paymentMode}${record.referenceNo ? ` (Ref: ${record.referenceNo})` : ''}`, 14, 52);

    doc.text(`Recipient: ${record.staffName}`, 120, 40);
    doc.text(`Designation: ${record.role.toUpperCase()}`, 120, 46);
    doc.text(`Period Covered: ${record.periodLabel}`, 120, 52);

    const head = [['Earnings & Wage Category', 'Details / Units', 'Amount (Rs)']];
    const body: any[][] = [
      ['Base Wages', `${record.daysWorked} Days worked`, record.basePay.toLocaleString()],
      ['Overtime Wages', `${record.otHours} Hours OT`, record.otPay.toLocaleString()],
    ];

    if (record.extraPay > 0) {
      body.push(['Allowances / Special Runs / Transit', 'Recorded Transit / Logistics', record.extraPay.toLocaleString()]);
    }

    body.push(['TOTAL NET PAID', 'Full Settlement Disbursed', `Rs ${record.totalAmount.toLocaleString()}`]);

    autoTable(doc, {
      startY: 60,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [184, 117, 26], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: function(data) {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [236, 253, 245];
          data.cell.styles.textColor = [6, 95, 70];
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 130;

    if (record.notes) {
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(`Notes: ${record.notes}`, 14, finalY + 12);
    }

    const sigY = finalY + 45;
    doc.line(20, sigY, 75, sigY);
    doc.text('Authorized Signatory (Admin)', 22, sigY + 6);

    doc.line(135, sigY, 190, sigY);
    doc.text('Recipient Signature / Acknowledgment', 130, sigY + 6);

    doc.save(`Receipt_${record.staffName.replace(/\s+/g, '_')}_${record.id.slice(-6)}.pdf`);
  };

  // Export Full History PDF
  const exportFullHistoryPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.setTextColor(184, 117, 26);
    doc.text('JGS INTERIOR & CONSTRUCTION', 14, 18);

    doc.setFontSize(13);
    doc.setTextColor(40);
    doc.text('HISTORICAL SALARY & CREW DISBURSEMENT AUDIT LEDGER', 14, 26);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Total Payouts Recorded: ${filteredHistory.length} Transactions`, 14, 32);
    doc.text(`Exported on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 37);

    const head = [
      ['#', 'Date Paid', 'Recipient', 'Role', 'Period Covered', 'Days', 'OT', 'Mode', 'Ref/Notes', 'Amount Paid (Rs)']
    ];

    const body: any[][] = filteredHistory.map((h, i) => [
      (i + 1).toString(),
      h.paidAt,
      h.staffName,
      h.role,
      h.periodLabel,
      h.daysWorked.toString(),
      `${h.otHours}h`,
      h.paymentMode,
      h.referenceNo || h.notes || '-',
      h.totalAmount.toLocaleString()
    ]);

    const totalHistoricalPaid = filteredHistory.reduce((s, h) => s + h.totalAmount, 0);
    body.push([
      '',
      'TOTAL DISBURSED',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      `Rs ${totalHistoricalPaid.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 45,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [184, 117, 26], fontSize: 8, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center' },
        2: { fontStyle: 'bold' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'center' },
        8: { halign: 'left' },
        9: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: function(data) {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 243, 199];
        }
      }
    });

    doc.save(`JGS_Paid_Salary_History_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return paidHistory.filter(h => {
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchName = h.staffName.toLowerCase().includes(q);
        const matchRole = h.role.toLowerCase().includes(q);
        const matchPeriod = h.periodLabel.toLowerCase().includes(q);
        const matchNotes = (h.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchRole && !matchPeriod && !matchNotes) return false;
      }
      if (historyModeFilter !== 'all' && h.paymentMode !== historyModeFilter) return false;
      if (historyRoleFilter === 'supervisor' && !h.role.toLowerCase().includes('supervisor')) return false;
      if (historyRoleFilter === 'driver' && !h.role.toLowerCase().includes('driver')) return false;
      if (historyRoleFilter === 'crew' && !h.role.toLowerCase().includes('crew') && !h.role.toLowerCase().includes('labour') && !h.role.toLowerCase().includes('painter') && !h.role.toLowerCase().includes('plumber')) return false;
      return true;
    });
  }, [paidHistory, historySearch, historyModeFilter, historyRoleFilter]);

  const totalHistoryAmount = paidHistory.reduce((s, h) => s + h.totalAmount, 0);

  // Export Individual Staff Attendance PDF
  const downloadStaffAttendancePDF = (staffData: any) => {
    const doc = new jsPDF('portrait');

    doc.setFontSize(18);
    doc.setTextColor(184, 117, 26);
    doc.text('JGS INTERIOR & CONSTRUCTION', 105, 18, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text('INDIVIDUAL STAFF ATTENDANCE & WORK REPORT', 105, 25, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${periodLabel}`, 105, 31, { align: 'center' });
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 105, 36, { align: 'center' });

    doc.setDrawColor(220);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(14, 42, 182, 20, 2, 2, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.text(`Staff Name: ${staffData.name}`, 20, 50);
    doc.text(`Role: ${staffData.role.toUpperCase()}`, 20, 56);
    doc.text(`Rate: Rs ${staffData.dailyBase}/d`, 110, 50);
    doc.text(`Present: ${staffData.presentDays}d | Half: ${staffData.halfDays}d | Absent: ${staffData.absentDays}d`, 110, 56);

    const head = [
      ['#', 'Date & Day', 'Status', 'Timing', 'Site / Work Description', 'OT (h)', 'Wage (Rs)']
    ];

    const body: any[][] = staffData.breakdown.map((b: any, idx: number) => {
      let friendlyDate = b.date;
      try {
        friendlyDate = format(new Date(b.date + 'T00:00:00'), 'dd MMM, EEE');
      } catch {}

      const timing = b.inTime && b.outTime && b.inTime !== '-' ? `${b.inTime}-${b.outTime}` : '-';
      const workDesc = b.workDescription ? `${b.siteName}: ${b.workDescription}` : b.siteName;

      return [
        (idx + 1).toString(),
        friendlyDate,
        b.status ? b.status.toUpperCase() : (staffData.isCrewTeam ? `${b.totalCrewCount || 0} CREW` : 'PRESENT'),
        timing,
        workDesc,
        b.otHours > 0 ? `${b.otHours}h` : '-',
        b.dayTotal.toLocaleString()
      ];
    });

    body.push([
      '',
      'TOTAL',
      `${staffData.presentDays} Full Days`,
      '',
      '',
      `${staffData.totalOtHours}h`,
      `Rs ${staffData.totalEarned.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 68,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [184, 117, 26], fontSize: 8, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'center', cellWidth: 26 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'center', cellWidth: 24 },
        4: { cellWidth: 62 },
        5: { halign: 'center', cellWidth: 16 },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
      },
      didParseCell: function(data) {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 243, 199];
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 160;
    const sigY = finalY + 30;
    if (sigY < 270) {
      doc.line(20, sigY, 70, sigY);
      doc.text('Employee Signature', 25, sigY + 5);

      doc.line(130, sigY, 180, sigY);
      doc.text('Admin Signature', 135, sigY + 5);
    }

    doc.save(`Attendance_${staffData.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/50 shadow-xs">
        <div>
          <h3 className="section-header !mb-0 text-lg flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Staff & Crew Salary Management
          </h3>
          <p className="text-xs text-muted-foreground">
            Calculate weekly crew pay, review monthly supervisor & driver salaries, and audit the complete history of paid wages.
          </p>
        </div>

        {/* Main View Switcher: Current Statements vs History of Paid */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl border border-border/60 p-1 bg-muted/40 gap-1">
            <button
              onClick={() => setMainTab('current')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                mainTab === 'current'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-primary" /> Payroll Statements
            </button>
            <button
              onClick={() => setMainTab('history')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                mainTab === 'history'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History className="w-3.5 h-3.5 text-emerald-600" />
              History of Paid ({paidHistory.length})
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CURRENT STATEMENTS & CALCULATIONS                                  */}
      {/* ========================================================================= */}
      {mainTab === 'current' && (
        <div className="space-y-5">
          {/* Action Strip */}
          <div className="p-4 bg-card rounded-2xl border border-border/50 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Period Selector Controller */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex rounded-xl border border-border/60 p-0.5 bg-muted/40">
                  {[
                    { id: 'weekly' as const, label: 'Weekly' },
                    { id: 'monthly' as const, label: 'Monthly' },
                    { id: 'custom' as const, label: 'Custom' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setFilterType(opt.id)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                        filterType === opt.id
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {filterType === 'weekly' && (
                  <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/50">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentWeekDate(subWeeks(currentWeekDate, 1))}
                      className="h-8 w-8 rounded-lg"
                      title="Previous Week"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentWeekDate(new Date())}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold"
                    >
                      This Week
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentWeekDate(addWeeks(currentWeekDate, 1))}
                      className="h-8 w-8 rounded-lg"
                      title="Next Week"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {filterType === 'monthly' && (
                  <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/50">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))}
                      className="h-8 w-8 rounded-lg"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentMonthDate(new Date())}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold"
                    >
                      This Month
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}
                      className="h-8 w-8 rounded-lg"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {filterType === 'custom' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">From:</Label>
                      <Input
                        type="date"
                        value={customFrom}
                        onChange={e => setCustomFrom(e.target.value)}
                        className="h-8 w-34 rounded-lg text-xs font-semibold"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">To:</Label>
                      <Input
                        type="date"
                        value={customTo}
                        onChange={e => setCustomTo(e.target.value)}
                        className="h-8 w-34 rounded-lg text-xs font-semibold"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/40">
                    {periodLabel}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
                {allCards.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={markAllAsPaid}
                    className="h-8 rounded-xl text-xs font-bold gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark All Paid
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={exportPayrollPDF}
                  className="h-8 rounded-xl text-xs font-bold gap-1.5 text-white shadow-xs"
                  style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                >
                  <FileDown className="w-3.5 h-3.5" /> Convert / Export PDF
                </Button>
              </div>
            </div>

            {/* Role Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
              <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
                {[
                  { id: 'all' as const, label: 'All Roles' },
                  { id: 'supervisor' as const, label: 'Supervisors' },
                  { id: 'driver' as const, label: '🚚 Drivers' },
                  { id: 'crew' as const, label: '👷 Site Crew' },
                ].map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRole(r.id)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      selectedRole === r.id
                        ? 'bg-primary text-white font-bold shadow-xs'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}

                {/* Instant Switcher for Weekly Crew Pay */}
                <button
                  onClick={() => {
                    setFilterType('weekly');
                    setSelectedRole('crew');
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all border flex items-center gap-1.5 ${
                    filterType === 'weekly' && selectedRole === 'crew'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                  }`}
                >
                  <HardHat className="w-3.5 h-3.5" /> ⚡ Weekly Crew Pay
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold text-muted-foreground shrink-0">Filter Staff:</Label>
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger className="h-8 w-52 rounded-xl text-xs font-semibold bg-background">
                    <SelectValue placeholder="All Staff Members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Staff Members ({staffList.length})</SelectItem>
                    {staffList.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Weekly Crew Labor Dashboard Banner */}
          {selectedRole === 'crew' && (
            <Card className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-heading font-extrabold text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-amber-600" /> Weekly Site Crew Labor Summary
                  </h4>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                    Aggregated labor headcounts, man-days, overtime hours, and total payable wages for site crew.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 tracking-wider">
                    Total Crew Weekly Payout
                  </span>
                  <p className="text-xl font-heading font-extrabold text-amber-700 dark:text-amber-300">
                    ₹{crewSummary.totalCrewCost.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="bg-card p-2.5 rounded-xl border border-border/50 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">🎨 Painters</span>
                  <p className="font-heading font-extrabold text-base text-foreground mt-0.5">
                    {crewSummary.painterDays} Man-Days
                  </p>
                </div>

                <div className="bg-card p-2.5 rounded-xl border border-border/50 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">🔧 Plumbers</span>
                  <p className="font-heading font-extrabold text-base text-foreground mt-0.5">
                    {crewSummary.plumberDays} Man-Days
                  </p>
                </div>

                <div className="bg-card p-2.5 rounded-xl border border-border/50 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">🧱 Helpers & Labours</span>
                  <p className="font-heading font-extrabold text-base text-foreground mt-0.5">
                    {crewSummary.labourDays} Man-Days
                  </p>
                </div>

                <div className="bg-card p-2.5 rounded-xl border border-border/50 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">⏰ Crew Overtime</span>
                  <p className="font-heading font-extrabold text-base text-amber-600 dark:text-amber-400 mt-0.5">
                    +₹{crewSummary.crewOtPay.toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* KPI Overview Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card
              className="p-4 rounded-2xl text-white shadow-sm border-0 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 48%))' }}
            >
              <span className="text-[10px] uppercase font-bold tracking-widest text-white/80">
                Total Payout
              </span>
              <p className="text-2xl font-heading font-extrabold mt-0.5">
                ₹{totalPayroll.toLocaleString()}
              </p>
              <p className="text-xs text-white/90 mt-0.5">
                For {periodLabel}
              </p>
            </Card>

            <Card className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-bold tracking-wider">
                ✓ Total Paid Out
              </span>
              <p className="text-2xl font-heading font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{totalPaid.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allCards.filter(p => isStaffPaid(p.id)).length} of {allCards.length} entries paid
              </p>
            </Card>

            <Card className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs">
              <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase font-bold tracking-wider">
                ⏳ Total Pending
              </span>
              <p className="text-2xl font-heading font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                ₹{totalPending.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allCards.filter(p => !isStaffPaid(p.id)).length} pending disbursement
              </p>
            </Card>

            <Card className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Manpower Days & OT
              </span>
              <p className="text-2xl font-heading font-bold text-foreground mt-0.5">
                {totalDays} Days
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalOtHours}h OT (₹{totalOtPay.toLocaleString()})
              </p>
            </Card>
          </div>

          {/* Cards List */}
          {allCards.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">No attendance or earnings found for this period.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try switching to another week or month, or choose "All Roles".
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allCards.map(p => {
                const isSup = p.role === 'supervisor';
                const isDrv = p.role === 'driver';
                const isCrewTeam = p.isCrewTeam;
                const isExpanded = expandedStaffId === p.id;
                const isPaid = isStaffPaid(p.id);

                return (
                  <Card key={p.id} className="rounded-2xl bg-card border border-border/60 shadow-xs overflow-hidden">
                    {/* Header Bar */}
                    <div
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedStaffId(isExpanded ? null : p.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                            isCrewTeam
                              ? 'bg-amber-600'
                              : isDrv
                              ? 'bg-blue-600'
                              : isSup
                              ? 'bg-primary'
                              : 'bg-emerald-600'
                          }`}
                        >
                          {isCrewTeam ? (
                            <HardHat className="w-5 h-5" />
                          ) : isDrv ? (
                            <Truck className="w-5 h-5" />
                          ) : isSup ? (
                            <UserCircle className="w-5 h-5" />
                          ) : (
                            <Users className="w-5 h-5" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedStaffAttendance(p);
                              }}
                              className="group cursor-pointer flex items-center gap-1.5"
                              title="Click to view detailed attendance"
                            >
                              <p className="font-heading font-bold text-base text-foreground group-hover:text-primary transition-colors underline decoration-dotted decoration-primary/40 underline-offset-4">
                                {p.name}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full ${
                                isCrewTeam
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {isCrewTeam ? 'Site Crew Team' : p.role}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isCrewTeam ? (
                              <>
                                Crew Daily Rate: <strong>₹{p.dailyBase}/day</strong> · Crew OT: <strong>₹{p.otRate || 100}/hr</strong>
                              </>
                            ) : (
                              <>
                                Base: <strong>₹{p.dailyBase}{p.salaryType === 'hourly' ? '/8h' : '/d'}</strong> · OT: <strong>₹{p.incentivePerHour || 0}/hr</strong>
                                {isDrv && p.customerHourlyRate ? ` · Transit: ₹${p.customerHourlyRate}/hr` : ''}
                              </>
                            )}
                          </p>

                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {isCrewTeam ? (
                              <>
                                <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  {p.presentDays} Total Man-Days
                                </span>
                                {p.painterDays > 0 && (
                                  <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">
                                    {p.painterDays} Painter Days
                                  </span>
                                )}
                                {p.plumberDays > 0 && (
                                  <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full">
                                    {p.plumberDays} Plumber Days
                                  </span>
                                )}
                                {p.labourDays > 0 && (
                                  <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                                    {p.labourDays} Labour Days
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">
                                  {p.presentDays} Full Days
                                </span>
                                {p.halfDays > 0 && (
                                  <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                                    {p.halfDays} Half Days
                                  </span>
                                )}
                                {p.totalOtHours > 0 && (
                                  <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                    {p.totalOtHours}h OT
                                  </span>
                                )}
                                {isDrv && p.totalDriverTrips > 0 && (
                                  <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full">
                                    {p.totalDriverTrips} Runs
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Financial Breakdown & Net Payable */}
                      <div className="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-border/40">
                        <div className="text-xs space-y-0.5 text-right hidden sm:block">
                          <div className="text-muted-foreground">
                            Base: <strong className="text-foreground">₹{p.basePay.toLocaleString()}</strong>
                          </div>
                          {p.otPay > 0 && (
                            <div className="text-amber-600 dark:text-amber-400">
                              OT: +₹{p.otPay.toLocaleString()}
                            </div>
                          )}
                          {isDrv && p.transitPay > 0 && (
                            <div className="text-blue-600 dark:text-blue-400">
                              Transit: +₹{p.transitPay.toLocaleString()}
                            </div>
                          )}
                          {isSup && p.crewPay > 0 && (
                            <div className="text-amber-700 dark:text-amber-300 font-semibold">
                              Managed Crew: ₹{p.crewPay.toLocaleString()}
                            </div>
                          )}
                        </div>

                        <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-2 text-right">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                            Net Payable
                          </span>
                          <span className="text-lg font-heading font-extrabold text-primary">
                            ₹{p.totalEarned.toLocaleString()}
                          </span>
                        </div>

                        {/* Attendance Details & Paid Status Actions */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedStaffAttendance(p);
                              }}
                              className="h-7 px-2 text-[11px] font-semibold rounded-lg border-primary/40 text-primary hover:bg-primary/10 gap-1"
                              title="View full attendance details & working hours"
                            >
                              <ClipboardList className="w-3.5 h-3.5" /> Detail Attendance
                            </Button>

                            <span
                              className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                                isPaid
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {isPaid ? <CheckCircle2 className="w-3 h-3" /> : null}
                              {isPaid ? 'PAID' : '⏳ PENDING'}
                            </span>
                          </div>

                          {isPaid ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => revokePayment(p.id)}
                              className="h-7 px-2.5 text-[11px] font-semibold rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-border/50"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" /> Mark Unpaid
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={e =>
                                openPaymentModal({
                                  staffId: p.id,
                                  staffName: p.name,
                                  role: isCrewTeam ? 'Site Crew Team' : p.role,
                                  daysWorked: p.presentDays + (p.halfDays * 0.5),
                                  otHours: p.totalOtHours,
                                  basePay: p.basePay,
                                  otPay: p.otPay,
                                  extraPay: p.transitPay || 0,
                                  totalAmount: p.totalEarned,
                                  category: isCrewTeam ? 'crew' : 'staff'
                                }, e)
                              }
                              className="h-7 px-2.5 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                            >
                              <Check className="w-3 h-3 mr-1" /> Mark Paid
                            </Button>
                          )}
                        </div>

                        <div className="p-1 rounded-xl hover:bg-muted text-muted-foreground">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Breakdown */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 bg-muted/20 border-t border-border/50 space-y-2">
                        <div className="flex items-center justify-between py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          <span>Itemized Logs ({p.breakdown.length} records)</span>
                          <span>Wage / Day Total</span>
                        </div>

                        <div className="space-y-2">
                          {isCrewTeam ? (
                            p.breakdown.map((b: any, i: number) => (
                              <div
                                key={i}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-card p-3 rounded-xl border border-border/40 shadow-2xs"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground">{b.date}</span>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                      {b.totalCrewCount} Crew Members
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-primary" /> {b.siteName}
                                    </span>
                                    {b.painters > 0 && <span>· 🎨 {b.painters} Painters</span>}
                                    {b.plumbers > 0 && <span>· 🔧 {b.plumbers} Plumbers</span>}
                                    {b.labour > 0 && <span>· 🧱 {b.labour} Helpers</span>}
                                    <span>· Base: ₹{b.crewBase}</span>
                                    {b.otHours > 0 && (
                                      <span className="text-amber-600 font-semibold">
                                        · {b.otStaff} workers × {b.otHours}h OT (+₹{b.crewOt})
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <span className="font-heading font-bold text-sm text-primary self-end sm:self-auto">
                                  ₹{b.dayTotal.toLocaleString()}
                                </span>
                              </div>
                            ))
                          ) : (
                            p.breakdown.map((b: any, i: number) => (
                              <div
                                key={i}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-card p-3 rounded-xl border border-border/40 shadow-2xs"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground">{b.date}</span>
                                    <span
                                      className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                                        b.status === 'present'
                                          ? 'bg-emerald-500/10 text-emerald-600'
                                          : b.status === 'half-day'
                                          ? 'bg-amber-500/10 text-amber-600'
                                          : b.status === 'delivery-only'
                                          ? 'bg-blue-500/10 text-blue-600'
                                          : 'bg-destructive/10 text-destructive'
                                      }`}
                                    >
                                      {b.status}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-primary" /> {b.siteName}
                                    </span>
                                    <span>· Base: ₹{b.base}</span>
                                    {b.otHours > 0 && <span className="text-amber-600">· {b.otHours}h OT (+₹{b.otPay})</span>}
                                    {b.transitPay > 0 && <span className="text-blue-600">· Transit (+₹{b.transitPay})</span>}
                                  </div>
                                </div>

                                <span className="font-heading font-bold text-sm text-primary self-end sm:self-auto">
                                  ₹{b.dayTotal.toLocaleString()}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HISTORY OF PAID SALARIES & WAGES (📜 Paid History)                 */}
      {/* ========================================================================= */}
      {mainTab === 'history' && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card
              className="p-4 rounded-2xl text-white shadow-sm border-0"
              style={{ background: 'linear-gradient(135deg, hsl(142 70% 30%), hsl(158 64% 42%))' }}
            >
              <span className="text-[10px] uppercase font-bold tracking-widest text-white/80">
                Total Paid To Date
              </span>
              <p className="text-2xl font-heading font-extrabold mt-0.5">
                ₹{totalHistoryAmount.toLocaleString()}
              </p>
              <p className="text-xs text-white/90 mt-0.5">
                {paidHistory.length} Total Settlements
              </p>
            </Card>

            <Card className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs">
              <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase font-bold tracking-wider">
                👷 Site Crew Payouts
              </span>
              <p className="text-2xl font-heading font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                ₹{paidHistory.filter(h => h.category === 'crew' || h.role.toLowerCase().includes('crew')).reduce((s, h) => s + h.totalAmount, 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {paidHistory.filter(h => h.category === 'crew' || h.role.toLowerCase().includes('crew')).length} Weekly crew disbursements
              </p>
            </Card>

            <Card className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs">
              <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-bold tracking-wider">
                👤 Staff & Drivers
              </span>
              <p className="text-2xl font-heading font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                ₹{paidHistory.filter(h => h.category !== 'crew' && !h.role.toLowerCase().includes('crew')).reduce((s, h) => s + h.totalAmount, 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {paidHistory.filter(h => h.category !== 'crew' && !h.role.toLowerCase().includes('crew')).length} Monthly & transit settlements
              </p>
            </Card>

            <Card className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Audit Status
              </span>
              <p className="text-2xl font-heading font-bold text-foreground mt-0.5 flex items-center gap-1.5">
                <ShieldCheck className="w-6 h-6 text-emerald-600" /> Verified
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                All disbursements logged with timestamp
              </p>
            </Card>
          </div>

          {/* Filter and Search Strip */}
          <div className="p-4 bg-card rounded-2xl border border-border/50 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search staff, crew, role, or note..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Mode Filter */}
                <Select value={historyModeFilter} onValueChange={(val: any) => setHistoryModeFilter(val)}>
                  <SelectTrigger className="h-9 w-36 rounded-xl text-xs font-semibold bg-background">
                    <SelectValue placeholder="Payment Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    <SelectItem value="Cash">💵 Cash</SelectItem>
                    <SelectItem value="UPI">📱 UPI / GPay</SelectItem>
                    <SelectItem value="Bank Transfer">🏛️ Bank Transfer</SelectItem>
                    <SelectItem value="Cheque">📄 Cheque</SelectItem>
                  </SelectContent>
                </Select>

                {/* Role Filter */}
                <Select value={historyRoleFilter} onValueChange={(val: any) => setHistoryRoleFilter(val)}>
                  <SelectTrigger className="h-9 w-36 rounded-xl text-xs font-semibold bg-background">
                    <SelectValue placeholder="Filter Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="supervisor">Supervisors</SelectItem>
                    <SelectItem value="driver">Drivers</SelectItem>
                    <SelectItem value="crew">Site Crew</SelectItem>
                  </SelectContent>
                </Select>

                {/* Export Full History PDF */}
                {filteredHistory.length > 0 && (
                  <Button
                    size="sm"
                    onClick={exportFullHistoryPDF}
                    className="h-9 rounded-xl text-xs font-bold gap-1.5 text-white"
                    style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                  >
                    <FileDown className="w-3.5 h-3.5" /> Export Ledger PDF
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Paid History List */}
          {filteredHistory.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border/50 space-y-2">
              <History className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-base font-bold text-foreground">No paid salary records found.</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                When you click "Mark Paid" on any staff or site crew payroll statement, the disbursed payment transaction will be permanently saved here.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMainTab('current')}
                className="rounded-xl text-xs mt-2"
              >
                Go to Payroll Statements
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map(record => (
                <Card
                  key={record.id}
                  className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 mt-0.5 ${
                        record.category === 'crew'
                          ? 'bg-amber-600'
                          : record.role.toLowerCase().includes('driver')
                          ? 'bg-blue-600'
                          : 'bg-emerald-600'
                      }`}
                    >
                      {record.category === 'crew' ? (
                        <HardHat className="w-5 h-5" />
                      ) : record.role.toLowerCase().includes('driver') ? (
                        <Truck className="w-5 h-5" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-heading font-extrabold text-base text-foreground">
                          {record.staffName}
                        </h4>
                        <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {record.role}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <Check className="w-3 h-3" /> PAID
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          <CalendarDays className="w-3.5 h-3.5 text-primary" /> {record.periodLabel}
                        </span>
                        <span>·</span>
                        <span>Paid on: <strong className="text-foreground">{record.paidAt}</strong></span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                          {record.paymentMode === 'Cash' ? (
                            <Banknote className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <CreditCard className="w-3 h-3 text-blue-600" />
                          )}
                          {record.paymentMode}
                        </span>
                        {record.referenceNo && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Ref: {record.referenceNo}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground pt-0.5">
                        <span>Work: {record.daysWorked} Days</span>
                        {record.otHours > 0 && <span>· {record.otHours}h OT (₹{record.otPay})</span>}
                        {record.extraPay > 0 && <span>· Extra: ₹{record.extraPay}</span>}
                        {record.notes && <span className="italic text-foreground/80">· Note: "{record.notes}"</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right side: Amount & Action Buttons */}
                  <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-border/40">
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                        Disbursed Amount
                      </span>
                      <span className="text-xl font-heading font-extrabold text-emerald-600 dark:text-emerald-400">
                        ₹{record.totalAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadPaymentReceiptPDF(record)}
                        className="h-8 rounded-xl text-xs font-semibold gap-1 border-border/60 hover:bg-muted"
                        title="Download Payment Receipt Voucher"
                      >
                        <Printer className="w-3.5 h-3.5 text-primary" /> Receipt
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => revokePayment(record.staffId, record.fromDate, record.toDate)}
                        className="h-8 px-2 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Revoke and reset to pending"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD SALARY / CREW PAYMENT                                      */}
      {/* ========================================================================= */}
      {paymentModalOpen && targetPayout && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-xl overflow-hidden animate-scale-in">
            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-heading font-extrabold text-sm text-foreground">
                    Record Salary Disbursement
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Confirm wage payment & save to history
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPaymentModalOpen(false)}
                className="h-7 w-7 rounded-lg"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{targetPayout.staffName}</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {targetPayout.role}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{periodLabel}</p>
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/40">
                  <span className="text-xs font-semibold text-muted-foreground">Net Payout:</span>
                  <span className="text-lg font-heading font-extrabold text-emerald-600 dark:text-emerald-400">
                    ₹{targetPayout.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Payment Mode *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Cash' as const, label: '💵 Cash', desc: 'Handed in cash' },
                    { id: 'UPI' as const, label: '📱 UPI / GPay', desc: 'GooglePay / PhonePe' },
                    { id: 'Bank Transfer' as const, label: '🏛️ Bank Transfer', desc: 'NEFT / IMPS' },
                    { id: 'Cheque' as const, label: '📄 Cheque', desc: 'Issued cheque' },
                  ].map(m => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setPayMode(m.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        payMode === m.id
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                          : 'border-border/60 bg-card hover:bg-muted/40 text-foreground'
                      }`}
                    >
                      <p className="text-xs font-bold">{m.label}</p>
                      <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {(payMode === 'UPI' || payMode === 'Bank Transfer' || payMode === 'Cheque') && (
                <div className="space-y-1.5 animate-slide-up">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {payMode === 'UPI' ? 'UPI Transaction ID / Mobile' : payMode === 'Bank Transfer' ? 'NEFT / IMPS Ref No.' : 'Cheque No.'}
                  </Label>
                  <Input
                    placeholder="e.g. UPI-9842104592 or TXN-8832"
                    value={payRef}
                    onChange={e => setPayRef(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Payment Notes (Optional)</Label>
                <Input
                  placeholder="e.g. Paid in full on site, or weekly settlement"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="p-4 border-t border-border/50 bg-muted/20 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaymentModalOpen(false)}
                className="h-9 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmPayment}
                className="h-9 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" /> Confirm & Record Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETAILED ATTENDANCE & TIMESHEET SHEET                              */}
      {/* ========================================================================= */}
      {selectedStaffAttendance && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-2xl rounded-3xl border border-border shadow-2xl overflow-hidden my-auto animate-scale-in max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/40 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                    selectedStaffAttendance.isCrewTeam
                      ? 'bg-amber-600'
                      : selectedStaffAttendance.role === 'driver'
                      ? 'bg-blue-600'
                      : selectedStaffAttendance.role === 'supervisor'
                      ? 'bg-primary'
                      : 'bg-emerald-600'
                  }`}
                >
                  {selectedStaffAttendance.isCrewTeam ? (
                    <HardHat className="w-5 h-5" />
                  ) : selectedStaffAttendance.role === 'driver' ? (
                    <Truck className="w-5 h-5" />
                  ) : (
                    <UserCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-heading font-extrabold text-base text-foreground">
                      {selectedStaffAttendance.name}
                    </h4>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {selectedStaffAttendance.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <CalendarDays className="w-3.5 h-3.5 text-primary" /> {periodLabel}
                    {selectedStaffAttendance.phone && ` · 📞 ${selectedStaffAttendance.phone}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadStaffAttendancePDF(selectedStaffAttendance)}
                  className="h-8 rounded-xl text-xs font-semibold gap-1.5 border-border/60 hover:bg-muted text-foreground"
                >
                  <FileDown className="w-3.5 h-3.5 text-primary" /> Export PDF
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedStaffAttendance(null)}
                  className="h-8 w-8 rounded-xl"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-muted/40 p-3 rounded-2xl border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Full Days</span>
                  <p className="font-heading font-extrabold text-lg text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {selectedStaffAttendance.presentDays} Days
                  </p>
                </div>

                <div className="bg-muted/40 p-3 rounded-2xl border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Half Days</span>
                  <p className="font-heading font-extrabold text-lg text-amber-600 dark:text-amber-400 mt-0.5">
                    {selectedStaffAttendance.halfDays} Days
                  </p>
                </div>

                <div className="bg-muted/40 p-3 rounded-2xl border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Overtime</span>
                  <p className="font-heading font-extrabold text-lg text-primary mt-0.5">
                    {selectedStaffAttendance.totalOtHours}h (+₹{selectedStaffAttendance.otPay.toLocaleString()})
                  </p>
                </div>

                <div className="bg-muted/40 p-3 rounded-2xl border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Wage</span>
                  <p className="font-heading font-extrabold text-lg text-foreground mt-0.5">
                    ₹{selectedStaffAttendance.totalEarned.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Day-by-day detailed attendance log */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                  <span>Day-by-Day Attendance Record ({selectedStaffAttendance.breakdown.length} days)</span>
                  <span>Wages Earned</span>
                </div>

                {selectedStaffAttendance.breakdown.length === 0 ? (
                  <div className="text-center py-8 bg-muted/20 rounded-2xl border border-border/40 text-xs text-muted-foreground">
                    No attendance records logged for this period.
                  </div>
                ) : (
                  selectedStaffAttendance.breakdown.map((log: any, idx: number) => {
                    let friendlyDate = log.date;
                    try {
                      friendlyDate = format(new Date(log.date + 'T00:00:00'), 'dd MMM yyyy, EEEE');
                    } catch {}

                    const isAbsent = log.status === 'absent';
                    const isPresent = log.status === 'present';
                    const isHalf = log.status === 'half-day';

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isAbsent
                            ? 'bg-destructive/5 border-destructive/20'
                            : isHalf
                            ? 'bg-amber-500/5 border-amber-500/20'
                            : 'bg-card border-border/60 shadow-2xs'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-heading font-bold text-sm text-foreground">
                                {friendlyDate}
                              </span>
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  isPresent
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : isHalf
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                    : isAbsent
                                    ? 'bg-destructive/10 text-destructive border border-destructive/20'
                                    : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                                }`}
                              >
                                {isAbsent
                                  ? 'ABSENT'
                                  : isHalf
                                  ? 'HALF DAY'
                                  : isPresent
                                  ? 'PRESENT'
                                  : log.status
                                  ? log.status.toUpperCase()
                                  : selectedStaffAttendance.isCrewTeam
                                  ? `${log.totalCrewCount || 0} CREW`
                                  : 'LOGGED'}
                              </span>

                              {log.inTime && log.outTime && !isAbsent && log.inTime !== '-' && (
                                <span className="text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-primary" />
                                  {log.inTime} – {log.outTime}
                                  {log.duration ? ` (${log.duration})` : ''}
                                </span>
                              )}
                            </div>

                            {/* Location & Site */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {log.siteName && (
                                <span className="flex items-center gap-1 font-semibold text-foreground">
                                  <MapPin className="w-3.5 h-3.5 text-primary" /> {log.siteName}
                                </span>
                              )}

                              {log.otHours > 0 && (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                  · {log.otHours}h Overtime (+₹{log.otPay})
                                </span>
                              )}

                              {selectedStaffAttendance.isCrewTeam && log.totalCrewCount > 0 && (
                                <span className="text-amber-700 dark:text-amber-300 font-semibold">
                                  · {log.painters || 0} Painters, {log.plumbers || 0} Plumbers, {log.labour || 0} Helpers
                                </span>
                              )}
                            </div>

                            {/* Work Entry / Notes */}
                            {(log.workDescription || log.notes) && (
                              <div className="mt-1.5 p-2 bg-muted/30 rounded-xl text-xs text-foreground/90 border border-border/30">
                                {log.workDescription && (
                                  <p><strong className="text-muted-foreground">Work Log:</strong> {log.workDescription}</p>
                                )}
                                {log.notes && (
                                  <p className="italic text-muted-foreground mt-0.5"><strong className="not-italic">Attendance Note:</strong> "{log.notes}"</p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Day Total */}
                          <div className="text-right sm:self-center shrink-0">
                            <span className="text-sm font-heading font-extrabold text-primary">
                              {isAbsent ? '₹0' : `₹${(log.dayTotal || 0).toLocaleString()}`}
                            </span>
                            {!isAbsent && (
                              <span className="text-[10px] text-muted-foreground block">
                                Base: ₹{((log.base ?? log.crewBase) || 0).toLocaleString()}{(log.otPay ?? log.crewOt ?? 0) > 0 ? ` + OT ₹${(log.otPay ?? log.crewOt ?? 0).toLocaleString()}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
              <div className="text-xs text-muted-foreground">
                Total Payout: <strong className="text-foreground text-sm">₹{selectedStaffAttendance.totalEarned.toLocaleString()}</strong>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedStaffAttendance(null)}
                className="rounded-xl text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollTab;
