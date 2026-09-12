import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { LaborEntry } from '../types/schemas';
import { formatCurrency, formatHours } from '../utils/helpers';
import {
  Users,
  Clock,
  DollarSign,
  AlertTriangle,
  Search,
  Layers,
  ArrowUpDown,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const TimesheetTab: React.FC = () => {
  const { laborEntries, laborRateCategories, workOrders, invoices } = useSelector((state: RootState) => state.db);
  const { currentUser } = useSelector((state: RootState) => state.auth);

  const isEmployee = currentUser?.role === 'Employee';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof LaborEntry>('shift_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedWorkOrderForRollup, setSelectedWorkOrderForRollup] = useState<string | null>(null);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return laborEntries.filter((entry) => {
      const matchesSearch =
        entry.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.work_order_number || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole =
        selectedRoleFilter === 'all'
          ? true
          : selectedRoleFilter === 'unclassified'
          ? entry.role_category === 'unclassified'
          : entry.role_category.toLowerCase() === selectedRoleFilter.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [laborEntries, searchQuery, selectedRoleFilter]);

  // Sorted entries
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      let aVal = a[sortField] ?? '';
      let bVal = b[sortField] ?? '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEntries, sortField, sortOrder]);

  // Overall KPIs
  const totalHours = useMemo(() => laborEntries.reduce((sum, e) => sum + e.shift_hours, 0), [laborEntries]);
  const totalLaborCost = useMemo(() => laborEntries.reduce((sum, e) => sum + e.line_labor_cost, 0), [laborEntries]);
  const uniqueHeadcount = useMemo(() => new Set(laborEntries.map((e) => e.employee_name)).size, [laborEntries]);

  // Role Breakdown
  const roleBreakdown = useMemo(() => {
    const map: Record<string, { count: number; hours: number; cost: number }> = {
      GForeman: { count: 0, hours: 0, cost: 0 },
      Foreman: { count: 0, hours: 0, cost: 0 },
      Journeyman: { count: 0, hours: 0, cost: 0 },
      Apprentice: { count: 0, hours: 0, cost: 0 },
      Groundman: { count: 0, hours: 0, cost: 0 },
      unclassified: { count: 0, hours: 0, cost: 0 }
    };

    laborEntries.forEach((entry) => {
      const cat = entry.role_category || 'unclassified';
      if (!map[cat]) {
        map[cat] = { count: 0, hours: 0, cost: 0 };
      }
      map[cat].count += 1;
      map[cat].hours += entry.shift_hours;
      map[cat].cost += entry.line_labor_cost;
    });

    return map;
  }, [laborEntries]);

  // Unclassified Rates Summary
  const unclassifiedEntries = useMemo(
    () => laborEntries.filter((e) => e.role_category === 'unclassified'),
    [laborEntries]
  );
  const unclassifiedCount = unclassifiedEntries.length;
  const unclassifiedHours = unclassifiedEntries.reduce((sum, e) => sum + e.shift_hours, 0);

  const unclassifiedRateDistribution = useMemo(() => {
    const dist: Record<number, { count: number; hours: number; cost: number }> = {};
    unclassifiedEntries.forEach((e) => {
      if (!dist[e.hourly_rate]) {
        dist[e.hourly_rate] = { count: 0, hours: 0, cost: 0 };
      }
      dist[e.hourly_rate].count += 1;
      dist[e.hourly_rate].hours += e.shift_hours;
      dist[e.hourly_rate].cost += e.line_labor_cost;
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
      status: wo?.status || 'Unknown',
      crewLeader: wo?.foreman || 'N/A',
      generalForeman: wo?.general_foreman || 'N/A',
      area: wo?.area || 'N/A',
      address: wo?.address || 'N/A',
      invoiceTotal,
      laborCost: woCost,
      laborHours: woHours,
      grossMargin,
      marginPct,
      entries: woEntries
    };
  }, [selectedWorkOrderForRollup, laborEntries, workOrders, invoices]);

  const handleSort = (field: keyof LaborEntry) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
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
                Role classification with ±$0.10 tolerance. Connecteam shift hourly rate is the source of truth for total costs.
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

      {/* Role Breakdown Bar & Unclassified Alert Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role Distribution Card */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Role Category Breakdown
            </h3>
            <span className="text-xs text-slate-400 font-mono">5 Rates + Unclassified</span>
          </div>

          <div className="space-y-3.5">
            {Object.entries(roleBreakdown).map(([category, stats]) => {
              const pctOfHours = totalHours > 0 ? (stats.hours / totalHours) * 100 : 0;
              const refCat = laborRateCategories.find((c) => c.category_name.toLowerCase() === category.toLowerCase());
              const standardRate = refCat ? ('$' + refCat.standard_rate.toFixed(2) + '/hr') : 'Variable / Custom';

              return (
                <div key={category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={'px-2 py-0.5 rounded text-[10px] uppercase font-bold border ' + getRoleCategoryBadge(category)}>
                        {category}
                      </span>
                      <span className="text-slate-400 text-[11px]">({standardRate})</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-slate-300">{formatHours(stats.hours)}</span>
                      <span className="text-slate-500">|</span>
                      <span className="text-emerald-400 font-medium">
                        {isEmployee ? '***' : formatCurrency(stats.cost)}
                      </span>
                      <span className="text-slate-400 w-10 text-right">{pctOfHours.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
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
                      style={{ width: pctOfHours + '%' }}
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
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-3">
              <AlertTriangle className="w-4 h-4" />
              <span>Unclassified Rate Exception Panel</span>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              These rates do not match the 5 standard categories ($55.70, $54.70, $51.16, $38.37, $25.66). Their actual Connecteam rate is preserved in all total calculations.
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {unclassifiedRateDistribution.map((item) => (
                <div
                  key={item.rate}
                  className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs"
                >
                  <div>
                    <span className="font-bold text-white font-mono">{formatCurrency(item.rate)}/hr</span>
                    <span className="text-slate-400 text-[10px] block">{item.count} shift entries</span>
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
            Rule: ±$0.10 tolerance applied ($38.31 maps to Apprentice).
          </div>
        </div>
      </div>

      {/* Filter and Shift Log Table */}
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

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="text-xs text-slate-400">Role Filter:</label>
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Roles & Categories</option>
              <option value="GForeman">GForeman ($55.70)</option>
              <option value="Foreman">Foreman ($54.70)</option>
              <option value="Journeyman">Journeyman ($51.16)</option>
              <option value="Apprentice">Apprentice ($38.37)</option>
              <option value="Groundman">Groundman ($25.66)</option>
              <option value="unclassified">Unclassified Only</option>
            </select>
          </div>
        </div>

        {/* Shift Entries Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th
                  className="px-5 py-3.5 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('shift_date')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Shift Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-5 py-3.5 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('employee_name')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-5 py-3.5 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('work_order_number')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Work Order</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-5 py-3.5">Role Category</th>
                <th
                  className="px-5 py-3.5 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('shift_hours')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Hours</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-5 py-3.5 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('hourly_rate')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Hourly Rate</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-5 py-3.5 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('line_labor_cost')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Labor Cost</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-5 py-3.5 text-center">WO Rollup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedEntries.slice(0, 100).map((entry) => (
                <tr key={entry.id || (entry.work_order_number + '-' + entry.shift_date + '-' + entry.employee_name)} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3 font-mono text-slate-400">{entry.shift_date}</td>
                  <td className="px-5 py-3 font-medium text-white">{entry.employee_name}</td>
                  <td className="px-5 py-3 font-mono font-medium text-blue-400">
                    {entry.work_order_number || <span className="text-slate-500 italic">Unassigned</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={'px-2 py-0.5 rounded text-[10px] uppercase font-bold border ' + getRoleCategoryBadge(entry.role_category)}>
                      {entry.role_category}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-medium text-slate-200">
                    {formatHours(entry.shift_hours)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-slate-400">
                    {isEmployee ? '***' : formatCurrency(entry.hourly_rate)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-emerald-400">
                    {isEmployee ? '***' : formatCurrency(entry.line_labor_cost)}
                  </td>
                  <td className="px-5 py-3 text-center">
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
              ))}
              {sortedEntries.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                    No timesheet entries matched your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-500 flex justify-between items-center">
          <span>Showing {Math.min(100, sortedEntries.length)} of {sortedEntries.length} entries</span>
          <span>Connecteam Timesheet Sync Active</span>
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
