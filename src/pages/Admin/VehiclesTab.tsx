import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  Truck, Fuel, Wrench, Calendar, MapPin, Search, Plus,
  CheckCircle2, AlertTriangle, Clock, ArrowRight, Gauge,
  Shield, FileText, Trash2, Edit, X, AlertCircle, User,
  IndianRupee, ChevronRight, Activity, TrendingUp
} from 'lucide-react';
import { Vehicle, VehicleMaintenanceRecord, VEHICLE_TYPES } from '@/types';
import { toast } from 'sonner';

export const VehiclesTab = () => {
  const {
    vehicles, addVehicle, updateVehicle, deleteVehicle,
    vehicleMaintenance, addVehicleMaintenance, updateVehicleMaintenance, deleteVehicleMaintenance,
    materialRequests, staffList, sites, suppliers
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'fleet' | 'trips' | 'maintenance' | 'petrol'>('fleet');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState('all');
  const [selectedDriverFilter, setSelectedDriverFilter] = useState('all');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('all');
  const [tripDateFilter, setTripDateFilter] = useState<string>('');

  // Modals & Forms
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vName, setVName] = useState('');
  const [vNumber, setVNumber] = useState('');
  const [vType, setVType] = useState('Pickup');
  const [vStatus, setVStatus] = useState<'Active' | 'Under Maintenance' | 'Idle' | 'Out of Service'>('Active');
  const [vFuelType, setVFuelType] = useState('Diesel');
  const [vDriverId, setVDriverId] = useState('');
  const [vOdometer, setVOdometer] = useState('');
  const [vInsuranceExpiry, setVInsuranceExpiry] = useState('');
  const [vFitnessExpiry, setVFitnessExpiry] = useState('');
  const [vNotes, setVNotes] = useState('');

  // Maintenance Form
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [editingMaintId, setEditingMaintId] = useState<string | null>(null);
  const [mVehId, setMVehId] = useState('');
  const [mDate, setMDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mType, setMType] = useState('Regular Service');
  const [mCost, setMCost] = useState('');
  const [mOdometer, setMOdometer] = useState('');
  const [mWorkshop, setMWorkshop] = useState('');
  const [mBillNo, setMBillNo] = useState('');
  const [mNextDue, setMNextDue] = useState('');
  const [mNotes, setMNotes] = useState('');

  // Drivers list (all staff with role 'driver' or assigned to trips)
  const driversList = useMemo(() => {
    return staffList.filter(s => s.role === 'driver' || s.role === 'supervisor');
  }, [staffList]);

  // All completed / assigned delivery trips from materialRequests
  const allTrips = useMemo(() => {
    return (materialRequests || [])
      .filter(r => r.vehicle || r.vehicleNumber || r.driverId || r.driverName)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [materialRequests]);

  // Filtered trips for report
  const filteredTrips = useMemo(() => {
    return allTrips.filter(t => {
      if (selectedVehicleFilter !== 'all') {
        const matchesVeh = t.vehicle === selectedVehicleFilter ||
          t.vehicleNumber === selectedVehicleFilter ||
          vehicles.find(v => v.id === selectedVehicleFilter && (v.name === t.vehicle || v.number === t.vehicleNumber));
        if (!matchesVeh) return false;
      }
      if (selectedDriverFilter !== 'all') {
        const matchesDrv = t.driverId === selectedDriverFilter || t.driverName?.toLowerCase() === selectedDriverFilter.toLowerCase();
        if (!matchesDrv) return false;
      }
      if (selectedSiteFilter !== 'all' && t.siteId !== selectedSiteFilter) return false;
      if (tripDateFilter && t.date !== tripDateFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const str = `${t.vehicle || ''} ${t.vehicleNumber || ''} ${t.driverName || ''} ${t.siteName || ''} ${t.supplierName || ''} ${t.notes || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [allTrips, selectedVehicleFilter, selectedDriverFilter, selectedSiteFilter, tripDateFilter, searchQuery, vehicles]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalVeh = (vehicles || []).length;
    const activeVeh = (vehicles || []).filter(v => (v.status || 'Active') === 'Active').length;
    const underMaintVeh = (vehicles || []).filter(v => v.status === 'Under Maintenance').length;

    const totalTripsCount = allTrips.length;
    const completedTripsCount = allTrips.filter(t => t.status === 'completed').length;
    const totalPetrolSpent = allTrips.reduce((s, t) => s + (Number(t.petrolCharge) || 0), 0);
    const totalDriverWages = allTrips.reduce((s, t) => s + (Number(t.driverWage) || 0), 0);

    const totalMaintCost = (vehicleMaintenance || []).reduce((s, m) => s + (Number(m.cost) || 0), 0);

    // Count expiring documents / due service (< 30 days)
    const today = new Date();
    const alerts: { vehicle: string; type: string; date: string; daysLeft: number }[] = [];
    (vehicles || []).forEach(v => {
      if (v.insuranceExpiry) {
        try {
          const diff = differenceInDays(parseISO(v.insuranceExpiry), today);
          if (diff <= 30) {
            alerts.push({ vehicle: `${v.name} (${v.number})`, type: 'Insurance Expiry', date: v.insuranceExpiry, daysLeft: diff });
          }
        } catch { }
      }
      if (v.fitnessExpiry) {
        try {
          const diff = differenceInDays(parseISO(v.fitnessExpiry), today);
          if (diff <= 30) {
            alerts.push({ vehicle: `${v.name} (${v.number})`, type: 'FC / Fitness Expiry', date: v.fitnessExpiry, daysLeft: diff });
          }
        } catch { }
      }
    });

    (vehicleMaintenance || []).forEach(m => {
      if (m.nextServiceDueDate) {
        try {
          const diff = differenceInDays(parseISO(m.nextServiceDueDate), today);
          if (diff <= 15) {
            alerts.push({ vehicle: `${m.vehicleName} (${m.vehicleNumber})`, type: 'Service Due', date: m.nextServiceDueDate, daysLeft: diff });
          }
        } catch { }
      }
    });

    return {
      totalVeh,
      activeVeh,
      underMaintVeh,
      totalTripsCount,
      completedTripsCount,
      totalPetrolSpent,
      totalDriverWages,
      totalMaintCost,
      alerts
    };
  }, [vehicles, allTrips, vehicleMaintenance]);

  // Vehicle Submit
  const handleOpenAddVehicle = () => {
    setEditingVehicleId(null);
    setVName('');
    setVNumber('');
    setVType('Pickup');
    setVStatus('Active');
    setVFuelType('Diesel');
    setVDriverId('');
    setVOdometer('');
    setVInsuranceExpiry('');
    setVFitnessExpiry('');
    setVNotes('');
    setShowVehicleModal(true);
  };

  const handleOpenEditVehicle = (veh: Vehicle) => {
    setEditingVehicleId(veh.id);
    setVName(veh.name);
    setVNumber(veh.number);
    setVType(veh.type || 'Pickup');
    setVStatus((veh.status as any) || 'Active');
    setVFuelType(veh.fuelType || 'Diesel');
    setVDriverId(veh.assignedDriverId || '');
    setVOdometer(veh.odometer?.toString() || '');
    setVInsuranceExpiry(veh.insuranceExpiry || '');
    setVFitnessExpiry(veh.fitnessExpiry || '');
    setVNotes(veh.notes || '');
    setShowVehicleModal(true);
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim() || !vNumber.trim()) {
      toast.error('Vehicle name and number plate are required');
      return;
    }

    const assignedDriver = staffList.find(s => s.id === vDriverId);

    const payload: Partial<Vehicle> = {
      name: vName.trim(),
      number: vNumber.trim().toUpperCase(),
      type: vType,
      status: vStatus,
      fuelType: vFuelType,
      assignedDriverId: vDriverId && vDriverId !== 'none' ? vDriverId : undefined,
      assignedDriverName: assignedDriver?.name || undefined,
      odometer: Number(vOdometer) || 0,
      insuranceExpiry: vInsuranceExpiry || undefined,
      fitnessExpiry: vFitnessExpiry || undefined,
      notes: vNotes.trim() || undefined,
    };

    if (editingVehicleId) {
      updateVehicle(editingVehicleId, payload);
      toast.success('Vehicle updated successfully');
    } else {
      addVehicle(payload as any);
      toast.success('Vehicle added to fleet');
    }
    setShowVehicleModal(false);
  };

  // Maintenance Submit
  const handleOpenAddMaintenance = (vehId?: string) => {
    setEditingMaintId(null);
    setMVehId(vehId || (vehicles[0]?.id || ''));
    setMDate(format(new Date(), 'yyyy-MM-dd'));
    setMType('Regular Service');
    setMCost('');
    setMOdometer('');
    setMWorkshop('');
    setMBillNo('');
    setMNextDue('');
    setMNotes('');
    setShowMaintenanceModal(true);
  };

  const handleOpenEditMaintenance = (rec: VehicleMaintenanceRecord) => {
    setEditingMaintId(rec.id);
    setMVehId(rec.vehicleId);
    setMDate(rec.date);
    setMType(rec.type);
    setMCost(rec.cost?.toString() || '');
    setMOdometer(rec.odometerReading?.toString() || '');
    setMWorkshop(rec.workshopName || '');
    setMBillNo(rec.billNumber || '');
    setMNextDue(rec.nextServiceDueDate || '');
    setMNotes(rec.notes || '');
    setShowMaintenanceModal(true);
  };

  const handleSaveMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mVehId) {
      toast.error('Please select a vehicle');
      return;
    }
    const veh = vehicles.find(v => v.id === mVehId);
    if (!veh) {
      toast.error('Vehicle not found');
      return;
    }

    const payload: Omit<VehicleMaintenanceRecord, 'id' | 'createdAt'> = {
      vehicleId: veh.id,
      vehicleName: veh.name,
      vehicleNumber: veh.number,
      date: mDate,
      type: mType,
      cost: Number(mCost) || 0,
      odometerReading: mOdometer ? Number(mOdometer) : undefined,
      workshopName: mWorkshop.trim() || undefined,
      billNumber: mBillNo.trim() || undefined,
      nextServiceDueDate: mNextDue || undefined,
      notes: mNotes.trim() || undefined,
    };

    if (editingMaintId) {
      updateVehicleMaintenance(editingMaintId, payload);
      toast.success('Maintenance record updated');
    } else {
      addVehicleMaintenance(payload);
      toast.success('Maintenance record saved');
    }
    setShowMaintenanceModal(false);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* ── Top Header & KPI Summary Banner ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border/60 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-heading font-extrabold text-foreground">
                Vehicles, Fuel & Trip Management
              </h2>
              <p className="text-xs text-muted-foreground">
                Complete fleet registry, trip logs, petrol expenditure reports, and vehicle maintenance tracker
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={handleOpenAddVehicle}
            className="h-9 rounded-xl text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Vehicle
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenAddMaintenance()}
            className="h-9 rounded-xl text-xs font-semibold gap-1.5"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-500" /> Log Maintenance
          </Button>
        </div>
      </div>

      {/* ── Expiry / Service Alert Banner ── */}
      {kpis.alerts.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Attention Required: Upcoming Expiries & Service Reminders</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {kpis.alerts.slice(0, 6).map((al, idx) => (
              <div key={idx} className="p-2 rounded-xl bg-card/80 border border-amber-500/20 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-foreground block">{al.vehicle}</span>
                  <span className="text-[11px] text-muted-foreground">{al.type}</span>
                </div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${al.daysLeft <= 0 ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}>
                  {al.daysLeft <= 0 ? 'Expired' : `${al.daysLeft}d left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Fleet Vehicles</span>
            <Truck className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-heading font-extrabold text-foreground">{kpis.totalVeh}</span>
            <span className="text-xs font-semibold text-emerald-600">({kpis.activeVeh} Active)</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{kpis.underMaintVeh} under maintenance</p>
        </Card>

        <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Dispatches & Trips</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-heading font-extrabold text-blue-600">{kpis.totalTripsCount}</span>
            <span className="text-xs font-semibold text-muted-foreground">({kpis.completedTripsCount} Completed)</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Driver wages: ₹{kpis.totalDriverWages.toLocaleString()}</p>
        </Card>

        <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Petrol & Fuel Spent</span>
            <Fuel className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-heading font-extrabold text-amber-600">
              ₹{kpis.totalPetrolSpent.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Separate fleet transit fuel</p>
        </Card>

        <Card className="p-4 rounded-2xl border-border/60 bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Vehicle Maintenance</span>
            <Wrench className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-heading font-extrabold text-purple-600">
              ₹{kpis.totalMaintCost.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{(vehicleMaintenance || []).length} service logs</p>
        </Card>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-2xl border border-border/60 w-fit">
        {[
          { id: 'fleet' as const, label: `Fleet Registry (${vehicles.length})`, icon: <Truck className="w-3.5 h-3.5" /> },
          { id: 'trips' as const, label: `Trip & Delivery Reports (${allTrips.length})`, icon: <Clock className="w-3.5 h-3.5" /> },
          { id: 'maintenance' as const, label: `Maintenance Tracker (${(vehicleMaintenance || []).length})`, icon: <Wrench className="w-3.5 h-3.5" /> },
          { id: 'petrol' as const, label: `Petrol & Fuel Tracker`, icon: <Fuel className="w-3.5 h-3.5" /> },
        ].map(tab => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-card text-foreground shadow-xs border border-border/70'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. FLEET VEHICLES DIRECTORY                                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'fleet' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by vehicle name, plate number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl text-xs font-medium bg-card"
              />
            </div>
            <Button
              size="sm"
              onClick={handleOpenAddVehicle}
              className="h-10 rounded-xl text-xs font-semibold gap-1.5 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" /> Add Vehicle
            </Button>
          </div>

          {vehicles.length === 0 ? (
            <div className="text-center py-14 bg-card rounded-2xl border border-dashed border-border/70 p-6 space-y-3">
              <Truck className="w-12 h-12 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-bold text-foreground">No Fleet Vehicles Registered</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add your company trucks, pickups, and transit vehicles to track fuel consumption, trip dispatches, and maintenance.
              </p>
              <Button size="sm" onClick={handleOpenAddVehicle} className="rounded-xl text-xs font-bold">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Your First Vehicle
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles
                .filter(v => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return v.name.toLowerCase().includes(q) || v.number.toLowerCase().includes(q) || (v.type || '').toLowerCase().includes(q);
                })
                .map(veh => {
                  const vehTrips = allTrips.filter(t => t.vehicle === veh.name || t.vehicleNumber === veh.number);
                  const vehFuel = vehTrips.reduce((s, t) => s + (Number(t.petrolCharge) || 0), 0);
                  const vehMaint = (vehicleMaintenance || []).filter(m => m.vehicleId === veh.id);
                  const vehMaintCost = vehMaint.reduce((s, m) => s + (Number(m.cost) || 0), 0);
                  const status = veh.status || 'Active';

                  return (
                    <Card key={veh.id} className="p-4 rounded-2xl bg-card border border-border/60 hover:border-primary/40 transition-all shadow-xs flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Truck className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-foreground">{veh.name}</h4>
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-muted text-primary border border-border/50">
                                {veh.number}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              status === 'Active'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : status === 'Under Maintenance'
                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {status}
                          </span>
                        </div>

                        {/* Specs & Driver */}
                        <div className="mt-3.5 space-y-1.5 text-xs bg-muted/20 p-2.5 rounded-xl border border-border/40">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Type / Fuel:</span>
                            <span className="font-semibold text-foreground">{veh.type || 'Pickup'} · {veh.fuelType || 'Diesel'}</span>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Assigned Driver:</span>
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              <User className="w-3 h-3 text-muted-foreground" />
                              {veh.assignedDriverName || 'Not Assigned'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Current Odometer:</span>
                            <span className="font-semibold text-foreground font-mono">
                              {(veh.odometer || 0).toLocaleString()} km
                            </span>
                          </div>
                          {veh.insuranceExpiry && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Insurance Expiry:</span>
                              <span className="font-medium text-foreground">{veh.insuranceExpiry}</span>
                            </div>
                          )}
                          {veh.fitnessExpiry && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>FC Expiry:</span>
                              <span className="font-medium text-foreground">{veh.fitnessExpiry}</span>
                            </div>
                          )}
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-1.5 mt-3 text-center">
                          <div className="p-2 rounded-xl bg-card border border-border/50">
                            <span className="text-[10px] text-muted-foreground block">Trips</span>
                            <span className="text-xs font-bold text-foreground">{vehTrips.length}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-card border border-border/50">
                            <span className="text-[10px] text-muted-foreground block">Fuel Logged</span>
                            <span className="text-xs font-bold text-amber-600">₹{vehFuel.toLocaleString()}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-card border border-border/50">
                            <span className="text-[10px] text-muted-foreground block">Maint. Total</span>
                            <span className="text-xs font-bold text-purple-600">₹{vehMaintCost.toLocaleString()}</span>
                          </div>
                        </div>

                        {veh.notes && (
                          <p className="text-[11px] text-muted-foreground mt-2 italic px-1">
                            "{veh.notes}"
                          </p>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40 gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenAddMaintenance(veh.id)}
                          className="h-8 rounded-lg text-xs font-semibold text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 px-2"
                        >
                          <Wrench className="w-3.5 h-3.5 mr-1" /> Log Service
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditVehicle(veh)}
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete vehicle ${veh.name} (${veh.number})?`)) {
                                deleteVehicle(veh.id);
                                toast.success('Vehicle removed');
                              }
                            }}
                            className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. DETAIL TRIP & DELIVERY REPORT                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'trips' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <Label className="text-[11px] font-bold text-muted-foreground block mb-1">Search Trips</Label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search trips..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 rounded-xl text-xs bg-muted/20"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-muted-foreground block mb-1">Filter Vehicle</Label>
                <Select value={selectedVehicleFilter} onValueChange={setSelectedVehicleFilter}>
                  <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20">
                    <SelectValue placeholder="All Vehicles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fleet Vehicles</SelectItem>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.name}>{v.name} ({v.number})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-muted-foreground block mb-1">Filter Driver</Label>
                <Select value={selectedDriverFilter} onValueChange={setSelectedDriverFilter}>
                  <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20">
                    <SelectValue placeholder="All Drivers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drivers / Staff</SelectItem>
                    {driversList.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-muted-foreground block mb-1">Destination Site</Label>
                <Select value={selectedSiteFilter} onValueChange={setSelectedSiteFilter}>
                  <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20">
                    <SelectValue placeholder="All Sites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Destination Sites</SelectItem>
                    {sites.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-muted-foreground block mb-1">Specific Date</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    value={tripDateFilter}
                    onChange={e => setTripDateFilter(e.target.value)}
                    className="h-9 rounded-xl text-xs bg-muted/20"
                  />
                  {tripDateFilter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTripDateFilter('')}
                      className="h-9 px-2 text-xs"
                      title="Clear Date"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Filter Summary Strip */}
            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                Showing {filteredTrips.length} trip{filteredTrips.length === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-4">
                <span>
                  Petrol: <strong className="text-amber-600">₹{filteredTrips.reduce((s, t) => s + (Number(t.petrolCharge) || 0), 0).toLocaleString()}</strong>
                </span>
                <span>
                  Driver Wages: <strong className="text-blue-600">₹{filteredTrips.reduce((s, t) => s + (Number(t.driverWage) || 0), 0).toLocaleString()}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Trips Table / List */}
          {filteredTrips.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border/60">
              <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground font-semibold">No trips matching the selected filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTrips.map(trip => {
                const materialsCount = (trip.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
                const materialsNames = (trip.items || []).map(i => `${i.name || i.materialName} (${i.quantity} ${i.unit || ''})`).join(', ');

                return (
                  <Card key={trip.id} className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                          <Truck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground">{trip.vehicle || 'Company Vehicle'}</span>
                            {trip.vehicleNumber && (
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-muted text-primary border border-border/50">
                                {trip.vehicleNumber}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                trip.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                  : trip.status === 'assigned'
                                  ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {trip.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <Calendar className="w-3 h-3" /> {trip.date} {trip.time && `· ${trip.time}`}
                            <span className="text-muted-foreground/50">•</span>
                            <User className="w-3 h-3 text-primary" /> Driver: <strong>{trip.driverName || 'Unassigned'}</strong>
                          </p>
                        </div>
                      </div>

                      {/* Financials for Trip */}
                      <div className="flex items-center gap-3 self-start md:self-auto">
                        <div className="text-right p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 block">
                            Petrol Charge
                          </span>
                          <span className="text-sm font-bold text-amber-600 font-mono">
                            ₹{(Number(trip.petrolCharge) || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-right p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                          <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300 block">
                            Driver Wage
                          </span>
                          <span className="text-sm font-bold text-blue-600 font-mono">
                            ₹{(Number(trip.driverWage) || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Route & Materials Detail */}
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/40 text-xs space-y-2">
                      <div className="flex items-center gap-2 flex-wrap text-muted-foreground">
                        <span className="font-semibold text-foreground">Route:</span>
                        <span className="px-2 py-0.5 rounded-lg bg-card border border-border/50 font-medium">
                          {trip.supplierName ? `Supplier: ${trip.supplierName}` : trip.sourceSiteName ? `Transfer: ${trip.sourceSiteName}` : 'Warehouse Depot'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-primary" />
                        <span className="px-2 py-0.5 rounded-lg bg-card border border-border/50 font-bold text-foreground">
                          {trip.siteName}
                        </span>
                        {trip.duration && (
                          <span className="text-muted-foreground text-[11px] ml-auto">
                            Transit Duration: <strong>{trip.duration}</strong> ({trip.startTime || 'Start'} → {trip.endTime || trip.completionTime || 'Delivered'})
                          </span>
                        )}
                      </div>

                      {materialsNames && (
                        <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                          <span className="font-semibold text-foreground mr-1">Materials Transported:</span>
                          {materialsNames}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. VEHICLE MAINTENANCE TRACKER                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'maintenance' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-foreground">Vehicle Service & Repair Log</h3>
              <p className="text-xs text-muted-foreground">Record workshops, periodic maintenance, oil changes, tyres, and repair costs</p>
            </div>
            <Button
              size="sm"
              onClick={() => handleOpenAddMaintenance()}
              className="h-9 rounded-xl text-xs font-semibold gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Log New Service / Repair
            </Button>
          </div>

          {(vehicleMaintenance || []).length === 0 ? (
            <div className="text-center py-14 bg-card rounded-2xl border border-dashed border-border/70 p-6 space-y-3">
              <Wrench className="w-12 h-12 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-bold text-foreground">No Maintenance Records Found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Keep your fleet in top shape. Log servicing costs, oil changes, garage invoices, and next service due dates.
              </p>
              <Button size="sm" onClick={() => handleOpenAddMaintenance()} className="rounded-xl text-xs font-bold">
                <Plus className="w-3.5 h-3.5 mr-1" /> Log Service Now
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {(vehicleMaintenance || []).map(maint => (
                <Card key={maint.id} className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-foreground">{maint.vehicleName}</h4>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-muted text-primary border border-border/50">
                            {maint.vehicleNumber}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
                            {maint.type}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>Date: {maint.date}</span>
                          {maint.workshopName && <span>· Workshop: <strong>{maint.workshopName}</strong></span>}
                          {maint.billNumber && <span>· Bill: <strong>#{maint.billNumber}</strong></span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Cost</span>
                        <span className="text-base font-bold text-purple-600 font-mono">
                          ₹{maint.cost.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditMaintenance(maint)}
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (window.confirm('Delete this maintenance record?')) {
                              deleteVehicleMaintenance(maint.id);
                              toast.success('Record removed');
                            }
                          }}
                          className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Additional info: Odometer & Next Due */}
                  {(maint.odometerReading || maint.nextServiceDueDate || maint.notes) && (
                    <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        {maint.odometerReading && (
                          <span>Odometer at service: <strong>{maint.odometerReading.toLocaleString()} km</strong></span>
                        )}
                        {maint.nextServiceDueDate && (
                          <span className="flex items-center gap-1 text-amber-600 font-medium">
                            <Clock className="w-3 h-3" /> Next Due: {maint.nextServiceDueDate}
                          </span>
                        )}
                      </div>
                      {maint.notes && (
                        <span className="text-muted-foreground italic">"{maint.notes}"</span>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. PETROL & FUEL ANALYTICS                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'petrol' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Petrol Allowance</span>
              <p className="text-2xl font-heading font-extrabold text-amber-600 mt-1">
                ₹{kpis.totalPetrolSpent.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Tracked across {kpis.totalTripsCount} delivery trips</p>
            </Card>

            <Card className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Average Fuel Per Trip</span>
              <p className="text-2xl font-heading font-extrabold text-foreground mt-1">
                ₹{kpis.completedTripsCount > 0 ? Math.round(kpis.totalPetrolSpent / kpis.completedTripsCount).toLocaleString() : 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Based on completed trips</p>
            </Card>

            <Card className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Fleet Running Cost</span>
              <p className="text-2xl font-heading font-extrabold text-primary mt-1">
                ₹{(kpis.totalPetrolSpent + kpis.totalDriverWages + kpis.totalMaintCost).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Petrol + Driver Wages + Servicing</p>
            </Card>
          </div>

          {/* Vehicle Fuel Breakdown */}
          <Card className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Fuel className="w-4 h-4 text-amber-500" /> Petrol Consumption by Vehicle
            </h3>
            <div className="space-y-2">
              {vehicles.map(v => {
                const vehTrips = allTrips.filter(t => t.vehicle === v.name || t.vehicleNumber === v.number);
                const fuel = vehTrips.reduce((s, t) => s + (Number(t.petrolCharge) || 0), 0);
                const percentage = kpis.totalPetrolSpent > 0 ? Math.round((fuel / kpis.totalPetrolSpent) * 100) : 0;

                return (
                  <div key={v.id} className="p-3 rounded-xl bg-muted/25 border border-border/40 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{v.name}</span>
                        <span className="font-mono text-[11px] text-muted-foreground font-semibold">({v.number})</span>
                        <span className="text-[10px] text-muted-foreground">{vehTrips.length} trip{vehTrips.length === 1 ? '' : 's'}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-amber-600 font-mono">₹{fuel.toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">({percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ADD / EDIT VEHICLE MODAL                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showVehicleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-5 rounded-2xl bg-card border border-border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                {editingVehicleId ? 'Edit Vehicle Details' : 'Register New Fleet Vehicle'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowVehicleModal(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="font-semibold text-muted-foreground">Vehicle Name *</Label>
                  <Input
                    placeholder="e.g. Bolero Maxi Truck"
                    value={vName}
                    onChange={e => setVName(e.target.value)}
                    className="mt-1 h-9 rounded-xl font-bold"
                    required
                  />
                </div>
                <div>
                  <Label className="font-semibold text-muted-foreground">Plate Number *</Label>
                  <Input
                    placeholder="e.g. TN 69 AW 2549"
                    value={vNumber}
                    onChange={e => setVNumber(e.target.value)}
                    className="mt-1 h-9 rounded-xl font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="font-semibold text-muted-foreground">Type</Label>
                  <Select value={vType} onValueChange={setVType}>
                    <SelectTrigger className="mt-1 h-9 rounded-xl">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map(vt => (
                        <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="font-semibold text-muted-foreground">Fuel Type</Label>
                  <Select value={vFuelType} onValueChange={setVFuelType}>
                    <SelectTrigger className="mt-1 h-9 rounded-xl">
                      <SelectValue placeholder="Fuel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Diesel">Diesel</SelectItem>
                      <SelectItem value="Petrol">Petrol</SelectItem>
                      <SelectItem value="CNG">CNG</SelectItem>
                      <SelectItem value="Electric">Electric</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="font-semibold text-muted-foreground">Status</Label>
                  <Select value={vStatus} onValueChange={(val: any) => setVStatus(val)}>
                    <SelectTrigger className="mt-1 h-9 rounded-xl">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                      <SelectItem value="Idle">Idle</SelectItem>
                      <SelectItem value="Out of Service">Out of Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="font-semibold text-muted-foreground">Assigned Driver</Label>
                  <Select value={vDriverId} onValueChange={setVDriverId}>
                    <SelectTrigger className="mt-1 h-9 rounded-xl">
                      <SelectValue placeholder="Select Driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None / Floating Vehicle</SelectItem>
                      {driversList.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name} ({d.role})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="font-semibold text-muted-foreground">Odometer (km)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 45000"
                    value={vOdometer}
                    onChange={e => setVOdometer(e.target.value)}
                    className="mt-1 h-9 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="font-semibold text-muted-foreground">Insurance Expiry Date</Label>
                  <Input
                    type="date"
                    value={vInsuranceExpiry}
                    onChange={e => setVInsuranceExpiry(e.target.value)}
                    className="mt-1 h-9 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="font-semibold text-muted-foreground">FC / Fitness Expiry Date</Label>
                  <Input
                    type="date"
                    value={vFitnessExpiry}
                    onChange={e => setVFitnessExpiry(e.target.value)}
                    className="mt-1 h-9 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <Label className="font-semibold text-muted-foreground">Notes / Capacity / Registration Info</Label>
                <Input
                  placeholder="e.g. 1.5 Ton payload capacity, permit details"
                  value={vNotes}
                  onChange={e => setVNotes(e.target.value)}
                  className="mt-1 h-9 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowVehicleModal(false)}
                  className="flex-1 h-9 rounded-xl font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-9 rounded-xl font-bold"
                >
                  {editingVehicleId ? 'Update Vehicle' : 'Register Vehicle'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* LOG / EDIT MAINTENANCE MODAL                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-5 rounded-2xl bg-card border border-border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-500" />
                {editingMaintId ? 'Edit Maintenance Record' : 'Log Vehicle Maintenance & Repair'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMaintenanceModal(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveMaintenance} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="font-semibold text-muted-foreground">Select Vehicle *</Label>
                  <Select value={mVehId} onValueChange={setMVehId}>
                    <SelectTrigger className="mt-1 h-9 rounded-xl">
                      <SelectValue placeholder="Vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name} ({v.number})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-semibold text-muted-foreground">Service Date *</Label>
                  <Input
                    type="date"
                    value={mDate}
                    onChange={e => setMDate(e.target.value)}
                    className="mt-1 h-9 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="font-semibold text-muted-foreground">Maintenance Type *</Label>
                  <Select value={mType} onValueChange={setMType}>
                    <SelectTrigger className="mt-1 h-9 rounded-xl">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Regular Service">Regular Service</SelectItem>
                      <SelectItem value="Oil Change">Oil Change</SelectItem>
                      <SelectItem value="Tyre Replacement">Tyre Replacement</SelectItem>
                      <SelectItem value="Brake Service">Brake Service</SelectItem>
                      <SelectItem value="Engine Repair">Engine Repair</SelectItem>
                      <SelectItem value="Body Work">Body Work</SelectItem>
                      <SelectItem value="Insurance / Tax">Insurance / Tax</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-semibold text-muted-foreground">Total Cost (₹) *</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g. 3500"
                    value={mCost}
                    onChange={e => setMCost(e.target.value)}
                    className="mt-1 h-9 rounded-xl font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="font-semibold text-muted-foreground">Workshop / Garage Name</Label>
                  <Input
                    placeholder="e.g. Sri Murugan Auto Works"
                    value={mWorkshop}
                    onChange={e => setMWorkshop(e.target.value)}
                    className="mt-1 h-9 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="font-semibold text-muted-foreground">Bill / Invoice Number</Label>
                  <Input
                    placeholder="e.g. INV-2024-89"
                    value={mBillNo}
                    onChange={e => setMBillNo(e.target.value)}
                    className="mt-1 h-9 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="font-semibold text-muted-foreground">Odometer Reading (km)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 48200"
                    value={mOdometer}
                    onChange={e => setMOdometer(e.target.value)}
                    className="mt-1 h-9 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <Label className="font-semibold text-muted-foreground">Next Service Due Date</Label>
                  <Input
                    type="date"
                    value={mNextDue}
                    onChange={e => setMNextDue(e.target.value)}
                    className="mt-1 h-9 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <Label className="font-semibold text-muted-foreground">Work Done / Parts Replaced / Notes</Label>
                <Input
                  placeholder="e.g. Castrol 15W40 oil changed, oil filter replaced, wheel alignment"
                  value={mNotes}
                  onChange={e => setMNotes(e.target.value)}
                  className="mt-1 h-9 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="flex-1 h-9 rounded-xl font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-9 rounded-xl font-bold"
                >
                  {editingMaintId ? 'Update Record' : 'Save Record'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
