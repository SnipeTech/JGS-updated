import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import {
  LogOut, LayoutDashboard, MapPin, Users, CalendarDays,
  UserCircle, FileText, BarChart3, Wallet, Package, Sofa,
  ShieldCheck, Sparkles, ChevronRight
} from 'lucide-react';

// Modular Admin Tabs
import { DashboardOverviewTab } from './Admin/DashboardOverviewTab';
import { SitesTab } from './Admin/SitesTab';
import { StaffTab } from './Admin/StaffTab';
import { AttendanceTab } from './Admin/AttendanceTab';
import { CustomersTab } from './Admin/CustomersTab';
import { InvoicesTab } from './Admin/InvoicesTab';
import { ReportsTab } from './Admin/ReportsTab';
import { PayrollTab } from './Admin/PayrollTab';
import { MaterialsSuppliersTab } from './Admin/MaterialsSuppliersTab';

export type TabId =
  | 'dashboard'
  | 'sites'
  | 'staff'
  | 'attendance'
  | 'customers'
  | 'invoices'
  | 'reports'
  | 'payroll'
  | 'settings';

export const NAV_ITEMS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'sites', label: 'Sites', icon: <MapPin className="w-4 h-4" /> },
  { id: 'settings', label: 'Materials & Suppliers', icon: <Package className="w-4 h-4" /> },
  { id: 'payroll', label: 'Payroll & Salaries', icon: <Wallet className="w-4 h-4" /> },
  { id: 'staff', label: 'Staff Management', icon: <Users className="w-4 h-4" /> },
  { id: 'attendance', label: 'Attendance', icon: <CalendarDays className="w-4 h-4" /> },
  { id: 'customers', label: 'Clients & Customers', icon: <UserCircle className="w-4 h-4" /> },
  { id: 'invoices', label: 'Invoicing', icon: <FileText className="w-4 h-4" /> },
  { id: 'reports', label: 'Reports & Ledger', icon: <BarChart3 className="w-4 h-4" /> },
];

const AdminDashboard = () => {
  const { logout } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverviewTab />;
      case 'sites':
        return <SitesTab />;
      case 'staff':
        return <StaffTab />;
      case 'attendance':
        return <AttendanceTab />;
      case 'customers':
        return <CustomersTab />;
      case 'invoices':
        return <InvoicesTab />;
      case 'reports':
        return <ReportsTab />;
      case 'payroll':
        return <PayrollTab />;
      case 'settings':
        return <MaterialsSuppliersTab />;
    }
  };

  const currentNav = NAV_ITEMS.find(n => n.id === activeTab);

  return (
    <div className="flex min-h-screen bg-background w-full">
      {/* ── Desktop Luxury Sidebar ── */}
      <aside className="hidden md:flex flex-col w-72 bg-[#121110] text-zinc-100 border-r border-amber-950/40 px-4 py-6 fixed h-full z-50 shadow-2xl">
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 mb-8 px-2 pb-5 border-b border-zinc-800/80">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shrink-0 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, hsl(38 78% 45%), hsl(30 88% 52%))' }}
          >
            <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]" />
            <Sofa className="w-6 h-6 text-white relative z-10" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-heading font-extrabold tracking-tight text-white leading-none">
                JGS INTERIOR
              </h1>
            </div>
            <p className="text-[9px] font-bold text-amber-400/90 tracking-[0.22em] uppercase mt-1">
              Architecture & Studio
            </p>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex flex-col gap-1.5 overflow-y-auto pr-1">
          {NAV_ITEMS.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm group ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-amber-300 font-bold border border-amber-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 font-medium hover:translate-x-0.5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`transition-colors ${isActive ? 'text-amber-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_hsl(38_78%_50%)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer / User Profile */}
        <div className="mt-auto pt-4 border-t border-zinc-800/80 space-y-3">
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-heading font-bold text-white text-xs shadow-md">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-heading font-bold text-zinc-100 truncate">Administrator</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-zinc-400 font-medium">System Lead</span>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            className="w-full flex items-center justify-center gap-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-zinc-800/60 text-xs font-semibold py-2.5 transition-all"
            onClick={logout}
          >
            <LogOut className="w-3.5 h-3.5" /> Log Out
          </Button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 md:ml-72 flex flex-col min-w-0">
        <div className="page-container flex-1 py-6 px-4 md:px-8">
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="flex md:hidden items-center justify-between mb-5 p-3 rounded-2xl bg-[#121110] text-zinc-100 border border-amber-950/40 shadow-lg animate-slide-up">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                style={{ background: 'linear-gradient(135deg, hsl(38 78% 45%), hsl(30 88% 52%))' }}
              >
                <Sofa className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-heading font-bold text-white leading-tight">JGS INTERIOR</h1>
                <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">{currentNav?.label}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 h-9 w-9"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>

          {/* Desktop Tab Header Banner */}
          <div className="hidden md:flex items-center justify-between mb-8 pb-5 border-b border-border/60 animate-slide-up">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                <span>Admin Workspace</span>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-primary">{currentNav?.label}</span>
              </div>
              <h2 className="text-3xl font-heading font-extrabold text-foreground tracking-tight">
                {currentNav?.label}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-card border border-border/60 rounded-2xl px-3.5 py-2 shadow-xs">
                <CalendarDays className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  {format(new Date(), 'EEEE, dd MMMM yyyy')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-2 rounded-2xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Studio Live
              </div>
            </div>
          </div>

          {/* Active Tab View */}
          <main className="min-w-0">{renderTab()}</main>
        </div>

        {/* Bottom Navigation (Mobile Only) */}
        <div className="bottom-nav">
          <div className="flex items-center overflow-x-auto no-scrollbar px-2 py-2 gap-1">
            {NAV_ITEMS.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
