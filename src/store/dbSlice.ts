import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../utils/supabaseClient';
import { Invoice, LaborEntry, LaborRateCategory } from '../types/schemas';
import { runSyntheticJoin, deriveArea, DEFAULT_LABOR_RATE_CATEGORIES, classifyLaborRole } from '../utils/helpers';
import workOrdersSeed from '../assets/synthetic_work_orders.json';
import invoicesSeed from '../assets/synthetic_invoices.json';

export interface ReconciliationSummary {
  uploadedType: 'work_orders' | 'invoices' | 'timesheet' | 'master';
  rowsAdded: number;
  affectedWorkOrdersCount: number;
  movedToMarginCalculated: number;
  movedToAwaitingLabor: number;
  timestamp: string;
}

export interface DbState {
  workOrders: any[];
  invoices: Invoice[];
  laborEntries: LaborEntry[];
  laborRateCategories: LaborRateCategory[];
  overrides: Record<string, { add_amount: number; remove_amount: number; profit_margin_override?: number }>;
  dailyExpenseRate: number;
  reconciliationSummary: ReconciliationSummary | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const LOCAL_TIMESHEET_KEY = 'grid_utilities_timesheets_v3';
const LOCAL_OVERRIDES_KEY = 'grid_utilities_overrides_v3';

// Helper to load persisted timesheets from browser storage
const loadPersistedTimesheets = (): LaborEntry[] => {
  try {
    const raw = localStorage.getItem(LOCAL_TIMESHEET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [];
};

// Helper to save timesheets to browser storage
const savePersistedTimesheets = (entries: LaborEntry[]) => {
  try {
    localStorage.setItem(LOCAL_TIMESHEET_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Could not save timesheets to localStorage quota:', e);
  }
};

// Helper to load persisted overrides
const loadPersistedOverrides = (): Record<string, any> => {
  try {
    const raw = localStorage.getItem(LOCAL_OVERRIDES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
};

const savePersistedOverrides = (overrides: Record<string, any>) => {
  try {
    localStorage.setItem(LOCAL_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {}
};

// Helper to deduplicate items by primary key before Supabase upsert
const deduplicateByKey = <T>(items: T[], keyFn: (item: T) => string): T[] => {
  const map = new Map<string, T>();
  items.forEach((item) => {
    const key = keyFn(item);
    if (key) map.set(key, item);
  });
  return Array.from(map.values());
};

// Fetch all rows from Supabase with automatic pagination (bypasses 1000-row limit)
const fetchAllRows = async (table: string): Promise<any[]> => {
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select('*').range(from, to);
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }
  return allRows;
};

// Upsert items in safe batches of 500 to prevent payload limits
const upsertInChunks = async (table: string, items: any[], onConflictKey: string) => {
  const chunkSize = 500;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await supabase.from(table).upsert(chunk, { onConflict: onConflictKey });
  }
};

// Generate realistic Connecteam labor seed data for local offline development
const generateInitialLaborSeed = (wos: any[]): LaborEntry[] => {
  const names = [
    { name: 'John Doe', rate: 55.70 },
    { name: 'Robert Smith', rate: 54.70 },
    { name: 'Michael Johnson', rate: 51.16 },
    { name: 'David Williams', rate: 38.37 },
    { name: 'James Brown', rate: 25.66 },
    { name: 'Carlos Martinez', rate: 15.00 },
    { name: 'Luis Garcia', rate: 17.79 },
    { name: 'Kevin Davis', rate: 30.70 },
    { name: 'Brian Wilson', rate: 54.57 },
  ];

  const entries: LaborEntry[] = [];
  const targetWos = wos.slice(0, 45);

  targetWos.forEach((wo, wIdx) => {
    const shiftCount = 2 + (wIdx % 4);
    for (let i = 0; i < shiftCount; i++) {
      const person = names[(wIdx + i) % names.length];
      const hours = 8.0 + ((i % 3) === 0 ? 0.5 : 0);
      const lineCost = parseFloat((hours * person.rate).toFixed(2));
      const dayOffset = (wIdx * 2 + i) % 30;
      const d = new Date('2026-08-18');
      d.setDate(d.getDate() - dayOffset);
      const shiftDate = d.toISOString().split('T')[0];

      entries.push({
        id: 'seed-labor-' + wIdx + '-' + i,
        work_order_number: wo.work_order_number,
        employee_name: person.name,
        shift_date: shiftDate,
        clock_in: '07:00',
        clock_out: hours === 8.5 ? '15:30' : '15:00',
        shift_hours: hours,
        hourly_rate: person.rate,
        line_labor_cost: lineCost,
        role_category: classifyLaborRole(person.rate, DEFAULT_LABOR_RATE_CATEGORIES),
      });
    }
  });

  return entries;
};

const savedTimesheets = loadPersistedTimesheets();
const initialLaborSeed = savedTimesheets.length > 0 ? savedTimesheets : generateInitialLaborSeed(workOrdersSeed as any);

const initialState: DbState = {
  workOrders: workOrdersSeed as any,
  invoices: runSyntheticJoin(invoicesSeed, workOrdersSeed as any),
  laborEntries: initialLaborSeed,
  laborRateCategories: DEFAULT_LABOR_RATE_CATEGORIES,
  overrides: loadPersistedOverrides(),
  dailyExpenseRate: 5800,
  reconciliationSummary: null,
  status: 'idle',
};

export const fetchDbState = createAsyncThunk('db/fetchDbState', async () => {
  try {
    const [wos, invs, ovrs] = await Promise.all([
      fetchAllRows('work_orders'),
      fetchAllRows('invoices'),
      fetchAllRows('expense_overrides')
    ]);

    const persistedLabor = loadPersistedTimesheets();
    const persistedOverrides = loadPersistedOverrides();

    const ovrMap: Record<string, any> = { ...persistedOverrides };
    (ovrs || []).forEach((item: any) => {
      ovrMap[item.filter_fingerprint] = {
        add_amount: item.add_amount,
        remove_amount: item.remove_amount,
        profit_margin_override: item.profit_margin_override,
      };
    });

    const parsedWorkOrders = (wos && wos.length > 0 ? wos : workOrdersSeed).map((w: any) => {
      const isCompleted = w.status === 'Field Complete' || w.status === 'CTCC Completed' || w.status === 'Ready to Bill';
      return {
        ...w,
        locate_renewal_date: w.locate_renewal_date || null,
        date_work_completed: w.date_work_completed || (isCompleted ? (w.customer_need_date || '2026-08-15') : null),
        customer_need_date: w.customer_need_date || null,
        area: w.area || deriveArea(w.address || '', w.latitude, w.longitude),
      };
    });

    const parsedInvoices = runSyntheticJoin(
      invs && invs.length > 0 ? invs : invoicesSeed,
      parsedWorkOrders
    );

    return {
      workOrders: parsedWorkOrders,
      invoices: parsedInvoices,
      laborEntries: persistedLabor.length > 0 ? persistedLabor : initialLaborSeed,
      laborRateCategories: DEFAULT_LABOR_RATE_CATEGORIES,
      overrides: ovrMap,
    };
  } catch (error) {
    console.error('Error in fetchDbState:', error);
    const persistedLabor = loadPersistedTimesheets();
    return {
      workOrders: workOrdersSeed as any,
      invoices: runSyntheticJoin(invoicesSeed, workOrdersSeed as any),
      laborEntries: persistedLabor.length > 0 ? persistedLabor : initialLaborSeed,
      laborRateCategories: DEFAULT_LABOR_RATE_CATEGORIES,
      overrides: loadPersistedOverrides(),
    };
  }
});

export const uploadWorkOrdersThunk = createAsyncThunk(
  'db/uploadWorkOrders',
  async (workOrders: any[]) => {
    const formatted = workOrders.map((wo) => {
      const isCompleted = wo.status === 'Field Complete' || wo.status === 'CTCC Completed' || wo.status === 'Ready to Bill';
      return {
        work_order_number: String(wo.work_order_number).trim(),
        status: wo.status || 'Work Pending',
        general_foreman: wo.general_foreman || 'Unassigned GF',
        foreman: wo.foreman || 'Unassigned Foreman',
        area: wo.area || deriveArea(wo.address || '', wo.latitude, wo.longitude),
        address: wo.address || '',
        latitude: wo.latitude || 29.7604,
        longitude: wo.longitude || -95.3698,
        locate_renewal_date: wo.locate_renewal_date || null,
        date_work_completed: wo.date_work_completed || (isCompleted ? (wo.customer_need_date || '2026-08-15') : null),
        customer_need_date: wo.customer_need_date || null,
        locked_gates: !!wo.locked_gates,
        outage_required: !!wo.outage_required,
        permitting_needed: !!wo.permitting_needed,
        switching_required: !!wo.switching_required,
        traffic_control_needed: !!wo.traffic_control_needed,
        hydrovac_needed: !!wo.hydrovac_needed,
        tree_trimming_needed: !!wo.tree_trimming_needed,
      };
    });

    try {
      const deduplicatedWos = deduplicateByKey(formatted, (w) => w.work_order_number);
      const remotePayload = deduplicatedWos.map(({ date_work_completed, ...rest }) => rest);
      await upsertInChunks('work_orders', remotePayload, 'work_order_number');
      return deduplicatedWos;
    } catch (e) {
      console.warn('Supabase work orders upsert error:', e);
      return formatted;
    }
  }
);

export const uploadInvoicesThunk = createAsyncThunk(
  'db/uploadInvoices',
  async (invoices: any[]) => {
    const formatted = invoices.map((inv) => ({
      invoice_number: String(inv.invoice_number).trim(),
      work_order_number: inv.work_order_number ? String(inv.work_order_number).trim() : null,
      status: inv.status || 'Unapproved',
      po_number: inv.po_number || '',
      total: typeof inv.total === 'number' ? inv.total : parseFloat(inv.total || '0'),
      created_date: inv.created_date || null,
      unanswered_comments: !!inv.unanswered_comments,
      dispute_reason: inv.dispute_reason || null,
    }));

    try {
      const deduplicatedInvoices = deduplicateByKey(formatted, (i) => i.invoice_number);

      // Ensure referenced parent work orders exist in Supabase to satisfy foreign key constraints
      const referencedWos = Array.from(new Set(deduplicatedInvoices.map(i => i.work_order_number).filter(Boolean)));
      if (referencedWos.length > 0) {
        const stubs = referencedWos.map(woNum => ({
          work_order_number: woNum,
          status: 'Work Pending',
          general_foreman: 'Unassigned GF',
          foreman: 'Unassigned Foreman',
          address: 'Pending Location',
          area: 'HOUSTON'
        }));
        await upsertInChunks('work_orders', stubs, 'work_order_number');
      }

      await upsertInChunks('invoices', deduplicatedInvoices, 'invoice_number');
      return deduplicatedInvoices;
    } catch (e) {
      console.warn('Supabase invoices upsert error:', e);
      return formatted;
    }
  }
);

export const uploadTimesheetThunk = createAsyncThunk(
  'db/uploadTimesheet',
  async (entries: LaborEntry[]) => {
    const formatted = entries.map((e) => ({
      id: e.id || ('labor-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
      work_order_number: String(e.work_order_number).trim(),
      employee_name: e.employee_name,
      shift_date: e.shift_date,
      clock_in: e.clock_in || null,
      clock_out: e.clock_out || null,
      shift_hours: e.shift_hours,
      hourly_rate: e.hourly_rate,
      line_labor_cost: e.line_labor_cost,
      role_category: e.role_category,
    }));

    return formatted;
  }
);

export const uploadJoinedMasterThunk = createAsyncThunk('db/uploadJoinedMaster', async (masterRows: any[]) => {
  const workOrdersToUpload = masterRows.map((row) => {
    const isCompleted = row.status === 'Field Complete' || row.status === 'CTCC Completed' || row.status === 'Ready to Bill';
    return {
      work_order_number: String(row.work_order_number).trim(),
      status: row.status || 'Work Pending',
      general_foreman: row.general_foreman || 'Unassigned GF',
      foreman: row.foreman || 'Unassigned Foreman',
      area: row.area || deriveArea(row.address || '', row.latitude, row.longitude),
      address: row.address || '',
      latitude: row.latitude || 29.7604,
      longitude: row.longitude || -95.3698,
      locate_renewal_date: row.locate_renewal_date || null,
      date_work_completed: row.date_work_completed || (isCompleted ? (row.customer_need_date || '2026-08-15') : null),
      customer_need_date: row.customer_need_date || null,
      locked_gates: !!row.locked_gates,
      outage_required: !!row.outage_required,
      permitting_needed: !!row.permitting_needed,
      switching_required: !!row.switching_required,
      traffic_control_needed: !!row.traffic_control_needed,
      hydrovac_needed: !!row.hydrovac_needed,
      tree_trimming_needed: !!row.tree_trimming_needed,
    };
  });

  const invoicesToUpload = masterRows
    .filter((row) => row.invoice_number)
    .map((row) => ({
      invoice_number: String(row.invoice_number).trim(),
      work_order_number: String(row.work_order_number).trim(),
      status: row.invoice_status || 'Unapproved',
      po_number: row.po_number || 'PO_' + row.work_order_number,
      total: typeof row.total === 'number' ? row.total : parseFloat(row.total || '0'),
      created_date: row.created_date || null,
      unanswered_comments: !!row.unanswered_comments,
      dispute_reason: row.dispute_reason || null,
    }));

  try {
    const dedupedWos = deduplicateByKey(workOrdersToUpload, (w) => w.work_order_number);
    const remotePayload = dedupedWos.map(({ date_work_completed, ...rest }) => rest);
    await upsertInChunks('work_orders', remotePayload, 'work_order_number');

    let invData: any[] = [];
    if (invoicesToUpload.length > 0) {
      const dedupedInvoices = deduplicateByKey(invoicesToUpload, (i) => i.invoice_number);
      await upsertInChunks('invoices', dedupedInvoices, 'invoice_number');
      invData = dedupedInvoices;
    }

    return { workOrders: dedupedWos, invoices: invData.length > 0 ? invData : invoicesToUpload };
  } catch (e) {
    return { workOrders: workOrdersToUpload, invoices: invoicesToUpload };
  }
});

export const saveOverrideThunk = createAsyncThunk('db/saveOverride', async (override: any) => {
  const formatted = {
    filter_fingerprint: override.filter_fingerprint,
    add_amount: override.add_amount || 0.0,
    remove_amount: override.remove_amount || 0.0,
    profit_margin_override: override.profit_margin_override,
  };
  try {
    await supabase.from('expense_overrides').upsert(formatted, { onConflict: 'filter_fingerprint' }).select();
  } catch (e) {}
  return formatted;
});

// Calculate scoped reconciliation summary based on affected work orders
const calculateReconciliation = (
  affectedWoNumbers: string[],
  invoices: any[],
  laborEntries: LaborEntry[],
  uploadedType: 'work_orders' | 'invoices' | 'timesheet' | 'master',
  rowsAdded: number
): ReconciliationSummary => {
  const uniqueWos = Array.from(new Set(affectedWoNumbers.filter(Boolean)));
  let movedToMarginCalculated = 0;
  let movedToAwaitingLabor = 0;

  uniqueWos.forEach((woNum) => {
    const hasInvoice = invoices.some((i) => i.work_order_number === woNum && i.total > 0);
    const hasLabor = laborEntries.some((l) => l.work_order_number === woNum && l.shift_hours > 0);

    if (hasInvoice && hasLabor) {
      movedToMarginCalculated++;
    } else if (hasInvoice && !hasLabor) {
      movedToAwaitingLabor++;
    }
  });

  return {
    uploadedType,
    rowsAdded,
    affectedWorkOrdersCount: uniqueWos.length,
    movedToMarginCalculated,
    movedToAwaitingLabor,
    timestamp: new Date().toLocaleTimeString(),
  };
};

export const dbSlice = createSlice({
  name: 'db',
  initialState,
  reducers: {
    clearReconciliationSummary: (state) => {
      state.reconciliationSummary = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDbState.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchDbState.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.workOrders = action.payload.workOrders;
        state.invoices = action.payload.invoices;
        state.laborEntries = action.payload.laborEntries;
        state.laborRateCategories = action.payload.laborRateCategories;
        state.overrides = action.payload.overrides;
      })
      .addCase(fetchDbState.rejected, (state) => {
        state.status = 'failed';
      })
      .addCase(uploadWorkOrdersThunk.fulfilled, (state, action) => {
        const affected: string[] = [];
        action.payload.forEach((item: any) => {
          affected.push(item.work_order_number);
          const idx = state.workOrders.findIndex((w) => w.work_order_number === item.work_order_number);
          if (idx !== -1) {
            state.workOrders[idx] = { ...state.workOrders[idx], ...item };
          } else {
            state.workOrders.push(item);
          }
        });
        state.reconciliationSummary = calculateReconciliation(
          affected,
          state.invoices,
          state.laborEntries,
          'work_orders',
          action.payload.length
        );
      })
      .addCase(uploadInvoicesThunk.fulfilled, (state, action) => {
        const joinedInvoices = runSyntheticJoin(action.payload, state.workOrders);
        const affected: string[] = [];
        joinedInvoices.forEach((item: any) => {
          if (item.work_order_number) affected.push(item.work_order_number);
          const idx = state.invoices.findIndex((i) => i.invoice_number === item.invoice_number);
          if (idx !== -1) {
            state.invoices[idx] = { ...state.invoices[idx], ...item };
          } else {
            state.invoices.push(item);
          }
        });
        state.reconciliationSummary = calculateReconciliation(
          affected,
          state.invoices,
          state.laborEntries,
          'invoices',
          action.payload.length
        );
      })
      .addCase(uploadTimesheetThunk.fulfilled, (state, action) => {
        const affected: string[] = [];
        action.payload.forEach((entry: LaborEntry) => {
          affected.push(entry.work_order_number);
          state.laborEntries.unshift(entry);
        });
        savePersistedTimesheets(state.laborEntries);
        state.reconciliationSummary = calculateReconciliation(
          affected,
          state.invoices,
          state.laborEntries,
          'timesheet',
          action.payload.length
        );
      })
      .addCase(uploadJoinedMasterThunk.fulfilled, (state, action) => {
        const affected: string[] = [];
        action.payload.workOrders.forEach((item: any) => {
          affected.push(item.work_order_number);
          const idx = state.workOrders.findIndex((w) => w.work_order_number === item.work_order_number);
          if (idx !== -1) {
            state.workOrders[idx] = { ...state.workOrders[idx], ...item };
          } else {
            state.workOrders.push(item);
          }
        });
        const joinedInvoices = runSyntheticJoin(action.payload.invoices, state.workOrders);
        joinedInvoices.forEach((item: any) => {
          if (item.work_order_number) affected.push(item.work_order_number);
          const idx = state.invoices.findIndex((i) => i.invoice_number === item.invoice_number);
          if (idx !== -1) {
            state.invoices[idx] = { ...state.invoices[idx], ...item };
          } else {
            state.invoices.push(item);
          }
        });
        state.reconciliationSummary = calculateReconciliation(
          affected,
          state.invoices,
          state.laborEntries,
          'master',
          action.payload.workOrders.length
        );
      })
      .addCase(saveOverrideThunk.fulfilled, (state, action) => {
        const { filter_fingerprint, add_amount, remove_amount, profit_margin_override } = action.payload;
        state.overrides[filter_fingerprint] = { add_amount, remove_amount, profit_margin_override };
        savePersistedOverrides(state.overrides);
      });
  },
});

export const { clearReconciliationSummary } = dbSlice.actions;
export default dbSlice.reducer;
