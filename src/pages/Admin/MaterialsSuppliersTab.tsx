import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Package, Truck, Building2, Layers, Plus, Trash2, CheckCircle2,
  Clock, IndianRupee, MapPin, ArrowRightLeft, AlertCircle, PenLine, CreditCard,
  Check, Filter, Calendar, Search, X, Info, RefreshCw, Wallet,
  Warehouse, Ruler, Tag, Boxes, Box, ArrowUpDown, History, Send,
  FileText, Printer, Eye, ChevronRight, DollarSign, Receipt,
  AlertTriangle, RotateCcw, Flame
} from 'lucide-react';
import {
  MaterialRequest, MaterialRequestItem, Supplier, Vehicle, VEHICLE_TYPES, SupplierPaymentRecord, MaterialRental,
  MATERIAL_CATEGORIES, MaterialSetting, StoreRoomDispatchRecord, Staff, CrushedStockRecord
} from '@/types';
import { calculateDuration, formatTimeString, TIME_SELECT_OPTIONS, getBaseMaterialName, getStorageStarBadge, getMaterialStarCount, getStoreRoomStockClassification } from '@/lib/utils';
import { AssignMaterialModal, CompleteMaterialModal } from './LogisticsModals';
import { AdminMaterialRequestModal } from './AdminMaterialRequestModal';

const COMMON_UNITS = ['Bags', 'Tons', 'Kg', 'Liters', 'Nos', 'Sets', 'Sq.Ft', 'Boxes', 'Meters', 'Loads', 'Units'];

export interface ActiveProductGroupData {
  key: string;
  materialId: string;
  materialName: string;
  category: string;
  unit: string;
  storeRoomLocation: string;
  warehouseStock: number;
  minStockAlert: number;
  rentalRatePerDay: number;
  totalActiveQuantity: number;
  uniqueSitesCount: number;
  sitesList: { siteName: string; siteId?: string; qty: number; unit: string }[];
  maxDaysDeployed: number;
  earliestDeliveryDate: string;
  dispatches: StoreRoomDispatchRecord[];
}

export const MaterialsSuppliersTab = () => {
  const {
    materialSettings, addMaterialSetting, updateMaterialSetting, deleteMaterialSetting,
    suppliers, addSupplier, updateSupplier, deleteSupplier,
    vehicles, addVehicle, updateVehicle, deleteVehicle,
    materialRequests, assignMaterialRequest, completeMaterialRequest, deleteMaterialRequest,
    updateMaterialRequest, addMaterialRequest, staffList, attendances, sites,
    materialRentals, addMaterialRental, updateMaterialRental, deleteMaterialRental,
    unitMaster, addUnit, removeUnit,
    storeRoomDispatches, addStoreRoomDispatch, updateStoreRoomDispatch, currentUser,
    addExpense, deleteExpense, manualExpenses,
    crushedStockHistory = [], addCrushedStockRecord, deleteCrushedStockRecord, restoreCrushedStockRecord,
    refreshFromBackend
  } = useApp();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefreshStock = async () => {
    setIsRefreshing(true);
    try {
      await refreshFromBackend();
      toast.success('Store Room stock & site deployments synced with database!');
    } catch {
      toast.error('Failed to sync live data with database');
    } finally {
      setIsRefreshing(false);
    }
  };

  const activeUnits = unitMaster && unitMaster.length > 0 ? unitMaster : COMMON_UNITS;
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const driversList = useMemo(() => staffList.filter(s => s.role === 'driver'), [staffList]);
  const presentDriversList = useMemo(() => {
    return driversList.filter(d => {
      return (attendances || []).some(att => att.staffId === d.id && att.date === todayStr && (att.status === 'present' || att.status === 'half-day'));
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
    const pool = driversList.length > 0 ? driversList : staffList;
    pool.forEach(d => {
      if (getDriverActiveTrip(d.id)) {
        assigned.push(d);
      } else {
        avail.push(d);
      }
    });
    return { availableDrivers: avail, assignedDrivers: assigned };
  }, [driversList, staffList, materialRequests, storeRoomDispatches]);

  type MaterialSubTab = 'requests' | 'assigned_deliveries' | 'store_room' | 'rentals' | 'suppliers' | 'vehicles' | 'materials' | 'units';
  const [activeSubTab, setActiveSubTabState] = useState<MaterialSubTab>(() => {
    const saved = sessionStorage.getItem('jgs_materials_active_subtab') as MaterialSubTab | null;
    const valid: MaterialSubTab[] = ['requests', 'assigned_deliveries', 'store_room', 'rentals', 'suppliers', 'vehicles', 'materials', 'units'];
    return (saved && valid.includes(saved)) ? saved : 'requests';
  });

  const setActiveSubTab = (tab: MaterialSubTab) => {
    sessionStorage.setItem('jgs_materials_active_subtab', tab);
    setActiveSubTabState(tab);
  };
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'assigned' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Material Rentals Management State
  const [showDeployRentalModal, setShowDeployRentalModal] = useState(false);
  const [rentalMatId, setRentalMatId] = useState('');
  const [rentalMatName, setRentalMatName] = useState('');
  const [rentalSiteId, setRentalSiteId] = useState('');
  const [rentalStartDate, setRentalStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rentalQuantity, setRentalQuantity] = useState('1');
  const [rentalUnit, setRentalUnit] = useState('Sets');
  const [rentalRequiresDriver, setRentalRequiresDriver] = useState(false);
  const [rentalDriverId, setRentalDriverId] = useState('');
  const [rentalVehicleId, setRentalVehicleId] = useState('');
  const [rentalTransitCost, setRentalTransitCost] = useState('');
  const [rentalRatePerDay, setRentalRatePerDay] = useState('');
  const [rentalNotes, setRentalNotes] = useState('');
  const [rentalStatusFilter, setRentalStatusFilter] = useState<'all' | 'active' | 'returned'>('all');

  // Return / Closing Modal State
  const [returnModal, setReturnModal] = useState<{ open: boolean; rental: MaterialRental | null }>({
    open: false,
    rental: null
  });
  const [returnEndDate, setReturnEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [returnRatePerDay, setReturnRatePerDay] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  // Material Presets Form State
  const [matName, setMatName] = useState('');
  const [matCategory, setMatCategory] = useState<string>('Civil & Structural');
  const [matUnit, setMatUnit] = useState('');
  const [matWeight, setMatWeight] = useState('');
  const [matRate, setMatRate] = useState('');
  const [editingMatId, setEditingMatId] = useState<string | null>(null);
  const [selectedMatCategoryFilter, setSelectedMatCategoryFilter] = useState<string>('all');
  const [isRentalMat, setIsRentalMat] = useState(false);
  const [matRentalRate, setMatRentalRate] = useState('');
  const [isStoreRoomMat, setIsStoreRoomMat] = useState(false);
  const [matStockQuantity, setMatStockQuantity] = useState('');
  const [matMinStockAlert, setMatMinStockAlert] = useState('10');
  const [matStoreRoomLocation, setMatStoreRoomLocation] = useState('');
  const [matBuyingPrice, setMatBuyingPrice] = useState('');
  const [matTypeFilter, setMatTypeFilter] = useState<'all' | 'standard' | 'rental' | 'store_room'>('all');
  const [rentalDeploySiteId, setRentalDeploySiteId] = useState('');

  // Store Room & Warehouse Dispatch / Adjust / Return States
  const [storeRoomFilter, setStoreRoomFilter] = useState<'all' | 'new_stock' | 'old_stock' | 'crushed_history' | 'active' | 'low_stock' | 'out_of_stock' | 'history'>('all');
  const [activeViewMode, setActiveViewMode] = useState<'products' | 'dispatches'>('products');
  const [selectedActiveProductReport, setSelectedActiveProductReport] = useState<ActiveProductGroupData | null>(null);

  // Crush Stock Modal State
  const [crushModal, setCrushModal] = useState<{ open: boolean; material: MaterialSetting | null }>({
    open: false,
    material: null
  });
  const [crushQuantity, setCrushQuantity] = useState('');
  const [crushReason, setCrushReason] = useState('💥 Crushed / Broken in warehouse');
  const [crushNotes, setCrushNotes] = useState('');

  // Delete Stock Confirmation Modal State
  const [deleteStockModal, setDeleteStockModal] = useState<{ open: boolean; material: MaterialSetting | null }>({
    open: false,
    material: null
  });
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchSelectedMaterial, setDispatchSelectedMaterial] = useState<MaterialSetting | null>(null);
  const [dispatchSiteId, setDispatchSiteId] = useState('');
  const [dispatchQuantity, setDispatchQuantity] = useState('1');
  const [dispatchVehicleId, setDispatchVehicleId] = useState('');
  const [dispatchDriverId, setDispatchDriverId] = useState('');
  const [dispatchDate, setDispatchDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dispatchTime, setDispatchTime] = useState(format(new Date(), 'hh:mm a'));
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Admin Send Material Request Modal
  const [showAdminCreateReqModal, setShowAdminCreateReqModal] = useState(false);

  // Store Room Item Return & Bill Site Modal State
  const [returnStoreRoomModal, setReturnStoreRoomModal] = useState<{
    open: boolean;
    dispatchRecord?: StoreRoomDispatchRecord | null;
    requestRecord?: MaterialRequest | null;
  }>({
    open: false,
    dispatchRecord: null,
    requestRecord: null,
  });
  const [storeRoomDeliveryDate, setStoreRoomDeliveryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [storeRoomReturnDate, setStoreRoomReturnDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [returnDestinationType, setReturnDestinationType] = useState<'store_room' | 'other_site' | 'split'>('store_room');
  const [returnTransferSiteId, setReturnTransferSiteId] = useState('');
  const [returnTransferCount, setReturnTransferCount] = useState('');
  const [returnStoreRoomCount, setReturnStoreRoomCount] = useState('');
  const [returnRateMode, setReturnRateMode] = useState<'daily' | 'unit'>('daily');
  const [storeRoomPerDayRate, setStoreRoomPerDayRate] = useState('');
  const [storeRoomUnitRate, setStoreRoomUnitRate] = useState('');
  const [storeRoomBilledAmount, setStoreRoomBilledAmount] = useState('');
  const [storeRoomRestock, setStoreRoomRestock] = useState(true);
  const [storeRoomReturnNotes, setStoreRoomReturnNotes] = useState('');
  const [returnVehicleId, setReturnVehicleId] = useState('none');
  const [returnDriverId, setReturnDriverId] = useState('none');
  const [splitReturnVehicleId, setSplitReturnVehicleId] = useState('none');
  const [splitReturnDriverId, setSplitReturnDriverId] = useState('none');
  const [sameDriverVehicleForSplit, setSameDriverVehicleForSplit] = useState(true);

  const [adjustStockModal, setAdjustStockModal] = useState<{ open: boolean; material: MaterialSetting | null }>({
    open: false,
    material: null
  });
  const [adjustMode, setAdjustMode] = useState<'add' | 'set'>('add');
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustBuyingPrice, setAdjustBuyingPrice] = useState('');
  const [adjustMinStockAlert, setAdjustMinStockAlert] = useState('');
  const [adjustLocation, setAdjustLocation] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Units Master Form State
  const [newUnitName, setNewUnitName] = useState('');

  // Supplier Form State
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supMaterials, setSupMaterials] = useState('');
  const [supNotes, setSupNotes] = useState('');
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [selectedCatalogMaterials, setSelectedCatalogMaterials] = useState<string[]>([]);
  const [customMaterialsText, setCustomMaterialsText] = useState('');
  const [supplierMaterialFilter, setSupplierMaterialFilter] = useState('all');

  // Vehicle Form State
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehName, setVehName] = useState('');
  const [vehNumber, setVehNumber] = useState('');
  const [vehType, setVehType] = useState('Pickup');
  const [vehNotes, setVehNotes] = useState('');
  const [editingVehId, setEditingVehId] = useState<string | null>(null);

  // Modals & Payment State
  const [assignModal, setAssignModal] = useState<{ open: boolean; request: MaterialRequest | null }>({ open: false, request: null });
  const [completeModal, setCompleteModal] = useState<{ open: boolean; request: MaterialRequest | null }>({ open: false, request: null });
  const [selectedSupplierForLedger, setSelectedSupplierForLedger] = useState<Supplier | null>(null);
  const [showVendorDueModal, setShowVendorDueModal] = useState(false);

  // Payment Recording Modal
  const [payModal, setPayModal] = useState<{ open: boolean; request: MaterialRequest | null }>({ open: false, request: null });
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'UPI / GPay' | 'Bank Transfer / NEFT' | 'Cheque'>('UPI / GPay');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [payTime, setPayTime] = useState(format(new Date(), 'hh:mm a'));
  const [payNotes, setPayNotes] = useState('');

  // Rate Editing Modal for Assigned Requisition items
  const [rateEditModal, setRateEditModal] = useState<{ open: boolean; request: MaterialRequest | null }>({ open: false, request: null });
  const [editingItems, setEditingItems] = useState<MaterialRequestItem[]>([]);

  const openPayModal = (req: MaterialRequest) => {
    setPayModal({ open: true, request: req });
    const price = req.supplierPrice ?? req.materialCost ?? 0;
    const paid = req.supplierPaidAmount || 0;
    const balance = Math.max(0, price - paid);
    // Pre-fill with remaining balance for convenience
    setPayAmount(balance > 0 ? balance.toString() : '');
    setPayMethod((req.supplierPaymentMethod as any) || 'UPI / GPay');
    setPayDate(format(new Date(), 'yyyy-MM-dd'));
    setPayTime(formatTimeString(format(new Date(), 'hh:mm a')) || '10:00 AM');
    setPayNotes('');
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal.request) return;
    const paidNowNum = Number(payAmount) || 0;
    if (paidNowNum <= 0) {
      toast.error('Please enter a payment amount greater than ₹0');
      return;
    }

    const currentReq = materialRequests.find(r => r.id === payModal.request?.id) || payModal.request;
    const existingPayments: SupplierPaymentRecord[] = currentReq.supplierPayments && currentReq.supplierPayments.length > 0
      ? [...currentReq.supplierPayments]
      : (currentReq.supplierPaidAmount && currentReq.supplierPaidAmount > 0
        ? [{
          id: 'init-' + currentReq.id,
          date: currentReq.supplierPaymentDate || currentReq.date || format(new Date(), 'yyyy-MM-dd'),
          amount: currentReq.supplierPaidAmount,
          method: currentReq.supplierPaymentMethod || 'UPI / GPay',
          notes: currentReq.supplierPaymentNotes || 'Initial payment'
        }]
        : []);

    const rateDescriptions = (currentReq.items || [])
      .map(it => `${it.name} (${it.quantity} ${it.unit || 'unit'} @ Supplier Rate: ₹${it.rate || 0}/${it.unit || 'unit'})`)
      .join(', ');

    const newRecord: SupplierPaymentRecord = {
      id: 'sp-' + Date.now(),
      date: payDate || format(new Date(), 'yyyy-MM-dd'),
      time: payTime || format(new Date(), 'hh:mm a'),
      amount: paidNowNum,
      method: payMethod,
      supplierRateDescription: rateDescriptions || undefined,
      notes: payNotes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const updatedPayments = [...existingPayments, newRecord];
    const totalPaid = updatedPayments.reduce((s, p) => s + p.amount, 0);
    const priceNum = currentReq.supplierPrice ?? currentReq.materialCost ?? 0;
    const balNum = Math.max(0, priceNum - totalPaid);

    updateMaterialRequest(currentReq.id, {
      supplierPayments: updatedPayments,
      supplierPaidAmount: totalPaid,
      supplierBalance: balNum,
      supplierPaymentMethod: payMethod,
      supplierPaymentDate: payDate,
      supplierPaymentNotes: payNotes.trim() || undefined
    });

    toast.success(`Payment of ₹${paidNowNum.toLocaleString()} via ${payMethod} recorded!`);
    setPayModal({ open: false, request: null });
  };

  const handleDeletePayment = (paymentId: string) => {
    if (!payModal.request) return;
    const currentReq = materialRequests.find(r => r.id === payModal.request?.id) || payModal.request;
    const updated = (currentReq.supplierPayments || []).filter(p => p.id !== paymentId);
    const totalPaid = updated.reduce((s, p) => s + p.amount, 0);
    const priceNum = currentReq.supplierPrice ?? currentReq.materialCost ?? 0;
    const balNum = Math.max(0, priceNum - totalPaid);

    updateMaterialRequest(currentReq.id, {
      supplierPayments: updated,
      supplierPaidAmount: totalPaid,
      supplierBalance: balNum
    });

    setPayModal(prev => ({
      ...prev,
      request: prev.request ? {
        ...prev.request,
        supplierPayments: updated,
        supplierPaidAmount: totalPaid,
        supplierBalance: balNum
      } : null
    }));
    toast.success('Payment entry deleted');
  };

  const openRateEditModal = (req: MaterialRequest) => {
    setRateEditModal({ open: true, request: req });
    setEditingItems(
      (req.items || []).map(it => {
        const supRate = it.supplierRate !== undefined ? it.supplierRate : (it.rate || 0);
        // Client selling rate
        const sellingRate = it.clientRate !== undefined ? it.clientRate : (it.customerRate !== undefined ? it.customerRate : supRate);
        const supAmount = it.supplierAmount !== undefined ? it.supplierAmount : Math.round(supRate * it.quantity * 100) / 100;
        const sellingAmount = it.clientAmount !== undefined ? it.clientAmount : Math.round(sellingRate * it.quantity * 100) / 100;
        return {
          ...it,
          rate: supRate,
          supplierRate: supRate,
          clientRate: sellingRate,
          customerRate: sellingRate,
          unit: it.unit || 'Unit',
          amount: supAmount,
          supplierAmount: supAmount,
          clientAmount: sellingAmount,
          customerAmount: sellingAmount
        };
      })
    );
  };

  const handleSaveQuantityRates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateEditModal.request) return;

    // Supplier material cost is strictly materials only: sum(supplierRate * qty). NO driver wage, NO petrol!
    const supplierMatCost = editingItems.reduce(
      (sum, it) => sum + (it.supplierAmount ?? (it.supplierRate ?? it.rate ?? 0) * it.quantity),
      0
    );
    // Client selling cost
    const sellingMatCost = editingItems.reduce(
      (sum, it) => sum + (it.clientAmount ?? (it.clientRate ?? it.rate ?? 0) * it.quantity),
      0
    );
    const existingPaid = rateEditModal.request.supplierPaidAmount || 0;
    const newBal = Math.max(0, supplierMatCost - existingPaid);

    updateMaterialRequest(rateEditModal.request.id, {
      items: editingItems,
      materialCost: supplierMatCost, // strictly material purchase cost
      supplierMaterialCost: supplierMatCost,
      supplierPrice: supplierMatCost, // Supplier bill is strictly materials! Driver pay & petrol are NOT added to supplier
      supplierBalance: newBal,
      clientMaterialCost: sellingMatCost,
      customerMaterialCost: sellingMatCost
    });

    toast.success('Rates updated for Supplier and Client!');
    setRateEditModal({ open: false, request: null });
  };

  const getReqTimestamp = (r: MaterialRequest) => {
    if (r.createdAt) {
      const t = new Date(r.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    if (r.date) {
      const t = new Date(r.date).getTime();
      if (!isNaN(t)) return t;
    }
    if (r.id && r.id.startsWith('mr_')) {
      const num = Number(r.id.split('_')[1]);
      if (!isNaN(num)) return num;
    }
    return 0;
  };

  // Filtered Lists for all tabs with Search Option
  const assignedDeliveries = useMemo(() => {
    return (materialRequests || [])
      .filter(r => r.status === 'assigned')
      .sort((a, b) => getReqTimestamp(b) - getReqTimestamp(a));
  }, [materialRequests]);

  const filteredAssignedDeliveries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return assignedDeliveries;
    return assignedDeliveries.filter(r =>
      r.siteName?.toLowerCase().includes(q) ||
      r.driverName?.toLowerCase().includes(q) ||
      r.supplierName?.toLowerCase().includes(q) ||
      r.vehicle?.toLowerCase().includes(q) ||
      r.vehicleNumber?.toLowerCase().includes(q) ||
      r.vehicleType?.toLowerCase().includes(q) ||
      r.items?.some(it => it.name.toLowerCase().includes(q))
    );
  }, [assignedDeliveries, searchQuery]);

  const filteredMaterialRequests = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (materialRequests || [])
      .filter(r => (requestFilter === 'all' ? true : r.status === requestFilter))
      .filter(r => {
        if (!q) return true;
        return (
          r.siteName?.toLowerCase().includes(q) ||
          r.requestedByStaffName?.toLowerCase().includes(q) ||
          r.driverName?.toLowerCase().includes(q) ||
          r.supplierName?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q) ||
          r.items?.some(it => it.name.toLowerCase().includes(q) || (it.unit && it.unit.toLowerCase().includes(q)))
        );
      })
      .sort((a, b) => getReqTimestamp(b) - getReqTimestamp(a));
  }, [materialRequests, requestFilter, searchQuery]);

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (suppliers || []).filter(sup => {
      if (supplierMaterialFilter !== 'all') {
        const supMats = [
          ...(sup.suppliedMaterials || []),
          ...(typeof sup.materialsSupplied === 'string'
            ? sup.materialsSupplied.split(',').map(x => x.trim())
            : (Array.isArray(sup.materialsSupplied) ? (sup.materialsSupplied as string[]) : []))
        ].map(x => x.toLowerCase());
        if (!supMats.some(x => x.includes(supplierMaterialFilter))) return false;
      }
      if (!q) return true;
      const allMats = (sup.suppliedMaterials || []).join(' ') + ' ' + (typeof sup.materialsSupplied === 'string' ? sup.materialsSupplied : '');
      return (
        sup.name.toLowerCase().includes(q) ||
        sup.phone?.toLowerCase().includes(q) ||
        sup.address?.toLowerCase().includes(q) ||
        sup.notes?.toLowerCase().includes(q) ||
        allMats.toLowerCase().includes(q)
      );
    });
  }, [suppliers, supplierMaterialFilter, searchQuery]);

  const filteredVehicles = useMemo(() => {
    const list = Array.isArray(vehicles) ? vehicles : [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(v =>
      (v.name || '').toLowerCase().includes(q) ||
      (v.number || '').toLowerCase().includes(q) ||
      (v.type || '').toLowerCase().includes(q) ||
      (v.notes || '').toLowerCase().includes(q)
    );
  }, [vehicles, searchQuery]);

  const filteredMaterialSettings = useMemo(() => {
    let list = materialSettings || [];
    if (matTypeFilter === 'standard') {
      list = list.filter(m => !m.isRental && !m.isStoreRoom);
    } else if (matTypeFilter === 'rental') {
      list = list.filter(m => m.isRental);
    } else if (matTypeFilter === 'store_room') {
      list = list.filter(m => m.isStoreRoom);
    }
    if (selectedMatCategoryFilter !== 'all') {
      list = list.filter(m => (m.category || 'General').toLowerCase() === selectedMatCategoryFilter.toLowerCase());
    }
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.category && m.category.toLowerCase().includes(q)) ||
      m.unit?.toLowerCase().includes(q) ||
      m.perUnitWeight?.toLowerCase().includes(q) ||
      (m.storeRoomLocation && m.storeRoomLocation.toLowerCase().includes(q))
    );
  }, [materialSettings, searchQuery, selectedMatCategoryFilter, matTypeFilter]);

  // Store Room & Central Warehouse Memos
  const storeRoomItems = useMemo(() => {
    return (materialSettings || []).filter(m => m.isStoreRoom);
  }, [materialSettings]);

  const lowStockStoreItems = useMemo(() => {
    return storeRoomItems.filter(m => (m.stockQuantity || 0) <= (m.minStockAlert ?? 10));
  }, [storeRoomItems]);

  // Store Room Financial KPIs: Revenue earned from site billing & Total purchases / inventory asset cost
  const totalStoreRoomRevenue = useMemo(() => {
    // 1. From returned Store Room dispatches
    const dispatchAmt = (storeRoomDispatches || [])
      .filter(d => d.status === 'returned')
      .reduce((sum, d) => sum + (Number(d.storeRoomAmount) || Number(d.storeRoomProfit) || 0), 0);

    // 2. From completed Store Room Material Requests (avoid double counting by checking ID)
    const reqAmt = (materialRequests || [])
      .filter(r => (r.sourceType === 'store_room' || r.isStoreRoom) && r.status === 'completed' && !(storeRoomDispatches || []).some(d => d.id === r.id))
      .reduce((sum, r) => sum + (Number(r.storeRoomAmount) || Number(r.materialCost) || 0), 0);

    return dispatchAmt + reqAmt;
  }, [storeRoomDispatches, materialRequests]);

  const totalCrushedLoss = useMemo(() => {
    return (crushedStockHistory || []).reduce((sum, c) => sum + (Number(c.lossAmount) || 0), 0);
  }, [crushedStockHistory]);

  const totalStoreRoomPurchases = useMemo(() => {
    const matTotal = (materialSettings || [])
      .filter(m => m.isStoreRoom)
      .reduce((sum, m) => {
        const recordedCost = Number(m.totalPurchaseCost) || 0;
        const currentAssetVal = (Number(m.stockQuantity) || 0) * (Number(m.buyingPrice) || 0);
        return sum + Math.max(recordedCost, currentAssetVal);
      }, 0);

    const expenseTotal = (manualExpenses || [])
      .filter(e => e.siteId === 'store_room' || e.category === 'Store Room Stock Purchase')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Crushed stock loss is added so crushing stock CANNOT minus the purchase expense!
    return Math.max(matTotal + totalCrushedLoss, expenseTotal + totalCrushedLoss);
  }, [materialSettings, manualExpenses, totalCrushedLoss]);

  const newStockStoreItemsCount = useMemo(() => {
    return storeRoomItems.filter(m => getStoreRoomStockClassification(m, storeRoomItems).isNewStock).length;
  }, [storeRoomItems]);

  const oldStockStoreItemsCount = useMemo(() => {
    return storeRoomItems.filter(m => getStoreRoomStockClassification(m, storeRoomItems).isOldStock).length;
  }, [storeRoomItems]);

  const filteredStoreRoomItems = useMemo(() => {
    let list = storeRoomItems;
    if (storeRoomFilter === 'low_stock') {
      list = list.filter(m => (m.stockQuantity || 0) <= (m.minStockAlert ?? 10) && (m.stockQuantity || 0) > 0);
    } else if (storeRoomFilter === 'out_of_stock') {
      list = list.filter(m => (m.stockQuantity || 0) <= 0);
    } else if (storeRoomFilter === 'new_stock') {
      list = list.filter(m => getStoreRoomStockClassification(m, storeRoomItems).isNewStock);
    } else if (storeRoomFilter === 'old_stock') {
      list = list.filter(m => getStoreRoomStockClassification(m, storeRoomItems).isOldStock);
    }
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.category && m.category.toLowerCase().includes(q)) ||
      (m.storeRoomLocation && m.storeRoomLocation.toLowerCase().includes(q)) ||
      (m.unit && m.unit.toLowerCase().includes(q))
    );
  }, [storeRoomItems, storeRoomFilter, searchQuery]);

  const filteredStoreRoomDispatches = useMemo(() => {
    const list = storeRoomDispatches || [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(d =>
      d.materialName.toLowerCase().includes(q) ||
      d.siteName.toLowerCase().includes(q) ||
      (d.vehicleNumber && d.vehicleNumber.toLowerCase().includes(q)) ||
      (d.driverName && d.driverName.toLowerCase().includes(q)) ||
      (d.notes && d.notes.toLowerCase().includes(q))
    );
  }, [storeRoomDispatches, searchQuery]);

  const activeStoreRoomDispatches = useMemo(() => {
    const list = [...(storeRoomDispatches || []).filter(d => d.status !== 'returned')];

    // Also include any active/delivered Store Room requests that are not yet marked returned and not already represented
    (materialRequests || []).forEach(r => {
      const isStoreRoomReq = r.isStoreRoom || r.sourceType === 'store_room';
      if (!isStoreRoomReq) return;
      if (r.returnDate) return; // already returned

      (r.items || []).forEach(it => {
        const alreadyInList = list.some(d =>
          d.siteId === r.siteId &&
          d.materialName.toLowerCase().trim() === it.name.toLowerCase().trim()
        );
        if (!alreadyInList) {
          list.push({
            id: `req_disp_${r.id}_${it.id || it.name}`,
            materialId: `mat_${it.name}`,
            materialName: it.name,
            category: 'Store Room',
            siteId: r.siteId,
            siteName: r.siteName,
            quantity: Number(it.quantity) || 1,
            unit: it.unit || 'Units',
            vehicleNumber: r.vehicleNumber || r.vehicle,
            driverId: r.driverId,
            driverName: r.driverName,
            dispatchedBy: r.requestedByStaffName || 'Admin',
            date: r.deliveryDate || r.startDate || r.date,
            startDate: r.startDate || r.date,
            deliveryDate: r.deliveryDate || r.startDate || r.date,
            time: r.time,
            status: 'active',
            notes: r.notes
          });
        }
      });
    });

    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(d =>
      d.materialName.toLowerCase().includes(q) ||
      d.siteName.toLowerCase().includes(q) ||
      (d.vehicleNumber && d.vehicleNumber.toLowerCase().includes(q)) ||
      (d.driverName && d.driverName.toLowerCase().includes(q)) ||
      (d.notes && d.notes.toLowerCase().includes(q))
    );
  }, [storeRoomDispatches, materialRequests, searchQuery]);

  const activeProductsGrouped = useMemo<ActiveProductGroupData[]>(() => {
    const map = new Map<string, {
      key: string;
      materialId: string;
      materialName: string;
      category: string;
      unit: string;
      storeRoomLocation: string;
      warehouseStock: number;
      minStockAlert: number;
      rentalRatePerDay: number;
      totalActiveQuantity: number;
      sitesMap: Map<string, { qty: number; siteId?: string; unit: string }>;
      maxDaysDeployed: number;
      earliestDeliveryDate: string;
      dispatches: StoreRoomDispatchRecord[];
    }>();

    activeStoreRoomDispatches.forEach(record => {
      const key = (record.materialId || record.materialName || '').toLowerCase().trim();
      if (!key) return;

      const mat = (materialSettings || []).find(
        m => m.id === record.materialId || m.name.toLowerCase().trim() === record.materialName.toLowerCase().trim()
      );

      const delivDateStr = record.deliveryDate || record.startDate || record.date || todayStr;
      let daysDeployed = 1;
      try {
        const s = new Date(delivDateStr);
        const now = new Date();
        if (!isNaN(s.getTime())) {
          daysDeployed = Math.max(1, Math.ceil((now.getTime() - s.getTime()) / (1000 * 3600 * 24)));
        }
      } catch {
        daysDeployed = 1;
      }

      if (!map.has(key)) {
        map.set(key, {
          key,
          materialId: record.materialId || mat?.id || '',
          materialName: record.materialName || mat?.name || 'Unknown Product',
          category: record.category || mat?.category || 'General',
          unit: record.unit || mat?.unit || 'Units',
          storeRoomLocation: mat?.storeRoomLocation || 'Main Store Room',
          warehouseStock: Number(mat?.stockQuantity) || 0,
          minStockAlert: Number(mat?.minStockAlert) || 10,
          rentalRatePerDay: Number(record.perDayRate || mat?.rentalRatePerDay || mat?.defaultRate || 0),
          totalActiveQuantity: 0,
          sitesMap: new Map(),
          maxDaysDeployed: 0,
          earliestDeliveryDate: delivDateStr,
          dispatches: []
        });
      }

      const item = map.get(key)!;
      const recQty = Number(record.quantity) || 0;
      item.totalActiveQuantity += recQty;

      const sMap = item.sitesMap;
      const existingSite = sMap.get(record.siteName);
      if (existingSite) {
        existingSite.qty += recQty;
      } else {
        sMap.set(record.siteName, { qty: recQty, siteId: record.siteId, unit: record.unit || item.unit });
      }

      if (daysDeployed > item.maxDaysDeployed) {
        item.maxDaysDeployed = daysDeployed;
      }
      if (delivDateStr < item.earliestDeliveryDate) {
        item.earliestDeliveryDate = delivDateStr;
      }
      item.dispatches.push(record);
    });

    return Array.from(map.values()).map(p => ({
      ...p,
      uniqueSitesCount: p.sitesMap.size,
      sitesList: Array.from(p.sitesMap.entries()).map(([siteName, data]) => ({
        siteName,
        siteId: data.siteId,
        qty: data.qty,
        unit: data.unit
      }))
    }));
  }, [activeStoreRoomDispatches, materialSettings, todayStr]);

  const currentActiveProductReport = useMemo(() => {
    if (!selectedActiveProductReport) return null;
    return activeProductsGrouped.find(p => p.key === selectedActiveProductReport.key) || selectedActiveProductReport;
  }, [selectedActiveProductReport, activeProductsGrouped]);

  const activeStoreRoomRequests = useMemo(() => {
    const list = (materialRequests || []).filter(r => (r.sourceType === 'store_room' || r.isStoreRoom) && r.status !== 'completed');
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(r =>
      r.siteName.toLowerCase().includes(q) ||
      (r.driverName && r.driverName.toLowerCase().includes(q)) ||
      (r.items || []).some(it => it.name.toLowerCase().includes(q))
    );
  }, [materialRequests, searchQuery]);

  const filteredRentals = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (materialRentals || [])
      .filter(r => rentalStatusFilter === 'all' ? true : r.status === rentalStatusFilter)
      .filter(r => {
        if (!q) return true;
        return (
          r.materialName.toLowerCase().includes(q) ||
          r.siteName.toLowerCase().includes(q) ||
          (r.driverName && r.driverName.toLowerCase().includes(q)) ||
          (r.notes && r.notes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.startDate + 'T00:00:00').getTime() - new Date(a.startDate + 'T00:00:00').getTime());
  }, [materialRentals, rentalStatusFilter, searchQuery]);

  // Comprehensive Vendor Dues Summary across ALL tabs and orders (how much we need to give vendors)
  const vendorPaymentSummary = useMemo(() => {
    let totalBilled = 0;
    let totalPaid = 0;
    let totalToGiveVendors = 0;
    const vendorMap = new Map<string, {
      name: string;
      supplierId?: string;
      billed: number;
      paid: number;
      balance: number;
      ordersCount: number;
      unpaidOrdersCount: number;
      phone?: string;
      orders: MaterialRequest[];
    }>();

    (materialRequests || []).forEach(r => {
      const itemCost = (r.items || []).reduce(
        (sum, it) => sum + (it.supplierAmount ?? (it.supplierRate ?? it.rate ?? 0) * it.quantity),
        0
      );
      const bill = r.supplierPrice ?? r.supplierMaterialCost ?? (itemCost > 0 ? itemCost : (r.materialCost || 0));
      const paid = r.supplierPaidAmount || 0;
      const balance = Math.max(0, bill - paid);

      totalBilled += bill;
      totalPaid += paid;
      totalToGiveVendors += balance;

      const supName = (r.supplierName || '').trim() || 'Unassigned Vendor';
      const existing = vendorMap.get(supName) || {
        name: supName,
        supplierId: r.supplierId,
        billed: 0,
        paid: 0,
        balance: 0,
        ordersCount: 0,
        unpaidOrdersCount: 0,
        phone: (suppliers || []).find(s => s.name.toLowerCase() === supName.toLowerCase() || s.id === r.supplierId)?.phone,
        orders: [],
      };
      existing.billed += bill;
      existing.paid += paid;
      existing.balance += balance;
      existing.ordersCount += 1;
      if (balance > 0) existing.unpaidOrdersCount += 1;
      existing.orders.push(r);
      vendorMap.set(supName, existing);
    });

    // Also register any suppliers without orders
    (suppliers || []).forEach(sup => {
      if (!vendorMap.has(sup.name.trim())) {
        vendorMap.set(sup.name.trim(), {
          name: sup.name.trim(),
          supplierId: sup.id,
          billed: 0,
          paid: 0,
          balance: 0,
          ordersCount: 0,
          unpaidOrdersCount: 0,
          phone: sup.phone,
          orders: [],
        });
      }
    });

    const vendorsList = Array.from(vendorMap.values()).sort((a, b) => b.balance - a.balance);

    const pendingReqsDue = (materialRequests || [])
      .filter(r => r.status === 'pending')
      .reduce((sum, r) => {
        const cost = (r.items || []).reduce((s, it) => s + (it.supplierAmount ?? (it.supplierRate ?? it.rate ?? 0) * it.quantity), 0);
        const bill = r.supplierPrice ?? cost;
        return sum + Math.max(0, bill - (r.supplierPaidAmount || 0));
      }, 0);

    const inTransitDue = (materialRequests || [])
      .filter(r => r.status === 'assigned')
      .reduce((sum, r) => {
        const cost = (r.items || []).reduce((s, it) => s + (it.supplierAmount ?? (it.supplierRate ?? it.rate ?? 0) * it.quantity), 0);
        const bill = r.supplierPrice ?? cost;
        return sum + Math.max(0, bill - (r.supplierPaidAmount || 0));
      }, 0);

    const completedDue = (materialRequests || [])
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => {
        const cost = (r.items || []).reduce((s, it) => s + (it.supplierAmount ?? (it.supplierRate ?? it.rate ?? 0) * it.quantity), 0);
        const bill = r.supplierPrice ?? cost;
        return sum + Math.max(0, bill - (r.supplierPaidAmount || 0));
      }, 0);

    return {
      totalBilled,
      totalPaid,
      totalToGiveVendors,
      vendorsList,
      vendorsWithDue: vendorsList.filter(v => v.balance > 0),
      vendorsWithDueCount: vendorsList.filter(v => v.balance > 0).length,
      pendingReqsDue,
      inTransitDue,
      completedDue,
    };
  }, [materialRequests, suppliers]);

  const handleSelectRentalMaterial = (id: string) => {
    setRentalMatId(id);
    const setting = materialSettings.find(m => m.id === id);
    if (setting) {
      setRentalMatName(setting.name);
      setRentalUnit(setting.unit || 'Sets');
      setRentalRatePerDay((setting.rentalRatePerDay || setting.defaultRate || '').toString());
    }
  };

  const handleDeployRental = (e: React.FormEvent) => {
    e.preventDefault();
    const finalMatName = rentalMatName.trim();
    if (!finalMatName) { toast.error('Please enter or select rental material'); return; }
    if (!rentalSiteId) { toast.error('Please select destination site'); return; }
    const siteObj = sites.find(s => s.id === rentalSiteId);
    if (!siteObj) { toast.error('Site not found'); return; }
    const qty = Number(rentalQuantity) || 1;
    const rate = Number(rentalRatePerDay) || 0;

    const driverObj = rentalRequiresDriver ? driversList.find(d => d.id === rentalDriverId) : undefined;
    const vehObj = rentalRequiresDriver ? vehicles.find(v => v.id === rentalVehicleId) : undefined;

    addMaterialRental({
      materialId: rentalMatId || `m_${Date.now()}`,
      materialName: finalMatName,
      siteId: siteObj.id,
      siteName: siteObj.name,
      startDate: rentalStartDate || format(new Date(), 'yyyy-MM-dd'),
      quantity: qty,
      unit: rentalUnit || 'Sets',
      requiresDriver: rentalRequiresDriver,
      driverId: driverObj?.id,
      driverName: driverObj?.name,
      vehicleId: vehObj?.id,
      vehicleNumber: vehObj?.number,
      transitCost: rentalRequiresDriver ? (Number(rentalTransitCost) || 0) : 0,
      rentalRatePerDay: rate,
      status: 'active',
      notes: rentalNotes.trim() || undefined
    });

    toast.success(`Rental deployment of ${qty} ${rentalUnit} ${finalMatName} to ${siteObj.name} initiated!`);
    setShowDeployRentalModal(false);
    setRentalMatId(''); setRentalMatName(''); setRentalSiteId('');
    setRentalQuantity('1'); setRentalRequiresDriver(false);
    setRentalDriverId(''); setRentalVehicleId(''); setRentalTransitCost('');
    setRentalRatePerDay(''); setRentalNotes('');
  };

  const openReturnModal = (rental: MaterialRental) => {
    setReturnModal({ open: true, rental });
    setReturnEndDate(format(new Date(), 'yyyy-MM-dd'));
    setReturnRatePerDay((rental.rentalRatePerDay || 0).toString());
    setReturnNotes(rental.notes || '');
  };

  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModal.rental) return;
    const r = returnModal.rental;
    const startMs = new Date(r.startDate + 'T00:00:00').getTime();
    const endMs = new Date(returnEndDate + 'T00:00:00').getTime();
    const totalDays = Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1);
    const rate = Number(returnRatePerDay) || 0;
    const materialCost = totalDays * r.quantity * rate;
    const totalCost = materialCost + (r.transitCost || 0);

    updateMaterialRental(r.id, {
      endDate: returnEndDate,
      rentalRatePerDay: rate,
      totalDays,
      totalRentalCost: totalCost,
      status: 'returned',
      notes: returnNotes.trim() || r.notes
    });

    toast.success(`Rental closed for ${r.materialName}! Total calculated: ₹${totalCost.toLocaleString()}`);
    setReturnModal({ open: false, rental: null });
  };

  // Handlers for Material Presets
  const handleMaterialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName.trim()) { toast.error('Enter material name'); return; }
    const formattedMatName = getBaseMaterialName(matName.trim());
    const storeQty = isStoreRoomMat ? (Number(matStockQuantity) || 0) : undefined;
    const storeMinAlert = isStoreRoomMat ? (Number(matMinStockAlert) || 10) : undefined;
    const storeLoc = isStoreRoomMat ? (matStoreRoomLocation.trim() || undefined) : undefined;
    const storeBuying = isStoreRoomMat ? (Number(matBuyingPrice) || 0) : undefined;
    const initialPurchaseCost = isStoreRoomMat ? ((storeQty || 0) * (storeBuying || 0)) : 0;

    if (editingMatId) {
      updateMaterialSetting(editingMatId, {
        name: formattedMatName,
        category: matCategory.trim() || 'General',
        unit: matUnit.trim() || 'Unit',
        perUnitWeight: matWeight.trim() || undefined,
        defaultRate: 0,
        isRental: isRentalMat,
        rentalRatePerDay: isRentalMat ? (Number(matRentalRate) || 0) : undefined,
        isStoreRoom: isStoreRoomMat,
        stockQuantity: storeQty,
        minStockAlert: storeMinAlert,
        storeRoomLocation: storeLoc,
        buyingPrice: storeBuying,
      });

      if (isRentalMat && rentalDeploySiteId && rentalDeploySiteId !== 'none') {
        const targetSite = sites.find(s => s.id === rentalDeploySiteId);
        if (targetSite) {
          addMaterialRental({
            materialId: editingMatId,
            materialName: formattedMatName,
            siteId: targetSite.id,
            siteName: targetSite.name,
            startDate: format(new Date(), 'yyyy-MM-dd'),
            quantity: 1,
            unit: matUnit.trim() || 'Nos',
            rentalRatePerDay: Number(matRentalRate) || 0,
            status: 'active',
            notes: 'Deployed via Material Catalog'
          });
          toast.success(`Rental material updated & deployed to ${targetSite.name}!`);
        }
      } else {
        toast.success(isRentalMat ? 'Rental material preset updated!' : (isStoreRoomMat ? 'Store Room item updated!' : 'Material preset updated!'));
      }
      setEditingMatId(null);
    } else {
      const newMatId = `mat_${Date.now()}`;
      addMaterialSetting({
        name: formattedMatName,
        category: matCategory.trim() || 'General',
        unit: matUnit.trim() || 'Unit',
        perUnitWeight: matWeight.trim() || undefined,
        defaultRate: 0,
        isRental: isRentalMat,
        rentalRatePerDay: isRentalMat ? (Number(matRentalRate) || 0) : undefined,
        isStoreRoom: isStoreRoomMat,
        stockQuantity: storeQty,
        minStockAlert: storeMinAlert,
        storeRoomLocation: storeLoc,
        buyingPrice: storeBuying,
        totalPurchaseCost: initialPurchaseCost,
      });

      // Record initial inventory investment to Company Expenses if initial stock was bought
      if (isStoreRoomMat && initialPurchaseCost > 0) {
        addExpense({
          siteId: 'store_room',
          siteName: 'Central Store Room & Warehouse',
          date: format(new Date(), 'yyyy-MM-dd'),
          amount: initialPurchaseCost,
          category: 'Store Room Stock Purchase',
          description: `Initial stock purchase: ${storeQty} ${matUnit.trim() || 'units'} of "${formattedMatName}" for Store Room inventory @ ₹${storeBuying}/unit`
        });
      }

      if (isRentalMat && rentalDeploySiteId && rentalDeploySiteId !== 'none') {
        const targetSite = sites.find(s => s.id === rentalDeploySiteId);
        if (targetSite) {
          addMaterialRental({
            materialId: newMatId,
            materialName: formattedMatName,
            siteId: targetSite.id,
            siteName: targetSite.name,
            startDate: format(new Date(), 'yyyy-MM-dd'),
            quantity: 1,
            unit: matUnit.trim() || 'Nos',
            rentalRatePerDay: Number(matRentalRate) || 0,
            status: 'active',
            notes: 'Deployed via Material Catalog'
          });
          toast.success(`Rental material added to catalog & deployed to ${targetSite.name}!`);
        }
      } else {
        toast.success(isRentalMat ? 'Rental material added to catalog!' : (isStoreRoomMat ? `Store Room item added! ₹${initialPurchaseCost.toLocaleString()} logged to expenses.` : 'Material preset added!'));
      }
    }
    setMatName(''); setMatCategory('Civil & Structural'); setMatUnit(''); setMatWeight(''); setMatRate('');
    setIsRentalMat(false); setMatRentalRate(''); setRentalDeploySiteId('');
    setIsStoreRoomMat(false); setMatStockQuantity(''); setMatMinStockAlert('10'); setMatStoreRoomLocation(''); setMatBuyingPrice('');
  };

  // Store Room Dispatch Handler
  const handleDispatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchSelectedMaterial) return;
    const qty = Number(dispatchQuantity);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid dispatch quantity');
      return;
    }
    const currentStock = dispatchSelectedMaterial.stockQuantity || 0;
    if (currentStock <= 0) {
      toast.error(`"${dispatchSelectedMaterial.name}" is OUT OF STOCK in Store Room (0 available). Cannot dispatch.`);
      return;
    }
    if (qty > currentStock) {
      toast.error(`Out of range! Cannot dispatch ${qty} ${dispatchSelectedMaterial.unit || 'units'}. Only ${currentStock} available in warehouse!`);
      return;
    }
    if (!dispatchSiteId) {
      toast.error('Please select destination construction site');
      return;
    }
    const targetSite = sites.find(s => s.id === dispatchSiteId);
    if (!targetSite) {
      toast.error('Destination site not found');
      return;
    }

    const vehObj = dispatchVehicleId && dispatchVehicleId !== 'none' ? vehicles.find(v => v.id === dispatchVehicleId) : undefined;
    const driverObj = dispatchDriverId && dispatchDriverId !== 'none' ? (staffList.find(s => s.id === dispatchDriverId) || driversList.find(d => d.id === dispatchDriverId)) : undefined;

    // 1. Deduct stock from Store Room material
    const updatedStock = Math.max(0, currentStock - qty);
    updateMaterialSetting(dispatchSelectedMaterial.id, {
      stockQuantity: updatedStock
    });

    const dispatchStartDateVal = dispatchDate || format(new Date(), 'yyyy-MM-dd');

    // 2. Add Store Room Dispatch Log
    addStoreRoomDispatch({
      materialId: dispatchSelectedMaterial.id,
      materialName: dispatchSelectedMaterial.name,
      category: dispatchSelectedMaterial.category,
      siteId: targetSite.id,
      siteName: targetSite.name,
      quantity: qty,
      unit: dispatchSelectedMaterial.unit || 'Unit',
      vehicleId: vehObj?.id,
      vehicleNumber: vehObj?.number,
      driverId: driverObj?.id,
      driverName: driverObj?.name,
      dispatchedBy: currentUser?.name || 'Store Room',
      date: dispatchStartDateVal,
      startDate: dispatchStartDateVal,
      time: dispatchTime || format(new Date(), 'hh:mm a'),
      status: 'active',
      notes: dispatchNotes.trim() || undefined
    });

    // 3. Create assigned Material Request for active driver delivery tracking
    const vehDesc = vehObj ? `${vehObj.name} (${vehObj.number})` : undefined;
    addMaterialRequest({
      siteId: targetSite.id,
      siteName: targetSite.name,
      date: dispatchStartDateVal,
      time: dispatchTime || format(new Date(), 'hh:mm a'),
      items: [{
        id: `item_${Date.now()}`,
        name: dispatchSelectedMaterial.name,
        quantity: qty,
        unit: dispatchSelectedMaterial.unit || 'Unit',
        rate: 0,
        amount: 0,
      }],
      notes: `Dispatched from Store Room (${dispatchSelectedMaterial.storeRoomLocation || 'Main Warehouse'}). ${dispatchNotes}`.trim(),
      requestedByStaffName: currentUser?.name || 'Store Room',
      sourceType: 'store_room',
      sourceSiteName: `Store Room (${dispatchSelectedMaterial.storeRoomLocation || 'Main Warehouse'})`,
      isStoreRoom: true,
      startDate: dispatchStartDateVal,
      driverId: driverObj?.id,
      driverName: driverObj?.name,
      vehicle: vehDesc,
      vehicleNumber: vehObj?.number,
      vehicleType: vehObj?.type,
      status: 'assigned',
    });

    toast.success(`Dispatched ${qty} ${dispatchSelectedMaterial.unit || 'units'} of ${dispatchSelectedMaterial.name} to ${targetSite.name}! ${vehObj ? `Vehicle: ${vehObj.number}` : '(No vehicle assigned)'}`);
    setShowDispatchModal(false);
    setDispatchSelectedMaterial(null);
    setDispatchSiteId('');
    setDispatchQuantity('1');
    setDispatchVehicleId('');
    setDispatchDriverId('');
    setDispatchNotes('');
  };

  // Helper to open Return / Transfer Store Room modal with auto-calculated duration & rate
  const openReturnStoreRoomItemModal = (record?: StoreRoomDispatchRecord | null, req?: MaterialRequest | null) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const matName = record?.materialName || req?.items?.[0]?.name || '';
    const mat = (materialSettings || []).find(m => m.name.toLowerCase() === matName.toLowerCase() || m.id === record?.materialId);
    const delivDate = record?.deliveryDate || record?.startDate || record?.date || req?.deliveryDate || req?.startDate || req?.date || today;

    let totalDays = 1;
    try {
      const s = new Date(delivDate);
      const r = new Date(today);
      if (!isNaN(s.getTime()) && !isNaN(r.getTime())) {
        totalDays = Math.max(1, Math.ceil((r.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      }
    } catch {}

    const totalQty = record?.quantity || req?.items?.[0]?.quantity || 1;
    const dailyRate = record?.perDayRate || mat?.rentalRatePerDay || 0;
    const unitRate = mat?.buyingPrice || mat?.defaultRate || 0;

    const initialMode: 'daily' | 'unit' = dailyRate > 0 ? 'daily' : (unitRate > 0 ? 'unit' : 'daily');
    const computedAmt = initialMode === 'daily'
      ? (dailyRate > 0 ? totalDays * dailyRate * totalQty : '')
      : (unitRate > 0 ? unitRate * totalQty : '');

    const currentSiteId = record?.siteId || req?.siteId || '';
    const otherSitesList = (sites || []).filter(s => s.id !== currentSiteId);

    setReturnStoreRoomModal({
      open: true,
      dispatchRecord: record || null,
      requestRecord: req || null
    });
    setStoreRoomDeliveryDate(delivDate);
    setStoreRoomReturnDate(today);
    setReturnDestinationType('store_room');
    setReturnTransferSiteId(otherSitesList[0]?.id || '');
    setReturnTransferCount('0');
    setReturnStoreRoomCount(String(totalQty));
    setReturnRateMode(initialMode);
    setStoreRoomPerDayRate(dailyRate > 0 ? String(dailyRate) : '');
    setStoreRoomUnitRate(unitRate > 0 ? String(unitRate) : '');
    setStoreRoomBilledAmount(computedAmt ? String(computedAmt) : '');
    setStoreRoomRestock(true);
    setStoreRoomReturnNotes('');
    const initVehId = record?.vehicleId || 'none';
    const initDriverId = record?.driverId || 'none';
    setReturnVehicleId(initVehId);
    setReturnDriverId(initDriverId);
    setSplitReturnVehicleId(initVehId);
    setSplitReturnDriverId(initDriverId);
    setSameDriverVehicleForSplit(true);
  };

  const modalDeliveryDate = storeRoomDeliveryDate || returnStoreRoomModal.dispatchRecord?.deliveryDate || returnStoreRoomModal.dispatchRecord?.startDate || returnStoreRoomModal.dispatchRecord?.date || returnStoreRoomModal.requestRecord?.deliveryDate || returnStoreRoomModal.requestRecord?.startDate || returnStoreRoomModal.requestRecord?.date || format(new Date(), 'yyyy-MM-dd');

  const modalTotalDays = useMemo(() => {
    try {
      const s = new Date(modalDeliveryDate);
      const r = new Date(storeRoomReturnDate || format(new Date(), 'yyyy-MM-dd'));
      if (isNaN(s.getTime()) || isNaN(r.getTime())) return 1;
      const diff = Math.ceil((r.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(1, diff + 1);
    } catch {
      return 1;
    }
  }, [modalDeliveryDate, storeRoomReturnDate]);

  // Store Room Item Return & Bill Site Handler (Supports Warehouse Return OR Transfer to Other Site)
  const handleReturnStoreRoomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const { dispatchRecord, requestRecord } = returnStoreRoomModal;
    const billedAmt = Number(storeRoomBilledAmount) || 0;
    const retDate = storeRoomReturnDate || format(new Date(), 'yyyy-MM-dd');
    const perDayRateNum = Number(storeRoomPerDayRate) || 0;

    const matName = dispatchRecord?.materialName || requestRecord?.items?.[0]?.name || 'Store Room Item';
    const qty = dispatchRecord?.quantity || requestRecord?.items?.[0]?.quantity || 1;
    const unit = dispatchRecord?.unit || requestRecord?.items?.[0]?.unit || 'Units';
    const originalSiteId = dispatchRecord?.siteId || requestRecord?.siteId || '';
    const originalSiteName = dispatchRecord?.siteName || requestRecord?.siteName || 'Project Site';
    const mat = (materialSettings || []).find(m => m.name.toLowerCase() === matName.toLowerCase() || m.id === dispatchRecord?.materialId);

    const totalQty = qty;
    let transferQty = 0;
    let storeRoomQty = 0;

    if (returnDestinationType === 'store_room') {
      transferQty = 0;
      storeRoomQty = totalQty;
    } else if (returnDestinationType === 'other_site') {
      transferQty = totalQty;
      storeRoomQty = 0;
    } else if (returnDestinationType === 'split') {
      const tCount = Math.max(0, Math.min(totalQty, Number(returnTransferCount) || 0));
      transferQty = tCount;
      storeRoomQty = Math.max(0, totalQty - tCount);
    }

    if (transferQty > 0 && !returnTransferSiteId) {
      toast.error('Please select a destination site for the transferred items');
      return;
    }

    const targetTransferSite = transferQty > 0 ? sites.find(s => s.id === returnTransferSiteId) : null;

    const primaryVehObj = returnVehicleId && returnVehicleId !== 'none' ? vehicles.find(v => v.id === returnVehicleId) : undefined;
    const primaryDriverObj = returnDriverId && returnDriverId !== 'none' ? (staffList.find(s => s.id === returnDriverId) || driversList.find(d => d.id === returnDriverId)) : undefined;
    const primaryVehDesc = primaryVehObj ? `${primaryVehObj.name} (${primaryVehObj.number})` : undefined;

    const storeVehId = (returnDestinationType === 'split' && !sameDriverVehicleForSplit) ? splitReturnVehicleId : returnVehicleId;
    const storeDriverId = (returnDestinationType === 'split' && !sameDriverVehicleForSplit) ? splitReturnDriverId : returnDriverId;

    const storeRoomVehObj = storeVehId && storeVehId !== 'none' ? vehicles.find(v => v.id === storeVehId) : undefined;
    const storeRoomDriverObj = storeDriverId && storeDriverId !== 'none' ? (staffList.find(s => s.id === storeDriverId) || driversList.find(d => d.id === storeDriverId)) : undefined;
    const storeRoomVehDesc = storeRoomVehObj ? `${storeRoomVehObj.name} (${storeRoomVehObj.number})` : undefined;

    let actionDescription = '';
    if (returnDestinationType === 'store_room') {
      actionDescription = `Returned all ${totalQty} ${unit} to Store Room warehouse${storeRoomDriverObj ? ` via driver ${storeRoomDriverObj.name}` : ''}${storeRoomVehDesc ? ` in ${storeRoomVehDesc}` : ''}.`;
    } else if (returnDestinationType === 'other_site') {
      actionDescription = `Transferred all ${totalQty} ${unit} to ${targetTransferSite?.name || 'target site'}${primaryDriverObj ? ` via driver ${primaryDriverObj.name}` : ''}${primaryVehDesc ? ` in ${primaryVehDesc}` : ''}.`;
    } else {
      actionDescription = `Split: ${transferQty} ${unit} transferred to ${targetTransferSite?.name || 'target site'}${primaryDriverObj ? ` (${primaryDriverObj.name})` : ''}, and ${storeRoomQty} ${unit} returned to Store Room${storeRoomDriverObj ? ` (${storeRoomDriverObj.name})` : ''}.`;
    }

    // 1. If dispatchRecord exists, update it to returned / transferred
    if (dispatchRecord) {
      updateStoreRoomDispatch(dispatchRecord.id, {
        status: 'returned',
        deliveryDate: modalDeliveryDate,
        returnDate: retDate,
        totalDays: modalTotalDays,
        perDayRate: perDayRateNum,
        storeRoomAmount: billedAmt,
        storeRoomProfit: billedAmt,
        destinationType: returnDestinationType,
        transferToSiteId: targetTransferSite?.id,
        transferToSiteName: targetTransferSite?.name,
        returnDriverId: storeRoomDriverObj?.id,
        returnDriverName: storeRoomDriverObj?.name,
        returnVehicleId: storeRoomVehObj?.id,
        returnVehicleNumber: storeRoomVehObj?.number,
        notes: (dispatchRecord.notes ? `${dispatchRecord.notes} | ` : '') +
          `${actionDescription} ` +
          (storeRoomReturnNotes ? `Notes: ${storeRoomReturnNotes}` : '')
      });
    }

    // 2. If matching materialRequest exists, update it to completed with materialCost = billedAmt & return vehicle/driver
    if (requestRecord) {
      updateMaterialRequest(requestRecord.id, {
        status: 'completed',
        deliveryDate: modalDeliveryDate,
        returnDate: retDate,
        materialCost: billedAmt,
        clientMaterialCost: billedAmt,
        storeRoomAmount: billedAmt,
        storeRoomProfit: billedAmt,
        driverId: storeRoomDriverObj?.id || requestRecord.driverId,
        driverName: storeRoomDriverObj?.name || requestRecord.driverName,
        vehicle: storeRoomVehDesc || requestRecord.vehicle,
        vehicleNumber: storeRoomVehObj?.number || requestRecord.vehicleNumber,
      });
    } else if (dispatchRecord) {
      const matchReq = (materialRequests || []).find(r =>
        (r.sourceType === 'store_room' || r.isStoreRoom) &&
        r.siteId === dispatchRecord.siteId &&
        r.status !== 'completed' &&
        r.items?.some(it => it.name.toLowerCase() === dispatchRecord.materialName.toLowerCase())
      );
      if (matchReq) {
        updateMaterialRequest(matchReq.id, {
          status: 'completed',
          deliveryDate: modalDeliveryDate,
          returnDate: retDate,
          materialCost: billedAmt,
          clientMaterialCost: billedAmt,
          storeRoomAmount: billedAmt,
          storeRoomProfit: billedAmt,
          driverId: storeRoomDriverObj?.id || matchReq.driverId,
          driverName: storeRoomDriverObj?.name || matchReq.driverName,
          vehicle: storeRoomVehDesc || matchReq.vehicle,
          vehicleNumber: storeRoomVehObj?.number || matchReq.vehicleNumber,
        });
      } else {
        // Create completed Material Request so site expenses and financials reflect the amount & return logistics
        addMaterialRequest({
          siteId: originalSiteId,
          siteName: originalSiteName,
          date: retDate,
          time: format(new Date(), 'hh:mm a'),
          sourceType: 'store_room',
          sourceSiteName: 'Store Room / Warehouse',
          isStoreRoom: true,
          startDate: dispatchRecord.startDate || dispatchRecord.date,
          deliveryDate: modalDeliveryDate,
          returnDate: retDate,
          driverId: storeRoomDriverObj?.id,
          driverName: storeRoomDriverObj?.name,
          vehicle: storeRoomVehDesc,
          vehicleNumber: storeRoomVehObj?.number,
          vehicleType: storeRoomVehObj?.type,
          items: [{
            id: `item_${Date.now()}`,
            name: matName,
            quantity: totalQty,
            unit: unit,
            rate: billedAmt > 0 && totalQty > 0 ? billedAmt / totalQty : 0,
            amount: billedAmt
          }],
          materialCost: billedAmt,
          clientMaterialCost: billedAmt,
          storeRoomAmount: billedAmt,
          storeRoomProfit: billedAmt,
          status: 'completed',
          notes: `Store Room item deployed for ${modalTotalDays} days @ ₹${perDayRateNum}/day = ₹${billedAmt}. ${actionDescription} ${storeRoomReturnNotes}`.trim()
        });
      }
    }

    // 3. Handle Restock to Store Room (for store_room or split remaining)
    if (storeRoomQty > 0 && storeRoomRestock && mat) {
      updateMaterialSetting(mat.id, {
        stockQuantity: (mat.stockQuantity || 0) + storeRoomQty
      });
    }

    // 4. Handle Transfer to New Site (for other_site or split transferred count)
    if (transferQty > 0 && targetTransferSite) {
      // Create new active deployment for target site starting today with assigned transfer driver and vehicle
      addStoreRoomDispatch({
        materialId: mat?.id || dispatchRecord?.materialId || `mat_${Date.now()}`,
        materialName: matName,
        category: dispatchRecord?.category || mat?.category || 'Store Room',
        siteId: targetTransferSite.id,
        siteName: targetTransferSite.name,
        quantity: transferQty,
        unit: unit,
        date: retDate,
        startDate: retDate,
        deliveryDate: retDate,
        time: format(new Date(), 'hh:mm a'),
        status: 'active',
        vehicleId: primaryVehObj?.id,
        vehicleNumber: primaryVehObj?.number,
        driverId: primaryDriverObj?.id,
        driverName: primaryDriverObj?.name,
        perDayRate: perDayRateNum,
        notes: `Transferred ${transferQty} ${unit} from ${originalSiteName}. Delivery Date: ${retDate}. Driver: ${primaryDriverObj?.name || 'Direct Transfer'} (${primaryVehDesc || 'No Vehicle'}). ${storeRoomReturnNotes}`.trim(),
        dispatchedBy: currentUser?.name || 'Admin',
      });

      // Also create an active Material Request record for the new site with assigned vehicle and driver
      addMaterialRequest({
        siteId: targetTransferSite.id,
        siteName: targetTransferSite.name,
        date: retDate,
        time: format(new Date(), 'hh:mm a'),
        sourceType: 'store_room',
        sourceSiteName: `Transferred from ${originalSiteName}`,
        isStoreRoom: true,
        startDate: retDate,
        deliveryDate: retDate,
        driverId: primaryDriverObj?.id,
        driverName: primaryDriverObj?.name,
        vehicle: primaryVehDesc,
        vehicleNumber: primaryVehObj?.number,
        vehicleType: primaryVehObj?.type,
        items: [{
          id: `item_${Date.now()}`,
          name: matName,
          quantity: transferQty,
          unit: unit,
          rate: perDayRateNum,
          amount: 0
        }],
        status: 'assigned',
        notes: `Store Room stock (${transferQty} ${unit}) transferred from ${originalSiteName}. Driver: ${primaryDriverObj?.name || 'Direct Transfer'} (${primaryVehDesc || 'No Vehicle'}). Delivery Date on site: ${retDate}. ${storeRoomReturnNotes}`.trim(),
        requestedByStaffName: currentUser?.name || 'Admin',
      });
    }

    // 5. Record billed product value to Site Expenses so it reflects across all site financial sheets
    if (billedAmt > 0 && originalSiteId) {
      addExpense({
        siteId: originalSiteId,
        siteName: originalSiteName,
        date: retDate,
        amount: billedAmt,
        category: 'Store Room Equipment & Materials',
        description: `Store Room item billed: ${matName} (${totalQty} ${unit}) - ${returnDestinationType === 'store_room' ? 'Returned to Warehouse' : 'Direct Site Transfer'}${returnRateMode === 'daily' ? ` (${modalTotalDays} days @ ₹${perDayRateNum}/day)` : ` (Rate: ₹${storeRoomUnitRate || 0}/${unit})`}`
      });
    }

    if (returnDestinationType === 'split') {
      toast.success(`Split Complete! Transferred ${transferQty} ${unit} to ${targetTransferSite?.name} and returned ${storeRoomQty} ${unit} to Store Room. ₹${billedAmt.toLocaleString()} billed to ${originalSiteName} expenses and credited to Store Room Stock Revenue!`);
    } else if (returnDestinationType === 'other_site') {
      toast.success(`Transferred all ${transferQty} ${unit} to ${targetTransferSite?.name}! Driver: ${primaryDriverObj?.name || 'Assigned'}. ₹${billedAmt.toLocaleString()} billed to ${originalSiteName} expenses and credited to Store Room Stock Revenue!`);
    } else {
      toast.success(`Store Room item returned to Warehouse! Driver: ${storeRoomDriverObj?.name || 'Assigned'}. ₹${billedAmt.toLocaleString()} billed to ${originalSiteName} expenses and credited to Store Room Stock Revenue!`);
    }

    setReturnStoreRoomModal({ open: false, dispatchRecord: null, requestRecord: null });
    setStoreRoomBilledAmount('');
    setStoreRoomPerDayRate('');
    setStoreRoomUnitRate('');
    setStoreRoomReturnNotes('');
    setReturnVehicleId('none');
    setReturnDriverId('none');
    setSplitReturnVehicleId('none');
    setSplitReturnDriverId('none');
    setSameDriverVehicleForSplit(true);
  };

  // Adjust / Receive Stock Handler
  const handleSaveAdjustStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustStockModal.material) return;
    const targetMat = adjustStockModal.material;
    const currentStock = targetMat.stockQuantity || 0;
    const qtyVal = Number(adjustQuantity) || 0;

    const buyingPriceVal = Number(adjustBuyingPrice) || targetMat.buyingPrice || 0;
    const inwardCost = adjustMode === 'add' ? (qtyVal * buyingPriceVal) : 0;

    let finalStock = currentStock;
    if (adjustMode === 'add') {
      finalStock = currentStock + qtyVal;
    } else {
      finalStock = Math.max(0, qtyVal);
    }

    const minAlertVal = adjustMinStockAlert ? Number(adjustMinStockAlert) : (targetMat.minStockAlert ?? 10);
    const locationVal = adjustLocation.trim() || targetMat.storeRoomLocation || '';

    updateMaterialSetting(targetMat.id, {
      stockQuantity: finalStock,
      minStockAlert: minAlertVal,
      storeRoomLocation: locationVal || undefined,
      buyingPrice: buyingPriceVal,
      totalPurchaseCost: (Number(targetMat.totalPurchaseCost) || 0) + (adjustMode === 'add' ? inwardCost : 0),
    });

    // Record inward stock purchase to Company Expenses
    if (adjustMode === 'add' && inwardCost > 0) {
      addExpense({
        siteId: 'store_room',
        siteName: 'Central Store Room & Warehouse',
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: inwardCost,
        category: 'Store Room Stock Purchase',
        description: `Inward stock purchase: ${qtyVal} ${targetMat.unit || 'units'} of "${targetMat.name}" for Store Room @ ₹${buyingPriceVal}/unit. ${adjustNotes || ''}`.trim()
      });
    }

    toast.success(`Stock for ${targetMat.name} updated to ${finalStock} ${targetMat.unit || 'units'}! ${inwardCost > 0 ? `(₹${inwardCost.toLocaleString()} logged to expenses)` : ''}`);
    setAdjustStockModal({ open: false, material: null });
    setAdjustQuantity('');
    setAdjustBuyingPrice('');
    setAdjustMinStockAlert('');
    setAdjustLocation('');
    setAdjustNotes('');
  };

  const handleDeleteStoreStock = (item: MaterialSetting) => {
    const cost = (Number(item.stockQuantity) || 0) * (Number(item.buyingPrice) || 0);
    const cleanName = getBaseMaterialName(item.name).toLowerCase();
    (manualExpenses || [])
      .filter(e => (e.siteId === 'store_room' || e.category === 'Store Room Stock Purchase') && e.description?.toLowerCase().includes(cleanName))
      .forEach(e => deleteExpense(e.id));

    deleteMaterialSetting(item.id);
    toast.success(`Deleted "${getBaseMaterialName(item.name)}" from Store Room. ₹${cost.toLocaleString()} deducted from Stock Expenses.`);
    setDeleteStockModal({ open: false, material: null });
  };

  const handleConfirmCrushStock = () => {
    if (!crushModal.material) return;
    const item = crushModal.material;
    const currentStock = Number(item.stockQuantity) || 0;
    const qtyToCrush = Number(crushQuantity);

    if (isNaN(qtyToCrush) || qtyToCrush <= 0) {
      toast.error('Please enter a valid crushed quantity greater than 0');
      return;
    }
    if (qtyToCrush > currentStock) {
      toast.error(`Cannot crush more than available stock (${currentStock} ${item.unit || 'units'})`);
      return;
    }

    const buyingPrice = Number(item.buyingPrice) || 0;
    const lossAmount = qtyToCrush * buyingPrice;
    const newStockQty = Math.max(0, currentStock - qtyToCrush);

    addCrushedStockRecord({
      materialId: item.id,
      materialName: item.name,
      category: item.category || 'General',
      unit: item.unit || 'units',
      crushedQuantity: qtyToCrush,
      buyingPrice,
      lossAmount,
      reason: crushReason.trim() || '💥 Crushed / Broken in warehouse',
      notes: crushNotes.trim() || undefined,
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'hh:mm a')
    });

    updateMaterialSetting(item.id, {
      stockQuantity: newStockQty
    });

    toast.success(
      `💥 ${qtyToCrush} ${item.unit || 'units'} of "${item.name}" marked as crushed. ` +
      `Loss of ₹${lossAmount.toLocaleString()} recorded in Crushed History. (Purchase expense remains in Stock Expenses!)`
    );

    setCrushModal({ open: false, material: null });
    setCrushQuantity('');
    setCrushReason('💥 Crushed / Broken in warehouse');
    setCrushNotes('');
  };

  const handleRestoreCrushedStock = (record: CrushedStockRecord) => {
    restoreCrushedStockRecord(record.id);
    toast.success(`Restored ${record.crushedQuantity} ${record.unit} of "${record.materialName}" back to warehouse stock!`);
  };

  const handleDeleteCrushedHistoryEntry = (record: CrushedStockRecord) => {
    deleteCrushedStockRecord(record.id);
    toast.success(`Crushed stock record removed from history.`);
  };

  // Unit Master Handlers (Identical to Settings & Master Data)
  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newUnitName.trim();
    if (!trimmed) {
      toast.error('Please enter a unit name');
      return;
    }
    if (activeUnits.some(u => u.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Unit "${trimmed}" already exists`);
      return;
    }
    addUnit(trimmed);
    toast.success(`Unit "${trimmed}" added successfully!`);
    setNewUnitName('');
  };

  const handleRemoveUnit = (unitToRemove: string) => {
    const isUsed = (materialSettings || []).some(m => m.unit?.toLowerCase() === unitToRemove.toLowerCase());
    if (isUsed) {
      if (!confirm(`Unit "${unitToRemove}" is currently used in material presets. Remove anyway?`)) {
        return;
      }
    }
    removeUnit(unitToRemove);
    toast.success(`Unit "${unitToRemove}" removed`);
  };

  const toggleCatalogMaterial = (matName: string) => {
    setSelectedCatalogMaterials(prev =>
      prev.includes(matName) ? prev.filter(m => m !== matName) : [...prev, matName]
    );
  };

  // Handlers for Supplier Form
  const handleSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) { toast.error('Enter supplier name'); return; }

    const customList = customMaterialsText.split(',').map(m => m.trim()).filter(Boolean);
    const combinedMaterials = Array.from(new Set([...selectedCatalogMaterials, ...customList]));

    if (editingSupId) {
      updateSupplier(editingSupId, {
        name: supName.trim(),
        phone: supPhone.trim() || undefined,
        address: supAddress.trim() || undefined,
        materialsSupplied: combinedMaterials.join(', '),
        suppliedMaterials: combinedMaterials,
        notes: supNotes.trim() || undefined
      });
      toast.success('Supplier updated!');
      setEditingSupId(null);
    } else {
      addSupplier({
        name: supName.trim(),
        phone: supPhone.trim() || undefined,
        address: supAddress.trim() || undefined,
        materialsSupplied: combinedMaterials.join(', '),
        suppliedMaterials: combinedMaterials,
        notes: supNotes.trim() || undefined
      });
      toast.success('Supplier added!');
    }
    setSupName(''); setSupPhone(''); setSupAddress(''); setSupMaterials(''); setSupNotes('');
    setSelectedCatalogMaterials([]); setCustomMaterialsText('');
    setShowSupplierForm(false);
  };

  // Handlers for Vehicle Form
  const handleVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehName.trim()) { toast.error('Enter vehicle name'); return; }
    if (!vehNumber.trim()) { toast.error('Enter vehicle plate number'); return; }

    if (editingVehId) {
      updateVehicle(editingVehId, {
        name: vehName.trim(),
        number: vehNumber.trim(),
        type: vehType,
        notes: vehNotes.trim() || undefined
      });
      toast.success('Vehicle updated!');
      setEditingVehId(null);
    } else {
      addVehicle({
        name: vehName.trim(),
        number: vehNumber.trim(),
        type: vehType,
        notes: vehNotes.trim() || undefined
      });
      toast.success('Vehicle added to fleet!');
    }
    setVehName(''); setVehNumber(''); setVehType('Pickup'); setVehNotes('');
    setShowVehicleForm(false);
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* ── EXECUTIVE STATS SUMMARY ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-9 gap-2.5">
        {/* Card 1: Outstanding Vendor Dues (To Give Vendors) */}
        <div
          onClick={() => setShowVendorDueModal(true)}
          className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 hover:border-amber-500 shadow-2xs space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">To Give Vendors</span>
            <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 group-hover:scale-110 transition-transform"><Wallet className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-xl font-heading font-black text-amber-700 dark:text-amber-400">
            ₹{vendorPaymentSummary.totalToGiveVendors.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center justify-between">
            <span>{vendorPaymentSummary.vendorsWithDueCount} vendor{vendorPaymentSummary.vendorsWithDueCount !== 1 ? 's' : ''} unpaid</span>
            <span className="text-amber-600 font-bold underline">Details</span>
          </div>
        </div>

        <div
          onClick={() => { setActiveSubTab('requests'); setRequestFilter('pending'); }}
          className={`p-3.5 rounded-2xl bg-card border shadow-2xs space-y-1 transition-all cursor-pointer ${
            activeSubTab === 'requests' && requestFilter === 'pending' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-border/70 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Requests</span>
            <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600"><Package className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-xl font-heading font-black text-foreground">
            {(materialRequests || []).filter(r => r.status === 'pending').length}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Due: ₹{vendorPaymentSummary.pendingReqsDue.toLocaleString()}
          </div>
        </div>

        <div
          onClick={() => setActiveSubTab('assigned_deliveries')}
          className={`p-3.5 rounded-2xl bg-card border shadow-2xs space-y-1 transition-all cursor-pointer ${
            activeSubTab === 'assigned_deliveries' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-border/70 hover:border-blue-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">In-Transit</span>
            <span className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600"><Truck className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-xl font-heading font-black text-blue-600 dark:text-blue-400">
            {assignedDeliveries.length}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Due: ₹{vendorPaymentSummary.inTransitDue.toLocaleString()}
          </div>
        </div>

        {/* Store Room Card */}
        <div
          onClick={() => setActiveSubTab('store_room')}
          className={`p-3.5 rounded-2xl bg-card border shadow-2xs space-y-1 transition-all cursor-pointer ${
            activeSubTab === 'store_room' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-border/70 hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Store Room</span>
            <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600"><Warehouse className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-xl font-heading font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <span>{storeRoomItems.length}</span>
            {lowStockStoreItems.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                {lowStockStoreItems.length} Low
              </span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Warehouse Stock
          </div>
        </div>

        <div
          onClick={() => setActiveSubTab('suppliers')}
          className={`p-3.5 rounded-2xl bg-card border shadow-2xs space-y-1 transition-all cursor-pointer ${
            activeSubTab === 'suppliers' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-border/70 hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Suppliers</span>
            <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600"><Building2 className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-xl font-heading font-black text-foreground">
            {(suppliers || []).length}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Ledger & Dues
          </div>
        </div>

        <div
          onClick={() => setActiveSubTab('vehicles')}
          className={`p-3.5 rounded-2xl bg-card border shadow-2xs space-y-1 transition-all cursor-pointer ${
            activeSubTab === 'vehicles' ? 'border-primary ring-1 ring-primary' : 'border-border/70 hover:border-primary/40'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Fleet Vehicles</span>
            <span className="p-1.5 rounded-xl bg-primary/10 text-primary"><Truck className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-xl font-heading font-black text-foreground">
            {(vehicles || []).length}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Transport fleet
          </div>
        </div>

        <div
          onClick={() => setActiveSubTab('rentals')}
          className={`p-3.5 rounded-2xl bg-card border shadow-2xs space-y-1 transition-all cursor-pointer ${
            activeSubTab === 'rentals' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-border/70 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Site Rentals</span>
            <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600"><RefreshCw className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-xl font-heading font-black text-amber-600 dark:text-amber-400">
            {(materialRentals || []).filter(r => r.status === 'active').length}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Running deployed
          </div>
        </div>

        <div
          onClick={() => setActiveSubTab('materials')}
          className={`p-3.5 rounded-2xl bg-card border shadow-2xs space-y-1 transition-all cursor-pointer ${
            activeSubTab === 'materials' ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-border/70 hover:border-indigo-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Catalog</span>
            <span className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600"><Layers className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-xl font-heading font-black text-indigo-600 dark:text-indigo-400">
            {materialSettings.length}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Standard presets
          </div>
        </div>

        {/* Units (UOM) Card */}
        <div
          onClick={() => setActiveSubTab('units')}
          className={`p-3.5 rounded-2xl bg-card border shadow-2xs space-y-1 transition-all cursor-pointer ${
            activeSubTab === 'units' ? 'border-sky-500 ring-1 ring-sky-500' : 'border-border/70 hover:border-sky-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Units (UOM)</span>
            <span className="p-1.5 rounded-xl bg-sky-500/10 text-sky-600"><Ruler className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-xl font-heading font-black text-sky-600 dark:text-sky-400">
            {activeUnits.length}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Master Units
          </div>
        </div>
      </div>

      {/* ── GLOBAL VENDOR PAYMENT BANNER (VISIBLE ACROSS ALL TABS) ── */}
      <div className="p-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-card border border-amber-500/30 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Vendor Dues Status:</span>
              <span className="text-sm font-bold text-foreground">
                We need to give vendors <strong className="text-amber-600 dark:text-amber-400 font-extrabold font-mono text-base">₹{vendorPaymentSummary.totalToGiveVendors.toLocaleString()}</strong>
              </span>
              {vendorPaymentSummary.totalToGiveVendors > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {vendorPaymentSummary.vendorsWithDueCount} Vendor{vendorPaymentSummary.vendorsWithDueCount !== 1 ? 's' : ''} Pending
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  All Vendors Settled ✓
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
              <span>Total Material Bills: <strong className="text-foreground">₹{vendorPaymentSummary.totalBilled.toLocaleString()}</strong></span>
              <span>•</span>
              <span>Amount Given: <strong className="text-emerald-600 font-bold">₹{vendorPaymentSummary.totalPaid.toLocaleString()}</strong></span>
              <span>•</span>
              <span>Requisitions Due: <strong className="text-amber-600 font-bold">₹{vendorPaymentSummary.pendingReqsDue.toLocaleString()}</strong></span>
              <span>•</span>
              <span>In-Transit Due: <strong className="text-blue-600 dark:text-blue-400 font-bold">₹{vendorPaymentSummary.inTransitDue.toLocaleString()}</strong></span>
              <span>•</span>
              <span>Completed Orders Due: <strong className="text-amber-600 dark:text-amber-400 font-bold">₹{vendorPaymentSummary.completedDue.toLocaleString()}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            size="sm"
            onClick={() => setShowAdminCreateReqModal(true)}
            className="h-8 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-1.5 shadow-xs"
          >
            <Send className="w-3.5 h-3.5" /> Send Material Request
          </Button>
          <Button
            size="sm"
            onClick={() => setShowVendorDueModal(true)}
            className="h-8 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-xs"
          >
            <CreditCard className="w-3.5 h-3.5" /> View Vendor Dues ({vendorPaymentSummary.vendorsWithDueCount})
          </Button>
          {activeSubTab !== 'suppliers' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveSubTab('suppliers')}
              className="h-8 rounded-xl text-xs font-semibold border-border/70 hover:bg-muted"
            >
              <Building2 className="w-3.5 h-3.5 mr-1 text-primary" /> Suppliers Ledger
            </Button>
          )}
        </div>
      </div>

      {/* Sub-Tabs Selector with Vendor Due Badges on All Tabs */}
      <div className="flex gap-2 p-1.5 bg-muted/60 rounded-2xl border border-border/50 overflow-x-auto hide-scrollbar">
        {[
          { id: 'requests' as const, label: `Requisitions (${materialRequests.filter(r => r.status === 'pending').length} Pending · ₹${vendorPaymentSummary.pendingReqsDue.toLocaleString()} Due)`, icon: <Package className="w-4 h-4" /> },
          { id: 'assigned_deliveries' as const, label: `Active Deliveries (${assignedDeliveries.length} · ₹${vendorPaymentSummary.inTransitDue.toLocaleString()} Due)`, icon: <Truck className="w-4 h-4 text-blue-500" /> },
          { id: 'store_room' as const, label: `Store Room (${storeRoomItems.length} Items · ${storeRoomItems.reduce((s, m) => s + (m.stockQuantity || 0), 0)} Units)`, icon: <Warehouse className="w-4 h-4 text-emerald-500" /> },
          { id: 'rentals' as const, label: `Rental Materials (${(materialRentals || []).filter(r => r.status === 'active').length} Active)`, icon: <RefreshCw className="w-4 h-4 text-amber-500" /> },
          { id: 'suppliers' as const, label: `Suppliers & Ledger (${suppliers.length} · ₹${vendorPaymentSummary.totalToGiveVendors.toLocaleString()} Due)`, icon: <Building2 className="w-4 h-4 text-emerald-600" /> },
          { id: 'vehicles' as const, label: `Fleet Vehicles (${vehicles.length})`, icon: <Truck className="w-4 h-4" /> },
          { id: 'materials' as const, label: `Materials Catalog (${materialSettings.length})`, icon: <Layers className="w-4 h-4 text-indigo-500" /> },
          { id: 'units' as const, label: `Material Units (${activeUnits.length})`, icon: <Ruler className="w-4 h-4 text-sky-500" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${activeSubTab === tab.id
                ? 'bg-card text-foreground font-bold shadow-xs border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── UNIVERSAL SEARCH BAR FOR ALL MATERIALS TABS ── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={
            activeSubTab === 'requests'
              ? 'Search requisitions by site name, staff, material name, or notes...'
              : activeSubTab === 'assigned_deliveries'
                ? 'Search active deliveries by driver, site, supplier, vehicle, or product...'
                : activeSubTab === 'store_room'
                  ? 'Search store room inventory by item, category, location, or notes...'
                  : activeSubTab === 'rentals'
                    ? 'Search rental materials by item name, site, or driver...'
                    : activeSubTab === 'suppliers'
                      ? 'Search suppliers by name, phone, materials supplied, or address...'
                      : activeSubTab === 'vehicles'
                        ? 'Search fleet vehicles by plate number, name, or vehicle type...'
                        : activeSubTab === 'units'
                          ? 'Search units of measurement...'
                          : 'Search catalog materials by name or unit...'
          }
          className="pl-10 pr-10 h-10 rounded-xl text-xs bg-card border-border/60 shadow-2xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── 1. ACTIVE DRIVER DELIVERIES TAB (SEPARATE VIEW WITH QUANTITY-BASED PRICING) ── */}
      {activeSubTab === 'assigned_deliveries' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="section-header !mb-0.5 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-500" /> Active Driver Deliveries & In-Transit Materials
              </h3>
              <p className="text-xs text-muted-foreground">
                Materials dispatched with assigned drivers. Prices are calculated dynamically based on material quantity.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {filteredAssignedDeliveries.length} In Transit
            </span>
          </div>

          {/* In-Transit Deliveries Vendor Due Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 px-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
              <Truck className="w-4 h-4 text-blue-500" />
              In-Transit Deliveries Vendor Balance Due:
            </span>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-foreground font-mono text-sm">
                ₹{vendorPaymentSummary.inTransitDue.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground">
                (Global Total to Give Vendors: <strong className="text-amber-600 dark:text-amber-400">₹{vendorPaymentSummary.totalToGiveVendors.toLocaleString()}</strong>)
              </span>
            </div>
          </div>

          {filteredAssignedDeliveries.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
              <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">
                {searchQuery ? `No deliveries matching "${searchQuery}"` : 'No active deliveries in transit right now'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? 'Try another search keyword' : 'Assign a driver from the Requisitions tab to track dispatch runs here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAssignedDeliveries.map(req => {
                const totalItemCost = (req.items || []).reduce(
                  (sum, it) => sum + (it.amount || (it.rate || 0) * it.quantity),
                  0
                );
                const supplierPrice = req.supplierPrice ?? totalItemCost;
                const paid = req.supplierPaidAmount || 0;
                const balance = Math.max(0, supplierPrice - paid);

                return (
                  <Card key={req.id} className="p-4 rounded-2xl bg-card border border-blue-500/30 shadow-xs space-y-3.5">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border/40">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <MapPin className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-bold text-base text-foreground">{req.siteName}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/15 text-blue-600 border border-blue-500/25">
                            Dispatched / In Transit
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Requested on {req.date} at {req.time} · Dispatched at {req.startTime || '-'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Reassign Driver button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAssignModal({ open: true, request: req })}
                          className="h-8 text-xs font-semibold gap-1 rounded-xl border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                        >
                          <Truck className="w-3.5 h-3.5" /> Reassign Driver
                        </Button>

                        {/* Edit Rates (Supplier & Client/Customer) button available before completion */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRateEditModal(req)}
                          className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-primary/30 hover:bg-primary/5"
                        >
                          <IndianRupee className="w-3.5 h-3.5 text-primary" /> Edit Rates (Supplier & Client/Customer)
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => setCompleteModal({ open: true, request: req })}
                          className="h-8 text-xs font-bold gap-1 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Complete Delivery
                        </Button>
                      </div>
                    </div>

                    {/* Driver, Supplier & Vehicle Strip */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-blue-500/5 p-3 rounded-xl border border-blue-500/20">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Assigned Driver</span>
                        <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                          <Truck className="w-3.5 h-3.5 text-blue-500" /> {req.driverName || 'Assigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Source / Supplier</span>
                        <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-amber-500" /> {req.supplierName || 'Assigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Dispatch Vehicle</span>
                        <span className="font-semibold text-foreground mt-0.5 block">
                          {req.vehicleType ? `${req.vehicleType} · ` : ''}{req.vehicleNumber || req.vehicle || 'Assigned'}
                        </span>
                      </div>
                    </div>

                    {/* Quantity-Based Item Price Breakdown with Supplier and Client Rates */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                        <span>Materials in Vehicle</span>
                        <span>Item Cost</span>
                      </div>
                      <div className="space-y-1.5">
                        {req.items.map((it, idx) => {
                          const sRate = it.supplierRate !== undefined ? it.supplierRate : (it.rate || 0);
                          const sTotal = it.supplierAmount !== undefined ? it.supplierAmount : (it.amount || sRate * it.quantity);
                          const cRate = it.clientRate !== undefined ? it.clientRate : (it.customerRate !== undefined ? it.customerRate : sRate);
                          const cTotal = it.clientAmount !== undefined ? it.clientAmount : (it.customerAmount !== undefined ? it.customerAmount : cRate * it.quantity);
                          return (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-muted/40 border border-border/40 text-xs flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-primary" />
                                <span className="font-bold text-foreground">{it.name}</span>
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[11px] font-bold">
                                  {it.quantity} {it.unit}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/20">
                                  ₹{sRate}/{it.unit || 'unit'} = ₹{sTotal.toLocaleString()}
                                </span>
                                {(it.gstAmount || 0) > 0 && (
                                  it.gstType === 'cgst_sgst' ? (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold border border-blue-500/20">
                                      CGST {it.cgstRate}% (₹{it.cgstAmount}) + SGST {it.sgstRate}% (₹{it.sgstAmount})
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-bold border border-primary/20">
                                      +{it.gstRate}% GST (₹{it.gstAmount?.toLocaleString()})
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {((req.clientMaterialCost || 0) > 0 || (req.customerMaterialCost || 0) > 0) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] border border-emerald-500/20">
                            Total: ₹{supplierPrice.toLocaleString()} (Materials only)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Financial Summary & Payment */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          Material Bill: <strong className="text-foreground">₹{supplierPrice.toLocaleString()}</strong>
                        </span>
                        <span>
                          Amount Given: <strong className="text-emerald-600">₹{paid.toLocaleString()}</strong>
                        </span>
                        <span>
                          Balance: <strong className={balance > 0 ? 'text-destructive font-bold' : 'text-emerald-600 font-bold'}>₹{balance.toLocaleString()}</strong>
                        </span>
                        {req.supplierPaymentMethod && (
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold text-[11px]">
                            💳 {req.supplierPaymentMethod}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCompleteModal({ open: true, request: req })}
                          className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
                        >
                          <PenLine className="w-3.5 h-3.5" /> Edit Rates & GST
                        </Button>
                        {balance > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPayModal(req)}
                            className="h-8 text-xs font-semibold gap-1 rounded-xl self-end sm:self-auto"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-primary" /> Record Supplier Payment
                          </Button>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 font-bold text-[11px] flex items-center gap-1 border border-emerald-500/25">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Payment Completed
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 2. REQUISITIONS / PENDING TAB ── */}
      {activeSubTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="section-header !mb-0.5">Site Material Requisitions</h3>
              <p className="text-xs text-muted-foreground">Requests submitted by supervisors & admin for review and assignment.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => setShowAdminCreateReqModal(true)}
                className="h-8 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> + New Request
              </Button>
              <div className="flex gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/50">
                {(['all', 'pending', 'assigned', 'completed'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setRequestFilter(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${requestFilter === f ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Requisitions Vendor Due Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 px-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
              <Package className="w-4 h-4 text-amber-500" />
              Pending Requisitions Vendor Balance:
            </span>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-foreground font-mono text-sm">
                ₹{vendorPaymentSummary.pendingReqsDue.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground">
                (Global Total to Give Vendors: <strong className="text-amber-600 dark:text-amber-400">₹{vendorPaymentSummary.totalToGiveVendors.toLocaleString()}</strong>)
              </span>
            </div>
          </div>

          {filteredMaterialRequests.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
              <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">
                {searchQuery ? `No requisitions matching "${searchQuery}"` : 'No material requisitions found'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? 'Try another keyword or clear the search box.' : 'Requests submitted by site supervisors or admin will appear here.'}
              </p>
              <Button
                size="sm"
                onClick={() => setShowAdminCreateReqModal(true)}
                className="mt-3.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Send Material Request
              </Button>
            </div>
          ) : (
            filteredMaterialRequests.map(req => {
              const totalItemCost = (req.items || []).reduce((sum, it) => sum + (it.amount || (it.rate || 0) * it.quantity), 0);
              const isPending = req.status === 'pending';
              const isAssigned = req.status === 'assigned';
              const isCompleted = req.status === 'completed';
              const supplierPrice = req.supplierPrice ?? totalItemCost;
              const paid = req.supplierPaidAmount || 0;
              const balance = Math.max(0, supplierPrice - paid);

              return (
                <Card key={req.id} className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/40">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="font-bold text-sm text-foreground">{req.siteName}</span>
                        {req.sourceType === 'site' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            Transfer from: {req.sourceSiteName}
                          </span>
                        )}
                        {(req.sourceType === 'store_room' || req.isStoreRoom) && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                            <Warehouse className="w-3 h-3 text-emerald-600" /> Store Room Asset
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>Requested by {req.requestedByStaffName} on {req.date} at {req.time}</span>
                        {(req.sourceType === 'store_room' || req.isStoreRoom) && (
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Delivery Date: {req.deliveryDate || req.startDate || req.date}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${isCompleted ? 'bg-emerald-500/15 text-emerald-600' : isAssigned ? 'bg-blue-500/15 text-blue-600' : 'bg-amber-500/15 text-amber-600'
                          }`}
                      >
                        {req.status}
                      </span>
                      {isPending && (
                        <Button
                          size="sm"
                          onClick={() => setAssignModal({ open: true, request: req })}
                          className="h-8 text-xs font-bold gap-1 rounded-xl text-white shadow-xs"
                          style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                        >
                          <Truck className="w-3.5 h-3.5" /> Assign Driver & Dispatch
                        </Button>
                      )}
                      {isAssigned && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAssignModal({ open: true, request: req })}
                            className="h-8 text-xs font-semibold gap-1 rounded-xl border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                          >
                            <Truck className="w-3.5 h-3.5" /> Reassign Driver
                          </Button>
                          {!(req.sourceType === 'store_room' || req.isStoreRoom) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRateEditModal(req)}
                              className="h-8 text-xs font-semibold gap-1 rounded-xl border-primary/30 hover:bg-primary/5"
                            >
                              <IndianRupee className="w-3.5 h-3.5 text-primary" /> Edit Rates
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => setCompleteModal({ open: true, request: req })}
                            className={`h-8 text-xs font-bold gap-1 rounded-xl text-white shadow-xs ${
                              req.sourceType === 'store_room' || req.isStoreRoom
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />{' '}
                            {req.sourceType === 'store_room' || req.isStoreRoom ? 'Confirm Delivery to Site' : 'Complete Delivery'}
                          </Button>
                        </div>
                      )}
                      {isCompleted && (
                        <div className="flex items-center gap-2">
                          {(req.sourceType === 'store_room' || req.isStoreRoom) ? (
                            req.returnDate ? (
                              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-500/30 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Returned ({req.returnDate}) {req.storeRoomAmount ? `· ₹${req.storeRoomAmount.toLocaleString()}` : ''}
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => openReturnStoreRoomItemModal(null, req)}
                                className="h-8 text-xs font-bold gap-1 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" /> Return / Transfer Material
                              </Button>
                            )
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setCompleteModal({ open: true, request: req })}
                              className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
                            >
                              <PenLine className="w-3.5 h-3.5" /> Edit Rates & GST
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="flex flex-wrap gap-2">
                    {req.items.map((it, idx) => {
                      const cRate = it.clientRate !== undefined ? it.clientRate : it.rate;
                      const custRate = it.customerRate !== undefined ? it.customerRate : it.rate;
                      return (
                        <span key={idx} className="bg-muted/60 px-2.5 py-1 rounded-xl text-xs font-semibold border border-border/50 flex items-center gap-1.5 flex-wrap">
                          <span>{it.name}: <strong className="text-primary">{it.quantity} {it.unit}</strong></span>
                          {(cRate || custRate) ? (
                            <span className="text-[11px] font-normal text-muted-foreground">
                              {cRate ? `(₹${cRate}/${it.unit})` : ''}
                            </span>
                          ) : null}
                          {(it.gstAmount || 0) > 0 && (
                            it.gstType === 'cgst_sgst' ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                                CGST {it.cgstRate}% (₹{it.cgstAmount}) + SGST {it.sgstRate}% (₹{it.sgstAmount})
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                                +{it.gstRate}% GST (₹{it.gstAmount})
                              </span>
                            )
                          )}
                        </span>
                      );
                    })}
                  </div>

                  {/* If assigned or completed, show logistics and supplier billing/payment details */}
                  {(isAssigned || isCompleted) && (
                    <div className="space-y-2 pt-2 border-t border-border/40 text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-muted-foreground">
                        <div>Driver: <strong className="text-foreground">{req.driverName || '-'}</strong></div>
                        <div>Supplier: <strong className="text-foreground">{req.supplierName || '-'}</strong></div>
                        <div>Vehicle: <strong className="text-foreground">{req.vehicleNumber || req.vehicle || '-'}</strong></div>
                        <div>Start Time: <strong className="text-foreground">{req.startTime || '-'}</strong></div>
                      </div>

                      {req.supplierPrice !== undefined && (
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/40">
                          <div className="flex items-center gap-3 text-muted-foreground w-full sm:w-auto flex-1">
                            <div className="flex flex-col gap-1.5 w-full">
                              <span className="flex items-center gap-1.5 font-bold">
                                Total Bill: <strong className="text-foreground text-sm font-mono">₹{supplierPrice.toLocaleString()}</strong>
                              </span>
                              <div className="p-2.5 mt-1 bg-muted/50 rounded-lg border border-border/60 text-[10px] space-y-1 w-full max-w-xs">
                                <div className="flex justify-between items-center text-muted-foreground">
                                  <span>Material Subtotal:</span>
                                  <span className="font-mono font-semibold text-foreground">₹{((supplierPrice || 0) - (req.gstAmount || 0)).toLocaleString()}</span>
                                </div>
                                {(req.gstAmount || 0) > 0 && (
                                  req.gstType === 'inter-state' || req.gstType === 'igst' ? (
                                    <div className="flex justify-between items-center text-muted-foreground">
                                      <span>IGST ({req.igstRate || 0}%):</span>
                                      <span className="font-mono font-semibold text-foreground">₹{(req.igstAmount ?? req.gstAmount)?.toLocaleString()}</span>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex justify-between items-center text-muted-foreground">
                                        <span>CGST ({req.cgstRate || ((req.gstRate || 0) / 2)}%):</span>
                                        <span className="font-mono font-semibold text-foreground">₹{(req.cgstAmount ?? ((req.gstAmount || 0) / 2)).toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-muted-foreground">
                                        <span>SGST ({req.sgstRate || ((req.gstRate || 0) / 2)}%):</span>
                                        <span className="font-mono font-semibold text-foreground">₹{(req.sgstAmount ?? ((req.gstAmount || 0) / 2)).toLocaleString()}</span>
                                      </div>
                                    </>
                                  )
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 ml-2 flex-wrap">
                              <span>Paid: <strong className="text-emerald-600 font-bold">₹{paid.toLocaleString()}</strong></span>
                            <span>
                              Balance:{' '}
                              <strong className={balance > 0 ? 'text-destructive font-bold' : 'text-emerald-600 font-bold'}>
                                ₹{balance.toLocaleString()}
                              </strong>
                            </span>
                            {req.supplierPaymentDate && (
                              <span className="text-[10px] text-muted-foreground font-mono">({req.supplierPaymentDate})</span>
                            )}
                            </div>
                          </div>

                          {balance > 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPayModal(req)}
                              className="h-7 text-xs font-semibold gap-1 rounded-lg"
                            >
                              <CreditCard className="w-3 h-3 text-primary" /> Record Payment
                            </Button>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 font-bold text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── RENTAL MATERIALS TAB ── */}
      {activeSubTab === 'rentals' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="section-header !mb-0.5 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-600" />
                Site Material Rentals & Scaffolding Tracker
              </h3>
              <p className="text-xs text-muted-foreground">
                Deploy rental materials to sites, assign transit drivers, track daily duration, and calculate closing rental costs based on days and product quantities.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setShowDeployRentalModal(true)}
                className="h-8 rounded-xl gap-1.5 text-xs font-semibold text-white shadow-sm bg-amber-600 hover:bg-amber-700"
              >
                <Plus className="w-3.5 h-3.5" /> Deploy Material to Site
              </Button>
            </div>
          </div>

          {/* Quick Filter Status Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-card rounded-xl border border-border/50 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground font-semibold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-primary" /> Status:
              </span>
              {(['all', 'active', 'returned'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setRentalStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-colors ${
                    rentalStatusFilter === st
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {st === 'all' ? `All (${materialRentals.length})` : st === 'active' ? `Active On Site (${materialRentals.filter(r => r.status === 'active').length})` : `Returned / Settled (${materialRentals.filter(r => r.status === 'returned').length})`}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-muted-foreground font-medium">
              Formula: (Days on site) × (Qty) × (Rate/day per product) + Transit Cost
            </div>
          </div>

          {/* Rental Cards List */}
          {filteredRentals.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
              <RefreshCw className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">
                {searchQuery ? `No rental records matching "${searchQuery}"` : 'No rental material deployments found'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? 'Try another search term' : 'Click "Deploy Material to Site" to dispatch scaffolding, generators, or machines.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredRentals.map(rental => {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const startMs = new Date(rental.startDate + 'T00:00:00').getTime();
                const currentEnd = rental.endDate || todayStr;
                const currentEndMs = new Date(currentEnd + 'T00:00:00').getTime();
                const daysActive = Math.max(1, Math.floor((currentEndMs - startMs) / 86400000) + 1);
                const isActive = rental.status === 'active';
                const calculatedRent = (rental.totalRentalCost !== undefined && !isActive)
                  ? rental.totalRentalCost
                  : (daysActive * rental.quantity * (rental.rentalRatePerDay || 0)) + (rental.transitCost || 0);

                return (
                  <Card key={rental.id} className={`p-4 rounded-2xl bg-card border shadow-xs space-y-3 transition-all ${
                    isActive ? 'border-amber-500/30 hover:border-amber-500/50' : 'border-border/60 opacity-90'
                  }`}>
                    {/* Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border/40">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-heading font-bold text-base text-foreground">
                            {rental.materialName}
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                            {rental.quantity} {rental.unit}
                          </span>
                          {isActive ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active On Site ({daysActive} Days)
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted text-muted-foreground border border-border/50 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Returned ({rental.totalDays || daysActive} Days Total)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="font-semibold text-foreground">{rental.siteName}</span>
                          <span>•</span>
                          <span>Start Date: <strong>{format(new Date(rental.startDate + 'T00:00:00'), 'dd MMM yyyy')}</strong></span>
                          {rental.endDate && (
                            <>
                              <span>•</span>
                              <span>End Date: <strong>{format(new Date(rental.endDate + 'T00:00:00'), 'dd MMM yyyy')}</strong></span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Amount Badge & Action */}
                      <div className="flex items-center gap-2 sm:self-center">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                            {isActive ? 'Accrued Rent to Date' : 'Final Total Rental Cost'}
                          </span>
                          <span className={`font-heading font-black text-lg ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                            ₹{calculatedRent.toLocaleString()}
                          </span>
                        </div>

                        {isActive ? (
                          <Button
                            size="sm"
                            onClick={() => openReturnModal(rental)}
                            className="h-9 px-3 rounded-xl text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Return & Calculate
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReturnModal(rental)}
                            className="h-9 px-3 rounded-xl text-xs font-semibold gap-1"
                          >
                            <PenLine className="w-3.5 h-3.5" /> Adjust Calculation
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Delete this rental record?')) deleteMaterialRental(rental.id);
                          }}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Calculation Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl bg-muted/20 text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Rate per Unit/Day:</span>
                        <span className="font-bold text-foreground">₹{rental.rentalRatePerDay} / day</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Duration on Site:</span>
                        <span className="font-bold text-foreground">
                          {isActive ? `${daysActive} Days (Running)` : `${rental.totalDays || daysActive} Days Total`}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Driver & Transit:</span>
                        {rental.requiresDriver ? (
                          <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            {rental.driverName || 'Driver'} {rental.transitCost ? `(₹${rental.transitCost})` : ''}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Not Required</span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Material Rent Subtotal:</span>
                        <span className="font-semibold text-foreground">
                          {daysActive}d × {rental.quantity} × ₹{rental.rentalRatePerDay} = ₹{(daysActive * rental.quantity * rental.rentalRatePerDay).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {rental.notes && (
                      <p className="text-xs text-muted-foreground italic bg-muted/30 px-3 py-1.5 rounded-lg border border-border/30">
                        "{rental.notes}"
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 3. SUPPLIERS & INTERACTIVE HISTORY LEDGER TAB ── */}
      {activeSubTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="section-header !mb-0.5">Supplier Directory & Purchase Ledgers</h3>
              <p className="text-xs text-muted-foreground">Select supplied materials from your catalog, track purchase history, balances, and payment methods.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setShowSupplierForm(v => !v);
                  setEditingSupId(null);
                  setSupName(''); setSupPhone(''); setSupAddress(''); setSupMaterials(''); setSupNotes('');
                  setSelectedCatalogMaterials([]); setCustomMaterialsText('');
                }}
                className="h-8 rounded-xl gap-1.5 text-xs font-semibold text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
              >
                <Plus className="w-3.5 h-3.5" /> Add Supplier
              </Button>
            </div>
          </div>

          {/* Supplier Dues Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-card border border-border/70 shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Vendor Purchases Billed</span>
              <div className="text-xl font-heading font-black text-foreground">₹{vendorPaymentSummary.totalBilled.toLocaleString()}</div>
              <p className="text-[10px] text-muted-foreground">From all supplier requisitions</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Total Given / Paid to Vendors</span>
              <div className="text-xl font-heading font-black text-emerald-600">₹{vendorPaymentSummary.totalPaid.toLocaleString()}</div>
              <p className="text-[10px] text-muted-foreground">Settled payments to date</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Total We Need to Give Vendors</span>
              <div className="text-xl font-heading font-black text-amber-600 dark:text-amber-400">₹{vendorPaymentSummary.totalToGiveVendors.toLocaleString()}</div>
              <p className="text-[10px] text-muted-foreground">{vendorPaymentSummary.vendorsWithDueCount} vendor(s) currently have pending balance</p>
            </div>
          </div>

          {/* Quick Filter by Material from Catalog */}
          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-card rounded-xl border border-border/50 text-xs">
            <span className="text-muted-foreground font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-primary" /> Filter by Material:
            </span>
            <div className="flex flex-wrap gap-1 items-center">
              <button
                onClick={() => setSupplierMaterialFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${supplierMaterialFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
              >
                All ({suppliers.length})
              </button>
              {materialSettings.map(m => {
                const count = suppliers.filter(s => {
                  const mats = [
                    ...(s.suppliedMaterials || []),
                    ...(typeof s.materialsSupplied === 'string'
                      ? s.materialsSupplied.split(',').map(x => x.trim())
                      : (Array.isArray(s.materialsSupplied) ? (s.materialsSupplied as string[]) : []))
                  ].map(x => x.toLowerCase());
                  return mats.some(x => x.includes(m.name.toLowerCase()));
                }).length;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSupplierMaterialFilter(m.name.toLowerCase())}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${supplierMaterialFilter === m.name.toLowerCase()
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    <span>{m.name}</span>
                    <span className="text-[10px] opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {showSupplierForm && (
            <div className="form-card animate-slide-up">
              <form onSubmit={handleSupplierSubmit} className="space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    {editingSupId ? 'Edit Supplier Details & Catalog Materials' : 'Register New Supplier & Assign Materials'}
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSupplierForm(false)}
                    className="h-7 text-xs text-muted-foreground"
                  >
                    Cancel
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Supplier / Store Name *</Label>
                    <Input
                      placeholder="e.g. Sri Lakshmi Hardware"
                      value={supName}
                      onChange={e => setSupName(e.target.value)}
                      className="mt-1 h-10 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Phone Number</Label>
                    <Input
                      placeholder="9876543210"
                      value={supPhone}
                      onChange={e => setSupPhone(e.target.value)}
                      className="mt-1 h-10 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Materials Catalog Selector */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-primary" /> Which Materials are Supplied by this Vendor?
                    </Label>
                    <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {selectedCatalogMaterials.length} Selected from Catalog
                    </span>
                  </div>

                  {materialSettings.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No materials created in Materials Presets Catalog yet. Add them in the 'Materials Presets Catalog' tab.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Click materials from your catalog to assign to this supplier:
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                        {materialSettings.filter(mat => !mat.isRental).map(mat => {
                          const isSelected = selectedCatalogMaterials.includes(mat.name);
                          return (
                            <button
                              key={mat.id}
                              type="button"
                              onClick={() => toggleCatalogMaterial(mat.name)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border shadow-2xs ${isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background hover:bg-muted text-foreground border-border/70'
                                }`}
                            >
                              {isSelected ? <Check className="w-3.5 h-3.5 text-primary-foreground" /> : <Plus className="w-3.5 h-3.5 opacity-60" />}
                              <span>{mat.name}</span>
                              {mat.unit && <span className="text-[10px] opacity-75 font-mono">({mat.unit})</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border/40">
                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase">
                      Additional / Custom Materials (Comma-separated)
                    </Label>
                    <Input
                      placeholder="e.g. Red Brick, River Sand, Tiles"
                      value={customMaterialsText}
                      onChange={e => setCustomMaterialsText(e.target.value)}
                      className="mt-1 h-9 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Address / Location</Label>
                  <Input
                    placeholder="Near Flyover, Pollachi Road"
                    value={supAddress}
                    onChange={e => setSupAddress(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 rounded-xl text-white font-bold text-xs shadow-sm"
                  style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                >
                  {editingSupId ? 'Update Supplier & Assigned Materials' : 'Save Supplier & Materials'}
                </Button>
              </form>
            </div>
          )}

          {/* Suppliers Grid */}
          {(() => {
            if (filteredSuppliers.length === 0) {
              return (
                <div className="text-center py-10 bg-muted/20 rounded-2xl border border-border/50 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-sm text-foreground">No suppliers found</p>
                  <p>
                    {searchQuery
                      ? `No suppliers match "${searchQuery}"`
                      : 'No registered suppliers match the selected material filter.'}
                  </p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredSuppliers.map(sup => {
                  const supOrders = (materialRequests || []).filter(r => r.supplierId === sup.id || r.supplierName === sup.name);
                  const totalBilled = supOrders.reduce(
                    (sum, r) => sum + (r.supplierPrice ?? r.materialCost ?? r.items?.reduce((s, it) => s + (it.amount || (it.rate || 0) * it.quantity), 0) ?? 0),
                    0
                  );
                  const totalPaid = supOrders.reduce((sum, r) => sum + (r.supplierPaidAmount || 0), 0);
                  const totalBalance = Math.max(0, totalBilled - totalPaid);

                  const displayedMaterials = sup.suppliedMaterials && sup.suppliedMaterials.length > 0
                    ? sup.suppliedMaterials
                    : (typeof sup.materialsSupplied === 'string'
                      ? sup.materialsSupplied.split(',').map(s => s.trim()).filter(Boolean)
                      : (Array.isArray(sup.materialsSupplied) ? (sup.materialsSupplied as string[]) : []));

                  // Calculate all payments made to this supplier to show When & How Much Paid
                  const allSupplierPayments = supOrders.flatMap(r => {
                    if (r.supplierPayments && r.supplierPayments.length > 0) {
                      return r.supplierPayments.map(p => ({ ...p, siteName: r.siteName }));
                    }
                    if (r.supplierPaidAmount && r.supplierPaidAmount > 0) {
                      return [{
                        id: r.id,
                        date: r.supplierPaymentDate || r.date || 'Recorded',
                        amount: r.supplierPaidAmount,
                        method: r.supplierPaymentMethod || 'Paid',
                        notes: r.supplierPaymentNotes,
                        siteName: r.siteName
                      }];
                    }
                    return [];
                  }).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

                  const lastPayment = allSupplierPayments[0];

                  return (
                    <Card
                      key={sup.id}
                      onClick={() => setSelectedSupplierForLedger(sup)}
                      className="p-4 rounded-2xl bg-card border border-border/60 hover:border-primary/50 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-foreground hover:text-primary transition-colors">
                              {sup.name}
                            </h4>
                            <p className="text-xs text-muted-foreground">{sup.phone || 'No phone number'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingSupId(sup.id);
                              setSupName(sup.name);
                              setSupPhone(sup.phone || '');
                              setSupAddress(sup.address || '');
                              setSupNotes(sup.notes || '');

                              const mats = sup.suppliedMaterials && sup.suppliedMaterials.length > 0
                                ? sup.suppliedMaterials
                                : (typeof sup.materialsSupplied === 'string'
                                  ? sup.materialsSupplied.split(',').map(s => s.trim()).filter(Boolean)
                                  : (Array.isArray(sup.materialsSupplied) ? (sup.materialsSupplied as string[]) : []));
                              const catalogNames = materialSettings.map(m => m.name.toLowerCase());
                              const fromCatalog = mats.filter(m => catalogNames.includes(m.toLowerCase()));
                              const extra = mats.filter(m => !catalogNames.includes(m.toLowerCase()));
                              setSelectedCatalogMaterials(fromCatalog);
                              setCustomMaterialsText(extra.join(', '));
                              setShowSupplierForm(true);
                            }}
                            className="h-7 w-7 rounded-lg"
                          >
                            <PenLine className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              deleteSupplier(sup.id);
                              toast.success('Supplier removed');
                            }}
                            className="h-7 w-7 rounded-lg text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Materials Supplied Badges */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                          <Package className="w-3 h-3 text-primary" /> Materials Supplied:
                        </span>
                        {displayedMaterials.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {displayedMaterials.map((m, i) => (
                              <span key={i} className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                                {m}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic">No materials cataloged yet</p>
                        )}
                      </div>

                      {/* Financial Ledger Mini-Strip */}
                      <div className="grid grid-cols-3 gap-1 pt-2 border-t border-border/40 text-center text-xs">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-muted-foreground block">Billed</span>
                          <span className="font-bold text-foreground">₹{totalBilled.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-muted-foreground block">Given</span>
                          <span className="font-bold text-emerald-600">₹{totalPaid.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-muted-foreground block">Balance</span>
                          <span className={`font-bold ${totalBalance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                            ₹{totalBalance.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Payment History Highlights: When & How Much Paid */}
                      <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-emerald-600" /> When & How Much Paid:
                          </span>
                          {allSupplierPayments.length > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600">
                              {allSupplierPayments.length} {allSupplierPayments.length === 1 ? 'payment' : 'payments'}
                            </span>
                          )}
                        </div>
                        {lastPayment ? (
                          <div className="text-[11px] flex flex-wrap items-center justify-between gap-1">
                            <span className="font-medium text-foreground">
                              Last Paid: <strong className="text-emerald-600 font-bold">₹{lastPayment.amount.toLocaleString()}</strong> on {lastPayment.date}
                            </span>
                            {lastPayment.method && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                {lastPayment.method}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic">No payments recorded yet</p>
                        )}
                      </div>

                      <div className="pt-1 text-[11px] text-primary font-semibold flex items-center justify-between">
                        <span>{supOrders.length} {supOrders.length === 1 ? 'Order' : 'Orders'}</span>
                        <span>Click to view ledger & history →</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── 4. FLEET VEHICLES TAB ── */}
      {activeSubTab === 'vehicles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="section-header !mb-0">Fleet Vehicles</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Manage company trucks, pickups, and transit vehicles for material dispatches</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setShowVehicleForm(v => !v);
                setEditingVehId(null);
                setVehName(''); setVehNumber(''); setVehType('Pickup'); setVehNotes('');
              }}
              className="h-9 rounded-xl gap-1.5 text-xs font-semibold text-white shadow-sm"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              <Plus className="w-3.5 h-3.5" /> {showVehicleForm && !editingVehId ? 'Close Form' : 'Add Vehicle'}
            </Button>
          </div>

          {showVehicleForm && (
            <div className="form-card animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" />
                  {editingVehId ? 'Edit Vehicle Details' : 'Register New Fleet Vehicle'}
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setShowVehicleForm(false);
                    setEditingVehId(null);
                    setVehName(''); setVehNumber(''); setVehNotes('');
                  }}
                  className="h-6 w-6 p-0 rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              <form onSubmit={handleVehicleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Vehicle Name *</Label>
                    <Input
                      placeholder="e.g. Bolero Maxi Truck"
                      value={vehName}
                      onChange={e => setVehName(e.target.value)}
                      className="mt-1 h-10 rounded-xl text-xs font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Vehicle Plate Number *</Label>
                    <Input
                      placeholder="e.g. TN 38 P 1024"
                      value={vehNumber}
                      onChange={e => setVehNumber(e.target.value)}
                      className="mt-1 h-10 rounded-xl text-xs font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Vehicle Type *</Label>
                    <Select value={vehType} onValueChange={setVehType}>
                      <SelectTrigger className="mt-1 h-10 rounded-xl text-xs">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {VEHICLE_TYPES.map(vt => (
                          <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Notes / Capacity (Optional)</Label>
                  <Input
                    placeholder="e.g. 1.5 Ton payload capacity, assigned to Salem site"
                    value={vehNotes}
                    onChange={e => setVehNotes(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowVehicleForm(false);
                      setEditingVehId(null);
                      setVehName(''); setVehNumber(''); setVehNotes('');
                    }}
                    className="flex-1 h-10 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-10 rounded-xl text-white font-bold text-xs shadow-sm"
                    style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                  >
                    {editingVehId ? 'Update Vehicle' : 'Register Vehicle to Fleet'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {filteredVehicles.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border/60">
              <Truck className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs font-semibold text-muted-foreground mb-3">
                {searchQuery ? `No vehicles matching "${searchQuery}"` : 'No vehicles registered in fleet yet'}
              </p>
              {!showVehicleForm && (
                <Button
                  size="sm"
                  onClick={() => {
                    setShowVehicleForm(true);
                    setEditingVehId(null);
                    setVehName(''); setVehNumber(''); setVehType('Pickup'); setVehNotes('');
                  }}
                  className="rounded-xl text-xs font-semibold gap-1.5 text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add First Fleet Vehicle
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredVehicles.map(veh => (
                <Card key={veh.id} className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-2 hover:border-amber-500/40 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{veh.name}</h4>
                        <span className="text-xs font-mono font-bold text-primary">{veh.number}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingVehId(veh.id);
                          setVehName(veh.name);
                          setVehNumber(veh.number);
                          setVehType(veh.type || 'Pickup');
                          setVehNotes(veh.notes || '');
                          setShowVehicleForm(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          deleteVehicle(veh.id);
                          toast.success('Vehicle removed from fleet');
                        }}
                        className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {veh.notes && (
                    <p className="text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg">
                      {veh.notes}
                    </p>
                  )}
                  <div className="pt-1 text-xs text-muted-foreground flex justify-between items-center border-t border-border/40">
                    <span>Type: <strong className="text-foreground">{veh.type || 'Other'}</strong></span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Ready for Dispatch
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 5. MATERIALS PRESETS CATALOG ── */}
      {activeSubTab === 'materials' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="section-header !mb-0">Materials Presets Catalog</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage construction materials, standard units, categories, and benchmark purchase rates.
              </p>
            </div>
            <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full w-fit">
              Total {materialSettings.length} Presets Available
            </span>
          </div>

          <div className="form-card">
            <form onSubmit={handleMaterialSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <Label className="text-xs font-semibold text-muted-foreground">Material Name *</Label>
                  <Input
                    placeholder="e.g. Cement Bag, M-Sand, Red Brick"
                    value={matName}
                    onChange={e => setMatName(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-xs font-semibold"
                  />
                  {matName.trim() && isStoreRoomMat && (() => {
                    const badge = getStorageStarBadge(matName, materialSettings, storeRoomDispatches, editingMatId || undefined);
                    return (
                      <div className="flex items-center justify-between mt-1 px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border/50 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-medium">Warehouse Inventory Tracking:</span>
                          <span className={`px-2 py-0.5 rounded-md font-bold border flex items-center gap-1 ${
                            badge.colorVariant === 'initial'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                              : badge.colorVariant === 'restock_early'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'
                              : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25'
                          }`}>
                            <span>{badge.isInitialBatch ? '✨' : '📦'}</span>
                            <span>{badge.badgeLabel}</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">
                          {badge.badgeTooltip}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div className="sm:col-span-4">
                  <Label className="text-xs font-semibold text-muted-foreground">Category *</Label>
                  <Select value={matCategory} onValueChange={setMatCategory}>
                    <SelectTrigger className="mt-1 h-10 rounded-xl text-xs font-semibold">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {MATERIAL_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat} className="text-xs font-medium">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground">Unit (UOM) *</Label>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('units')}
                      className="text-[10px] font-bold text-sky-600 hover:underline flex items-center gap-0.5"
                    >
                      <Ruler className="w-2.5 h-2.5" /> Manage Units
                    </button>
                  </div>
                  <Select value={matUnit} onValueChange={setMatUnit}>
                    <SelectTrigger className="mt-1 h-10 rounded-xl text-xs font-semibold">
                      <SelectValue placeholder="Select Unit" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {activeUnits.map(u => (
                        <SelectItem key={u} value={u} className="text-xs font-medium">
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Rental Designation & Rate */}
              <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-border/30">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={isRentalMat}
                    onChange={e => setIsRentalMat(e.target.checked)}
                    className="rounded border-border w-4 h-4 text-primary"
                  />
                  <span>Designate as Rental Material (e.g. Scaffolding, Mixer Machine, Shuttering Plates, Generator)</span>
                </label>

                {isRentalMat && (
                  <div className="flex flex-wrap items-center gap-3 pl-2 border-l border-border/40">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Rental Rate (₹/day per {matUnit || 'Unit'}):</Label>
                      <Input
                        type="number"
                        min="0"
                        value={matRentalRate}
                        onChange={e => setMatRentalRate(e.target.value)}
                        placeholder="50"
                        className="h-8 w-24 text-xs font-semibold text-amber-600 dark:text-amber-400"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Deploy directly to Site:</Label>
                      <Select value={rentalDeploySiteId} onValueChange={setRentalDeploySiteId}>
                        <SelectTrigger className="h-8 w-44 text-xs font-semibold">
                          <SelectValue placeholder="Catalog Only (No Site)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Catalog Only (No Site)</SelectItem>
                          {sites.filter(s => s.status !== 'completed').map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Store Room / Warehouse Stock Designation */}
              <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-border/30">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={isStoreRoomMat}
                    onChange={e => setIsStoreRoomMat(e.target.checked)}
                    className="rounded border-border w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="flex items-center gap-1.5">
                    <Warehouse className="w-3.5 h-3.5 text-emerald-600" />
                    Designate as Store Room / Warehouse Stock (Track In-House Stock & Dispatch with Fleet Vehicles)
                  </span>
                </label>

                {isStoreRoomMat && (
                  <div className="flex flex-wrap items-center gap-3 pl-2 border-l border-border/40">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Initial On-Hand Stock ({matUnit || 'Unit'}):</Label>
                      <Input
                        type="number"
                        min="0"
                        value={matStockQuantity}
                        onChange={e => setMatStockQuantity(e.target.value)}
                        placeholder="0"
                        className="h-8 w-24 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Min Stock Alert Level:</Label>
                      <Input
                        type="number"
                        min="0"
                        value={matMinStockAlert}
                        onChange={e => setMatMinStockAlert(e.target.value)}
                        placeholder="10"
                        className="h-8 w-20 text-xs font-semibold text-amber-600 dark:text-amber-400"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Storage Location / Rack:</Label>
                      <Input
                        value={matStoreRoomLocation}
                        onChange={e => setMatStoreRoomLocation(e.target.value)}
                        placeholder="e.g. Bay A-2, Main Depot"
                        className="h-8 w-36 text-xs font-semibold"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Buying Price (₹ per {matUnit || 'Unit'}):</Label>
                      <Input
                        type="number"
                        min="0"
                        value={matBuyingPrice}
                        onChange={e => setMatBuyingPrice(e.target.value)}
                        placeholder="0"
                        className="h-8 w-24 text-xs font-semibold text-rose-600 dark:text-rose-400"
                      />
                    </div>

                    {Number(matBuyingPrice) > 0 && Number(matStockQuantity) > 0 && (
                      <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md border border-rose-500/20">
                        Total Purchase Expense: ₹{(Number(matBuyingPrice) * Number(matStockQuantity)).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="submit"
                  className="flex-1 h-10 rounded-xl text-white font-bold text-xs shadow-sm"
                  style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                >
                  {editingMatId ? (isRentalMat ? 'Update Rental Preset' : (isStoreRoomMat ? 'Update Store Room Item' : 'Update Material Preset')) : (isRentalMat ? 'Add Rental Preset' : (isStoreRoomMat ? 'Add Store Room Item' : 'Add Material Preset'))}
                </Button>
                {editingMatId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingMatId(null);
                      setMatName('');
                      setMatCategory('Civil & Structural');
                      setMatUnit('');
                      setMatRate('');
                      setIsRentalMat(false);
                      setMatRentalRate('');
                      setRentalDeploySiteId('');
                      setIsStoreRoomMat(false);
                      setMatStockQuantity('');
                      setMatMinStockAlert('10');
                      setMatStoreRoomLocation('');
                      setMatBuyingPrice('');
                    }}
                    className="h-10 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Type Filter Pills: All / Consumables / Rentals / Store Room */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/50 w-fit">
            <button
              type="button"
              onClick={() => setMatTypeFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                matTypeFilter === 'all'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({materialSettings.length})
            </button>
            <button
              type="button"
              onClick={() => setMatTypeFilter('standard')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                matTypeFilter === 'standard'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Standard Consumables ({materialSettings.filter(m => !m.isRental && !m.isStoreRoom).length})
            </button>
            <button
              type="button"
              onClick={() => setMatTypeFilter('rental')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                matTypeFilter === 'rental'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>🔄</span> Rental Materials ({materialSettings.filter(m => m.isRental).length})
            </button>
            <button
              type="button"
              onClick={() => setMatTypeFilter('store_room')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                matTypeFilter === 'store_room'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Warehouse className="w-3.5 h-3.5" /> Store Room Stock ({materialSettings.filter(m => m.isStoreRoom).length})
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/30 rounded-xl border border-border/50">
            <button
              type="button"
              onClick={() => setSelectedMatCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                selectedMatCategoryFilter === 'all'
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground hover:text-foreground border-border/60 hover:bg-muted/60'
              }`}
            >
              All Categories ({materialSettings.length})
            </button>
            {MATERIAL_CATEGORIES.map(cat => {
              const count = materialSettings.filter(m => (m.category || 'General').toLowerCase() === cat.toLowerCase()).length;
              if (count === 0 && selectedMatCategoryFilter !== cat) return null;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedMatCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    selectedMatCategoryFilter === cat
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card text-muted-foreground hover:text-foreground border-border/60 hover:bg-muted/60'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {filteredMaterialSettings.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border/60">
              <Package className="w-9 h-9 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs font-semibold text-muted-foreground">
                {searchQuery || selectedMatCategoryFilter !== 'all'
                  ? `No material presets matching filter or search`
                  : 'No material presets saved yet'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMaterialSettings.map(m => (
                <Card
                  key={m.id}
                  className="p-3.5 rounded-xl bg-card border border-border/50 flex flex-col justify-between gap-2.5 text-xs hover:border-primary/40 transition-all shadow-2xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 truncate max-w-[190px]">
                        {m.category || 'General'}
                      </span>
                      <div className="flex items-center gap-1">
                        {m.isRental && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                            Rental
                          </span>
                        )}
                        {m.isStoreRoom && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                            <Warehouse className="w-2.5 h-2.5" /> Stock: {m.stockQuantity || 0}
                          </span>
                        )}
                        {m.isStoreRoom && (m.stockQuantity || 0) <= (m.minStockAlert ?? 10) && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                            Low Stock
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h5 className="font-bold text-foreground text-sm line-clamp-1">{getBaseMaterialName(m.name)}</h5>
                      {m.isStoreRoom && (() => {
                        const batchInfo = getStorageStarBadge(m.name, materialSettings, storeRoomDispatches);
                        return (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                              batchInfo.colorVariant === 'initial'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                                : batchInfo.colorVariant === 'restock_early'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'
                                : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25'
                            }`}
                            title={batchInfo.badgeTooltip}
                          >
                            <span>{batchInfo.isInitialBatch ? '✨' : '📦'}</span>
                            <span>{batchInfo.shortBadge}</span>
                            {batchInfo.isRestock && <span className="text-[9px] opacity-75 font-medium">(Restock)</span>}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-muted-foreground">
                      Unit: <span className="font-semibold text-foreground">{m.unit || 'Unit'}</span>
                      {m.isRental && m.rentalRatePerDay ? ` · Rental: ₹${m.rentalRatePerDay}/day` : ''}
                      {m.isStoreRoom && m.stockQuantity !== undefined ? ` · On-Hand: ${m.stockQuantity} ${m.unit || 'units'}` : ''}
                    </p>
                    {m.isStoreRoom && m.storeRoomLocation && (
                      <p className="text-[11px] text-muted-foreground">
                        Location: <span className="font-semibold text-foreground">{m.storeRoomLocation}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/30">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingMatId(m.id);
                        setMatName(getBaseMaterialName(m.name));
                        setMatCategory(m.category || 'Civil & Structural');
                        setMatUnit(m.unit || '');
                        setIsRentalMat(Boolean(m.isRental));
                        setMatRentalRate(m.rentalRatePerDay ? m.rentalRatePerDay.toString() : '');
                        setIsStoreRoomMat(Boolean(m.isStoreRoom));
                        setMatStockQuantity(m.stockQuantity !== undefined ? m.stockQuantity.toString() : '');
                        setMatMinStockAlert((m.minStockAlert ?? 10).toString());
                        setMatStoreRoomLocation(m.storeRoomLocation || '');
                        setMatBuyingPrice(m.buyingPrice ? m.buyingPrice.toString() : '');
                      }}
                      className="h-7 px-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground gap-1"
                    >
                      <PenLine className="w-3 h-3" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        deleteMaterialSetting(m.id);
                        toast.success('Preset deleted');
                      }}
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 6. STORE ROOM & CENTRAL WAREHOUSE INVENTORY ── */}
      {activeSubTab === 'store_room' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="section-header !mb-0 flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-emerald-600" /> Store Room & Central Warehouse
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Track on-hand warehouse stock, monitor low-stock warnings, and dispatch materials to sites with fleet vehicle & driver assignments.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isRefreshing}
                onClick={handleRefreshStock}
                className="h-9 rounded-xl text-xs font-semibold gap-1.5 border-border/70 hover:bg-muted"
                title="Sync and update latest warehouse stock and site deployments from database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
                {isRefreshing ? 'Syncing...' : 'Sync Live Data'}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setActiveSubTab('materials');
                  setIsStoreRoomMat(true);
                  setMatTypeFilter('store_room');
                }}
                className="h-9 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Store Room Item
              </Button>
            </div>
          </div>

          {/* Store Room KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div
              onClick={() => setStoreRoomFilter('all')}
              className="p-3 rounded-xl bg-card border border-border/60 hover:border-emerald-500/50 shadow-2xs space-y-1 cursor-pointer transition-all hover:bg-emerald-500/5 group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-foreground">Total Stored</span>
                <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600"><Boxes className="w-3.5 h-3.5" /></span>
              </div>
              <div className="text-xl font-heading font-black text-foreground">
                {storeRoomItems.length}
              </div>
              <div className="text-[10px] text-muted-foreground">Catalog presets</div>
            </div>

            <div
              onClick={() => setStoreRoomFilter('all')}
              className="p-3 rounded-xl bg-card border border-border/60 hover:border-emerald-500/50 shadow-2xs space-y-1 cursor-pointer transition-all hover:bg-emerald-500/5 group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-emerald-600">On-Hand Stock</span>
                <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600"><Box className="w-3.5 h-3.5" /></span>
              </div>
              <div className="text-xl font-heading font-black text-emerald-600 dark:text-emerald-400">
                {storeRoomItems.reduce((s, m) => s + (m.stockQuantity || 0), 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground">Cumulative units</div>
            </div>

            <div
              onClick={() => setStoreRoomFilter('low_stock')}
              className="p-3 rounded-xl bg-card border border-border/60 hover:border-amber-500/50 shadow-2xs space-y-1 cursor-pointer transition-all hover:bg-amber-500/5 group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-amber-600">Low Stock</span>
                <span className="p-1 rounded-lg bg-amber-500/10 text-amber-600"><AlertCircle className="w-3.5 h-3.5" /></span>
              </div>
              <div className="text-xl font-heading font-black text-amber-600 dark:text-amber-400">
                {lowStockStoreItems.length}
              </div>
              <div className="text-[10px] text-muted-foreground">Needs restock</div>
            </div>

            <div
              onClick={() => setStoreRoomFilter('active')}
              className="p-3 rounded-xl bg-card border border-border/60 hover:border-blue-500/60 shadow-2xs space-y-1 cursor-pointer transition-all hover:bg-blue-500/5 group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-blue-600">Active at Sites</span>
                <span className="p-1 rounded-lg bg-blue-500/10 text-blue-600"><Truck className="w-3.5 h-3.5" /></span>
              </div>
              <div className="text-xl font-heading font-black text-blue-600 dark:text-blue-400">
                {activeProductsGrouped.length} <span className="text-xs font-semibold text-muted-foreground">({activeStoreRoomDispatches.length})</span>
              </div>
              <div className="text-[10px] text-muted-foreground">Click to view items</div>
            </div>

            {/* Store Room Stock Revenue Card */}
            <div
              className="p-3 rounded-xl bg-card border border-emerald-500/30 hover:border-emerald-500/60 shadow-2xs space-y-1 transition-all bg-emerald-500/[0.04]"
              title="Total revenue billed from materials returned from sites"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Stock Revenue</span>
                <span className="p-1 rounded-lg bg-emerald-500/15 text-emerald-600"><IndianRupee className="w-3.5 h-3.5" /></span>
              </div>
              <div className="text-xl font-heading font-black text-emerald-600 dark:text-emerald-400">
                ₹{totalStoreRoomRevenue.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground">From site returns</div>
            </div>

            {/* Store Room Stock Purchases & Inventory Investment Card */}
            <div
              className="p-3 rounded-xl bg-card border border-rose-500/30 hover:border-rose-500/60 shadow-2xs space-y-1 transition-all bg-rose-500/[0.04]"
              title={`Total purchase cost of inventory items bought for Store Room. Active Stock: ₹${(totalStoreRoomPurchases - totalCrushedLoss).toLocaleString()} + Crushed Loss: ₹${totalCrushedLoss.toLocaleString()}`}
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Stock Expenses</span>
                <span className="p-1 rounded-lg bg-rose-500/15 text-rose-600"><DollarSign className="w-3.5 h-3.5" /></span>
              </div>
              <div className="text-xl font-heading font-black text-rose-600 dark:text-rose-400">
                ₹{totalStoreRoomPurchases.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {totalCrushedLoss > 0 ? `Incl. ₹${totalCrushedLoss.toLocaleString()} crushed loss` : 'Purchase investments'}
              </div>
            </div>
          </div>

          {/* Store Room Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/50 w-fit">
            <button
              type="button"
              onClick={() => setStoreRoomFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                storeRoomFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Stock ({storeRoomItems.length})
            </button>
            <button
              type="button"
              onClick={() => setStoreRoomFilter('new_stock')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                storeRoomFilter === 'new_stock'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>🟢</span> New Stock ({newStockStoreItemsCount})
            </button>
            <button
              type="button"
              onClick={() => setStoreRoomFilter('old_stock')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                storeRoomFilter === 'old_stock'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>📦</span> Old Stock ({oldStockStoreItemsCount})
            </button>
            <button
              type="button"
              onClick={() => setStoreRoomFilter('crushed_history')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                storeRoomFilter === 'crushed_history'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Crushed History ({(crushedStockHistory || []).length})
            </button>
            <button
              type="button"
              onClick={() => setStoreRoomFilter('active')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                storeRoomFilter === 'active'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Truck className="w-3.5 h-3.5" /> Active at Sites ({activeProductsGrouped.length})
            </button>
            <button
              type="button"
              onClick={() => setStoreRoomFilter('low_stock')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                storeRoomFilter === 'low_stock'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" /> Low Stock ({lowStockStoreItems.length})
            </button>
            <button
              type="button"
              onClick={() => setStoreRoomFilter('out_of_stock')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                storeRoomFilter === 'out_of_stock'
                  ? 'bg-destructive text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Out of Stock ({storeRoomItems.filter(m => (m.stockQuantity || 0) <= 0).length})
            </button>
            <button
              type="button"
              onClick={() => setStoreRoomFilter('history')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                storeRoomFilter === 'history'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History className="w-3.5 h-3.5" /> Dispatch History ({(storeRoomDispatches || []).length})
            </button>
          </div>

          {/* View: Crushed Stock Audit History */}
          {storeRoomFilter === 'crushed_history' ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/60 p-4 rounded-2xl border border-rose-500/30 shadow-2xs">
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" /> Crushed & Damaged Stock Audit History
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    History of broken, crushed, spoiled, or wasted stock in store room. Physical on-hand stock was deducted, but the purchase expense remains counted in Stock Expenses as recorded business loss.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs font-bold flex items-center gap-1.5">
                    <span>Total Loss:</span>
                    <span className="font-heading font-black text-sm">₹{totalCrushedLoss.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {(crushedStockHistory || []).length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border/60">
                  <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-600/60 mb-2" />
                  <p className="text-xs font-semibold text-muted-foreground">
                    No crushed or damaged stock recorded in history.
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Use the "Crush" button on any warehouse stock card when materials are broken or spoiled.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(crushedStockHistory || []).map(record => (
                    <Card
                      key={record.id}
                      className="p-3.5 rounded-xl bg-card border border-rose-500/30 flex flex-col justify-between gap-3 text-xs shadow-2xs hover:border-rose-500/50 transition-all bg-rose-500/[0.02]"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                            {record.reason || 'Crushed / Damaged'}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {record.date} {record.time || ''}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-foreground text-sm line-clamp-1">{record.materialName}</h4>
                          <span className="text-[11px] text-muted-foreground">
                            Category: {record.category || 'General'}
                          </span>
                        </div>

                        {/* Crushed Quantity */}
                        <div className="p-2.5 rounded-xl bg-background/60 border border-border/40 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-muted-foreground">Quantity Crushed:</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-heading font-black text-rose-600 dark:text-rose-400">
                              {record.crushedQuantity.toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-muted-foreground">{record.unit}</span>
                          </div>
                        </div>

                        {/* Financial Loss */}
                        <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
                          <span>Buying Rate: <strong>₹{record.buyingPrice || 0}/{record.unit}</strong></span>
                          <span>Incurred Loss: <strong className="font-heading font-black text-xs">₹{record.lossAmount.toLocaleString()}</strong></span>
                        </div>

                        {record.notes && (
                          <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/30 italic">
                            "{record.notes}"
                          </div>
                        )}
                      </div>

                      {/* Action buttons: Restore Stock or Remove record */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestoreCrushedStock(record)}
                          className="flex-1 h-8 rounded-lg text-xs font-semibold border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 gap-1"
                          title="Restore this stock back into Store Room available inventory"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-600" /> Restore to Stock
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCrushedHistoryEntry(record)}
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                          title="Delete this history record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : storeRoomFilter === 'active' ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/60 p-4 rounded-2xl border border-border/60 shadow-2xs">
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-600" /> Active Store Room Items Deployed at Sites
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click any active product to view its full site deployment report, delivery logs, and return/billing options.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    {activeProductsGrouped.length} Active {activeProductsGrouped.length === 1 ? 'Product' : 'Products'} ({activeStoreRoomDispatches.length} Deployments)
                  </span>
                  <div className="flex items-center p-0.5 bg-muted rounded-xl border border-border/50 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('products')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5 ${
                        activeViewMode === 'products'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Boxes className="w-3.5 h-3.5" /> By Product
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('dispatches')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5 ${
                        activeViewMode === 'dispatches'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" /> All Tickets ({activeStoreRoomDispatches.length})
                    </button>
                  </div>
                </div>
              </div>

              {activeStoreRoomDispatches.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border/60">
                  <Warehouse className="w-9 h-9 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs font-semibold text-muted-foreground">
                    No Store Room items are currently active at project sites
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Dispatch items using "Dispatch with Vehicle" in the All Stock tab or fulfill staff requests.
                  </p>
                </div>
              ) : activeViewMode === 'products' ? (
                /* Grouped Active Products Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {activeProductsGrouped.map(prod => (
                    <Card
                      key={prod.key}
                      onClick={() => setSelectedActiveProductReport(prod)}
                      className="p-4 rounded-2xl bg-card border border-blue-500/25 hover:border-blue-500/60 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3 relative overflow-hidden"
                    >
                      {/* Top Accent Gradient Bar */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-emerald-500 to-indigo-600 opacity-90" />

                      <div className="space-y-2.5 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground uppercase tracking-wider">
                              {prod.category}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h5 className="font-heading font-black text-sm text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                {getBaseMaterialName(prod.materialName)}
                              </h5>
                              {(() => {
                                const batchInfo = getStorageStarBadge(prod.materialName, materialSettings, storeRoomDispatches);
                                return (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                                      batchInfo.colorVariant === 'initial'
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                                        : batchInfo.colorVariant === 'restock_early'
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'
                                        : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25'
                                    }`}
                                    title={batchInfo.badgeTooltip}
                                  >
                                    <span>{batchInfo.isInitialBatch ? '✨' : '📦'}</span>
                                    <span>{batchInfo.shortBadge}</span>
                                    {batchInfo.isRestock && <span className="text-[9px] opacity-75 font-medium">(Restock)</span>}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-600 border border-blue-500/25 shrink-0 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {prod.uniqueSitesCount} {prod.uniqueSitesCount === 1 ? 'Site' : 'Sites'}
                          </span>
                        </div>

                        {/* KPI Quantities */}
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                            <div className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                              Active at Sites
                            </div>
                            <div className="text-lg font-black text-blue-700 dark:text-blue-300 mt-0.5">
                              {prod.totalActiveQuantity} <span className="text-[11px] font-normal">{prod.unit}</span>
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-muted/60 border border-border/50 text-center">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              In Store Room
                            </div>
                            <div className="text-lg font-black text-foreground mt-0.5">
                              {prod.warehouseStock} <span className="text-[11px] font-normal">{prod.unit}</span>
                            </div>
                          </div>
                        </div>

                        {/* Deployed Sites chips */}
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Deployed Sites:
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                            {prod.sitesList.map((st, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-muted/80 text-foreground border border-border/60 flex items-center gap-1"
                              >
                                <MapPin className="w-2.5 h-2.5 text-primary" /> {st.siteName}: <strong className="text-primary">{st.qty} {st.unit}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500" /> Max: {prod.maxDaysDeployed} {prod.maxDaysDeployed === 1 ? 'day' : 'days'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 rounded-lg gap-1"
                        >
                          <Eye className="w-3 h-3" /> View Detail Report <ChevronRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                /* Flat Individual Tickets List */
                <div className="space-y-2.5">
                  {activeStoreRoomDispatches.map(record => {
                    const delivDateStr = record.deliveryDate || record.startDate || record.date;
                    let daysDeployed = 1;
                    try {
                      const s = new Date(delivDateStr);
                      const now = new Date();
                      daysDeployed = Math.max(1, Math.ceil((now.getTime() - s.getTime()) / (1000 * 3600 * 24)));
                    } catch (e) {
                      daysDeployed = 1;
                    }

                    return (
                      <Card
                        key={record.id}
                        className="p-4 rounded-xl bg-card border border-blue-500/30 hover:border-blue-500/60 shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-foreground">{getBaseMaterialName(record.materialName)}</span>
                              {(() => {
                                const batchInfo = getStorageStarBadge(record.materialName, materialSettings, storeRoomDispatches);
                                return (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                                      batchInfo.colorVariant === 'initial'
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                                        : batchInfo.colorVariant === 'restock_early'
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'
                                        : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25'
                                    }`}
                                    title={batchInfo.badgeTooltip}
                                  >
                                    <span>{batchInfo.isInitialBatch ? '✨' : '📦'}</span>
                                    <span>{batchInfo.shortBadge}</span>
                                    {batchInfo.isRestock && <span className="text-[9px] opacity-75 font-medium">(Restock)</span>}
                                  </span>
                                );
                              })()}
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                              {record.quantity} {record.unit}
                            </span>
                            <span className="text-muted-foreground">➔</span>
                            <span className="font-bold text-primary flex items-center gap-1 text-xs">
                              <MapPin className="w-3.5 h-3.5" /> {record.siteName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 border border-blue-500/25">
                              {daysDeployed} {daysDeployed === 1 ? 'day' : 'days'} duration on site
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-muted-foreground text-[11px] flex-wrap">
                            <span className="flex items-center gap-1 font-semibold text-foreground">
                              <Calendar className="w-3 h-3 text-emerald-600" /> Delivery Date: {delivDateStr}
                            </span>
                            {record.vehicleNumber && record.vehicleNumber !== 'No Vehicle Assigned' ? (
                              <span className="flex items-center gap-1">
                                <Truck className="w-3 h-3 text-blue-500" /> Vehicle: {record.vehicleNumber}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">No vehicle assigned</span>
                            )}
                            {record.driverName && (
                              <span>Driver: <strong className="text-foreground">{record.driverName}</strong></span>
                            )}
                            {record.dispatchedBy && <span>Dispatched by: {record.dispatchedBy}</span>}
                          </div>

                          {record.notes && (
                            <p className="text-[11px] text-muted-foreground italic bg-muted/30 px-2 py-1 rounded-lg">
                              Notes: {record.notes}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => openReturnStoreRoomItemModal(record)}
                            className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 rounded-xl shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Return & Bill Site
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          ) : storeRoomFilter === 'history' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" /> Store Room Dispatch & Fleet Transfer Log
                </h4>
                <span className="text-xs text-muted-foreground">
                  {(storeRoomDispatches || []).length} Recorded Dispatches
                </span>
              </div>

              {filteredStoreRoomDispatches.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border/60">
                  <Truck className="w-9 h-9 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs font-semibold text-muted-foreground">
                    No Store Room dispatches recorded yet
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredStoreRoomDispatches.map(record => {
                    const isReturned = record.status === 'returned';

                    return (
                      <Card
                        key={record.id}
                        className={`p-3.5 rounded-xl bg-card border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                          isReturned ? 'border-emerald-500/30' : 'border-border/50 hover:border-border'
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground">{record.materialName}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              {record.quantity} {record.unit}
                            </span>
                            <span className="text-muted-foreground">➔</span>
                            <span className="font-semibold text-primary flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {record.siteName}
                            </span>
                            {isReturned && (record.storeRoomAmount || 0) > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                                Profit: +₹{record.storeRoomAmount?.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground text-[11px] flex-wrap">
                            <span>Delivery Date: {record.deliveryDate || record.startDate || record.date} {record.time ? `at ${record.time}` : ''}</span>
                            {record.returnDate && (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                Returned on: {record.returnDate}
                              </span>
                            )}
                            {record.totalDays ? (
                              <span className="font-semibold text-foreground">
                                Duration: {record.totalDays} {record.totalDays === 1 ? 'day' : 'days'} {record.perDayRate ? `(@ ₹${record.perDayRate}/day)` : ''}
                              </span>
                            ) : null}
                            {record.vehicleNumber && record.vehicleNumber !== 'No Vehicle Assigned' && (
                              <span className="flex items-center gap-1">
                                <Truck className="w-3 h-3 text-blue-500" /> Vehicle: {record.vehicleNumber}
                              </span>
                            )}
                            {record.driverName && (
                              <span>Driver: <strong className="text-foreground">{record.driverName}</strong></span>
                            )}
                            {record.dispatchedBy && <span>By: {record.dispatchedBy}</span>}
                          </div>
                          {record.notes && (
                            <p className="text-[11px] text-muted-foreground italic">
                              Notes: {record.notes}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {isReturned ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Returned & Billed
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => openReturnStoreRoomItemModal(record)}
                              className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 rounded-lg"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Return & Bill
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              {filteredStoreRoomItems.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border/60">
                  <Warehouse className="w-9 h-9 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs font-semibold text-muted-foreground mb-3">
                    {searchQuery || storeRoomFilter !== 'all'
                      ? 'No store room materials match the filter'
                      : 'No store room materials registered in inventory yet'}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveSubTab('materials');
                      setIsStoreRoomMat(true);
                      setMatTypeFilter('store_room');
                    }}
                    className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    + Add First Store Room Item
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredStoreRoomItems.map(item => {
                    const currentStock = item.stockQuantity || 0;
                    const minAlert = item.minStockAlert ?? 10;
                    const isLow = currentStock <= minAlert && currentStock > 0;
                    const isOut = currentStock <= 0;

                    return (
                      <Card
                        key={item.id}
                        className={`p-3.5 rounded-xl bg-card border flex flex-col justify-between gap-3 text-xs hover:border-emerald-500/40 transition-all shadow-2xs ${
                          isOut ? 'border-destructive/40 bg-destructive/5' : isLow ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/50'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 truncate">
                              {item.category || 'General'}
                            </span>
                            <div className="flex items-center gap-1">
                              {item.storeRoomLocation && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/60">
                                  📍 {item.storeRoomLocation}
                                </span>
                              )}
                              {isOut ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
                                  Out of Stock
                                </span>
                              ) : isLow ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                  Low Stock Warning
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                  In Stock
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-foreground text-sm line-clamp-1">{getBaseMaterialName(item.name)}</h4>
                              {(() => {
                                const stockInfo = getStoreRoomStockClassification(item, storeRoomItems);
                                if (stockInfo.isNewStock) {
                                  return (
                                    <span
                                      className="px-2 py-0.5 rounded-md text-[10px] font-extrabold border flex items-center gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                      title="New Stock: Latest batch or arrival in store room"
                                    >
                                      <span>🟢</span>
                                      <span>New Stock</span>
                                      {stockInfo.isDuplicateName && (
                                        <span className="text-[9px] opacity-80 font-semibold">· Latest Arrival</span>
                                      )}
                                    </span>
                                  );
                                }
                                return (
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border flex items-center gap-1 ${
                                      stockInfo.colorVariant === 'old_prev'
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                        : 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30'
                                    }`}
                                    title={`Old Stock: ${stockInfo.arrivalNote} of this item`}
                                  >
                                    <span>📦</span>
                                    <span>Old Stock</span>
                                    <span className="text-[9px] opacity-85 font-semibold">· {stockInfo.arrivalNote}</span>
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Alert threshold: ≤ {minAlert} {item.unit || 'units'}
                            </p>
                          </div>

                          {/* Large on-hand stock display */}
                          <div className="p-2.5 rounded-xl bg-background/60 border border-border/40 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-muted-foreground">Available On-Hand:</span>
                            <div className="flex items-baseline gap-1">
                              <span className={`text-xl font-heading font-black ${
                                isOut ? 'text-destructive' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {currentStock.toLocaleString()}
                              </span>
                              <span className="text-xs font-bold text-muted-foreground">{item.unit || 'Unit'}</span>
                            </div>
                          </div>

                          {/* Buying Price & Inventory Asset Value */}
                          <div className="flex items-center justify-between text-[11px] px-1 py-1 rounded-lg bg-muted/40 border border-border/40 text-muted-foreground">
                            <span>Buying: <strong className="text-rose-600 dark:text-rose-400 font-bold">₹{item.buyingPrice || 0}</strong>/{item.unit || 'unit'}</span>
                            <span>Asset Value: <strong className="text-foreground font-semibold">₹{((item.stockQuantity || 0) * (item.buyingPrice || 0)).toLocaleString()}</strong></span>
                          </div>

                          {/* Active at Sites indicator & Quick Report Trigger */}
                          {(() => {
                            const activeDeployment = activeProductsGrouped.find(
                              p => p.key === item.name.toLowerCase().trim() || p.materialId === item.id
                            );
                            if (!activeDeployment || activeDeployment.totalActiveQuantity <= 0) return null;
                            return (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedActiveProductReport(activeDeployment);
                                }}
                                className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/25 hover:bg-blue-500/20 transition-all flex items-center justify-between cursor-pointer group shadow-2xs"
                                title="Click to view full active site deployment report"
                              >
                                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 min-w-0">
                                  <Truck className="w-3.5 h-3.5 shrink-0" />
                                  <span className="text-[11px] font-bold truncate">
                                    {activeDeployment.totalActiveQuantity} {item.unit || 'units'} Active ({activeDeployment.uniqueSitesCount} {activeDeployment.uniqueSitesCount === 1 ? 'Site' : 'Sites'})
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-0.5 shrink-0 group-hover:underline">
                                  <Eye className="w-3 h-3" /> Report <ChevronRight className="w-2.5 h-2.5" />
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Action Buttons: Dispatch with Vehicle, Adjust Stock, Crush, Delete */}
                        <div className="flex items-center gap-1.5 pt-2 border-t border-border/40">
                          <Button
                            type="button"
                            size="sm"
                            disabled={isOut}
                            onClick={() => {
                              setDispatchSelectedMaterial(item);
                              setDispatchQuantity('1');
                              setDispatchDate(format(new Date(), 'yyyy-MM-dd'));
                              setDispatchTime(format(new Date(), 'hh:mm a'));
                              setShowDispatchModal(true);
                            }}
                            className="flex-1 h-8 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-xs disabled:opacity-50"
                            title="Dispatch stock to a site using fleet vehicle and driver"
                          >
                            <Truck className="w-3.5 h-3.5" /> Dispatch
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAdjustStockModal({ open: true, material: item });
                              setAdjustMode('add');
                              setAdjustQuantity('');
                              setAdjustBuyingPrice((item.buyingPrice || '').toString());
                              setAdjustMinStockAlert((item.minStockAlert ?? 10).toString());
                              setAdjustLocation(item.storeRoomLocation || '');
                            }}
                            className="h-8 px-2 text-xs font-semibold rounded-lg border-border/70 hover:bg-muted"
                            title="Add stock quantity"
                          >
                            <Plus className="w-3.5 h-3.5 mr-0.5" /> Stock
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isOut}
                            onClick={() => {
                              setCrushModal({ open: true, material: item });
                              setCrushQuantity((item.stockQuantity || 1).toString());
                              setCrushReason('💥 Crushed / Broken in warehouse');
                              setCrushNotes('');
                            }}
                            className="h-8 px-2 text-xs font-bold rounded-lg border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 gap-1"
                            title="Crush / Damaged stock: Physical stock is reduced, cost remains in Stock Expenses, logged in History"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Crush
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDeleteStockModal({ open: true, material: item });
                            }}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                            title="Delete stock: Removes item and minuses its cost from Stock Expenses"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 7. MATERIAL UNITS (UOM) MASTER TAB ── */}
      {activeSubTab === 'units' && (
        <Card className="p-4 rounded-2xl border-border/50 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Ruler className="w-4 h-4 text-sky-600" /> Units of Measurement (UOM)
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create and manage custom units used across Material Catalog, Store Room Stock, Site Requisitions, and Supplier Orders.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-sky-500/10 text-sky-600 rounded-lg">
              {activeUnits.length} Units Available
            </span>
          </div>

          {/* Form to add unit */}
          <form onSubmit={handleAddUnit} className="flex items-end gap-3 p-3 bg-muted/20 rounded-xl border border-border/40">
            <div className="flex-1 max-w-sm">
              <Label className="text-xs font-semibold">New Unit of Measurement *</Label>
              <Input
                value={newUnitName}
                onChange={e => setNewUnitName(e.target.value)}
                placeholder="e.g. Cft, Brass, Bundles, Rolls, Box, Piece, Meter, Sq.Mtr"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <Button type="submit" className="h-9 gap-1 text-xs bg-sky-600 hover:bg-sky-700 text-white font-semibold">
              <Plus className="w-3.5 h-3.5" /> Add Unit
            </Button>
          </form>

          {/* Quick Suggestions */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Quick Suggestions (Click to Add):
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {['Cft', 'Brass', 'Bundles', 'Rolls', 'Boxes', 'Pieces', 'Meters', 'Sq.Mtr', 'Hours', 'Days', 'Trips', 'Load', 'Liters', 'Bags', 'Tons', 'Kg', 'Nos', 'Sets']
                .filter(u => !activeUnits.some(existing => existing.toLowerCase() === u.toLowerCase()))
                .map(sug => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      addUnit(sug);
                      toast.success(`Unit "${sug}" added!`);
                    }}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-dashed border-sky-500/40 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> {sug}
                  </button>
                ))}
            </div>
          </div>

          {/* Unit Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-2">
            {activeUnits.map(unit => {
              const usageCount = (materialSettings || []).filter(m => m.unit?.toLowerCase() === unit.toLowerCase()).length;
              return (
                <div
                  key={unit}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card hover:border-sky-500/40 hover:shadow-sm transition-all"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-sky-500" />
                      {unit}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      {usageCount} {usageCount === 1 ? 'material' : 'materials'} linked
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveUnit(unit)}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                    title={`Delete ${unit}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── SUPPLIER HISTORY & LEDGER MODAL (INTERACTIVE WITH PAYMENT METHODS) ── */}
      {selectedSupplierForLedger && (() => {
        const sup = selectedSupplierForLedger;
        const supOrders = (materialRequests || [])
          .filter(r => r.supplierId === sup.id || r.supplierName === sup.name)
          .sort((a, b) => getReqTimestamp(b) - getReqTimestamp(a));

        const totalBilled = supOrders.reduce(
          (sum, r) => sum + (r.supplierPrice ?? r.materialCost ?? r.items?.reduce((s, it) => s + (it.amount || (it.rate || 0) * it.quantity), 0) ?? 0),
          0
        );
        const totalPaid = supOrders.reduce((sum, r) => sum + (r.supplierPaidAmount || 0), 0);
        const totalBalance = Math.max(0, totalBilled - totalPaid);

        return (
          <Dialog open={true} onOpenChange={open => { if (!open) setSelectedSupplierForLedger(null); }}>
            <DialogContent className="max-w-2xl rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
              <DialogHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-heading font-bold text-foreground">
                        {sup.name} — Supplier Ledger
                      </DialogTitle>
                      <p className="text-xs text-muted-foreground">{sup.phone || 'No phone'} · {sup.address || 'Location on file'}</p>
                      {(() => {
                        const mats = sup.suppliedMaterials && sup.suppliedMaterials.length > 0
                          ? sup.suppliedMaterials
                          : (typeof sup.materialsSupplied === 'string'
                            ? sup.materialsSupplied.split(',').map(x => x.trim()).filter(Boolean)
                            : (Array.isArray(sup.materialsSupplied) ? (sup.materialsSupplied as string[]) : []));
                        if (mats.length === 0) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground">Supplies:</span>
                            {mats.map((m, i) => (
                              <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                {m}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* Financial Ledger Summary Strip */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-muted/30 rounded-xl border border-border/50 text-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Billed</span>
                  <span className="text-lg font-heading font-bold text-foreground">₹{totalBilled.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Amount Given</span>
                  <span className="text-lg font-heading font-bold text-emerald-600">₹{totalPaid.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Remaining Balance</span>
                  <span className={`text-lg font-heading font-bold ${totalBalance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                    ₹{totalBalance.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Order Purchase History */}
              <div className="space-y-3 mt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Material Orders & Purchase History ({supOrders.length})</span>
                  <span>Quantity, Pricing & Payments</span>
                </h4>

                {supOrders.length === 0 ? (
                  <div className="text-center py-8 bg-muted/20 rounded-xl border border-border/40 text-xs text-muted-foreground">
                    No orders recorded for this supplier yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {supOrders.map(req => {
                      const orderPrice = req.supplierPrice ?? req.materialCost ?? 0;
                      const orderPaid = req.supplierPaidAmount || 0;
                      const orderBal = Math.max(0, orderPrice - orderPaid);

                      const orderPayments: SupplierPaymentRecord[] = req.supplierPayments && req.supplierPayments.length > 0
                        ? req.supplierPayments
                        : (req.supplierPaidAmount && req.supplierPaidAmount > 0
                          ? [{
                            id: 'init-' + req.id,
                            date: req.supplierPaymentDate || req.date || 'Recorded',
                            amount: req.supplierPaidAmount,
                            method: req.supplierPaymentMethod || 'Paid',
                            notes: req.supplierPaymentNotes
                          }]
                          : []);

                      return (
                        <Card key={req.id} className="p-3.5 rounded-xl bg-card border border-border/50 text-xs space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-primary" />
                              <span className="font-bold text-foreground text-sm">{req.siteName}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">({req.date || 'Today'})</span>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${orderBal <= 0 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
                                }`}
                            >
                              {orderBal <= 0 ? 'Fully Paid' : `Balance: ₹${orderBal.toLocaleString()}`}
                            </span>
                          </div>

                          {/* Items Ordered with Rate & Auto Price */}
                          <div className="space-y-1.5 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                              Items Ordered & Supplier Rates:
                            </span>
                            {req.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[11px] bg-background/60 p-2 rounded-lg border border-border/30">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <strong className="text-foreground">{it.name}</strong>
                                  <span className="text-muted-foreground font-semibold">({it.quantity} {it.unit || 'Unit'})</span>
                                  <span className="text-primary font-bold text-[10px] bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                                    Rate: ₹{it.supplierRate ?? it.rate ?? 0} / {it.unit || 'Unit'}
                                  </span>
                                  {(it.gstAmount || 0) > 0 && (
                                    it.gstType === 'cgst_sgst' ? (
                                      <span className="text-blue-700 dark:text-blue-400 font-bold text-[10px] bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">
                                        CGST {it.cgstRate}% (₹{it.cgstAmount}) + SGST {it.sgstRate}% (₹{it.sgstAmount})
                                      </span>
                                    ) : (
                                      <span className="text-emerald-700 dark:text-emerald-400 font-bold text-[10px] bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                        +{it.gstRate}% GST (₹{it.gstAmount?.toLocaleString()})
                                      </span>
                                    )
                                  )}
                                </div>
                                <span className="font-bold text-foreground font-mono">
                                  {it.rate ? `${it.quantity} ${it.unit || 'units'} × ₹${it.supplierRate ?? it.rate} = ` : ''}₹{((it.supplierAmount || it.amount || ((it.supplierRate ?? it.rate ?? 0) * it.quantity)) + (it.gstAmount || 0)).toLocaleString()}
                                </span>
                              </div>
                            ))}
                            {(req.gstAmount || 0) > 0 && (
                              <div className="pt-1.5 mt-1.5 border-t border-border/30 space-y-1">
                                <div className="flex justify-between items-center text-[11px] text-muted-foreground px-2">
                                  <span>Material Subtotal:</span>
                                  <span className="font-mono font-semibold text-foreground">
                                    ₹{((req.supplierPrice || req.materialCost || 0) - req.gstAmount!).toLocaleString()}
                                  </span>
                                </div>
                                {req.gstType === 'inter-state' || req.gstType === 'igst' ? (
                                  <div className="flex justify-between items-center text-[11px] text-muted-foreground px-2">
                                    <span>IGST ({req.igstRate || 0}%):</span>
                                    <span className="font-mono font-semibold text-foreground">₹{(req.igstAmount ?? req.gstAmount)?.toLocaleString()}</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex justify-between items-center text-[11px] text-muted-foreground px-2">
                                      <span>CGST ({req.cgstRate || ((req.gstRate || 0) / 2)}%):</span>
                                      <span className="font-mono font-semibold text-foreground">₹{(req.cgstAmount ?? ((req.gstAmount || 0) / 2)).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px] text-muted-foreground px-2">
                                      <span>SGST ({req.sgstRate || ((req.gstRate || 0) / 2)}%):</span>
                                      <span className="font-mono font-semibold text-foreground">₹{(req.sgstAmount ?? ((req.gstAmount || 0) / 2)).toLocaleString()}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="space-y-1.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                                <CreditCard className="w-3.5 h-3.5 text-emerald-600" /> When & How Much Paid (With Payment Method & Rates):
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                Paid: ₹{orderPaid.toLocaleString()} / ₹{orderPrice.toLocaleString()}
                              </span>
                            </div>

                            {orderPayments.length > 0 ? (
                              <div className="space-y-1.5 pt-0.5">
                                {orderPayments.map((p, pIdx) => (
                                  <div
                                    key={p.id || pIdx}
                                    className="p-2.5 rounded-lg bg-background/80 border border-emerald-500/30 text-[11px] space-y-1"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="font-semibold text-foreground">
                                          When: <strong>{p.date || 'Recorded Date'}{p.time ? ` at ${p.time}` : ''}</strong>
                                        </span>
                                        <span className="text-muted-foreground">·</span>
                                        <span className="font-bold text-emerald-600 font-mono">
                                          Paid: ₹{p.amount.toLocaleString()}
                                        </span>
                                        {p.method && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                            💳 {p.method}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {p.supplierRateDescription && (
                                      <div className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/30">
                                        <span className="font-semibold text-foreground">Supplier Rate at Payment:</span> {p.supplierRateDescription}
                                      </div>
                                    )}
                                    {p.notes && (
                                      <p className="text-[10px] italic text-muted-foreground">"{p.notes}"</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground italic py-1">
                                No payments recorded yet for this order. Remaining balance: <strong className="text-destructive font-mono">₹{orderBal.toLocaleString()}</strong>
                              </div>
                            )}
                          </div>

                          {/* Financials & Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              <span>Bill: <strong className="text-foreground">₹{orderPrice.toLocaleString()}</strong></span>
                              <span>Total Given: <strong className="text-emerald-600 font-bold">₹{orderPaid.toLocaleString()}</strong></span>
                              <span>Balance: <strong className={orderBal > 0 ? 'text-destructive font-bold' : 'text-emerald-600'}>₹{orderBal.toLocaleString()}</strong></span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCompleteModal({ open: true, request: req })}
                                className="h-7 text-[11px] font-semibold gap-1 rounded-lg border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                              >
                                <PenLine className="w-3 h-3" /> Edit Rates & GST
                              </Button>
                              {orderBal > 0 ? (
                                <Button
                                  size="sm"
                                  onClick={() => openPayModal(req)}
                                  className="h-7 text-[11px] font-bold gap-1 rounded-lg text-white"
                                  style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                                >
                                  <CreditCard className="w-3 h-3" /> Record Payment
                                </Button>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 font-bold text-[11px] flex items-center gap-1 border border-emerald-500/25">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Payment Completed
                                </span>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── RECORD SUPPLIER PAYMENT MODAL (WITH PAYMENT HISTORY & WHEN PAID) ── */}
      <Dialog open={payModal.open} onOpenChange={open => setPayModal(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2 border-b border-border/50">
            <DialogTitle className="text-base font-heading font-bold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Record Supplier Payment
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Supplier: <strong className="text-foreground">{payModal.request?.supplierName || 'Supplier'}</strong> · Site:{' '}
              <strong className="text-foreground">{payModal.request?.siteName}</strong>
            </p>
          </DialogHeader>

          {(() => {
            const req = payModal.request;
            if (!req) return null;
            const price = req.supplierPrice ?? req.materialCost ?? 0;
            const existingPayments: SupplierPaymentRecord[] = req.supplierPayments && req.supplierPayments.length > 0
              ? req.supplierPayments
              : (req.supplierPaidAmount && req.supplierPaidAmount > 0
                ? [{
                  id: 'init-' + req.id,
                  date: req.supplierPaymentDate || req.date || 'Recorded',
                  amount: req.supplierPaidAmount,
                  method: req.supplierPaymentMethod || 'Paid',
                  notes: req.supplierPaymentNotes
                }]
                : []);
            const totalAlreadyPaid = existingPayments.reduce((s, p) => s + p.amount, 0);
            const remainingBal = Math.max(0, price - totalAlreadyPaid);
            const paidNowNum = Number(payAmount) || 0;
            const afterPayBal = Math.max(0, remainingBal - paidNowNum);

            return (
              <div className="space-y-3.5 mt-2">
                {/* Financial Summary & Item Breakdown */}
                <div className="p-3 bg-muted/40 rounded-xl space-y-2 text-xs border border-border/40">
                  {req.items && req.items.length > 0 && (
                    <div className="space-y-1.5 pb-2 border-b border-border/40">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                        Ordered Items & Supplier Rates:
                      </span>
                      {req.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] bg-background/60 p-2 rounded-lg border border-border/40">
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-foreground">{it.name}</strong>{' '}
                            <span className="text-muted-foreground font-semibold">({it.quantity} {it.unit || 'Unit'})</span>
                            <span className="text-primary font-bold text-[10px] bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                              Supplier Rate: ₹{it.rate || 0} / {it.unit || 'Unit'}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-foreground">
                            {it.rate ? `${it.quantity} ${it.unit || 'Unit'} × ₹${it.rate} = ` : ''}₹{(it.amount || (it.rate || 0) * it.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Total Order Payment / Bill:</span>
                    <span className="font-bold text-sm font-mono text-foreground">₹{price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Total Given so far:</span>
                    <span className="font-bold text-emerald-600 font-mono">₹{totalAlreadyPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-border/40 font-bold">
                    <span>Remaining Balance:</span>
                    <span className={remainingBal > 0 ? 'text-destructive font-mono' : 'text-emerald-600 font-mono'}>
                      ₹{remainingBal.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Past Payments List */}
                {existingPayments.length > 0 && (
                  <div className="space-y-1.5 p-2.5 rounded-xl bg-muted/30 border border-border/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Previous Payments Made ({existingPayments.length}):
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                      {existingPayments.map((p, idx) => (
                        <div
                          key={p.id || idx}
                          className="p-2.5 rounded-lg bg-card border border-border/40 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-emerald-600 font-mono">₹{p.amount.toLocaleString()}</span>
                              <span className="text-muted-foreground">on <strong>{p.date}</strong>{p.time ? ` at ${p.time}` : ''}</span>
                              {p.method && (
                                <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold text-[9px] border border-primary/20">
                                  💳 {p.method}
                                </span>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeletePayment(p.id)}
                              className="h-6 w-6 text-destructive hover:bg-destructive/10 rounded-md shrink-0"
                              title="Delete this payment record"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          {p.supplierRateDescription && (
                            <div className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/30">
                              <span className="font-semibold text-foreground">Supplier Rate:</span> {p.supplierRateDescription}
                            </div>
                          )}
                          {p.notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{p.notes}"</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Payment Form */}
                <form onSubmit={handleSavePayment} className="space-y-3 pt-1 border-t border-border/40">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-primary" /> Add New Payment:
                  </span>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-muted-foreground">Amount Paid Now (₹) *</Label>
                      {remainingBal > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayAmount(remainingBal.toString())}
                          className="text-[10px] text-emerald-600 font-bold hover:underline"
                        >
                          Pay Full Balance (₹{remainingBal.toLocaleString()})
                        </button>
                      )}
                    </div>
                    <Input
                      type="number"
                      min="1"
                      placeholder="e.g. 5000"
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      className="h-10 rounded-xl text-base font-bold text-emerald-600 mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-primary" /> Date *
                      </Label>
                      <Input
                        type="date"
                        value={payDate}
                        onChange={e => setPayDate(e.target.value)}
                        className="h-9 rounded-xl text-xs mt-1 font-semibold"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary" /> Time *
                      </Label>
                      <Select value={payTime} onValueChange={setPayTime}>
                        <SelectTrigger className="h-9 rounded-xl mt-1 text-xs font-semibold">
                          <SelectValue placeholder="Select Time" />
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
                      <Label className="text-xs font-semibold text-muted-foreground">Payment Method *</Label>
                      <Select value={payMethod} onValueChange={(val: any) => setPayMethod(val)}>
                        <SelectTrigger className="h-9 rounded-xl mt-1 text-xs font-semibold">
                          <SelectValue placeholder="Select Payment Method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UPI / GPay">📱 UPI / GPay</SelectItem>
                          <SelectItem value="Cash">💵 Cash</SelectItem>
                          <SelectItem value="Bank Transfer / NEFT">🏦 Bank Transfer / NEFT</SelectItem>
                          <SelectItem value="Cheque">📜 Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Reference / Txn Note</Label>
                    <Input
                      placeholder="e.g. GPay UPI Ref #4092, Cash via driver"
                      value={payNotes}
                      onChange={e => setPayNotes(e.target.value)}
                      className="h-9 rounded-xl text-xs mt-1"
                    />
                  </div>

                  {paidNowNum > 0 && (
                    <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-muted/40 font-semibold">
                      <span className="text-muted-foreground">Balance After This Payment:</span>
                      <span className={afterPayBal > 0 ? 'text-destructive font-mono' : 'text-emerald-600 font-mono'}>
                        ₹{afterPayBal.toLocaleString()}
                      </span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl text-white font-bold text-xs shadow-sm mt-1"
                    style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                  >
                    Confirm & Save Payment (₹{(Number(payAmount) || 0).toLocaleString()})
                  </Button>
                </form>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── QUANTITY & RATES EDITING MODAL (SUPPLIER & CLIENT/CUSTOMER RATES) ── */}
      <Dialog open={rateEditModal.open} onOpenChange={open => setRateEditModal(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-2xl sm:max-w-3xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto border border-border/80 shadow-2xl backdrop-blur-md">
          <DialogHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                <IndianRupee className="w-4 h-4" />
              </div>
              <DialogTitle className="text-lg font-heading font-black text-foreground">
                Edit Material Rates (Supplier & Client)
              </DialogTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-1 text-xs">
              <span className="px-2.5 py-1 rounded-xl bg-primary/10 text-primary font-semibold flex items-center gap-1.5 border border-primary/20">
                <Building2 className="w-3.5 h-3.5" /> Site: <strong className="text-foreground">{rateEditModal.request?.siteName}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1.5 border border-amber-500/20">
                <Package className="w-3.5 h-3.5" /> Supplier: <strong className="text-foreground">{rateEditModal.request?.supplierName || 'Assigned Supplier'}</strong>
              </span>
              {rateEditModal.request?.driverName && (
                <span className="px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5 border border-blue-500/20">
                  <Truck className="w-3.5 h-3.5" /> Driver: <strong className="text-foreground">{rateEditModal.request.driverName}</strong>
                </span>
              )}
            </div>
          </DialogHeader>

          {/* Rate Clarification Banner */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 text-xs space-y-1.5 mt-2">
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
                <span>What we bill the client. <strong>Materials only here; driver transit wage & petrol are added on delivery completion.</strong></span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveQuantityRates} className="space-y-3.5 mt-2">
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {editingItems.map((it, idx) => {
                const sRate = it.supplierRate !== undefined ? it.supplierRate : (it.rate || 0);
                const cRate = it.clientRate !== undefined ? it.clientRate : (it.customerRate !== undefined ? it.customerRate : sRate);
                const sTotal = (it.supplierAmount !== undefined ? it.supplierAmount : (it.amount || sRate * it.quantity));
                const cTotal = (it.clientAmount !== undefined ? it.clientAmount : (it.customerAmount !== undefined ? it.customerAmount : cRate * it.quantity));

                return (
                  <div key={idx} className="p-3.5 rounded-2xl bg-card border border-border/70 text-xs space-y-3 shadow-xs hover:border-primary/40 transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <span className="text-foreground font-bold text-sm flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-primary" />
                        {it.name}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">
                          🏢 Supplier: ₹{sTotal.toLocaleString()}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-bold">
                          👤 Client: ₹{cTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold">Delivered / Requested Quantity</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="any"
                          value={it.quantity}
                          onChange={e => {
                            const newQty = Number(e.target.value) || 0;
                            setEditingItems(prev => {
                              const copy = [...prev];
                              const cur = copy[idx];
                              const curSRate = cur.supplierRate !== undefined ? cur.supplierRate : (cur.rate || 0);
                              const curCRate = cur.clientRate !== undefined ? cur.clientRate : (cur.customerRate !== undefined ? cur.customerRate : curSRate);
                              copy[idx] = {
                                ...cur,
                                quantity: newQty,
                                amount: Math.round(newQty * curSRate * 100) / 100,
                                supplierAmount: Math.round(newQty * curSRate * 100) / 100,
                                clientAmount: Math.round(newQty * curCRate * 100) / 100,
                                customerAmount: Math.round(newQty * curCRate * 100) / 100
                              };
                              return copy;
                            });
                          }}
                          className="h-8 rounded-lg text-xs font-bold mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold">Unit</Label>
                        <Select
                          value={it.unit || 'Unit'}
                          onValueChange={unitVal => {
                            setEditingItems(prev => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], unit: unitVal };
                              return copy;
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 rounded-lg text-xs font-semibold mt-1">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeUnits.map(u => (
                              <SelectItem key={u} value={u}>
                                {u}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Two Clean Rate Inputs: Supplier vs Client/Customer */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {/* 1. Supplier Rate (Purchase) */}
                      <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/25 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-black">
                            🏢 Supplier Rate (₹) *
                          </Label>
                          <span className="text-[9px] font-mono text-muted-foreground">per {it.unit || 'unit'}</span>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={it.supplierRate === 0 || it.supplierRate === '0' ? '' : (it.supplierRate ?? '')}
                          placeholder="e.g. 20"
                          onChange={e => {
                            const newRate = Number(e.target.value) || 0;
                            setEditingItems(prev => {
                              const copy = [...prev];
                              const cur = copy[idx];
                              copy[idx] = {
                                ...cur,
                                rate: newRate,
                                supplierRate: newRate,
                                amount: Math.round(cur.quantity * newRate * 100) / 100,
                                supplierAmount: Math.round(cur.quantity * newRate * 100) / 100
                              };
                              return copy;
                            });
                          }}
                          className="h-8 rounded-lg text-xs font-bold border-emerald-500/30 focus-visible:ring-emerald-500/40"
                        />
                        <div className="text-[10px] text-right font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                          Supplier: ₹{sTotal.toLocaleString()}
                        </div>
                        <span className="text-[9px] text-muted-foreground block text-right">
                          Materials only (No driver/petrol)
                        </span>
                      </div>

                      {/* 2. Client Rate (Selling) */}
                      <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-primary uppercase font-black">
                            👤 Client Rate (₹) *
                          </Label>
                          <span className="text-[9px] font-mono text-muted-foreground">per {it.unit || 'unit'}</span>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={it.clientRate === 0 || it.clientRate === '0' ? '' : (it.clientRate ?? '')}
                          placeholder="e.g. 25"
                          onChange={e => {
                            const newRate = Number(e.target.value) || 0;
                            setEditingItems(prev => {
                              const copy = [...prev];
                              const cur = copy[idx];
                              copy[idx] = {
                                ...cur,
                                clientRate: newRate,
                                customerRate: newRate,
                                clientAmount: Math.round(cur.quantity * newRate * 100) / 100,
                                customerAmount: Math.round(cur.quantity * newRate * 100) / 100
                              };
                              return copy;
                            });
                          }}
                          className="h-8 rounded-lg text-xs font-bold border-primary/30 focus-visible:ring-primary/40"
                        />
                        <div className="text-[10px] text-right font-mono text-primary font-bold">
                          Client: ₹{cTotal.toLocaleString()}
                        </div>
                        <span className="text-[9px] text-muted-foreground block text-right">
                          Selling price for client
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Supplier & Client Summary Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-border/40 text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex justify-between items-center">
                <div>
                  <span className="font-bold text-[10px] text-emerald-700 dark:text-emerald-300 uppercase block">
                    🏢 Total Supplier Bill:
                  </span>
                  <span className="text-[9px] text-muted-foreground">Materials only (No driver/petrol)</span>
                </div>
                <span className="font-black text-sm text-emerald-700 dark:text-emerald-400 font-mono">
                  ₹{editingItems.reduce((s, it) => s + (it.supplierAmount ?? (it.supplierRate ?? it.rate ?? 0) * it.quantity), 0).toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-primary/10 border border-primary/25 flex justify-between items-center">
                <div>
                  <span className="font-bold text-[10px] text-primary uppercase block">
                    👤 Total Client Materials:
                  </span>
                  <span className="text-[9px] text-muted-foreground">+ Driver & Petrol on delivery</span>
                </div>
                <span className="font-black text-sm text-primary font-mono">
                  ₹{editingItems.reduce((s, it) => s + (it.clientAmount ?? (it.clientRate ?? it.rate ?? 0) * it.quantity), 0).toLocaleString()}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl text-white font-bold text-xs shadow-sm"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              Update Rates (Supplier & Client)
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DEPLOY RENTAL MATERIAL MODAL ── */}
      <Dialog open={showDeployRentalModal} onOpenChange={setShowDeployRentalModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-600" />
              Deploy Rental Material to Site
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleDeployRental} className="space-y-4 pt-1 text-xs">
            {/* Quick Material Selection or Entry */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Rental Material / Equipment *</Label>
              {materialSettings.filter(m => m.isRental).length > 0 ? (
                <div className="space-y-2">
                  <Select
                    value={rentalMatId}
                    onValueChange={val => {
                      if (val === 'custom') {
                        setRentalMatId('');
                        setRentalMatName('');
                      } else {
                        handleSelectRentalMaterial(val);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select from Rental Material Catalog" />
                    </SelectTrigger>
                    <SelectContent>
                      {materialSettings.filter(m => m.isRental).map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} {m.rentalRatePerDay ? `(₹${m.rentalRatePerDay}/day)` : ''}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">+ Custom / Enter Name Manually</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Material Name (e.g., Scaffolding Pipes, Concrete Mixer, Shuttering Plates)"
                    value={rentalMatName}
                    onChange={e => setRentalMatName(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>
              ) : (
                <Input
                  placeholder="Material Name (e.g., Scaffolding, Concrete Mixer Machine)"
                  value={rentalMatName}
                  onChange={e => setRentalMatName(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              )}
            </div>

            {/* Destination Site & Start Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Destination Site *</Label>
                <Select value={rentalSiteId} onValueChange={setRentalSiteId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Start Date on Site *</Label>
                <Input
                  type="date"
                  value={rentalStartDate}
                  onChange={e => setRentalStartDate(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
            </div>

            {/* Quantity & Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Quantity Deployed *</Label>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  value={rentalQuantity}
                  onChange={e => setRentalQuantity(e.target.value)}
                  placeholder="e.g. 50"
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Unit</Label>
                <Select value={rentalUnit} onValueChange={setRentalUnit}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUnits.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Daily Rental Rate per Unit */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Rental Rate Per Day (Per Unit / Product)</Label>
                <span className="text-[10px] text-muted-foreground">Can also be adjusted at return time</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">₹</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={rentalRatePerDay}
                  onChange={e => setRentalRatePerDay(e.target.value)}
                  placeholder="e.g. 15 per day per set"
                  className="pl-7 h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Driver Assignment Section */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rentalRequiresDriver}
                    onChange={e => setRentalRequiresDriver(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-600" />
                    Driver & Vehicle Required for Transit
                  </span>
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {rentalRequiresDriver ? 'Driver will be assigned' : 'Not required (Direct on-site)'}
                </span>
              </div>

              {rentalRequiresDriver && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/40">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold flex items-center justify-between">
                      <span>Assign Driver</span>
                      {presentDriversList.length > 0 && (
                        <span className="text-[9px] text-emerald-600 font-bold">({presentDriversList.length} Present)</span>
                      )}
                    </Label>
                    <Select value={rentalDriverId} onValueChange={setRentalDriverId}>
                      <SelectTrigger className="h-8 text-xs">
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
                            const isPresent = presentDriversList.some(p => p.id === d.id);
                            return (
                              <SelectItem key={d.id} value={d.id}>
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <span>🚚 {d.name}</span>
                                  {isPresent && <span className="text-[9px] text-emerald-600 font-bold">✓ Present</span>}
                                </div>
                              </SelectItem>
                            );
                          })}
                          {availableDrivers.length === 0 && (
                            <div className="p-2 text-center text-[10px] text-muted-foreground italic">
                              No unassigned drivers currently free
                            </div>
                          )}
                        </SelectGroup>

                        {/* Secondary: Currently Assigned Drivers */}
                        {assignedDrivers.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="px-2 py-1 text-[10px] font-extrabold uppercase text-amber-700 dark:text-amber-400 bg-amber-500/10 flex items-center justify-between mt-2 mb-1 rounded-md border-t border-amber-500/20">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" /> Currently Assigned (Secondary)
                              </span>
                              <span className="text-[9px] font-bold">({assignedDrivers.length} On Trip)</span>
                            </SelectLabel>
                            {assignedDrivers.map(d => {
                              const isPresent = presentDriversList.some(p => p.id === d.id);
                              const activeTrip = getDriverActiveTrip(d.id);
                              return (
                                <SelectItem key={d.id} value={d.id}>
                                  <div className="flex items-center justify-between gap-2 w-full opacity-85">
                                    <span>🚚 {d.name}</span>
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

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Assign Vehicle</Label>
                    <Select value={rentalVehicleId} onValueChange={setRentalVehicleId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select Vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.name} ({v.number})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Transit Cost (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={rentalTransitCost}
                      onChange={e => setRentalTransitCost(e.target.value)}
                      placeholder="e.g. 500"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notes / Identification / Serial No.</Label>
              <Textarea
                value={rentalNotes}
                onChange={e => setRentalNotes(e.target.value)}
                placeholder="e.g. 50 sets scaffolding pipes, delivered in good condition"
                className="text-xs min-h-[60px]"
              />
            </div>

            {/* Estimated Daily Preview */}
            {(Number(rentalQuantity) > 0 && Number(rentalRatePerDay) > 0) && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                <span className="text-amber-800 dark:text-amber-300 font-semibold">Estimated Daily Cost:</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                  ₹{(Number(rentalQuantity) * Number(rentalRatePerDay)).toLocaleString()} / day
                </span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 rounded-xl text-white font-bold text-xs bg-amber-600 hover:bg-amber-700 shadow-sm"
            >
              Deploy Rental Material
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── RETURN & CLOSE RENTAL CALCULATION MODAL ── */}
      <Dialog
        open={returnModal.open}
        onOpenChange={open => !open && setReturnModal({ open: false, rental: null })}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Close Rental & Settle Calculations
            </DialogTitle>
          </DialogHeader>

          {returnModal.rental && (() => {
            const r = returnModal.rental;
            const startMs = new Date(r.startDate + 'T00:00:00').getTime();
            const endMs = new Date(returnEndDate + 'T00:00:00').getTime();
            const totalDays = Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1);
            const rateNum = Number(returnRatePerDay) || 0;
            const matRent = totalDays * r.quantity * rateNum;
            const transitCost = r.transitCost || 0;
            const totalCost = matRent + transitCost;

            return (
              <form onSubmit={handleConfirmReturn} className="space-y-4 pt-1 text-xs">
                {/* Deployment Overview Card */}
                <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{r.materialName}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                      {r.quantity} {r.unit}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-primary" /> Site: <span className="font-semibold text-foreground">{r.siteName}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Deployed on: <span className="font-mono font-semibold text-foreground">{r.startDate}</span>
                  </div>
                  {r.requiresDriver && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <Truck className="w-3 h-3 text-blue-500" /> Driver: <span className="font-semibold text-foreground">{r.driverName || 'Assigned'}</span>
                      {r.vehicleNumber && ` (${r.vehicleNumber})`}
                      {r.transitCost ? ` • Transit: ₹${r.transitCost.toLocaleString()}` : ''}
                    </div>
                  )}
                </div>

                {/* Return Date & Rental Rate Input */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">End / Return Date *</Label>
                    <Input
                      type="date"
                      value={returnEndDate}
                      onChange={e => setReturnEndDate(e.target.value)}
                      className="h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Rate / Day per {r.unit || 'Product'} (₹)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">₹</span>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={returnRatePerDay}
                        onChange={e => setReturnRatePerDay(e.target.value)}
                        placeholder="Rate per day"
                        className="pl-7 h-9 text-xs font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Return Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Closing Notes / Condition on Return</Label>
                  <Textarea
                    value={returnNotes}
                    onChange={e => setReturnNotes(e.target.value)}
                    placeholder="e.g. All sets returned in good condition, no damage"
                    className="text-xs min-h-[50px]"
                  />
                </div>

                {/* Realtime Calculation Breakdown */}
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                    Final Cost Calculation Breakdown
                  </div>

                  <div className="space-y-1 pt-1 text-xs">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Deployment Duration:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {totalDays} {totalDays === 1 ? 'day' : 'days'} ({r.startDate} to {returnEndDate})
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Material Rental Calculation:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {totalDays} days × {r.quantity} {r.unit} × ₹{rateNum} = ₹{matRent.toLocaleString()}
                      </span>
                    </div>
                    {transitCost > 0 && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Transit / Driver Delivery Cost:</span>
                        <span className="font-mono font-semibold text-foreground">
                          + ₹{transitCost.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-border/50 flex justify-between items-center font-bold text-sm">
                      <span className="text-foreground">Total Rental Cost:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 text-base">
                        ₹{totalCost.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 rounded-xl text-white font-bold text-xs bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                >
                  Confirm Return & Settle Rental
                </Button>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── VENDOR DUES / TO GIVE VENDORS DETAILS MODAL ── */}
      <Dialog open={showVendorDueModal} onOpenChange={setShowVendorDueModal}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader className="pb-3 border-b border-border/50">
            <DialogTitle className="text-base font-heading font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Wallet className="w-5 h-5" />
              Vendor Dues — How Much We Need to Give Vendors
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete breakdown of pending supplier balances and material purchase bills across all sites and orders.
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Top Summary Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Vendor Bills</span>
                <span className="text-lg font-heading font-bold text-foreground">₹{vendorPaymentSummary.totalBilled.toLocaleString()}</span>
                <p className="text-[10px] text-muted-foreground">Across all material orders</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Total Amount Given</span>
                <span className="text-lg font-heading font-bold text-emerald-600">₹{vendorPaymentSummary.totalPaid.toLocaleString()}</span>
                <p className="text-[10px] text-muted-foreground">Paid with recorded receipts</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Total to Give Vendors</span>
                <span className="text-lg font-heading font-black text-amber-600 dark:text-amber-400">₹{vendorPaymentSummary.totalToGiveVendors.toLocaleString()}</span>
                <p className="text-[10px] text-muted-foreground">{vendorPaymentSummary.vendorsWithDueCount} vendor(s) with pending dues</p>
              </div>
            </div>

            {/* List of Vendors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Vendors & Supplier Ledgers ({vendorPaymentSummary.vendorsList.length})
                </h4>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {vendorPaymentSummary.vendorsWithDueCount} Unpaid
                </span>
              </div>

              {vendorPaymentSummary.vendorsList.length === 0 ? (
                <div className="text-center py-8 bg-muted/20 rounded-2xl border border-border/50 text-xs text-muted-foreground">
                  No vendor or supplier orders found yet.
                </div>
              ) : (
                vendorPaymentSummary.vendorsList.map(v => {
                  const hasDue = v.balance > 0;
                  const matchingSupplier = (suppliers || []).find(s => s.name.toLowerCase() === v.name.toLowerCase() || s.id === v.supplierId);

                  return (
                    <Card
                      key={v.name}
                      className={`p-4 rounded-2xl border transition-all ${
                        hasDue
                          ? 'border-amber-500/40 bg-card shadow-xs'
                          : 'border-border/40 bg-muted/20 opacity-80'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border/40">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            hasDue ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600'
                          }`}>
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-bold text-sm text-foreground">{v.name}</h5>
                              {hasDue ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                  ₹{v.balance.toLocaleString()} to give
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/25">
                                  All Settled ✓
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {v.phone ? `Phone: ${v.phone} · ` : ''}{v.ordersCount} total orders ({v.unpaidOrdersCount} pending balance)
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {matchingSupplier && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setShowVendorDueModal(false);
                                setActiveSubTab('suppliers');
                                setSelectedSupplierForLedger(matchingSupplier);
                              }}
                              className="h-8 text-xs font-semibold rounded-xl border-border/70 hover:bg-muted"
                            >
                              Open Ledger
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Financial Strip for this vendor */}
                      <div className="grid grid-cols-3 gap-2 pt-2.5 text-xs text-center">
                        <div className="p-2 rounded-xl bg-muted/40">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Billed</span>
                          <span className="font-bold text-foreground">₹{v.billed.toLocaleString()}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          <span className="text-[10px] uppercase font-bold block">Given</span>
                          <span className="font-bold">₹{v.paid.toLocaleString()}</span>
                        </div>
                        <div className={`p-2 rounded-xl ${
                          hasDue ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-extrabold' : 'bg-muted/40 text-muted-foreground'
                        }`}>
                          <span className="text-[10px] uppercase font-bold block">To Give</span>
                          <span className="font-bold">₹{v.balance.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Orders pending under this vendor */}
                      {hasDue && (
                        <div className="space-y-1.5 pt-2">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                            Orders Awaiting Payment:
                          </span>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {v.orders
                              .filter(r => {
                                const cost = (r.items || []).reduce((s, it) => s + (it.supplierAmount ?? (it.supplierRate ?? it.rate ?? 0) * it.quantity), 0);
                                const bill = r.supplierPrice ?? cost;
                                return Math.max(0, bill - (r.supplierPaidAmount || 0)) > 0;
                              })
                              .map(order => {
                                const cost = (order.items || []).reduce((s, it) => s + (it.supplierAmount ?? (it.supplierRate ?? it.rate ?? 0) * it.quantity), 0);
                                const bill = order.supplierPrice ?? cost;
                                const paid = order.supplierPaidAmount || 0;
                                const bal = Math.max(0, bill - paid);

                                return (
                                  <div
                                    key={order.id}
                                    className="p-2 rounded-xl bg-muted/30 border border-border/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                  >
                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <MapPin className="w-3 h-3 text-primary" />
                                        <span className="font-bold text-foreground">{order.siteName}</span>
                                        <span className="text-[10px] text-muted-foreground font-mono">({order.date})</span>
                                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                          order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
                                        }`}>
                                          {order.status}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground mt-0.5">
                                        {(order.items || []).map(i => `${i.name} (${i.quantity} ${i.unit || 'unit'})`).join(', ')}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                      <div className="text-right">
                                        <span className="text-[10px] text-muted-foreground block">Balance Due:</span>
                                        <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                                          ₹{bal.toLocaleString()}
                                        </span>
                                      </div>
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setShowVendorDueModal(false);
                                          openPayModal(order);
                                        }}
                                        className="h-7 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                      >
                                        <CreditCard className="w-3 h-3" /> Pay
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── STORE ROOM DISPATCH TO SITE MODAL (WITH VEHICLE & DRIVER ASSIGNMENT) ── */}
      <Dialog open={showDispatchModal} onOpenChange={setShowDispatchModal}>
        <DialogContent className="max-w-lg rounded-2xl p-5">
          <DialogHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-heading font-bold text-foreground">
                  Dispatch Material from Store Room
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Assign destination site, transport vehicle, and driver for live tracking.
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleDispatchSubmit} className="space-y-3.5 pt-2">
            {/* Selected Material Info */}
            {dispatchSelectedMaterial ? (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-foreground block">{dispatchSelectedMaterial.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      Location: {dispatchSelectedMaterial.storeRoomLocation || 'Main Warehouse'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Available Stock</span>
                    <span className={`text-sm font-black font-mono ${
                      (dispatchSelectedMaterial.stockQuantity || 0) <= 0
                        ? 'text-destructive'
                        : (dispatchSelectedMaterial.stockQuantity || 0) <= (dispatchSelectedMaterial.minStockAlert || 5)
                        ? 'text-amber-600'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {dispatchSelectedMaterial.stockQuantity || 0} {dispatchSelectedMaterial.unit || 'units'}
                    </span>
                  </div>
                </div>

                {/* Minimum Stock / Out of Stock Alert */}
                {(dispatchSelectedMaterial.stockQuantity || 0) <= 0 ? (
                  <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/25 text-xs text-destructive font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>❌ Out of Stock! 0 available in Store Room warehouse. Cannot dispatch this item.</span>
                  </div>
                ) : (dispatchSelectedMaterial.stockQuantity || 0) <= (dispatchSelectedMaterial.minStockAlert || 5) ? (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>⚠️ Minimum Stock Alert: Current stock ({dispatchSelectedMaterial.stockQuantity} {dispatchSelectedMaterial.unit}) is at or below minimum alert threshold ({dispatchSelectedMaterial.minStockAlert || 5}). Out-of-range quantities cannot be entered.</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Select Store Room Item *</Label>
                <Select
                  value={dispatchSelectedMaterial?.id || ''}
                  onValueChange={id => {
                    const found = storeRoomItems.find(m => m.id === id);
                    if (found) setDispatchSelectedMaterial(found);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Material" />
                  </SelectTrigger>
                  <SelectContent>
                    {storeRoomItems.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.stockQuantity || 0} {m.unit || 'units'} in stock)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Destination Site & Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Destination Site *</Label>
                <Select value={dispatchSiteId} onValueChange={setDispatchSiteId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.filter(s => s.status !== 'completed').map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Quantity ({dispatchSelectedMaterial?.unit || 'Unit'}) *
                </Label>
                <Input
                  type="number"
                  min="1"
                  max={dispatchSelectedMaterial?.stockQuantity || undefined}
                  value={dispatchQuantity}
                  onChange={e => {
                    const maxStock = dispatchSelectedMaterial?.stockQuantity || 0;
                    const numVal = Number(e.target.value);
                    if (maxStock <= 0) {
                      toast.error(`Out of stock! Cannot enter quantity.`);
                      setDispatchQuantity('0');
                      return;
                    }
                    if (numVal > maxStock) {
                      toast.warning(`Out of range! Cannot enter more than available stock (${maxStock} ${dispatchSelectedMaterial?.unit || 'units'}).`);
                      setDispatchQuantity(String(maxStock));
                      return;
                    }
                    setDispatchQuantity(e.target.value);
                  }}
                  disabled={(dispatchSelectedMaterial?.stockQuantity || 0) <= 0}
                  placeholder="1"
                  className={`h-9 text-xs font-bold ${(dispatchSelectedMaterial?.stockQuantity || 0) <= 0 ? 'border-destructive text-destructive' : ''}`}
                />
              </div>
            </div>

            {/* Vehicle & Driver Assignment (Optional) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Assign Fleet Vehicle (Optional)</Label>
                <Select value={dispatchVehicleId} onValueChange={setDispatchVehicleId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="No Vehicle (Optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">🚫 No Vehicle (Optional)</SelectItem>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name} ({v.number})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Assign Driver (Optional)</Label>
                <Select value={dispatchDriverId} onValueChange={setDispatchDriverId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Driver (Optional)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">👤 No Driver Assigned</SelectItem>

                    {/* Primary: Available Drivers */}
                    <SelectGroup>
                      <SelectLabel className="px-2 py-1 text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 flex items-center justify-between my-0.5 rounded-md">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Available Drivers
                        </span>
                        <span className="text-[9px] font-bold">({availableDrivers.length} Free)</span>
                      </SelectLabel>
                      {availableDrivers.map(d => {
                        const isPresent = presentDriversList.some(p => p.id === d.id);
                        return (
                          <SelectItem key={d.id} value={d.id}>
                            <div className="flex items-center justify-between gap-2 w-full">
                              <span>🚚 {d.name} ({d.role || 'Driver'})</span>
                              {isPresent && <span className="text-[9px] text-emerald-600 font-bold">✓ Present</span>}
                            </div>
                          </SelectItem>
                        );
                      })}
                      {availableDrivers.length === 0 && (
                        <div className="p-2 text-center text-[10px] text-muted-foreground italic">
                          No unassigned drivers currently free
                        </div>
                      )}
                    </SelectGroup>

                    {/* Secondary: Currently Assigned Drivers */}
                    {assignedDrivers.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="px-2 py-1 text-[10px] font-extrabold uppercase text-amber-700 dark:text-amber-400 bg-amber-500/10 flex items-center justify-between mt-2 mb-1 rounded-md border-t border-amber-500/20">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" /> Currently Assigned (Secondary)
                          </span>
                          <span className="text-[9px] font-bold">({assignedDrivers.length} On Trip)</span>
                        </SelectLabel>
                        {assignedDrivers.map(d => {
                          const isPresent = presentDriversList.some(p => p.id === d.id);
                          const activeTrip = getDriverActiveTrip(d.id);
                          return (
                            <SelectItem key={d.id} value={d.id}>
                              <div className="flex items-center justify-between gap-2 w-full opacity-85">
                                <span>🚚 {d.name} ({d.role || 'Driver'})</span>
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
            </div>

            {/* Secondary Assigned Warning Banner */}
            {dispatchDriverId && dispatchDriverId !== 'none' && getDriverActiveTrip(dispatchDriverId) && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Driver is currently on an active trip:</strong> Assigned to deliver to {getDriverActiveTrip(dispatchDriverId)?.siteName}. Dispatching will queue or run simultaneously.
                </span>
              </div>
            )}

            {/* Dispatch Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Start Date on Site *</Label>
                <Input
                  type="date"
                  value={dispatchDate}
                  onChange={e => setDispatchDate(e.target.value)}
                  className="h-9 text-xs font-medium"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Departure Time</Label>
                <Input
                  value={dispatchTime}
                  onChange={e => setDispatchTime(e.target.value)}
                  placeholder="10:00 AM"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Dispatch Notes / Gate Pass / Instructions</Label>
              <Textarea
                value={dispatchNotes}
                onChange={e => setDispatchNotes(e.target.value)}
                placeholder="e.g. Dispatched for foundation slab pouring, Gate Pass #104"
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDispatchModal(false)}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={(dispatchSelectedMaterial?.stockQuantity || 0) <= 0 || Number(dispatchQuantity) > (dispatchSelectedMaterial?.stockQuantity || 0)}
                className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Truck className="w-3.5 h-3.5" /> Confirm & Dispatch
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── STORE ROOM STOCK ADJUSTMENT & INWARD RECEIPT MODAL ── */}
      <Dialog
        open={adjustStockModal.open}
        onOpenChange={open => {
          if (!open) setAdjustStockModal({ open: false, material: null });
        }}
      >
        <DialogContent className="max-w-md rounded-2xl p-5">
          <DialogHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-heading font-bold text-foreground">
                  Update Store Room Inventory
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Receive inward stock from suppliers or update physical stock audit counts.
                </p>
              </div>
            </div>
          </DialogHeader>

          {adjustStockModal.material && (
            <form onSubmit={handleSaveAdjustStock} className="space-y-3.5 pt-2">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-foreground block">{adjustStockModal.material.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    Category: {adjustStockModal.material.category || 'General'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Current Stock</span>
                  <span className="text-sm font-black font-mono text-foreground">
                    {adjustStockModal.material.stockQuantity || 0} {adjustStockModal.material.unit || 'units'}
                  </span>
                </div>
              </div>

              {/* Adjustment Mode Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-xl border border-border/50">
                <button
                  type="button"
                  onClick={() => setAdjustMode('add')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    adjustMode === 'add'
                      ? 'bg-card text-foreground shadow-xs font-bold border border-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  + Add Inward Stock
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode('set')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    adjustMode === 'set'
                      ? 'bg-card text-foreground shadow-xs font-bold border border-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  = Set Exact Count
                </button>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  {adjustMode === 'add' ? `Quantity to Add (${adjustStockModal.material.unit || 'Unit'}) *` : `New Exact Stock Count (${adjustStockModal.material.unit || 'Unit'}) *`}
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={adjustQuantity}
                  onChange={e => setAdjustQuantity(e.target.value)}
                  placeholder={adjustMode === 'add' ? 'e.g. 50' : (adjustStockModal.material.stockQuantity || 0).toString()}
                  className="h-9 text-xs font-bold"
                  required
                />
              </div>

              {adjustMode === 'add' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Buying / Inward Price (₹ per {adjustStockModal.material.unit || 'unit'})</Label>
                    {Number(adjustBuyingPrice) > 0 && Number(adjustQuantity) > 0 && (
                      <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                        Inward Expense: ₹{(Number(adjustBuyingPrice) * Number(adjustQuantity)).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <Input
                    type="number"
                    min="0"
                    value={adjustBuyingPrice}
                    onChange={e => setAdjustBuyingPrice(e.target.value)}
                    placeholder={(adjustStockModal.material.buyingPrice || '0').toString()}
                    className="h-9 text-xs font-bold text-rose-600 dark:text-rose-400"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    This unit price will update the item's buying rate and log the inward purchase expense to Store Room expenses.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Low Stock Alert Level</Label>
                  <Input
                    type="number"
                    min="0"
                    value={adjustMinStockAlert}
                    onChange={e => setAdjustMinStockAlert(e.target.value)}
                    placeholder="10"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Storage Location / Rack</Label>
                  <Input
                    value={adjustLocation}
                    onChange={e => setAdjustLocation(e.target.value)}
                    placeholder="Bay A-1"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdjustStockModal({ open: false, material: null })}
                  className="h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-white"
                >
                  Save Stock Update
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── CRUSH / DAMAGED STOCK MODAL ── */}
      <Dialog
        open={crushModal.open}
        onOpenChange={open => {
          if (!open) {
            setCrushModal({ open: false, material: null });
            setCrushQuantity('');
            setCrushNotes('');
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl p-5">
          <DialogHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-heading font-bold text-foreground">
                  Crush / Damaged Stock
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Record broken, damaged, or crushed stock in store room.
                </p>
              </div>
            </div>
          </DialogHeader>

          {crushModal.material && (
            <form onSubmit={e => { e.preventDefault(); handleConfirmCrushStock(); }} className="space-y-3.5 pt-2">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-foreground block">{crushModal.material.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    Rate: ₹{crushModal.material.buyingPrice || 0}/{crushModal.material.unit || 'units'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Available On-Hand</span>
                  <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {crushModal.material.stockQuantity || 0} {crushModal.material.unit || 'units'}
                  </span>
                </div>
              </div>

              {/* Quantity to crush */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Quantity to Crush ({crushModal.material.unit || 'units'}) *</Label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCrushQuantity(String(crushModal.material?.stockQuantity || 1))}
                      className="text-[10px] font-bold text-amber-600 hover:underline"
                    >
                      All ({crushModal.material.stockQuantity || 0})
                    </button>
                    {Number(crushModal.material?.stockQuantity || 0) > 1 && (
                      <>
                        <span className="text-muted-foreground text-[10px]">•</span>
                        <button
                          type="button"
                          onClick={() => setCrushQuantity(String(Math.floor((crushModal.material?.stockQuantity || 0) / 2) || 1))}
                          className="text-[10px] font-bold text-amber-600 hover:underline"
                        >
                          Half
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <Input
                  type="number"
                  min="1"
                  max={crushModal.material.stockQuantity || undefined}
                  value={crushQuantity}
                  onChange={e => setCrushQuantity(e.target.value)}
                  placeholder="Enter quantity to crush"
                  className="h-9 text-xs font-bold"
                  required
                />
              </div>

              {/* Reason select */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Damage / Crush Reason *</Label>
                <Select value={crushReason} onValueChange={setCrushReason}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="💥 Crushed / Broken in warehouse">💥 Crushed / Broken in warehouse</SelectItem>
                    <SelectItem value="🌧️ Moisture / Weather damaged">🌧️ Moisture / Weather damaged</SelectItem>
                    <SelectItem value="⏳ Expired / Quality deteriorated">⏳ Expired / Quality deteriorated</SelectItem>
                    <SelectItem value="🚜 Handling / Transport accident">🚜 Handling / Transport accident</SelectItem>
                    <SelectItem value="⚠️ Site Return Damaged / Unusable">⚠️ Site Return Damaged / Unusable</SelectItem>
                    <SelectItem value="Other (See notes)">Other (See notes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Notes / Explanation (Optional)</Label>
                <Textarea
                  value={crushNotes}
                  onChange={e => setCrushNotes(e.target.value)}
                  placeholder="e.g. Broken during forklift movement in bay 3"
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              {/* Loss calculation & Expense preservation info */}
              {(() => {
                const q = Number(crushQuantity) || 0;
                const p = Number(crushModal.material.buyingPrice) || 0;
                const loss = q * p;
                return (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-amber-700 dark:text-amber-300">Financial Loss Amount:</span>
                      <span className="text-rose-600 dark:text-rose-400 font-black text-sm">₹{loss.toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      ⚠️ <strong>Expense Rule:</strong> Physical stock will be deducted by {q} {crushModal.material.unit}. However, this ₹{loss.toLocaleString()} <strong>CANNOT be minused</strong> from Stock Expenses. It will be recorded in Crushed Stock History as an incurred business loss.
                    </p>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCrushModal({ open: false, material: null })}
                  className="h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!crushQuantity || Number(crushQuantity) <= 0 || Number(crushQuantity) > (crushModal.material.stockQuantity || 0)}
                  className="h-9 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Confirm Crush Stock
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── DELETE STOCK CONFIRMATION MODAL ── */}
      <Dialog
        open={deleteStockModal.open}
        onOpenChange={open => {
          if (!open) setDeleteStockModal({ open: false, material: null });
        }}
      >
        <DialogContent className="max-w-md rounded-2xl p-5">
          <DialogHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-heading font-bold text-foreground">
                  Delete Stock from Store Room
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Remove item completely and minus its cost from Stock Expenses.
                </p>
              </div>
            </div>
          </DialogHeader>

          {deleteStockModal.material && (
            <div className="space-y-3.5 pt-2">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                <span className="text-sm font-bold text-foreground block">{deleteStockModal.material.name}</span>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Available: <strong>{deleteStockModal.material.stockQuantity || 0} {deleteStockModal.material.unit || 'units'}</strong></span>
                  <span>Buying Rate: <strong>₹{deleteStockModal.material.buyingPrice || 0}/{deleteStockModal.material.unit || 'units'}</strong></span>
                </div>
              </div>

              {(() => {
                const q = Number(deleteStockModal.material.stockQuantity) || 0;
                const p = Number(deleteStockModal.material.buyingPrice) || 0;
                const cost = q * p;
                return (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/25 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-destructive">
                      <span>Amount to Minus from Expenses:</span>
                      <span className="font-heading font-black text-sm">-₹{cost.toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      🗑️ <strong>Delete Rule:</strong> Deleting this stock will remove it from warehouse inventory. Since this stock is deleted, ₹{cost.toLocaleString()} will be <strong>MINUSED (deducted)</strong> from Stock Expenses.
                    </p>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteStockModal({ open: false, material: null })}
                  className="h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteStockModal.material && handleDeleteStoreStock(deleteStockModal.material)}
                  className="h-9 text-xs font-bold gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Confirm Delete & Minus Expense
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── STORE ROOM RETURN & BILL SITE MODAL ── */}
      <Dialog
        open={returnStoreRoomModal.open}
        onOpenChange={open => {
          if (!open) setReturnStoreRoomModal({ open: false, dispatchRecord: null, requestRecord: null });
        }}
      >
        <DialogContent className="max-w-lg rounded-3xl p-6 max-h-[92vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                <Warehouse className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-heading font-bold text-foreground">
                  Store Room Item: Return or Site Transfer
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Calculate daily usage fee, bill site & credit profit, then return to warehouse or transfer to another site.
                </p>
              </div>
            </div>
          </DialogHeader>

          {(() => {
            const disp = returnStoreRoomModal.dispatchRecord;
            const req = returnStoreRoomModal.requestRecord;
            const matName = disp?.materialName || req?.items?.[0]?.name || 'Store Room Item';
            const qty = disp?.quantity || req?.items?.[0]?.quantity || 1;
            const unit = disp?.unit || req?.items?.[0]?.unit || 'Units';
            const currentSiteId = disp?.siteId || req?.siteId || '';
            const siteName = disp?.siteName || req?.siteName || 'Current Site';
            const startDate = disp?.startDate || disp?.date || req?.startDate || req?.date || 'Today';
            const otherSites = (sites || []).filter(s => s.id !== currentSiteId);
            const targetTransferSiteObj = otherSites.find(s => s.id === returnTransferSiteId);

            return (
              <form onSubmit={handleReturnStoreRoomItem} className="space-y-4 pt-1">
                {/* 1. Deployment Overview Banner */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-emerald-600" /> {matName}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-200">
                      {qty} {unit}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-emerald-500/20 text-muted-foreground">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Current Site:</span>
                      <strong className="text-foreground">{siteName}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Delivery Date:</span>
                      <strong className="text-foreground font-mono">{modalDeliveryDate}</strong>
                    </div>
                  </div>
                </div>

                {/* 2. RETURN DESTINATION OPTIONS: Return All, Transfer All, or Split */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-primary" /> Return Method (Store Room Asset Allocation) *
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground lowercase">
                      Total: {qty} {unit}
                    </span>
                  </Label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Method 1: Return All to Store Room */}
                    <div
                      onClick={() => {
                        setReturnDestinationType('store_room');
                        setReturnTransferCount('0');
                        setReturnStoreRoomCount(String(qty));
                      }}
                      className={`p-2.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                        returnDestinationType === 'store_room'
                          ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                          : 'border-border/60 bg-muted/20 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          returnDestinationType === 'store_room' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-muted-foreground'
                        }`}>
                          {returnDestinationType === 'store_room' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          🏬 All to Store Room
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 pl-5">
                        Return all {qty} {unit} back to warehouse.
                      </p>
                    </div>

                    {/* Method 2: Transfer All to Another Site */}
                    <div
                      onClick={() => {
                        setReturnDestinationType('other_site');
                        setReturnTransferCount(String(qty));
                        setReturnStoreRoomCount('0');
                        if (!returnTransferSiteId && otherSites.length > 0) {
                          setReturnTransferSiteId(otherSites[0].id);
                        }
                      }}
                      className={`p-2.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                        returnDestinationType === 'other_site'
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                          : 'border-border/60 bg-muted/20 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          returnDestinationType === 'other_site' ? 'border-primary bg-primary text-white' : 'border-muted-foreground'
                        }`}>
                          {returnDestinationType === 'other_site' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          🔄 All to Other Site
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 pl-5">
                        Transfer all {qty} {unit} to new site.
                      </p>
                    </div>

                    {/* Method 3: Split Quantity */}
                    <div
                      onClick={() => {
                        setReturnDestinationType('split');
                        const defaultTransfer = Math.floor(qty / 2) || 1;
                        setReturnTransferCount(String(defaultTransfer));
                        setReturnStoreRoomCount(String(Math.max(0, qty - defaultTransfer)));
                        if (!returnTransferSiteId && otherSites.length > 0) {
                          setReturnTransferSiteId(otherSites[0].id);
                        }
                      }}
                      className={`p-2.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                        returnDestinationType === 'split'
                          ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20'
                          : 'border-border/60 bg-muted/20 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          returnDestinationType === 'split' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-muted-foreground'
                        }`}>
                          {returnDestinationType === 'split' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          🔀 Split Count
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 pl-5">
                        Send some to site, rest to warehouse.
                      </p>
                    </div>
                  </div>

                  {/* If Method 1: Return All to Store Room */}
                  {returnDestinationType === 'store_room' && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={storeRoomRestock}
                          onChange={e => setStoreRoomRestock(e.target.checked)}
                          className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-foreground">
                          Restock entire {qty} {unit} back into Store Room inventory
                        </span>
                      </label>
                    </div>
                  )}

                  {/* If Method 2: Transfer All to Another Site */}
                  {returnDestinationType === 'other_site' && (
                    <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 space-y-2 animate-in fade-in-50">
                      <Label className="text-xs font-semibold text-primary flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" /> Select Destination Project Site for all {qty} {unit} *
                      </Label>
                      {otherSites.length === 0 ? (
                        <p className="text-xs text-destructive">No other project sites available to transfer to.</p>
                      ) : (
                        <Select value={returnTransferSiteId} onValueChange={setReturnTransferSiteId}>
                          <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
                            <SelectValue placeholder="Choose destination site" />
                          </SelectTrigger>
                          <SelectContent>
                            {otherSites.map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                📍 {s.name} ({s.location || 'Site'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        All {qty} {unit} will be transferred to {targetTransferSiteObj ? targetTransferSiteObj.name : 'Target site'} with today as its new Delivery Date.
                      </p>
                    </div>
                  )}

                  {/* If Method 3: Split Count */}
                  {returnDestinationType === 'split' && (
                    <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/25 space-y-3 animate-in fade-in-50">
                      <div className="flex items-center justify-between border-b border-indigo-500/15 pb-2">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" /> Split Allocation (Total Available: {qty} {unit})
                        </span>
                        <span className="text-[11px] font-mono font-bold text-muted-foreground">
                          {returnTransferCount || 0} to Site + {returnStoreRoomCount || 0} to Warehouse = {qty}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Part 1: How much to other site */}
                        <div className="space-y-1.5 p-2.5 rounded-xl bg-card border border-border/60">
                          <Label className="text-[11px] font-bold text-primary flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> Count to Other Site ({unit}) *
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            max={qty}
                            value={returnTransferCount}
                            onChange={e => {
                              const val = Math.min(qty, Math.max(0, Number(e.target.value) || 0));
                              setReturnTransferCount(String(val));
                              setReturnStoreRoomCount(String(Math.max(0, qty - val)));
                            }}
                            className="h-9 text-xs font-bold font-mono"
                            placeholder={`1 to ${qty}`}
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Units transferring to another site
                          </p>
                        </div>

                        {/* Part 2: Remaining to Store Room */}
                        <div className="space-y-1.5 p-2.5 rounded-xl bg-card border border-border/60">
                          <Label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <Warehouse className="w-3 h-3" /> Remaining to Store Room ({unit})
                          </Label>
                          <div className="h-9 px-3 rounded-lg border border-border/50 bg-muted/40 flex items-center justify-between font-mono font-extrabold text-xs text-foreground">
                            <span>{returnStoreRoomCount} {unit}</span>
                            <span className="text-[10px] text-emerald-600 font-sans font-bold">Auto-calculated</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Remaining units returning to warehouse
                          </p>
                        </div>
                      </div>

                      {/* Select target site */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-primary" /> Destination Project Site for {returnTransferCount} {unit} *
                        </Label>
                        {otherSites.length === 0 ? (
                          <p className="text-xs text-destructive">No other project sites available to transfer to.</p>
                        ) : (
                          <Select value={returnTransferSiteId} onValueChange={setReturnTransferSiteId}>
                            <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
                              <SelectValue placeholder="Choose destination site" />
                            </SelectTrigger>
                            <SelectContent>
                              {otherSites.map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                  📍 {s.name} ({s.location || 'Site'})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Restock remaining checkbox */}
                      <div className="pt-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={storeRoomRestock}
                            onChange={e => setStoreRoomRestock(e.target.checked)}
                            className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                          />
                          <span className="text-xs font-semibold text-foreground">
                            Restock {returnStoreRoomCount} {unit} back into Store Room inventory
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2b. FLEET VEHICLE & DRIVER LOGISTICS ASSIGNMENT */}
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-primary" /> Assign Driver & Fleet Vehicle
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {returnDestinationType === 'store_room'
                        ? 'Warehouse Pickup'
                        : returnDestinationType === 'other_site'
                        ? 'Direct Site Transfer'
                        : 'Split Logistics'}
                    </span>
                  </div>

                  {returnDestinationType !== 'split' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                          <Truck className="w-3 h-3 text-muted-foreground" />
                          {returnDestinationType === 'store_room' ? 'Warehouse Return Vehicle' : 'Site Transfer Vehicle'}
                        </Label>
                        <Select value={returnVehicleId} onValueChange={setReturnVehicleId}>
                          <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                            <SelectValue placeholder="No Vehicle (Optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">🚫 No Vehicle (Direct / Hand Carry)</SelectItem>
                            {vehicles.map(v => (
                              <SelectItem key={v.id} value={v.id}>
                                🚛 {v.name} ({v.number}) - {v.type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                          👤 {returnDestinationType === 'store_room' ? 'Warehouse Return Driver' : 'Site Transfer Driver'}
                        </Label>
                        <Select value={returnDriverId} onValueChange={setReturnDriverId}>
                          <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                            <SelectValue placeholder="Select Driver (Optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">👤 No Driver Assigned</SelectItem>
                            {(driversList.length > 0 ? driversList : staffList).map(d => (
                              <SelectItem key={d.id} value={d.id}>
                                🪪 {d.name} ({d.role || 'Staff'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Split: Option for Same Driver or Separate Drivers */}
                      <div className="flex items-center justify-between pb-0.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground">
                          <input
                            type="checkbox"
                            checked={sameDriverVehicleForSplit}
                            onChange={e => setSameDriverVehicleForSplit(e.target.checked)}
                            className="w-4 h-4 rounded accent-primary cursor-pointer"
                          />
                          <span>Same driver & vehicle for both site transfer and warehouse return</span>
                        </label>
                      </div>

                      {sameDriverVehicleForSplit ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                              <Truck className="w-3 h-3 text-muted-foreground" /> Fleet Vehicle (Both Trips)
                            </Label>
                            <Select value={returnVehicleId} onValueChange={setReturnVehicleId}>
                              <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                                <SelectValue placeholder="No Vehicle (Optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">🚫 No Vehicle</SelectItem>
                                {vehicles.map(v => (
                                  <SelectItem key={v.id} value={v.id}>
                                    🚛 {v.name} ({v.number}) - {v.type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                              👤 Assigned Driver (Both Trips)
                            </Label>
                            <Select value={returnDriverId} onValueChange={setReturnDriverId}>
                              <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                                <SelectValue placeholder="Select Driver (Optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">👤 No Driver Assigned</SelectItem>
                                {(driversList.length > 0 ? driversList : staffList).map(d => (
                                  <SelectItem key={d.id} value={d.id}>
                                    🪪 {d.name} ({d.role || 'Staff'})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Part 1: For Site Transfer */}
                          <div className="p-2.5 rounded-xl bg-card border border-primary/20 space-y-2">
                            <div className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                              <Building2 className="w-3 h-3" /> Transfer to {targetTransferSiteObj?.name || 'Target Site'} ({returnTransferCount} {unit})
                            </div>
                            <div className="space-y-1.5">
                              <Select value={returnVehicleId} onValueChange={setReturnVehicleId}>
                                <SelectTrigger className="h-9 rounded-lg text-xs font-medium">
                                  <SelectValue placeholder="Vehicle for Transfer" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">🚫 No Vehicle</SelectItem>
                                  {vehicles.map(v => (
                                    <SelectItem key={v.id} value={v.id}>
                                      🚛 {v.name} ({v.number})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select value={returnDriverId} onValueChange={setReturnDriverId}>
                                <SelectTrigger className="h-9 rounded-lg text-xs font-medium">
                                  <SelectValue placeholder="Driver for Transfer" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">👤 No Driver Assigned</SelectItem>
                                  {(driversList.length > 0 ? driversList : staffList).map(d => (
                                    <SelectItem key={d.id} value={d.id}>
                                      🪪 {d.name} ({d.role || 'Staff'})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Part 2: For Store Room Return */}
                          <div className="p-2.5 rounded-xl bg-card border border-emerald-500/20 space-y-2">
                            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                              <Warehouse className="w-3 h-3" /> Return to Warehouse ({returnStoreRoomCount} {unit})
                            </div>
                            <div className="space-y-1.5">
                              <Select value={splitReturnVehicleId} onValueChange={setSplitReturnVehicleId}>
                                <SelectTrigger className="h-9 rounded-lg text-xs font-medium">
                                  <SelectValue placeholder="Vehicle for Return" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">🚫 No Vehicle</SelectItem>
                                  {vehicles.map(v => (
                                    <SelectItem key={v.id} value={v.id}>
                                      🚛 {v.name} ({v.number})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select value={splitReturnDriverId} onValueChange={setSplitReturnDriverId}>
                                <SelectTrigger className="h-9 rounded-lg text-xs font-medium">
                                  <SelectValue placeholder="Driver for Return" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">👤 No Driver Assigned</SelectItem>
                                  {(driversList.length > 0 ? driversList : staffList).map(d => (
                                    <SelectItem key={d.id} value={d.id}>
                                      🪪 {d.name} ({d.role || 'Staff'})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Dates & Total Days Calculation: Delivery Date to Return Date */}
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Delivery Date ➔ Return Duration
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/20">
                      📅 {modalTotalDays} {modalTotalDays === 1 ? 'Day' : 'Days'} Duration
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                        Delivery Date *
                      </Label>
                      <Input
                        type="date"
                        value={storeRoomDeliveryDate}
                        onChange={e => {
                          const val = e.target.value;
                          setStoreRoomDeliveryDate(val);
                          if (returnRateMode === 'daily') {
                            const r = Number(storeRoomPerDayRate) || 0;
                            if (r > 0) {
                              try {
                                const s = new Date(val);
                                const ret = new Date(storeRoomReturnDate);
                                const d = Math.max(1, Math.ceil((ret.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                                setStoreRoomBilledAmount(String(r * d * qty));
                              } catch {}
                            }
                          }
                        }}
                        className="h-10 rounded-xl text-xs font-medium mt-1"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                          {returnDestinationType === 'other_site' ? 'Transfer Date *' : 'Return Date *'}
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            const today = format(new Date(), 'yyyy-MM-dd');
                            setStoreRoomReturnDate(today);
                            if (returnRateMode === 'daily') {
                              const r = Number(storeRoomPerDayRate) || 0;
                              if (r > 0) {
                                try {
                                  const s = new Date(storeRoomDeliveryDate);
                                  const newR = new Date(today);
                                  const d = Math.max(1, Math.ceil((newR.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                                  setStoreRoomBilledAmount(String(r * d * qty));
                                } catch {}
                              }
                            }
                          }}
                          className="text-[10px] font-bold text-emerald-600 hover:underline"
                        >
                          Today
                        </button>
                      </div>
                      <Input
                        type="date"
                        value={storeRoomReturnDate}
                        onChange={e => {
                          const val = e.target.value;
                          setStoreRoomReturnDate(val);
                          if (returnRateMode === 'daily') {
                            const r = Number(storeRoomPerDayRate) || 0;
                            if (r > 0) {
                              try {
                                const s = new Date(storeRoomDeliveryDate);
                                const newR = new Date(val);
                                const d = Math.max(1, Math.ceil((newR.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                                setStoreRoomBilledAmount(String(r * d * qty));
                              } catch {}
                            }
                          }
                        }}
                        className="h-10 rounded-xl text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Product Value & Billing Mode Calculation */}
                <div className="p-3.5 rounded-2xl bg-card border border-primary/20 space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5" /> Product Value & Billing Mode
                    </span>

                    {/* Mode selector: Daily Rate vs Unit Value */}
                    <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setReturnRateMode('daily');
                          const r = Number(storeRoomPerDayRate) || 0;
                          if (r > 0) setStoreRoomBilledAmount(String(r * modalTotalDays * qty));
                        }}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          returnRateMode === 'daily'
                            ? 'bg-card text-foreground shadow-xs border border-border/60'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        ⏱️ Daily Rate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReturnRateMode('unit');
                          const u = Number(storeRoomUnitRate) || 0;
                          if (u > 0) setStoreRoomBilledAmount(String(u * qty));
                        }}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          returnRateMode === 'unit'
                            ? 'bg-card text-foreground shadow-xs border border-border/60'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        🏷️ Product Unit Value
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {returnRateMode === 'daily' ? (
                      <div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-muted-foreground">Rate Per Day (₹/day per {unit})</Label>
                          {(Number(storeRoomPerDayRate) || 0) > 0 && (
                            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {modalTotalDays}d × ₹{storeRoomPerDayRate} × {qty} {unit}
                            </span>
                          )}
                        </div>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">₹</span>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="e.g. 100"
                            value={storeRoomPerDayRate}
                            onChange={e => {
                              const val = e.target.value;
                              setStoreRoomPerDayRate(val);
                              const r = Number(val) || 0;
                              if (r >= 0) {
                                setStoreRoomBilledAmount(String(r * modalTotalDays * qty));
                              }
                            }}
                            className="pl-7 h-10 rounded-xl text-xs font-semibold"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-muted-foreground">Product Value Rate (₹ per {unit})</Label>
                          {(Number(storeRoomUnitRate) || 0) > 0 && (
                            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {qty} {unit} × ₹{storeRoomUnitRate}
                            </span>
                          )}
                        </div>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">₹</span>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="e.g. 500"
                            value={storeRoomUnitRate}
                            onChange={e => {
                              const val = e.target.value;
                              setStoreRoomUnitRate(val);
                              const u = Number(val) || 0;
                              if (u >= 0) {
                                setStoreRoomBilledAmount(String(u * qty));
                              }
                            }}
                            className="pl-7 h-10 rounded-xl text-xs font-semibold"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <Label className="text-xs font-bold text-foreground">
                        Total Amount to Bill (₹) *
                      </Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary text-xs font-bold font-mono">₹</span>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="e.g. 3500"
                          value={storeRoomBilledAmount}
                          onChange={e => setStoreRoomBilledAmount(e.target.value)}
                          className="pl-7 h-10 rounded-xl text-xs font-bold font-mono border-primary/40 text-primary"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      This <strong>₹{Number(storeRoomBilledAmount || 0).toLocaleString()}</strong> will be added to <strong>{siteName}</strong> site expenses and credited to <strong>Store Room Stock Revenue / Company Profit</strong>.
                    </div>
                  </div>
                </div>

                {/* 5. Return / Transfer Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Notes / Condition</Label>
                  <Textarea
                    placeholder="e.g. Returned in good working condition, verified by supervisor..."
                    value={storeRoomReturnNotes}
                    onChange={e => setStoreRoomReturnNotes(e.target.value)}
                    rows={2}
                    className="text-xs resize-none rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setReturnStoreRoomModal({ open: false, dispatchRecord: null, requestRecord: null })}
                    className="h-10 text-xs rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    onClick={(e) => {
                      e.preventDefault();
                      handleReturnStoreRoomItem(e);
                    }}
                    size="sm"
                    className="h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 rounded-xl shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />{' '}
                    {returnDestinationType === 'split'
                      ? `Confirm Split (${returnTransferCount} to ${targetTransferSiteObj ? targetTransferSiteObj.name : 'Site'} / ${returnStoreRoomCount} to Warehouse) & Bill ₹${Number(storeRoomBilledAmount || 0).toLocaleString()}`
                      : returnDestinationType === 'other_site'
                      ? `Confirm Transfer to ${targetTransferSiteObj ? targetTransferSiteObj.name : 'New Site'} & Bill ₹${Number(storeRoomBilledAmount || 0).toLocaleString()}`
                      : `Confirm Return to Store Room & Bill ₹${Number(storeRoomBilledAmount || 0).toLocaleString()}`}
                  </Button>
                </div>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>

            {/* Active Product Detailed Site Report Modal */}
      <Dialog
        open={Boolean(currentActiveProductReport)}
        onOpenChange={open => {
          if (!open) setSelectedActiveProductReport(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-border/80 shadow-2xl">
          {currentActiveProductReport && (
            <div className="p-6 space-y-5">
              {/* Report Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-border/60">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-600 border border-blue-500/25">
                      Store Room & Warehouse Inventory Report
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Category: <strong className="text-foreground">{currentActiveProductReport.category}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-heading font-black text-foreground flex items-center gap-2">
                      <Package className="w-5 h-5 text-blue-600" /> {getBaseMaterialName(currentActiveProductReport.materialName)}
                    </h3>
                    {(() => {
                      const batchInfo = getStorageStarBadge(currentActiveProductReport.materialName, materialSettings, storeRoomDispatches);
                      return (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${
                            batchInfo.colorVariant === 'initial'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                              : batchInfo.colorVariant === 'restock_early'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'
                              : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25'
                          }`}
                          title={batchInfo.badgeTooltip}
                        >
                          <span>{batchInfo.isInitialBatch ? '✨' : '📦'}</span>
                          <span>{batchInfo.badgeLabel}</span>
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                    <span>Unit: <strong className="text-foreground">{currentActiveProductReport.unit}</strong></span>
                    <span>•</span>
                    <span>Location: <strong className="text-foreground">{currentActiveProductReport.storeRoomLocation || 'Main Store Room'}</strong></span>
                    <span>•</span>
                    <span>Generated: <strong className="text-foreground">{format(new Date(), 'dd MMM yyyy, hh:mm a')}</strong></span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="h-8 text-xs font-semibold rounded-xl gap-1.5 border-border/60 shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Report
                  </Button>
                </div>
              </div>

              {/* KPI Summary Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                  <div className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                    Total Active on Sites
                  </div>
                  <div className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
                    {currentActiveProductReport.totalActiveQuantity} <span className="text-xs font-normal">{currentActiveProductReport.unit}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/60 border border-border/50 text-center">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Available in Store Room
                  </div>
                  <div className="text-2xl font-black text-foreground mt-1">
                    {currentActiveProductReport.warehouseStock} <span className="text-xs font-normal">{currentActiveProductReport.unit}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                  <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                    Sites Holding Product
                  </div>
                  <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
                    {currentActiveProductReport.uniqueSitesCount} <span className="text-xs font-normal">{currentActiveProductReport.uniqueSitesCount === 1 ? 'Site' : 'Sites'}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                    Longest on Site
                  </div>
                  <div className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
                    {currentActiveProductReport.maxDaysDeployed} <span className="text-xs font-normal">days</span>
                  </div>
                </div>
              </div>

              {/* Site-by-site Deployment Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> Active Deployments Across Sites ({currentActiveProductReport.dispatches.length})
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    Actionable return & billing per site
                  </span>
                </div>

                <div className="space-y-2.5">
                  {currentActiveProductReport.dispatches.map(record => {
                    const delivDateStr = record.deliveryDate || record.startDate || record.date;
                    let daysDeployed = 1;
                    try {
                      const s = new Date(delivDateStr);
                      const now = new Date();
                      daysDeployed = Math.max(1, Math.ceil((now.getTime() - s.getTime()) / (1000 * 3600 * 24)));
                    } catch {
                      daysDeployed = 1;
                    }

                    return (
                      <Card
                        key={record.id}
                        className="p-3.5 rounded-xl bg-card border border-border/70 hover:border-blue-500/40 shadow-2xs space-y-2.5 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-primary" /> {record.siteName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                              {record.quantity} {record.unit}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              daysDeployed >= 14
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'
                                : 'bg-blue-500/15 text-blue-600 border border-blue-500/25'
                            }`}>
                              {daysDeployed} {daysDeployed === 1 ? 'day' : 'days'} active on site
                            </span>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedActiveProductReport(null);
                                openReturnStoreRoomItemModal(record);
                              }}
                              className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 rounded-xl shadow-xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Return & Bill Site
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/40">
                          <div>
                            <span className="text-muted-foreground">Delivery Date:</span>{' '}
                            <strong className="text-foreground">{delivDateStr}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Vehicle:</span>{' '}
                            <strong className="text-foreground">{record.vehicleNumber && record.vehicleNumber !== 'No Vehicle Assigned' ? record.vehicleNumber : 'No Vehicle Assigned'}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Driver:</span>{' '}
                            <strong className="text-foreground">{record.driverName || 'N/A'}</strong>
                          </div>
                          {record.dispatchedBy && (
                            <div>
                              <span className="text-muted-foreground">Dispatched By:</span>{' '}
                              <strong className="text-foreground">{record.dispatchedBy}</strong>
                            </div>
                          )}
                          {record.dispatchDate && (
                            <div>
                              <span className="text-muted-foreground">Dispatch Time:</span>{' '}
                              <strong className="text-foreground">{record.dispatchDate} {record.dispatchTime || ''}</strong>
                            </div>
                          )}
                          {record.workLevelStage && (
                            <div>
                              <span className="text-muted-foreground">Work Stage:</span>{' '}
                              <strong className="text-foreground">{record.workLevelStage}</strong>
                            </div>
                          )}
                        </div>

                        {record.notes && (
                          <p className="text-[11px] text-muted-foreground italic bg-muted/20 px-2 py-1 rounded">
                            Notes: {record.notes}
                          </p>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs">
                <span className="text-[11px] text-muted-foreground">
                  JGS Colour World • Store Room Inventory System
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedActiveProductReport(null)}
                  className="h-8 text-xs rounded-xl"
                >
                  Close Report
                </Button>
              </div>
            </div>
          )}
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

      <AdminMaterialRequestModal
        open={showAdminCreateReqModal}
        onOpenChange={setShowAdminCreateReqModal}
      />
    </div>
  );
};

export default MaterialsSuppliersTab;
