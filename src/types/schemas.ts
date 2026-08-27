import { z } from 'zod';

export const WorkOrderSchema = z.object({
  id: z.string().uuid().optional(),
  work_order_number: z.union([z.number(), z.string()]).transform((val) => val.toString()),
  status: z.enum(['Work Pending', 'Field Check', 'Field Complete', 'CTCC Completed', 'Ready to Bill']),
  general_foreman: z.string().min(1),
  foreman: z.string().min(1),
  address: z.string().min(1),
  area: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  customer_need_date: z.any().optional(),
  date_locates_called_in: z.any().optional(),
  locate_ticket_number: z.any().transform((val) => (val ? val.toString() : null)).nullable().optional(),
  expiration_date: z.any().optional(),
  locate_renewal_date: z.any().optional(),
  renewal_expiration_date: z.any().optional(),
  switching_required: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  outage_required: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  outage_notes: z.string().nullable().optional(),
  permitting_needed: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  locked_gates: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  traffic_control_needed: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  traffic_control_notes: z.string().nullable().optional(),
  hydrovac_needed: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  hydrovac_notes: z.string().nullable().optional(),
  tree_trimming_needed: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  notes: z.string().nullable().optional(),
  date_work_completed: z.any().optional(),
  post_construction_asbuilt: z.string().nullable().optional(),
  post_construction_notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

export const InvoiceSchema = z.object({
  id: z.string().uuid().optional(),
  invoice_number: z.union([z.number(), z.string()]).transform((val) => val.toString()),
  created_date: z.any(),
  status: z.enum(['Approved', 'Unapproved']),
  po_number: z.string().min(1),
  work_order_id: z.string().uuid().nullable().optional(),
  work_order_number: z.string().nullable().optional(),
  link_source: z.enum(['native', 'synthetic']).default('synthetic'),
  total: z.any().transform((val) => parseFloat(val) || 0.0),
  unanswered_comments: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  dispute_reason: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

// Combine both for Joined Master validation
export const MasterJoinedSchema = z.object({
  work_order_number: z.union([z.number(), z.string()]).transform((val) => val.toString()),
  status: z.enum(['Work Pending', 'Field Check', 'Field Complete', 'CTCC Completed', 'Ready to Bill']),
  general_foreman: z.string().min(1),
  foreman: z.string().min(1),
  address: z.string().min(1),
  area: z.string().optional(),
  latitude: z.any().transform((val) => val !== null && val !== undefined ? parseFloat(val) : null).optional(),
  longitude: z.any().transform((val) => val !== null && val !== undefined ? parseFloat(val) : null).optional(),
  switching_required: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  outage_required: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  permitting_needed: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  locked_gates: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  traffic_control_needed: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  hydrovac_needed: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  tree_trimming_needed: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
  
  // Invoice part
  invoice_number: z.union([z.number(), z.string()]).optional().nullable().transform((val) => val ? val.toString() : null),
  invoice_status: z.enum(['Approved', 'Unapproved']).optional().nullable(),
  po_number: z.string().optional().nullable(),
  total: z.any().transform((val) => val !== null && val !== undefined ? parseFloat(val) : 0.0).optional(),
  created_date: z.any().optional().nullable(),
  unanswered_comments: z.any().transform((v) => v === true || v === 'yes' || v === 'true').optional().default(false),
});

export const ExpenseOverrideSchema = z.object({
  filter_fingerprint: z.string().min(1),
  add_amount: z.number().default(0),
  remove_amount: z.number().default(0),
  profit_margin_override: z.number().nullable().default(null),
});

export type WorkOrder = z.infer<typeof WorkOrderSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type ExpenseOverride = z.infer<typeof ExpenseOverrideSchema>;
