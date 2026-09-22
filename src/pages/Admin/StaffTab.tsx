import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Users, Plus, UserCircle, PhoneCall, Trash2, PenLine, MapPin, Truck, ChevronDown, ChevronUp, Shield
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Staff } from '@/types';

// ── Staff Detail View ─────────────────────────────────────
export const StaffDetailView = ({ staffId, onBack }: { staffId: string; onBack: () => void }) => {
  const { staffList, dailyLogs, updateStaff, deleteStaff, labourTypes } = useApp();
  const staff = staffList.find(s => s.id === staffId);
  const today = format(new Date(), 'yyyy-MM-dd');

  const [fromDate, setFromDate] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
  );
  const [toDate, setToDate] = useState(today);
  const [editing, setEditing] = useState(false);

  const [eName, setEName] = useState(staff?.name || '');
  const [ePhone, setEPhone] = useState(staff?.phone || '');
  const [eRole, setERole] = useState(staff?.role || 'supervisor');
  const [eSupervisorId, setESupervisorId] = useState(staff?.supervisorId || '');
  const [eSalaryType, setESalaryType] = useState<'daily' | 'hourly'>(staff?.salaryType || 'daily');
  const [ePerDaySalary, setEPerDaySalary] = useState(staff?.perDaySalary?.toString() || '');
  const [ePerHourSalary, setEPerHourSalary] = useState(staff?.perHourSalary?.toString() || '');
  const [eCustomerHourlyRate, setECustomerHourlyRate] = useState(staff?.customerHourlyRate?.toString() || '');
  const [eInTime, setEInTime] = useState(staff?.inTime || '');
  const [eOutTime, setEOutTime] = useState(staff?.outTime || '');
  const [eIncentive, setEIncentive] = useState(staff?.incentivePerHour?.toString() || '');
  const [eUnderLabourSalary, setEUnderLabourSalary] = useState(staff?.underLabourSalary?.toString() || '');
  const [eUnderLabourOT, setEUnderLabourOT] = useState(staff?.underLabourOT?.toString() || '');
  const [ePerDayIncentive, setEPerDayIncentive] = useState(staff?.perDayIncentive?.toString() || '');

  if (!staff) return null;
  const supervisors = staffList.filter(s => s.role === 'supervisor' && s.id !== staff.id);

  const staffLogs = useMemo(
    () =>
      dailyLogs
        .filter(l => l.staffId === staffId && l.date >= fromDate && l.date <= toDate)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [dailyLogs, staffId, fromDate, toDate]
  );

  const grouped = useMemo(() => {
    const map: Record<string, typeof staffLogs> = {};
    staffLogs.forEach(l => {
      if (!map[l.date]) map[l.date] = [];
      map[l.date].push(l);
    });
    return map;
  }, [staffLogs]);

  const handleSaveEdit = () => {
    updateStaff(staffId, {
      name: eName,
      phone: ePhone,
      role: eRole,
      supervisorId: eRole === 'supervisor' || eRole === 'driver' || eRole === 'admin' ? undefined : eSupervisorId,
      salaryType: eSalaryType,
      perDaySalary: eSalaryType === 'daily' ? Number(ePerDaySalary) || 0 : 0,
      perHourSalary: eSalaryType === 'hourly' ? Number(ePerHourSalary) || 0 : 0,
      customerHourlyRate: eRole === 'driver' ? Number(eCustomerHourlyRate) || 0 : undefined,
      inTime: eInTime,
      outTime: eOutTime,
      incentivePerHour: Number(eIncentive) || 0,
      underLabourSalary: Number(eUnderLabourSalary) || 0,
      underLabourOT: Number(eUnderLabourOT) || 0,
      perDayIncentive: Number(ePerDayIncentive) || 0
    });
    toast.success('Staff updated!');
    setEditing(false);
  };

  const startEdit = () => {
    setEName(staff.name);
    setEPhone(staff.phone || '');
    setERole(staff.role || 'supervisor');
    setESupervisorId(staff.supervisorId || '');
    setESalaryType(staff.salaryType || 'daily');
    setEPerDaySalary(staff.perDaySalary?.toString() || '');
    setEPerHourSalary(staff.perHourSalary?.toString() || '');
    setECustomerHourlyRate(staff.customerHourlyRate?.toString() || '');
    setEInTime(staff.inTime || '');
    setEOutTime(staff.outTime || '');
    setEIncentive(staff.incentivePerHour?.toString() || '');
    setEUnderLabourSalary(staff.underLabourSalary?.toString() || '');
    setEUnderLabourOT(staff.underLabourOT?.toString() || '');
    setEPerDayIncentive(staff.perDayIncentive?.toString() || '');
    setEditing(v => !v);
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 rounded-xl text-xs font-semibold pl-2">
          ← Back
        </Button>
        <div className="flex-1">
          <h3 className="font-heading font-bold text-base">{staff.name}</h3>
          <p className="text-xs text-muted-foreground capitalize">{staff.role || 'Staff'}</p>
        </div>
        <button
          onClick={startEdit}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-border/60 flex items-center gap-1.5"
        >
          <PenLine className="w-3.5 h-3.5" /> Edit
        </button>
      </div>

      {/* Staff Salary & Info display */}
      {!editing && (
        <div className="form-card !py-3 space-y-2">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Salary Basis: </span>
              <span className="font-semibold capitalize">
                {staff.salaryType === 'hourly' ? 'Hourly-Based' : 'Day-Based'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Salary: </span>
              <span className="font-semibold">
                {staff.salaryType === 'hourly' ? `₹${staff.perHourSalary || 0}/hr` : `₹${staff.perDaySalary || 0}/day`}
              </span>
            </div>
            {staff.role === 'driver' && staff.customerHourlyRate !== undefined && (
              <div>
                <span className="text-muted-foreground">Customer Delivery Rate: </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{staff.customerHourlyRate || 0}/hr
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Timing: </span>
              <span className="font-semibold">
                {staff.inTime && staff.outTime ? `${staff.inTime} - ${staff.outTime}` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">1hr OT: </span>
              <span className="font-semibold">₹{staff.incentivePerHour || 0}</span>
            </div>
            {staff.role !== 'supervisor' && staff.role !== 'driver' && staff.supervisorId && (
              <div>
                <span className="text-muted-foreground">Supervisor: </span>
                <span className="font-semibold">
                  {staffList.find(s => s.id === staff.supervisorId)?.name || 'Unknown'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <div className="form-card space-y-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Edit Staff Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Name</Label>
              <Input value={eName} onChange={e => setEName(e.target.value)} className="mt-1 h-10 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Phone</Label>
              <Input value={ePhone} onChange={e => setEPhone(e.target.value)} className="mt-1 h-10 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Role</Label>
              <Select value={eRole} onValueChange={setERole}>
                <SelectTrigger className="mt-1 h-10 rounded-xl capitalize">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin / Management</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="driver">Driver (Admin Control)</SelectItem>
                  {labourTypes.map(lt => (
                    <SelectItem key={lt} value={lt}>{lt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {eRole !== 'supervisor' && eRole !== 'driver' && eRole !== 'admin' && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Assign Supervisor</Label>
                <Select value={eSupervisorId} onValueChange={setESupervisorId}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl">
                    <SelectValue placeholder="Select Supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {eRole !== 'driver' && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Salary Basis Option *</Label>
                <Select value={eSalaryType} onValueChange={(val: 'daily' | 'hourly') => setESalaryType(val)}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl">
                    <SelectValue placeholder="Select Basis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Day-Based Salary (₹/day)</SelectItem>
                    <SelectItem value="hourly">Hourly-Based Salary (₹/hr)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {eSalaryType === 'daily' || eRole === 'driver' ? (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Per Day Salary (₹)</Label>
                <Input
                  type="number"
                  value={ePerDaySalary}
                  onChange={e => setEPerDaySalary(e.target.value)}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>
            ) : (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Per Hour Salary (₹/hr)</Label>
                <Input
                  type="number"
                  value={ePerHourSalary}
                  onChange={e => setEPerHourSalary(e.target.value)}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>
            )}



            {eRole === 'supervisor' && (
              <>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Under-Labour Daily Salary (₹/day)</Label>
                  <Input
                    type="number"
                    value={eUnderLabourSalary}
                    onChange={e => setEUnderLabourSalary(e.target.value)}
                    className="mt-1 h-10 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Under-Labour OT Rate (₹/hr)</Label>
                  <Input
                    type="number"
                    value={eUnderLabourOT}
                    onChange={e => setEUnderLabourOT(e.target.value)}
                    className="mt-1 h-10 rounded-xl"
                  />
                </div>
              </>
            )}

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">1 Hour OT Rate (₹/hr)</Label>
              <Input
                type="number"
                value={eIncentive}
                onChange={e => setEIncentive(e.target.value)}
                className="mt-1 h-10 rounded-xl"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSaveEdit}
              className="flex-1 h-10 rounded-xl text-white font-semibold text-xs"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)} className="h-10 rounded-xl text-xs">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Date Range Logs Filter */}
      <div className="bg-card p-3 rounded-2xl border border-border/50 flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Log History:</span>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="h-8 w-32 rounded-lg text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="h-8 w-32 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Grouped Logs */}
      <div className="space-y-3">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-8 bg-card rounded-2xl border border-border/50 text-muted-foreground text-xs">
            No work logged by {staff.name} in this period.
          </div>
        ) : (
          Object.entries(grouped).map(([date, logs]) => (
            <div key={date} className="p-3.5 bg-card rounded-2xl border border-border/50 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-border/40 text-xs font-bold text-foreground">
                <span>{format(new Date(date + 'T00:00:00'), 'EEE, dd MMM yyyy')}</span>
                <span className="text-muted-foreground font-normal">{logs.length} entries</span>
              </div>
              {logs.map(log => (
                <div key={log.id} className="text-xs text-muted-foreground flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> {log.siteName}
                  </span>
                  {log.incomeFromClient > 0 && (
                    <span className="text-emerald-600 font-bold">+₹{log.incomeFromClient.toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ── Staff Tab Main Component ──────────────────────────────
export const StaffTab = () => {
  const { staffList, addStaff, deleteStaff, labourTypes } = useApp();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('supervisor');
  const [pass, setPass] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [salaryType, setSalaryType] = useState<'daily' | 'hourly'>('daily');
  const [perDaySalary, setPerDaySalary] = useState('');
  const [perHourSalary, setPerHourSalary] = useState('');
  const [customerHourlyRate, setCustomerHourlyRate] = useState('');
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [incentive, setIncentive] = useState('');
  const [underLabourSalary, setUnderLabourSalary] = useState('');
  const [underLabourOT, setUnderLabourOT] = useState('');
  const [perDayIncentive, setPerDayIncentive] = useState('');
  const [show, setShow] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [expandedSupervisors, setExpandedSupervisors] = useState<string[]>([]);
  const { t } = useTranslation();

  if (selectedStaffId) {
    return <StaffDetailView staffId={selectedStaffId} onBack={() => setSelectedStaffId(null)} />;
  }

  const supervisors = staffList.filter(s => s.role === 'supervisor');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name required'); return; }
    if (role !== 'supervisor' && role !== 'driver' && !supervisorId) {
      toast.error('Please assign a supervisor for this staff');
      return;
    }
    if (role === 'supervisor' && !pass.trim()) {
      toast.error('Password is required for Supervisors to log in');
      return;
    }

    addStaff({
      name,
      phone,
      role,
      password: (role === 'supervisor' || role === 'admin') ? pass : undefined,
      supervisorId: (role === 'supervisor' || role === 'driver' || role === 'admin') ? undefined : supervisorId,
      salaryType,
      perDaySalary: salaryType === 'daily' ? Number(perDaySalary) || 0 : 0,
      perHourSalary: salaryType === 'hourly' ? Number(perHourSalary) || 0 : 0,
      customerHourlyRate: role === 'driver' ? Number(customerHourlyRate) || 0 : undefined,
      inTime,
      outTime,
      incentivePerHour: Number(incentive) || 0,
      underLabourSalary: Number(underLabourSalary) || 0,
      underLabourOT: Number(underLabourOT) || 0,
      perDayIncentive: Number(perDayIncentive) || 0
    });

    toast.success('Staff added!');
    setName(''); setPhone(''); setRole('supervisor'); setPass(''); setSupervisorId('');
    setSalaryType('daily'); setPerDaySalary(''); setPerHourSalary(''); setCustomerHourlyRate('');
    setInTime(''); setOutTime(''); setIncentive('');
    setUnderLabourSalary(''); setUnderLabourOT(''); setPerDayIncentive(''); setShow(false);
  };

  const toggleSupervisor = (id: string) => {
    setExpandedSupervisors(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="section-header">{t('staff.staffAndSupervisors')}</h3>
        <Button
          size="sm"
          onClick={() => setShow(v => !v)}
          className="h-8 rounded-xl gap-1.5 text-xs font-semibold text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Staff
        </Button>
      </div>

      {show && (
        <div className="form-card">
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Full Name *</Label>
                <Input
                  placeholder="e.g. Ravi Kumar"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Phone</Label>
                <Input
                  placeholder="9876543210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Role *</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl capitalize text-xs">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin / Management</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="driver">Driver (Admin Control)</SelectItem>
                    <SelectItem value="labour">Labour</SelectItem>
                    <SelectItem value="electrician">Electrician</SelectItem>
                    <SelectItem value="painter">Painter</SelectItem>
                    <SelectItem value="plumber">Plumber</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {role !== 'supervisor' && role !== 'driver' && role !== 'admin' && (
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Assign Supervisor *</Label>
                  <Select value={supervisorId} onValueChange={setSupervisorId}>
                    <SelectTrigger className="mt-1 h-10 rounded-xl text-xs">
                      <SelectValue placeholder="Select Supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisors.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(role === 'supervisor' || role === 'admin') && (
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Login Password *</Label>
                  <Input
                    type="password"
                    placeholder="Set login password"
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>
              )}

              {role !== 'driver' && (
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Salary Basis Option *</Label>
                  <Select value={salaryType} onValueChange={(val: 'daily' | 'hourly') => setSalaryType(val)}>
                    <SelectTrigger className="mt-1 h-10 rounded-xl text-xs">
                      <SelectValue placeholder="Select Basis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Day-Based Salary (₹/day)</SelectItem>
                      <SelectItem value="hourly">Hourly-Based Salary (₹/hr)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {salaryType === 'daily' || role === 'driver' ? (
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Per Day Salary (₹)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 800"
                    value={perDaySalary}
                    onChange={e => setPerDaySalary(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-xs font-semibold"
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Per Hour Salary (₹/hr)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 100"
                    value={perHourSalary}
                    onChange={e => setPerHourSalary(e.target.value)}
                    className="mt-1 h-10 rounded-xl text-xs font-semibold"
                  />
                </div>
              )}



              {role === 'supervisor' && (
                <>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Under-Labour Daily Salary (₹/day)
                    </Label>
                    <Input
                      type="number"
                      placeholder="e.g. 500"
                      value={underLabourSalary}
                      onChange={e => setUnderLabourSalary(e.target.value)}
                      className="mt-1 h-10 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Under-Labour OT Rate (₹/hr)
                    </Label>
                    <Input
                      type="number"
                      placeholder="e.g. 65"
                      value={underLabourOT}
                      onChange={e => setUnderLabourOT(e.target.value)}
                      className="mt-1 h-10 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </>
              )}

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">1 Hour OT Rate (₹/hr)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 100"
                  value={incentive}
                  onChange={e => setIncentive(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl text-white font-bold text-xs shadow-sm mt-2"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              Save Staff Member
            </Button>
          </form>
        </div>
      )}

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {staffList.map(s => {
          const isSup = s.role === 'supervisor';
          const isDrv = s.role === 'driver';
          const isAdmin = s.role === 'admin';
          const assignedWorkers = staffList.filter(w => w.supervisorId === s.id);

          return (
            <Card
              key={s.id}
              className="p-5 rounded-3xl bg-card border border-border/60 hover:border-primary/50 shadow-luxury hover:shadow-luxury-lg hover:-translate-y-0.5 transition-all duration-300 space-y-3.5 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  onClick={() => setSelectedStaffId(s.id)}
                >
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-xs group-hover:scale-105 transition-transform ${
                      isAdmin ? 'bg-purple-600 shadow-xs' : isDrv ? 'bg-blue-600' : isSup ? 'bg-primary' : 'bg-muted-foreground/40'
                    }`}
                  >
                    {isAdmin ? <Shield className="w-5 h-5" /> : isDrv ? <Truck className="w-5 h-5" /> : <UserCircle className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-heading font-bold text-base text-foreground hover:text-primary transition-colors truncate">
                      {s.name}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-muted-foreground capitalize">{s.role}</p>
                      {isAdmin && (
                        <span className="bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                          ADMIN
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    deleteStaff(s.id);
                    toast.success('Staff member removed');
                  }}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-border/50 text-muted-foreground font-medium">
                <div>
                  Salary:{' '}
                  <strong className="text-foreground">
                    {s.salaryType === 'hourly' ? `₹${s.perHourSalary || 0}/hr` : `₹${s.perDaySalary || 0}/d`}
                  </strong>
                </div>
                <div>
                  OT Rate: <strong className="text-foreground">₹{s.incentivePerHour || 0}/hr</strong>
                </div>
              </div>

              {isSup && (
                <div className="pt-2 border-t border-border/50">
                  <div
                    className="flex items-center justify-between text-xs font-semibold cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => toggleSupervisor(s.id)}
                  >
                    <span>Assigned Crew ({assignedWorkers.length})</span>
                    {expandedSupervisors.includes(s.id) ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                  {expandedSupervisors.includes(s.id) && (
                    <div className="mt-2.5 space-y-1 bg-muted/40 p-3 rounded-2xl border border-border/40 text-xs">
                      {assignedWorkers.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic">No crew assigned</p>
                      ) : (
                        assignedWorkers.map(w => (
                          <div key={w.id} className="flex justify-between items-center py-1 border-b border-border/20 last:border-0">
                            <span className="font-semibold text-foreground">{w.name}</span>
                            <span className="text-[10px] text-muted-foreground capitalize">({w.role})</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default StaffTab;
