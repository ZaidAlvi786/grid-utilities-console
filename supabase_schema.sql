-- ==============================================================================
-- 1. ADD COLUMN TO EXISTING TABLE (Fixes "column date_work_completed not found")
-- ==============================================================================
ALTER TABLE IF EXISTS public.work_orders 
ADD COLUMN IF NOT EXISTS date_work_completed TEXT;

-- 2. POPULATE DUMMY COMPLETION DATES FOR COMPLETED WORK ORDERS
UPDATE public.work_orders 
SET date_work_completed = COALESCE(customer_need_date, '2026-08-15')
WHERE status IN ('Field Complete', 'CTCC Completed', 'Ready to Bill') 
  AND (date_work_completed IS NULL OR date_work_completed = '');

-- ==============================================================================
-- 3. CREATE ANY MISSING TABLES & ENABLE PUBLIC READ/WRITE ACCESS
-- ==============================================================================

-- Create Invoices Table if not exists
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    work_order_number TEXT,
    -- Statuses: 'Approved', 'Unapproved', 'Draft', 'Pending Approval', 'Voided', 'Disputed' (or any custom status)
    status TEXT NOT NULL DEFAULT 'Unapproved',
    po_number TEXT DEFAULT '',
    total NUMERIC NOT NULL DEFAULT 0,
    created_date TEXT,
    unanswered_comments BOOLEAN DEFAULT FALSE,
    dispute_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Connecteam Labor Entries Table if not exists
CREATE TABLE IF NOT EXISTS public.connecteam_labor_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_number TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    shift_date TEXT NOT NULL,
    clock_in TEXT,
    clock_out TEXT,
    shift_hours NUMERIC NOT NULL DEFAULT 0,
    hourly_rate NUMERIC NOT NULL DEFAULT 0,
    ot_hours NUMERIC NOT NULL DEFAULT 0,
    ot_cost NUMERIC NOT NULL DEFAULT 0,
    dt_hours NUMERIC NOT NULL DEFAULT 0,
    dt_cost NUMERIC NOT NULL DEFAULT 0,
    benefits_cost NUMERIC NOT NULL DEFAULT 0,
    benefits_rate NUMERIC NOT NULL DEFAULT 0,
    line_labor_cost NUMERIC NOT NULL DEFAULT 0,
    role_category TEXT NOT NULL DEFAULT 'unclassified',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure OT, DT, and Benefits columns exist on existing table instances
ALTER TABLE IF EXISTS public.connecteam_labor_entries 
ADD COLUMN IF NOT EXISTS ot_hours NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.connecteam_labor_entries 
ADD COLUMN IF NOT EXISTS ot_cost NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.connecteam_labor_entries 
ADD COLUMN IF NOT EXISTS dt_hours NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.connecteam_labor_entries 
ADD COLUMN IF NOT EXISTS dt_cost NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.connecteam_labor_entries 
ADD COLUMN IF NOT EXISTS benefits_cost NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.connecteam_labor_entries 
ADD COLUMN IF NOT EXISTS benefits_rate NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.connecteam_labor_entries 
ADD COLUMN IF NOT EXISTS start_date TEXT;

ALTER TABLE IF EXISTS public.connecteam_labor_entries 
ADD COLUMN IF NOT EXISTS end_date TEXT;

-- Create Labor Rate Categories Table if not exists
CREATE TABLE IF NOT EXISTS public.labor_rate_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name TEXT NOT NULL UNIQUE,
    standard_rate NUMERIC NOT NULL,
    ot_rate NUMERIC,
    dt_rate NUMERIC,
    benefits_rate NUMERIC,
    match_tolerance NUMERIC NOT NULL DEFAULT 0.20,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure ot_rate, dt_rate, and benefits_rate columns exist on labor_rate_categories
ALTER TABLE IF EXISTS public.labor_rate_categories
ADD COLUMN IF NOT EXISTS ot_rate NUMERIC,
ADD COLUMN IF NOT EXISTS dt_rate NUMERIC,
ADD COLUMN IF NOT EXISTS benefits_rate NUMERIC;

-- Create Expense Overrides Table if not exists
CREATE TABLE IF NOT EXISTS public.expense_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filter_fingerprint TEXT NOT NULL UNIQUE,
    add_amount NUMERIC NOT NULL DEFAULT 0,
    remove_amount NUMERIC NOT NULL DEFAULT 0,
    profit_margin_override NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Labor Rate Categories (7 standard roles with base wages, OT, DT, and benefits)
INSERT INTO public.labor_rate_categories (category_name, standard_rate, ot_rate, dt_rate, benefits_rate, match_tolerance)
VALUES 
    ('General Foreman', 58.49, 87.74, 116.98, 25.22, 0.20),
    ('Foreman', 57.30, 85.95, 114.60, 24.90, 0.20),
    ('Journeyman', 53.72, 80.58, 107.44, 23.89, 0.20),
    ('Pole Truck Driver', 40.23, 60.35, 80.46, 18.56, 0.20),
    ('Apprentice', 37.60, 56.40, 75.20, 15.48, 0.20),
    ('Groundman', 26.94, 40.41, 53.88, 14.66, 0.20),
    ('Pole Truck Helper', 15.00, 22.50, 30.00, 9.48, 0.20)
ON CONFLICT (category_name) DO UPDATE 
SET standard_rate = EXCLUDED.standard_rate,
    ot_rate = EXCLUDED.ot_rate,
    dt_rate = EXCLUDED.dt_rate,
    benefits_rate = EXCLUDED.benefits_rate,
    match_tolerance = EXCLUDED.match_tolerance;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connecteam_labor_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_rate_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_overrides ENABLE ROW LEVEL SECURITY;

-- Create Policies for Public Read & Write (Anon Access)
DROP POLICY IF EXISTS "Allow public all work_orders" ON public.work_orders;
CREATE POLICY "Allow public all work_orders" ON public.work_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all invoices" ON public.invoices;
CREATE POLICY "Allow public all invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all connecteam_labor_entries" ON public.connecteam_labor_entries;
CREATE POLICY "Allow public all connecteam_labor_entries" ON public.connecteam_labor_entries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all labor_rate_categories" ON public.labor_rate_categories;
CREATE POLICY "Allow public all labor_rate_categories" ON public.labor_rate_categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all expense_overrides" ON public.expense_overrides;
CREATE POLICY "Allow public all expense_overrides" ON public.expense_overrides FOR ALL USING (true) WITH CHECK (true);
