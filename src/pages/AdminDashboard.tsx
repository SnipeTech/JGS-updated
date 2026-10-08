import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import {
  LogOut, LayoutDashboard, MapPin, Users, CalendarDays,
  UserCircle, FileText, BarChart3, Wallet, Package,
  ChevronRight, ArrowLeftRight, ShieldCheck, Sparkles, Truck, Receipt
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Modular Admin Tabs
import { DashboardOverviewTab } from './Admin/DashboardOverviewTab';
import { SitesTab } from './Admin/SitesTab';
import { StaffTab } from './Admin/StaffTab';
import { AttendanceTab } from './Admin/AttendanceTab';
import { SupervisorExpensesAdminTab } from './Admin/SupervisorExpensesAdminTab';
import { CustomersTab } from './Admin/CustomersTab';
import { ReportsTab } from './Admin/ReportsTab';
import { PayrollTab } from './Admin/PayrollTab';
import { MaterialsSuppliersTab } from './Admin/MaterialsSuppliersTab';
import { VehiclesTab } from './Admin/VehiclesTab';
import { SettingsTab } from './Admin/SettingsTab';

export type TabId =
  | 'dashboard'
  | 'sites'
  | 'materials'
  | 'vehicles'
  | 'staff'
  | 'attendance'
  | 'supervisor_expenses'
  | 'customers'
  | 'reports'
  | 'payroll'
  | 'settings';

export const ALL_NAV_ITEMS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'sites', label: 'Sites', icon: <MapPin className="w-4 h-4" /> },
  { id: 'supervisor_expenses', label: 'Supervisor Expenses', icon: <Receipt className="w-4 h-4" /> },
  { id: 'materials', label: 'Materials & Suppliers', icon: <Package className="w-4 h-4" /> },
  { id: 'vehicles', label: 'Vehicles & Fuel', icon: <Truck className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings & Master Data', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'payroll', label: 'Payroll & Salaries', icon: <Wallet className="w-4 h-4" /> },
  { id: 'staff', label: 'Staff Management', icon: <Users className="w-4 h-4" /> },
  { id: 'attendance', label: 'Attendance', icon: <CalendarDays className="w-4 h-4" /> },
  { id: 'customers', label: 'Clients & Customers', icon: <UserCircle className="w-4 h-4" /> },
  { id: 'reports', label: 'Reports & Ledger', icon: <BarChart3 className="w-4 h-4" /> },
];

const AdminDashboard = () => {
  const { logout, currentUser, isBackendConnected, stageCompletionRequests, materialRequests, attendances } = useApp();
  const [activeTab, setActiveTabState] = useState<TabId>(() => {
    const saved = sessionStorage.getItem('jgs_admin_active_tab') as TabId | null;
    return (saved && ALL_NAV_ITEMS.some(n => n.id === saved)) ? saved : 'dashboard';
  });

  const setActiveTab = (tab: TabId) => {
    sessionStorage.setItem('jgs_admin_active_tab', tab);
    setActiveTabState(tab);
  };
  const { i18n } = useTranslation();

  const pendingMilestoneReviews = useMemo(() => {
    return (stageCompletionRequests || []).filter(r => r.status === 'pending').length;
  }, [stageCompletionRequests]);

  const pendingMaterialRequests = useMemo(() => {
    return (materialRequests || []).filter(r => r.status === 'pending').length;
  }, [materialRequests]);

  const pendingSupervisorExpenses = useMemo(() => {
    return (attendances || []).filter(a =>
      Number(a.expenseAmount) > 0 &&
      (!a.expenseStatus || a.expenseStatus === 'pending')
    ).length;
  }, [attendances]);

  useEffect(() => {
    // Force English language for i18n in Admin Portal
    if (i18n.language !== 'en') {
      i18n.changeLanguage('en');
    }

    // Strictly disable translations on the admin portal
    const cookieLang = document.cookie.split('; ').find(row => row.startsWith('googtrans='))?.split('=')[1];
    if (cookieLang && cookieLang !== '/en/en') {
      document.cookie = 'googtrans=/en/en; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
      window.location.reload();
    }
  }, []);

  const NAV_ITEMS = useMemo(() => {
    return ALL_NAV_ITEMS.filter(item => {
      if (currentUser?.id === 'admin') return true; // Superadmin always has full access
      if (Array.isArray(currentUser?.adminPermissions)) {
        return currentUser.adminPermissions.includes(item.id);
      }
      return true; // Default all access if permissions array not set
    });
  }, [currentUser?.id, currentUser?.adminPermissions]);

  // Automatically adjust activeTab only if user permissions explicitly forbid it
  useEffect(() => {
    if (currentUser?.id !== 'admin' && Array.isArray(currentUser?.adminPermissions) && currentUser.adminPermissions.length > 0) {
      if (NAV_ITEMS.length > 0 && !NAV_ITEMS.some(n => n.id === activeTab)) {
        setActiveTab(NAV_ITEMS[0].id);
      }
    }
  }, [NAV_ITEMS, activeTab, currentUser?.id, currentUser?.adminPermissions]);

  const renderTab = () => {
    if (currentUser?.id !== 'admin' && Array.isArray(currentUser?.adminPermissions) && !NAV_ITEMS.some(n => n.id === activeTab)) {
      return (
        <div className="p-8 text-center bg-card rounded-3xl border border-border/60 max-w-md mx-auto my-12 space-y-3">
          <ShieldCheck className="w-12 h-12 text-destructive mx-auto" />
          <h3 className="font-bold text-lg text-foreground">Access Restricted</h3>
          <p className="text-xs text-muted-foreground">You do not have permission to access this section. Please contact the administrator.</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverviewTab />;
      case 'sites':
        return <SitesTab />;
      case 'supervisor_expenses':
        return <SupervisorExpensesAdminTab />;
      case 'staff':
        return <StaffTab />;
      case 'attendance':
        return <AttendanceTab />;
      case 'customers':
        return <CustomersTab />;
      case 'reports':
        return <ReportsTab />;
      case 'payroll':
        return <PayrollTab />;
      case 'materials':
        return <MaterialsSuppliersTab />;
      case 'vehicles':
        return <VehiclesTab />;
      case 'settings':
        return <SettingsTab />;
    }
  };

  const currentNav = NAV_ITEMS.find(n => n.id === activeTab);

  return (
    <div className="notranslate flex min-h-screen bg-background w-full">
      {/* ── Desktop Luxury Sidebar ── */}
      <aside className="hidden md:flex flex-col w-72 bg-[#121110] text-zinc-100 border-r border-amber-950/40 px-4 py-6 fixed h-full z-50 shadow-2xl">
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 mb-8 px-2 pb-5 border-b border-zinc-800/80">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-lg shrink-0 overflow-hidden border border-white/20">
            <img src="/jgs-logo.png" alt="JGS Construction" className="w-full h-full object-contain scale-[1.7]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-heading font-extrabold tracking-tight text-white leading-none">
                JGS CONSTRUCTION
              </h1>
            </div>
            <p className="text-[9px] font-bold text-amber-400/90 tracking-[0.22em] uppercase mt-1">
              Construction & Interiors
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
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm group ${isActive
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
                <div className="flex items-center gap-1.5">
                  {item.id === 'sites' && pendingMilestoneReviews > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500 text-white animate-pulse shadow-xs">
                      {pendingMilestoneReviews}
                    </span>
                  )}
                  {item.id === 'supervisor_expenses' && pendingSupervisorExpenses > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse shadow-xs">
                      {pendingSupervisorExpenses}
                    </span>
                  )}
                  {item.id === 'materials' && pendingMaterialRequests > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse shadow-xs">
                      {pendingMaterialRequests}
                    </span>
                  )}
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_hsl(38_78%_50%)]" />
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer / User Profile */}
        <div className="mt-auto pt-4 border-t border-zinc-800/80 space-y-3">
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-heading font-bold text-white text-xs shadow-md">
              {currentUser?.name ? currentUser.name.slice(0, 3).toUpperCase() : 'JGS'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-heading font-bold text-zinc-100 truncate">
                {currentUser?.name || 'JGS'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-zinc-400 font-medium">Administrator</span>
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
      <div className="flex-1 md:ml-72 flex flex-col min-w-0 h-[100dvh] overflow-y-auto pb-20 md:pb-0">
        <div className="page-container flex-1">
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="flex md:hidden items-center justify-between mb-5 p-3 rounded-2xl bg-[#121110] text-zinc-100 border border-amber-950/40 shadow-lg animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-md overflow-hidden shrink-0">
                <img src="/jgs-logo.png" alt="JGS Construction" className="w-full h-full object-contain scale-[1.7]" />
              </div>
              <div>
                <h1 className="text-base font-heading font-bold text-white leading-tight">JGS CONSTRUCTION</h1>
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
              {isBackendConnected ? (
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-2 rounded-2xl" title="Django REST + PostgreSQL Connected">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  PostgreSQL Online
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold px-3 py-2 rounded-2xl" title="Connecting to Django backend">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Connecting...
                </div>
              )}
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
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${isActive
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.id === 'sites' && pendingMilestoneReviews > 0 && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  )}
                  {item.id === 'supervisor_expenses' && pendingSupervisorExpenses > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                  {item.id === 'materials' && pendingMaterialRequests > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
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
