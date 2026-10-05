import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import {
  LogOut, Send, Package,
  Clock, Users, CalendarDays, Wallet
} from 'lucide-react';
import { format } from 'date-fns';

// Modular Staff Tabs
import { WorkEntryTab } from './Staff/WorkEntryTab';
import { MaterialRequestTab } from './Staff/MaterialRequestTab';
import { WorkHistoryTab } from './Staff/WorkHistoryTab';
import { ThisWeekTab } from './Staff/ThisWeekTab';
import { StaffAttendanceTab } from './Staff/StaffAttendanceTab';
import { MySalaryTab } from './Staff/MySalaryTab';

const StaffDashboard = () => {
  const { logout, currentUser, staffList, sites, dailyLogs, attendances } = useApp();
  const staff = staffList.find(s => s.id === currentUser?.id) || staffList.find(s => s.role === 'supervisor') || staffList[0];
  const [activeLanguage, setActiveLanguage] = useState<'en' | 'ta' | 'hi'>('en');
  const [activeSection, setActiveSection] = useState<'log' | 'material_request' | 'history' | 'week' | 'team_attendance' | 'salary'>('log');
  const [activeSiteForMaterial, setActiveSiteForMaterial] = useState<string>('');

  useEffect(() => {
    // Check if there's an existing translation cookie to set initial active language state
    const cookieLang = document.cookie.split('; ').find(row => row.startsWith('googtrans='))?.split('=')[1];
    if (cookieLang) {
      const code = cookieLang.split('/').pop();
      if (code && ['en', 'ta', 'hi'].includes(code)) setActiveLanguage(code as any);
    }

    // Add Google Translate Script
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      document.body.appendChild(script);

      (window as any).googleTranslateElementInit = () => {
        new (window as any).google.translate.TranslateElement(
          { pageLanguage: 'en', includedLanguages: 'en,ta,hi', layout: (window as any).google.translate.TranslateElement.InlineLayout.SIMPLE },
          'google_translate_element'
        );
      };
    }
  }, []);

  const triggerTranslation = (langCode: 'en' | 'ta' | 'hi') => {
    setActiveLanguage(langCode);
    const selectElement = document.querySelector('.goog-te-combo') as HTMLSelectElement;
    if (selectElement) {
      selectElement.value = langCode;
      selectElement.dispatchEvent(new Event('change'));
    } else {
      // Fallback: set cookie and reload
      document.cookie = `googtrans=/en/${langCode}; path=/;`;
      window.location.reload();
    }
  };

  const isAdmin = currentUser?.role === 'admin' || staff?.role === 'admin';
  const isSupervisor = staff?.role === 'supervisor' || isAdmin;
  const isDriver = staff?.role === 'driver';

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const myTodayAtt = (attendances || []).find(a => a.staffId === staff?.id && a.date === todayStr);

  const mySites = useMemo(() => {
    // Only sites where this supervisor is assigned:
    // 1. As the site supervisor (supervisorId)
    // 2. In the site's assigned staff list
    // 3. In today's attendance (siteId)
    // 4. In today's team attendance crew site assignments
    const assigned = sites.filter(s =>
      s.supervisorId === staff?.id ||
      s.assignedStaffIds?.includes(staff?.id || '') ||
      myTodayAtt?.siteId === s.id ||
      myTodayAtt?.siteAssignments?.some(sa => sa.siteId === s.id)
    );
    if (assigned.length > 0) return assigned;
    // Fallback: If admin logged in without a specific supervisor, or if no sites assigned yet
    if (isAdmin && !staff?.id) return sites;
    return sites.filter(s => s.status === 'active');
  }, [sites, staff?.id, isAdmin, myTodayAtt]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const myTodayLogs = dailyLogs.filter(l => l.staffId === currentUser?.id && l.date === today);

  return (
    <div className="flex min-h-screen bg-background w-full">
      {/* ── Desktop Luxury Sidebar ── */}
      <aside className="hidden md:flex flex-col w-72 bg-[#121110] text-zinc-100 border-r border-amber-950/40 px-4 py-6 fixed h-full z-50 shadow-2xl">
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 mb-8 px-2 pb-5 border-b border-zinc-800/80">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-lg shrink-0 overflow-hidden border border-white/20">
            <img src="/jgs-logo.png" alt="JGS Construction" className="w-full h-full object-contain scale-[1.7]" />
          </div>
          <div>
            <h1 className="text-lg font-heading font-extrabold tracking-tight text-white leading-none">
              JGS CONSTRUCTION
            </h1>
            <p className="text-[9px] font-bold text-amber-400/90 tracking-[0.22em] uppercase mt-1">
              Field & Staff Portal
            </p>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex flex-col gap-1.5 overflow-y-auto pr-1">
          {[
            { id: 'log' as const, label: 'Work Entry', icon: <Send className="w-4 h-4" />, show: true },
            { id: 'material_request' as const, label: 'Material Request', icon: <Package className="w-4 h-4" />, show: true },
            { id: 'history' as const, label: 'Work History', icon: <Clock className="w-4 h-4" />, show: true },
            { id: 'week' as const, label: 'This Week Overview', icon: <CalendarDays className="w-4 h-4" />, show: true },
            { id: 'team_attendance' as const, label: 'Team Attendance', icon: <Users className="w-4 h-4" />, show: isSupervisor },
            { id: 'salary' as const, label: 'My Salary & Earnings', icon: <Wallet className="w-4 h-4" />, show: true },
          ].filter(item => item.show).map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
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
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_hsl(38_78%_50%)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer / User Profile & Language Switcher */}
        <div className="mt-auto pt-4 border-t border-zinc-800/80 space-y-3">
          {/* Custom Language Switcher (Triggers hidden Google Translate) */}
          <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
            <button onClick={() => triggerTranslation('en')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-colors ${activeLanguage === 'en' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-400 hover:text-zinc-300'}`}>EN</button>
            <button onClick={() => triggerTranslation('ta')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-colors ${activeLanguage === 'ta' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-400 hover:text-zinc-300'}`}>TA</button>
            <button onClick={() => triggerTranslation('hi')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-colors ${activeLanguage === 'hi' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-400 hover:text-zinc-300'}`}>HI</button>
          </div>
          {/* Hidden Google Translate Native Element */}
          <div id="google_translate_element" className="hidden"></div>

          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-heading font-bold text-white text-xs shadow-md uppercase">
              {staff?.name?.slice(0, 2) || 'ST'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-heading font-bold text-zinc-100 truncate">{staff?.name || 'Staff Member'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-amber-400 font-semibold capitalize truncate">
                  {staff?.role || 'Staff'}
                </span>
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
          {/* Mobile Header */}
          <div className="flex md:hidden items-center justify-between mb-4 p-3 rounded-2xl bg-[#121110] text-zinc-100 border border-amber-950/40 shadow-lg animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-md overflow-hidden shrink-0">
                <img src="/jgs-logo.png" alt="JGS Construction" className="w-full h-full object-contain scale-[1.7]" />
              </div>
              <div>
                <h1 className="text-base font-heading font-bold text-white leading-tight">Hi, {staff?.name || 'Staff'}</h1>
                <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">{format(new Date(), 'EEEE, dd MMM')}</p>
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

          {/* Desktop Header Banner */}
          <div className="hidden md:flex items-center justify-between mb-8 pb-5 border-b border-border/60 animate-slide-up">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                <span>Field Portal</span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-primary font-bold capitalize">{staff?.role || 'Staff Member'}</span>
              </div>
              <h2 className="text-3xl font-heading font-extrabold text-foreground tracking-tight">
                Welcome back, {staff?.name || 'Staff'} 👋
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
                Active Session
              </div>
            </div>
          </div>

          {/* Today summary indicator */}
          {activeSection === 'log' && (
            <div className="flex items-center gap-3.5 mb-6 animate-slide-up-delay-1 bg-gradient-to-r from-amber-500/10 via-card to-card border border-amber-500/30 rounded-2xl p-4 shadow-luxury w-full">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                style={{ background: 'hsl(38 78% 45% / 0.18)' }}
              >
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Today's Activity Status</p>
                <p className="text-lg font-heading font-bold text-foreground">
                  {myTodayLogs.length} {myTodayLogs.length === 1 ? 'Submission Recorded' : 'Submissions Recorded'}
                </p>
              </div>
              <div className="ml-auto">
                <span
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-full border ${myTodayLogs.length > 0
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-muted text-muted-foreground border-border'
                    }`}
                >
                  {myTodayLogs.length > 0 ? '✓ Active Today' : 'Pending Entry'}
                </span>
              </div>
            </div>
          )}

          {/* Mobile Section Tabs (Pill selector) */}
          <div className="flex md:hidden gap-1.5 mb-5 bg-[#121110] p-1.5 rounded-2xl animate-slide-up-delay-2 overflow-x-auto no-scrollbar border border-amber-950/40">
            {[
              { id: 'log' as const, label: 'Work', icon: <Send className="w-3.5 h-3.5" />, show: true },
              { id: 'material_request' as const, label: 'Materials', icon: <Package className="w-3.5 h-3.5" />, show: true },
              { id: 'history' as const, label: 'History', icon: <Clock className="w-3.5 h-3.5" />, show: true },
              { id: 'week' as const, label: 'Week', icon: <CalendarDays className="w-3.5 h-3.5" />, show: true },
              { id: 'team_attendance' as const, label: 'Team', icon: <Users className="w-3.5 h-3.5" />, show: isSupervisor },
              { id: 'salary' as const, label: 'Salary', icon: <Wallet className="w-3.5 h-3.5" />, show: true },
            ].filter(item => item.show).map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 ${activeSection === id
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Modular Section Rendering */}
          <main>
            {activeSection === 'log' && (
              <WorkEntryTab
                staff={staff}
                mySites={mySites}
                onNavigateToMaterialRequest={(siteId) => {
                  setActiveSiteForMaterial(siteId || '');
                  setActiveSection('material_request');
                }}
                onNavigateToAttendance={() => setActiveSection('team_attendance')}
              />
            )}
            {activeSection === 'material_request' && <MaterialRequestTab staff={staff} mySites={mySites} initialSiteId={activeSiteForMaterial} />}
            {activeSection === 'history' && <WorkHistoryTab staff={staff} />}
            {activeSection === 'week' && <ThisWeekTab staff={staff} />}
            {activeSection === 'team_attendance' && <StaffAttendanceTab staff={staff} />}
            {activeSection === 'salary' && <MySalaryTab staff={staff} />}
          </main>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
