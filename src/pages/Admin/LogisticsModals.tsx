import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Truck, Clock, CheckCircle2, IndianRupee, Package, ArrowRightLeft, AlertCircle,
  Building2, User, Star, Check, Plus, Trash2, CreditCard, Info
} from 'lucide-react';
import {
  MaterialRequest, MaterialRequestItem, Supplier, Staff, Vehicle, VEHICLE_TYPES, MaterialSetting, SupplierPaymentRecord
} from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { calculateDuration, calculateDurationInHours, formatTimeString, TIME_SELECT_OPTIONS } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

// Common unit choices for materials
const COMMON_UNITS = ['Kg', 'Tons', 'Bags', 'Liters', 'Nos', 'Sq.Ft', 'Boxes', 'Meters', 'Loads', 'Units'];

// ── Assign Staff, Supplier & Product Pricing Modal ─────────────────────────
export interface AssignMaterialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: MaterialRequest | null;
  driversList?: Staff[];
  staffList?: Staff[];
  suppliers: Supplier[];
  vehicles: Vehicle[];
  materialSettings?: MaterialSetting[];
  onAssign: (
    id: string,
    assignment: {
      driverId: string;
      driverName: string;
      supplierId: string;
      supplierName: string;
      vehicle: string;
      vehicleType?: string;
      vehicleNumber?: string;
      startTime: string;
      supplierPrice?: number;
      supplierPaidAmount?: number;
      supplierBalance?: number;
      supplierPaymentMethod?: string;
      supplierPaymentDate?: string;
      supplierPaymentNotes?: string;
      supplierPayments?: SupplierPaymentRecord[];
      gstType?: 'none' | 'igst' | 'cgst_sgst';
      igstRate?: number;
      cgstRate?: number;
      sgstRate?: number;
      gstAmount?: number;
      items?: MaterialRequestItem[];
    }
  ) => void;
}

interface ItemRateState {
  name: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  clientRate?: number;
  clientAmount?: number;
  customerRate?: number;
  customerAmount?: number;
}

export const AssignMaterialModal = ({
  open,
  onOpenChange,
  request,
  driversList,
  staffList,
  suppliers,
  vehicles,
  materialSettings,
  onAssign
}: AssignMaterialModalProps) => {
  const appContext = useApp();
  const allStaff = (staffList && staffList.length > 0 ? staffList : appContext.staffList) || [];
  const allDrivers = (driversList && driversList.length > 0 ? driversList : allStaff.filter(s => s.role === 'driver')) || [];
  const allMaterials = (materialSettings && materialSettings.length > 0 ? materialSettings : appContext.materialSettings) || [];

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const targetDate = request?.date || todayStr;

  // Filter only drivers who are marked present today (default: true)
  const [showOnlyPresentDrivers, setShowOnlyPresentDrivers] = useState(true);

  const isStaffPresentToday = (staffId: string) => {
    return (appContext.attendances || []).some(att => {
      const isDateMatch = att.date === todayStr || att.date === targetDate;
      const isStaffMatch = att.staffId === staffId;
      const isPresent = att.status === 'present' || att.status === 'half-day';
      return isDateMatch && isStaffMatch && isPresent;
    });
  };

  const presentDrivers = useMemo(() => {
    return allDrivers.filter(d => {
      if (request?.driverId === d.id) return true;
      return isStaffPresentToday(d.id);
    });
  }, [allDrivers, appContext.attendances, todayStr, targetDate, request?.driverId]);

  const displayedDrivers = showOnlyPresentDrivers ? presentDrivers : allDrivers;

  const otherStaffMembers = useMemo(() => {
    return allStaff.filter(s => s.role !== 'driver');
  }, [allStaff]);

  const presentOtherStaff = useMemo(() => {
    return otherStaffMembers.filter(s => {
      if (request?.driverId === s.id) return true;
      return isStaffPresentToday(s.id);
    });
  }, [otherStaffMembers, appContext.attendances, todayStr, targetDate, request?.driverId]);

  const displayedOtherStaff = showOnlyPresentDrivers ? presentOtherStaff : otherStaffMembers;

  const [assignStaffId, setAssignStaffId] = useState('');
  const [assignSupplierId, setAssignSupplierId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [assignVehicleType, setAssignVehicleType] = useState('Pickup');
  const [assignVehicleNumber, setAssignVehicleNumber] = useState('');
  const [assignStartTime, setAssignStartTime] = useState('');
  const [assignSupplierPrice, setAssignSupplierPrice] = useState('');
  const [assignSupplierPaidAmount, setAssignSupplierPaidAmount] = useState('');
  const [assignPaymentMethod, setAssignPaymentMethod] = useState<'Cash' | 'UPI / GPay' | 'Bank Transfer / NEFT' | 'Cheque'>('UPI / GPay');
  const [assignPaymentDate, setAssignPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [assignPaymentNotes, setAssignPaymentNotes] = useState('');
  const [editItems, setEditItems] = useState<ItemRateState[]>([]);
  const [gstType, setGstType] = useState<'none' | 'igst' | 'cgst_sgst'>('none');
  const [igstRate, setIgstRate] = useState<number>(18);
  const [cgstRate, setCgstRate] = useState<number>(9);
  const [sgstRate, setSgstRate] = useState<number>(9);

  const calculatedItemsTotal = useMemo(() => {
    return editItems.reduce(
      (sum, it) => sum + (Number(it.amount) || (Number(it.quantity) || 1) * (Number(it.rate) || 0)),
      0
    );
  }, [editItems]);

  const gstAmount = useMemo(() => {
    if (gstType === 'igst') return (calculatedItemsTotal * igstRate) / 100;
    if (gstType === 'cgst_sgst') return (calculatedItemsTotal * (cgstRate + sgstRate)) / 100;
    return 0;
  }, [calculatedItemsTotal, gstType, igstRate, cgstRate, sgstRate]);

  const calculatedTotalBill = calculatedItemsTotal + gstAmount;

  // Products requested in this requisition
  const requestedProducts = request?.items || [];

  // Match suppliers based on requested products
  const { matchingSuppliers, otherSuppliers } = useMemo(() => {
    if (!requestedProducts.length) return { matchingSuppliers: suppliers, otherSuppliers: [] };

    const prodNames = requestedProducts.map(it => it.name.trim().toLowerCase());

    const matching: Supplier[] = [];
    const other: Supplier[] = [];

    suppliers.forEach(sup => {
      const supMats = [
        ...(sup.suppliedMaterials || []),
        ...(typeof sup.materialsSupplied === 'string'
          ? sup.materialsSupplied.split(',').map(s => s.trim())
          : (Array.isArray(sup.materialsSupplied) ? sup.materialsSupplied : []))
      ].map(m => m.toLowerCase());

      const isMatch = prodNames.some(pName =>
        supMats.some(sMat => sMat.includes(pName) || pName.includes(sMat))
      );

      if (isMatch) {
        matching.push(sup);
      } else {
        other.push(sup);
      }
    });

    return { matchingSuppliers: matching, otherSuppliers: other };
  }, [suppliers, requestedProducts]);

  useEffect(() => {
    if (!request || !open) return;

    // 1. Initial Staff (prefer assigned staff/driver, or first present driver, or first driver, or first staff)
    const initialStaffId = request.driverId || presentDrivers[0]?.id || allDrivers[0]?.id || allStaff[0]?.id || '';
    setAssignStaffId(initialStaffId);

    // 2. Initial Items with unit rates based on catalog/item
    const initialItems: ItemRateState[] = (request.items && request.items.length > 0)
      ? request.items.map(it => {
        const catMat = allMaterials.find(m => m.name.toLowerCase() === it.name.toLowerCase());
        const initialRate = it.rate ?? catMat?.defaultRate ?? 0;
        const initialQty = it.quantity || 1;
        const clientRate = it.clientRate !== undefined ? it.clientRate : initialRate;
        const customerRate = it.customerRate !== undefined ? it.customerRate : initialRate;
        return {
          name: it.name,
          quantity: initialQty,
          unit: it.unit || catMat?.unit || 'Kg',
          rate: initialRate,
          amount: Math.round(initialQty * initialRate * 100) / 100,
          clientRate,
          clientAmount: it.clientAmount !== undefined ? it.clientAmount : Math.round(initialQty * clientRate * 100) / 100,
          customerRate,
          customerAmount: it.customerAmount !== undefined ? it.customerAmount : Math.round(initialQty * customerRate * 100) / 100
        };
      })
      : [{
        name: allMaterials[0]?.name || 'Material Item',
        quantity: 1,
        unit: allMaterials[0]?.unit || 'Kg',
        rate: allMaterials[0]?.defaultRate || 0,
        amount: allMaterials[0]?.defaultRate || 0,
        clientRate: allMaterials[0]?.defaultRate || 0,
        clientAmount: allMaterials[0]?.defaultRate || 0,
        customerRate: allMaterials[0]?.defaultRate || 0,
        customerAmount: allMaterials[0]?.defaultRate || 0
      }];
    setEditItems(initialItems);

    // 3. Initial Supplier: prefer matching suppliers for the requested product
    const bestSupplier = request.supplierId
      ? suppliers.find(s => s.id === request.supplierId)
      : (matchingSuppliers[0] || suppliers[0]);
    setAssignSupplierId(bestSupplier?.id || '');

    setAssignStartTime(formatTimeString(request.startTime) || formatTimeString(format(new Date(), 'hh:mm a')));

    // 4. Initial GST settings
    setGstType(request.gstType || 'none');
    setIgstRate(request.igstRate || 18);
    setCgstRate(request.cgstRate || 9);
    setSgstRate(request.sgstRate || 9);

    const calcItemsTotal = initialItems.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    const initialGstAmount = request.gstType === 'igst' ? (calcItemsTotal * (request.igstRate || 18)) / 100
      : request.gstType === 'cgst_sgst' ? (calcItemsTotal * ((request.cgstRate || 9) + (request.sgstRate || 9))) / 100
        : 0;
    const initialTotal = calcItemsTotal + initialGstAmount;

    const defaultPrice = request.supplierPrice ?? (initialTotal > 0 ? initialTotal : (request.materialCost ?? 0));
    setAssignSupplierPrice(defaultPrice > 0 ? defaultPrice.toString() : '');
    setAssignSupplierPaidAmount(request.supplierPaidAmount ? request.supplierPaidAmount.toString() : '');
    setAssignPaymentMethod((request.supplierPaymentMethod as any) || 'UPI / GPay');
    setAssignPaymentDate(request.supplierPaymentDate || format(new Date(), 'yyyy-MM-dd'));
    setAssignPaymentNotes(request.supplierPaymentNotes || '');

    // 5. Prefill vehicle
    if (request.vehicle) {
      const match = vehicles.find(v => v.name === request.vehicle || v.number === request.vehicle);
      if (match) {
        setSelectedVehicleId(match.id);
        setAssignVehicleType(match.type || 'Pickup');
        setAssignVehicleNumber(match.number);
      } else {
        setSelectedVehicleId('custom');
        setAssignVehicleType(request.vehicleType || 'Pickup');
        setAssignVehicleNumber(request.vehicleNumber || request.vehicle);
      }
    } else if (vehicles.length > 0) {
      setSelectedVehicleId(vehicles[0].id);
      setAssignVehicleType(vehicles[0].type);
      setAssignVehicleNumber(vehicles[0].number);
    } else {
      setSelectedVehicleId('custom');
      setAssignVehicleType('Pickup');
      setAssignVehicleNumber('');
    }
  }, [request, open, allStaff, allDrivers, suppliers, vehicles, allMaterials, matchingSuppliers]);

  const handleSelectVehicle = (id: string) => {
    setSelectedVehicleId(id);
    if (id === 'custom') {
      setAssignVehicleNumber('');
    } else {
      const v = vehicles.find(item => item.id === id);
      if (v) {
        setAssignVehicleType(v.type);
        setAssignVehicleNumber(v.number);
      }
    }
  };

  const handleItemFieldChange = (idx: number, field: keyof ItemRateState, value: any) => {
    setEditItems(prev => {
      const updated = [...prev];
      const qVal = field === 'quantity' ? (value === '' ? 0 : Number(value) || 0) : (Number(updated[idx].quantity) || 0);
      const rVal = field === 'rate' ? (value === '' ? 0 : Number(value) || 0) : (Number(updated[idx].rate) || 0);
      const amount = Math.round(qVal * rVal * 100) / 100;

      updated[idx] = {
        ...updated[idx],
        [field]: value,
        amount
      };
      return updated;
    });
  };

  const handleAddItem = () => {
    const defaultMat = allMaterials[0];
    const newItem: ItemRateState = {
      name: defaultMat?.name || 'Material Item',
      quantity: 1,
      unit: defaultMat?.unit || 'Kg',
      rate: defaultMat?.defaultRate || 0,
      amount: defaultMat?.defaultRate || 0
    };
    setEditItems(prev => {
      const updated = [...prev, newItem];
      const total = updated.reduce((s, it) => s + (Number(it.amount) || 0), 0);
      setAssignSupplierPrice(total > 0 ? total.toString() : '');
      return updated;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setEditItems(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      const total = updated.reduce((s, it) => s + (Number(it.amount) || 0), 0);
      setAssignSupplierPrice(total > 0 ? total.toString() : '');
      return updated;
    });
  };

  const handleConfirmAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;

    const assignedStaff = allStaff.find(s => s.id === assignStaffId) || allDrivers.find(d => d.id === assignStaffId);
    if (!assignedStaff) {
      toast.error('Please assign a staff member or driver first');
      return;
    }

    const isInterSite = request.sourceType === 'site';
    let supplierName = '';
    let finalSupplierId = '';

    if (isInterSite) {
      supplierName = request.sourceSiteName || 'Site Transfer';
      finalSupplierId = request.sourceSiteId || 'site-transfer';
    } else {
      const sup = suppliers.find(s => s.id === assignSupplierId);
      if (!sup) {
        toast.error('Please select a supplier for the requested product');
        return;
      }
      supplierName = sup.name;
      finalSupplierId = sup.id;
    }

    if (!assignVehicleNumber.trim()) {
      toast.error('Please enter vehicle number');
      return;
    }

    const matchedVeh = vehicles.find(v => v.id === selectedVehicleId);
    const vehicleLabel = matchedVeh ? matchedVeh.name : `${assignVehicleType} (${assignVehicleNumber.trim()})`;

    const existingPaid = request.supplierPaidAmount || 0;
    const existingPayments = request.supplierPayments || [];

    onAssign(request.id, {
      driverId: assignedStaff.id,
      driverName: assignedStaff.name,
      supplierId: finalSupplierId,
      supplierName: supplierName,
      vehicle: vehicleLabel,
      vehicleType: assignVehicleType,
      vehicleNumber: assignVehicleNumber.trim(),
      startTime: assignStartTime || format(new Date(), 'hh:mm a'),
      supplierPaymentMethod: request.supplierPaymentMethod,
      supplierPaymentDate: request.supplierPaymentDate,
      supplierPaymentNotes: request.supplierPaymentNotes,
      supplierPayments: existingPayments,
      items: request.items // keep original requested items untouched
    });

    toast.success(`Staff ${assignedStaff.name} assigned & dispatched to ${supplierName}!`);
    onOpenChange(false);
  };

  const isInterSite = request?.sourceType === 'site';
  const currentSelectedSupplier = suppliers.find(s => s.id === assignSupplierId);
  const assignedStaffObj = allStaff.find(s => s.id === assignStaffId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b border-border/50">
          <DialogTitle className="text-base font-heading font-bold flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            {request?.driverId || request?.driverName
              ? 'Reassign Driver & Supplier Logistics'
              : (isInterSite ? 'Dispatch Inter-Site Material Transfer' : 'Material Dispatch: Assign Staff & Supplier')}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Destination Site: <strong className="text-foreground">{request?.siteName}</strong>
            {request?.requestedByStaffName && ` · Requested by: ${request.requestedByStaffName}`}
            {isInterSite && ` · Transferring from ${request?.sourceSiteName}`}
            {(request?.driverName || request?.driverId) && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold ml-1">
                (Currently assigned: {request.driverName})
              </span>
            )}
          </p>
        </DialogHeader>

        <form onSubmit={handleConfirmAssign} className="space-y-4 mt-2">
          {/* ══════════════════════════════════════════════════════════════════
              STEP 1: FIRST ASSIGN THE STAFF MEMBER / DRIVER
          ══════════════════════════════════════════════════════════════════ */}
          <div className="p-3.5 bg-card rounded-2xl border border-primary/20 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> 1. {request?.driverName ? 'Reassign Driver / Staff' : 'Assign Staff Member / Driver First'}
              </span>
              {assignedStaffObj && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase">
                  {assignedStaffObj.role || 'Staff'}
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold text-muted-foreground">
                  {request?.driverName ? 'Change / Reassign Driver *' : 'Select Staff to Dispatch *'}
                </Label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-muted-foreground hover:text-foreground">
                  <input
                    type="checkbox"
                    checked={showOnlyPresentDrivers}
                    onChange={e => setShowOnlyPresentDrivers(e.target.checked)}
                    className="rounded accent-primary w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Only Present Drivers ({presentDrivers.length})</span>
                </label>
              </div>

              {allStaff.length === 0 ? (
                <div className="p-3 bg-destructive/10 border border-destructive/25 rounded-xl text-xs text-destructive mt-1">
                  No staff members available. Please add staff members in the Staff Directory.
                </div>
              ) : (
                <Select value={assignStaffId} onValueChange={setAssignStaffId}>
                  <SelectTrigger className="mt-1 h-11 rounded-xl font-semibold">
                    <SelectValue placeholder="Select Staff / Driver" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {displayedDrivers.length > 0 && (
                      <div className="px-2 py-1 text-[10px] font-bold uppercase text-primary bg-primary/10 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Truck className="w-3 h-3 text-primary" /> Company Drivers {showOnlyPresentDrivers ? '(Present Today)' : ''}
                        </span>
                        <span className="text-[9px] font-semibold opacity-75">{displayedDrivers.length} Available</span>
                      </div>
                    )}
                    {displayedDrivers.map(d => {
                      const isPresent = isStaffPresentToday(d.id);
                      return (
                        <SelectItem key={d.id} value={d.id}>
                          🚚 {d.name} ({d.phone || 'Driver'}) {d.perDaySalary ? `· ₹${d.perDaySalary}/day` : ''} {isPresent ? '✓ (Present)' : ''}
                        </SelectItem>
                      );
                    })}

                    {displayedDrivers.length === 0 && (
                      <div className="p-2.5 text-center text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded-lg m-1">
                        No drivers marked present today ({todayStr}). Uncheck "Only Present Drivers" to view all.
                      </div>
                    )}

                    {displayedOtherStaff.length > 0 && (
                      <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground bg-muted/40 mt-1">
                        Other Site Staff / Supervisors {showOnlyPresentDrivers ? '(Present Today)' : ''}
                      </div>
                    )}
                    {displayedOtherStaff.map(s => {
                      const isPresent = isStaffPresentToday(s.id);
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          👤 {s.name} ({s.role}) {isPresent ? '✓ (Present)' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}

              {presentDrivers.length > 0 ? (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  Showing {presentDrivers.length} driver(s) verified present on duty today.
                </p>
              ) : (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  No drivers marked Present in Team Attendance for today ({todayStr}).
                </p>
              )}
            </div>

            {/* Vehicle Selection */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-primary" /> Select Dispatch Fleet Vehicle *
              </Label>
              <Select value={selectedVehicleId} onValueChange={handleSelectVehicle}>
                <SelectTrigger className="mt-1 h-11 rounded-xl">
                  <SelectValue placeholder="Select Vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      🚗 {v.name} ({v.type}) — {v.number}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">✏️ Enter Other / Custom Vehicle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedVehicleId === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <Label className="text-[10px] font-semibold text-muted-foreground">Vehicle Type</Label>
                  <Select value={assignVehicleType} onValueChange={setAssignVehicleType}>
                    <SelectTrigger className="mt-1 h-9 rounded-lg text-xs">
                      <SelectValue placeholder="Vehicle Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map(vt => (
                        <SelectItem key={vt} value={vt}>
                          {vt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-semibold text-muted-foreground">Vehicle Reg. Number</Label>
                  <Input
                    placeholder="e.g. TN 38 P 1024"
                    value={assignVehicleNumber}
                    onChange={e => setAssignVehicleNumber(e.target.value)}
                    className="mt-1 h-9 rounded-lg text-xs font-semibold"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" /> Departure / Start Time *
                </Label>
                <button
                  type="button"
                  onClick={() => setAssignStartTime(format(new Date(), 'hh:mm a'))}
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  ⚡ Set Current Time ({format(new Date(), 'hh:mm a')})
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  type="text"
                  placeholder="e.g. 10:30 AM"
                  value={assignStartTime}
                  onChange={e => setAssignStartTime(e.target.value)}
                  className="h-11 rounded-xl text-xs font-bold font-mono pl-3"
                />
                <Select
                  value={TIME_SELECT_OPTIONS.includes(formatTimeString(assignStartTime)) ? formatTimeString(assignStartTime) : ''}
                  onValueChange={val => setAssignStartTime(val)}
                >
                  <SelectTrigger className="h-11 rounded-xl text-xs">
                    <SelectValue placeholder="Preset Times (or type custom)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56 z-[300]">
                    {TIME_SELECT_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Dispatched at: <strong className="text-foreground font-mono">{assignStartTime || 'Not set'}</strong>. You can type any custom minute or choose a preset slot.
              </p>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              STEP 2: SUPPLIER DETAILS & ITEM PRICING (SHOWN ONCE DRIVER IS SELECTED)
          ══════════════════════════════════════════════════════════════════ */}
          {!assignStaffId ? (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Step 1 Required: Choose Driver / Staff Member First</span>
              </div>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 pl-5">
                Once the driver or staff member is assigned above, supplier details, product item rates, and payment tracking will appear here.
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-card rounded-2xl border border-amber-500/20 space-y-3 shadow-xs animate-slide-up">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> 2. Supplier Details & Billing (Based on Product)
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  {requestedProducts.length} Product{requestedProducts.length !== 1 ? 's' : ''} Requested
                </span>
              </div>

              {isInterSite ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <ArrowRightLeft className="w-4 h-4" /> Inter-Site Material Transfer
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Materials are being sourced directly from{' '}
                    <strong className="text-foreground">{request.sourceSiteName || 'Site'}</strong>.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Product Chips */}
                  <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-xl border border-border/40">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 mr-1">
                      <Package className="w-3 h-3 text-primary" /> Products:
                    </span>
                    {requestedProducts.map((it, idx) => (
                      <span key={idx} className="bg-background px-2 py-0.5 rounded-md border border-border/60 text-xs font-bold text-foreground">
                        {it.name} <span className="text-primary font-mono">({it.quantity} {it.unit})</span>
                      </span>
                    ))}
                  </div>

                  {/* Supplier Dropdown with Product Matching */}
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-amber-500" /> Choose Supplier Providing This Product *
                    </Label>
                    {suppliers.length === 0 ? (
                      <div className="p-3 bg-destructive/10 border border-destructive/25 rounded-xl text-xs text-destructive mt-1">
                        No suppliers registered. Add suppliers in the Suppliers tab first.
                      </div>
                    ) : (
                      <Select value={assignSupplierId} onValueChange={setAssignSupplierId}>
                        <SelectTrigger className="mt-1 h-11 rounded-xl font-semibold">
                          <SelectValue placeholder="Select Matching Supplier" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {matchingSuppliers.length > 0 && (
                            <div className="px-2 py-1 text-[10px] font-bold uppercase text-emerald-600 bg-emerald-500/10 flex items-center gap-1">
                              <Star className="w-3 h-3 text-emerald-600" /> Recommended Suppliers For This Product
                            </div>
                          )}
                          {matchingSuppliers.map(s => {
                            const mats = s.suppliedMaterials && s.suppliedMaterials.length > 0
                              ? s.suppliedMaterials.join(', ')
                              : (typeof s.materialsSupplied === 'string' ? s.materialsSupplied : '');
                            return (
                              <SelectItem key={s.id} value={s.id}>
                                ⭐ {s.name} {mats ? `(Supplies: ${mats})` : ''}
                              </SelectItem>
                            );
                          })}

                          {otherSuppliers.length > 0 && (
                            <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground bg-muted/40 mt-1">
                              Other Registered Suppliers
                            </div>
                          )}
                          {otherSuppliers.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              🏢 {s.name} ({s.phone || 'No phone'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Selected Supplier Details Preview */}
                  {currentSelectedSupplier && (
                    <div className="p-2.5 bg-muted/40 rounded-xl border border-border/50 text-xs space-y-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-foreground text-xs">{currentSelectedSupplier.name}</strong>
                          <p className="text-[11px] text-muted-foreground">
                            📞 {currentSelectedSupplier.phone || 'No phone on file'}
                            {currentSelectedSupplier.address && ` · 📍 ${currentSelectedSupplier.address}`}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          Selected Supplier
                        </span>
                      </div>
                      {currentSelectedSupplier.suppliedMaterials && currentSelectedSupplier.suppliedMaterials.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          <span className="text-[10px] text-muted-foreground">Cataloged Materials:</span>
                          {currentSelectedSupplier.suppliedMaterials.map((m, i) => (
                            <span key={i} className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Requested Materials List (Read-Only) */}
                  <div className="space-y-2.5 pt-2 border-t border-border/40">
                    <div>
                      <span className="text-xs font-bold text-foreground block flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-primary" /> Requested Materials
                      </span>
                      <span className="text-[10px] text-muted-foreground">Quantities and rates will be confirmed upon completion of the delivery.</span>
                    </div>

                    <div className="space-y-2">
                      {requestedProducts.length > 0 ? (
                        requestedProducts.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-muted/40 rounded-xl border border-border/50 text-xs shadow-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-foreground">{it.name}</span>
                            </div>
                            <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                              {it.quantity} {it.unit || 'Unit'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 bg-muted/30 rounded-xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                          No specific materials requested.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={!assignStaffId || allStaff.length === 0 || (!isInterSite && suppliers.length === 0)}
            className="w-full h-11 rounded-xl text-white font-semibold text-sm gap-2 shadow-sm"
            style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
          >
            <Truck className="w-4 h-4" />{' '}
            {request?.driverId || request?.driverName
              ? 'Confirm Reassignment & Save Changes'
              : (isInterSite ? 'Confirm & Dispatch Inter-Site Transfer' : 'Confirm Staff Assignment & Supplier Dispatch')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export interface CompleteMaterialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: MaterialRequest | null;
  materialSettings?: MaterialSetting[];
  staffList?: Staff[];
  onComplete: (
    id: string,
    completion: {
      startTime?: string;
      endTime: string;
      completionTime?: string;
      duration?: string;
      durationHours?: number;
      driverWage?: number;
      driverHourlyRate?: number;
      items?: MaterialRequestItem[];
      gstType?: 'none' | 'igst' | 'cgst_sgst';
      igstRate?: number;
      cgstRate?: number;
      sgstRate?: number;
      cgstAmount?: number;
      sgstAmount?: number;
      igstAmount?: number;
      gstAmount?: number;
      materialCost?: number;
      supplierMaterialCost?: number;
      supplierPrice?: number;
      clientMaterialCost?: number;
      customerMaterialCost?: number;
      totalCost?: number;
      clientTotalCost?: number;
      customerTotalCost?: number;
      petrolCharge: number;
      completionNotes?: string;
    }
  ) => void;
}

export const CompleteMaterialModal = ({
  open,
  onOpenChange,
  request,
  materialSettings = [],
  staffList = [],
  onComplete
}: CompleteMaterialModalProps) => {
  const [compPetrol, setCompPetrol] = useState('');
  const [compNotes, setCompNotes] = useState('');
  const [compItems, setCompItems] = useState<MaterialRequestItem[]>([]);

  const isAlreadyCompleted = request?.status === 'completed';

  const calcTaxes = (
    baseAmt: number,
    gType: 'none' | 'igst' | 'cgst_sgst',
    cgstRateVal: any,
    sgstRateVal: any,
    igstRateVal: any
  ) => {
    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;
    let totalGstAmt = 0;
    let totalRate = 0;

    const cRate = Number(cgstRateVal) || 0;
    const sRate = Number(sgstRateVal) || 0;
    const iRate = Number(igstRateVal) || 0;

    if (gType === 'cgst_sgst') {
      cgstAmt = Math.round((baseAmt * cRate / 100) * 100) / 100;
      sgstAmt = Math.round((baseAmt * sRate / 100) * 100) / 100;
      totalGstAmt = Math.round((cgstAmt + sgstAmt) * 100) / 100;
      totalRate = cRate + sRate;
    } else if (gType === 'igst') {
      igstAmt = Math.round((baseAmt * iRate / 100) * 100) / 100;
      totalGstAmt = igstAmt;
      totalRate = iRate;
    }

    return {
      gstType: gType,
      cgstRate: cgstRateVal,
      sgstRate: sgstRateVal,
      igstRate: igstRateVal,
      cgstAmount: cgstAmt,
      sgstAmount: sgstAmt,
      igstAmount: igstAmt,
      gstAmount: totalGstAmt,
      gstRate: totalRate,
      totalWithGst: Math.round((baseAmt + totalGstAmt) * 100) / 100
    };
  };

  useEffect(() => {
    if (!request || !open) return;
    setCompPetrol(request.petrolCharge !== undefined && request.petrolCharge !== null ? request.petrolCharge.toString() : '');
    setCompNotes(request.completionNotes || '');

    const initialItems = (request.items || []).map(it => {
      let supRate = it.supplierRate !== undefined ? it.supplierRate : it.rate;
      if (supRate === undefined) supRate = 0;
      const clientRate = it.clientRate !== undefined ? it.clientRate : supRate;
      const customerRate = it.customerRate !== undefined ? it.customerRate : supRate;
      const q = Number(it.quantity) || 0;
      const r = Number(supRate) || 0;
      const baseAmt = Math.round(r * q * 100) / 100;

      let itemGstType: 'none' | 'igst' | 'cgst_sgst' = it.gstType || 'none';
      let itemCgstRate: any = it.cgstRate !== undefined ? it.cgstRate : (it.gstRate ? it.gstRate / 2 : 9);
      let itemSgstRate: any = it.sgstRate !== undefined ? it.sgstRate : (it.gstRate ? it.gstRate / 2 : 9);
      let itemIgstRate: any = it.igstRate !== undefined ? it.igstRate : (it.gstRate || 18);

      if (!it.gstType && request.gstType && request.gstType !== 'none') {
        itemGstType = request.gstType;
        if (request.gstType === 'igst') {
          itemIgstRate = request.igstRate || 18;
        } else if (request.gstType === 'cgst_sgst') {
          itemCgstRate = request.cgstRate !== undefined ? request.cgstRate : (request.gstAmount ? (request.cgstRate || 9) : 9);
          itemSgstRate = request.sgstRate !== undefined ? request.sgstRate : (request.gstAmount ? (request.sgstRate || 9) : 9);
        }
      }

      const taxObj = calcTaxes(baseAmt, itemGstType, itemCgstRate, itemSgstRate, itemIgstRate);

      return {
        ...it,
        rate: r,
        supplierRate: supRate,
        amount: baseAmt,
        supplierAmount: baseAmt,
        clientRate: Number(clientRate) || 0,
        clientAmount: baseAmt,
        customerRate: Number(customerRate) || 0,
        customerAmount: baseAmt,
        ...taxObj
      };
    });
    setCompItems(initialItems);
  }, [request, open]);

  const handleItemSupplierRateChange = (index: number, val: string) => {
    setCompItems(prev => {
      const copy = [...prev];
      const it = copy[index];
      const numRate = val === '' ? 0 : Number(val);
      const qty = Number(it.quantity) || 0;
      const baseAmt = Math.round(numRate * qty * 100) / 100;
      const taxObj = calcTaxes(baseAmt, it.gstType || 'none', it.cgstRate ?? 9, it.sgstRate ?? 9, it.igstRate ?? 18);
      copy[index] = {
        ...it,
        rate: numRate,
        supplierRate: val as any,
        amount: baseAmt,
        supplierAmount: baseAmt,
        clientRate: numRate,
        customerRate: numRate,
        clientAmount: baseAmt,
        customerAmount: baseAmt,
        ...taxObj
      };
      return copy;
    });
  };

  const handleItemQtyChange = (index: number, val: string) => {
    setCompItems(prev => {
      const copy = [...prev];
      const it = copy[index];
      const numQty = val === '' ? 0 : Number(val);
      const sRate = Number(it.supplierRate ?? it.rate ?? 0);
      const baseAmt = Math.round(sRate * numQty * 100) / 100;
      const taxObj = calcTaxes(baseAmt, it.gstType || 'none', it.cgstRate ?? 9, it.sgstRate ?? 9, it.igstRate ?? 18);
      copy[index] = {
        ...it,
        quantity: val as any,
        supplierAmount: baseAmt,
        amount: baseAmt,
        clientRate: sRate,
        customerRate: sRate,
        clientAmount: baseAmt,
        customerAmount: baseAmt,
        ...taxObj
      };
      return copy;
    });
  };

  const handleItemGstTypeChange = (index: number, newType: 'none' | 'igst' | 'cgst_sgst') => {
    setCompItems(prev => {
      const copy = [...prev];
      const it = copy[index];
      const baseAmt = Number(it.supplierAmount) || ((Number(it.supplierRate) || Number(it.rate) || 0) * (Number(it.quantity) || 0));
      const cRate = newType === 'cgst_sgst' ? (it.cgstRate ?? 9) : 0;
      const sRate = newType === 'cgst_sgst' ? (it.sgstRate ?? 9) : 0;
      const iRate = newType === 'igst' ? (it.igstRate ?? 18) : 0;
      const taxObj = calcTaxes(baseAmt, newType, cRate, sRate, iRate);
      copy[index] = {
        ...it,
        ...taxObj
      };
      return copy;
    });
  };

  const handleItemCgstRateChange = (index: number, val: string) => {
    setCompItems(prev => {
      const copy = [...prev];
      const it = copy[index];
      const baseAmt = Number(it.supplierAmount) || ((Number(it.supplierRate) || Number(it.rate) || 0) * (Number(it.quantity) || 0));
      const sRate = it.sgstRate !== undefined ? it.sgstRate : (val === '' ? 0 : val as any);
      const taxObj = calcTaxes(baseAmt, 'cgst_sgst', val, sRate, it.igstRate ?? 18);
      copy[index] = {
        ...it,
        ...taxObj
      };
      return copy;
    });
  };

  const handleItemSgstRateChange = (index: number, val: string) => {
    setCompItems(prev => {
      const copy = [...prev];
      const it = copy[index];
      const baseAmt = Number(it.supplierAmount) || ((Number(it.supplierRate) || Number(it.rate) || 0) * (Number(it.quantity) || 0));
      const cRate = it.cgstRate !== undefined ? it.cgstRate : (val === '' ? 0 : val as any);
      const taxObj = calcTaxes(baseAmt, 'cgst_sgst', cRate, val, it.igstRate ?? 18);
      copy[index] = {
        ...it,
        ...taxObj
      };
      return copy;
    });
  };

  const handleItemIgstRateChange = (index: number, val: string) => {
    setCompItems(prev => {
      const copy = [...prev];
      const it = copy[index];
      const baseAmt = Number(it.supplierAmount) || ((Number(it.supplierRate) || Number(it.rate) || 0) * (Number(it.quantity) || 0));
      const taxObj = calcTaxes(baseAmt, 'igst', it.cgstRate ?? 9, it.sgstRate ?? 9, val);
      copy[index] = {
        ...it,
        ...taxObj
      };
      return copy;
    });
  };

  const applyGstPresetToItem = (index: number, totalRate: number) => {
    setCompItems(prev => {
      const copy = [...prev];
      const it = copy[index];
      const baseAmt = Number(it.supplierAmount) || ((Number(it.supplierRate) || Number(it.rate) || 0) * (Number(it.quantity) || 0));
      if (totalRate === 0) {
        const taxObj = calcTaxes(baseAmt, 'none', 0, 0, 0);
        copy[index] = { ...it, ...taxObj };
      } else if (it.gstType === 'igst') {
        const taxObj = calcTaxes(baseAmt, 'igst', totalRate / 2, totalRate / 2, totalRate);
        copy[index] = { ...it, ...taxObj };
      } else {
        const halfRate = totalRate / 2;
        const taxObj = calcTaxes(baseAmt, 'cgst_sgst', halfRate, halfRate, totalRate);
        copy[index] = { ...it, ...taxObj };
      }
      return copy;
    });
  };

  const applyGstToAllProducts = (totalRate: number) => {
    setCompItems(prev => prev.map(it => {
      const baseAmt = Number(it.supplierAmount) || ((Number(it.supplierRate) || Number(it.rate) || 0) * (Number(it.quantity) || 0));
      if (totalRate === 0) {
        return { ...it, ...calcTaxes(baseAmt, 'none', 0, 0, 0) };
      } else if (it.gstType === 'igst') {
        return { ...it, ...calcTaxes(baseAmt, 'igst', totalRate / 2, totalRate / 2, totalRate) };
      } else {
        const halfRate = totalRate / 2;
        return { ...it, ...calcTaxes(baseAmt, 'cgst_sgst', halfRate, halfRate, totalRate) };
      }
    }));
    toast.success(
      totalRate === 0
        ? 'Tax set to 0% (Exempt) for all products'
        : `${totalRate}% GST applied (CGST ${totalRate / 2}% + SGST ${totalRate / 2}%) to all products`
    );
  };

  // 1. Supplier Material Purchase Base Total
  const baseSupplierMatTotal = compItems.reduce(
    (sum, it) => sum + (Number(it.supplierAmount) || ((Number(it.supplierRate) || Number(it.rate) || 0) * (Number(it.quantity) || 0))),
    0
  );

  // 2. Separate CGST, SGST, IGST Totals
  const totalCgstAmount = compItems.reduce(
    (sum, it) => sum + (it.gstType === 'cgst_sgst' ? (Number(it.cgstAmount) || 0) : 0),
    0
  );
  const totalSgstAmount = compItems.reduce(
    (sum, it) => sum + (it.gstType === 'cgst_sgst' ? (Number(it.sgstAmount) || 0) : 0),
    0
  );
  const totalIgstAmount = compItems.reduce(
    (sum, it) => sum + (it.gstType === 'igst' ? (Number(it.igstAmount) || 0) : 0),
    0
  );
  const totalGstAmount = totalCgstAmount + totalSgstAmount + totalIgstAmount;

  const supplierMatTotal = baseSupplierMatTotal + totalGstAmount;
  const clientMatTotal = supplierMatTotal;
  const customerMatTotal = supplierMatTotal;

  const petTotal = Number(compPetrol) || 0;

  // Single unified grand total (Logistics cost) added to site - Exclude Petrol Charge as per requirement
  const clientGrandTotal = supplierMatTotal;
  const customerGrandTotal = supplierMatTotal;

  const handleConfirmComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;

    const finalItems = compItems.map(it => {
      const q = Number(it.quantity) || 0;
      const r = Number(it.supplierRate ?? it.rate ?? 0);
      const c = Number(it.clientRate ?? r);
      const baseAmt = Math.round(r * q * 100) / 100;
      const gType = it.gstType || 'none';
      const cRate = Number(it.cgstRate) || 0;
      const sRate = Number(it.sgstRate) || 0;
      const iRate = Number(it.igstRate) || 0;
      const taxObj = calcTaxes(baseAmt, gType, cRate, sRate, iRate);

      return {
        ...it,
        quantity: q,
        rate: r,
        supplierRate: r,
        amount: baseAmt,
        supplierAmount: baseAmt,
        clientRate: c,
        customerRate: c,
        clientAmount: baseAmt,
        customerAmount: baseAmt,
        ...taxObj
      };
    });

    const hasIgst = finalItems.some(i => i.gstType === 'igst' && (i.gstAmount || 0) > 0);
    const hasCgstSgst = finalItems.some(i => i.gstType === 'cgst_sgst' && (i.gstAmount || 0) > 0);
    const effectiveGstType = hasIgst ? 'igst' : (hasCgstSgst ? 'cgst_sgst' : 'none');

    onComplete(request.id, {
      startTime: undefined,
      endTime: undefined,
      completionTime: undefined,
      duration: undefined,
      durationHours: undefined,
      driverWage: 0,
      driverHourlyRate: 0,
      items: finalItems,
      gstType: effectiveGstType,
      cgstAmount: totalCgstAmount,
      sgstAmount: totalSgstAmount,
      igstAmount: totalIgstAmount,
      gstAmount: totalGstAmount,
      materialCost: supplierMatTotal,
      supplierMaterialCost: supplierMatTotal,
      supplierPrice: supplierMatTotal,
      clientMaterialCost: clientMatTotal,
      customerMaterialCost: customerMatTotal,
      totalCost: clientGrandTotal,
      clientTotalCost: clientGrandTotal,
      customerTotalCost: customerGrandTotal,
      petrolCharge: petTotal,
      completionNotes: compNotes.trim() || undefined
    });

    toast.success(isAlreadyCompleted ? 'Delivery rates & product taxes updated!' : 'Delivery completed & pricing recorded!');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto border border-border/80 shadow-2xl backdrop-blur-md">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="text-lg font-heading font-black flex items-center gap-2.5 text-foreground">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shadow-xs">
                {isAlreadyCompleted ? <PenLine className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </span>
              {isAlreadyCompleted ? 'Edit Delivery Rates, Product Taxes & Billing' : 'Complete Delivery & Finalize Billing'}
            </DialogTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2 pt-1 text-xs">
            <span className="px-2.5 py-1 rounded-xl bg-primary/10 text-primary font-semibold flex items-center gap-1.5 border border-primary/20">
              <Building2 className="w-3.5 h-3.5" /> Site: <strong className="text-foreground">{request?.siteName}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5 border border-blue-500/20">
              <Truck className="w-3.5 h-3.5" /> Driver: <strong className="text-foreground">{request?.driverName || 'Assigned Driver'}</strong>
            </span>
            {request?.supplierName && (
              <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1.5 border border-amber-500/20">
                <Package className="w-3.5 h-3.5" /> Source: <strong className="text-foreground">{request.supplierName}</strong>
              </span>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleConfirmComplete} className="space-y-4 mt-3">
          {/* Rate Clarification Banner */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span>Product Pricing & Separate CGST / SGST Rates</span>
            </div>
            <div className="pt-1 text-[11px] text-muted-foreground">
              Admin can set purchase rates and customize CGST (%) and SGST (%) separately for each product item.
            </div>
          </div>

          {/* Materials Breakdown */}
          <div className="space-y-3 bg-muted/20 p-4 rounded-2xl border border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <Label className="text-xs font-black text-foreground uppercase tracking-wider">
                  Delivered Products & Taxes
                </Label>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground">
                  {compItems.length} {compItems.length === 1 ? 'product' : 'products'}
                </span>
              </div>

              {/* Quick Batch GST Setter */}
              <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border/60">
                <span className="text-[10px] font-bold text-muted-foreground pl-1.5 pr-1">All:</span>
                {[
                  { total: 0, label: '0%' },
                  { total: 5, label: '5% (2.5+2.5)' },
                  { total: 12, label: '12% (6+6)' },
                  { total: 18, label: '18% (9+9)' },
                  { total: 28, label: '28% (14+14)' }
                ].map(p => (
                  <button
                    key={p.total}
                    type="button"
                    onClick={() => applyGstToAllProducts(p.total)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-muted/80 hover:bg-primary hover:text-white transition-all text-foreground"
                    title={`Apply ${p.total}% GST to all products`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
              {compItems.map((item, idx) => {
                const sRate = Number(item.supplierRate ?? item.rate ?? 0);
                const sBaseTotal = Number(item.supplierAmount) || sRate * (Number(item.quantity) || 0);
                const sCgstAmt = Number(item.cgstAmount) || 0;
                const sSgstAmt = Number(item.sgstAmount) || 0;
                const sIgstAmt = Number(item.igstAmount) || 0;
                const sGstAmt = Number(item.gstAmount) || 0;
                const sTotalWithGst = sBaseTotal + sGstAmt;

                return (
                  <div key={idx} className="bg-card p-4 rounded-2xl border border-border/70 space-y-3 text-xs shadow-xs hover:border-primary/40 transition-all">
                    {/* Product Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </span>
                        <span className="text-foreground font-bold text-sm tracking-tight">{item.name}</span>
                        <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold">
                          Unit: {item.unit || 'Unit'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                        <span className="px-2 py-0.5 rounded-lg bg-muted text-foreground font-semibold">
                          Base: ₹{sBaseTotal.toLocaleString()}
                        </span>
                        {item.gstType === 'cgst_sgst' && (sCgstAmt > 0 || sSgstAmt > 0) && (
                          <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold border border-blue-500/20">
                            CGST {item.cgstRate}% (₹{sCgstAmt}) + SGST {item.sgstRate}% (₹{sSgstAmt})
                          </span>
                        )}
                        {item.gstType === 'igst' && sIgstAmt > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-400 font-bold border border-purple-500/20">
                            IGST {item.igstRate}% (₹{sIgstAmt})
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-black">
                          Total: ₹{sTotalWithGst.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Qty & Rate Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                      <div>
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Delivered Qty ({item.unit || 'Unit'}) *
                        </Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.quantity !== undefined && item.quantity !== null ? item.quantity : ''}
                          onChange={e => handleItemQtyChange(idx, e.target.value)}
                          className="h-9 rounded-xl text-xs font-bold"
                        />
                      </div>

                      <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/25 space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                            📦 Purchase Rate (₹) *
                          </Label>
                          <span className="text-[9px] font-mono text-muted-foreground">
                            per {item.unit || 'unit'}
                          </span>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={item.supplierRate !== undefined && item.supplierRate !== null ? item.supplierRate : ''}
                          placeholder="0"
                          onChange={e => handleItemSupplierRateChange(idx, e.target.value)}
                          className="h-8 rounded-lg text-xs font-bold border-emerald-500/30 focus-visible:ring-emerald-500/40"
                        />
                      </div>
                    </div>

                    {/* Product Specific Tax & GST Section with Separate CGST & SGST */}
                    <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                          <IndianRupee className="w-3.5 h-3.5 text-primary" /> Taxes & GST for {item.name}:
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] text-muted-foreground mr-0.5">Presets:</span>
                          {[
                            { total: 0, label: '0% (Exempt)' },
                            { total: 5, label: '5% (2.5+2.5)' },
                            { total: 12, label: '12% (6+6)' },
                            { total: 18, label: '18% (9+9)' },
                            { total: 28, label: '28% (14+14)' }
                          ].map(p => {
                            const isCurr = (p.total === 0 && item.gstType === 'none') ||
                              (item.gstType !== 'none' && Math.round(Number(item.gstRate) || 0) === p.total);
                            return (
                              <button
                                key={p.total}
                                type="button"
                                onClick={() => applyGstPresetToItem(idx, p.total)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${
                                  isCurr
                                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                                    : 'bg-card text-muted-foreground hover:text-foreground border-border/60 hover:bg-muted/60'
                                }`}
                              >
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                        {/* GST Type Selector */}
                        <div className="sm:col-span-4">
                          <Label className="text-[9px] font-semibold text-muted-foreground uppercase">GST Type</Label>
                          <Select
                            value={item.gstType || 'none'}
                            onValueChange={(v: 'none' | 'igst' | 'cgst_sgst') => handleItemGstTypeChange(idx, v)}
                          >
                            <SelectTrigger className="mt-1 h-8 rounded-lg text-xs font-semibold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No GST (0% / Exempt)</SelectItem>
                              <SelectItem value="cgst_sgst">CGST + SGST (Separate Intra-State)</SelectItem>
                              <SelectItem value="igst">IGST (Inter-State)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Separate CGST and SGST Inputs */}
                        {item.gstType === 'cgst_sgst' && (
                          <>
                            <div className="sm:col-span-2">
                              <Label className="text-[9px] font-bold text-primary uppercase">
                                CGST (%)
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={item.cgstRate !== undefined && item.cgstRate !== null ? item.cgstRate : ''}
                                placeholder="9"
                                onChange={e => handleItemCgstRateChange(idx, e.target.value)}
                                className="mt-1 h-8 rounded-lg text-xs font-bold"
                              />
                              <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">
                                ₹{(item.cgstAmount || 0).toLocaleString()}
                              </span>
                            </div>

                            <div className="sm:col-span-2">
                              <Label className="text-[9px] font-bold text-primary uppercase">
                                SGST (%)
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={item.sgstRate !== undefined && item.sgstRate !== null ? item.sgstRate : ''}
                                placeholder="9"
                                onChange={e => handleItemSgstRateChange(idx, e.target.value)}
                                className="mt-1 h-8 rounded-lg text-xs font-bold"
                              />
                              <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">
                                ₹{(item.sgstAmount || 0).toLocaleString()}
                              </span>
                            </div>

                            <div className="sm:col-span-4 p-2 rounded-lg bg-card border border-border/50 text-right space-y-0.5">
                              <div className="text-[10px] text-muted-foreground flex justify-between">
                                <span>CGST ({item.cgstRate}%):</span>
                                <span className="font-mono font-semibold">₹{(item.cgstAmount || 0).toLocaleString()}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground flex justify-between">
                                <span>SGST ({item.sgstRate}%):</span>
                                <span className="font-mono font-semibold">₹{(item.sgstAmount || 0).toLocaleString()}</span>
                              </div>
                              <div className="border-t border-border/40 pt-0.5 text-xs font-mono font-bold text-primary flex justify-between">
                                <span>Total Tax:</span>
                                <span>+₹{(item.gstAmount || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </>
                        )}

                        {/* IGST Input */}
                        {item.gstType === 'igst' && (
                          <>
                            <div className="sm:col-span-4">
                              <Label className="text-[9px] font-bold text-primary uppercase">
                                IGST Rate (%)
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={item.igstRate !== undefined && item.igstRate !== null ? item.igstRate : ''}
                                placeholder="18"
                                onChange={e => handleItemIgstRateChange(idx, e.target.value)}
                                className="mt-1 h-8 rounded-lg text-xs font-bold"
                              />
                              <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">
                                ₹{(item.igstAmount || 0).toLocaleString()}
                              </span>
                            </div>

                            <div className="sm:col-span-4 p-2 rounded-lg bg-card border border-border/50 text-right space-y-0.5">
                              <div className="text-[10px] text-muted-foreground flex justify-between">
                                <span>IGST ({item.igstRate}%):</span>
                                <span className="font-mono font-semibold">₹{(item.igstAmount || 0).toLocaleString()}</span>
                              </div>
                              <div className="border-t border-border/40 pt-0.5 text-xs font-mono font-bold text-primary flex justify-between">
                                <span>Total Tax:</span>
                                <span>+₹{(item.gstAmount || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Exempt */}
                        {(!item.gstType || item.gstType === 'none') && (
                          <div className="sm:col-span-8 p-2 rounded-lg bg-card/60 border border-dashed border-border/60 text-xs text-muted-foreground italic flex items-center justify-between">
                            <span>Tax Exempt (0%) — No CGST or SGST applied</span>
                            <span className="font-mono font-bold text-foreground">₹0.00</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Materials Badges with Separate CGST and SGST */}
            <div className="grid grid-cols-1 pt-2 border-t border-border/40 text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div>
                  <span className="font-bold text-[10px] text-emerald-700 dark:text-emerald-300 uppercase tracking-wide block">
                    📦 Total Material Cost (All Products + Taxes):
                  </span>
                  <div className="text-[10px] text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono">
                    <span>Base Subtotal: <strong className="text-foreground">₹{baseSupplierMatTotal.toLocaleString()}</strong></span>
                    {totalCgstAmount > 0 && (
                      <span className="text-blue-600 dark:text-blue-400">Total CGST: <strong>₹{totalCgstAmount.toLocaleString()}</strong></span>
                    )}
                    {totalSgstAmount > 0 && (
                      <span className="text-indigo-600 dark:text-indigo-400">Total SGST: <strong>₹{totalSgstAmount.toLocaleString()}</strong></span>
                    )}
                    {totalIgstAmount > 0 && (
                      <span className="text-purple-600 dark:text-purple-400">Total IGST: <strong>₹{totalIgstAmount.toLocaleString()}</strong></span>
                    )}
                    {totalGstAmount > 0 && (
                      <span className="text-primary font-bold">Total GST: <strong>₹{totalGstAmount.toLocaleString()}</strong></span>
                    )}
                  </div>
                </div>
                <span className="font-black text-sm text-emerald-700 dark:text-emerald-400 font-mono">
                  ₹{supplierMatTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Transit Expenses (Optional) */}
          <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <IndianRupee className="w-3.5 h-3.5" />
              </div>
              <Label className="text-xs font-black text-foreground uppercase tracking-wider">
                Vehicle Transit Fuel / Petrol (Optional)
              </Label>
            </div>

            {/* Petrol Allowance Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-muted-foreground" /> Petrol Allowance (₹)
                </Label>
                <span className="text-[10px] text-muted-foreground italic">
                  Company / Fleet record — Not included in site expense
                </span>
              </div>
              <Input
                type="number"
                placeholder="e.g. 450"
                value={compPetrol}
                onChange={e => setCompPetrol(e.target.value)}
                className="mt-1 h-10 rounded-xl text-sm font-bold"
              />
            </div>
          </div>

          {/* Final Delivery Cost Summary */}
          <div className="p-4 bg-card border border-border/80 rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-black text-foreground uppercase tracking-wider">
                  Final Delivery Cost Summary
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-semibold">
                Materials & Taxes Added to Site
              </span>
            </div>

            <div className="space-y-2 p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/25 shadow-2xs">
              <div className="space-y-1.5 text-muted-foreground text-[11px]">
                <div className="flex justify-between items-center pb-1 border-b border-border/40">
                  <span className="font-semibold">Material Base Subtotal ({compItems.length} products):</span>
                  <span className="font-bold text-foreground font-mono">₹{baseSupplierMatTotal.toLocaleString()}</span>
                </div>
                
                {totalGstAmount > 0 && (
                  <div className="flex justify-between items-center text-primary pb-1 border-b border-border/40">
                    <span className="font-semibold">
                      Total Taxes (Product GST): 
                    </span>
                    <span className="font-bold font-mono">₹{totalGstAmount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-1 pb-1 border-b border-border/40">
                  <span className="font-semibold">Total Materials Bill (Base + GST):</span>
                  <span className="font-bold text-foreground font-mono">₹{supplierMatTotal.toLocaleString()}</span>
                </div>

                {petTotal > 0 && (
                  <div className="flex justify-between items-center text-muted-foreground pt-1 text-[10px] italic">
                    <span>Petrol Allowance (Fleet expense · Not added to site):</span>
                    <span className="font-mono font-semibold">₹{petTotal.toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center font-black pt-3 mt-1 border-t border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-sm">
                <span className="uppercase tracking-wider">Grand Total Added to Site:</span>
                <span className="text-base font-black font-mono tracking-tight">₹{clientGrandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Completion Remarks (Optional)</Label>
            <Textarea
              placeholder="e.g. Delivered to site supervisor, signed invoice received, materials inspected..."
              value={compNotes}
              onChange={e => setCompNotes(e.target.value)}
              className="mt-1 min-h-[60px] rounded-xl text-xs"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-2xl text-white font-bold text-sm gap-2 shadow-md hover:shadow-lg transition-all"
            style={{ background: 'linear-gradient(135deg, hsl(142 71% 36%), hsl(158 64% 40%))' }}
          >
            {isAlreadyCompleted ? (
              <>
                <PenLine className="w-4 h-4" /> Update Delivery Rates & GST
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Save Delivery & Finalize Billing Rates
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
