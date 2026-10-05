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

