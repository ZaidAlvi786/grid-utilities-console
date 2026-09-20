# ⚡ Power Grid Utilities Console - Developer Architecture & Guide

Welcome to the **Power Grid Utilities Console** developer documentation. This guide explains the architecture, directory structure, data flows, and the exact functional responsibilities of every file in the codebase.

---

## 1. 🏗️ Tech Stack & Overview

* **Core Framework**: React 18 with TypeScript
* **Bundler & Dev Server**: Vite
* **State Management**: Redux Toolkit (`@reduxjs/toolkit` + `react-redux`)
* **Styling & UI**: Tailwind CSS, Vanilla CSS custom utility tokens, Lucide React icons, Framer Motion animations
* **Database & Cloud Storage**: Supabase (PostgreSQL with JS Client SDK)
* **File & Spreadsheet Ingestion**: SheetJS (`xlsx`) for parsing Coupa Invoices, Fulcrum Work Orders, and Connecteam Timesheets

---

## 2. 📂 Project File & Directory Mapping

```
grid-utilities-console/
├── README.md                   # Project overview & quickstart
├── DEVELOPER_GUIDE.md          # Comprehensive architecture & file reference (this file)
├── supabase_schema.sql         # Supabase PostgreSQL tables, constraints & indexes
├── vite.config.ts              # Vite bundler configuration
├── package.json                # Dependencies and build scripts
│
├── src/
│   ├── main.tsx                # App entry point with Redux Provider
│   ├── App.tsx                 # Main layout, tab navigation & global filter mounting
│   │
│   ├── types/
│   │   └── schemas.ts          # Core TypeScript data schemas & interface definitions
│   │
│   ├── store/
│   │   ├── store.ts            # Redux store configuration & root reducer
│   │   ├── dbSlice.ts          # Database state & Supabase async CRUD thunks
│   │   ├── filtersSlice.ts     # Global filter state (Dates, GF, Foremen, Work Orders)
│   │   └── authSlice.ts        # Authentication state & active user role session
│   │
│   ├── utils/
│   │   ├── supabaseClient.ts   # Supabase client instance & environment configuration
│   │   ├── helpers.ts          # Role classification engine, rate math, formatters
│   │   └── excelTemplates.ts   # CSV/Excel parsing pipelines & template export generators
│   │
│   └── components/
│       ├── Header.tsx          # Navigation header, tab switcher, user profile, sync status
│       ├── Filters.tsx         # Global filter bar (Date range, GF, Foremen, Work Order multi-select)
│       ├── Kpis.tsx            # Executive KPI metric cards with persistent expense override adjustments
│       ├── TimesheetTab.tsx    # Timesheet log table, role headcount breakdown, shift rollups
│       ├── CrewMetricsTable.tsx# Crew performance summary table with pagination & sorting
│       ├── ProfitMarginOverTime.tsx   # Visualizes profit margin trends over time
│       ├── ApprovedVsUnapprovedChart.tsx # Visualizes invoice status distribution breakdown
│       ├── ServiceMap.tsx      # Geographic area distribution of work orders
│       ├── UploadModal.tsx     # Batch CSV/Excel file uploader & validator
│       ├── UserSettingsModal.tsx # System settings, standard rate config, user administration
│       └── LoginPage.tsx       # Authentication view & login screen
```

---

## 3. 🧩 File-by-File Functional Breakdown

### 🎯 Application Core & Entry
| File Path | Description & Functionality |
| :--- | :--- |
| `src/main.tsx` | Initializes the React virtual DOM, wraps the application tree inside Redux `<Provider store={store}>`, and mounts `<App />`. |
| `src/App.tsx` | Root layout component. Manages active tab state (`'dashboard'` vs `'timesheet'`), conditionally renders tab views, keeps `<Filters />` persistent across all views, and handles modal visibility for uploads and settings. |
| `src/components/Header.tsx` | Top application navbar. Displays branding, tab navigation switcher, cloud sync indicator, user role pill (`Admin`, `Supervisor`, `Employee`), "Upload Data" button, and "Settings" menu. |
| `src/components/LoginPage.tsx` | Authentication component. Provides login form validation, session creation, and role-based switching. |

---

### 🔍 Filtering & Data Ingestion
| File Path | Description & Functionality |
| :--- | :--- |
| `src/components/Filters.tsx` | **Global Filter Bar**: Mounted under the Header for all tabs.<br>• **Date Range**: Filter by reporting completion/need date (`startDate` to `endDate`).<br>• **General Foreman**: Filter by crew leader.<br>• **Foreman**: Multi-select dropdown with checkbox selection and "Select All".<br>• **Work Order #**: Searchable multi-select dropdown with live filtering and "Select All" / "Clear".<br>• **Invoice Status**: Filter Coupa invoice records.<br>• **Reset Button**: Restores all filters to default with a single click. |
| `src/components/UploadModal.tsx` | Modal dialog for batch data ingestion. Allows users to upload Coupa Invoice CSVs, Fulcrum Work Order CSVs, and Connecteam Labor Timesheet CSVs. Parses tabular records, validates required columns, and commits them to Supabase tables. |
| `src/utils/excelTemplates.ts` | Utilities for file parsing: maps raw column headers to internal schema keys, handles date formatting, and generates sample Excel templates for user download. |

---

### ⏱️ Labor Timesheets & Role Classification
| File Path | Description & Functionality |
| :--- | :--- |
| `src/components/TimesheetTab.tsx` | **Timesheet Engine**: Primary view for Connecteam labor entries.<br>• **Top Shift Log Table**: Searchable, sortable, and paginated table (10, 25, 50, 100 rows/page).<br>• **Role Category Breakdown Card**: Calculates and displays unique worker headcounts (e.g. `X Workers (Y%)`), shift counts, hours, and labor costs for each position.<br>• **Interactive Role Filtering**: Clicking on any role category card or table badge filters the shift log table and metrics.<br>• **Unclassified Rate Exception Panel**: Lists custom hourly rates not matching standard tiers and tracks worker headcounts for each rate.<br>• **Work Order Rollup Modal**: Drilldown modal showing gross margins and shift lists per Work Order. |
| `src/utils/helpers.ts` | **Core Business Calculations & Formatters**:<br>• `classifyLaborRole(...)`: Matches an employee's hourly rate against standard tiers (`$55.70` General Foreman, `$54.70`/`$54.57` Foreman, `$51.16` Journeyman, `$38.37` Apprentice, `$25.66` Groundman) or crew assignments.<br>• `formatCurrency(...)`: Formats numbers as USD currency strings.<br>• `formatHours(...)`: Formats numeric hours with clean `hrs` units. |

---

### 📊 Executive Dashboard & Analytics
| File Path | Description & Functionality |
| :--- | :--- |
| `src/components/Kpis.tsx` | **KPI Metric Cards**: Displays Total Invoiced Revenue, Total Labor Cost, Gross Profit Margin, Net Margin, and Expense KPI.<br>• **Expense Overrides**: Users can adjust expenses with `+` and `-` buttons. Adjustments are instantly dispatched to Redux and committed to the database. |
| `src/components/CrewMetricsTable.tsx` | **Crew Performance Table**: Aggregates revenue, direct labor costs, overtime hours, and profit margins per General Foreman & Foreman. Includes sorting and pagination. |
| `src/components/ProfitMarginOverTime.tsx` | Chart component visualizing margin health and revenue trends over time. |
| `src/components/ApprovedVsUnapprovedChart.tsx` | Status breakdown chart displaying the distribution of Approved vs Unapproved Coupa invoices. |
| `src/components/ServiceMap.tsx` | Regional distribution view displaying work order density by geographical area (e.g., Houston Metro). |
| `src/components/UserSettingsModal.tsx` | System administration modal: configure standard labor rate categories, manage rate tolerances, and view user permissions. |

---

### 🗄️ State Management & Database
| File Path | Description & Functionality |
| :--- | :--- |
| `src/store/store.ts` | Configures the Redux store with `dbReducer`, `filtersReducer`, and `authReducer`. Defines `RootState` and `AppDispatch` types. |
| `src/store/dbSlice.ts` | **Main Database Slice**:<br>• Stores arrays for `invoices`, `workOrders`, `laborEntries`, `laborRateCategories`, and `expenseOverrides`.<br>• `fetchDbState()`: Async thunk querying Supabase REST tables.<br>• `saveExpenseOverrideToDb()`: Async thunk writing manual expense adjustments to the `expense_overrides` Supabase table.<br>• `clearAllDataInDb()`: Clears all records from Supabase tables. |
| `src/store/filtersSlice.ts` | **Global Filters Slice**: Stores state for `startDate`, `endDate`, `generalForeman`, `foreman: string[]`, `workOrderNumbers: string[]`, `status`, and `area`. |
| `src/store/authSlice.ts` | **Auth Slice**: Stores authenticated user session and permission role (`Admin`, `Supervisor`, `Employee`). |
| `src/types/schemas.ts` | TypeScript schemas defining entities: `LaborEntry`, `Invoice`, `WorkOrder`, `LaborRateCategory`, `ExpenseOverride`, `User`. |
| `src/utils/supabaseClient.ts` | Initializes and exports the Supabase JS client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. |
| `supabase_schema.sql` | PostgreSQL schema file defining database tables (`invoices`, `work_orders`, `labor_entries`, `labor_rate_categories`, `expense_overrides`, `users`) with primary keys, indexes, and relations. |

---

## 4. 🔄 End-to-End Data Flow

```
┌────────────────────────────────────────────────────────┐
│               Supabase Cloud Database                  │
│  (invoices, work_orders, labor_entries, overrides)     │
└──────────────────────────┬─────────────────────────────┘
                           │ (fetchDbState on app mount)
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Redux Store                          │
│  ├── dbSlice        (All raw tables & overrides)       │
│  ├── filtersSlice   (Active search, dates, crews, WOs) │
│  └── authSlice      (Current user role session)        │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌──────────────────────────┐┌──────────────────────────┐
│     Dashboard View       ││     Timesheet View       │
│ • KPIs & Overrides       ││ • Shift Log Table (Top)  │
│ • Crew Performance Table ││ • Headcount by Role Card │
│ • Margin Trend Charts    ││ • Unclassified Panel     │
│ • Status Breakdown       ││ • Work Order Rollup Modal│
└──────────────────────────┘└──────────────────────────┘
```

---

## 5. 🚀 Developer Workflows & Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```

### 3. Build for Production
```bash
npm run build
```

### 4. Database Setup
Execute the SQL statements in `supabase_schema.sql` inside your Supabase project's **SQL Editor** to create or reset all required tables.
