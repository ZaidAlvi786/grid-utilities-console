import { WorkOrder, Invoice } from '../types/schemas';

// Safe coordinate boundaries for Great Houston Area
export const HOUSTON_BOUNDS = {
  latMin: 29.5,
  latMax: 30.3,
  lngMin: -96.0,
  lngMax: -95.0,
};

// Helper to parse dates from numeric Excel format or standard date strings
export const parseExcelDate = (val: any): string | null => {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel epoch starts on Dec 30, 1899 due to 1900 leap year bug
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  try {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch (e) {}
  return null;
};

// Generate a deterministic synthetic match between Invoice and Work Orders
export const runSyntheticJoin = (
  invoices: any[],
  workOrders: WorkOrder[]
): Invoice[] => {
  if (workOrders.length === 0) return [];
  return invoices.map((inv) => {
    const po = inv['PO #'] || inv.po_number || '';
    const invoiceNumber = (inv['Invoice #'] || inv.invoice_number || '').toString();
    const match = po.match(/WO_(\d+)_/);
    let woNumber = match ? match[1] : null;
    let linkSource: 'native' | 'synthetic' = 'native';

    let targetWO = workOrders.find((w) => w.work_order_number === woNumber);

    if (!targetWO) {
      linkSource = 'synthetic';
      // Seeded modulo hash based on PO batch number or invoice number
      const seedInput = match ? match[1] + invoiceNumber : invoiceNumber;
      let hash = 0;
      for (let i = 0; i < seedInput.length; i++) {
        hash = seedInput.charCodeAt(i) + ((hash << 5) - hash);
      }
      const idx = Math.abs(hash) % workOrders.length;
      targetWO = workOrders[idx];
      woNumber = targetWO.work_order_number;
    }

    return {
      id: inv.id || crypto.randomUUID(),
      invoice_number: invoiceNumber,
      created_date: parseExcelDate(inv['Created Date'] || inv.created_date),
      status: inv.Status || inv.status || 'Unapproved',
      po_number: po,
      work_order_id: targetWO.id || null,
      work_order_number: woNumber,
      link_source: linkSource,
      total: parseFloat(inv.Total || inv.total || '0'),
      unanswered_comments: (inv['Unanswered Comments'] || inv.unanswered_comments) === 'true' || (inv['Unanswered Comments'] || inv.unanswered_comments) === true,
      dispute_reason: inv['Dispute Reason'] || inv.dispute_reason || null,
    };
  });
};

// Categorize and derive Region / Area from address field
export const deriveArea = (address: string, latitude?: number, longitude?: number): string => {
  if (latitude && longitude) {
    const lat = latitude;
    const lng = longitude;
    if (lat >= 29.5 && lat <= 30.1 && lng >= -96.0 && lng <= -95.6) return 'KATY';
    if (lat >= 29.9 && lat <= 30.15 && lng >= -95.75 && lng <= -95.5) return 'CYPRESS';
    if (lat >= 30.0 && lat <= 30.25 && lng >= -95.65 && lng <= -95.35) return 'TOMBALL';
    if (lat >= 29.7 && lat <= 29.9 && lng >= -95.65 && lng <= -95.4) return 'BEAR CREEK';
    if (lat >= 29.95 && lat <= 30.2 && lng >= -95.5 && lng <= -95.25) return 'SPRING';
    if (lat >= 29.6 && lat <= 29.85 && lng >= -95.55 && lng <= -95.35) return 'SPRING BRANCH';
  }
  const upper = address.toUpperCase();
  if (upper.includes('CYPRESS')) return 'CYPRESS';
  if (upper.includes('TOMBALL')) return 'TOMBALL';
  if (upper.includes('KATY')) return 'KATY';
  if (upper.includes('SPRING')) {
    // Spring Branch contains zip prefix 77080
    if (upper.includes('77080') || upper.includes('77055') || upper.includes('SPRING BRANCH')) return 'SPRING BRANCH';
    return 'SPRING';
  }
  if (upper.includes('77084') || upper.includes('77095') || upper.includes('BEAR CREEK') || upper.includes('CLAY RD')) return 'BEAR CREEK';
  if (upper.includes('HOUSTON')) return 'HOUSTON';
  return 'HOUSTON';};

export const getFilterFingerprint = (filters: any): string => {
  return JSON.stringify({
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
    generalForeman: filters.generalForeman || 'All',
    foreman: filters.foreman || 'All',
    area: filters.area || 'All',
    status: filters.status || 'All',
  });
};

// Strict email validator that rejects pure-numeric usernames like "123@gmail.com"
export const validateEmailAddress = (val: string): string => {
  const trimmed = (val || '').trim();
  if (!trimmed) return 'Email address is required';

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return 'Please enter a valid email address (e.g. name@company.com)';
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) return 'Invalid email format';
  const [localPart, domainPart] = parts;

  // Disallow purely numeric username / local-part (e.g. "123@gmail.com")
  if (/^\d+$/.test(localPart)) {
    return 'Email username cannot consist only of numbers (e.g. 123@gmail.com is not allowed)';
  }

  if (localPart.length < 2) {
    return 'Email username must be at least 2 characters long';
  }

  const domainParts = domainPart.split('.');
  if (domainParts.some((p) => !p || /^\d+$/.test(p))) {
    return 'Please enter a valid domain name in email address';
  }

  return '';
};
