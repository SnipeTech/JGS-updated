import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { Package, Users, ShieldCheck, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { TabId } from '../AdminDashboard';

const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'sites', label: 'Sites' },
  { id: 'settings', label: 'Settings & Master Data' },
  { id: 'materials', label: 'Materials & Suppliers' },
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
    paymentStageMaster, addPaymentStageMaster, removePaymentStageMaster,
    staffList, updateStaff
  } = useApp();

  const [activeSection, setActiveSection] = useState<'materials' | 'labour' | 'admins' | 'payment_stages'>('materials');

  // Material State
  const [matName, setMatName] = useState('');
  const [matUnit, setMatUnit] = useState('Kg');
  const [matRate, setMatRate] = useState('');
  const [isRental, setIsRental] = useState(false);
  const [rentalRatePerDay, setRentalRatePerDay] = useState('');
  const [matFilter, setMatFilter] = useState<'all' | 'standard' | 'rental'>('all');

  // Labour State
  const [labourName, setLabourName] = useState('');

  // Payment Stage State
  const [stageName, setStageName] = useState('');

  // Admin State
  const admins = staffList.filter(s => s.role === 'admin');
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName.trim()) return toast.error('Material name required');
    addMaterialSetting({
      name: matName.trim(),
      unit: matUnit,
      defaultRate: Number(matRate) || 0,
      isRental,
      rentalRatePerDay: isRental ? (Number(rentalRatePerDay) || Number(matRate) || 0) : undefined
    });
    toast.success(isRental ? 'Rental material added to catalog' : 'Material added to catalog');
    setMatName('');
    setMatRate('');
    setRentalRatePerDay('');
    setIsRental(false);
  };

  const handleAddLabourType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!labourName.trim()) return toast.error('Labour type required');
    addLabourType(labourName.trim());
    toast.success('Labour type added');
    setLabourName('');
  };

  const handleAddPaymentStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageName.trim()) return toast.error('Payment stage name required');
    if (paymentStageMaster.includes(stageName.trim())) return toast.error('Stage already exists');
    addPaymentStageMaster(stageName.trim());
    toast.success('Payment stage added');
    setStageName('');
  };

  const toggleAdminPermission = (adminId: string, tabId: string) => {
    const admin = admins.find(a => a.id === adminId);
    if (!admin) return;
    
    // Superadmin has all permissions, regular admins have custom ones
    let perms = admin.adminPermissions || ADMIN_TABS.map(t => t.id);
    if (perms.includes(tabId)) {
      perms = perms.filter(p => p !== tabId);
    } else {
      perms = [...perms, tabId];
    }
    updateStaff(adminId, { adminPermissions: perms });
    toast.success('Permissions updated');
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="section-header !mb-1">Settings & Master Data</h3>
          <p className="text-xs text-muted-foreground">Manage material catalog, labour types, and admin access control.</p>
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
          onClick={() => setActiveSection('admins')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSection === 'admins' ? 'bg-purple-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Admin Permissions
        </button>
        <button
          onClick={() => setActiveSection('payment_stages')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSection === 'payment_stages' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Payment Stages
        </button>
      </div>

      {activeSection === 'materials' && (
        <Card className="p-4 rounded-2xl border-border/50 shadow-sm space-y-4">
          <form onSubmit={handleAddMaterial} className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs font-semibold">Material Name *</Label>
                <Input value={matName} onChange={e => setMatName(e.target.value)} placeholder="e.g. Steel Scaffolding Set, Cement 50kg" className="mt-1 h-9 text-xs" />
              </div>
              <div className="w-[120px]">
                <Label className="text-xs font-semibold">Unit</Label>
                <Select value={matUnit} onValueChange={setMatUnit}>
                  <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kg">Kg</SelectItem>
                    <SelectItem value="Tons">Tons</SelectItem>
                    <SelectItem value="Bags">Bags</SelectItem>
                    <SelectItem value="Liters">Liters</SelectItem>
                    <SelectItem value="Nos">Nos</SelectItem>
                    <SelectItem value="Sets">Sets</SelectItem>
                    <SelectItem value="Sq.Ft">Sq.Ft</SelectItem>
                    <SelectItem value="Units">Units</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[120px]">
                <Label className="text-xs font-semibold">Default Rate (₹)</Label>
                <Input type="number" value={matRate} onChange={e => setMatRate(e.target.value)} placeholder="0" className="mt-1 h-9 text-xs" />
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
                <div className="flex items-center gap-2 pl-2 border-l border-border/40">
                  <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Rental Rate (₹/day per {matUnit}):</Label>
                  <Input
                    type="number"
                    value={rentalRatePerDay}
                    onChange={e => setRentalRatePerDay(e.target.value)}
                    placeholder={matRate || '50'}
                    className="h-8 w-28 text-xs font-semibold text-amber-600"
                  />
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
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground">{m.name}</h4>
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
                      {m.unit} — {m.isRental ? (
                        <strong className="text-amber-700 dark:text-amber-300">₹{m.rentalRatePerDay || m.defaultRate || 0} / day</strong>
                      ) : (
                        <span>₹{m.defaultRate || 0} / unit</span>
                      )}
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

      {activeSection === 'payment_stages' && (
        <Card className="p-4 rounded-2xl border-border/50 shadow-sm space-y-4">
          <form onSubmit={handleAddPaymentStage} className="flex items-end gap-3 p-3 bg-muted/20 rounded-xl border border-border/40">
            <div className="flex-1 max-w-sm">
              <Label className="text-xs font-semibold">New Payment Stage *</Label>
              <Input value={stageName} onChange={e => setStageName(e.target.value)} placeholder="e.g. Level 1, Foundation, Roofing" className="mt-1 h-9 text-xs" />
            </div>
            <Button type="submit" className="h-9 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700"><Plus className="w-3.5 h-3.5" /> Add Stage</Button>
          </form>

          <div className="flex flex-col gap-2">
            {paymentStageMaster.map((stage, i) => (
              <div key={stage} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                    {i + 1}
                  </div>
                  <span className="text-sm font-bold">{stage}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removePaymentStageMaster(stage)} className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {paymentStageMaster.length === 0 && (
              <p className="text-xs text-muted-foreground p-4 text-center">No payment stages defined yet.</p>
            )}
          </div>
        </Card>
      )}

      {activeSection === 'admins' && (
        <Card className="p-4 rounded-2xl border-border/50 shadow-sm space-y-4">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Select Admin to Manage:</Label>
            <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
              <SelectTrigger className="h-9 w-64 text-xs font-semibold bg-muted/30">
                <SelectValue placeholder="Select Admin" />
              </SelectTrigger>
              <SelectContent>
                {admins.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name} ({a.phone})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedAdminId ? (
            <div className="p-6 text-center border border-dashed border-border/50 rounded-xl bg-muted/10">
              <ShieldCheck className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-xs text-muted-foreground">Select an admin above to manage their tab access permissions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-700 dark:text-purple-300 text-xs flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Toggle the switches below to grant or revoke access to specific areas of the Admin Workspace. The default 'admin' login always has full access.</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ADMIN_TABS.map(tab => {
                  const admin = admins.find(a => a.id === selectedAdminId);
                  const hasAccess = admin?.adminPermissions ? admin.adminPermissions.includes(tab.id) : true;
                  
                  return (
                    <div key={tab.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer ${
                      hasAccess ? 'border-purple-500/40 bg-purple-500/5' : 'border-border/60 bg-card opacity-60 hover:opacity-100'
                    }`} onClick={() => toggleAdminPermission(selectedAdminId, tab.id)}>
                      <span className="text-xs font-bold">{tab.label}</span>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${hasAccess ? 'bg-purple-600 text-white' : 'bg-muted-foreground/30 text-transparent'}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default SettingsTab;
