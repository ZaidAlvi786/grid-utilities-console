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
    line_labor_cost NUMERIC NOT NULL DEFAULT 0,
    role_category TEXT NOT NULL DEFAULT 'unclassified',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Labor Rate Categories Table if not exists
CREATE TABLE IF NOT EXISTS public.labor_rate_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name TEXT NOT NULL UNIQUE,
    standard_rate NUMERIC NOT NULL,
    match_tolerance NUMERIC NOT NULL DEFAULT 0.10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Expense Overrides Table if not exists
CREATE TABLE IF NOT EXISTS public.expense_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filter_fingerprint TEXT NOT NULL UNIQUE,
    add_amount NUMERIC NOT NULL DEFAULT 0,
    remove_amount NUMERIC NOT NULL DEFAULT 0,
    profit_margin_override NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Labor Rate Categories
INSERT INTO public.labor_rate_categories (category_name, standard_rate, match_tolerance)
VALUES 
    ('GForeman', 55.70, 0.10),
    ('Foreman', 54.70, 0.10),
    ('Journeyman', 51.16, 0.10),
    ('Apprentice', 38.37, 0.10),
    ('Groundman', 25.66, 0.10)
ON CONFLICT (category_name) DO UPDATE 
SET standard_rate = EXCLUDED.standard_rate, match_tolerance = EXCLUDED.match_tolerance;

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
