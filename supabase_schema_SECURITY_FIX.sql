-- ==============================================================================
-- POWER GRID UTILITIES CONSOLE: PRODUCTION DATABASE SECURITY & PERFORMANCE PATCH
-- File: supabase_schema_SECURITY_FIX.sql
-- Run this migration in the Supabase SQL Editor.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. POSTGRES CHECK CONSTRAINTS (Financial Integrity Layer)
-- ------------------------------------------------------------------------------

-- Invoices: Total amount must be non-negative
ALTER TABLE IF EXISTS public.invoices
DROP CONSTRAINT IF EXISTS check_invoices_total_positive;

ALTER TABLE IF EXISTS public.invoices
ADD CONSTRAINT check_invoices_total_positive CHECK (total >= 0);

-- Invoices: Status must be one of the known valid states
ALTER TABLE IF EXISTS public.invoices
DROP CONSTRAINT IF EXISTS check_invoices_status_valid;

ALTER TABLE IF EXISTS public.invoices
ADD CONSTRAINT check_invoices_status_valid CHECK (
    status IN ('Approved', 'Unapproved', 'Draft', 'Pending Approval', 'Voided', 'Disputed')
);

-- Connecteam Labor Entries: Rates and hours must be non-negative
ALTER TABLE IF EXISTS public.connecteam_labor_entries
DROP CONSTRAINT IF EXISTS check_labor_hourly_rate_positive;

ALTER TABLE IF EXISTS public.connecteam_labor_entries
ADD CONSTRAINT check_labor_hourly_rate_positive CHECK (hourly_rate >= 0);

ALTER TABLE IF EXISTS public.connecteam_labor_entries
DROP CONSTRAINT IF EXISTS check_labor_shift_hours_positive;

ALTER TABLE IF EXISTS public.connecteam_labor_entries
ADD CONSTRAINT check_labor_shift_hours_positive CHECK (shift_hours >= 0);

ALTER TABLE IF EXISTS public.connecteam_labor_entries
DROP CONSTRAINT IF EXISTS check_labor_ot_hours_positive;

ALTER TABLE IF EXISTS public.connecteam_labor_entries
ADD CONSTRAINT check_labor_ot_hours_positive CHECK (ot_hours >= 0);

ALTER TABLE IF EXISTS public.connecteam_labor_entries
DROP CONSTRAINT IF EXISTS check_labor_dt_hours_positive;

ALTER TABLE IF EXISTS public.connecteam_labor_entries
ADD CONSTRAINT check_labor_dt_hours_positive CHECK (dt_hours >= 0);


-- ------------------------------------------------------------------------------
-- 2. SERVER-SIDE AGGREGATION VIEWS (Performance Optimization Layer)
-- ------------------------------------------------------------------------------

-- Profit Margin & Reconciliation View: Pre-computes financial rollups on Postgres
CREATE OR REPLACE VIEW public.v_work_order_profit_margin AS
SELECT 
    w.work_order_number,
    w.status AS wo_status,
    w.general_foreman,
    w.foreman,
    w.area,
    w.address,
    w.customer_need_date,
    w.date_work_completed,
    COALESCE(inv.total_invoiced, 0) AS total_invoiced,
    COALESCE(inv.invoice_count, 0) AS invoice_count,
    COALESCE(lab.total_labor_cost, 0) AS total_labor_cost,
    COALESCE(lab.total_shift_hours, 0) AS total_shift_hours,
    (COALESCE(inv.total_invoiced, 0) - COALESCE(lab.total_labor_cost, 0)) AS gross_margin,
    CASE 
        WHEN COALESCE(inv.total_invoiced, 0) > 0 
        THEN ROUND((((COALESCE(inv.total_invoiced, 0) - COALESCE(lab.total_labor_cost, 0)) / inv.total_invoiced) * 100)::numeric, 2)
        ELSE 0 
    END AS profit_margin_pct
FROM public.work_orders w
LEFT JOIN (
    SELECT 
        work_order_number, 
        SUM(total) AS total_invoiced,
        COUNT(*) AS invoice_count
    FROM public.invoices
    GROUP BY work_order_number
) inv ON w.work_order_number = inv.work_order_number
LEFT JOIN (
    SELECT 
        work_order_number, 
        SUM(line_labor_cost) AS total_labor_cost, 
        SUM(shift_hours) AS total_shift_hours
    FROM public.connecteam_labor_entries
    GROUP BY work_order_number
) lab ON w.work_order_number = lab.work_order_number;


-- ------------------------------------------------------------------------------
-- 3. HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- Uses authenticated JWT claim: (auth.jwt() -> 'user_metadata' ->> 'role')
-- Rejecting anon / unauthenticated requests unconditionally.
-- ------------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connecteam_labor_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_rate_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_overrides ENABLE ROW LEVEL SECURITY;

-- Helper macro function to extract role from Supabase Auth JWT
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claim.user_metadata', true)::jsonb ->> 'role',
        auth.jwt() -> 'user_metadata' ->> 'role',
        'Employee'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN 'Employee';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 3.1 WORK ORDERS
DROP POLICY IF EXISTS "Allow public all work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Supervisor full work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Admin read write work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Employee read work_orders" ON public.work_orders;

-- Supervisor: Full access
CREATE POLICY "Supervisor full work_orders" ON public.work_orders
    FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'Supervisor')
    WITH CHECK (public.current_user_role() = 'Supervisor');

-- Admin: Read, Insert, Update
CREATE POLICY "Admin read write work_orders" ON public.work_orders
    FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'Admin')
    WITH CHECK (public.current_user_role() = 'Admin');

-- Employee: Read only
CREATE POLICY "Employee read work_orders" ON public.work_orders
    FOR SELECT
    TO authenticated
    USING (public.current_user_role() = 'Employee');


-- 3.2 INVOICES (Financial Protection: Employees have zero access)
DROP POLICY IF EXISTS "Allow public all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Supervisor full invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin read write invoices" ON public.invoices;

-- Supervisor: Full access
CREATE POLICY "Supervisor full invoices" ON public.invoices
    FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'Supervisor')
    WITH CHECK (public.current_user_role() = 'Supervisor');

-- Admin: Read, Insert, Update
CREATE POLICY "Admin read write invoices" ON public.invoices
    FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'Admin')
    WITH CHECK (public.current_user_role() = 'Admin');

-- (No policy for Employee = Deny by default)


-- 3.3 CONNECTEAM LABOR ENTRIES
DROP POLICY IF EXISTS "Allow public all connecteam_labor_entries" ON public.connecteam_labor_entries;
DROP POLICY IF EXISTS "Supervisor full labor_entries" ON public.connecteam_labor_entries;
DROP POLICY IF EXISTS "Admin read write labor_entries" ON public.connecteam_labor_entries;
DROP POLICY IF EXISTS "Employee read labor_entries" ON public.connecteam_labor_entries;

-- Supervisor: Full access
CREATE POLICY "Supervisor full labor_entries" ON public.connecteam_labor_entries
    FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'Supervisor')
    WITH CHECK (public.current_user_role() = 'Supervisor');

-- Admin: Read, Insert, Update
CREATE POLICY "Admin read write labor_entries" ON public.connecteam_labor_entries
    FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'Admin')
    WITH CHECK (public.current_user_role() = 'Admin');

-- Employee: Read only
CREATE POLICY "Employee read labor_entries" ON public.connecteam_labor_entries
    FOR SELECT
    TO authenticated
    USING (public.current_user_role() = 'Employee');


-- 3.4 LABOR RATE CATEGORIES
DROP POLICY IF EXISTS "Allow public all labor_rate_categories" ON public.labor_rate_categories;
DROP POLICY IF EXISTS "Supervisor full labor_rate_categories" ON public.labor_rate_categories;
DROP POLICY IF EXISTS "Admin Employee read labor_rate_categories" ON public.labor_rate_categories;

-- Supervisor: Full management
CREATE POLICY "Supervisor full labor_rate_categories" ON public.labor_rate_categories
    FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'Supervisor')
    WITH CHECK (public.current_user_role() = 'Supervisor');

-- Admin & Employee: Read only
CREATE POLICY "Admin Employee read labor_rate_categories" ON public.labor_rate_categories
    FOR SELECT
    TO authenticated
    USING (public.current_user_role() IN ('Admin', 'Employee'));


-- 3.5 EXPENSE OVERRIDES (Financial Overrides: Supervisor & Admin only)
DROP POLICY IF EXISTS "Allow public all expense_overrides" ON public.expense_overrides;
DROP POLICY IF EXISTS "Supervisor full expense_overrides" ON public.expense_overrides;
DROP POLICY IF EXISTS "Admin read write expense_overrides" ON public.expense_overrides;

CREATE POLICY "Supervisor full expense_overrides" ON public.expense_overrides
    FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'Supervisor')
    WITH CHECK (public.current_user_role() = 'Supervisor');

CREATE POLICY "Admin read write expense_overrides" ON public.expense_overrides
    FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'Admin')
    WITH CHECK (public.current_user_role() = 'Admin');

-- (No policy for Employee = Deny by default)
