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

export const InvoiceStatusEnum = z.enum([
  'Approved',
  'Unapproved',
  'Draft',
  'Pending Approval',
  'Voided',
  'Disputed',
]);
export type InvoiceStatus = z.infer<typeof InvoiceStatusEnum> | string;

export const InvoiceSchema = z.object({
  id: z.string().uuid().optional(),
  invoice_number: z.union([z.number(), z.string()])
    .transform((val) => (val !== undefined && val !== null ? val.toString().trim() : ''))
    .refine((val) => val !== '' && val !== '0' && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined', {
      message: 'Invoice number is required and cannot be empty',
    }),
  created_date: z.any().optional(),
  status: z.union([InvoiceStatusEnum, z.string()]).default('Unapproved'),
  po_number: z.any().transform((val) => (val !== null && val !== undefined ? val.toString() : '')).optional().default(''),
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
  invoice_status: z.union([InvoiceStatusEnum, z.string()]).optional().nullable(),
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

export const LaborRateCategorySchema = z.object({
  id: z.string().optional(),
  category_name: z.string().min(1),
  standard_rate: z.number(),
  ot_rate: z.number().optional(),
  dt_rate: z.number().optional(),
  benefits_rate: z.number().optional(),
  match_tolerance: z.number().default(0.20),
});

export const LaborEntrySchema = z.object({
  id: z.string().optional(),
  work_order_number: z.union([z.number(), z.string()]).transform((val) => val.toString().trim()).refine((val) => val !== '' && val !== '0', { message: 'Work Order number is required and cannot be empty or 0' }),
  employee_name: z.string().min(1),
  shift_date: z.string().min(1),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  clock_in: z.string().nullable().optional(),
  clock_out: z.string().nullable().optional(),
  shift_hours: z.number().min(0),
  hourly_rate: z.number().min(0),
  ot_hours: z.any().transform((v) => (v !== null && v !== undefined && !isNaN(parseFloat(v)) ? parseFloat(v) : 0)).default(0),
  ot_cost: z.any().transform((v) => (v !== null && v !== undefined && !isNaN(parseFloat(v)) ? parseFloat(v) : 0)).default(0),
  dt_hours: z.any().transform((v) => (v !== null && v !== undefined && !isNaN(parseFloat(v)) ? parseFloat(v) : 0)).default(0),
  dt_cost: z.any().transform((v) => (v !== null && v !== undefined && !isNaN(parseFloat(v)) ? parseFloat(v) : 0)).default(0),
  benefits_cost: z.any().transform((v) => (v !== null && v !== undefined && !isNaN(parseFloat(v)) ? parseFloat(v) : 0)).default(0),
  benefits_rate: z.any().transform((v) => (v !== null && v !== undefined && !isNaN(parseFloat(v)) ? parseFloat(v) : 0)).optional().default(0),
  line_labor_cost: z.number().min(0),
  role_category: z.string().default('unclassified'),
  created_at: z.string().optional(),
});

export type WorkOrder = z.infer<typeof WorkOrderSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type ExpenseOverride = z.infer<typeof ExpenseOverrideSchema>;
export type LaborRateCategory = z.infer<typeof LaborRateCategorySchema>;
export type LaborEntry = z.infer<typeof LaborEntrySchema>;
