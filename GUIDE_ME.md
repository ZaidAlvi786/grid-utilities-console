# 📘 Guide Me: How Every Number and Calculation Works
### *A Simple, Plain-English Guide to All Console Data & Calculations*

Welcome! This guide explains **every single number, dollar amount, percentage, and chart** shown in the **Power Grid Utilities Console**. 

No complicated computer programming jargon here — just straightforward, everyday explanations, step-by-step math formulas, clear examples, and the exact files where each calculation lives.

---

## 📑 Table of Contents

1. [General Concepts & Daily Defaults](#1-general-concepts--daily-defaults)
2. [Top Bar & Global Filters](#2-top-bar--global-filters)
3. [Main KPI Metric Cards (Top of Dashboard)](#3-main-kpi-metric-cards-top-of-dashboard)
4. [Crew Performance Metrics Table](#4-crew-performance-metrics-table)
5. [Charts & Visual Analytics](#5-charts--visual-analytics)
   * [Approved vs. Unapproved Invoices](#approved-vs-unapproved-invoices)
   * [How Long the Money Has Been Held (Aging)](#how-long-the-money-has-been-held-aging)
   * [Profit Margin Over Time (60-Day Trend)](#profit-margin-over-time-60-day-trend)
   * [Status Categories by Days (811 Locate Lapsed)](#status-categories-by-days-811-locate-lapsed)
   * [Status Count Percentage Breakdown](#status-count-percentage-breakdown)
   * [Service Requirements (Job Site Obstacles)](#service-requirements-job-site-obstacles)
   * [Profit Margin Performance (GF vs. Foreman)](#profit-margin-performance-gf-vs-foreman)
6. [Connecteam Timesheet & Labor Calculations](#6-connecteam-timesheet--labor-calculations)
   * [Timesheet Summary Cards](#timesheet-summary-cards)
   * [How a Single Shift Pay is Calculated (Regular, OT, DT, Benefits)](#how-a-single-shift-pay-is-calculated)
   * [How Job Roles are Identified (Role Matching)](#how-job-roles-are-identified)
   * [Role Distribution & Headcount Cards](#role-distribution--headcount-cards)
   * [Work Order Labor Rollup (Single Job Scorecard)](#work-order-labor-rollup)
7. [Quick Reference Calculation Cheat Sheet](#7-quick-reference-calculation-cheat-sheet)

---

## 1. General Concepts & Daily Defaults

Before diving into individual cards, here are three simple rules the system uses everywhere:

1. **The $5,800 Daily Crew Rate**:
   * If detailed worker shift timesheets are not yet uploaded, the system estimates crew cost using standard utility industry rates: **$5,800 per day** for a full foreman crew.
   * File: [src/store/dbSlice.ts](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/store/dbSlice.ts#L133) (`dailyExpenseRate: 5800`)

2. **Completed vs. Pending Work**:
   * A job is counted as **"Completed"** if its status is **"Ready to Bill"** or **"CTCC Completed"**.
   * Any other status (like "Work Pending" or "Field Check") is treated as open work in progress.
   * File: [src/utils/helpers.ts](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/utils/helpers.ts#L150-L154) (`isWorkOrderCompleted`)

3. **User Access Roles**:
   * **Supervisor**: Sees all money numbers, labor costs, profits, and can type in custom expense adjustments.
   * **Admin**: Sees work orders, invoices, and labor costs, but profit margins are hidden.
   * **Employee**: Sees only operational numbers (how many jobs are done, pending, or in progress). All dollar signs and pay rates are hidden or masked with `***`.
   * File: [src/components/Kpis.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L15-L18)

---

## 2. Top Bar & Global Filters

### Header Totals
* **Where to find it**: [src/components/Header.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Header.tsx#L100-L103)
* **What you see**: e.g., *"142 work orders · 86 invoices · as of 18 Aug 2026"*
* **How it is calculated**:
  * **Work Orders**: The total count of all work orders currently loaded in the database.
  * **Invoices**: The total count of all Coupa invoices currently loaded.

---

### Date Filtering (Reporting Date)
* **Where to find it**: [src/components/Filters.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Filters.tsx#L136-L157) & [src/utils/helpers.ts](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/utils/helpers.ts#L330-L361) (`getWorkOrderReportingDate`)
* **How it works in plain words**:
  * When you pick a Start Date and End Date in the filter bar, which date does a job get compared against?
  * **Rule 1 (Finished Jobs)**: If the work is completed, the system looks at the **Fulcrum Date Work Completed**.
  * **Rule 2 (Open Jobs)**: If the job is still pending, the system looks at the **Customer Need Date** (the deadline requested by the client).
  * **Rule 3 (Fallback)**: If neither date exists, it uses the date the order was created.
  * *Important Rule*: The system deliberately ignores the "Last Updated" timestamp. Why? Because if someone fixes a typo today on a job finished last month, we don't want that job suddenly jumping into this month's financial report!

---

### Crew & Work Order Selectors
* **Where to find it**: [src/components/Filters.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Filters.tsx#L46-L130)
* **How it works**:
  * Selecting a **General Foreman** narrows down the entire screen to only the foremen and jobs under that supervisor.
  * You can check off one or multiple individual **Foremen**.
  * You can search and check off specific **Work Order Numbers**.

---

## 3. Main KPI Metric Cards (Top of Dashboard)

These are the big summary cards at the top of the main Dashboard screen.

```
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│     INVOICED AMOUNT     │  │    TOTAL LABOR COST     │  │      PROFIT MARGIN      │
│       $1,250,000        │  │        $850,000         │  │        $400,000         │
│  86 invoices · avg $14k │  │  base $820k + $30k adj  │  │   32% of invoiced kept  │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
```

---

### Card 1: Invoiced Amount
* **Where to find it**: [src/components/Kpis.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L57-L59) & [lines 243-256](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L243-L256)
* **What you see**: Total dollar amount billed to the customer (e.g. `$1,420,500`), plus number of invoices and average dollar size per invoice.
* **How it is calculated**:
  1. **Invoiced Amount**: Adds up the `Total` dollar amount from every invoice matching your current filters.
     $$\text{Invoiced Amount} = \text{Invoice}_1 + \text{Invoice}_2 + \dots + \text{Invoice}_n$$
  2. **Invoice Count**: Total number of matching invoices.
  3. **Average Invoice**: Invoiced Amount divided by the number of invoices.
     $$\text{Average Invoice} = \frac{\text{Invoiced Amount}}{\text{Number of Invoices}}$$
* **Example**:
  * If you have 2 invoices: one for $10,000 and one for $20,000:
  * Total = **$30,000**
  * Invoices = **2**
  * Average = **$15,000**

---

### Card 2: Total Labor Cost
* **Where to find it**: [src/components/Kpis.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L101-L127) & [lines 258-341](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L258-L341)
* **What you see**: Total cost of labor needed to complete the work (e.g. `$940,200`), with an audit trail showing the base cost plus or minus any manual adjustments.
* **How it is calculated**:
  1. **Step 1 — Calculate Base Labor Cost**:
     * **If Connecteam Timesheets exist**: The system calculates the exact pay for every single worker shift (Regular Pay + Overtime + Double Time + Union Benefits) and adds them all up.
     * **If no timesheets exist yet**: The system falls back to the daily crew model: counts how many unique days each foreman had billed work, and multiplies by $5,800/day.
  2. **Step 2 — Apply Manual Supervisor Overrides**:
     * Supervisors can type in an **"Expense Add Amount"** (for extra costs like equipment rentals, special permits, or subcontractors).
     * Supervisors can type in an **"Expense Less Amount"** (for discounts, credits, or shared overhead).
  3. **Final Formula**:
     $$\text{Total Labor Cost} = \text{Base Labor Cost} + \text{Expense Add Amount} - \text{Expense Less Amount}$$
* **Example**:
  * Base Timesheet Labor = $100,000
  * Add Amount = $5,000 (bucket truck rental)
  * Less Amount = $2,000 (fuel credit)
  * Total Labor Cost = $\$100,000 + \$5,000 - \$2,000 = \mathbf{\$103,000}$

---

### Card 3: Profit Margin (Supervisor Only)
* **Where to find it**: [src/components/Kpis.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L128-L130) & [lines 344-410](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L344-L410)
* **What you see**: Net profit left over after paying all labor costs (e.g. `$480,300`), plus what percentage of revenue that represents (e.g. `34%`).
* **How it is calculated**:
  1. **Computed Profit Margin**: Invoiced Amount minus Total Labor Cost.
     $$\text{Profit Margin} = \text{Invoiced Amount} - \text{Total Labor Cost}$$
  2. **Profit Margin Percentage**: Profit Margin divided by Invoiced Amount, multiplied by 100.
     $$\text{Margin \%} = \left( \frac{\text{Profit Margin}}{\text{Invoiced Amount}} \right) \times 100$$
  3. **Manual Override Pencil**: If a supervisor clicks the pencil icon and types in a custom margin number, that exact number is saved directly to the database for the active filter view.
* **Example**:
  * Invoiced Amount = $200,000
  * Total Labor Cost = $150,000
  * Profit Margin = $\$200,000 - \$150,000 = \mathbf{\$50,000}$
  * Margin % = $\frac{\$50,000}{\$200,000} \times 100 = \mathbf{25\%}$ (the company kept 25 cents of every billed dollar).

---

### Operational KPI Cards (Employee View Only)
* **Where to find it**: [src/components/Kpis.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L50-L55) & [lines 154-237](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L154-L237)
* When an Employee logs in, financial figures are replaced with field progress stats:
  1. **Total Work Orders**: Count of all matching work orders (`woCount`).
  2. **Field Completion Rate**: 
     $$\text{Completion Rate} = \left( \frac{\text{Completed Work Orders}}{\text{Total Work Orders}} \right) \times 100$$
     *(Completed means status is "Ready to Bill" or "CTCC Completed".)*
  3. **Work Orders Pending**: Count of work orders whose status is still "Work Pending".

---

## 4. Crew Performance Metrics Table

* **Where to find it**: [src/components/CrewMetricsTable.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/CrewMetricsTable.tsx#L24-L97)
* **What you see**: A full table listing every General Foreman or Foreman with their performance stats.

```
┌───────────────┬──────┬────────────┬─────────────┬──────────────┬─────────┬─────────┬────────┐
│ Foreman Name  │ WOs  │ Complete % │ Booked Days │ Hours Worked │ Revenue │ Expense │ Margin │
├───────────────┼──────┼────────────┼─────────────┼──────────────┼─────────┼─────────┼────────┤
│ John Miller   │  24  │    75%     │     15      │   120 hrs    │  $145k  │  $87k   │ +$58k  │
└───────────────┴──────┴────────────┴─────────────┴──────────────┴─────────┴─────────┴────────┘
```

### Table Column Calculations:

| Column Header | Plain English Meaning | How It Is Calculated |
| :--- | :--- | :--- |
| **Foreman / GF** | The name of the crew leader. | Directly from the work order records. |
| **WOs** | Total jobs assigned to this crew. | Counts how many work orders belong to this foreman. |
| **Complete %** | The percentage of their assigned jobs that are finished. | $\frac{\text{Completed WOs}}{\text{Total WOs}} \times 100$ <br>*(Completed = "Ready to Bill" or "CTCC Completed")* |
| **Booked Days** | How many separate calendar days this crew had billed work. | Counts unique calendar dates where an invoice was created for this crew's jobs. |
| **Hours Worked** | Estimated crew hours. | $\text{Booked Days} \times 8\text{ hours per day}$ |
| **Revenue** | Total money billed for this crew's work. | Sum of all invoice dollar totals tied to this crew's work orders. |
| **Expense** | Estimated cost to run this crew. | $\text{Booked Days} \times \$5,800\text{ (standard daily crew cost)}$ |
| **Margin** | Profit generated by this crew. | $\text{Revenue} - \text{Expense}$ <br>*(Green if positive profit, red if loss)* |

* **Interactive Tip**: Clicking on any crew member's row immediately filters the entire console to only show that crew's jobs!

---

## 5. Charts & Visual Analytics

### Approved vs. Unapproved Invoices
* **Where to find it**: [src/components/ApprovedVsUnapprovedChart.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/ApprovedVsUnapprovedChart.tsx#L43-L89)
* **What it shows**: A monthly stacked bar chart displaying invoice dollars over the last 4 months.
* **How it is calculated**:
  * The system groups invoices by the calendar month they were created (e.g. May 26, Jun 26, Jul 26, Aug 26).
  * **Approved Bar (Blue)**: Adds up the dollar total of all invoices marked with status `"Approved"`.
  * **Unapproved Bar (Red/Rose)**: Adds up all other invoices that haven't been approved yet (e.g., "Unapproved", "Draft", "Disputed", "Pending Approval").
  * **Tooltip Total**: Adds Approved + Unapproved to give the total billed for that month.

---

### How Long the Money Has Been Held (Aging)
* **Where to find it**: [src/components/MoneyHeldAging.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/MoneyHeldAging.tsx#L10-L72)
* **What it shows**: Unpaid, unapproved invoice money grouped by how old the invoice is. Older money is harder to collect and needs escalation!
* **How it is calculated**:
  1. Takes each unapproved invoice and calculates the days elapsed between the date the invoice was raised and the console reference date (`2026-08-25`):
     $$\text{Days Old} = \text{Current Date} - \text{Invoice Created Date}$$
  2. Sorts the money into **4 Age Buckets**:
     * **0-15 DAYS**: Invoices 15 days old or less (Normal processing).
     * **16-30 DAYS**: Invoices between 16 and 30 days old.
     * **31-60 DAYS**: Invoices between 31 and 60 days old (Needs review).
     * **OVER 60 DAYS (60+)**: Invoices older than 60 days. Marked with a red ⚠️ warning badge because these need immediate management escalation.
  3. **Percent of Bar**: 
     $$\text{Bucket \%} = \left( \frac{\text{Dollar Total in this Bucket}}{\text{Total of all Unapproved Invoices}} \right) \times 100$$
  4. **Awaiting Reply Count**: Counts how many invoices in that bucket have comments from the utility customer waiting for our response (`unanswered_comments = true`).

---

### Profit Margin Over Time (60-Day Trend)
* **Where to find it**: [src/components/ProfitMarginOverTime.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/ProfitMarginOverTime.tsx#L29-L86)
* **What it shows**: A daily bar chart showing the company's net profit margin for every single day over the last 60 days.
* **How it is calculated for each individual day**:
  1. **Day Revenue**: Adds up all invoices created on that day.
  2. **Day Expense**: Counts how many distinct foremen had jobs billed on that day, and multiplies by the daily rate:
     $$\text{Day Expense} = \text{Active Foremen on that Day} \times \$5,800$$
  3. **Day Profit Margin**:
     $$\text{Day Margin} = \text{Day Revenue} - \text{Day Expense}$$
  4. **Bar Colors**: If the day made money ($\ge \$0$), the bar is **green**. If expenses exceeded revenue, the bar is **red**.

---

### Status Categories by Days (811 Locate Lapsed)
* **Where to find it**: [src/components/StatusDaysChart.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/StatusDaysChart.tsx#L43-L89)
* **What it shows**: A stacked bar chart showing work orders where the state "Call 811" underground utility locate permit has expired. Working on expired locate tickets is a safety and regulatory violation!
* **How it is calculated**:
  1. Checks if a work order's `locate_renewal_date` is in the past.
  2. Calculates how many days have passed since expiration:
     $$\text{Lapse Days} = \text{Today} - \text{Locate Renewal Date}$$
  3. Groups into **5 Time Brackets**: `1-30 days`, `31-60 days`, `61-90 days`, `91-180 days`, and `180+ days`.
  4. Colors each bar segment by the work order's current field status (Work Pending, Field Check, Field Complete, CTCC Completed, Ready to Bill).

---

### Status Count Percentage Breakdown
* **Where to find it**: [src/components/StatusPercentage.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/StatusPercentage.tsx#L10-L50)
* **What it shows**: Five progress bars showing the natural progression of work orders through the pipeline:
  1. **Work Pending**
  2. **Field Check**
  3. **Field Complete**
  4. **CTCC Completed**
  5. **Ready to Bill**
* **How it is calculated**:
  $$\text{Share \%} = \left( \frac{\text{Number of Work Orders in this Status}}{\text{Total Work Orders Across All Statuses}} \right) \times 100$$
* **Example**: If there are 100 total work orders and 40 are in "Work Pending", the bar shows **40% (40 WOs)**.

---

### Service Requirements (Job Site Obstacles)
* **Where to find it**: [src/components/ServiceRequirements.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/ServiceRequirements.tsx#L10-L60)
* **What it shows**: Tracks pre-requisite physical obstacles that must be cleared before a line crew can safely step on site.
* **The 7 Tracked Conditions**:
  1. **Locked gates** (need access codes or homeowner keys)
  2. **Outage required** (power must be de-energized first)
  3. **Permitting needed** (city or municipal permits required)
  4. **Switching required** (grid electrical rerouting needed)
  5. **Hydrovac needed** (soft digging around buried pipelines)
  6. **Tree trimming needed** (vegetation clearance)
  7. **Traffic control needed** (flaggers, police, or lane closures)
* **Calculations**:
  * **Condition Percentage**: $\frac{\text{Work Orders with this Condition}}{\text{Total Work Orders}} \times 100$
  * **High Complexity Badge ("4+ conditions")**: Counts how many jobs have 4 or more obstacles active at the same time. These are flagged because they take the longest planning and coordination.

---

### Profit Margin Performance (GF vs. Foreman)
* **Where to find it**: [src/components/ServiceMap.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/ServiceMap.tsx#L27-L92)
* **What it shows**: Side-by-side bar charts showing net profit margin by General Foreman (left) and by individual Foreman (right), ranked from highest profit to lowest.
* **How it is calculated**:
  $$\text{Margin} = \text{Total Invoices Billed for Crew} - (\text{Booked Days for Crew} \times \$5,800)$$

---

## 6. Connecteam Timesheet & Labor Calculations

The **Timesheet Tab** provides complete worker-by-worker and shift-by-shift payroll and cost calculations based on live Connecteam time clock entries.

---

### Timesheet Summary Cards
* **Where to find it**: [src/components/Timesheet/TimesheetSummaryCards.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Timesheet/TimesheetSummaryCards.tsx#L27-L117) & [TimesheetTab.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/TimesheetTab.tsx#L167-L214)

```
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│     TOTAL HOURS     │ │  TOTAL LABOR COST   │ │  ACTIVE WORKFORCE   │ │UNCLASSIFIED ENTRIES │
│     14,210.5 hrs    │ │      $842,650       │ │     84 Workers      │ │    12  (4%)         │
│  1,250 shift logs   │ │ Regular+OT+DT+Ben.  │ │  Distinct headcount │ │  112 hrs custom     │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

1. **Total Hours**: Adds up `shift_hours` from every matching shift log.
2. **Total Labor Cost**: Adds up the total line labor cost of every shift log (Regular pay + Overtime + Double Time + Union Benefits). *(Masked for Employees).*
3. **Active Workforce**: Counts the number of **unique individual workers** who logged at least one shift in the selected timeframe (using a unique list of employee names).
4. **Unclassified Entries**: Counts shifts where the hourly rate didn't match standard pay categories (shows shift count, percentage of all shifts, and total unclassified hours).

---

### How a Single Shift Pay is Calculated
* **Where to find it**: [src/components/Timesheet/timesheetHelpers.ts](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Timesheet/timesheetHelpers.ts#L8-L106) & [src/utils/helpers.ts](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/utils/helpers.ts#L57-L92) (`calculateLaborEntryCost`)

For every shift worked by an employee, the system breaks down hours and costs into **4 components**:

```
Total Labor Cost = Regular Pay + Overtime Pay (1.5x) + Double Time Pay (2.0x) + Benefits Cost
```

#### Step 1: Hours Breakdown
* **Shift Hours**: The total clock-in to clock-out hours (e.g. `11.0 hrs`).
* **Overtime (OT) Hours**: 
  * If the timesheet row already specifies OT hours, it uses that number.
  * Otherwise, any hours worked beyond 8 hours in a day are counted as Overtime:
    $$\text{OT Hours} = \text{Shift Hours} - 8 \quad (\text{if Shift Hours} > 8)$$
* **Double Time (DT) Hours**: Hours specifically designated as double-time (e.g. emergency storm response or special weekend calls). If not listed, it defaults to `0`.
* **Regular Hours**: The remaining base hours:
  $$\text{Regular Hours} = \text{Shift Hours} - \text{OT Hours} - \text{DT Hours} \quad (\text{minimum } 0)$$

#### Step 2: Wage Cost Math
* **Regular Cost**:
  $$\text{Regular Cost} = \text{Regular Hours} \times \text{Base Hourly Rate}$$
* **Overtime Cost (Paid at 1.5x)**:
  $$\text{OT Cost} = \text{OT Hours} \times \text{Base Hourly Rate} \times 1.5$$
* **Double Time Cost (Paid at 2.0x)**:
  $$\text{DT Cost} = \text{DT Hours} \times \text{Base Hourly Rate} \times 2.0$$

#### Step 3: Hourly Benefits Cost
* Union power line construction requires mandatory hourly benefits contributions (for healthcare, pension, apprentice training, and insurance).
* The benefits rate is an **extra dollar amount per hour** added on top of wages, based on the worker's job role:

| Role Category | Base Hourly Wage | Hourly Benefits Rate | Total Hourly Burden |
| :--- | :---: | :---: | :---: |
| **General Foreman** | $58.49 / hr | **$25.22 / hr** | $83.71 / hr |
| **Foreman** | $57.30 / hr | **$24.90 / hr** | $82.20 / hr |
| **Journeyman Lineman** | $53.72 / hr | **$23.89 / hr** | $77.61 / hr |
| **Pole Truck Driver** | $40.23 / hr | **$18.56 / hr** | $58.79 / hr |
| **Apprentice Lineman** | $37.60 / hr | **$15.48 / hr** | $53.08 / hr |
| **Groundman** | $26.94 / hr | **$14.66 / hr** | $41.60 / hr |
| **Pole Truck Helper** | $15.00 / hr | **$9.48 / hr** | $24.48 / hr |

* **Benefits Cost Formula**:
  $$\text{Benefits Cost} = \text{Total Shift Hours} \times \text{Hourly Benefits Rate}$$

#### Step 4: Line Labor Cost (Total Cost for the Shift)
$$\text{Line Labor Cost} = \text{Regular Cost} + \text{OT Cost} + \text{DT Cost} + \text{Benefits Cost}$$

---

### Real-Life Shift Example:
> **Worker**: Journeyman Lineman  
> **Shift Length**: 10 hours  
> **Base Rate**: $53.72 / hr  
> **Benefits Rate**: $23.89 / hr  

* **Hours Split**: 8 Regular hours, 2 Overtime hours, 0 Double Time hours.
1. **Regular Pay**: $8\text{ hrs} \times \$53.72 = \mathbf{\$429.76}$
2. **Overtime Pay**: $2\text{ hrs} \times (\$53.72 \times 1.5) = 2 \times \$80.58 = \mathbf{\$161.16}$
3. **Double Time Pay**: $0\text{ hrs} = \mathbf{\$0.00}$
4. **Benefits Cost**: $10\text{ hrs} \times \$23.89 = \mathbf{\$238.90}$
* **Total Shift Cost to Company**: 
  $$\$429.76 + \$161.16 + \$0.00 + \$238.90 = \mathbf{\$829.82}$$

---

### How Job Roles are Identified
* **Where to find it**: [src/utils/helpers.ts](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/utils/helpers.ts#L95-L133) (`classifyLaborRole`)
* When timesheets are uploaded, how does the system know if someone is a Foreman, Journeyman, or Groundman?

```
                        Is the worker named as the
                    General Foreman or Foreman on the WO?
                                 /       \
                              YES         NO
                              /             \
                    Assign Leader Role    Does their pay rate match
                    (GF or Foreman)       a standard role within 20¢?
                                                  /        \
                                               YES          NO
                                               /              \
                                       Assign Matched     Mark as
                                        Standard Role   "Unclassified"
```

1. **Rule 1 — Crew Leadership (Highest Priority)**:
   * If the worker's name matches the **General Foreman** assigned to that work order $\rightarrow$ Classified as **General Foreman**.
   * If the worker's name matches the **Foreman** assigned to that work order $\rightarrow$ Classified as **Foreman**.
2. **Rule 2 — Standard Base Rate Matching (With 20¢ Tolerance)**:
   * If not a foreman, the system checks their base hourly pay against the standard schedule:
     * $58.49 $\rightarrow$ General Foreman
     * $57.30 $\rightarrow$ Foreman
     * $53.72 $\rightarrow$ Journeyman
     * $40.23 $\rightarrow$ Pole Truck Driver
     * $37.60 $\rightarrow$ Apprentice
     * $26.94 $\rightarrow$ Groundman
     * $15.00 $\rightarrow$ Pole Truck Helper
   * If their wage is within **20 cents** ($\pm \$0.20$) of a standard rate, they are automatically placed into that category.
3. **Rule 3 — Unclassified Rate**:
   * If their rate doesn't match any standard tier, they are labeled **"Unclassified Rate"**.
   * *Note*: The system **never throws away their pay rate**! Their actual hourly rate is still used for 100% accurate payroll math.

---

### Role Distribution & Headcount Cards
* **Where to find it**: [src/components/Timesheet/TimesheetRoleBreakdown.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Timesheet/TimesheetRoleBreakdown.tsx#L71-L156)
* **What you see**: A card for each job role showing:
  * **Headcount**: Number of unique individual people who worked in that role (e.g. `12 Workers (14%)`).
    $$\text{Worker Share \%} = \left( \frac{\text{Workers in this Role}}{\text{Total Active Workers Across All Roles}} \right) \times 100$$
  * **Shift Count**: Total shifts worked by people in this role.
  * **Total Hours**: Total hours worked, plus percentage of all company hours worked.
    $$\text{Hours Share \%} = \left( \frac{\text{Hours in this Role}}{\text{Total Company Labor Hours}} \right) \times 100$$
  * **Labor Cost**: Total dollars spent on this role (Regular + OT + DT + Benefits).
* **Interactive Filtering**: Clicking any role card immediately filters the shift table to only show workers in that role!

---

### Work Order Labor Rollup (Single Job Scorecard)
* **Where to find it**: [src/components/Timesheet/TimesheetRollupModal.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Timesheet/TimesheetRollupModal.tsx) & [TimesheetTab.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/TimesheetTab.tsx#L235-L264)
* **What you see**: When you click the little link icon next to any Work Order in the timesheet table, a popup window opens showing the complete financial scorecard for that one job:

```
┌────────────────────────────────────────────────────────────────────────┐
│ WO #102948 — Ready to Bill                                             │
│ Crew Leader: Mike Vance · Area: KATY                                   │
├──────────────────────┬──────────────────────┬──────────────────────────┤
│  TOTAL LABOR HOURS   │   TOTAL LABOR COST   │   EST. PROFIT MARGIN     │
│       42.5 hrs       │       $3,480         │         38.2%            │
└──────────────────────┴──────────────────────┴──────────────────────────┘
```

* **How it is calculated**:
  1. **Labor Hours**: Sum of all shift hours logged to this specific Work Order.
  2. **Total Labor Cost**: Sum of calculated labor costs (Regular + OT + DT + Benefits) across all shifts for this Work Order.
  3. **Invoice Total**: Sum of all invoices billed for this Work Order.
  4. **Estimated Gross Margin ($)**:
     $$\text{Gross Margin} = \text{Invoice Total} - \text{Labor Cost}$$
  5. **Profit Margin Percentage (%)**:
     $$\text{Margin \%} = \left( \frac{\text{Gross Margin}}{\text{Invoice Total}} \right) \times 100$$

---

## 7. Quick Reference Calculation Cheat Sheet

Here is a quick summary table you can reference anytime:

| Data Item / Metric | What It Means in Plain Words | Simple Formula | Where It Lives in the Code |
| :--- | :--- | :--- | :--- |
| **Invoiced Amount** | Total dollars billed to clients | Sum of all invoice totals | [src/components/Kpis.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L57) |
| **Average Invoice** | Average dollar size of a bill | $\frac{\text{Invoiced Amount}}{\text{Number of Invoices}}$ | [src/components/Kpis.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L59) |
| **Total Labor Cost** | Total labor dollars spent | $\text{Base Labor} + \text{Add} - \text{Less}$ | [src/components/Kpis.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L127) |
| **Profit Margin ($)** | Net money company keeps | $\text{Invoiced Amount} - \text{Total Labor Cost}$ | [src/components/Kpis.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L128) |
| **Profit Margin (%)** | Percent of billed money kept | $\frac{\text{Profit Margin}}{\text{Invoiced Amount}} \times 100$ | [src/components/Kpis.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L130) |
| **Completion Rate** | Percent of assigned jobs finished | $\frac{\text{Completed Work Orders}}{\text{Total Work Orders}} \times 100$ | [src/components/Kpis.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Kpis.tsx#L198) |
| **Crew Revenue** | Dollars billed by one crew | Sum of invoices for that crew | [src/components/CrewMetricsTable.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/CrewMetricsTable.tsx#L42) |
| **Crew Expense** | Standard cost to run that crew | $\text{Booked Days} \times \$5,800$ | [src/components/CrewMetricsTable.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/CrewMetricsTable.tsx#L82) |
| **Crew Margin** | Profit made by that crew | $\text{Crew Revenue} - \text{Crew Expense}$ | [src/components/CrewMetricsTable.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/CrewMetricsTable.tsx#L87) |
| **Overtime Hours** | Hours worked past 8 in a day | $\text{Shift Hours} - 8$ | [timesheetHelpers.ts](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Timesheet/timesheetHelpers.ts#L9-L14) |
| **Overtime Cost** | Overtime pay at time-and-a-half | $\text{OT Hours} \times \text{Rate} \times 1.5$ | [timesheetHelpers.ts](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Timesheet/timesheetHelpers.ts#L17-L23) |
| **Double Time Cost** | Double time pay | $\text{DT Hours} \times \text{Rate} \times 2.0$ | [timesheetHelpers.ts](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Timesheet/timesheetHelpers.ts#L34-L40) |
| **Benefits Cost** | Union healthcare & pension burden | $\text{Shift Hours} \times \text{Role Benefits Rate}$ | [timesheetHelpers.ts](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Timesheet/timesheetHelpers.ts#L62-L75) |
| **Shift Labor Cost** | Complete cost of one worker shift | $\text{Reg Pay} + \text{OT Pay} + \text{DT Pay} + \text{Benefits}$ | [timesheetHelpers.ts](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/Timesheet/timesheetHelpers.ts#L91-L106) |
| **Active Workforce** | Total individual workers on the job | Count of unique worker names | [TimesheetTab.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/TimesheetTab.tsx#L172) |
| **Invoice Aging** | How many days an unpaid bill has sat | $\text{Today's Date} - \text{Invoice Created Date}$ | [MoneyHeldAging.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/MoneyHeldAging.tsx#L45-L46) |
| **811 Locate Lapse** | Days since utility ticket expired | $\text{Today's Date} - \text{Locate Renewal Date}$ | [StatusDaysChart.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/StatusDaysChart.tsx#L71-L72) |
| **Job Rollup Margin** | Profit made on a single work order | $\text{WO Invoices} - \text{WO Labor Cost}$ | [TimesheetTab.tsx](file:///c:/Users/adnan/Documents/Zaid%20personal/Projects/All%20Projects/grid-utilities-console/src/components/TimesheetTab.tsx#L247) |

---

*Need to adjust rates or formulas? Administrators and Supervisors can update standard union rates in the **User Settings & Team** menu, or enter manual expense additions and deductions directly on the Dashboard!*
