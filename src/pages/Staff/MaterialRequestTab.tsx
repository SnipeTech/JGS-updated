import React, { useState, useMemo, useEffect } from 'react';
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
  Clock, Truck, CheckCircle2, AlertCircle, Send, StickyNote,
  Warehouse, Calendar
} from 'lucide-react';
import { MaterialRequestItem, Site, Staff, MATERIAL_CATEGORIES } from '@/types';
import { calculateDuration, getSiteAvailableStock } from '@/lib/utils';

interface MaterialRequestTabProps {
  staff: Staff | undefined;
  mySites: Site[];
  initialSiteId?: string;
}

export const MaterialRequestTab = ({ staff, mySites, initialSiteId }: MaterialRequestTabProps) => {
  const { currentUser, sites, materialSettings, materialRequests, dailyLogs, addMaterialRequest, paymentStageMaster, unitMaster } = useApp();

  const [reqSiteId, setReqSiteId] = useState(initialSiteId || localStorage.getItem('today_active_site_id') || '');
  const [reqSourceType, setReqSourceType] = useState<'supplier' | 'store_room' | 'site'>('supplier');
  const [reqStartDate, setReqStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reqSourceSiteId, setReqSourceSiteId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [reqItems, setReqItems] = useState<MaterialRequestItem[]>([
    { name: '', quantity: 1, unit: 'Bags' }
  ]);
  const [reqNotes, setReqNotes] = useState('');
  const [reqStatusFilter, setReqStatusFilter] = useState<'all' | 'pending' | 'assigned' | 'completed'>('all');

  const storeRoomCatalogItems = useMemo(() => {
    return (materialSettings || []).filter(m => m.isStoreRoom);
  }, [materialSettings]);

  const availableSites = useMemo(() => {
    if (!sites || sites.length === 0) return mySites || [];
    const mySiteIds = new Set((mySites || []).map(s => s.id));
    const assigned = sites.filter(s => mySiteIds.has(s.id));
    const others = sites.filter(s => !mySiteIds.has(s.id));
    return [...assigned, ...others];
  }, [mySites, sites]);

  const effectiveReqSiteId = useMemo(() => {
    if (reqSiteId && availableSites.some(s => s.id === reqSiteId)) return reqSiteId;
    if (initialSiteId && availableSites.some(s => s.id === initialSiteId)) return initialSiteId;
    return availableSites[0]?.id || (sites[0]?.id || '');
  }, [reqSiteId, initialSiteId, availableSites, sites]);

  const destinationReqSiteId = effectiveReqSiteId;

  // Other sites available as source
  const otherSites = useMemo(() => {
    return sites.filter(s => s.id !== destinationReqSiteId);
  }, [sites, destinationReqSiteId]);

  // Site stock map - strictly evaluated only when in 'site' transfer mode
  const siteStockMap = useMemo(() => {
    if (reqSourceType !== 'site') return {};
    const map: Record<string, ReturnType<typeof getSiteAvailableStock>> = {};
    otherSites.forEach(s => {
      map[s.id] = getSiteAvailableStock(s.id, materialRequests, dailyLogs, materialSettings);
    });
    return map;
  }, [reqSourceType, otherSites, materialRequests, dailyLogs, materialSettings]);

  const sourceSitesWithStock = useMemo(() => {
    if (reqSourceType !== 'site') return [];
    return otherSites.filter(s => (siteStockMap[s.id] || []).length > 0);
  }, [reqSourceType, otherSites, siteStockMap]);

  const effectiveSourceSiteId = useMemo(() => {
    if (reqSourceType !== 'site') return '';
    if (reqSourceSiteId && otherSites.some(s => s.id === reqSourceSiteId)) {
      return reqSourceSiteId;
    }
    return sourceSitesWithStock[0]?.id || (otherSites[0]?.id || '');
  }, [reqSourceType, reqSourceSiteId, otherSites, sourceSitesWithStock]);

  const sourceAvailableStock = useMemo(() => {
    if (reqSourceType !== 'site' || !effectiveSourceSiteId) return [];
    return siteStockMap[effectiveSourceSiteId] || [];
  }, [reqSourceType, effectiveSourceSiteId, siteStockMap]);

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
    if (reqSourceType === 'store_room') {
      const unusedStock = storeRoomCatalogItems.find(st => !reqItems.some(item => item.name === st.name));
      const chosen = unusedStock || storeRoomCatalogItems[0];
      if (chosen) {
        setReqItems(prev => [
          ...prev,
          {
            name: chosen.name,
            quantity: 1,
            unit: chosen.unit || 'Units',
            rate: chosen.defaultRate || 0,
            amount: chosen.defaultRate || 0,
            maxAvailable: chosen.stockQuantity
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
      } else if (field === 'name' && reqSourceType === 'store_room') {
        const foundSetting = storeRoomCatalogItems.find(s => s.name === value);
        if (foundSetting) {
          const availStock = foundSetting.stockQuantity ?? 0;
          const minAlert = foundSetting.minStockAlert ?? 5;
          updated.unit = foundSetting.unit || 'Units';
          updated.rate = foundSetting.defaultRate || 0;
          updated.maxAvailable = availStock;

          if (availStock <= 0) {
            updated.quantity = 0;
            toast.error(`"${foundSetting.name}" is OUT OF STOCK (0 in Store Room). Cannot request this item.`);
          } else {
            if (Number(updated.quantity) > availStock || !updated.quantity || Number(updated.quantity) <= 0) {
              updated.quantity = 1 <= availStock ? 1 : availStock;
            }
            if (availStock <= minAlert) {
              toast.warning(`⚠️ Low Stock Alert: Only ${availStock} ${foundSetting.unit || 'units'} left in Store Room (Min alert threshold: ${minAlert}).`);
            }
          }
          updated.amount = (Number(updated.quantity) || 0) * (foundSetting.defaultRate || 0);
        }
      } else if (field === 'quantity') {
        const numVal = Number(value);
        if (reqSourceType === 'store_room' || reqSourceType === 'site') {
          const maxAvail = item.maxAvailable !== undefined ? item.maxAvailable : Infinity;
          if (maxAvail <= 0) {
            toast.error(`Out of stock! Cannot enter quantity.`);
            updated.quantity = 0;
          } else if (numVal > maxAvail) {
            toast.warning(`Out of range! Cannot enter more than available stock (${maxAvail} ${item.unit || 'units'}).`);
            updated.quantity = maxAvail;
          } else if (numVal < 0) {
            updated.quantity = 0;
          } else {
            updated.quantity = value;
          }
          updated.amount = (Number(updated.quantity) || 0) * (Number(updated.rate) || 0);
        }
      } else if (field === 'name' && reqSourceType === 'supplier') {
        const foundSetting = materialSettings.find(s => s.name.toLowerCase() === String(value).trim().toLowerCase());
        if (foundSetting && foundSetting.unit) {
          updated.unit = foundSetting.unit;
        }
      }
      return updated;
    }));
  };

  const handleSubmitMaterialRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSiteId = effectiveReqSiteId;
    const targetSite = sites.find(s => s.id === finalSiteId) || availableSites[0];
    const sourceSite = reqSourceType === 'site' ? sites.find(s => s.id === effectiveSourceSiteId) : undefined;

    if (!targetSite) {
      toast.error('Please create or select a valid project site first');
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

    if (reqSourceType === 'store_room') {
      for (const item of validItems) {
        const stockItem = storeRoomCatalogItems.find(s => s.name.toLowerCase() === item.name.trim().toLowerCase());
        const avail = stockItem?.stockQuantity ?? 0;
        if (avail <= 0) {
          toast.error(`"${item.name}" is OUT OF STOCK (0 in Store Room). Cannot submit requisition.`);
          return;
        }
        if (Number(item.quantity) > avail) {
          toast.error(`Out of range! Cannot request ${item.quantity} ${item.unit} of "${item.name}". Only ${avail} available in Store Room.`);
          return;
        }
      }
    }

    // Automatically link requisition to the active construction level/stage for the destination site
    const masterStages = (targetSite.paymentStages && targetSite.paymentStages.length > 0)
      ? targetSite.paymentStages.map(s => s.stageName)
      : paymentStageMaster;
    let activeStageForReq: string | undefined = undefined;
    for (const st of masterStages) {
      const sData = (targetSite.paymentStages || []).find(s => s.stageName === st);
      if (!sData || sData.completionStatus !== 'completed') {
        activeStageForReq = st;
        break;
      }
    }

    const activeStaffId = staff?.id || currentUser?.id || 'supervisor';
    const activeStaffName = staff?.name || currentUser?.name || 'Site Supervisor';

    addMaterialRequest({
      siteId: targetSite.id,
      siteName: targetSite.name,
      requestedByStaffId: activeStaffId,
      requestedByStaffName: activeStaffName,
      sourceType: reqSourceType,
      sourceSiteId: reqSourceType === 'site' ? sourceSite?.id : (reqSourceType === 'store_room' ? 'store_room' : undefined),
      sourceSiteName: reqSourceType === 'site' ? sourceSite?.name : (reqSourceType === 'store_room' ? 'Store Room / Warehouse' : undefined),
      isStoreRoom: reqSourceType === 'store_room',
      startDate: reqSourceType === 'store_room' ? (reqStartDate || format(new Date(), 'yyyy-MM-dd')) : undefined,
      items: validItems.map(i => ({
        name: i.name.trim(),
        quantity: Number(i.quantity),
        unit: i.unit?.trim() || 'Units',
        rate: i.rate,
        amount: i.rate ? i.rate * Number(i.quantity) : undefined
      })),
      notes: (reqSourceType === 'site' ? `[Inter-Site Transfer from ${sourceSite?.name}] ` : reqSourceType === 'store_room' ? `[Store Room Warehouse Stock - Start Date: ${reqStartDate}] ` : '') + (reqNotes.trim() || ''),
      status: 'pending',
      workLevelStage: activeStageForReq,
      date: reqSourceType === 'store_room' ? (reqStartDate || format(new Date(), 'yyyy-MM-dd')) : format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'hh:mm a'),
      createdAt: new Date().toISOString()
    });

    toast.success(reqSourceType === 'site'
      ? `Inter-site material transfer request submitted to Admin!`
      : (reqSourceType === 'store_room'
        ? `Store Room product requisition submitted to Admin!`
        : `Material requisition for ${validItems.length} item(s) submitted to Admin!`)
    );
    setReqItems([{ name: '', quantity: 1, unit: 'Bags' }]);
    setReqNotes('');
    setReqStatusFilter('all');
  };

  return (
    <div className="animate-slide-up-delay-2 w-full space-y-6">
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
          {/* Requisition Source Type: Supplier vs Store Room vs Another Site */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5" /> Requisition Source
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 bg-muted/60 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => {
                  setReqSourceType('store_room');
                  const firstStore = storeRoomCatalogItems[0];
                  if (firstStore) {
                    setReqItems([{
                      name: firstStore.name,
                      quantity: 1,
                      unit: firstStore.unit || 'Units',
                      rate: firstStore.defaultRate || 0,
                      maxAvailable: firstStore.stockQuantity
                    }]);
                  } else {
                    setReqItems([{ name: '', quantity: 1, unit: 'Units' }]);
                  }
                }}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${reqSourceType === 'store_room'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Warehouse className="w-4 h-4" /> Store Room Stock ({storeRoomCatalogItems.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setReqSourceType('supplier');
                  setReqItems([{ name: '', quantity: 1, unit: 'Bags' }]);
                }}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${reqSourceType === 'supplier'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Building2 className="w-4 h-4" /> Order from Supplier
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
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${reqSourceType === 'site'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <ArrowRightLeft className="w-4 h-4" /> Site Transfer ({sourceSitesWithStock.length})
              </button>
            </div>
          </div>

          {/* Destination & Source Details & Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" /> Destination Site (Receiving)
              </Label>
              <Select
                value={effectiveReqSiteId}
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
                  {availableSites.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.clientName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reqSourceType === 'store_room' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Start Date on Site *
                  </Label>
                  <span className="text-[10px] text-emerald-600 font-semibold">Customizable</span>
                </div>
                <Input
                  type="date"
                  value={reqStartDate}
                  onChange={e => setReqStartDate(e.target.value)}
                  className="h-11 rounded-xl font-medium border-emerald-500/30 bg-emerald-500/5 text-xs"
                />
              </div>
            )}

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
                      const stock = siteStockMap[val] || [];
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
                        const stockCount = (siteStockMap[s.id] || []).length;
                        return (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {stockCount > 0 ? `(${stockCount} materials in stock)` : '(No stock)'}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {reqSourceType === 'supplier' && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary" /> Fulfillment
                </Label>
                <div className="h-11 rounded-xl border border-border/60 bg-muted/30 px-3 flex items-center text-xs text-muted-foreground font-medium">
                  Admin will assign verified supplier & dispatch driver
                </div>
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

            {/* Quick Add Chips for Store Room mode */}
            {reqSourceType === 'store_room' && (
              <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider flex items-center gap-1.5">
                    <Warehouse className="w-3.5 h-3.5" /> Store Room Available Products ({storeRoomCatalogItems.length}):
                  </p>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
                    Click to add to requisition
                  </span>
                </div>

                {storeRoomCatalogItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No items marked as Store Room stock in Material Catalog yet. Admin can enable "Store Room / Warehouse Stock" in Materials Presets Catalog.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-0.5 max-h-36 overflow-y-auto">
                    {storeRoomCatalogItems.map(chip => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => {
                          setReqItems(prev => {
                            const hasEmptyFirst = prev.length === 1 && !prev[0].name.trim();
                            const newItem = {
                              name: chip.name,
                              quantity: 1,
                              unit: chip.unit || 'Units',
                              rate: chip.defaultRate || 0,
                              maxAvailable: chip.stockQuantity
                            };
                            if (hasEmptyFirst) return [newItem];
                            return [...prev, newItem];
                          });
                          toast.info(`Added ${chip.name} (${chip.stockQuantity ?? 0} ${chip.unit || 'Units'} on hand)`);
                        }}
                        className="text-[11px] font-semibold bg-background hover:bg-emerald-500/15 text-foreground hover:text-emerald-700 dark:hover:text-emerald-300 border border-emerald-500/40 rounded-lg px-2.5 py-1 transition-all active:scale-95 flex items-center gap-1.5 shadow-2xs"
                      >
                        <Plus className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{chip.name}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-200">
                          {chip.stockQuantity ?? 0} {chip.unit || 'Units'}
                        </span>
                        {chip.storeRoomLocation && (
                          <span className="text-[9px] text-muted-foreground">📍{chip.storeRoomLocation}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Add Chips for Supplier mode with Category Filter */}
            {reqSourceType === 'supplier' && (
              <div className="bg-muted/30 p-3 rounded-xl border border-border/40 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <span>📦</span> Material Category Filter:
                  </p>
                  <span className="text-[10px] text-primary font-semibold">
                    Click material to add to list
                  </span>
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                      selectedCategory === 'all'
                        ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                        : 'bg-background hover:bg-muted text-muted-foreground border-border/60'
                    }`}
                  >
                    All ({materialSettings.length})
                  </button>
                  {MATERIAL_CATEGORIES.map(cat => {
                    const count = materialSettings.filter(m => (m.category || 'General').toLowerCase() === cat.toLowerCase()).length;
                    if (count === 0 && selectedCategory !== cat) return null;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                          selectedCategory === cat
                            ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                            : 'bg-background hover:bg-muted text-muted-foreground border-border/60'
                        }`}
                      >
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Material Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1 max-h-36 overflow-y-auto">
                  {(materialSettings.filter(m =>
                    !m.isRental && (selectedCategory === 'all' || (m.category || 'General').toLowerCase() === selectedCategory.toLowerCase())
                  )).map(chip => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        setReqItems(prev => {
                          const hasEmptyFirst = prev.length === 1 && !prev[0].name.trim();
                          if (hasEmptyFirst) {
                            return [{ name: chip.name, quantity: 1, unit: chip.unit || 'Unit' }];
                          }
                          return [...prev, { name: chip.name, quantity: 1, unit: chip.unit || 'Unit' }];
                        });
                        toast.info(`Added ${chip.name} (${chip.category || 'General'})`);
                      }}
                      className="text-[11px] font-semibold bg-background hover:bg-primary/10 text-foreground hover:text-primary border border-border/70 hover:border-primary/40 rounded-lg px-2.5 py-1 transition-all active:scale-95 flex items-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="w-3 h-3 text-primary shrink-0" />
                      <span>{chip.name}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary">
                        {chip.category || 'General'}
                      </span>
                      {chip.unit && <span className="text-[10px] text-muted-foreground font-mono">({chip.unit})</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hidden Datalist for autocomplete typing */}
            <datalist id="staff-material-presets">
              {materialSettings.filter(m => !m.isRental).map(m => (
                <option key={m.id} value={m.name}>
                  {m.category || 'General'} · {m.unit || 'Unit'}
                </option>
              ))}
            </datalist>

            {/* Material input items list */}
            <div className="space-y-2.5">
              {reqItems.map((item, idx) => {
                const isOverStock = (reqSourceType === 'site' || reqSourceType === 'store_room') && item.maxAvailable !== undefined && Number(item.quantity) > item.maxAvailable;

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
                        ) : reqSourceType === 'store_room' ? (
                          <Select
                            value={item.name}
                            onValueChange={val => handleUpdateReqItem(idx, 'name', val)}
                          >
                            <SelectTrigger className="h-10 rounded-xl text-xs font-semibold border-emerald-500/40">
                              <SelectValue placeholder="Select Store Room Product" />
                            </SelectTrigger>
                            <SelectContent>
                              {storeRoomCatalogItems.map(st => {
                                const stStock = st.stockQuantity ?? 0;
                                const isZero = stStock <= 0;
                                const isLow = !isZero && stStock <= (st.minStockAlert ?? 5);
                                return (
                                  <SelectItem key={st.id} value={st.name} className={isZero ? 'opacity-60 text-destructive' : ''}>
                                    {isZero ? '❌ ' : isLow ? '⚠️ ' : '🏬 '}
                                    {st.name} ({stStock} {st.unit || 'Units'} {isZero ? '· OUT OF STOCK' : isLow ? '· LOW STOCK' : 'in stock'})
                                    {st.storeRoomLocation ? ` · 📍${st.storeRoomLocation}` : ''}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            list="staff-material-presets"
                            placeholder="e.g. Cement Bag, M-Sand, Paints..."
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
                          max={(reqSourceType === 'site' || reqSourceType === 'store_room') ? item.maxAvailable : undefined}
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={e => {
                            const rawVal = e.target.value;
                            if (reqSourceType === 'store_room' || reqSourceType === 'site') {
                              const maxVal = item.maxAvailable !== undefined ? item.maxAvailable : Infinity;
                              if (Number(rawVal) > maxVal) {
                                toast.warning(`Out of range! Cannot enter more than available stock (${maxVal} ${item.unit || 'units'}).`);
                                handleUpdateReqItem(idx, 'quantity', maxVal);
                                return;
                              }
                            }
                            handleUpdateReqItem(idx, 'quantity', rawVal);
                          }}
                          disabled={reqSourceType === 'store_room' && (item.maxAvailable ?? 0) <= 0}
                          className={`h-10 rounded-xl text-xs font-semibold ${isOverStock || (reqSourceType === 'store_room' && (item.maxAvailable ?? 0) <= 0) ? 'border-destructive text-destructive' : ''}`}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                          Unit
                        </Label>
                        {reqSourceType === 'site' || reqSourceType === 'store_room' ? (
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
                            <SelectContent className="max-h-60">
                              {(unitMaster && unitMaster.length > 0 ? unitMaster : ['Bags', 'Tons', 'Sqft', 'Kg', 'Liters', 'Nos', 'Bundles', 'Units']).map(u => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Store Room Stock Status & Alerts */}
                    {reqSourceType === 'store_room' && item.name && (() => {
                      const st = storeRoomCatalogItems.find(s => s.name === item.name);
                      const currentStock = st?.stockQuantity ?? item.maxAvailable ?? 0;
                      const minAlert = st?.minStockAlert ?? 5;

                      if (currentStock <= 0) {
                        return (
                          <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>❌ Out of Stock! 0 {item.unit} available in Store Room. You cannot enter or request this item.</span>
                          </div>
                        );
                      }
                      if (currentStock <= minAlert) {
                        return (
                          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                            <span>⚠️ Minimum Stock Alert: Only {currentStock} {item.unit} available in Store Room (Min threshold: {minAlert}). Cannot enter more than {currentStock}.</span>
                          </div>
                        );
                      }
                      return (
                        <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1.5 px-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>In Stock: {currentStock} {item.unit} available in Store Room ({st?.storeRoomLocation || 'Main Warehouse'})</span>
                        </div>
                      );
                    })()}

                    {isOverStock && (
                      <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Out of range! Cannot request more than {item.maxAvailable} {item.unit} available in {reqSourceType === 'store_room' ? 'Store Room' : 'source site'}.
                        </span>
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

          {reqSourceType === 'store_room' && reqItems.some(it => (it.maxAvailable ?? 0) <= 0 || Number(it.quantity) > (it.maxAvailable ?? 0)) && (
            <p className="text-xs text-center text-destructive font-bold flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Cannot submit: One or more Store Room items are Out of Stock or have an out-of-range quantity.
            </p>
          )}

          <Button
            type="submit"
            disabled={reqSourceType === 'store_room' && reqItems.some(it => (it.maxAvailable ?? 0) <= 0 || Number(it.quantity) > (it.maxAvailable ?? 0))}
            onClick={(e) => {
              e.preventDefault();
              handleSubmitMaterialRequest(e);
            }}
            className="w-full h-12 rounded-xl text-white font-semibold text-sm gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
          >
            <Send className="w-4 h-4" /> Submit Requisition to Admin
          </Button>
        </form>
      </div>

      {/* Staff Requisitions Tracking List — Grouped by Status */}
      <div className="space-y-6">
        <div>
          <h3 className="section-header mb-0">Requisition Status & Tracking</h3>
          <p className="text-xs text-muted-foreground">Real-time status of driver, supplier, and vehicle allocations</p>
        </div>

        {(() => {
          const activeStaffId = staff?.id || currentUser?.id;
          const activeStaffName = (staff?.name || currentUser?.name || '').toLowerCase();

          const getTimestamp = (r: MaterialRequest) => {
            if (r.createdAt) { const t = new Date(r.createdAt).getTime(); if (!isNaN(t)) return t; }
            if (r.date) { const t = new Date(r.date).getTime(); if (!isNaN(t)) return t; }
            if (r.id && r.id.startsWith('mr_')) { const num = Number(r.id.split('_')[1]); if (!isNaN(num)) return num; }
            return 0;
          };

          const allFiltered = (materialRequests || []).filter(r => {
            const matchesStaff = (activeStaffId && r.requestedByStaffId === activeStaffId) ||
              (activeStaffName && r.requestedByStaffName?.toLowerCase().includes(activeStaffName));
            const matchesSite = (mySites && mySites.length > 0)
              ? mySites.some(s => s.id === r.siteId)
              : sites.some(s => s.id === r.siteId);
            return matchesStaff || matchesSite || currentUser?.role === 'staff' || currentUser?.role === 'admin' || staff?.role === 'supervisor';
          }).sort((a, b) => getTimestamp(b) - getTimestamp(a));

          if (allFiltered.length === 0) {
            return (
              <div className="text-center py-10 bg-card rounded-2xl border border-border/50">
                <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">No material requisitions found</p>
                <p className="text-xs text-muted-foreground mt-1">Submit your first material request above</p>
              </div>
            );
          }

          type StatusKey = 'pending' | 'assigned' | 'completed';
          const STATUS_GROUPS: { key: StatusKey; label: string; icon: React.ReactNode; headerClass: string; badgeClass: string; cardBorderClass: string }[] = [
            { key: 'pending', label: 'Pending Admin Review', icon: <AlertCircle className="w-4 h-4" />, headerClass: 'border-amber-500/30 bg-amber-500/[0.06]', badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', cardBorderClass: 'border-amber-500/20' },
            { key: 'assigned', label: 'Driver Assigned & En Route', icon: <Truck className="w-4 h-4" />, headerClass: 'border-blue-500/30 bg-blue-500/[0.06]', badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30', cardBorderClass: 'border-blue-500/20' },
            { key: 'completed', label: 'Delivered & Completed', icon: <CheckCircle2 className="w-4 h-4" />, headerClass: 'border-emerald-500/30 bg-emerald-500/[0.06]', badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', cardBorderClass: 'border-emerald-500/20' },
          ];

          const renderCard = (req: MaterialRequest) => {
            const statusKey = (req.status || 'pending') as StatusKey;
            const group = STATUS_GROUPS.find(g => g.key === statusKey) || STATUS_GROUPS[0];
            return (
              <Card key={req.id} className={`p-4 rounded-2xl border bg-card space-y-3 shadow-sm ${group.cardBorderClass}`}>
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
                      {(req.sourceType === 'store_room' || req.isStoreRoom) && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                          <Warehouse className="w-3 h-3" /> Store Room Stock {req.startDate ? `· Start: ${req.startDate}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Requested on {(() => {
                        if (req.createdAt) { try { const d = new Date(req.createdAt); if (!isNaN(d.getTime())) return format(d, 'dd MMM yyyy, hh:mm a'); } catch (e) { } }
                        return `${req.date || 'Today'} ${req.time || ''}`.trim();
                      })()}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Materials Ordered</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(req.items || []).map((item, i) => (
                      <div key={i} className="inline-flex items-center gap-1.5 bg-muted/60 border border-border/50 rounded-xl px-2.5 py-1 text-xs font-semibold">
                        <Package className="w-3 h-3 text-muted-foreground" />
                        <span>{item.name}</span>
                        <span className="text-primary font-bold">x {item.quantity} {item.unit || 'Units'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {req.status === 'pending' && (
                  <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/15 flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-xs text-muted-foreground">Waiting for Admin to assign a <span className="font-semibold text-foreground">Driver</span>, <span className="font-semibold text-foreground">Supplier</span>, and <span className="font-semibold text-foreground">Vehicle</span>.</p>
                  </div>
                )}
                {req.status === 'assigned' && (
                  <div className="p-3.5 bg-blue-500/5 rounded-xl border border-blue-500/20 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-blue-500 font-bold text-xs"><Truck className="w-4 h-4" /> Dispatch & Transit Info</div>
                      {req.startTime && <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md flex items-center gap-1"><Clock className="w-3 h-3" /> Dispatched at {req.startTime}</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-card p-2 rounded-lg border border-border/50"><span className="text-[10px] text-muted-foreground block font-bold uppercase">Driver</span><span className="font-semibold">{req.driverName || 'Assigned'}</span></div>
                      <div className="bg-card p-2 rounded-lg border border-border/50"><span className="text-[10px] text-muted-foreground block font-bold uppercase">Supplier</span><span className="font-semibold">{req.supplierName || 'Assigned'}</span></div>
                      <div className="bg-card p-2 rounded-lg border border-border/50">
                        <span className="text-[10px] text-muted-foreground block font-bold uppercase">Vehicle</span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {req.vehicleType && <span className="px-1.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/25">{req.vehicleType}</span>}
                          <span className="font-semibold">{req.vehicleNumber || req.vehicle || 'Assigned'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {req.status === 'completed' && (
                  <div className="p-3.5 bg-emerald-500/5 rounded-xl border border-emerald-500/20 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs"><CheckCircle2 className="w-4 h-4" /> Delivered & Received</div>
                      {(req.duration || (req.startTime && (req.endTime || req.completionTime))) && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Duration: {req.duration || calculateDuration(req.startTime, req.endTime || req.completionTime)}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-card p-2 rounded-lg border border-border/50"><span className="text-[10px] text-muted-foreground block font-bold uppercase">Start</span><span className="font-semibold">{req.startTime || '-'}</span></div>
                      <div className="bg-card p-2 rounded-lg border border-border/50"><span className="text-[10px] text-muted-foreground block font-bold uppercase">End</span><span className="font-semibold">{req.endTime || req.completionTime || '-'}</span></div>
                      <div className="bg-card p-2 rounded-lg border border-border/50"><span className="text-[10px] text-muted-foreground block font-bold uppercase">Driver</span><span className="font-semibold">{req.driverName || '-'}</span></div>
                      <div className="bg-card p-2 rounded-lg border border-border/50"><span className="text-[10px] text-muted-foreground block font-bold uppercase">Status</span><span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> Received</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-card p-2 rounded-lg border border-border/50"><span className="text-[10px] text-muted-foreground block font-bold uppercase">Supplier</span><span className="font-semibold">{req.supplierName || '-'}</span></div>
                      <div className="bg-card p-2 rounded-lg border border-border/50">
                        <span className="text-[10px] text-muted-foreground block font-bold uppercase">Vehicle</span>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {req.vehicleType && <span className="px-1.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/25">{req.vehicleType}</span>}
                          <span className="font-semibold">{req.vehicleNumber || req.vehicle || '-'}</span>
                        </div>
                      </div>
                    </div>
                    {req.completionNotes && <p className="text-xs text-muted-foreground italic pt-1 border-t border-emerald-500/20">Notes: "{req.completionNotes}"</p>}
                  </div>
                )}
                {req.notes && <p className="text-xs text-muted-foreground italic">Staff note: "{req.notes}"</p>}
              </Card>
            );
          };

          return (
            <div className="space-y-5">
              {STATUS_GROUPS.map(group => {
                const groupItems = allFiltered.filter(r => (r.status || 'pending') === group.key);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group.key} className="space-y-3">
                    <div className={`flex items-center justify-between p-3 rounded-xl border ${group.headerClass}`}>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${group.badgeClass} border`}>{group.icon}</span>
                        <span className="font-bold text-sm text-foreground">{group.label}</span>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${group.badgeClass}`}>
                        {groupItems.length} Request{groupItems.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-3 pl-1">
                      {groupItems.map(req => renderCard(req))}
                    </div>
                  </div>
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
