import React, { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { LaborEntry, WorkOrder } from '../types/schemas';
import { formatCurrency, formatHours, classifyLaborRole, getLaborRoleBenefitsRate, DEFAULT_LABOR_RATE_CATEGORIES } from '../utils/helpers';
import {
  Users,
  Clock,
  DollarSign,
  AlertTriangle,
  Search,
  Layers,
  ArrowUpDown,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const TimesheetTab: React.FC = () => {
  const filters = useSelector((state: RootState) => state.filters);
  const { laborEntries, laborRateCategories, workOrders, invoices } = useSelector((state: RootState) => state.db);
  const { currentUser } = useSelector((state: RootState) => state.auth);

  const isEmployee = currentUser?.role === 'Employee';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('shift_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedWorkOrderForRollup, setSelectedWorkOrderForRollup] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Fast lookup for parent Work Order details
  const woMap = useMemo(() => {
    const map = new Map<string, WorkOrder>();
    workOrders.forEach((w) => {
      if (w.work_order_number) {
        map.set(String(w.work_order_number).trim(), w);
      }
    });
    return map;
  }, [workOrders]);

  // Company-wide supervisory rosters to ensure consistent crew categorization across all work orders
  const gfNamesSet = useMemo(() => {
    const set = new Set<string>();
    workOrders.forEach((w) => {
      if (w.general_foreman) {
        set.add(w.general_foreman.trim().toLowerCase());
      }
    });
    return set;
  }, [workOrders]);

  const foremanNamesSet = useMemo(() => {
    const set = new Set<string>();
    workOrders.forEach((w) => {
      if (w.foreman) {
        set.add(w.foreman.trim().toLowerCase());
      }
    });
    return set;
  }, [workOrders]);

  const getEntryOtHours = (e: LaborEntry): number => {
    if (e.ot_hours !== undefined && e.ot_hours !== null && !isNaN(Number(e.ot_hours))) return Number(e.ot_hours);
    return e.shift_hours > 8 ? parseFloat((e.shift_hours - 8).toFixed(2)) : 0;
  };

  const getEntryOtCost = (e: LaborEntry): number => {
    if (e.ot_cost !== undefined && e.ot_cost !== null && !isNaN(Number(e.ot_cost)) && Number(e.ot_cost) > 0) return Number(e.ot_cost);
    const otH = getEntryOtHours(e);
    return parseFloat((otH * e.hourly_rate * 1.5).toFixed(2));
  };

  const getEntryDtHours = (e: LaborEntry): number => {
    if (e.dt_hours !== undefined && e.dt_hours !== null && !isNaN(Number(e.dt_hours))) return Number(e.dt_hours);
    return 0;
  };

  const getEntryDtCost = (e: LaborEntry): number => {
    if (e.dt_cost !== undefined && e.dt_cost !== null && !isNaN(Number(e.dt_cost)) && Number(e.dt_cost) > 0) return Number(e.dt_cost);
    const dtH = getEntryDtHours(e);
    return parseFloat((dtH * e.hourly_rate * 2.0).toFixed(2));
  };

  const getEntryRole = (entry: LaborEntry): string => {
    const wo = woMap.get(String(entry.work_order_number || '').trim());
    return classifyLaborRole(
      entry.hourly_rate,
      laborRateCategories && laborRateCategories.length > 0 ? laborRateCategories : DEFAULT_LABOR_RATE_CATEGORIES,
      entry.employee_name,
      wo,
      gfNamesSet,
      foremanNamesSet
    );
  };

  const getEntryBenefitsCost = (e: LaborEntry): number => {
    if (e.benefits_cost !== undefined && e.benefits_cost !== null && !isNaN(Number(e.benefits_cost)) && Number(e.benefits_cost) > 0) return Number(e.benefits_cost);
    const role = getEntryRole(e);
    const bRate = e.benefits_rate || getLaborRoleBenefitsRate(role, laborRateCategories);
    return parseFloat((e.shift_hours * bRate).toFixed(2));
  };

  const getEntryRegularHours = (e: LaborEntry): number => {
    const otH = getEntryOtHours(e);
    const dtH = getEntryDtHours(e);
    return Math.max(0, parseFloat((e.shift_hours - otH - dtH).toFixed(2)));
  };

  const getEntryRegularCost = (e: LaborEntry): number => {
    const regH = getEntryRegularHours(e);
    return parseFloat((regH * e.hourly_rate).toFixed(2));
  };

  const getEntryLaborCost = (e: LaborEntry): number => {
    if (e.line_labor_cost !== undefined && e.line_labor_cost !== null && !isNaN(Number(e.line_labor_cost)) && Number(e.line_labor_cost) > 0) {
      return Number(e.line_labor_cost);
    }
    const regCost = getEntryRegularCost(e);
    const otCost = getEntryOtCost(e);
    const dtCost = getEntryDtCost(e);
    const benefitsCost = getEntryBenefitsCost(e);
    return parseFloat((regCost + otCost + dtCost + benefitsCost).toFixed(2));
  };

  // Reset to page 1 whenever filters or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedRoleFilter, filters, pageSize]);

  // Base filtered entries (before local role filter is applied)
  const baseFilteredEntries = useMemo(() => {
    return laborEntries.filter((entry) => {
      const wo = woMap.get(String(entry.work_order_number || '').trim());
      const gf = wo?.general_foreman || 'Unassigned GF';
      const f = wo?.foreman || 'Unassigned Foreman';
      const area = wo?.area || '';

      // Global Redux Filters
      if (filters.generalForeman !== 'All crews' && gf !== filters.generalForeman) return false;
      if (filters.foreman.length > 0 && !filters.foreman.includes(f)) return false;
      if (filters.workOrderNumbers && filters.workOrderNumbers.length > 0 && !filters.workOrderNumbers.includes(entry.work_order_number)) return false;
      if (filters.area !== 'All areas' && area !== filters.area) return false;
      if (filters.startDate && entry.shift_date < filters.startDate) return false;
      if (filters.endDate && entry.shift_date > filters.endDate) return false;

      // Local Tab Search
      const matchesSearch =
        entry.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.work_order_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        gf.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [laborEntries, woMap, filters, searchQuery]);

  // Filtered entries linked to role filter
  const filteredEntries = useMemo(() => {
    if (selectedRoleFilter === 'all') return baseFilteredEntries;
    return baseFilteredEntries.filter((entry) => {
      const roleCat = getEntryRole(entry);
      if (selectedRoleFilter === 'unclassified') return roleCat === 'unclassified';
      if (selectedRoleFilter === 'General Foreman' || selectedRoleFilter === 'GForeman') {
        return roleCat === 'General Foreman' || roleCat === 'GForeman';
      }
      return roleCat.toLowerCase() === selectedRoleFilter.toLowerCase();
    });
  }, [baseFilteredEntries, selectedRoleFilter, woMap, laborRateCategories, gfNamesSet, foremanNamesSet]);

  // Sorted entries
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      let aVal: any = a[sortField as keyof LaborEntry];
      let bVal: any = b[sortField as keyof LaborEntry];

      if (sortField === 'general_foreman') {
        aVal = woMap.get(String(a.work_order_number || '').trim())?.general_foreman || '';
        bVal = woMap.get(String(b.work_order_number || '').trim())?.general_foreman || '';
      } else if (sortField === 'foreman') {
        aVal = woMap.get(String(a.work_order_number || '').trim())?.foreman || '';
        bVal = woMap.get(String(b.work_order_number || '').trim())?.foreman || '';
      } else if (sortField === 'role_category') {
        aVal = getEntryRole(a);
        bVal = getEntryRole(b);
      } else if (sortField === 'ot_hours') {
        aVal = getEntryOtHours(a);
        bVal = getEntryOtHours(b);
      } else if (sortField === 'ot_cost') {
        aVal = getEntryOtCost(a);
        bVal = getEntryOtCost(b);
      } else if (sortField === 'dt_hours') {
        aVal = getEntryDtHours(a);
        bVal = getEntryDtHours(b);
      } else if (sortField === 'dt_cost') {
        aVal = getEntryDtCost(a);
        bVal = getEntryDtCost(b);
      } else if (sortField === 'benefits_cost') {
        aVal = getEntryBenefitsCost(a);
        bVal = getEntryBenefitsCost(b);
      } else if (sortField === 'line_labor_cost') {
        aVal = getEntryLaborCost(a);
        bVal = getEntryLaborCost(b);
      }

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEntries, sortField, sortOrder, woMap, laborRateCategories, gfNamesSet, foremanNamesSet]);

  // Paginated entries calculation
  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, sortedEntries.length);
  const paginatedEntries = useMemo(() => {
    return sortedEntries.slice(startIndex, endIndex);
  }, [sortedEntries, startIndex, endIndex]);

  // Overall KPIs (derived from filtered entries for dashboard consistency)
  const totalHours = useMemo(() => filteredEntries.reduce((sum, e) => sum + e.shift_hours, 0), [filteredEntries]);
  const totalLaborCost = useMemo(() => filteredEntries.reduce((sum, e) => sum + getEntryLaborCost(e), 0), [filteredEntries]);
  const uniqueHeadcount = useMemo(() => new Set(filteredEntries.map((e) => e.employee_name.trim())).size, [filteredEntries]);

  // Base total hours for percentage calculation across all roles
  const baseTotalHours = useMemo(() => baseFilteredEntries.reduce((sum, e) => sum + e.shift_hours, 0), [baseFilteredEntries]);
  const baseTotalHeadcount = useMemo(() => new Set(baseFilteredEntries.map((e) => e.employee_name.trim())).size, [baseFilteredEntries]);

  // Role Breakdown with distinct employee headcount tracking across all 7 roles
  const roleBreakdown = useMemo(() => {
    const map: Record<string, { count: number; hours: number; cost: number; employees: Set<string> }> = {
      'General Foreman': { count: 0, hours: 0, cost: 0, employees: new Set() },
      Foreman: { count: 0, hours: 0, cost: 0, employees: new Set() },
      Journeyman: { count: 0, hours: 0, cost: 0, employees: new Set() },
      'Pole Truck Driver': { count: 0, hours: 0, cost: 0, employees: new Set() },
      Apprentice: { count: 0, hours: 0, cost: 0, employees: new Set() },
      Groundman: { count: 0, hours: 0, cost: 0, employees: new Set() },
      'Pole Truck Helper': { count: 0, hours: 0, cost: 0, employees: new Set() },
      unclassified: { count: 0, hours: 0, cost: 0, employees: new Set() }
    };

    baseFilteredEntries.forEach((entry) => {
      let cat = getEntryRole(entry);
      if (cat === 'GForeman') cat = 'General Foreman';
      if (!map[cat]) {
        map[cat] = { count: 0, hours: 0, cost: 0, employees: new Set() };
      }
      map[cat].count += 1;
      map[cat].hours += entry.shift_hours;
      map[cat].cost += getEntryLaborCost(entry);
      if (entry.employee_name) {
        map[cat].employees.add(entry.employee_name.trim());
      }
    });

    return map;
  }, [baseFilteredEntries, laborRateCategories, woMap, gfNamesSet, foremanNamesSet]);

  // Unclassified Rates Summary
  const unclassifiedEntries = useMemo(
    () => baseFilteredEntries.filter((e) => getEntryRole(e) === 'unclassified'),
    [baseFilteredEntries, laborRateCategories, woMap, gfNamesSet, foremanNamesSet]
  );
  const unclassifiedCount = unclassifiedEntries.length;
  const unclassifiedHours = unclassifiedEntries.reduce((sum, e) => sum + e.shift_hours, 0);

  const unclassifiedRateDistribution = useMemo(() => {
    const dist: Record<number, { count: number; hours: number; cost: number; employees: Set<string> }> = {};
    unclassifiedEntries.forEach((e) => {
      if (!dist[e.hourly_rate]) {
        dist[e.hourly_rate] = { count: 0, hours: 0, cost: 0, employees: new Set() };
      }
      dist[e.hourly_rate].count += 1;
      dist[e.hourly_rate].hours += e.shift_hours;
      dist[e.hourly_rate].cost += getEntryLaborCost(e);
      if (e.employee_name) {
        dist[e.hourly_rate].employees.add(e.employee_name.trim());
      }
    });
    return Object.entries(dist).map(([rateStr, stats]) => ({
      rate: parseFloat(rateStr),
      ...stats
    }));
  }, [unclassifiedEntries]);

  // Rollup details for selected work order
  const activeWorkOrderRollup = useMemo(() => {
    if (!selectedWorkOrderForRollup) return null;
    const wo = workOrders.find((w) => String(w.work_order_number).trim() === String(selectedWorkOrderForRollup).trim());
    const woInvoices = invoices.filter((i) => String(i.work_order_number).trim() === String(selectedWorkOrderForRollup).trim());
    const woEntries = laborEntries.filter((e) => String(e.work_order_number).trim() === String(selectedWorkOrderForRollup).trim());
    const woHours = woEntries.reduce((sum, e) => sum + e.shift_hours, 0);
    const woCost = woEntries.reduce((sum, e) => sum + getEntryLaborCost(e), 0);

    const invoiceTotal = woInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const grossMargin = invoiceTotal - woCost;
    const marginPct = invoiceTotal > 0 ? (grossMargin / invoiceTotal) * 100 : 0;

    return {
      workOrderNumber: selectedWorkOrderForRollup,
      status: wo?.status || 'Active',
      crewLeader: wo?.foreman || wo?.general_foreman || 'Unassigned Crew',
      generalForeman: wo?.general_foreman || 'N/A',
      area: wo?.area || 'Houston Metro',
      address: wo?.address || 'N/A',
      invoiceTotal,
      laborCost: woCost,
      laborHours: woHours,
      grossMargin,
      marginPct,
      entries: woEntries
    };
  }, [selectedWorkOrderForRollup, laborEntries, workOrders, invoices]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'General Foreman':
      case 'GForeman':
        return 'General Foreman';
      case 'Foreman':
        return 'Foreman';
      case 'Journeyman':
        return 'Journeyman Lineman';
      case 'Pole Truck Driver':
        return 'Pole Truck Driver';
      case 'Apprentice':
        return 'Apprentice Lineman';
      case 'Groundman':
        return 'Groundman';
      case 'Pole Truck Helper':
        return 'Pole Truck Helper';
      case 'unclassified':
      default:
        return 'Unclassified Rate';
    }
  };

  const getRoleCategoryBadge = (role: string) => {
    switch (role) {
      case 'General Foreman':
      case 'GForeman':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Foreman':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Journeyman':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Pole Truck Driver':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'Apprentice':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Groundman':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Pole Truck Helper':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'unclassified':
      default:
        return 'bg-red-50 text-red-700 border-red-200 font-semibold';
    }
  };

  return (
    <div className="flex flex-col gap-6 select-none font-sans">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight my-0">Connecteam Labor & Timesheets</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Role classification with standard rates and crew assignments. Labor Cost is calculated as Regular Cost + OT (1.5x) + DT (2.0x) + Benefits.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Row (Matched to Dashboard KPIs theme) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Hours */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Total Hours</p>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 my-2 font-mono">{formatHours(totalHours)}</h1>
          <p className="text-xs text-slate-500 font-medium">
            <span className="font-semibold text-slate-700">{laborEntries.length}</span> recorded shift entries
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: '100%' }} />
          </div>
        </motion.div>

        {/* Total Labor Cost */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Total Labor Cost</p>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 my-2 font-mono text-emerald-600">
            {isEmployee ? '***' : formatCurrency(totalLaborCost)}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Regular + <span className="font-semibold text-amber-600">OT (1.5x)</span> + <span className="font-semibold text-orange-600">DT (2.0x)</span> + Benefits applied
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-emerald-600 h-full rounded-full" style={{ width: '100%' }} />
          </div>
        </motion.div>

        {/* Active Workforce */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Active Workforce</p>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 my-2 font-mono text-indigo-600">
            {uniqueHeadcount} <span className="text-sm font-semibold text-slate-500 font-sans">Workers</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            <span className="font-semibold text-slate-700">{uniqueHeadcount}</span> distinct employees logged
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full" style={{ width: '100%' }} />
          </div>
        </motion.div>

        {/* Unclassified Entries */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Unclassified Entries</p>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 my-2 font-mono text-amber-600">
            {unclassifiedCount}{' '}
            <span className="text-xs text-slate-400 font-sans font-normal">
              ({laborEntries.length > 0 ? ((unclassifiedCount / laborEntries.length) * 100).toFixed(0) : 0}%)
            </span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            <span className="font-semibold text-amber-600">{formatHours(unclassifiedHours)}</span> custom/variable rate
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${laborEntries.length > 0 ? Math.min(100, (unclassifiedCount / laborEntries.length) * 100) : 0}%` }}
            />
          </div>
        </motion.div>
      </div>

      {/* SHIFT LOG TABLE CARD */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 select-none overflow-x-auto font-sans">
        {/* Table Controls */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by employee, work order #, general foreman..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-semibold">Role Filter:</label>
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:bg-white focus:border-blue-500 cursor-pointer font-medium"
              >
                <option value="all">All Roles & Categories</option>
                <option value="General Foreman">General Foreman ($58.49)</option>
                <option value="Foreman">Foreman ($57.30)</option>
                <option value="Journeyman">Journeyman ($53.72)</option>
                <option value="Pole Truck Driver">Pole Truck Driver ($40.23)</option>
                <option value="Apprentice">Apprentice ($37.60)</option>
                <option value="Groundman">Groundman ($26.94)</option>
                <option value="Pole Truck Helper">Pole Truck Helper ($15.00)</option>
                <option value="unclassified">Unclassified Rates Only</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <label className="text-[11px] font-semibold text-slate-400">Rows:</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:bg-white focus:border-blue-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Role Filter Banner */}
        {selectedRoleFilter !== 'all' && (
          <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-4 text-xs text-blue-800">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span>
                Filtered by role:{' '}
                <strong className="text-blue-950 font-bold">{getRoleDisplayName(selectedRoleFilter)}</strong>{' '}
                ({filteredEntries.length} shift entries · {uniqueHeadcount} {uniqueHeadcount === 1 ? 'worker' : 'workers'})
              </span>
            </div>
            <button
              onClick={() => setSelectedRoleFilter('all')}
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" /> Clear Role Filter
            </button>
          </div>
        )}

        {/* Shift Entries Table */}
        <table className="w-full border-collapse text-left text-xs text-slate-600 min-w-[900px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th
                className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors whitespace-nowrap"
                onClick={() => handleSort('shift_date')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Shift Date (Start - End)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => handleSort('employee_name')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Employee</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => handleSort('work_order_number')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Work Order</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => handleSort('general_foreman')}
              >
                <div className="flex items-center gap-1.5">
                  <span>General Foreman</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => handleSort('foreman')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Foreman</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => handleSort('role_category')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Role Category</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => handleSort('shift_hours')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Hours</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => handleSort('hourly_rate')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Hourly Rate</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => handleSort('ot_hours')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>OT Hours</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => handleSort('ot_cost')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>OT Cost</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => handleSort('dt_hours')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>DT Hours</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => handleSort('dt_cost')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>DT Cost</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => handleSort('benefits_cost')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Benefits</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 transition-colors"
                onClick={() => handleSort('line_labor_cost')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Labor Cost</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 text-center">WO Rollup</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedEntries.map((entry) => {
              const wo = woMap.get(String(entry.work_order_number || '').trim());
              return (
                <tr key={entry.id || (entry.work_order_number + '-' + entry.shift_date + '-' + entry.employee_name)} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                    {entry.start_date && entry.end_date && entry.start_date !== entry.end_date ? (
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <span>{entry.start_date}</span>
                          <span className="text-slate-400 font-normal">→</span>
                          <span>{entry.end_date}</span>
                        </div>
                        <span className="text-[10px] text-indigo-600 font-sans font-medium">Overnight shift</span>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{entry.start_date || entry.shift_date}</span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          {entry.end_date ? `End: ${entry.end_date}` : 'Single-day'}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">{entry.employee_name}</td>
                  <td className="py-3 px-4 font-mono font-semibold text-blue-600 whitespace-nowrap">
                    {entry.work_order_number ? `#${entry.work_order_number}` : <span className="text-slate-400 italic">Unassigned</span>}
                  </td>
                  <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                    {wo?.general_foreman || <span className="text-slate-400 italic">-</span>}
                  </td>
                  <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                    {wo?.foreman || <span className="text-slate-400 italic">-</span>}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {(() => {
                      const role = getEntryRole(entry);
                      return (
                        <button
                          onClick={() => setSelectedRoleFilter(selectedRoleFilter.toLowerCase() === role.toLowerCase() ? 'all' : role)}
                          className={'px-2 py-0.5 rounded text-[10px] uppercase font-bold border transition-all hover:scale-105 cursor-pointer ' + getRoleCategoryBadge(role)}
                          title={`Filter by ${getRoleDisplayName(role)}`}
                        >
                          {role}
                        </button>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                    {formatHours(entry.shift_hours)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {isEmployee ? '***' : formatCurrency(entry.hourly_rate)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-amber-600 font-semibold">
                    {formatHours(getEntryOtHours(entry))}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-amber-700 font-semibold">
                    {isEmployee ? '***' : formatCurrency(getEntryOtCost(entry))}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-orange-600 font-semibold">
                    {formatHours(getEntryDtHours(entry))}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-orange-700 font-semibold">
                    {isEmployee ? '***' : formatCurrency(getEntryDtCost(entry))}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-purple-700 font-semibold">
                    {isEmployee ? '***' : formatCurrency(getEntryBenefitsCost(entry))}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                    {isEmployee ? '***' : formatCurrency(getEntryLaborCost(entry))}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {entry.work_order_number ? (
                      <button
                        onClick={() => setSelectedWorkOrderForRollup(entry.work_order_number)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="View Work Order Labor Rollup"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {paginatedEntries.length === 0 && (
              <tr>
                <td colSpan={15} className="py-8 px-4 text-center text-slate-400">
                  No timesheet entries matched your search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-3 mt-2 rounded-b-xl">
          <div className="font-medium">
            {sortedEntries.length === 0 ? (
              <span>0 entries</span>
            ) : (
              <span>
                Showing <strong className="text-slate-800">{startIndex + 1}</strong> to{' '}
                <strong className="text-slate-800">{endIndex}</strong> of{' '}
                <strong className="text-slate-800">{sortedEntries.length}</strong> entries
              </span>
            )}
          </div>

          {/* Pagination Navigation */}
          <div className="flex items-center gap-1.5 select-none">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-mono text-xs text-slate-700 bg-white border border-slate-200 rounded-lg">
              Page <strong className="text-blue-600">{safeCurrentPage}</strong> of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Role Breakdown Bar & Unclassified Alert Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role Distribution Card */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 my-0">
                <Layers className="w-4 h-4 text-blue-600" />
                Role Category Breakdown & Headcount
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Click any role category to filter the shift log and metrics.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-mono bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                {baseTotalHeadcount} Total Active Workers
              </span>
              {selectedRoleFilter !== 'all' && (
                <button
                  onClick={() => setSelectedRoleFilter('all')}
                  className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer font-medium"
                >
                  <X className="w-3.5 h-3.5" /> Show All
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(roleBreakdown).map(([category, stats]) => {
              const headcount = stats.employees.size;
              const pctOfHours = baseTotalHours > 0 ? (stats.hours / baseTotalHours) * 100 : 0;
              const pctOfHeadcount = baseTotalHeadcount > 0 ? (headcount / baseTotalHeadcount) * 100 : 0;
              const refCat = laborRateCategories.find((c) => c.category_name.toLowerCase() === category.toLowerCase());
              const standardRate = refCat ? ('$' + refCat.standard_rate.toFixed(2) + '/hr') : 'Variable / Custom';
              const isSelected = selectedRoleFilter.toLowerCase() === category.toLowerCase();

              return (
                <div
                  key={category}
                  onClick={() => setSelectedRoleFilter(isSelected ? 'all' : category)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/30 shadow-sm'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-2">
                    {/* Left: Role Name, Standard Rate & Headcount Tag */}
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={'px-2 py-0.5 rounded text-[10px] uppercase font-bold border ' + getRoleCategoryBadge(category)}>
                        {category}
                      </span>
                      <span className="text-slate-800 font-semibold text-xs">{getRoleDisplayName(category)}</span>
                      <span className="text-slate-400 text-[11px]">({standardRate})</span>

                      {/* Headcount Pill */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Users className="w-3 h-3 text-blue-600" />
                        <span>
                          {headcount} {headcount === 1 ? 'Worker' : 'Workers'}
                          {baseTotalHeadcount > 0 ? ` (${pctOfHeadcount.toFixed(0)}%)` : ''}
                        </span>
                      </span>

                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active Filter
                        </span>
                      )}
                    </div>

                    {/* Right: Shifts, Total Hours, Labor Cost & Share % */}
                    <div className="flex items-center gap-2.5 font-mono text-[11px] text-right">
                      <span className="text-slate-500">{stats.count} {stats.count === 1 ? 'shift' : 'shifts'}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-700 font-semibold">{formatHours(stats.hours)}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-emerald-600 font-bold">
                        {isEmployee ? '***' : formatCurrency(stats.cost)}
                      </span>
                      <span className="text-slate-400 w-12 text-right">({pctOfHours.toFixed(1)}%)</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden flex">
                    <div
                      className={'h-full rounded-full transition-all duration-500 ' + (
                        category === 'unclassified'
                          ? 'bg-red-500'
                          : category === 'General Foreman' || category === 'GForeman'
                          ? 'bg-purple-600'
                          : category === 'Foreman'
                          ? 'bg-blue-600'
                          : category === 'Journeyman'
                          ? 'bg-indigo-600'
                          : category === 'Pole Truck Driver'
                          ? 'bg-cyan-600'
                          : category === 'Apprentice'
                          ? 'bg-emerald-600'
                          : category === 'Groundman'
                          ? 'bg-amber-500'
                          : 'bg-slate-500'
                      )}
                      style={{ width: `${Math.max(pctOfHours, 1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unclassified Rates Panel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Unclassified Rate Exception Panel</span>
              </div>
              {selectedRoleFilter === 'unclassified' ? (
                <button
                  onClick={() => setSelectedRoleFilter('all')}
                  className="text-[10px] font-semibold text-amber-800 hover:text-amber-950 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded cursor-pointer"
                >
                  Clear Filter
                </button>
              ) : (
                <button
                  onClick={() => setSelectedRoleFilter('unclassified')}
                  className="text-[10px] font-semibold text-amber-600 hover:text-amber-800 hover:underline cursor-pointer"
                >
                  Filter Unclassified
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              These rates do not match standard categories or crew leadership assignments. Actual Connecteam shift rates are preserved in all calculations.
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {unclassifiedRateDistribution.map((item) => (
                <div
                  key={item.rate}
                  onClick={() => setSelectedRoleFilter('unclassified')}
                  className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs cursor-pointer transition-colors"
                  title="Click to filter by unclassified entries"
                >
                  <div>
                    <span className="font-bold text-slate-900 font-mono">{formatCurrency(item.rate)}/hr</span>
                    <div className="text-slate-500 text-[10px] flex items-center gap-1.5 mt-0.5">
                      <span>{item.employees.size} {item.employees.size === 1 ? 'worker' : 'workers'}</span>
                      <span>·</span>
                      <span>{item.count} {item.count === 1 ? 'shift' : 'shifts'}</span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-slate-700 font-medium">{formatHours(item.hours)}</div>
                    <div className="text-slate-500 text-[10px]">{isEmployee ? '***' : formatCurrency(item.cost)}</div>
                  </div>
                </div>
              ))}
              {unclassifiedRateDistribution.length === 0 && (
                <div className="p-4 text-center text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>All shifts matched standard rate categories</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
            Standard tolerance & crew leadership hierarchy applied.
          </div>
        </div>
      </div>

      {/* Per-Work-Order Labor Rollup Modal */}
      <AnimatePresence>
        {activeWorkOrderRollup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 font-mono my-0">
                      WO #{activeWorkOrderRollup.workOrderNumber}
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                      {activeWorkOrderRollup.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Crew Leader: {activeWorkOrderRollup.crewLeader} · Area: {activeWorkOrderRollup.area}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedWorkOrderForRollup(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Summary stats */}
              <div className="p-6 grid grid-cols-3 gap-4 bg-slate-50/50 border-b border-slate-200 text-center">
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] text-slate-400 block font-semibold">TOTAL LABOR HOURS</span>
                  <span className="text-base font-bold text-slate-900 font-mono">
                    {formatHours(activeWorkOrderRollup.laborHours)}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] text-slate-400 block font-semibold">TOTAL LABOR COST</span>
                  <span className="text-base font-bold text-emerald-600 font-mono">
                    {isEmployee ? '***' : formatCurrency(activeWorkOrderRollup.laborCost)}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] text-slate-400 block font-semibold">EST. PROFIT MARGIN</span>
                  <span className={'text-base font-bold font-mono ' + (
                    activeWorkOrderRollup.grossMargin >= 0 ? 'text-blue-600' : 'text-red-600'
                  )}>
                    {isEmployee ? '***' : (activeWorkOrderRollup.marginPct.toFixed(1) + '%')}
                  </span>
                </div>
              </div>

              {/* Shifts list for this WO */}
              <div className="p-6 max-h-60 overflow-y-auto">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Contributing Shift Entries ({activeWorkOrderRollup.entries.length})
                </h4>
                <div className="space-y-2">
                  {activeWorkOrderRollup.entries.map((e, idx) => (
                    <div
                      key={e.id || idx}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{e.employee_name}</span>
                        <span className="text-slate-500 text-[10px] block mt-0.5">
                          {e.start_date && e.end_date && e.start_date !== e.end_date
                            ? `${e.start_date} → ${e.end_date}`
                            : (e.start_date || e.shift_date)} · <span className={getRoleCategoryBadge(getEntryRole(e))}>{getEntryRole(e)}</span>
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-slate-700 font-medium">{formatHours(e.shift_hours)} @ {formatCurrency(e.hourly_rate)}/hr</div>
                        <div className="text-[10px] text-slate-400">
                          {getEntryOtHours(e) > 0 ? `OT: ${formatHours(getEntryOtHours(e))} · ` : ''}
                          {getEntryDtHours(e) > 0 ? `DT: ${formatHours(getEntryDtHours(e))} · ` : ''}
                          {`Ben: ${formatCurrency(getEntryBenefitsCost(e))}`}
                        </div>
                        <div className="text-emerald-600 font-bold">{formatCurrency(getEntryLaborCost(e))}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setSelectedWorkOrderForRollup(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimesheetTab;
