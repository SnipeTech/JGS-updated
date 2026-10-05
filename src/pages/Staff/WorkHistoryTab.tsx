import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Clock, MapPin, Users, Search, Layers, UserCheck } from 'lucide-react';
import { Staff } from '@/types';

interface WorkHistoryTabProps {
  staff: Staff | undefined;
}

export const WorkHistoryTab = ({ staff }: WorkHistoryTabProps) => {
  const { dailyLogs, staffList, currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const myLogs = dailyLogs
    .filter(l => {
      if (staff?.id) return l.staffId === staff.id;
      if (currentUser?.role === 'admin') return true;
      return l.staffId === currentUser?.id;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredLogs = myLogs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.siteName.toLowerCase().includes(term) ||
      log.date.includes(term) ||
      (log.notes && log.notes.toLowerCase().includes(term))
    );
  });

  return (
    <div className="animate-slide-up w-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <h2 className="section-header !mb-0">Work History</h2>
          <p className="text-xs text-muted-foreground">Historical records of your daily submitted work logs.</p>
        </div>
        {myLogs.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search site, date, notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-9 rounded-xl pl-8 text-xs"
            />
          </div>
        )}
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
          <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {searchTerm ? 'No logs match your search filter' : 'No work history logged yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLogs.map(log => (
            <Card key={log.id} className="list-card p-4">
              <div className="flex justify-between items-start mb-1.5">
                <div>
                  <p className="font-heading font-semibold text-sm flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    {log.siteName}
                  </p>
                  {log.transportCost && log.transportCost > 0 ? (
                    <p className="text-xs text-muted-foreground capitalize">
                      {log.transportMode || 'Transport'} &middot; &#8377;{log.transportCost}
                    </p>
                  ) : null}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2.5 py-0.5 rounded-full font-bold">
                  {log.date}
                </span>
              </div>

              {log.workLevelStage && (
                <div className="flex items-center gap-1.5 mb-1">
                  <Layers className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                    {log.workLevelStage}
                  </span>
                </div>
              )}

              {log.workerCounts && (log.workerCounts.painter > 0 || log.workerCounts.plumber > 0 || log.workerCounts.labour > 0) && (
                <div className="flex flex-wrap gap-1.5 mt-2 mb-1">
                  {log.workerCounts.painter > 0 && (
                    <div className="flex items-center gap-1 bg-muted/60 rounded-full px-2 py-0.5 border border-border/50">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold">{log.workerCounts.painter} Painters</span>
                    </div>
                  )}
                  {log.workerCounts.plumber > 0 && (
                    <div className="flex items-center gap-1 bg-muted/60 rounded-full px-2 py-0.5 border border-border/50">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold">{log.workerCounts.plumber} Plumbers</span>
                    </div>
                  )}
                  {log.workerCounts.labour > 0 && (
                    <div className="flex items-center gap-1 bg-muted/60 rounded-full px-2 py-0.5 border border-border/50">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold">{log.workerCounts.labour} Labourers</span>
                    </div>
                  )}
                </div>
              )}

              {/* Team Salary Breakdown */}
              {log.employeeSalaries && log.employeeSalaries.length > 0 ? (
                <div className="bg-blue-500/[0.06] rounded-xl p-2.5 mt-2 border border-blue-500/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-blue-700 dark:text-blue-300 font-bold tracking-wider uppercase flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Team Daily Salary ({log.employeeSalaries.length})
                    </span>
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                      &#8377;{log.employeeSalaries.reduce((s, e) => s + e.totalSalary, 0).toLocaleString()}
                    </span>
                  </div>
                  {log.employeeSalaries.map((emp, i) => (
                    <div key={i} className="flex justify-between items-center text-xs py-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="font-semibold">{emp.staffName}</span>
                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${emp.role === 'supervisor' ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300' : 'bg-violet-500/20 text-violet-700 dark:text-violet-300'}`}>
                          {emp.role}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {emp.isHalfDay ? '&#189; Day' : 'Full'}{emp.otHours > 0 ? ` +${emp.otHours}h OT` : ''}
                        </span>
                      </span>
                      <span className={`font-bold ${emp.role === 'supervisor' ? 'text-blue-700 dark:text-blue-300' : 'text-violet-700 dark:text-violet-300'}`}>
                        &#8377;{emp.totalSalary.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : log.supervisorSalary && log.supervisorSalary > 0 ? (
                <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-200 mt-2">
                  <span className="font-semibold flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" /> Supervisor Daily Salary
                  </span>
                  <span className="font-bold text-blue-700 dark:text-blue-300">&#8377;{log.supervisorSalary.toLocaleString()}</span>
                </div>
              ) : null}

              {((log.expenses && log.expenses.length > 0) || (log.transportCost && log.transportCost > 0)) && (
                <div className="bg-muted/40 rounded-xl p-2.5 mt-2">
                  <p className="text-[9px] text-muted-foreground font-bold tracking-wider uppercase mb-1">Expenses</p>
                  {log.expenses?.map((e, i) => (
                    <div key={i} className="flex justify-between text-xs py-0.5">
                      <span className="capitalize">{e.itemName}</span>
                      <span className="font-semibold text-destructive">&#8377;{e.amount}</span>
                    </div>
                  ))}
                  {log.transportCost && log.transportCost > 0 ? (
                    <div className="flex justify-between text-xs py-0.5">
                      <span className="capitalize">{log.transportMode || 'Transport'}</span>
                      <span className="font-semibold text-destructive">&#8377;{log.transportCost}</span>
                    </div>
                  ) : null}
                </div>
              )}

              {log.incomeFromClient > 0 && (
                <p className="text-xs text-success font-semibold mt-2 pt-1 border-t border-border/40">
                  Received from Client: &#8377;{log.incomeFromClient.toLocaleString()}
                </p>
              )}

              {log.notes && (
                <p className="text-xs text-muted-foreground italic mt-2 whitespace-pre-line">
                  "{log.notes}"
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkHistoryTab;
