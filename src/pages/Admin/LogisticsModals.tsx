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

  const calculatedTotalBill = useMemo(() => {
    return editItems.reduce(
      (sum, it) => sum + (Number(it.amount) || (Number(it.quantity) || 1) * (Number(it.rate) || 0)),
      0
    );
  }, [editItems]);

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

    // 1. Initial Staff (prefer assigned staff/driver, or first driver, or first staff)
    const initialStaffId = request.driverId || allDrivers[0]?.id || allStaff[0]?.id || '';
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

    const calculatedItemsTotal = initialItems.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    const defaultPrice = request.supplierPrice ?? (calculatedItemsTotal > 0 ? calculatedItemsTotal : (request.materialCost ?? 0));
    setAssignSupplierPrice(defaultPrice > 0 ? defaultPrice.toString() : '');
    setAssignSupplierPaidAmount(request.supplierPaidAmount ? request.supplierPaidAmount.toString() : '');
    setAssignPaymentMethod((request.supplierPaymentMethod as any) || 'UPI / GPay');
    setAssignPaymentDate(request.supplierPaymentDate || format(new Date(), 'yyyy-MM-dd'));
    setAssignPaymentNotes(request.supplierPaymentNotes || '');

    // 4. Prefill vehicle
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

    const calculatedTotalBill = editItems.reduce(
      (sum, it) => sum + (Number(it.amount) || (Number(it.quantity) || 1) * (Number(it.rate) || 0)),
      0
    );

    const finalBillPrice = calculatedTotalBill > 0
      ? calculatedTotalBill
      : (Number(assignSupplierPrice) || 0);

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
      materialCost: finalBillPrice > 0 ? finalBillPrice : undefined,
      supplierMaterialCost: finalBillPrice > 0 ? finalBillPrice : undefined,
      supplierPrice: finalBillPrice > 0 ? finalBillPrice : undefined,
      supplierPaidAmount: existingPaid > 0 ? existingPaid : undefined,
      supplierBalance: finalBillPrice > 0 ? Math.max(0, finalBillPrice - existingPaid) : undefined,
      supplierPaymentMethod: request.supplierPaymentMethod,
      supplierPaymentDate: request.supplierPaymentDate,
      supplierPaymentNotes: request.supplierPaymentNotes,
      supplierPayments: existingPayments,
      items: editItems.map(it => {
        const qty = Number(it.quantity) || 1;
        const rate = Number(it.rate) || 0;
        const cRate = it.clientRate !== undefined ? Number(it.clientRate) || 0 : rate;
        const custRate = it.customerRate !== undefined ? Number(it.customerRate) || 0 : rate;
        return {
          name: it.name,
          quantity: qty,
          unit: it.unit || 'Units',
          rate,
          supplierRate: rate,
          amount: Math.round(qty * rate * 100) / 100,
          supplierAmount: Math.round(qty * rate * 100) / 100,
          clientRate: cRate,
          clientAmount: it.clientAmount !== undefined ? it.clientAmount : Math.round(qty * cRate * 100) / 100,
          customerRate: custRate,
          customerAmount: it.customerAmount !== undefined ? it.customerAmount : Math.round(qty * custRate * 100) / 100
        };
      })
    });

    toast.success(`Staff ${assignedStaff.name} assigned & dispatched to ${supplierName}!`);
    onOpenChange(false);
  };

  const isInterSite = request?.sourceType === 'site';
  const currentSelectedSupplier = suppliers.find(s => s.id === assignSupplierId);
  const assignedStaffObj = allStaff.find(s => s.id === assignStaffId);
  const otherStaffMembers = allStaff.filter(s => s.role !== 'driver');

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
              <Label className="text-xs font-semibold text-muted-foreground">
                {request?.driverName ? 'Change / Reassign Driver *' : 'Select Staff to Dispatch *'}
              </Label>
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
                    {allDrivers.length > 0 && (
                      <div className="px-2 py-1 text-[10px] font-bold uppercase text-primary bg-primary/10 flex items-center gap-1">
                        <Truck className="w-3 h-3 text-primary" /> Company Drivers
                      </div>
                    )}
                    {allDrivers.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        🚚 {d.name} ({d.phone || 'Driver'}) {d.customerHourlyRate ? `· ₹${d.customerHourlyRate}/hr` : ''}
                      </SelectItem>
                    ))}

                    {otherStaffMembers.length > 0 && (
                      <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground bg-muted/40 mt-1">
                        Other Site Staff / Supervisors
                      </div>
                    )}
                    {otherStaffMembers.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        👤 {s.name} ({s.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" /> Departure / Start Time *
              </Label>
              <Select value={formatTimeString(assignStartTime)} onValueChange={setAssignStartTime}>
                <SelectTrigger className="mt-1 h-11 rounded-xl text-sm font-medium">
                  <SelectValue placeholder="Select Departure Time" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {TIME_SELECT_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

                  {/* Product Pricing Breakdown: Separated Product, Quantity, Unit, Rate => Auto-calculated Total */}
                  <div className="space-y-2.5 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-foreground block">Product Item Rates & Quantities</span>
                        <span className="text-[10px] text-muted-foreground">Adjust quantity (kg, tons, bags) & unit rate — total calculates automatically</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddItem}
                        className="h-7 px-2 text-xs font-semibold gap-1 rounded-lg border-primary/40 text-primary hover:bg-primary/10"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Product
                      </Button>
                    </div>

                    <div className="space-y-2.5">
                      {editItems.map((it, idx) => (
                        <div key={idx} className="p-3 bg-muted/40 rounded-xl border border-border/50 text-xs space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Product / Material Item *</Label>
                              <Input
                                value={it.name}
                                onChange={e => handleItemFieldChange(idx, 'name', e.target.value)}
                                placeholder="e.g. Cement, M-Sand, Red Brick, Steel"
                                className="mt-1 h-8 text-xs font-bold"
                              />
                            </div>
                            {editItems.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(idx)}
                                className="h-8 w-8 text-destructive mt-4 hover:bg-destructive/10 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                            <div>
                              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Quantity *</Label>
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="1"
                                value={it.quantity}
                                onChange={e => handleItemFieldChange(idx, 'quantity', e.target.value)}
                                className="mt-1 h-8 rounded-lg text-xs font-semibold"
                              />
                            </div>

                            <div>
                              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Unit (Kg, Ton...)</Label>
                              <Select
                                value={COMMON_UNITS.includes(it.unit) ? it.unit : 'custom'}
                                onValueChange={val => {
                                  if (val !== 'custom') {
                                    handleItemFieldChange(idx, 'unit', val);
                                  }
                                }}
                              >
                                <SelectTrigger className="mt-1 h-8 rounded-lg text-xs">
                                  <SelectValue placeholder="Unit" />
                                </SelectTrigger>
                                <SelectContent>
                                  {COMMON_UNITS.map(u => (
                                    <SelectItem key={u} value={u}>
                                      {u}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="custom">Custom...</SelectItem>
                                </SelectContent>
                              </Select>
                              {!COMMON_UNITS.includes(it.unit) && (
                                <Input
                                  placeholder="Unit"
                                  value={it.unit}
                                  onChange={e => handleItemFieldChange(idx, 'unit', e.target.value)}
                                  className="mt-1 h-7 rounded-md text-[11px]"
                                />
                              )}
                            </div>

                            <div className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                              <Label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                                🏢 Supplier Rate (₹ / {it.unit || 'unit'}) *
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="e.g. 20"
                                value={it.rate === 0 || it.rate === '0' ? '' : it.rate}
                                onChange={e => handleItemFieldChange(idx, 'rate', e.target.value)}
                                className="h-8 rounded-lg text-xs font-bold border-emerald-500/30"
                              />
                              <span className="text-[9px] text-muted-foreground block">
                                Raw materials purchase price
                              </span>
                            </div>

                            <div className="p-2 rounded-xl bg-muted/40 border border-border/40 space-y-1">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Supplier Item Total (₹)</Label>
                              <div className="h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center px-2.5 font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                                ₹{(Number(it.amount) || (Number(it.quantity) || 1) * (Number(it.rate) || 0)).toLocaleString()}
                              </div>
                              <span className="text-[9px] text-muted-foreground block">
                                Qty × Supplier Rate
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total Payment / Supplier Bill Summary Box */}
                  <div className="p-3.5 bg-card rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-emerald-600" /> 🏢 Total Supplier Bill (Materials Only):
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {editItems.map(it => `${it.quantity} ${it.unit || 'Unit'} × ₹${it.rate || 0}`).join(' + ')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-heading font-black text-emerald-600 font-mono block">
                          ₹{calculatedTotalBill.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Payable to Supplier (Materials Only)
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Important:</strong> Supplier bill is <strong>strictly for materials only</strong>. Driver transit wage and petrol allowance are <strong>NEVER</strong> added to the supplier bill.
                      </span>
                    </div>

                    <div className="pt-1 text-xs text-muted-foreground flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>
                        Supplier payment can be recorded <strong>after confirming staff assignment & dispatch</strong> in Active Deliveries.
                      </span>
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
  const [compStartTime, setCompStartTime] = useState('');
  const [compEndTime, setCompEndTime] = useState('');
  const [compDriverHourlyRate, setCompDriverHourlyRate] = useState('');
  const [compDriverWage, setCompDriverWage] = useState('');
  const [compPetrol, setCompPetrol] = useState('');
  const [compNotes, setCompNotes] = useState('');
  const [compItems, setCompItems] = useState<MaterialRequestItem[]>([]);

  const updateTimesAndDriverWage = (newStart: string, newEnd: string, rateStr?: string) => {
    const rate = Number(rateStr !== undefined ? rateStr : compDriverHourlyRate) || 0;
    const durHrs = calculateDurationInHours(newStart, newEnd);
    if (rate > 0 && durHrs > 0) {
      setCompDriverWage(Math.round(durHrs * rate).toString());
    }
  };

  useEffect(() => {
    if (!request || !open) return;
    const initialStart = formatTimeString(request.startTime) || '08:00 AM';
    const initialEnd =
      formatTimeString(request.endTime || request.completionTime) ||
      formatTimeString(format(new Date(), 'hh:mm a'));
    setCompStartTime(initialStart);
    setCompEndTime(initialEnd);
    setCompPetrol(request.petrolCharge?.toString() || '');
    setCompNotes(request.completionNotes || '');

    const assignedDriver = staffList.find(
      s =>
        (request.driverId && s.id === request.driverId) ||
        (request.driverName && s.name.toLowerCase() === request.driverName.toLowerCase())
    );
    const detectedRate =
      request.driverHourlyRate ??
      (assignedDriver?.customerHourlyRate ||
        (assignedDriver?.salaryType === 'hourly' ? assignedDriver?.perHourSalary : 0) ||
        0);
    setCompDriverHourlyRate(detectedRate ? detectedRate.toString() : '');

    const initialItems = (request.items || []).map(it => {
      let supRate = it.supplierRate !== undefined ? it.supplierRate : it.rate;
      if (supRate === undefined) {
        const setting = materialSettings.find(
          m => m.name.toLowerCase().trim() === it.name.toLowerCase().trim()
        );
        supRate = setting?.defaultRate || 0;
      }
      const clientRate = it.clientRate !== undefined ? it.clientRate : supRate;
      const customerRate = it.customerRate !== undefined ? it.customerRate : supRate;
      return {
        ...it,
        rate: supRate,
        supplierRate: supRate,
        amount: Math.round(supRate * it.quantity * 100) / 100,
        supplierAmount: Math.round(supRate * it.quantity * 100) / 100,
        clientRate,
        clientAmount: Math.round(clientRate * it.quantity * 100) / 100,
        customerRate,
        customerAmount: Math.round(customerRate * it.quantity * 100) / 100
      };
    });
    setCompItems(initialItems);

    const durHrs = calculateDurationInHours(initialStart, initialEnd);
    if (request.driverWage !== undefined) {
      setCompDriverWage(request.driverWage.toString());
    } else if (detectedRate > 0 && durHrs > 0) {
      setCompDriverWage(Math.round(durHrs * detectedRate).toString());
    } else {
      setCompDriverWage('');
    }
  }, [request, open, materialSettings, staffList]);

  const handleItemSupplierRateChange = (index: number, newRate: number) => {
    setCompItems(prev => {
      const copy = [...prev];
      const it = copy[index];
      copy[index] = {
        ...it,
        rate: newRate,
        supplierRate: newRate,
        amount: Math.round(newRate * it.quantity * 100) / 100,
        supplierAmount: Math.round(newRate * it.quantity * 100) / 100
      };
      return copy;
    });
  };

  const handleItemClientRateChange = (index: number, newRate: number) => {
    setCompItems(prev => {
      const copy = [...prev];
      const it = copy[index];
      const amt = Math.round(newRate * it.quantity * 100) / 100;
      copy[index] = {
        ...it,
        clientRate: newRate,
        customerRate: newRate,
        clientAmount: amt,
        customerAmount: amt
      };
      return copy;
    });
  };

  const handleItemQtyChange = (index: number, newQty: number) => {
    setCompItems(prev => {
      const copy = [...prev];
      const it = copy[index];
      const sRate = it.supplierRate ?? it.rate ?? 0;
      const cRate = it.clientRate ?? (it.customerRate ?? sRate);
      copy[index] = {
        ...it,
        quantity: newQty,
        supplierAmount: Math.round(sRate * newQty * 100) / 100,
        amount: Math.round(sRate * newQty * 100) / 100,
        clientRate: cRate,
        customerRate: cRate,
        clientAmount: Math.round(cRate * newQty * 100) / 100,
        customerAmount: Math.round(cRate * newQty * 100) / 100
      };
      return copy;
    });
  };

  const durStr = calculateDuration(compStartTime, compEndTime);
  const durHours = calculateDurationInHours(compStartTime, compEndTime);

  // 1. Supplier Material Purchase Total (Strictly materials only: Qty * Supplier Rate. NO Driver, NO Petrol!)
  const supplierMatTotal = compItems.reduce(
    (sum, it) => sum + (it.supplierAmount ?? (it.supplierRate ?? it.rate ?? 0) * it.quantity),
    0
  );

  // 2. Client Materials Total
  const clientMatTotal = compItems.reduce(
    (sum, it) => sum + (it.clientAmount ?? (it.clientRate ?? it.rate ?? 0) * it.quantity),
    0
  );

  // 3. Customer Materials Total
  const customerMatTotal = compItems.reduce(
    (sum, it) => sum + (it.customerAmount ?? (it.customerRate ?? it.rate ?? 0) * it.quantity),
    0
  );

  const driverWageNum = Number(compDriverWage) || 0;
  const petTotal = Number(compPetrol) || 0;

  // Transit pay and petrol are added ONLY to Client and Customer billing:
  const clientGrandTotal = clientMatTotal + driverWageNum + petTotal;
  const customerGrandTotal = customerMatTotal + driverWageNum + petTotal;

  const handleConfirmComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;

    onComplete(request.id, {
      startTime: compStartTime,
      endTime: compEndTime,
      completionTime: compEndTime,
      duration: durStr,
      durationHours: durHours,
      driverWage: driverWageNum,
      driverHourlyRate: Number(compDriverHourlyRate) || 0,
      items: compItems,
      materialCost: supplierMatTotal, // Strictly material purchase cost
      supplierMaterialCost: supplierMatTotal,
      supplierPrice: supplierMatTotal, // Supplier price is strictly materials! NO driver or petrol!
      clientMaterialCost: clientMatTotal,
      customerMaterialCost: customerMatTotal,
      totalCost: clientGrandTotal,
      clientTotalCost: clientGrandTotal,
      customerTotalCost: customerGrandTotal,
      petrolCharge: petTotal,
      completionNotes: compNotes.trim() || undefined
    });

    toast.success(`Delivery completed & pricing recorded for Supplier, Client, and Customer!`);
    onOpenChange(false);
  };

  const driverRateNum = Number(compDriverHourlyRate) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto border border-border/80 shadow-2xl backdrop-blur-md">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="text-lg font-heading font-black flex items-center gap-2.5 text-foreground">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </span>
              Complete Delivery & Finalize Billing
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
              <span>Which rate is which? (Rate Guide)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-[11px] text-muted-foreground">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">🏢 Supplier Rate (Purchase Price)</span>
                <span>What we pay the supplier. <strong>Materials only! Driver wage & petrol are NEVER added to supplier.</strong></span>
              </div>
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/25">
                <span className="font-bold text-primary block mb-0.5">👤 Client Rate (Selling Price)</span>
                <span>What we charge the client. <strong>Final bill includes materials + driver transit pay + petrol.</strong></span>
              </div>
            </div>
          </div>

          {/* Two Rates Breakdown: Supplier vs Client */}
          <div className="space-y-3 bg-muted/20 p-4 rounded-2xl border border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <Label className="text-xs font-black text-foreground uppercase tracking-wider">
                  Delivered Materials & Pricing Rates (Supplier & Client)
                </Label>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground">
                {compItems.length} {compItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {compItems.map((item, idx) => {
                const sRate = item.supplierRate ?? item.rate ?? 0;
                const cRate = item.clientRate ?? (item.customerRate ?? sRate);
                const sTotal = item.supplierAmount ?? sRate * item.quantity;
                const cTotal = item.clientAmount ?? (item.customerAmount ?? cRate * item.quantity);

                return (
                  <div key={idx} className="bg-card p-3.5 rounded-2xl border border-border/70 space-y-3 text-xs shadow-xs hover:border-primary/40 transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-primary font-bold text-xs">
                          {idx + 1}
                        </span>
                        <span className="text-foreground font-bold text-sm tracking-tight">{item.name}</span>
                        <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold">
                          Unit: {item.unit || 'Unit'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">
                          🏢 Supplier: ₹{sTotal.toLocaleString()}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-bold">
                          👤 Client: ₹{cTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                      {/* 1. Delivered Quantity */}
                      <div>
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Delivered Qty ({item.unit}) *
                        </Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.quantity}
                          onChange={e => handleItemQtyChange(idx, Number(e.target.value) || 0)}
                          className="h-9 rounded-xl text-xs font-bold"
                        />
                      </div>

                      {/* 2. Supplier Rate (Purchase) */}
                      <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/25 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                            🏢 Supplier Rate (₹) *
                          </Label>
                          <span className="text-[9px] font-mono text-muted-foreground">
                            per {item.unit || 'unit'}
                          </span>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={item.supplierRate === 0 || item.supplierRate === '0' ? '' : (item.supplierRate ?? '')}
                          placeholder="e.g. 20"
                          onChange={e => handleItemSupplierRateChange(idx, Number(e.target.value) || 0)}
                          className="h-8 rounded-lg text-xs font-bold border-emerald-500/30 focus-visible:ring-emerald-500/40"
                        />
                        <div className="text-[10px] text-right font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                          Supplier: ₹{sTotal.toLocaleString()}
                        </div>
                        <span className="text-[9px] text-muted-foreground block text-right">
                          Materials only (No driver/petrol)
                        </span>
                      </div>

                      {/* 3. Client Rate (Selling) */}
                      <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-black text-primary uppercase tracking-wide">
                            👤 Client Rate (₹) *
                          </Label>
                          <span className="text-[9px] font-mono text-muted-foreground">
                            per {item.unit || 'unit'}
                          </span>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={item.clientRate === 0 || item.clientRate === '0' ? '' : (item.clientRate ?? '')}
                          placeholder="e.g. 25"
                          onChange={e => handleItemClientRateChange(idx, Number(e.target.value) || 0)}
                          className="h-8 rounded-lg text-xs font-bold border-primary/30 focus-visible:ring-primary/40"
                        />
                        <div className="text-[10px] text-right font-mono text-primary font-bold">
                          Client: ₹{cTotal.toLocaleString()}
                        </div>
                        <span className="text-[9px] text-muted-foreground block text-right">
                          Selling price to client
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2 Materials Subtotal Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-border/40 text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex justify-between items-center">
                <div>
                  <span className="font-bold text-[10px] text-emerald-700 dark:text-emerald-300 uppercase tracking-wide block">
                    🏢 Total Supplier Bill:
                  </span>
                  <span className="text-[9px] text-muted-foreground">(Materials only)</span>
                </div>
                <span className="font-black text-sm text-emerald-700 dark:text-emerald-400 font-mono">
                  ₹{supplierMatTotal.toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-primary/10 border border-primary/25 flex justify-between items-center">
                <div>
                  <span className="font-bold text-[10px] text-primary uppercase tracking-wide block">
                    👤 Total Client Materials:
                  </span>
                  <span className="text-[9px] text-muted-foreground">(Before transit)</span>
                </div>
                <span className="font-black text-sm text-primary font-mono">
                  ₹{clientMatTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Transit Logistics: Start / End Time and Driver Pay */}
          <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <Label className="text-xs font-black text-foreground uppercase tracking-wider">
                Transit Logistics & Expenses (Added to Client Billing)
              </Label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" /> Start / Dispatch Time *
                </Label>
                <Select
                  value={formatTimeString(compStartTime)}
                  onValueChange={val => {
                    setCompStartTime(val);
                    updateTimesAndDriverWage(val, compEndTime);
                  }}
                >
                  <SelectTrigger className="mt-1 h-10 rounded-xl text-sm font-medium">
                    <SelectValue placeholder="Select Start Time" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {TIME_SELECT_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" /> End / Delivery Time *
                </Label>
                <Select
                  value={formatTimeString(compEndTime)}
                  onValueChange={val => {
                    setCompEndTime(val);
                    updateTimesAndDriverWage(compStartTime, val);
                  }}
                >
                  <SelectTrigger className="mt-1 h-10 rounded-xl text-sm font-medium">
                    <SelectValue placeholder="Select End Time" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {TIME_SELECT_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {durStr ? (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-between">
                <span className="text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-600" /> Transit Duration:
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs">
                  {durStr} ({durHours} hrs)
                </span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                  Driver Hourly Rate (₹/hr)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 150"
                  value={compDriverHourlyRate}
                  onChange={e => {
                    const val = e.target.value;
                    setCompDriverHourlyRate(val);
                    updateTimesAndDriverWage(compStartTime, compEndTime, val);
                  }}
                  className="mt-1 h-9 rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                  Calculated Driver Pay (₹)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={compDriverWage}
                  onChange={e => setCompDriverWage(e.target.value)}
                  className="mt-1 h-9 rounded-xl text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono"
                />
              </div>
            </div>

            {/* Petrol Allowance Input */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-destructive" /> Petrol Allowance (₹) *
              </Label>
              <Input
                type="number"
                placeholder="e.g. 450"
                value={compPetrol}
                onChange={e => setCompPetrol(e.target.value)}
                className="mt-1 h-10 rounded-xl text-sm font-bold"
              />
            </div>
          </div>

          {/* Two-Card Billing Summary Comparison */}
          <div className="p-4 bg-card border border-border/80 rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-primary" />
                <span className="text-xs font-black text-foreground uppercase tracking-wider">
                  Final Billing Breakdown (Supplier vs Client)
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-semibold">
                Driver Pay & Petrol added only to Client Bill
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Card 1: Supplier Bill (Materials ONLY) */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/25 shadow-2xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/20">
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    🏢 Supplier Bill
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    Payable
                  </span>
                </div>
                <div className="space-y-1.5 text-muted-foreground text-[11px]">
                  <div className="flex justify-between">
                    <span>Materials ({compItems.length} items):</span>
                    <span className="font-bold text-foreground font-mono">₹{supplierMatTotal.toLocaleString()}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold leading-relaxed border border-emerald-500/20">
                    🚫 <strong>Driver Pay & Petrol are NOT added to Supplier</strong> (Materials purchase only).
                  </div>
                </div>
                <div className="flex justify-between items-center font-black pt-2 border-t border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-sm">
                  <span>Payable to Supplier:</span>
                  <span className="text-base font-black font-mono tracking-tight">₹{supplierMatTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Card 2: Client Billing Total */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-primary/5 border border-primary/25 shadow-2xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-primary/20">
                  <span className="text-xs font-black text-primary uppercase tracking-wider">
                    👤 Client Bill
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                    Receivable
                  </span>
                </div>
                <div className="space-y-1 text-muted-foreground text-[11px]">
                  <div className="flex justify-between">
                    <span>Materials ({compItems.length} items):</span>
                    <span className="font-bold text-foreground font-mono">₹{clientMatTotal.toLocaleString()}</span>
                  </div>
                  {driverWageNum > 0 && (
                    <div className="flex justify-between">
                      <span>+ Driver Pay ({durHours} hrs):</span>
                      <span className="font-bold text-foreground font-mono">₹{driverWageNum.toLocaleString()}</span>
                    </div>
                  )}
                  {petTotal > 0 && (
                    <div className="flex justify-between">
                      <span>+ Petrol Allowance:</span>
                      <span className="font-bold text-foreground font-mono">₹{petTotal.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center font-black pt-2 border-t border-primary/25 text-primary text-sm">
                  <span>Client Grand Total:</span>
                  <span className="text-base font-black font-mono tracking-tight">₹{clientGrandTotal.toLocaleString()}</span>
                </div>
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
            <CheckCircle2 className="w-4 h-4" /> Save Delivery & Finalize Billing Rates
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
