import React, { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { LaborEntry } from '../types/schemas';
import { formatCurrency, formatHours, classifyLaborRole, DEFAULT_LABOR_RATE_CATEGORIES } from '../utils/helpers';
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
    const map = new Map<string, any>();
    workOrders.forEach((w) => {
      map.set(w.work_order_number, w);
    });
    return map;
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

  const getEntryRole = (entry: LaborEntry): string => {
    if (entry.role_category && entry.role_category !== 'unclassified') {
      return entry.role_category;
    }
    const wo = woMap.get(entry.work_order_number);
    return classifyLaborRole(
      entry.hourly_rate,
      laborRateCategories && laborRateCategories.length > 0 ? laborRateCategories : DEFAULT_LABOR_RATE_CATEGORIES,
      entry.employee_name,
      wo
    );
  };

  // Reset to page 1 whenever filters or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedRoleFilter, filters, pageSize]);

  // Base filtered entries (before role filter is applied)
  const baseFilteredEntries = useMemo(() => {
    return laborEntries.filter((entry) => {
      const wo = woMap.get(entry.work_order_number);
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
  }, [laborEntries, woMap, filters, searchQuery, laborRateCategories]);

  // Filtered entries linked to role filter
  const filteredEntries = useMemo(() => {
    if (selectedRoleFilter === 'all') return baseFilteredEntries;
    return baseFilteredEntries.filter((entry) => {
      const roleCat = getEntryRole(entry);
      return selectedRoleFilter === 'unclassified'
        ? roleCat === 'unclassified'
        : roleCat.toLowerCase() === selectedRoleFilter.toLowerCase();
    });
  }, [baseFilteredEntries, selectedRoleFilter, woMap, laborRateCategories]);

  // Sorted entries
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      let aVal: any = a[sortField as keyof LaborEntry];
      let bVal: any = b[sortField as keyof LaborEntry];

      if (sortField === 'general_foreman') {
        aVal = woMap.get(a.work_order_number)?.general_foreman || '';
        bVal = woMap.get(b.work_order_number)?.general_foreman || '';
      } else if (sortField === 'foreman') {
        aVal = woMap.get(a.work_order_number)?.foreman || '';
        bVal = woMap.get(b.work_order_number)?.foreman || '';
      } else if (sortField === 'role_category') {
        aVal = getEntryRole(a);
        bVal = getEntryRole(b);
      } else if (sortField === 'ot_hours') {
        aVal = getEntryOtHours(a);
        bVal = getEntryOtHours(b);
      } else if (sortField === 'ot_cost') {
        aVal = getEntryOtCost(a);
        bVal = getEntryOtCost(b);
      }

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEntries, sortField, sortOrder, woMap, laborRateCategories]);

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
  const totalLaborCost = useMemo(() => filteredEntries.reduce((sum, e) => sum + e.line_labor_cost, 0), [filteredEntries]);
  const uniqueHeadcount = useMemo(() => new Set(filteredEntries.map((e) => e.employee_name)).size, [filteredEntries]);

  // Base total hours for percentage calculation across all roles
  const baseTotalHours = useMemo(() => baseFilteredEntries.reduce((sum, e) => sum + e.shift_hours, 0), [baseFilteredEntries]);
  const baseTotalHeadcount = useMemo(() => new Set(baseFilteredEntries.map((e) => e.employee_name)).size, [baseFilteredEntries]);

  // Role Breakdown with distinct employee headcount tracking
  const roleBreakdown = useMemo(() => {
    const map: Record<string, { count: number; hours: number; cost: number; employees: Set<string> }> = {
      GForeman: { count: 0, hours: 0, cost: 0, employees: new Set() },
      Foreman: { count: 0, hours: 0, cost: 0, employees: new Set() },
      Journeyman: { count: 0, hours: 0, cost: 0, employees: new Set() },
      Apprentice: { count: 0, hours: 0, cost: 0, employees: new Set() },
      Groundman: { count: 0, hours: 0, cost: 0, employees: new Set() },
      unclassified: { count: 0, hours: 0, cost: 0, employees: new Set() }
    };

    baseFilteredEntries.forEach((entry) => {
      const cat = getEntryRole(entry);
      if (!map[cat]) {
        map[cat] = { count: 0, hours: 0, cost: 0, employees: new Set() };
      }
      map[cat].count += 1;
      map[cat].hours += entry.shift_hours;
      map[cat].cost += entry.line_labor_cost;
      if (entry.employee_name) {
        map[cat].employees.add(entry.employee_name.trim());
      }
    });

    return map;
  }, [baseFilteredEntries, laborRateCategories, woMap]);

  // Unclassified Rates Summary
  const unclassifiedEntries = useMemo(
    () => baseFilteredEntries.filter((e) => getEntryRole(e) === 'unclassified'),
    [baseFilteredEntries, laborRateCategories, woMap]
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
      dist[e.hourly_rate].cost += e.line_labor_cost;
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
    const wo = workOrders.find((w) => w.work_order_number === selectedWorkOrderForRollup);
    const woInvoices = invoices.filter((i) => i.work_order_number === selectedWorkOrderForRollup);
    const woEntries = laborEntries.filter((e) => e.work_order_number === selectedWorkOrderForRollup);
    const woHours = woEntries.reduce((sum, e) => sum + e.shift_hours, 0);
    const woCost = woEntries.reduce((sum, e) => sum + e.line_labor_cost, 0);

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
      case 'GForeman':
        return 'General Foreman';
      case 'Foreman':
        return 'Foreman';
      case 'Journeyman':
        return 'Journeyman Lineman';
      case 'Apprentice':
        return 'Apprentice Lineman';
      case 'Groundman':
        return 'Groundman';
      case 'unclassified':
      default:
        return 'Unclassified Rate';
    }
  };

  const getRoleCategoryBadge = (role: string) => {
    switch (role) {
      case 'GForeman':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/60';
      case 'Foreman':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/60';
      case 'Journeyman':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60';
      case 'Apprentice':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
      case 'Groundman':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/60';
      case 'unclassified':
      default:
        return 'bg-red-950/80 text-red-300 border-red-800/60 font-semibold';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Connecteam Labor & Timesheets</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Role classification with standard rates and crew assignments. Connecteam shift hourly rate is the source of truth for total costs.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>TOTAL HOURS</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{formatHours(totalHours)}</div>
          <p className="text-[11px] text-slate-500 mt-1">{laborEntries.length} recorded shift entries</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>TOTAL LABOR COST</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {isEmployee ? '*** Hidden ***' : formatCurrency(totalLaborCost)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Based on exact shift hourly rates</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>ACTIVE WORKFORCE</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-400 font-mono">{uniqueHeadcount} Crew</div>
          <p className="text-[11px] text-slate-500 mt-1">Distinct employees logged</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>UNCLASSIFIED ENTRIES</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {unclassifiedCount}{' '}
            <span className="text-xs text-slate-400 font-normal">
              ({laborEntries.length > 0 ? ((unclassifiedCount / laborEntries.length) * 100).toFixed(0) : 0}%)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{formatHours(unclassifiedHours)} need rate alignment</p>
        </div>
      </div>

      {/* SHIFT LOG TABLE (MOVED TO TOP) WITH SEARCH, FILTERS & PAGINATION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Table Controls */}
        <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by employee, work order #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium">Role:</label>
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">All Roles & Categories</option>
                <option value="GForeman">General Foreman ($55.70)</option>
                <option value="Foreman">Foreman ($54.70)</option>
                <option value="Journeyman">Journeyman ($51.16)</option>
                <option value="Apprentice">Apprentice ($38.37)</option>
                <option value="Groundman">Groundman ($25.66)</option>
                <option value="unclassified">Unclassified Rates Only</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium">Rows:</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700/80 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
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
          <div className="px-5 py-2.5 bg-blue-950/40 border-b border-blue-900/50 flex items-center justify-between gap-4 text-xs text-blue-200">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span>
                Filtered by role:{' '}
                <strong className="text-white font-semibold">{getRoleDisplayName(selectedRoleFilter)}</strong>{' '}
                ({filteredEntries.length} shift entries · {uniqueHeadcount} {uniqueHeadcount === 1 ? 'worker' : 'workers'})
              </span>
            </div>
            <button
              onClick={() => setSelectedRoleFilter('all')}
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-white bg-blue-900/40 hover:bg-blue-900/70 border border-blue-700/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" /> Clear Role Filter
            </button>
          </div>
        )}

        {/* Shift Entries Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th
                  className="px-4 py-3.5 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('shift_date')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Shift Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('employee_name')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('work_order_number')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Work Order</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('general_foreman')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>General Foreman</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('foreman')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Foreman</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('role_category')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Role Category</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('shift_hours')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Hours</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('hourly_rate')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Hourly Rate</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('ot_hours')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>OT Hours</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('ot_cost')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>OT Cost</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('line_labor_cost')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Labor Cost</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3.5 text-center">WO Rollup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedEntries.map((entry) => {
                const wo = woMap.get(entry.work_order_number);
                return (
                  <tr key={entry.id || (entry.work_order_number + '-' + entry.shift_date + '-' + entry.employee_name)} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">{entry.shift_date}</td>
                    <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{entry.employee_name}</td>
                    <td className="px-4 py-3 font-mono font-medium text-blue-400 whitespace-nowrap">
                      {entry.work_order_number || <span className="text-slate-500 italic">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {wo?.general_foreman || <span className="text-slate-500 italic">-</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {wo?.foreman || <span className="text-slate-500 italic">-</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
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
                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-200">
                      {formatHours(entry.shift_hours)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {isEmployee ? '***' : formatCurrency(entry.hourly_rate)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400 font-medium">
                      {formatHours(getEntryOtHours(entry))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-300 font-medium">
                      {isEmployee ? '***' : formatCurrency(getEntryOtCost(entry))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">
                      {isEmployee ? '***' : formatCurrency(entry.line_labor_cost)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.work_order_number ? (
                        <button
                          onClick={() => setSelectedWorkOrderForRollup(entry.work_order_number)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="View Work Order Labor Rollup"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paginatedEntries.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-5 py-8 text-center text-slate-500">
                    No timesheet entries matched your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="font-medium">
            {sortedEntries.length === 0 ? (
              <span>0 entries</span>
            ) : (
              <span>
                Showing <strong className="text-white">{startIndex + 1}</strong> to{' '}
                <strong className="text-white">{endIndex}</strong> of{' '}
                <strong className="text-white">{sortedEntries.length}</strong> entries
              </span>
            )}
          </div>

          {/* Pagination Navigation */}
          <div className="flex items-center gap-1.5 select-none">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-mono text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-lg">
              Page <strong className="text-blue-400">{safeCurrentPage}</strong> of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                Role Category Breakdown & Headcount
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click any role category to filter the shift log and metrics.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                {baseTotalHeadcount} Total Active Workers
              </span>
              {selectedRoleFilter !== 'all' && (
                <button
                  onClick={() => setSelectedRoleFilter('all')}
                  className="text-xs px-2.5 py-1 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/40 rounded-lg flex items-center gap-1 transition-colors cursor-pointer font-medium"
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
                  className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/50 shadow-lg shadow-blue-950/50'
                      : 'bg-slate-950/60 border-slate-800/90 hover:bg-slate-800/50 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-2">
                    {/* Left: Role Name, Standard Rate & Headcount Tag */}
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={'px-2 py-0.5 rounded text-[10px] uppercase font-bold border ' + getRoleCategoryBadge(category)}>
                        {category}
                      </span>
                      <span className="text-white font-medium text-xs">{getRoleDisplayName(category)}</span>
                      <span className="text-slate-400 text-[11px]">({standardRate})</span>

                      {/* Explicit Headcount Pill */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        <Users className="w-3 h-3 text-blue-400" />
                        <span>
                          {headcount} {headcount === 1 ? 'Worker' : 'Workers'}
                          {baseTotalHeadcount > 0 ? ` (${pctOfHeadcount.toFixed(0)}%)` : ''}
                        </span>
                      </span>

                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Active Filter
                        </span>
                      )}
                    </div>

                    {/* Right: Shifts, Total Hours, Labor Cost & Share % */}
                    <div className="flex items-center gap-2.5 font-mono text-[11px] text-right">
                      <span className="text-slate-400">{stats.count} {stats.count === 1 ? 'shift' : 'shifts'}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-200 font-medium">{formatHours(stats.hours)}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-emerald-400 font-semibold">
                        {isEmployee ? '***' : formatCurrency(stats.cost)}
                      </span>
                      <span className="text-slate-400 w-12 text-right">({pctOfHours.toFixed(1)}%)</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden flex">
                    <div
                      className={'h-full rounded-full transition-all duration-500 ' + (
                        category === 'unclassified'
                          ? 'bg-red-500'
                          : category === 'GForeman'
                          ? 'bg-purple-500'
                          : category === 'Foreman'
                          ? 'bg-blue-500'
                          : category === 'Journeyman'
                          ? 'bg-indigo-500'
                          : category === 'Apprentice'
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Unclassified Rate Exception Panel</span>
              </div>
              {selectedRoleFilter === 'unclassified' ? (
                <button
                  onClick={() => setSelectedRoleFilter('all')}
                  className="text-[10px] font-semibold text-amber-300 hover:text-white bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded cursor-pointer"
                >
                  Clear Filter
                </button>
              ) : (
                <button
                  onClick={() => setSelectedRoleFilter('unclassified')}
                  className="text-[10px] font-semibold text-amber-400 hover:text-amber-200 hover:underline cursor-pointer"
                >
                  Filter Unclassified
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              These rates do not match standard categories or crew assignments. Their actual Connecteam rate is preserved in all calculations.
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {unclassifiedRateDistribution.map((item) => (
                <div
                  key={item.rate}
                  onClick={() => setSelectedRoleFilter('unclassified')}
                  className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl text-xs cursor-pointer transition-colors"
                  title="Click to filter by unclassified entries"
                >
                  <div>
                    <span className="font-bold text-white font-mono">{formatCurrency(item.rate)}/hr</span>
                    <div className="text-slate-400 text-[10px] flex items-center gap-1.5 mt-0.5">
                      <span>{item.employees.size} {item.employees.size === 1 ? 'worker' : 'workers'}</span>
                      <span>·</span>
                      <span>{item.count} {item.count === 1 ? 'shift' : 'shifts'}</span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-slate-300">{formatHours(item.hours)}</div>
                    <div className="text-slate-500 text-[10px]">{isEmployee ? '***' : formatCurrency(item.cost)}</div>
                  </div>
                </div>
              ))}
              {unclassifiedRateDistribution.length === 0 && (
                <div className="p-4 text-center text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-900/40 rounded-xl flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>All shifts matched standard rate categories</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-slate-500">
            Rule: Standard rate tolerance & crew assignments applied.
          </div>
        </div>
      </div>

      {/* Per-Work-Order Labor Rollup Modal */}
      <AnimatePresence>
        {activeWorkOrderRollup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white font-mono">
                      WO #{activeWorkOrderRollup.workOrderNumber}
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-950 text-blue-300 border border-blue-800">
                      {activeWorkOrderRollup.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Crew Leader: {activeWorkOrderRollup.crewLeader} · Area: {activeWorkOrderRollup.area}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedWorkOrderForRollup(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Summary stats */}
              <div className="p-6 grid grid-cols-3 gap-4 bg-slate-950/50 border-b border-slate-800 text-center">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">TOTAL LABOR HOURS</span>
                  <span className="text-base font-bold text-white font-mono">
                    {formatHours(activeWorkOrderRollup.laborHours)}
                  </span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">TOTAL LABOR COST</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {isEmployee ? '***' : formatCurrency(activeWorkOrderRollup.laborCost)}
                  </span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">EST. PROFIT MARGIN</span>
                  <span className={'text-base font-bold font-mono ' + (
                    activeWorkOrderRollup.grossMargin >= 0 ? 'text-blue-400' : 'text-red-400'
                  )}>
                    {isEmployee ? '***' : (activeWorkOrderRollup.marginPct.toFixed(1) + '%')}
                  </span>
                </div>
              </div>

              {/* Shifts list for this WO */}
              <div className="p-6 max-h-60 overflow-y-auto">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Contributing Shift Entries ({activeWorkOrderRollup.entries.length})
                </h4>
                <div className="space-y-2">
                  {activeWorkOrderRollup.entries.map((e, idx) => (
                    <div
                      key={e.id || idx}
                      className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white">{e.employee_name}</span>
                        <span className="text-slate-500 text-[10px] block">
                          {e.shift_date} · <span className={getRoleCategoryBadge(e.role_category)}>{e.role_category}</span>
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-slate-200">{formatHours(e.shift_hours)} @ {formatCurrency(e.hourly_rate)}/hr</div>
                        <div className="text-emerald-400 font-semibold">{formatCurrency(e.line_labor_cost)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setSelectedWorkOrderForRollup(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
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
