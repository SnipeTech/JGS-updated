import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Package, Truck, Building2, Warehouse, ArrowRightLeft, Plus, Trash2,
  Calendar, Clock, AlertCircle, CheckCircle2, IndianRupee, Layers, Check,
  CreditCard, ShieldCheck, Sparkles, Send
} from 'lucide-react';
import {
  MaterialRequestItem, Site, Supplier, Vehicle, Staff, MaterialSetting, MATERIAL_CATEGORIES
} from '@/types';
import { calculateDuration, formatTimeString, getSiteAvailableStock, TIME_SELECT_OPTIONS, getBaseMaterialName, getMaterialStarCount } from '@/lib/utils';

const COMMON_UNITS = ['Bags', 'Tons', 'Kg', 'Liters', 'Nos', 'Sets', 'Sq.Ft', 'Boxes', 'Meters', 'Loads', 'Units'];

interface AdminMaterialRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSiteId?: string;
}

export const AdminMaterialRequestModal = ({
  open,
  onOpenChange,
  defaultSiteId
}: AdminMaterialRequestModalProps) => {
  const {
    sites,
    suppliers,
    vehicles,
    staffList,
    attendances,
    materialSettings,
    materialRequests,
    storeRoomDispatches = [],
    dailyLogs,
    unitMaster,
    paymentStageMaster,
    addMaterialRequest,
    assignMaterialRequest,
    currentUser
  } = useApp();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const activeUnits = unitMaster && unitMaster.length > 0 ? unitMaster : COMMON_UNITS;

  // Drivers and who is marked present today
  const driversList = useMemo(() => staffList.filter(s => s.role === 'driver'), [staffList]);
  const presentDriversList = useMemo(() => {
    return driversList.filter(d => {
      return (attendances || []).some(
        att => att.staffId === d.id && att.date === todayStr && (att.status === 'present' || att.status === 'half-day')
      );
    });
  }, [driversList, attendances, todayStr]);

  // Check if a driver is currently assigned to an ongoing delivery or store room dispatch
  const getDriverActiveTrip = (driverId: string) => {
    const activeReq = (materialRequests || []).find(
      r => r.status === 'assigned' && r.driverId === driverId
    );
    if (activeReq) {
      return {
        siteName: activeReq.siteName,
        time: activeReq.startTime || activeReq.time,
        vehicle: activeReq.vehicleNumber || activeReq.vehicle,
        type: 'Material Requisition'
      };
    }
    const activeDispatch = (storeRoomDispatches || []).find(
      dis => dis.status === 'active' && dis.driverId === driverId
    );
    if (activeDispatch) {
      return {
        siteName: activeDispatch.siteName,
        time: activeDispatch.time,
        vehicle: activeDispatch.vehicleNumber,
        type: 'Store Room Dispatch'
      };
    }
    return null;
  };

  const { availableDrivers, assignedDrivers } = useMemo(() => {
    const avail: Staff[] = [];
    const assigned: Staff[] = [];
    driversList.forEach(d => {
      if (getDriverActiveTrip(d.id)) {
        assigned.push(d);
      } else {
        avail.push(d);
      }
    });
    return { availableDrivers: avail, assignedDrivers: assigned };
  }, [driversList, materialRequests, storeRoomDispatches]);

  // Store room catalog items
  const storeRoomCatalogItems = useMemo(() => {
    return (materialSettings || []).filter(m => m.isStoreRoom);
  }, [materialSettings]);

  // Form State
  const [targetSiteId, setTargetSiteId] = useState(defaultSiteId || sites[0]?.id || '');
  const [sourceType, setSourceType] = useState<'supplier' | 'store_room' | 'site'>('supplier');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('unassigned');
  const [sourceSiteId, setSourceSiteId] = useState<string>('');
  const [reqDate, setReqDate] = useState<string>(todayStr);
  const [reqTime, setReqTime] = useState<string>(format(new Date(), 'hh:mm a'));
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [workStage, setWorkStage] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Items State
  const [items, setItems] = useState<MaterialRequestItem[]>([
    { id: `item_${Date.now()}`, name: '', quantity: 1, unit: 'Bags', rate: 0, amount: 0, category: 'Civil & Structural' }
  ]);

  // Direct Assignment Option (Admin only)
  const [directAssign, setDirectAssign] = useState(false);
  const [assignedDriverId, setAssignedDriverId] = useState('');

  const selectedDriverActiveTrip = useMemo(() => {
    return assignedDriverId ? getDriverActiveTrip(assignedDriverId) : null;
  }, [assignedDriverId, materialRequests, storeRoomDispatches]);

  const [assignedVehicleId, setAssignedVehicleId] = useState('');
  const [dispatchStartTime, setDispatchStartTime] = useState(format(new Date(), 'hh:mm a'));
  const [supplierPriceInput, setSupplierPriceInput] = useState<string>('');
  const [supplierPaidInput, setSupplierPaidInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');

  // Reset or initialize on open
  useEffect(() => {
    if (open) {
      const initialSite = defaultSiteId || targetSiteId || sites[0]?.id || '';
      setTargetSiteId(initialSite);
      setReqDate(format(new Date(), 'yyyy-MM-dd'));
      setReqTime(format(new Date(), 'hh:mm a'));
      setDispatchStartTime(format(new Date(), 'hh:mm a'));
      setSelectedSupplierId('unassigned');

      const siteObj = sites.find(s => s.id === initialSite);
      if (siteObj) {
        const masterStages = (siteObj.paymentStages && siteObj.paymentStages.length > 0)
          ? siteObj.paymentStages.map(s => s.stageName)
          : paymentStageMaster;
        let activeStage: string | undefined = undefined;
        for (const st of masterStages) {
          const sData = (siteObj.paymentStages || []).find(s => s.stageName === st);
          if (!sData || sData.completionStatus !== 'completed') {
            activeStage = st;
            break;
          }
        }
        setWorkStage(activeStage || masterStages[0] || 'Foundation');
      }
    }
  }, [open, defaultSiteId, sites, paymentStageMaster]);

  // Update workStage when targetSiteId changes
  const targetSite = useMemo(() => sites.find(s => s.id === targetSiteId), [sites, targetSiteId]);
  useEffect(() => {
    if (targetSite) {
      const masterStages = (targetSite.paymentStages && targetSite.paymentStages.length > 0)
        ? targetSite.paymentStages.map(s => s.stageName)
        : paymentStageMaster;
      let activeStage: string | undefined = undefined;
      for (const st of masterStages) {
        const sData = (targetSite.paymentStages || []).find(s => s.stageName === st);
        if (!sData || sData.completionStatus !== 'completed') {
          activeStage = st;
          break;
        }
      }
      setWorkStage(activeStage || masterStages[0] || 'Foundation');
    }
  }, [targetSite, paymentStageMaster]);

  // Available other sites for inter-site transfer
  const otherSites = useMemo(() => {
    return sites.filter(s => s.id !== targetSiteId);
  }, [sites, targetSiteId]);

  // Source site available stock (for inter-site transfer)
  const sourceSiteAvailableStock = useMemo(() => {
    if (sourceType !== 'site' || !sourceSiteId) return [];
    return getSiteAvailableStock(sourceSiteId, materialRequests, dailyLogs, materialSettings);
  }, [sourceType, sourceSiteId, materialRequests, dailyLogs, materialSettings]);

  // Item helpers
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: `item_${Date.now()}_${Math.random()}`, name: '', quantity: 1, unit: 'Bags', rate: 0, amount: 0, category: 'Civil & Structural' }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: keyof MaterialRequestItem, val: any) => {
    setItems(prev => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: val };

      if (field === 'quantity' || field === 'rate') {
        const qty = Number(field === 'quantity' ? val : current.quantity) || 0;
        const rate = Number(field === 'rate' ? val : current.rate) || 0;
        current.amount = qty * rate;
      }

      // If user selected from standard catalog
      if (field === 'name') {
        const preset = materialSettings.find(m => m.name.toLowerCase() === String(val).trim().toLowerCase());
        if (preset) {
          if (preset.unit) current.unit = preset.unit;
          if (preset.defaultRate && !current.rate) {
            current.rate = preset.defaultRate;
            current.amount = (Number(current.quantity) || 1) * preset.defaultRate;
          }
          if (preset.category) current.category = preset.category;
        }
      }

      updated[index] = current;
      return updated;
    });
  };

  const totalEstimatedCost = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.amount) || (Number(it.rate) || 0) * (Number(it.quantity) || 0)), 0);
  }, [items]);

  // Sync supplier price input with total when it changes
  useEffect(() => {
    if (totalEstimatedCost > 0 && !supplierPriceInput) {
      setSupplierPriceInput(totalEstimatedCost.toString());
    }
  }, [totalEstimatedCost, supplierPriceInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetSite) {
      toast.error('Please select a valid destination project site.');
      return;
    }

    const validItems = items.filter(i => i.name.trim() && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      toast.error('Please enter at least one material item with a valid quantity.');
      return;
    }

    // Source specific validations
    let sourceSiteObj: Site | undefined;
    if (sourceType === 'site') {
      if (!sourceSiteId) {
        toast.error('Please select the source site for inter-site stock transfer.');
        return;
      }
      sourceSiteObj = sites.find(s => s.id === sourceSiteId);
      for (const item of validItems) {
        const stockItem = sourceSiteAvailableStock.find(s => s.name.toLowerCase() === item.name.trim().toLowerCase());
        if (!stockItem || Number(item.quantity) > stockItem.qty) {
          toast.error(`Stock unavailable! "${item.name}" only has ${stockItem?.qty || 0} ${stockItem?.unit || item.unit} at ${sourceSiteObj?.name || 'source site'}.`);
          return;
        }
      }
    }

    if (sourceType === 'store_room') {
      for (const item of validItems) {
        const catalogItem = storeRoomCatalogItems.find(s => s.name.toLowerCase() === item.name.trim().toLowerCase());
        const avail = catalogItem?.stockQuantity ?? 0;
        if (avail <= 0) {
          toast.error(`"${item.name}" is OUT OF STOCK (0 units) in Store Room warehouse.`);
          return;
        }
        if (Number(item.quantity) > avail) {
          toast.error(`Insufficient warehouse stock! Only ${avail} ${catalogItem?.unit || item.unit} available for "${item.name}".`);
          return;
        }
      }
    }

    const supplierObj = (selectedSupplierId && selectedSupplierId !== 'unassigned')
      ? suppliers.find(s => s.id === selectedSupplierId)
      : undefined;

    // Direct assignment validation if enabled
    let driverObj: Staff | undefined;
    let vehicleObj: Vehicle | undefined;
    if (directAssign) {
      if (!assignedDriverId) {
        toast.error('Please select a driver to assign this delivery trip.');
        return;
      }
      driverObj = staffList.find(s => s.id === assignedDriverId);
      vehicleObj = vehicles.find(v => v.id === assignedVehicleId);
    }

    const adminStaffId = currentUser?.id || 'admin';
    const adminStaffName = currentUser?.name ? `${currentUser.name} (Admin)` : 'Admin Management';
    const createdDate = reqDate || todayStr;
    const createdTime = reqTime || format(new Date(), 'hh:mm a');

    // Create the material request
    const newReqId = `mr_${Date.now()}`;
    const initialStatus = directAssign ? 'assigned' : 'pending';

    const supplierPriceVal = supplierPriceInput ? Number(supplierPriceInput) : totalEstimatedCost;
    const supplierPaidVal = supplierPaidInput ? Number(supplierPaidInput) : 0;
    const supplierBalVal = Math.max(0, supplierPriceVal - supplierPaidVal);

    const vehicleDesc = vehicleObj ? `${vehicleObj.name} (${vehicleObj.number})` : undefined;

    const requestPayload = {
      id: newReqId,
      siteId: targetSite.id,
      siteName: targetSite.name,
      requestedByStaffId: adminStaffId,
      requestedByStaffName: adminStaffName,
      date: createdDate,
      time: createdTime,
      status: initialStatus as 'pending' | 'assigned',
      workLevelStage: workStage,
      sourceType: sourceType,
      sourceSiteId: sourceType === 'site' ? sourceSiteObj?.id : (sourceType === 'store_room' ? 'store_room' : undefined),
      sourceSiteName: sourceType === 'site' ? sourceSiteObj?.name : (sourceType === 'store_room' ? 'Store Room / Central Warehouse' : undefined),
      isStoreRoom: sourceType === 'store_room',
      startDate: createdDate,
      supplierId: supplierObj?.id,
      supplierName: supplierObj?.name,
      items: validItems.map(i => ({
        id: i.id || `item_${Date.now()}_${Math.random()}`,
        name: i.name.trim(),
        quantity: Number(i.quantity),
        unit: i.unit?.trim() || 'Units',
        rate: Number(i.rate) || 0,
        supplierRate: Number(i.rate) || 0,
        clientRate: Number(i.rate) || 0,
        amount: (Number(i.rate) || 0) * (Number(i.quantity) || 0),
        supplierAmount: (Number(i.rate) || 0) * (Number(i.quantity) || 0),
        clientAmount: (Number(i.rate) || 0) * (Number(i.quantity) || 0),
        category: i.category || 'Civil & Structural'
      })),
      materialCost: totalEstimatedCost,
      supplierMaterialCost: totalEstimatedCost,
      clientMaterialCost: totalEstimatedCost,
      notes: (priority === 'urgent' ? '[⚡ URGENT PRIORITY] ' : '') +
             (sourceType === 'site' ? `[Inter-Site Transfer from ${sourceSiteObj?.name}] ` : '') +
             (sourceType === 'store_room' ? `[Store Room Warehouse Dispatch] ` : '') +
             (notes.trim() || ''),
      driverId: driverObj?.id,
      driverName: driverObj?.name,
      vehicle: vehicleDesc,
      vehicleNumber: vehicleObj?.number,
      vehicleType: vehicleObj?.type,
      startTime: directAssign ? dispatchStartTime : undefined,
      supplierPrice: supplierPriceVal,
      supplierPaidAmount: supplierPaidVal,
      supplierBalance: supplierBalVal,
      supplierPaymentMethod: supplierPaidVal > 0 ? paymentMethod : undefined,
      supplierPaymentDate: supplierPaidVal > 0 ? createdDate : undefined,
      supplierPayments: supplierPaidVal > 0 ? [{
        id: `pay_${Date.now()}`,
        amount: supplierPaidVal,
        date: createdDate,
        method: paymentMethod,
        notes: 'Initial upfront advance on dispatch'
      }] : [],
      createdAt: new Date().toISOString()
    };

    addMaterialRequest(requestPayload);

    // If direct assignment, invoke assignMaterialRequest to automatically handle Store Room stock deduction & dispatch records
    if (directAssign && driverObj) {
      assignMaterialRequest(newReqId, {
        driverId: driverObj.id,
        driverName: driverObj.name,
        supplierId: supplierObj?.id || '',
        supplierName: supplierObj?.name || 'Store Room / Direct',
        vehicle: vehicleDesc || '',
        vehicleNumber: vehicleObj?.number || '',
        vehicleType: vehicleObj?.type || '',
        startTime: dispatchStartTime,
        supplierPrice: supplierPriceVal,
        supplierPaidAmount: supplierPaidVal,
        supplierBalance: supplierBalVal,
        supplierPaymentMethod: supplierPaidVal > 0 ? paymentMethod : undefined,
        supplierPaymentDate: supplierPaidVal > 0 ? createdDate : undefined,
        supplierPayments: requestPayload.supplierPayments,
        items: requestPayload.items
      });
      toast.success(`Material request created & dispatched to ${driverObj.name} for ${targetSite.name}!`);
    } else {
      toast.success(`Material request for ${targetSite.name} submitted to pending queue!`);
    }

    // Reset Form
    setItems([{ id: `item_${Date.now()}`, name: '', quantity: 1, unit: 'Bags', rate: 0, amount: 0, category: 'Civil & Structural' }]);
    setNotes('');
    setDirectAssign(false);
    setSelectedSupplierId('unassigned');
    setAssignedDriverId('');
    setAssignedVehicleId('');
    setSupplierPriceInput('');
    setSupplierPaidInput('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header Banner */}
        <DialogHeader className="p-5 pb-4 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-card border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-heading font-extrabold text-foreground flex items-center gap-2">
                  Send Material Request
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Admin Dispatch
                  </span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Procure materials, transfer from another site, or dispatch from store room.
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Target Site & Work Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-card border border-border/60">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" /> Destination Project Site *
              </Label>
              <Select value={targetSiteId} onValueChange={setTargetSiteId}>
                <SelectTrigger className="h-9.5 rounded-xl text-xs bg-background">
                  <SelectValue placeholder="Select Target Site" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${s.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                        <span className="font-semibold">{s.name}</span>
                        {s.clientName && <span className="text-muted-foreground text-[10px]">({s.clientName})</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {targetSite && (
                <p className="text-[10px] text-muted-foreground pl-0.5 truncate">
                  📍 {targetSite.address || 'Address not listed'} • Client: {targetSite.clientName || 'General'}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-500" /> Construction Stage / Level
              </Label>
              <Select value={workStage} onValueChange={setWorkStage}>
                <SelectTrigger className="h-9.5 rounded-xl text-xs bg-background">
                  <SelectValue placeholder="Select Stage" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {((targetSite?.paymentStages && targetSite.paymentStages.length > 0)
                    ? targetSite.paymentStages.map(s => s.stageName)
                    : paymentStageMaster
                  ).filter(Boolean).map(stg => (
                    <SelectItem key={stg} value={stg}>
                      {stg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground pl-0.5">
                Requisition expenses & billing will link to this construction milestone.
              </p>
            </div>
          </div>

          {/* Sourcing Method (Supplier vs Store Room vs Another Site) */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Requisition Source *</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSourceType('supplier')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  sourceType === 'supplier'
                    ? 'border-amber-500 bg-amber-500/10 text-foreground font-bold shadow-xs'
                    : 'border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className={`w-4 h-4 ${sourceType === 'supplier' ? 'text-amber-600' : ''}`} />
                <span className="text-[11px]">Vendor / Supplier</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceType('store_room')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  sourceType === 'store_room'
                    ? 'border-emerald-500 bg-emerald-500/10 text-foreground font-bold shadow-xs'
                    : 'border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Warehouse className={`w-4 h-4 ${sourceType === 'store_room' ? 'text-emerald-600' : ''}`} />
                <span className="text-[11px]">Store Room Stock</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceType('site')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  sourceType === 'site'
                    ? 'border-blue-500 bg-blue-500/10 text-foreground font-bold shadow-xs'
                    : 'border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                <ArrowRightLeft className={`w-4 h-4 ${sourceType === 'site' ? 'text-blue-600' : ''}`} />
                <span className="text-[11px]">Another Site Transfer</span>
              </button>
            </div>

            {/* Source Specific Configuration */}
            {sourceType === 'supplier' && (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2 animate-slide-up">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <Label className="text-xs font-semibold text-foreground">Select Supplier (Optional / TBD)</Label>
                  <span className="text-[10px] text-muted-foreground">{suppliers.length} vendors in database</span>
                </div>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                    <SelectValue placeholder="Assign Supplier (or leave TBD for driver to procure)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="unassigned">-- Leave Unassigned / Any Vendor --</SelectItem>
                    {suppliers.map(sup => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name} {sup.category ? `(${sup.category})` : ''} {sup.phone ? `• 📞 ${sup.phone}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sourceType === 'store_room' && (
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2 animate-slide-up">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Warehouse className="w-3.5 h-3.5 text-emerald-600" /> Store Room Central Warehouse
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {storeRoomCatalogItems.length} warehouse items tracked
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Materials will be issued from central warehouse stock. Quantities will automatically validate against available inventory.
                </p>
              </div>
            )}

            {sourceType === 'site' && (
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2.5 animate-slide-up">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Source Site (With Available Stock) *</Label>
                  <span className="text-[10px] text-blue-600 font-bold">Inter-Site Relocation</span>
                </div>
                <Select value={sourceSiteId} onValueChange={setSourceSiteId}>
                  <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                    <SelectValue placeholder="Select Source Site" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {otherSites.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.clientName || 'General'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {sourceSiteId && sourceSiteAvailableStock.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Live Stock Available at Source Site:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {sourceSiteAvailableStock.map(st => (
                        <button
                          key={st.name}
                          type="button"
                          onClick={() => {
                            setItems([{
                              id: `item_${Date.now()}`,
                              name: st.name,
                              quantity: Math.min(st.qty, 1),
                              unit: st.unit || 'Units',
                              rate: st.rate || 0,
                              amount: (st.rate || 0) * Math.min(st.qty, 1),
                              category: 'Civil & Structural'
                            }]);
                          }}
                          className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[10px] text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-500/20 transition-all flex items-center gap-1"
                          title="Click to fill into requisition"
                        >
                          <span>{st.name}:</span>
                          <span className="font-mono text-foreground">{st.qty} {st.unit}</span>
                          <Plus className="w-2.5 h-2.5 text-blue-600" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {sourceSiteId && sourceSiteAvailableStock.length === 0 && (
                  <p className="text-[11px] text-destructive italic">
                    ⚠️ No recorded material stock available at this site currently.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Material Items List */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-primary" /> Requisition Items ({items.length})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="h-7 text-[11px] rounded-lg gap-1 border-primary/40 text-primary hover:bg-primary/10"
              >
                <Plus className="w-3 h-3" /> Add Item
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {items.map((item, index) => {
                const isStoreRoomItem = sourceType === 'store_room';
                const storeMatch = isStoreRoomItem
                  ? storeRoomCatalogItems.find(m => m.name.toLowerCase() === item.name.trim().toLowerCase())
                  : null;

                return (
                  <div key={item.id || index} className="p-3 rounded-xl bg-card border border-border/70 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">
                        Item #{index + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      {/* Name / Product Selection */}
                      <div className="sm:col-span-5 space-y-1">
                        <Label className="text-[10px] text-muted-foreground font-semibold">Material / Product Name *</Label>
                        {sourceType === 'store_room' ? (
                          <Select
                            value={item.name}
                            onValueChange={v => {
                              handleUpdateItem(index, 'name', v);
                              const preset = storeRoomCatalogItems.find(m => m.name === v);
                              if (preset) {
                                if (preset.unit) handleUpdateItem(index, 'unit', preset.unit);
                                if (preset.rentalRatePerDay || preset.defaultRate) {
                                  handleUpdateItem(index, 'rate', preset.rentalRatePerDay || preset.defaultRate || 0);
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 rounded-lg text-xs">
                              <SelectValue placeholder="Select Store Room Item" />
                            </SelectTrigger>
                            <SelectContent className="max-h-56">
                              {storeRoomCatalogItems.filter(m => !!m.name).map(m => {
                                const cleanName = getBaseMaterialName(m.name);
                                const batchNum = getMaterialStarCount(m.name);
                                return (
                                  <SelectItem key={m.id} value={m.name}>
                                    <div className="flex items-center justify-between gap-4">
                                      <span>{cleanName} {batchNum > 1 ? `(Batch #${batchNum})` : ''}</span>
                                      <span className="text-[10px] text-emerald-600 font-bold font-mono">
                                        ({m.stockQuantity || 0} {m.unit} in stock)
                                      </span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="relative">
                            <Input
                              placeholder="e.g. UltraTech Cement, 12mm Steel, River Sand..."
                              value={item.name}
                              onChange={e => handleUpdateItem(index, 'name', e.target.value)}
                              className="h-8 rounded-lg text-xs"
                              list={`mat-suggestions-${index}`}
                            />
                            <datalist id={`mat-suggestions-${index}`}>
                              {materialSettings.map(m => (
                                <option key={m.id} value={m.name} />
                              ))}
                            </datalist>
                          </div>
                        )}

                        {storeMatch && (
                          <p className="text-[10px] text-emerald-600 font-semibold pl-0.5">
                            Warehouse Stock: {storeMatch.stockQuantity || 0} {storeMatch.unit} ({storeMatch.storeRoomLocation || 'Main Hub'})
                          </p>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[10px] text-muted-foreground font-semibold">Qty *</Label>
                        <Input
                          type="number"
                          min="0.1"
                          step="any"
                          value={item.quantity || ''}
                          onChange={e => handleUpdateItem(index, 'quantity', e.target.value)}
                          className="h-8 rounded-lg text-xs font-mono font-bold"
                          placeholder="1"
                        />
                      </div>

                      {/* Unit */}
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[10px] text-muted-foreground font-semibold">Unit</Label>
                        <Select
                          value={item.unit || 'Bags'}
                          onValueChange={v => handleUpdateItem(index, 'unit', v)}
                        >
                          <SelectTrigger className="h-8 rounded-lg text-xs">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent className="max-h-48">
                            {activeUnits.filter(Boolean).map(u => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Estimated Rate */}
                      <div className="sm:col-span-3 space-y-1">
                        <Label className="text-[10px] text-muted-foreground font-semibold">Rate (₹ / Unit)</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-mono">₹</span>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate || ''}
                            onChange={e => handleUpdateItem(index, 'rate', e.target.value)}
                            className="h-8 pl-6 rounded-lg text-xs font-mono"
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Calculated row subtotal */}
                    <div className="flex items-center justify-end text-[10px] text-muted-foreground pt-0.5">
                      <span>Amount: <strong className="text-foreground font-mono">₹{(Number(item.amount) || 0).toLocaleString()}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Cost Banner */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Estimated Requisition Total:</span>
              <span className="text-base font-extrabold font-mono text-foreground">
                ₹{totalEstimatedCost.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Schedule & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-card border border-border/60">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Required Date
              </Label>
              <Input
                type="date"
                value={reqDate}
                onChange={e => setReqDate(e.target.value)}
                className="h-9 rounded-xl text-xs bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" /> Expected Time
              </Label>
              <Select value={reqTime} onValueChange={setReqTime}>
                <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {TIME_SELECT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Priority Level
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPriority('normal')}
                  className={`h-9 rounded-xl border text-xs font-semibold transition-all ${
                    priority === 'normal'
                      ? 'border-border bg-card text-foreground font-bold shadow-xs'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Regular
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('urgent')}
                  className={`h-9 rounded-xl border text-xs font-bold transition-all ${
                    priority === 'urgent'
                      ? 'border-destructive bg-destructive/15 text-destructive shadow-xs'
                      : 'border-transparent text-muted-foreground hover:text-destructive'
                  }`}
                >
                  ⚡ Urgent
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">Delivery Instructions / Remarks</Label>
            <Textarea
              placeholder="e.g. Unload at rear driveway, contact supervisor Murugan on arrival..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="min-h-16 rounded-xl text-xs bg-card"
            />
          </div>

          {/* ── ADMIN DIRECT DISPATCH TOGGLE ── */}
          <div className="p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-card space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={directAssign}
                  onChange={e => setDirectAssign(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600"
                />
                <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-amber-600" />
                  Direct Assign Driver & Dispatch Now
                </span>
              </label>
              <span className="text-[10px] text-muted-foreground">
                {directAssign ? 'Creates active transit trip' : 'Queues as pending for scheduling'}
              </span>
            </div>

            {directAssign && (
              <div className="space-y-3 pt-2 border-t border-border/40 animate-slide-up">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Driver */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">Assign Driver *</Label>
                    <Select value={assignedDriverId} onValueChange={setAssignedDriverId}>
                      <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                        <SelectValue placeholder="Select Driver" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {/* Primary: Available Drivers */}
                        <SelectGroup>
                          <SelectLabel className="px-2 py-1 text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 flex items-center justify-between my-0.5 rounded-md">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Available Drivers
                            </span>
                            <span className="text-[9px] font-bold">({availableDrivers.length} Free)</span>
                          </SelectLabel>
                          {availableDrivers.map(d => {
                            const isPresent = presentDriversList.some(pd => pd.id === d.id);
                            return (
                              <SelectItem key={d.id} value={d.id}>
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${isPresent ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                    <span className="font-semibold">{d.name}</span>
                                  </div>
                                  {isPresent && <span className="text-[9px] text-emerald-600 font-bold">Present Today</span>}
                                </div>
                              </SelectItem>
                            );
                          })}
                          {availableDrivers.length === 0 && (
                            <div className="p-2 text-center text-[11px] text-muted-foreground italic">
                              No unassigned drivers currently free.
                            </div>
                          )}
                        </SelectGroup>

                        {/* Secondary: Currently Assigned Drivers */}
                        {assignedDrivers.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="px-2 py-1 text-[10px] font-extrabold uppercase text-amber-700 dark:text-amber-400 bg-amber-500/10 flex items-center justify-between mt-2 mb-1 rounded-md border-t border-amber-500/20">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" /> Currently Assigned / In-Transit (Secondary)
                              </span>
                              <span className="text-[9px] font-bold">({assignedDrivers.length} On Trip)</span>
                            </SelectLabel>
                            {assignedDrivers.map(d => {
                              const isPresent = presentDriversList.some(pd => pd.id === d.id);
                              const activeTrip = getDriverActiveTrip(d.id);
                              return (
                                <SelectItem key={d.id} value={d.id}>
                                  <div className="flex items-center justify-between gap-2 w-full opacity-85">
                                    <div className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                                      <span className="font-semibold">{d.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                        ⚠️ Assigned · {activeTrip?.siteName || 'Active Trip'}
                                      </span>
                                      {isPresent && <span className="text-[9px] text-emerald-600 font-bold">✓</span>}
                                    </div>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Vehicle */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">Assign Vehicle</Label>
                    <Select value={assignedVehicleId} onValueChange={setAssignedVehicleId}>
                      <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                        <SelectValue placeholder="Select Vehicle" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {vehicles.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name} ({v.number}) - {v.type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Start / Dispatch Time */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">Dispatch Departure Time</Label>
                    <Select value={dispatchStartTime} onValueChange={setDispatchStartTime}>
                      <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                        <SelectValue placeholder="Select Time" />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {TIME_SELECT_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Secondary In-Transit Driver Warning */}
                {selectedDriverActiveTrip && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2 animate-fade-in">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="leading-snug">
                      <span className="font-bold">Driver is already on an active trip:</span> Assigned to deliver to{' '}
                      <span className="font-bold underline">{selectedDriverActiveTrip.siteName}</span>
                      {selectedDriverActiveTrip.time ? ` at ${selectedDriverActiveTrip.time}` : ''}.
                      Assigning them now will queue/overlap this delivery trip.
                    </div>
                  </div>
                )}

                {/* Upfront Payment to Supplier */}
                {sourceType === 'supplier' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/30">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-foreground">Supplier Total Bill (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={supplierPriceInput}
                        onChange={e => setSupplierPriceInput(e.target.value)}
                        placeholder={totalEstimatedCost.toString()}
                        className="h-8.5 rounded-xl text-xs font-mono font-bold bg-background"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-foreground">Amount Paid Upfront (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={supplierPaidInput}
                        onChange={e => setSupplierPaidInput(e.target.value)}
                        placeholder="0"
                        className="h-8.5 rounded-xl text-xs font-mono text-emerald-600 font-bold bg-background"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-foreground">Payment Method</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="h-8.5 rounded-xl text-xs bg-background">
                          <SelectValue placeholder="Method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="UPI / GPay">UPI / GPay</SelectItem>
                          <SelectItem value="Bank Transfer">Bank Transfer / NEFT</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-xl text-xs font-semibold px-4"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              className="h-9 rounded-xl text-xs font-bold px-5 bg-primary hover:bg-primary/90 text-white gap-2 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              {directAssign ? 'Assign & Dispatch Now' : 'Send Material Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
export default AdminMaterialRequestModal;
