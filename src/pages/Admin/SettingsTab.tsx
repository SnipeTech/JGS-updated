import { useState } from 'react';
import { format } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { Package, Users, ShieldCheck, Plus, Trash2, CheckCircle2, AlertCircle, Ruler, Tag } from 'lucide-react';
import { TabId } from '../AdminDashboard';
import { MATERIAL_CATEGORIES } from '@/types';

const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'sites', label: 'Sites' },
  { id: 'materials', label: 'Materials & Suppliers' },
  { id: 'vehicles', label: 'Vehicles & Fuel' },
  { id: 'settings', label: 'Settings & Master Data' },
  { id: 'payroll', label: 'Payroll & Salaries' },
  { id: 'staff', label: 'Staff Management' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'customers', label: 'Clients & Customers' },
  { id: 'reports', label: 'Reports & Ledger' }
];

export const SettingsTab = () => {
  const {
    materialSettings, addMaterialSetting, deleteMaterialSetting,
    labourTypes, addLabourType, removeLabourType,
    unitMaster, addUnit, removeUnit,
    staffList, updateStaff,
    sites, addMaterialRental
  } = useApp();

  const [activeSection, setActiveSection] = useState<'materials' | 'labour' | 'units' | 'admins'>('materials');

  // Material State
  const [matName, setMatName] = useState('');
  const [matCategory, setMatCategory] = useState<string>('Civil & Structural');
  const [matUnit, setMatUnit] = useState('Kg');
  const [matRate, setMatRate] = useState('');
  const [isRental, setIsRental] = useState(false);
  const [rentalRatePerDay, setRentalRatePerDay] = useState('');
  const [rentalSiteId, setRentalSiteId] = useState('');
  const [matFilter, setMatFilter] = useState<'all' | 'standard' | 'rental'>('all');

  // Labour State
  const [labourName, setLabourName] = useState('');

  // Units State
  const [newUnitName, setNewUnitName] = useState('');

  // Admin Permissions State
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName.trim()) return toast.error('Material name required');

    const newMatId = `mat_${Date.now()}`;
    addMaterialSetting({
      name: matName.trim(),
      category: matCategory.trim() || 'General',
      unit: matUnit,
      defaultRate: 0,
      isRental,
      rentalRatePerDay: isRental ? (Number(rentalRatePerDay) || 0) : undefined
    });

    if (isRental && rentalSiteId && rentalSiteId !== 'none') {
      const targetSite = sites.find(s => s.id === rentalSiteId);
      if (targetSite) {
        addMaterialRental({
          materialId: newMatId,
          materialName: matName.trim(),
          siteId: targetSite.id,
          siteName: targetSite.name,
          startDate: format(new Date(), 'yyyy-MM-dd'),
          quantity: 1,
          unit: matUnit || 'Nos',
          rentalRatePerDay: Number(rentalRatePerDay) || 0,
          status: 'active',
          notes: 'Deployed via Material Catalog'
        });
        toast.success(`Rental material added to catalog & deployed to ${targetSite.name}!`);
      }
    } else {
      toast.success(isRental ? 'Rental material added to catalog' : 'Material added to catalog');
    }

    setMatName('');
    setMatCategory('Civil & Structural');
    setMatRate('');
    setRentalRatePerDay('');
    setRentalSiteId('');
    setIsRental(false);
  };

  const handleAddLabourType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!labourName.trim()) return toast.error('Labour type required');
    addLabourType(labourName.trim());
    toast.success('Labour type added');
    setLabourName('');
  };

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newUnitName.trim();
    if (!trimmed) return toast.error('Unit name is required');
    if (unitMaster.some(u => u.toLowerCase() === trimmed.toLowerCase())) {
      return toast.error(`Unit "${trimmed}" already exists`);
    }
    addUnit(trimmed);
    toast.success(`Unit "${trimmed}" added to master list!`);
    setNewUnitName('');
  };

  const handleRemoveUnit = (unitToRemove: string) => {
    const isUsed = materialSettings.some(m => m.unit?.toLowerCase() === unitToRemove.toLowerCase());
    if (isUsed) {
      if (!confirm(`Warning: Some materials in your catalog are currently using the unit "${unitToRemove}". Are you sure you want to remove it?`)) {
        return;
      }
    }
    removeUnit(unitToRemove);
    toast.success(`Unit "${unitToRemove}" removed`);
    if (matUnit.toLowerCase() === unitToRemove.toLowerCase()) {
      setMatUnit(unitMaster.find(u => u.toLowerCase() !== unitToRemove.toLowerCase()) || 'Kg');
    }
  };

  const toggleAdminPermission = (staffId: string, tabId: string) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;

    const currentPerms = Array.isArray(staff.adminPermissions)
      ? [...staff.adminPermissions]
      : (staff.role === 'admin' ? ADMIN_TABS.map(t => t.id) : []);

    let nextPerms: string[];
    if (currentPerms.includes(tabId)) {
      nextPerms = currentPerms.filter(p => p !== tabId);
    } else {
      nextPerms = [...currentPerms, tabId];
    }

    updateStaff(staffId, {
      role: 'admin',
      adminPermissions: nextPerms
    });
    toast.success('Admin permissions updated');
  };

  const grantAllPermissions = (staffId: string) => {
    updateStaff(staffId, {
      role: 'admin',
      adminPermissions: ADMIN_TABS.map(t => t.id)
    });
    toast.success('Granted access to all 10 tabs');
  };

  const revokeAllPermissions = (staffId: string) => {
    updateStaff(staffId, {
      adminPermissions: []
    });
    toast.success('Revoked access to all tabs (0 tabs permitted)');
  };

  const handleUpdatePassword = (staffId: string) => {
    if (!newStaffPassword.trim()) {
      return toast.error('Please enter a password');
    }
    updateStaff(staffId, { password: newStaffPassword.trim() });
    toast.success('Staff login password updated');
    setNewStaffPassword('');
  };

  const handleToggleAdminRole = (staffId: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      updateStaff(staffId, {
        role: 'admin',
        adminPermissions: ADMIN_TABS.map(t => t.id)
      });
      toast.success('Promoted to Admin with all tab permissions');
    } else {
      updateStaff(staffId, {
        role: 'supervisor',
        adminPermissions: []
      });
      toast.success('Demoted from Admin (reverted to Supervisor)');
    }
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="section-header !mb-1">Settings & Master Data</h3>
          <p className="text-xs text-muted-foreground">Manage material catalog, labour types, custom units, and admin access control.</p>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-muted/30 rounded-xl w-fit border border-border/50 overflow-x-auto max-w-full">
        <button
          onClick={() => setActiveSection('materials')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSection === 'materials' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Package className="w-3.5 h-3.5" /> Material Catalog
        </button>
        <button
          onClick={() => setActiveSection('labour')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSection === 'labour' ? 'bg-amber-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Labour Types
        </button>
        <button
          onClick={() => setActiveSection('units')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSection === 'units' ? 'bg-sky-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" /> Units Master
        </button>
        <button
          onClick={() => setActiveSection('admins')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSection === 'admins' ? 'bg-purple-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Admin Permissions
        </button>
      </div>

      {activeSection === 'materials' && (
        <Card className="p-4 rounded-2xl border-border/50 shadow-sm space-y-4">
          <form onSubmit={handleAddMaterial} className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs font-semibold">Material Name *</Label>
                <Input value={matName} onChange={e => setMatName(e.target.value)} placeholder="e.g. Steel Scaffolding Set, Cement 50kg" className="mt-1 h-9 text-xs" />
              </div>
              <div className="w-[160px]">
                <Label className="text-xs font-semibold">Category *</Label>
                <Select value={matCategory} onValueChange={setMatCategory}>
                  <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {MATERIAL_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[120px]">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Unit</Label>
                  <button
                    type="button"
                    onClick={() => setActiveSection('units')}
                    className="text-[10px] font-semibold text-sky-600 hover:underline flex items-center gap-0.5"
                    title="Manage / Add new units"
                  >
                    <Plus className="w-2.5 h-2.5" /> New Unit
                  </button>
                </div>
                <Select value={matUnit} onValueChange={setMatUnit}>
                  <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {unitMaster.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="h-9 gap-1 text-xs"><Plus className="w-3.5 h-3.5" /> Add Material</Button>
            </div>

            {/* Rental Material Flag */}
            <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-border/30">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={isRental}
                  onChange={e => setIsRental(e.target.checked)}
                  className="rounded border-border w-4 h-4 text-primary"
                />
                <span>Designate as Rental Material (e.g. Scaffolding, Mixer Machine, Shuttering Plates, Generator)</span>
              </label>

              {isRental && (
                <div className="flex flex-wrap items-center gap-3 pl-2 border-l border-border/40">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Rental Rate (₹/day per {matUnit}):</Label>
                    <Input
                      type="number"
                      value={rentalRatePerDay}
                      onChange={e => setRentalRatePerDay(e.target.value)}
                      placeholder={matRate || '50'}
                      className="h-8 w-24 text-xs font-semibold text-amber-600"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Deploy to Site:</Label>
                    <Select value={rentalSiteId} onValueChange={setRentalSiteId}>
                      <SelectTrigger className="h-8 w-44 text-xs">
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
          </form>

          {/* Filter Pills */}
          <div className="flex items-center justify-between gap-2 pt-1 border-b border-border/40 pb-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMatFilter('all')}
                className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
                  matFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                All Materials ({materialSettings.length})
              </button>
              <button
                type="button"
                onClick={() => setMatFilter('standard')}
                className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
                  matFilter === 'standard' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Standard Consumables ({materialSettings.filter(m => !m.isRental).length})
              </button>
              <button
                type="button"
                onClick={() => setMatFilter('rental')}
                className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  matFilter === 'rental' ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>🔄</span> Rental Materials ({materialSettings.filter(m => m.isRental).length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {materialSettings
              .filter(m => matFilter === 'all' ? true : matFilter === 'rental' ? m.isRental : !m.isRental)
              .map(m => (
                <div key={m.id} className={`flex items-center justify-between p-3.5 rounded-xl border bg-card hover:border-primary/40 transition-all ${
                  m.isRental ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/50'
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-sm font-bold text-foreground">{m.name}</h4>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
                        {m.category || 'General'}
                      </span>
                      {m.isRental ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                          Rental Item
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                          Standard
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Unit: {m.unit || 'Unit'} {m.isRental && m.rentalRatePerDay ? (
                        <>— <strong className="text-amber-700 dark:text-amber-300">₹{m.rentalRatePerDay} / day</strong></>
                      ) : null}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteMaterialSetting(m.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
          </div>
        </Card>
      )}

      {activeSection === 'labour' && (
        <Card className="p-4 rounded-2xl border-border/50 shadow-sm space-y-4">
          <form onSubmit={handleAddLabourType} className="flex items-end gap-3 p-3 bg-muted/20 rounded-xl border border-border/40">
            <div className="flex-1 max-w-sm">
              <Label className="text-xs font-semibold">New Labour Type *</Label>
              <Input value={labourName} onChange={e => setLabourName(e.target.value)} placeholder="e.g. Carpenter, Welder" className="mt-1 h-9 text-xs" />
            </div>
            <Button type="submit" className="h-9 gap-1 text-xs bg-amber-600 hover:bg-amber-700"><Plus className="w-3.5 h-3.5" /> Add Type</Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {labourTypes.map(type => (
              <div key={type} className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full border border-border/60 bg-card text-xs font-bold uppercase">
                {type}
                <Button variant="ghost" size="icon" onClick={() => removeLabourType(type)} className="h-6 w-6 text-muted-foreground hover:text-destructive rounded-full">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeSection === 'units' && (
        <Card className="p-4 rounded-2xl border-border/50 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Ruler className="w-4 h-4 text-sky-600" /> Units of Measurement (UOM)
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create and manage custom units used across Material Catalog, Site Requisitions, and Supplier Orders.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-sky-500/10 text-sky-600 rounded-lg">
              {unitMaster.length} Units Available
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
            <Button type="submit" className="h-9 gap-1 text-xs bg-sky-600 hover:bg-sky-700 text-white">
              <Plus className="w-3.5 h-3.5" /> Add Unit
            </Button>
          </form>

          {/* Quick Suggestions */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Quick Suggestions (Click to Add):
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {['Cft', 'Brass', 'Bundles', 'Rolls', 'Boxes', 'Pieces', 'Meters', 'Sq.Mtr', 'Hours', 'Days', 'Trips', 'Load']
                .filter(u => !unitMaster.some(existing => existing.toLowerCase() === u.toLowerCase()))
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
                    <Plus className="w-3 h-3" /> {sug}
                  </button>
                ))}
            </div>
          </div>

          {/* Unit Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-2">
            {unitMaster.map(unit => {
              const usageCount = materialSettings.filter(m => m.unit?.toLowerCase() === unit.toLowerCase()).length;
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

      {activeSection === 'admins' && (() => {
        const adminStaff = staffList.filter(s => s.role === 'admin');
        const nonAdminStaff = staffList.filter(s => s.role !== 'admin');
        const selectedStaff = staffList.find(s => s.id === selectedStaffId);
        const isSelectedAdmin = selectedStaff?.role === 'admin';
        const allowedCount = selectedStaff
          ? (Array.isArray(selectedStaff.adminPermissions)
              ? selectedStaff.adminPermissions.length
              : (isSelectedAdmin ? ADMIN_TABS.length : 0))
          : 0;

        return (
          <Card className="p-4 rounded-2xl border-border/50 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-border/40">
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Admin Permissions & Role Management
                </h4>
                <p className="text-xs text-muted-foreground">
                  Control which tabs each administrator can view. Staff members promoted to Admin can log in via their phone/ID.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger className="h-9 w-72 text-xs font-semibold bg-muted/30">
                    <SelectValue placeholder="Select Staff / Admin to manage" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminStaff.length > 0 && (
                      <div className="p-1">
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                          Administrators ({adminStaff.length})
                        </div>
                        {adminStaff.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            🛡️ {a.name} ({a.phone || 'No phone'})
                          </SelectItem>
                        ))}
                      </div>
                    )}
                    {nonAdminStaff.length > 0 && (
                      <div className="p-1">
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Staff / Supervisors ({nonAdminStaff.length})
                        </div>
                        {nonAdminStaff.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            👤 {s.name} ({s.phone || 'No phone'}) — {s.role}
                          </SelectItem>
                        ))}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!selectedStaff ? (
              <div className="p-8 text-center border border-dashed border-border/60 rounded-2xl bg-muted/10 space-y-2">
                <ShieldCheck className="w-10 h-10 mx-auto text-purple-500/50" />
                <h5 className="text-sm font-bold">No Staff or Administrator Selected</h5>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Select a staff member or administrator from the dropdown above to grant, revoke, or customize access to specific tabs in the Admin Workspace.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Staff summary strip */}
                <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-600/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-base">
                      {selectedStaff.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{selectedStaff.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSelectedAdmin
                            ? 'bg-purple-600 text-white'
                            : 'bg-muted text-muted-foreground border'
                        }`}>
                          {isSelectedAdmin ? 'Admin Role' : `Role: ${selectedStaff.role}`}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>📞 {selectedStaff.phone || 'No phone'}</span>
                        <span>•</span>
                        <span className="font-semibold text-purple-700 dark:text-purple-300">
                          Allowed: {allowedCount} / {ADMIN_TABS.length} Tabs
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & quick tools */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => grantAllPermissions(selectedStaff.id)}
                      className="h-8 text-xs font-bold gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Grant All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => revokeAllPermissions(selectedStaff.id)}
                      className="h-8 text-xs font-bold gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <AlertCircle className="w-3.5 h-3.5" /> Revoke All
                    </Button>
                    {isSelectedAdmin ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleAdminRole(selectedStaff.id, false)}
                        className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Demote to Supervisor"
                      >
                        Demote to Supervisor
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleToggleAdminRole(selectedStaff.id, true)}
                        className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold"
                      >
                        Promote to Admin
                      </Button>
                    )}
                  </div>
                </div>

                {/* Password Configuration */}
                <div className="p-3 bg-muted/20 rounded-xl border border-border/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Login Password:</span>
                    {selectedStaff.password ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Configured (Ready to log in)</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> No password set — user cannot log in
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder="Set new password..."
                      value={newStaffPassword}
                      onChange={e => setNewStaffPassword(e.target.value)}
                      className="h-8 w-44 text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleUpdatePassword(selectedStaff.id)}
                      className="h-8 text-xs bg-primary"
                    >
                      Save Password
                    </Button>
                  </div>
                </div>

                {/* Tab Permissions Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <Label className="font-bold text-muted-foreground uppercase text-[11px]">
                      Tab Access Permissions ({ADMIN_TABS.length} Workspace Areas)
                    </Label>
                    <span className="text-muted-foreground text-[11px]">
                      Click any card to toggle permission
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {ADMIN_TABS.map(tab => {
                      const hasAccess = Array.isArray(selectedStaff.adminPermissions)
                        ? selectedStaff.adminPermissions.includes(tab.id)
                        : (isSelectedAdmin ? true : false);

                      return (
                        <div
                          key={tab.id}
                          onClick={() => toggleAdminPermission(selectedStaff.id, tab.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                            hasAccess
                              ? 'border-purple-500/50 bg-purple-500/10 shadow-sm'
                              : 'border-border/60 bg-card/60 opacity-60 hover:opacity-100 hover:border-border'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-foreground">{tab.label}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {hasAccess ? (
                                <span className="text-purple-600 dark:text-purple-400 font-semibold">Access Allowed</span>
                              ) : (
                                <span>Restricted</span>
                              )}
                            </div>
                          </div>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            hasAccess
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-muted border border-border text-transparent'
                          }`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })()}
    </div>
  );
};

export default SettingsTab;
