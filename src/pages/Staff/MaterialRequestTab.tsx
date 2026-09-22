import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Package, MapPin, Plus, Trash2, ArrowRightLeft, Building2,
  Clock, Truck, CheckCircle2, AlertCircle, Send, StickyNote
} from 'lucide-react';
import { MaterialRequestItem, Site, Staff } from '@/types';
import { calculateDuration, getSiteAvailableStock } from '@/lib/utils';

interface MaterialRequestTabProps {
  staff: Staff | undefined;
  mySites: Site[];
  initialSiteId?: string;
}

export const MaterialRequestTab = ({ staff, mySites, initialSiteId }: MaterialRequestTabProps) => {
  const { sites, materialSettings, materialRequests, dailyLogs, addMaterialRequest } = useApp();

  const [reqSiteId, setReqSiteId] = useState(initialSiteId || '');
  const [reqSourceType, setReqSourceType] = useState<'supplier' | 'site'>('supplier');
  const [reqSourceSiteId, setReqSourceSiteId] = useState('');
  const [reqItems, setReqItems] = useState<MaterialRequestItem[]>([
    { name: '', quantity: 1, unit: 'Bags' }
  ]);
  const [reqNotes, setReqNotes] = useState('');
  const [reqStatusFilter, setReqStatusFilter] = useState<'all' | 'pending' | 'assigned' | 'completed'>('all');

  const destinationReqSiteId = reqSiteId || (mySites.length > 0 ? mySites[0].id : (sites[0]?.id || ''));

  // Other sites available as source
  const otherSites = useMemo(() => {
    return sites.filter(s => s.id !== destinationReqSiteId);
  }, [sites, destinationReqSiteId]);

  // Sites that strictly have available material stock
  const sourceSitesWithStock = useMemo(() => {
    return otherSites.filter(s => {
      const stock = getSiteAvailableStock(s.id, materialRequests, dailyLogs, materialSettings);
      return stock.length > 0;
    });
  }, [otherSites, materialRequests, dailyLogs, materialSettings]);

  const effectiveSourceSiteId = useMemo(() => {
    if (reqSourceSiteId && otherSites.some(s => s.id === reqSourceSiteId)) {
      return reqSourceSiteId;
    }
    return sourceSitesWithStock[0]?.id || (otherSites[0]?.id || '');
  }, [reqSourceSiteId, otherSites, sourceSitesWithStock]);

  const sourceAvailableStock = useMemo(() => {
    if (!effectiveSourceSiteId) return [];
    return getSiteAvailableStock(effectiveSourceSiteId, materialRequests, dailyLogs, materialSettings);
  }, [effectiveSourceSiteId, materialRequests, dailyLogs, materialSettings]);

  useEffect(() => {
    if (reqSourceType === 'site' && effectiveSourceSiteId) {
      if (reqSourceSiteId !== effectiveSourceSiteId) {
        setReqSourceSiteId(effectiveSourceSiteId);
      }
      const stock = getSiteAvailableStock(effectiveSourceSiteId, materialRequests, dailyLogs, materialSettings);
      if (stock.length > 0) {
        setReqItems(prev => {
          if (prev.length === 1 && (!prev[0].name || !prev[0].name.trim())) {
            const first = stock[0];
            return [{
              name: first.name,
              quantity: Math.min(1, first.qty),
              unit: first.unit,
              rate: first.rate,
              amount: Math.min(1, first.qty) * first.rate,
              maxAvailable: first.qty
            }];
          }
          return prev;
        });
      }
    }
  }, [reqSourceType, effectiveSourceSiteId, reqSourceSiteId, materialRequests, dailyLogs, materialSettings]);

  const handleAddReqItem = () => {
    if (reqSourceType === 'site') {
      const unusedStock = sourceAvailableStock.find(st => !reqItems.some(item => item.name === st.name));
      const chosen = unusedStock || sourceAvailableStock[0];
      if (chosen) {
        setReqItems(prev => [
          ...prev,
          {
            name: chosen.name,
            quantity: Math.min(1, chosen.qty),
            unit: chosen.unit,
            rate: chosen.rate,
            amount: Math.min(1, chosen.qty) * chosen.rate,
            maxAvailable: chosen.qty
          }
        ]);
        return;
      }
    }
    setReqItems(prev => [...prev, { name: '', quantity: 1, unit: 'Bags' }]);
  };

  const handleRemoveReqItem = (index: number) => {
    if (reqItems.length === 1) {
      setReqItems([{ name: '', quantity: 1, unit: 'Bags' }]);
      return;
    }
    setReqItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateReqItem = (index: number, field: keyof MaterialRequestItem, value: any) => {
    setReqItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === 'name' && reqSourceType === 'site') {
        const found = sourceAvailableStock.find(s => s.name === value);
        if (found) {
          updated.unit = found.unit;
          updated.rate = found.rate;
          updated.maxAvailable = found.qty;
          if (Number(updated.quantity) > found.qty) {
            updated.quantity = found.qty;
          }
          updated.amount = (Number(updated.quantity) || 0) * found.rate;
        }
      }
      return updated;
    }));
  };

  const handleSubmitMaterialRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSiteId = reqSiteId || (mySites.length > 0 ? mySites[0].id : (sites[0]?.id || ''));
    const targetSite = sites.find(s => s.id === finalSiteId);
    const sourceSite = reqSourceType === 'site' ? sites.find(s => s.id === effectiveSourceSiteId) : undefined;

    if (!targetSite) {
      toast.error('Please select a valid destination site');
      return;
    }
    if (reqSourceType === 'site' && !sourceSite) {
      toast.error('Please select a valid source site with available stock');
      return;
    }

    const validItems = reqItems.filter(i => i.name.trim() && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      toast.error('Please enter at least one material item with a valid quantity');
      return;
    }

    if (reqSourceType === 'site') {
      for (const item of validItems) {
        const stockItem = sourceAvailableStock.find(s => s.name === item.name);
        if (!stockItem || Number(item.quantity) > stockItem.qty) {
          toast.error(`Cannot request ${item.quantity} ${item.unit} of "${item.name}". Only ${stockItem?.qty || 0} available at ${sourceSite?.name}.`);
          return;
        }
      }
    }

    addMaterialRequest({
      siteId: targetSite.id,
      siteName: targetSite.name,
      requestedByStaffId: staff?.id || '',
      requestedByStaffName: staff?.name || 'Staff Member',
      sourceType: reqSourceType,
      sourceSiteId: reqSourceType === 'site' ? sourceSite?.id : undefined,
      sourceSiteName: reqSourceType === 'site' ? sourceSite?.name : undefined,
      items: validItems.map(i => ({
        name: i.name.trim(),
        quantity: Number(i.quantity),
        unit: i.unit?.trim() || 'Units',
        rate: i.rate,
        amount: i.rate ? i.rate * Number(i.quantity) : undefined
      })),
      notes: (reqSourceType === 'site' ? `[Inter-Site Transfer from ${sourceSite?.name}] ` : '') + (reqNotes.trim() || ''),
      status: 'pending',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'hh:mm a')
    });

    toast.success(reqSourceType === 'site' 
      ? `Inter-site material transfer request submitted to Admin!` 
      : 'Material requisition submitted to Admin!'
    );
    setReqItems([{ name: '', quantity: 1, unit: 'Bags' }]);
    setReqNotes('');
  };

  return (
    <div className="animate-slide-up-delay-2 max-w-3xl space-y-6">
      {/* Requisition Creation Card */}
      <div className="form-card">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}>
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-heading font-bold leading-tight">Material Requisition</h2>
            <p className="text-xs text-muted-foreground">Submit required materials to Admin for supplier and driver dispatch.</p>
          </div>
        </div>

        <form onSubmit={handleSubmitMaterialRequest} className="space-y-4">
          {/* Requisition Source Type: Supplier vs Another Site */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5" /> Requisition Source
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => {
                  setReqSourceType('supplier');
                  setReqItems([{ name: '', quantity: 1, unit: 'Bags' }]);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  reqSourceType === 'supplier'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="w-4 h-4" /> Order from Supplier / New Purchase
              </button>
              <button
                type="button"
                onClick={() => {
                  setReqSourceType('site');
                  if (sourceSitesWithStock.length > 0 && !reqSourceSiteId) {
                    setReqSourceSiteId(sourceSitesWithStock[0].id);
                  }
                  setReqItems([{ name: '', quantity: 1, unit: 'Units' }]);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  reqSourceType === 'site'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ArrowRightLeft className="w-4 h-4" /> Get from Another Site ({sourceSitesWithStock.length} Available)
              </button>
            </div>
          </div>

          {/* Destination & Source Sites */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" /> Destination Site (Receiving)
              </Label>
              <Select
                value={reqSiteId || (mySites[0]?.id || '')}
                onValueChange={val => {
                  setReqSiteId(val);
                  if (reqSourceSiteId === val) {
                    setReqSourceSiteId('');
                  }
                }}
              >
                <SelectTrigger className="h-11 rounded-xl font-medium">
                  <SelectValue placeholder="Select Destination Site" />
                </SelectTrigger>
                <SelectContent>
                  {(mySites.length > 0 ? mySites : sites).map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.clientName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reqSourceType === 'site' && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-500" /> Source Site (With Available Stock)
                </Label>
                {otherSites.length === 0 ? (
                  <div className="h-11 rounded-xl border border-destructive/30 bg-destructive/10 px-3 flex items-center text-xs text-destructive font-medium">
                    No other project sites available
                  </div>
                ) : (
                  <Select
                    value={effectiveSourceSiteId || ''}
                    onValueChange={val => {
                      setReqSourceSiteId(val);
                      const stock = getSiteAvailableStock(val, materialRequests, dailyLogs, materialSettings);
                      if (stock.length > 0) {
                        setReqItems([{
                          name: stock[0].name,
                          quantity: Math.min(1, stock[0].qty),
                          unit: stock[0].unit,
                          rate: stock[0].rate,
                          amount: Math.min(1, stock[0].qty) * stock[0].rate,
                          maxAvailable: stock[0].qty
                        }]);
                      } else {
                        setReqItems([{ name: '', quantity: 1, unit: 'Units' }]);
                      }
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl font-medium border-amber-500/30 bg-amber-500/5">
                      <SelectValue placeholder="Select Source Site" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherSites.map(s => {
                        const availStock = getSiteAvailableStock(s.id, materialRequests, dailyLogs, materialSettings);
                        return (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {availStock.length > 0 ? `(${availStock.length} materials in stock)` : '(No stock)'}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          {/* Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-primary" /> Required Materials ({reqItems.length})
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddReqItem}
                disabled={reqSourceType === 'site' && (!effectiveSourceSiteId || sourceAvailableStock.length === 0)}
                className="h-7 text-xs text-primary font-semibold hover:bg-primary/10 rounded-lg gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Material
              </Button>
            </div>

            {/* Quick Add Chips for Supplier mode */}
            {reqSourceType === 'supplier' && (
              <div className="bg-muted/30 p-2.5 rounded-xl border border-border/40 space-y-1.5">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Quick Add Common Materials
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { name: 'Cement Bag (50kg)', unit: 'Bags', qty: 10 },
                    { name: 'M-Sand', unit: 'Tons', qty: 2 },
                    { name: 'Jalli (Aggregate)', unit: 'Tons', qty: 1 },
                    { name: 'Red Bricks', unit: 'Nos', qty: 500 },
                    { name: 'Interior Paint (White)', unit: 'Liters', qty: 20 },
                    { name: 'Wall Putty', unit: 'Bags', qty: 5 },
                  ].map((chip, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => {
                        setReqItems(prev => {
                          const hasEmptyFirst = prev.length === 1 && !prev[0].name.trim() && !prev[0].quantity;
                          if (hasEmptyFirst) {
                            return [{ name: chip.name, quantity: chip.qty, unit: chip.unit }];
                          }
                          return [...prev, { name: chip.name, quantity: chip.qty, unit: chip.unit }];
                        });
                        toast.info(`Added ${chip.name} to requisition`);
                      }}
                      className="text-[11px] font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-lg px-2.5 py-1 transition-all active:scale-95 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> {chip.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Material input items list */}
            <div className="space-y-2.5">
              {reqItems.map((item, idx) => {
                const isOverStock = reqSourceType === 'site' && item.maxAvailable !== undefined && Number(item.quantity) > item.maxAvailable;

                return (
                  <div key={idx} className="p-3 bg-muted/20 border border-border/50 rounded-xl space-y-2 relative">
                    {reqItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveReqItem(idx)}
                        className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                      <div className="sm:col-span-7">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                          Material Name *
                        </Label>
                        {reqSourceType === 'site' ? (
                          <Select
                            value={item.name}
                            onValueChange={val => handleUpdateReqItem(idx, 'name', val)}
                          >
                            <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
                              <SelectValue placeholder="Choose Material in Stock" />
                            </SelectTrigger>
                            <SelectContent>
                              {sourceAvailableStock.map((st, sIdx) => (
                                <SelectItem key={sIdx} value={st.name}>
                                  {st.name} ({st.qty} {st.unit} in hand)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            placeholder="e.g. UltraTech Cement, 20mm Jalli, Asian Paints..."
                            value={item.name}
                            onChange={e => handleUpdateReqItem(idx, 'name', e.target.value)}
                            className="h-10 rounded-xl text-xs"
                          />
                        )}
                      </div>

                      <div className="sm:col-span-3">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                          Quantity *
                        </Label>
                        <Input
                          type="number"
                          min="0.1"
                          step="any"
                          max={reqSourceType === 'site' ? item.maxAvailable : undefined}
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={e => handleUpdateReqItem(idx, 'quantity', e.target.value)}
                          className={`h-10 rounded-xl text-xs font-semibold ${isOverStock ? 'border-destructive text-destructive' : ''}`}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                          Unit
                        </Label>
                        {reqSourceType === 'site' ? (
                          <div className="h-10 px-3 bg-muted/40 rounded-xl border border-border/50 flex items-center text-xs font-semibold text-foreground">
                            {item.unit || 'Units'}
                          </div>
                        ) : (
                          <Select
                            value={item.unit || 'Bags'}
                            onValueChange={val => handleUpdateReqItem(idx, 'unit', val)}
                          >
                            <SelectTrigger className="h-10 rounded-xl text-xs">
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Bags">Bags</SelectItem>
                              <SelectItem value="Tons">Tons</SelectItem>
                              <SelectItem value="Sqft">Sqft</SelectItem>
                              <SelectItem value="Kg">Kg</SelectItem>
                              <SelectItem value="Liters">Liters</SelectItem>
                              <SelectItem value="Nos">Nos</SelectItem>
                              <SelectItem value="Bundles">Bundles</SelectItem>
                              <SelectItem value="Units">Units</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {isOverStock && (
                      <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Limited Stock! Cannot request more than {item.maxAvailable} {item.unit} available at the source site.</span>
                      </div>
                    )}
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                onClick={handleAddReqItem}
                disabled={reqSourceType === 'site' && (!effectiveSourceSiteId || sourceAvailableStock.length === 0)}
                className="w-full h-11 border-dashed border-2 border-primary/40 hover:border-primary text-primary font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/5 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Another Material to this Requisition
              </Button>
            </div>
          </div>

          {/* Urgency / Notes */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Requisition Notes / Delivery Timing
            </Label>
            <Textarea
              value={reqNotes}
              onChange={e => setReqNotes(e.target.value)}
              placeholder="e.g. Urgent required before 11:30 AM for ground floor plastering, call on arrival..."
              className="rounded-xl min-h-[75px] text-xs"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 rounded-xl text-white font-semibold text-sm gap-2 shadow-sm"
            style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
          >
            <Send className="w-4 h-4" /> Submit Requisition to Admin
          </Button>
        </form>
      </div>

      {/* Staff Requisitions Tracking List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="section-header mb-0">Requisition Status & Tracking</h3>
            <p className="text-xs text-muted-foreground">Real-time status of driver, supplier, and vehicle allocations</p>
          </div>

          {/* Status Filters */}
          <div className="flex gap-1.5 bg-muted/60 p-1 rounded-xl">
            {(['all', 'pending', 'assigned', 'completed'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setReqStatusFilter(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                  reqStatusFilter === tab
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Filtered list */}
        {(() => {
          const filtered = (materialRequests || []).filter(r => {
            const matchesSiteOrStaff = r.requestedByStaffId === staff?.id || mySites.some(s => s.id === r.siteId);
            if (!matchesSiteOrStaff) return false;
            if (reqStatusFilter === 'all') return true;
            return r.status === reqStatusFilter;
          }).sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

          if (filtered.length === 0) {
            return (
              <div className="text-center py-10 bg-card rounded-2xl border border-border/50">
                <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">No material requisitions found</p>
                <p className="text-xs text-muted-foreground mt-1">Submit your first material request above</p>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {filtered.map(req => {
                const statusConfig = {
                  pending: {
                    label: 'Pending Admin Assignment',
                    icon: <AlertCircle className="w-3.5 h-3.5" />,
                    badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  },
                  assigned: {
                    label: 'Driver Assigned & Dispatched',
                    icon: <Truck className="w-3.5 h-3.5" />,
                    badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                  },
                  completed: {
                    label: 'Delivered & Completed',
                    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                    badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  }
                }[req.status];

                return (
                  <Card key={req.id} className="p-4 rounded-2xl border border-border/50 bg-card space-y-3 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <MapPin className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-heading font-bold text-sm text-foreground">{req.siteName}</span>
                          {req.sourceType === 'site' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                              <ArrowRightLeft className="w-3 h-3" /> From: {req.sourceSiteName || 'Another Site'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Requested on {(() => {
                            if (req.createdAt) {
                              try {
                                const d = new Date(req.createdAt);
                                if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, hh:mm a');
                              } catch {}
                            }
                            return `${req.date || 'Today'} ${req.time || ''}`.trim();
                          })()}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.badgeClass}`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Items pills */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Materials Ordered</p>
                      <div className="flex flex-wrap gap-1.5">
                        {req.items.map((item, i) => (
                          <div key={i} className="inline-flex items-center gap-1.5 bg-muted/60 border border-border/50 rounded-xl px-2.5 py-1 text-xs font-semibold">
                            <Package className="w-3 h-3 text-muted-foreground" />
                            <span>{item.name}</span>
                            <span className="text-primary font-bold">× {item.quantity} {item.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Status-specific progress / tracking details (Non-monetary) */}
                    {req.status === 'pending' && (
                      <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/15 flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          Waiting for Admin to review requisition and assign a <span className="font-semibold text-foreground">Driver</span>, <span className="font-semibold text-foreground">Supplier</span>, and <span className="font-semibold text-foreground">Vehicle</span>.
                        </p>
                      </div>
                    )}

                    {req.status === 'assigned' && (
                      <div className="p-3.5 bg-blue-500/5 rounded-xl border border-blue-500/20 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-blue-500 font-bold text-xs">
                            <Truck className="w-4 h-4" /> Dispatch & Transit Information
                          </div>
                          {req.startTime && (
                            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Dispatched at {req.startTime}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                          <div className="bg-card p-2 rounded-lg border border-border/50">
                            <span className="text-[10px] text-muted-foreground block font-bold uppercase">Driver</span>
                            <span className="font-semibold text-foreground">{req.driverName || 'Assigned'}</span>
                          </div>
                          <div className="bg-card p-2 rounded-lg border border-border/50">
                            <span className="text-[10px] text-muted-foreground block font-bold uppercase">Supplier / Source</span>
                            <span className="font-semibold text-foreground">{req.supplierName || 'Assigned'}</span>
                          </div>
                          <div className="bg-card p-2 rounded-lg border border-border/50">
                            <span className="text-[10px] text-muted-foreground block font-bold uppercase">Vehicle</span>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {req.vehicleType && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/25">
                                  {req.vehicleType}
                                </span>
                              )}
                              <span className="font-semibold text-foreground">{req.vehicleNumber || req.vehicle || 'Assigned'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {req.status === 'completed' && (
                      <div className="p-3.5 bg-emerald-500/5 rounded-xl border border-emerald-500/20 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                            <CheckCircle2 className="w-4 h-4" /> Delivery Fulfilled & Received
                          </div>
                          {(req.duration || (req.startTime && (req.endTime || req.completionTime))) && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-emerald-600" />
                              Duration: {req.duration || calculateDuration(req.startTime, req.endTime || req.completionTime)}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                          <div className="bg-card p-2 rounded-lg border border-border/50">
                            <span className="text-[10px] text-muted-foreground block font-bold uppercase">Start Time</span>
                            <span className="font-semibold text-foreground">{req.startTime || '-'}</span>
                          </div>
                          <div className="bg-card p-2 rounded-lg border border-border/50">
                            <span className="text-[10px] text-muted-foreground block font-bold uppercase">End Time</span>
                            <span className="font-semibold text-foreground">{req.endTime || req.completionTime || '-'}</span>
                          </div>
                          <div className="bg-card p-2 rounded-lg border border-border/50">
                            <span className="text-[10px] text-muted-foreground block font-bold uppercase">Driver / Staff</span>
                            <span className="font-semibold text-foreground">{req.driverName || '-'}</span>
                          </div>
                          <div className="bg-card p-2 rounded-lg border border-border/50">
                            <span className="text-[10px] text-muted-foreground block font-bold uppercase">Transit Status</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Received
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-card p-2 rounded-lg border border-border/50">
                            <span className="text-[10px] text-muted-foreground block font-bold uppercase">Supplier / Source</span>
                            <span className="font-semibold text-foreground">{req.supplierName || '-'}</span>
                          </div>
                          <div className="bg-card p-2 rounded-lg border border-border/50">
                            <span className="text-[10px] text-muted-foreground block font-bold uppercase">Vehicle</span>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              {req.vehicleType && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/25">
                                  {req.vehicleType}
                                </span>
                              )}
                              <span className="font-semibold text-foreground">{req.vehicleNumber || req.vehicle || '-'}</span>
                            </div>
                          </div>
                        </div>
                        {req.completionNotes && (
                          <p className="text-xs text-muted-foreground italic pt-1 border-t border-emerald-500/20">
                            Completion Notes: "{req.completionNotes}"
                          </p>
                        )}
                      </div>
                    )}

                    {req.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        Staff note: "{req.notes}"
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
export default MaterialRequestTab;
