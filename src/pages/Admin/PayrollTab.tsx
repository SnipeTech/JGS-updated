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
  const { staffList, attendances, dailyLogs, materialRequests, labourTypes } = useApp();

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

  // Bulk Payment Modal State ("Mark All Paid")
  const [bulkPayModalOpen, setBulkPayModalOpen] = useState(false);
  const [bulkSelectedStaffIds, setBulkSelectedStaffIds] = useState<string[]>([]);
  const [bulkPayMode, setBulkPayMode] = useState<'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque'>('Cash');
  const [bulkPayRef, setBulkPayRef] = useState('');
  const [bulkPayNote, setBulkPayNote] = useState('');
  const [bulkPayDate, setBulkPayDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [bulkFilterType, setBulkFilterType] = useState<'all' | 'supervisor' | 'driver' | 'crew'>('all');

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

  // Helper to extract detailed type and display info for any payroll recipient
  const getRecipientTypeInfo = (p: any) => {
    if (p.isCrewTeam) {
      const parts = [
        p.painterDays > 0 ? `${p.painterDays}d Painters` : null,
        p.plumberDays > 0 ? `${p.plumberDays}d Plumbers` : null,
        p.labourDays > 0 ? `${p.labourDays}d Helpers` : null,
      ].filter(Boolean);
      return {
        type: 'crew' as const,
        typeLabel: 'Site Crew Team',
        badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        icon: <HardHat className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />,
        subtext: parts.length > 0 ? parts.join(' · ') : 'Managed Site Crew Team'
      };
    }
    const r = (p.role || '').toLowerCase();
    if (r === 'supervisor') {
      return {
        type: 'supervisor' as const,
        typeLabel: 'Supervisor',
        badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
        icon: <UserCircle className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />,
        subtext: p.phone ? `Phone: ${p.phone}` : 'Site Supervisor'
      };
    }
    if (r === 'driver') {
      return {
        type: 'driver' as const,
        typeLabel: 'Driver',
        badgeColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
        icon: <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />,
        subtext: p.totalDriverTrips > 0 ? `${p.totalDriverTrips} delivery runs` : 'Fleet Driver'
      };
    }
    return {
      type: 'crew' as const,
      typeLabel: p.role ? p.role.toUpperCase() : 'Site Worker',
      badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      icon: <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      subtext: `Trade: ${p.role || 'Crew'}`
    };
  };

  // Open bulk payment dialog ("Mark All Paid")
  const openBulkPayModal = () => {
    const pending = allCards.filter(p => !isStaffPaid(p.id));
    if (pending.length === 0) {
      toast.info('All entries for this period are already marked as PAID');
      return;
    }
    setBulkSelectedStaffIds(pending.map(p => p.id));
    setBulkPayMode('Cash');
    setBulkPayRef('');
    setBulkPayNote(`Bulk payroll settlement - ${periodLabel}`);
    setBulkPayDate(format(new Date(), 'yyyy-MM-dd'));
    setBulkFilterType('all');
    setBulkPayModalOpen(true);
  };

  // Confirm bulk payment
  const confirmBulkPayment = () => {
    const pendingToPay = allCards.filter(p => !isStaffPaid(p.id) && bulkSelectedStaffIds.includes(p.id));
    if (pendingToPay.length === 0) {
      toast.error('Please select at least one recipient to mark as paid');
      return;
    }

    let paidTime = format(new Date(), 'hh:mm a');
    let paidDateStr = bulkPayDate;
    try {
      paidDateStr = format(new Date(bulkPayDate + 'T00:00:00'), 'dd MMM yyyy');
    } catch {}
    const paidAtFormatted = `${paidDateStr}, ${paidTime}`;

    const newRecords: SalaryPaymentRecord[] = [];
    const updatedStatus = { ...paidStatusMap };

    pendingToPay.forEach(p => {
      const key = getPaidKey(p.id);
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
        paymentMode: bulkPayMode,
        referenceNo: bulkPayRef.trim() || undefined,
        notes: bulkPayNote.trim() || undefined,
        paidBy: 'Admin',
        category: p.isCrewTeam ? 'crew' : (p.role === 'driver' ? 'driver' : (p.role === 'supervisor' ? 'supervisor' : 'staff')) as any
      });
    });

    setPaidHistory(prev => {
      const next = [...newRecords, ...prev];
      localStorage.setItem('edamari_payroll_history', JSON.stringify(next));
      return next;
    });

    setPaidStatusMap(updatedStatus);
    localStorage.setItem('edamari_payroll_paid', JSON.stringify(updatedStatus));
    const totalDisbursed = pendingToPay.reduce((s, p) => s + p.totalEarned, 0);
    toast.success(`Marked ${newRecords.length} payouts as PAID (₹${totalDisbursed.toLocaleString()}) and recorded in History!`);
    setBulkPayModalOpen(false);
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
        let petrolExpense = 0;
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
          petrolExpense: number;
          crewPay: number;
          tripCount: number;
          dayTotal: number;
          siteName?: string;
          workDescription?: string;
          notes?: string;
          inTime?: string;
          outTime?: string;
          duration?: string;
          painters?: number;
          plumbers?: number;
          labour?: number;
          editedByAdmin?: boolean;
          editedByAdminName?: string;
        }[] = [];

        let hasAdminEdits = false;
        let adminEditName = '';

        staffAtts.forEach(att => {
          if (att.editedByAdmin) {
            hasAdminEdits = true;
            if (att.editedByAdminName && !adminEditName) adminEditName = att.editedByAdminName;
          }

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
            let dayPetrol = 0;
            if (isDrv) {
              dayTrips = (materialRequests || []).filter(
                r => (r.driverId === staff.id || r.driverName?.toLowerCase() === staff.name.toLowerCase()) &&
                     (r.date === att.date || r.createdAt?.startsWith(att.date))
              );
              dayTransit = dayTrips.reduce((sum, r) => sum + (Number(r.driverWage) || 0), 0);
              dayPetrol = dayTrips.reduce((sum, r) => sum + (Number(r.petrolCharge) || 0), 0);
              totalDriverTrips += dayTrips.length;
            }

            // Supervisor under-labour crew count on this day
            let dayCrew = 0;
            if (isSup && (att.presentCounts || att.halfDayCounts)) {
              const fullCount = Object.values(att.presentCounts || {}).reduce((sum, c) => sum + (c || 0), 0);
              const halfCount = Object.values(att.halfDayCounts || {}).reduce((sum, c) => sum + (c || 0), 0);
              const unCount = fullCount + halfCount;
              const crewSalaryRate = staff.underLabourSalary || 700;
              const crewOtRate = staff.underLabourOT || 100;

              const unDaily = (fullCount * crewSalaryRate) + (halfCount * (crewSalaryRate / 2));
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
            petrolExpense += dayPetrol;
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
              petrolExpense: dayPetrol,
              crewPay: dayCrew,
              tripCount: dayTrips.length,
              dayTotal: dayBase + dayOt + dayTransit + dayPetrol,
              siteName: matchingLog?.siteName || (isDrv ? 'Logistics Delivery' : 'Site Operation'),
              workDescription: matchingLog?.notes,
              notes: att.notes,
              inTime: inTimeStr,
              outTime: outTimeStr,
              duration: dur,
              painters: att.presentCounts?.painter || 0,
              plumbers: att.presentCounts?.plumber || 0,
              labour: att.presentCounts?.labour || 0,
              editedByAdmin: att.editedByAdmin,
              editedByAdminName: att.editedByAdminName
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
              petrolExpense: 0,
              crewPay: 0,
              tripCount: 0,
              dayTotal: 0,
              siteName: 'Absent / Off Duty',
              notes: att.notes || 'Marked Absent',
              inTime: '-',
              outTime: '-',
              duration: '-',
              editedByAdmin: att.editedByAdmin,
              editedByAdminName: att.editedByAdminName
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
              const tripWage = Number(t.driverWage) || 0;
              const tripPetrol = Number(t.petrolCharge) || 0;
              transitPay += tripWage;
              petrolExpense += tripPetrol;
              totalDriverTrips += 1;
              breakdown.push({
                date: tripDate,
                status: 'delivery-only',
                base: 0,
                otHours: 0,
                otPay: 0,
                transitPay: tripWage,
                petrolExpense: tripPetrol,
                crewPay: 0,
                tripCount: 1,
                dayTotal: tripWage + tripPetrol,
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
                petrolExpense: 0,
                crewPay: 0,
                tripCount: 0,
                dayTotal: dailyBase,
                siteName: l.siteName || 'Site Work Entry'
              });
            }
          });
        }

        breakdown.sort((a, b) => b.date.localeCompare(a.date));
        const totalEarned = isSup ? (basePay + otPay) : (basePay + otPay + transitPay + petrolExpense);

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
          petrolExpense,
          crewPay: supervisorCrewPay,
          totalDriverTrips,
          totalEarned,
          hasAdminEdits,
          adminEditName,
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
        editedByAdmin?: boolean;
        editedByAdminName?: string;
      }[] = [];

      let hasAdminEdits = false;
      let adminEditName = '';

      supAtts.forEach(att => {
        if (att.editedByAdmin) {
          hasAdminEdits = true;
          if (att.editedByAdminName && !adminEditName) adminEditName = att.editedByAdminName;
        }
        if (!att.presentCounts && !att.halfDayCounts) return;
        const pFull = att.presentCounts?.painter || 0;
        const pHalf = att.halfDayCounts?.painter || 0;
        const plFull = att.presentCounts?.plumber || 0;
        const plHalf = att.halfDayCounts?.plumber || 0;
        const lFull = att.presentCounts?.labour || 0;
        const lHalf = att.halfDayCounts?.labour || 0;

        const p = pFull + (pHalf * 0.5);
        const pl = plFull + (plHalf * 0.5);
        const l = lFull + (lHalf * 0.5);

        const fullCount = Object.values(att.presentCounts || {}).reduce((sum, c) => sum + (c || 0), 0);
        const halfCount = Object.values(att.halfDayCounts || {}).reduce((sum, c) => sum + (c || 0), 0);
        const dayHeadcount = fullCount + halfCount;

        if (dayHeadcount === 0 && (!att.unnamedOtHours || att.unnamedOtHours === 0)) return;

        totalPainterManDays += p;
        totalPlumberManDays += pl;
        totalLabourManDays += l;

        const dayCrewBase = (fullCount * crewRate) + (halfCount * (crewRate / 2));
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
          siteName: matchingLog?.siteName || 'Site Operation',
          editedByAdmin: att.editedByAdmin,
          editedByAdminName: att.editedByAdminName
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
          totalEarned: totalCrewBasePay + totalCrewOtPay,
          hasAdminEdits,
          adminEditName,
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
  const totalPetrolExpense = allCards.reduce((s, p) => s + (p.petrolExpense || 0), 0);
  const totalPaid = allCards.filter(p => isStaffPaid(p.id)).reduce((s, p) => s + p.totalEarned, 0);
  const totalPending = totalPayroll - totalPaid;

  // Weekly Crew Summary Metrics & Trade Breakdown
  const tradeBreakdown = useMemo(() => {
    const breakdown: Record<string, { days: number, basePay: number, otPay: number, totalCost: number }> = {};
    
    // Initialize with all available labour types
    labourTypes.forEach(lt => {
      breakdown[lt] = { days: 0, basePay: 0, otPay: 0, totalCost: 0 };
    });

    // Hardcoded supervisor unnamed crews (they are paid as a blended 'crewBasePay')
    let supervisorPainterDays = 0;
    let supervisorPlumberDays = 0;
    let supervisorLabourDays = 0;
    let totalSupervisorCrewCost = 0; // We can't perfectly split supervisor cost by trade, so we track it separately or blend it.

    supervisorCrewTeams.forEach(t => {
      supervisorPainterDays += t.painterDays;
      supervisorPlumberDays += t.plumberDays;
      supervisorLabourDays += t.labourDays;
      totalSupervisorCrewCost += t.totalEarned;
    });

    if (supervisorPainterDays > 0) {
      if (!breakdown['painter']) breakdown['painter'] = { days: 0, basePay: 0, otPay: 0, totalCost: 0 };
      breakdown['painter'].days += supervisorPainterDays;
    }
    if (supervisorPlumberDays > 0) {
      if (!breakdown['plumber']) breakdown['plumber'] = { days: 0, basePay: 0, otPay: 0, totalCost: 0 };
      breakdown['plumber'].days += supervisorPlumberDays;
    }
    if (supervisorLabourDays > 0) {
      if (!breakdown['labour']) breakdown['labour'] = { days: 0, basePay: 0, otPay: 0, totalCost: 0 };
      breakdown['labour'].days += supervisorLabourDays;
    }
    
    // Add supervisor total cost as a separate line item since it's blended
    if (totalSupervisorCrewCost > 0) {
      breakdown['unnamed_crew_blended'] = {
        days: supervisorPainterDays + supervisorPlumberDays + supervisorLabourDays,
        basePay: 0, otPay: 0, totalCost: totalSupervisorCrewCost
      };
    }

    // Individual named crew members
    const individualCrew = staffPayrollData.filter(s => s.role !== 'supervisor' && s.role !== 'driver');
    individualCrew.forEach(c => {
      const role = c.role;
      if (!breakdown[role]) breakdown[role] = { days: 0, basePay: 0, otPay: 0, totalCost: 0 };
      breakdown[role].days += c.presentDays + (c.halfDays * 0.5);
      breakdown[role].basePay += c.basePay;
      breakdown[role].otPay += c.otPay;
      breakdown[role].totalCost += c.totalEarned;
    });

    return breakdown;
  }, [supervisorCrewTeams, staffPayrollData, labourTypes]);

  const totalCrewCostFromTrades = Object.values(tradeBreakdown).reduce((sum, t) => sum + t.totalCost, 0);

  const crewSummary = useMemo(() => {
    let painterDays = 0;
    let plumberDays = 0;
    let labourDays = 0;
    let crewOtPay = 0;
    let totalCrewCost = 0;

    Object.entries(tradeBreakdown).forEach(([trade, data]) => {
      if (trade === 'painter') painterDays += data.days;
      else if (trade === 'plumber') plumberDays += data.days;
      else if (trade === 'labour') labourDays += data.days;
      crewOtPay += data.otPay;
      totalCrewCost += data.totalCost;
    });

    return {
      painterDays,
      plumberDays,
      labourDays,
      crewOtPay,
      totalCrewCost
    };
  }, [tradeBreakdown]);

  // Export Current Statement PDF
  const exportPayrollPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.setTextColor(184, 117, 26);
    doc.text('JGS CONSTRUCTION & INTERIORS', 14, 18);

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
    doc.text('JGS CONSTRUCTION & INTERIORS', 105, 20, { align: 'center' });

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
    doc.text('JGS CONSTRUCTION & INTERIORS', 14, 18);

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
    doc.text('JGS CONSTRUCTION & INTERIORS', 105, 18, { align: 'center' });

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
                    onClick={openBulkPayModal}
                    className="h-8 rounded-xl text-xs font-bold gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark All Paid
                    {allCards.filter(p => !isStaffPaid(p.id)).length > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-600 text-white font-extrabold">
                        {allCards.filter(p => !isStaffPaid(p.id)).length}
                      </span>
                    )}
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
                    ₹{totalCrewCostFromTrades.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-1">
                {Object.entries(tradeBreakdown).filter(([k, v]) => v.days > 0 || v.totalCost > 0).map(([trade, data]) => (
                  <div key={trade} className="bg-card p-2.5 rounded-xl border border-border/50 text-center flex flex-col justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold break-words">
                      {trade === 'unnamed_crew_blended' ? 'Unnamed Blended' : trade}
                    </span>
                    <p className="font-heading font-extrabold text-sm text-foreground mt-0.5">
                      {data.days} Days
                    </p>
                    <span className="text-[10px] font-semibold text-primary mt-1 border-t border-border/40 pt-1">
                      ₹{data.totalCost.toLocaleString()}
                    </span>
                  </div>
                ))}
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
                                {p.hasAdminEdits && (
                                  <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/30 px-2 py-0.5 rounded-full">
                                    Modified by {p.adminEditName || 'Admin'}
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
                                {p.hasAdminEdits && (
                                  <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/30 px-2 py-0.5 rounded-full">
                                    Modified by {p.adminEditName || 'Admin'}
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
                          {isDrv && p.petrolExpense > 0 && (
                            <div className="text-amber-700 dark:text-amber-400">
                              ⛽ Petrol: +₹{p.petrolExpense.toLocaleString()}
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
                                    {b.petrolExpense > 0 && <span className="text-amber-700">· ⛽ Petrol (+₹{b.petrolExpense})</span>}
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
      {/* MODAL: BULK PAYOUT / "MARK ALL PAID" WITH RECIPIENT TYPE BREAKDOWN        */}
      {/* ========================================================================= */}
      {bulkPayModalOpen && (() => {
        const allPendingCards = allCards.filter(p => !isStaffPaid(p.id));
        const displayedPendingCards = allPendingCards.filter(p => {
          if (bulkFilterType === 'all') return true;
          if (bulkFilterType === 'supervisor') return !p.isCrewTeam && p.role === 'supervisor';
          if (bulkFilterType === 'driver') return !p.isCrewTeam && p.role === 'driver';
          if (bulkFilterType === 'crew') return p.isCrewTeam || (p.role !== 'supervisor' && p.role !== 'driver');
          return true;
        });

        const totalPendingAmount = allPendingCards.reduce((s, p) => s + p.totalEarned, 0);
        const selectedCards = allPendingCards.filter(p => bulkSelectedStaffIds.includes(p.id));
        const selectedTotalAmount = selectedCards.reduce((s, p) => s + p.totalEarned, 0);

        const pendingSupervisors = allPendingCards.filter(p => !p.isCrewTeam && p.role === 'supervisor');
        const pendingDrivers = allPendingCards.filter(p => !p.isCrewTeam && p.role === 'driver');
        const pendingCrewTeams = allPendingCards.filter(p => p.isCrewTeam);
        const pendingTradeCrew = allPendingCards.filter(p => !p.isCrewTeam && p.role !== 'supervisor' && p.role !== 'driver');

        const toggleSelectAll = (select: boolean) => {
          if (select) {
            setBulkSelectedStaffIds(allPendingCards.map(p => p.id));
          } else {
            setBulkSelectedStaffIds([]);
          }
        };

        const toggleSelectCategory = (cat: 'crew' | 'staff') => {
          if (cat === 'crew') {
            const crewIds = allPendingCards.filter(p => p.isCrewTeam || (p.role !== 'supervisor' && p.role !== 'driver')).map(p => p.id);
            setBulkSelectedStaffIds(crewIds);
          } else {
            const staffIds = allPendingCards.filter(p => !p.isCrewTeam && (p.role === 'supervisor' || p.role === 'driver')).map(p => p.id);
            setBulkSelectedStaffIds(staffIds);
          }
        };

        const toggleStaffSelection = (id: string) => {
          setBulkSelectedStaffIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
          );
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-card w-full max-w-3xl rounded-3xl border border-border shadow-2xl overflow-hidden my-auto animate-scale-in max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/30 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-base text-foreground flex items-center gap-2">
                      Mark All Pending Payouts as Paid
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                        {allPendingCards.length} Pending
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Period: <strong className="text-foreground">{periodLabel}</strong> • Review recipient types and confirm disbursement details.
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setBulkPayModalOpen(false)}
                  className="h-8 w-8 rounded-xl"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Scrollable Body */}
              <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
                {/* 1. Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 bg-muted/40 rounded-2xl border border-border/40">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Pending Wording</span>
                    <span className="text-base font-extrabold text-foreground mt-0.5 block">
                      ₹{totalPendingAmount.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Across {allPendingCards.length} pending disbursements
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">Selected for Payment</span>
                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      ₹{selectedTotalAmount.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      {selectedCards.length} of {allPendingCards.length} recipients selected
                    </span>
                  </div>

                  <div className="p-3 bg-card rounded-2xl border border-border/40 col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Recipient Breakdown</span>
                    <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Supervisors:</span>
                        <span className="font-bold text-foreground">{pendingSupervisors.length} (₹{pendingSupervisors.reduce((s, p) => s + p.totalEarned, 0).toLocaleString()})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Drivers:</span>
                        <span className="font-bold text-foreground">{pendingDrivers.length} (₹{pendingDrivers.reduce((s, p) => s + p.totalEarned, 0).toLocaleString()})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Crew & Trades:</span>
                        <span className="font-bold text-foreground">{pendingCrewTeams.length + pendingTradeCrew.length} (₹{(pendingCrewTeams.reduce((s, p) => s + p.totalEarned, 0) + pendingTradeCrew.reduce((s, p) => s + p.totalEarned, 0)).toLocaleString()})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Payment Configuration */}
                <div className="p-3.5 bg-card rounded-2xl border border-border/60 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Disbursement Details
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Mode: <strong className="text-foreground">{bulkPayMode}</strong>
                    </span>
                  </div>

                  {/* Payment Mode Selector */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'Cash' as const, label: '💵 Cash', desc: 'Handed in cash' },
                      { id: 'UPI' as const, label: '📱 UPI / GPay', desc: 'GPay / PhonePe' },
                      { id: 'Bank Transfer' as const, label: '🏛️ Bank Transfer', desc: 'NEFT / RTGS' },
                      { id: 'Cheque' as const, label: '📄 Cheque', desc: 'Issued cheque' },
                    ].map(m => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setBulkPayMode(m.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          bulkPayMode === m.id
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs'
                            : 'border-border/60 bg-muted/20 hover:bg-muted/50 text-foreground'
                        }`}
                      >
                        <p className="text-xs font-bold">{m.label}</p>
                        <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Payment Date</Label>
                      <Input
                        type="date"
                        value={bulkPayDate}
                        onChange={e => setBulkPayDate(e.target.value)}
                        className="h-8 text-xs rounded-xl mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Reference / Transaction / Cheque #</Label>
                      <Input
                        placeholder="e.g. NEFT-99120 or Cheque #4019"
                        value={bulkPayRef}
                        onChange={e => setBulkPayRef(e.target.value)}
                        className="h-8 text-xs rounded-xl mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Payment Notes</Label>
                      <Input
                        placeholder="e.g. October payroll settlement"
                        value={bulkPayNote}
                        onChange={e => setBulkPayNote(e.target.value)}
                        className="h-8 text-xs rounded-xl mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Recipient Type Filter & Selection Controls */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {/* Role Filter Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
                      {[
                        { id: 'all' as const, label: `All Types (${allPendingCards.length})` },
                        { id: 'supervisor' as const, label: `Supervisors (${pendingSupervisors.length})` },
                        { id: 'driver' as const, label: `Drivers (${pendingDrivers.length})` },
                        { id: 'crew' as const, label: `Site Crew (${pendingCrewTeams.length + pendingTradeCrew.length})` },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setBulkFilterType(tab.id)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                            bulkFilterType === tab.id
                              ? 'bg-primary text-white font-bold shadow-xs'
                              : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Quick selection shortcuts */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleSelectAll(true)}
                        className="h-7 px-2 text-[11px] rounded-lg"
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleSelectAll(false)}
                        className="h-7 px-2 text-[11px] rounded-lg text-muted-foreground"
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleSelectCategory('crew')}
                        className="h-7 px-2 text-[11px] rounded-lg text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                      >
                        Only Crew
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleSelectCategory('staff')}
                        className="h-7 px-2 text-[11px] rounded-lg text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                      >
                        Only Staff
                      </Button>
                    </div>
                  </div>

                  {/* 4. Interactive List of Recipients with Type Information */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {displayedPendingCards.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl bg-muted/10">
                        No pending payouts match this filter.
                      </div>
                    ) : (
                      displayedPendingCards.map(p => {
                        const isSelected = bulkSelectedStaffIds.includes(p.id);
                        const typeInfo = getRecipientTypeInfo(p);

                        return (
                          <div
                            key={p.id}
                            onClick={() => toggleStaffSelection(p.id)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isSelected
                                ? 'border-emerald-500/40 bg-emerald-500/5 shadow-2xs'
                                : 'border-border/50 bg-card opacity-60 hover:opacity-100 hover:border-border'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Custom checkbox */}
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
                                isSelected ? 'bg-emerald-600 text-white' : 'border border-border bg-muted/40'
                              }`}>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-foreground">{p.name}</span>
                                  {/* Distinct Type Badge */}
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${typeInfo.badgeColor}`}>
                                    {typeInfo.icon}
                                    {typeInfo.typeLabel}
                                  </span>
                                  {p.role && !p.isCrewTeam && p.role !== 'supervisor' && p.role !== 'driver' && (
                                    <span className="text-[10px] text-muted-foreground font-semibold">
                                      ({p.role})
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{typeInfo.subtext}</span>
                                  <span>·</span>
                                  <span>{p.presentDays} Full Days{p.halfDays > 0 ? `, ${p.halfDays} Half Days` : ''}</span>
                                  {p.totalOtHours > 0 && (
                                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                      · {p.totalOtHours}h OT (+₹{p.otPay.toLocaleString()})
                                    </span>
                                  )}
                                  {p.role === 'driver' && p.totalDriverTrips > 0 && (
                                    <span className="text-blue-600 dark:text-blue-400">
                                      · {p.totalDriverTrips} Runs
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Financial itemization & Net Payout */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 pl-8 sm:pl-0">
                              <div className="text-right text-[11px] text-muted-foreground">
                                <div>Base: ₹{p.basePay.toLocaleString()}</div>
                                {(p.transitPay > 0 || p.petrolExpense > 0 || p.crewPay > 0) && (
                                  <div className="text-blue-600">
                                    Extra: +₹{((p.transitPay || 0) + (p.petrolExpense || 0) + (p.crewPay || 0)).toLocaleString()}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-heading font-extrabold text-emerald-600 dark:text-emerald-400 block">
                                  ₹{p.totalEarned.toLocaleString()}
                                </span>
                                <span className="text-[9px] uppercase font-bold text-muted-foreground">
                                  Net Payable
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border/50 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-muted-foreground text-center sm:text-left">
                  Selected <strong className="text-foreground">{selectedCards.length}</strong> of {allPendingCards.length} recipients • Total:{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    ₹{selectedTotalAmount.toLocaleString()}
                  </strong>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkPayModalOpen(false)}
                    className="h-9 rounded-xl text-xs flex-1 sm:flex-none"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={confirmBulkPayment}
                    disabled={selectedCards.length === 0}
                    className="h-9 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm flex-1 sm:flex-none"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Confirm & Mark {selectedCards.length} as PAID (₹{selectedTotalAmount.toLocaleString()})
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
                              
                              {log.editedByAdmin && (
                                <span className="text-[10px] text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 font-bold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                                  Modified by Admin: {log.editedByAdminName || 'Admin'}
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
