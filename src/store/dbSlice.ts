import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { runSyntheticJoin, deriveArea } from '../utils/helpers';
import { supabase } from '../utils/supabaseClient';
import workOrdersSeed from '../assets/synthetic_work_orders.json';
import invoicesSeed from '../assets/synthetic_invoices.json';

export interface DbState {
  workOrders: any[];
  invoices: any[];
  overrides: Record<string, {
    add_amount: number;
    remove_amount: number;
    profit_margin_override: number | null;
  }>;
  dailyExpenseRate: number;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const initialState: DbState = {
  workOrders: [],
  invoices: [],
  overrides: {},
  dailyExpenseRate: 5800,
  status: 'idle',
};

export const fetchDbState = createAsyncThunk('db/fetchDbState', async () => {
  try {
    const { data: wos, error: woError } = await supabase.from('work_orders').select('*');
    const { data: invs, error: invError } = await supabase.from('invoices').select('*');
    const { data: ovrs, error: ovrError } = await supabase.from('expense_overrides').select('*');

    if (woError || invError || ovrError) {
       console.warn('Supabase fetch failed, falling back to local seed data.');
       return {
         workOrders: workOrdersSeed,
         invoices: (runSyntheticJoin(invoicesSeed, workOrdersSeed as any)),
         overrides: {}
       };
    }

    const overridesMap: Record<string, any> = {};
    if (ovrs) {
      ovrs.forEach((item: any) => {
        overridesMap[item.filter_fingerprint] = {
          add_amount: item.add_amount,
          remove_amount: item.remove_amount,
          profit_margin_override: item.profit_margin_override
        };
      });
    }

    return {
      workOrders: (wos && wos.length > 0 ? wos : workOrdersSeed).map((w: any) => ({ ...w, area: w.area || deriveArea(w.address || '', w.latitude || w._latitude, w.longitude || w._longitude) })),
      invoices: invs && invs.length > 0 ? (runSyntheticJoin(invs, (wos && wos.length > 0 ? wos : workOrdersSeed) as any)) : (runSyntheticJoin(invoicesSeed, workOrdersSeed as any)),
      overrides: overridesMap
    };
  } catch (err) {
    console.warn('Supabase fetching failed, loading seed defaults.', err);
    return {
      workOrders: workOrdersSeed,
      invoices: (runSyntheticJoin(invoicesSeed, workOrdersSeed as any)),
      overrides: {}
    };
  }
});

export const uploadWorkOrdersThunk = createAsyncThunk('db/uploadWorkOrders', async (wos: any[]) => {
  const formatted = wos.map(w => ({
    work_order_number: w.work_order_number,
    status: w.status || 'Work Pending',
    general_foreman: w.general_foreman,
    foreman: w.foreman,
    area: w.area || deriveArea(w.address || '', w.latitude, w.longitude),
    address: w.address,
    latitude: w.latitude,
    longitude: w.longitude,
    locate_renewal_date: w.locate_renewal_date || null,
    customer_need_date: w.customer_need_date || null,
    locked_gates: !!w.locked_gates,
    outage_required: !!w.outage_required,
    permitting_needed: !!w.permitting_needed,
    switching_required: !!w.switching_required,
    traffic_control_needed: !!w.traffic_control_needed,
    hydrovac_needed: !!w.hydrovac_needed,
    tree_trimming_needed: !!w.tree_trimming_needed
  }));

  const { data, error } = await supabase.from('work_orders').upsert(formatted, { onConflict: 'work_order_number' }).select();
  if (error) throw error;
  return data;
});

export const uploadInvoicesThunk = createAsyncThunk('db/uploadInvoices', async (invs: any[]) => {
  const formatted = invs.map(i => ({
    invoice_number: i.invoice_number,
    work_order_number: i.work_order_number,
    status: i.status || 'Unapproved',
    po_number: i.po_number,
    total: i.total,
    created_date: i.created_date || null,
    unanswered_comments: !!i.unanswered_comments,
    dispute_reason: i.dispute_reason || null
  }));

  const { data, error } = await supabase.from('invoices').upsert(formatted, { onConflict: 'invoice_number' }).select();
  if (error) throw error;
  return data;
});

export const uploadJoinedMasterThunk = createAsyncThunk('db/uploadJoinedMaster', async (masterRows: any[]) => {
  const workOrdersToUpload = masterRows.map(row => ({
    work_order_number: row.work_order_number,
    status: row.status || 'Work Pending',
    general_foreman: row.general_foreman,
    foreman: row.foreman,
    area: row.area || deriveArea(row.address || '', row.latitude, row.longitude),
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    locate_renewal_date: row.locate_renewal_date || null,
    customer_need_date: row.customer_need_date || null,
    locked_gates: !!row.locked_gates,
    outage_required: !!row.outage_required,
    permitting_needed: !!row.permitting_needed,
    switching_required: !!row.switching_required,
    traffic_control_needed: !!row.traffic_control_needed,
    hydrovac_needed: !!row.hydrovac_needed,
    tree_trimming_needed: !!row.tree_trimming_needed
  }));

  const invoicesToUpload = masterRows
    .filter(row => row.invoice_number)
    .map(row => ({
      invoice_number: row.invoice_number,
      work_order_number: row.work_order_number,
      status: row.invoice_status || 'Unapproved',
      po_number: row.po_number || ('PO_' + row.work_order_number),
      total: row.total || 0,
      created_date: row.created_date || null,
      unanswered_comments: !!row.unanswered_comments,
      dispute_reason: row.dispute_reason || null
    }));

  // 1. Sequentially bulk upload work_orders
  const { data: woData, error: woError } = await supabase.from('work_orders').upsert(workOrdersToUpload, { onConflict: 'work_order_number' }).select();
  if (woError) throw woError;

  // 2. Sequentially bulk upload invoices
  let invData: any[] = [];
  if (invoicesToUpload.length > 0) {
    const { data: iData, error: invError } = await supabase.from('invoices').upsert(invoicesToUpload, { onConflict: 'invoice_number' }).select();
    if (invError) throw invError;
    invData = iData || [];
  }

  return { workOrders: woData || [], invoices: invData };
});

export const saveOverrideThunk = createAsyncThunk('db/saveOverride', async (override: any) => {
  const formatted = {
    filter_fingerprint: override.filter_fingerprint,
    add_amount: override.add_amount || 0.0,
    remove_amount: override.remove_amount || 0.0,
    profit_margin_override: override.profit_margin_override
  };
  const { error } = await supabase.from('expense_overrides').upsert(formatted, { onConflict: 'filter_fingerprint' }).select();
  if (error) throw error;
  return formatted;
});

export const dbSlice = createSlice({
  name: 'db',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDbState.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchDbState.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.workOrders = action.payload.workOrders;
        state.invoices = action.payload.invoices;
        state.overrides = action.payload.overrides;
      })
      .addCase(fetchDbState.rejected, (state) => {
        state.status = 'failed';
      })
      .addCase(uploadWorkOrdersThunk.fulfilled, (state, action) => {
        action.payload.forEach((item: any) => {
          const idx = state.workOrders.findIndex(w => w.work_order_number === item.work_order_number);
          if (idx !== -1) {
            state.workOrders[idx] = item;
          } else {
            state.workOrders.push(item);
          }
        });
      })
      .addCase(uploadInvoicesThunk.fulfilled, (state, action) => {
        const joinedInvoices = runSyntheticJoin(action.payload, state.workOrders);
        joinedInvoices.forEach((item: any) => {
          const idx = state.invoices.findIndex(i => i.invoice_number === item.invoice_number);
          if (idx !== -1) {
            state.invoices[idx] = item;
          } else {
            state.invoices.push(item);
          }
        });
      })
      .addCase(uploadJoinedMasterThunk.fulfilled, (state, action) => {
        action.payload.workOrders.forEach((item: any) => {
          const idx = state.workOrders.findIndex(w => w.work_order_number === item.work_order_number);
          if (idx !== -1) {
            state.workOrders[idx] = item;
          } else {
            state.workOrders.push(item);
          }
        });
        const joinedInvoices = runSyntheticJoin(action.payload.invoices, state.workOrders);
        joinedInvoices.forEach((item: any) => {
          const idx = state.invoices.findIndex(i => i.invoice_number === item.invoice_number);
          if (idx !== -1) {
            state.invoices[idx] = item;
          } else {
            state.invoices.push(item);
          }
        });
      })
      .addCase(saveOverrideThunk.fulfilled, (state, action) => {
        const { filter_fingerprint, add_amount, remove_amount, profit_margin_override } = action.payload;
        state.overrides[filter_fingerprint] = { add_amount, remove_amount, profit_margin_override };
      });
  }
});

export default dbSlice.reducer;
