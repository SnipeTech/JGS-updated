import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { CalendarDays, MapPin, UserCircle, Users } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { Staff } from '@/types';

interface ThisWeekTabProps {
  staff: Staff | undefined;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const ThisWeekTab = ({ staff }: ThisWeekTabProps) => {
  const { dailyLogs, attendances, staffList, currentUser } = useApp();

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDates = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
  const today = format(new Date(), 'yyyy-MM-dd');

  const myLogs = dailyLogs.filter(l => l.staffId === (staff?.id || currentUser?.id));

  return (
    <div className="animate-slide-up w-full max-w-3xl">
      <div className="mb-4">
        <h2 className="section-header !mb-0.5">This Week (Mon–Sat)</h2>
        <p className="text-xs text-muted-foreground">Overview of work logs and site manpower across this work week.</p>
      </div>

      {/* Week Day Pills */}
      <div className="grid grid-cols-6 gap-1.5 mb-5 bg-card p-3 rounded-2xl border border-border/50 shadow-xs">
        {weekDates.map((date, i) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isToday = dateStr === today;
          const logsOnDay = myLogs.filter(l => l.date === dateStr);
          const hasLog = logsOnDay.length > 0;

          return (
            <div key={i} className="flex flex-col items-center">
              <p className="text-[10px] text-muted-foreground font-semibold mb-1.5 uppercase tracking-wider">
                {DAYS[i]}
              </p>
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-bold transition-all ${
                  isToday
                    ? 'text-white shadow-md ring-2 ring-primary/30'
                    : hasLog
                    ? 'text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
                style={
                  isToday
                    ? { background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }
                    : hasLog
                    ? { background: 'hsl(152 55% 35%)' }
                    : {}
                }
              >
                {format(date, 'd')}
              </div>
              <div
                className={`mt-1.5 w-1.5 h-1.5 rounded-full ${
                  hasLog ? 'bg-emerald-500' : 'bg-transparent'
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Daily Logs Breakdown */}
      <div className="space-y-4">
        {weekDates.map((date, i) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const logsOnDay = myLogs.filter(l => l.date === dateStr);
          if (logsOnDay.length === 0) return null;

          return (
            <div key={i} className="space-y-2">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-primary" />
                {DAYS[i]}, {format(date, 'dd MMM yyyy')}
              </p>

              {logsOnDay.map(log => {
                return (
                  <Card key={log.id} className="list-card p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-heading font-semibold text-sm flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        {log.siteName}
                      </p>
                      {log.incomeFromClient > 0 && (
                        <span className="text-xs text-emerald-600 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                          +₹{log.incomeFromClient.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/50">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Staff on Site
                        </p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <UserCircle className="w-3.5 h-3.5 text-primary" />
                            <span>
                              {log.staffName}{' '}
                              <span className="text-[10px] text-muted-foreground font-bold">
                                (Supervisor)
                              </span>
                            </span>
                          </div>
                          {log.workerCounts && (log.workerCounts.painter > 0 || log.workerCounts.plumber > 0 || log.workerCounts.labour > 0) && (
                            <div className="flex flex-col gap-0.5 mt-1 text-xs text-muted-foreground bg-muted/40 p-1.5 rounded-lg">
                              {log.workerCounts.painter > 0 && (
                                <span>• {log.workerCounts.painter} Painters</span>
                              )}
                              {log.workerCounts.plumber > 0 && (
                                <span>• {log.workerCounts.plumber} Plumbers</span>
                              )}
                              {log.workerCounts.labour > 0 && (
                                <span>• {log.workerCounts.labour} Labourers</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Materials Logged
                        </p>
                        {log.materials.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No materials logged</p>
                        ) : (
                          <div className="space-y-1 bg-muted/30 p-2 rounded-lg">
                            {log.materials.map((m, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs py-0.5">
                                <span className="truncate pr-2 font-medium">{m.name}</span>
                                <span className="font-semibold tabular-nums shrink-0 text-primary">
                                  × {m.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          );
        })}

        {weekDates.every(
          date => myLogs.filter(l => l.date === format(date, 'yyyy-MM-dd')).length === 0
        ) && (
          <div className="text-center py-10 bg-card rounded-2xl border border-border/50">
            <CalendarDays className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-medium">No work logged this week yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThisWeekTab;
