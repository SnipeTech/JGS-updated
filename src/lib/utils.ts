import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateDuration(startTime?: string, endTime?: string): string {
  if (!startTime || !endTime) return '';
  try {
    const parseTimeToMinutes = (tStr: string): number | null => {
      const clean = tStr.trim();
      const match = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
      if (!match) return null;
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const modifier = match[3]?.toUpperCase();
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    const startMins = parseTimeToMinutes(startTime);
    const endMins = parseTimeToMinutes(endTime);

    if (startMins !== null && endMins !== null) {
      let diff = endMins - startMins;
      if (diff < 0) diff += 24 * 60; // Overnight
      const hrs = Math.floor(diff / 60);
      const mins = diff % 60;
      if (hrs === 0) return `${mins} mins`;
      if (mins === 0) return `${hrs} hrs`;
      return `${hrs}h ${mins}m`;
    }
  } catch {
    // fallback
  }
  return '';
}

export function calculateDurationInHours(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 0;
  try {
    const parseTimeToMinutes = (tStr: string): number | null => {
      const clean = tStr.trim();
      const match = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
      if (!match) return null;
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const modifier = match[3]?.toUpperCase();
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    const startMins = parseTimeToMinutes(startTime);
    const endMins = parseTimeToMinutes(endTime);

    if (startMins !== null && endMins !== null) {
      let diff = endMins - startMins;
      if (diff < 0) diff += 24 * 60; // Overnight
      return Math.round((diff / 60) * 100) / 100;
    }
  } catch {
    // fallback
  }
  return 0;
}

export function formatTimeString(tStr?: string): string {
  if (!tStr) return '';
  const clean = tStr.trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return clean;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const mod = match[3] ? match[3].toUpperCase() : (h >= 12 ? 'PM' : 'AM');
  const formattedH = (h > 12 ? h - 12 : h === 0 ? 12 : h).toString().padStart(2, '0');
  return `${formattedH}:${m} ${mod}`;
}

export const TIME_SELECT_OPTIONS: string[] = (() => {
  const list: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const period = h < 12 ? 'AM' : 'PM';
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const formattedH = displayH.toString().padStart(2, '0');
      const formattedM = m.toString().padStart(2, '0');
      list.push(`${formattedH}:${formattedM} ${period}`);
    }
  }
  return list;
})();

export interface SiteStockItem {
  name: string;
  qty: number;
  rate: number;
  unit: string;
}

/**
 * Calculates current real-time available stock of materials at a specific site
 * from delivered requisitions, outbound transfers, and work logs.
 * Strictly returns only items with positive available stock (qty > 0).
 */
export function getSiteAvailableStock(
  targetSiteId: string,
  materialRequests: import('@/types').MaterialRequest[],
  dailyLogs: import('@/types').DailyLog[],
  materialSettings?: import('@/types').MaterialSetting[]
): SiteStockItem[] {
  if (!targetSiteId) return [];

  const stockMap: Record<string, { qty: number; totalCost: number; count: number; unit?: string }> = {};

  const cleanName = (rawName: string): string => {
    let bn = rawName.split(' (Transferred')[0];
    bn = bn.split(' (From ')[0];
    bn = bn.trim();
    if (bn.toLowerCase().includes('cement')) {
      bn = 'Cement Bag (50kg)';
    }
    return bn;
  };

  // 1. From completed MaterialRequests delivered TO this site
  (materialRequests || [])
    .filter(r => r.siteId === targetSiteId && r.status === 'completed')
    .forEach(r => {
      (r.items || []).forEach(it => {
        const name = cleanName(it.name);
        const qty = Number(it.quantity) || 0;
        const rate = Number(it.rate) || (qty > 0 ? (Number(it.amount) || 0) / qty : 0);
        if (!stockMap[name]) {
          stockMap[name] = { qty: 0, totalCost: 0, count: 0, unit: it.unit };
        }
        stockMap[name].qty += qty;
        stockMap[name].totalCost += rate * qty;
        stockMap[name].count += qty;
        if (it.unit && !stockMap[name].unit) stockMap[name].unit = it.unit;
      });
    });

  // 2. Minus any completed MaterialRequests transferred OUT from this site to another site
  (materialRequests || [])
    .filter(r => r.sourceType === 'site' && r.sourceSiteId === targetSiteId && r.status === 'completed')
    .forEach(r => {
      (r.items || []).forEach(it => {
        const name = cleanName(it.name);
        const qty = Number(it.quantity) || 0;
        if (!stockMap[name]) {
          stockMap[name] = { qty: 0, totalCost: 0, count: 0, unit: it.unit };
        }
        stockMap[name].qty -= qty;
      });
    });

  // 3. From dailyLogs for this site (includes direct logged stock or transfer in/out)
  (dailyLogs || [])
    .filter(l => l.siteId === targetSiteId)
    .forEach(log => {
      (log.materials || []).forEach(mat => {
        const name = cleanName(mat.name);
        const qty = Number(mat.quantity) || 0;
        const cost = Number(mat.cost) || 0;
        if (!stockMap[name]) {
          stockMap[name] = { qty: 0, totalCost: 0, count: 0 };
        }
        stockMap[name].qty += qty;
        if (qty > 0) {
          stockMap[name].totalCost += cost * qty;
          stockMap[name].count += qty;
        }
      });
    });

  // Filter only items with strictly positive available quantity:
  return Object.entries(stockMap)
    .filter(([_, data]) => data.qty > 0)
    .map(([name, data]) => {
      const setting = (materialSettings || []).find(m => m.name.toLowerCase() === name.toLowerCase());
      const avgRate = data.count > 0 ? Math.round(data.totalCost / data.count) : (setting?.defaultRate || 0);
      return {
        name,
        qty: data.qty,
        rate: avgRate > 0 ? avgRate : (setting?.defaultRate || 0),
        unit: data.unit || setting?.unit || 'units'
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * Strips star asterisks from the end of a product name
 * e.g. "Asian Paints Royale **" -> "Asian Paints Royale"
 */
export function getBaseMaterialName(name?: string): string {
  if (!name) return '';
  return name.replace(/\s*\*+$/, '').trim();
}

/**
 * Extracts how many asterisks/stars are at the end of a product name
 */
export function getMaterialStarCount(name?: string): number {
  if (!name) return 0;
  const match = name.trim().match(/\*+$/);
  return match ? match[0].length : 0;
}

export interface StorageStarBadgeInfo {
  baseName: string;
  batchNumber: number;
  isInitialBatch: boolean;
  isRestock: boolean;
  badgeLabel: string;
  shortBadge: string;
  badgeTooltip: string;
  colorVariant: 'initial' | 'restock_early' | 'restock_multi';
  starCount: number;
  starString: string;
  isNew: boolean;
  isOld: boolean;
  label: string;
  suggestedName: string;
  arrivalNote?: string;
}

/**
 * Calculates batch/replenishment status for a warehouse material:
 * Cleary identifies '🟢 New Stock' (Latest Arrival) vs '📦 Old Stock' (Previous/Earlier Arrivals).
 */
export function getStorageStarBadge(
  name?: string,
  existingMaterials: Array<{ id?: string; name: string; isStoreRoom?: boolean }> = [],
  storageDispatches: Array<{ materialName: string }> = [],
  currentId?: string
): StorageStarBadgeInfo {
  const baseName = getBaseMaterialName(name);
  if (!baseName) {
    return {
      baseName: '',
      batchNumber: 1,
      isInitialBatch: true,
      isRestock: false,
      badgeLabel: 'New Stock (Latest Arrival)',
      shortBadge: '🟢 New Stock',
      badgeTooltip: 'New warehouse stock entry',
      colorVariant: 'initial',
      starCount: 1,
      starString: '',
      isNew: true,
      isOld: false,
      label: 'New Stock',
      suggestedName: '',
      arrivalNote: 'Latest Arrival'
    };
  }

  // Check matching items in existing materials
  const matchingCatalog = (existingMaterials || []).filter(m => {
    return getBaseMaterialName(m.name).toLowerCase() === baseName.toLowerCase();
  });

  // If only 1 item or no matching items found
  if (matchingCatalog.length <= 1) {
    return {
      baseName,
      batchNumber: 1,
      isInitialBatch: true,
      isRestock: false,
      badgeLabel: 'New Stock (Latest Arrival)',
      shortBadge: '🟢 New Stock',
      badgeTooltip: 'New / Latest Stock in warehouse',
      colorVariant: 'initial',
      starCount: 1,
      starString: '',
      isNew: true,
      isOld: false,
      label: 'New Stock',
      suggestedName: baseName,
      arrivalNote: 'Latest Arrival'
    };
  }

  // Multiple items with same material name exist in warehouse!
  // Determine if current item is the latest or an older arrival
  const extractTime = (idStr?: string) => {
    const match = (idStr || '').match(/\d{10,}/);
    return match ? Number(match[0]) : 0;
  };

  const sorted = [...matchingCatalog].sort((a, b) => {
    const timeA = extractTime(a.id);
    const timeB = extractTime(b.id);
    if (timeA !== timeB) return timeB - timeA; // newest first
    return 0;
  });

  const idx = currentId ? sorted.findIndex(m => m.id === currentId) : 0;
  const isLatest = idx <= 0;

  if (isLatest) {
    return {
      baseName,
      batchNumber: sorted.length,
      isInitialBatch: false,
      isRestock: true,
      badgeLabel: 'New Stock (Latest Arrival)',
      shortBadge: '🟢 New Stock',
      badgeTooltip: 'Latest stock arrival for this item',
      colorVariant: 'initial',
      starCount: sorted.length,
      starString: '',
      isNew: true,
      isOld: false,
      label: 'New Stock',
      suggestedName: baseName,
      arrivalNote: 'Latest Arrival'
    };
  }

  // Older stock arrival
  const arrivalIndex = idx; // 1 for first previous, 2 for earlier, etc.
  const arrivalNote = arrivalIndex === 1 ? 'Previous Arrival' : `Earlier Arrival #${arrivalIndex}`;

  return {
    baseName,
    batchNumber: sorted.length - idx,
    isInitialBatch: false,
    isRestock: true,
    badgeLabel: `Old Stock (${arrivalNote})`,
    shortBadge: '📦 Old Stock',
    badgeTooltip: `Old Stock - ${arrivalNote} of this material`,
    colorVariant: idx === 1 ? 'restock_early' : 'restock_multi',
    starCount: idx,
    starString: '',
    isNew: false,
    isOld: true,
    label: 'Old Stock',
    suggestedName: baseName,
    arrivalNote
  };
}

export interface StoreRoomStockClassification {
  isNewStock: boolean;
  isOldStock: boolean;
  isDuplicateName: boolean;
  badgeLabel: string;
  badgeTag: string;
  arrivalNote: string;
  colorVariant: 'new' | 'old_prev' | 'old_earlier';
  orderIndex: number;
  totalDuplicates: number;
}

export function getStoreRoomStockClassification(
  item: { id?: string; name: string; buyingPrice?: number; createdAt?: string },
  allStoreItems: Array<{ id?: string; name: string; buyingPrice?: number; createdAt?: string }> = []
): StoreRoomStockClassification {
  const baseName = getBaseMaterialName(item?.name).toLowerCase().trim();
  if (!baseName) {
    return {
      isNewStock: true,
      isOldStock: false,
      isDuplicateName: false,
      badgeLabel: 'New Stock',
      badgeTag: '🟢 New Stock',
      arrivalNote: 'In Stock',
      colorVariant: 'new',
      orderIndex: 0,
      totalDuplicates: 1
    };
  }

  const sameNameItems = allStoreItems.filter(
    m => getBaseMaterialName(m.name).toLowerCase().trim() === baseName
  );

  if (sameNameItems.length <= 1) {
    return {
      isNewStock: true,
      isOldStock: false,
      isDuplicateName: false,
      badgeLabel: 'New Stock',
      badgeTag: '🟢 New Stock',
      arrivalNote: 'In Stock',
      colorVariant: 'new',
      orderIndex: 0,
      totalDuplicates: 1
    };
  }

  const extractTime = (idStr?: string) => {
    const match = (idStr || '').match(/\d{10,}/);
    return match ? Number(match[0]) : 0;
  };

  const sorted = [...sameNameItems].sort((a, b) => {
    const timeA = extractTime(a.id);
    const timeB = extractTime(b.id);
    if (timeA !== timeB) return timeB - timeA;
    return 0;
  });

  const idx = sorted.findIndex(m => m.id === item.id);
  const isNewest = idx === 0 || idx === -1;

  if (isNewest) {
    return {
      isNewStock: true,
      isOldStock: false,
      isDuplicateName: true,
      badgeLabel: 'New Stock (Latest Arrival)',
      badgeTag: '🟢 New Stock',
      arrivalNote: 'Latest Arrival',
      colorVariant: 'new',
      orderIndex: 0,
      totalDuplicates: sameNameItems.length
    };
  }

  const arrivalNum = idx;
  const subNote = arrivalNum === 1 ? 'Previous Arrival' : `Earlier Arrival #${arrivalNum}`;

  return {
    isNewStock: false,
    isOldStock: true,
    isDuplicateName: true,
    badgeLabel: `Old Stock (${subNote})`,
    badgeTag: '📦 Old Stock',
    arrivalNote: subNote,
    colorVariant: idx === 1 ? 'old_prev' : 'old_earlier',
    orderIndex: idx,
    totalDuplicates: sameNameItems.length
  };
}

