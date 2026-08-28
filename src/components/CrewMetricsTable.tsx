import React, { useMemo, useState } from 'react';
import { parseExcelDate } from '../utils/helpers';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { setFilters } from '../store/filtersSlice';

export const CrewMetricsTable: React.FC = () => {
  const dispatch = useDispatch();
  const filters = useSelector((state: RootState) => state.filters);
  const { workOrders, invoices, dailyExpenseRate } = useSelector((state: RootState) => state.db);

  const [viewMode, setViewMode] = useState<'General Foreman' | 'Foreman'>('Foreman');

  const metrics = useMemo(() => {
    const GFData: Record<string, { name: string; type: 'GF'; wos: number; complete: number; days: number; revenue: number; expense: number; margin: number; cycle: number; onTime: number; discipline: number; expired: number; doneVal: number; realization: number; renbill: number; unbilled: number; kmJob: number; prereqs: number; areas: number }> = {};
    const FData: Record<string, { name: string; gf: string; type: 'Foreman'; wos: number; complete: number; days: number; revenue: number; expense: number; margin: number; cycle: number; onTime: number; discipline: number; expired: number; doneVal: number; realization: number; renbill: number; unbilled: number; kmJob: number; prereqs: number; areas: number }> = {};

    const bookedDatesMap: Record<string, Set<string>> = {};
    const revenueMap: Record<string, number> = {};
    
    invoices.forEach(inv => {
      if (filters.status !== 'All statuses' && inv.status !== filters.status) return;
      const wo = workOrders.find(w => w.work_order_number === inv.work_order_number);
      if (wo) {
        const f = wo.foreman;
        if (!bookedDatesMap[f]) bookedDatesMap[f] = new Set();
        if (inv.created_date) {
          bookedDatesMap[f].add(inv.created_date);
        }
        if (!revenueMap[f]) revenueMap[f] = 0;
        revenueMap[f] += inv.total;
      }
    });

    workOrders.forEach(wo => {
      // Order date range filters
      if (wo.customer_need_date) {
        const dateVal = parseExcelDate(wo.customer_need_date);
        if (dateVal) {
          if (filters.startDate && dateVal < filters.startDate) return;
          if (filters.endDate && dateVal > filters.endDate) return;
        }
      }
      const gf = wo.general_foreman;
      const f = wo.foreman;

      if (!GFData[gf]) {
        GFData[gf] = { name: gf, type: 'GF', wos: 0, complete: 0, days: 0, revenue: 0, expense: 0, margin: 0, cycle: 28, onTime: 33, discipline: 78, expired: 12, doneVal: 18000, realization: 74, renbill: 8, unbilled: 0, kmJob: 9.2, prereqs: 3.2, areas: 4 };
      }
      if (!FData[f]) {
        FData[f] = { name: f, gf, type: 'Foreman', wos: 0, complete: 0, days: 0, revenue: 0, expense: 0, margin: 0, cycle: 31, onTime: 28, discipline: 82, expired: 15, doneVal: 17000, realization: 76, renbill: 10, unbilled: 0, kmJob: 8.8, prereqs: 3.1, areas: 3 };
      }

      const gfNode = GFData[gf];
      const fNode = FData[f];

      gfNode.wos++;
      fNode.wos++;

      if (wo.status === 'Ready to Bill' || wo.status === 'CTCC Completed') {
        gfNode.complete++;
        fNode.complete++;
      }
    });

    Object.keys(FData).forEach(f => {
      const node = FData[f];
      const bookedDays = bookedDatesMap[f] ? bookedDatesMap[f].size : 0;
      const rev = revenueMap[f] || 0;
      const exp = bookedDays * dailyExpenseRate;

      node.days = bookedDays;
      node.revenue = rev;
      node.expense = exp;
      node.margin = rev - exp;

      const gfNode = GFData[node.gf];
      if (gfNode) {
        gfNode.days += bookedDays;
        gfNode.revenue += rev;
        gfNode.expense += exp;
        gfNode.margin += (rev - exp);
      }
    });

    return {
      gfs: Object.values(GFData),
      foremen: Object.values(FData),
    };
  }, [workOrders, invoices, dailyExpenseRate, filters]);

  const currentRows = viewMode === 'General Foreman' ? metrics.gfs : metrics.foremen;

  const handleRowClick = (row: any) => {
    if (row.type === 'GF') {
      dispatch(setFilters({ generalForeman: row.name, foreman: [] }));
    } else {
      dispatch(setFilters({ generalForeman: row.gf, foreman: [row.name] }));
    }
  };

  const formatCurrency = (val: number) => {
    if (val === 0) return '-';
    return '$' + Math.round(val / 1000) + 'k';
  };

  return (
    React.createElement('div', { className: 'bg-white p-6 rounded-xl shadow-sm border border-slate-200 select-none overflow-x-auto' },
      React.createElement('div', { className: 'flex justify-between items-center mb-6' },
        React.createElement('div', null,
          React.createElement('h2', { className: 'text-lg font-semibold text-slate-800 my-0' }, 'Crew Performance Metrics'),
          React.createElement('p', { className: 'text-xs text-slate-500 mt-1' }, 'Click a row to filter dashboard to that crew. Money runs on booked days model (,800/day).')
        ),
        React.createElement('div', { className: 'flex bg-slate-100 p-0.5 rounded-lg border border-slate-200' },
          React.createElement('button', {
            onClick: () => setViewMode('General Foreman'),
            className: 'px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ' +
              (viewMode === 'General Foreman' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800')
          }, 'General Foreman'),
          React.createElement('button', {
            onClick: () => setViewMode('Foreman'),
            className: 'px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ' +
              (viewMode === 'Foreman' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800')
          }, 'Foreman')
        )
      ),
      React.createElement('table', { className: 'w-full border-collapse text-left text-xs text-slate-600 min-w-[1000px]' },
        React.createElement('thead', { className: 'bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]' },
          React.createElement('tr', null,
            React.createElement('th', { className: 'py-3 px-4 font-semibold' }, viewMode === 'General Foreman' ? 'General Foreman' : 'Foreman'),
            React.createElement('th', { className: 'py-3 px-4 font-semibold text-right' }, 'WOs'),
            React.createElement('th', { className: 'py-3 px-4 font-semibold text-right' }, 'Complete %'),
            React.createElement('th', { className: 'py-3 px-4 font-semibold text-right' }, 'Booked Days'),
            React.createElement('th', { className: 'py-3 px-4 font-semibold text-right' }, 'Hours Worked'),
            React.createElement('th', { className: 'py-3 px-4 font-semibold text-right' }, 'Revenue'),
            React.createElement('th', { className: 'py-3 px-4 font-semibold text-right' }, 'Expense'),
            React.createElement('th', { className: 'py-3 px-4 font-semibold text-right' }, 'Margin')
          )
        ),
        React.createElement('tbody', null,
          currentRows.map(row =>
            React.createElement('tr', {
              key: row.name,
              onClick: () => handleRowClick(row),
              className: 'border-b border-slate-100 hover:bg-slate-50 transition-colors duration-150 cursor-pointer'
            },
              React.createElement('td', { className: 'py-3 px-4 font-bold text-slate-800' }, row.name),
              React.createElement('td', { className: 'py-3 px-4 text-right font-mono' }, row.wos),
              React.createElement('td', { className: 'py-3 px-4 text-right font-mono text-blue-600 font-semibold' }, Math.round((row.complete / (row.wos || 1)) * 100) + '%'),
              React.createElement('td', { className: 'py-3 px-4 text-right font-mono' }, row.days || '-'),
              React.createElement('td', { className: 'py-3 px-4 text-right font-mono' }, row.days ? (row.days * 8) + ' hrs' : '-'),
              React.createElement('td', { className: 'py-3 px-4 text-right font-mono' }, formatCurrency(row.revenue)),
              React.createElement('td', { className: 'py-3 px-4 text-right font-mono text-red-600' }, formatCurrency(row.expense)),
              React.createElement('td', { className: 'py-3 px-4 text-right font-mono font-bold ' + (row.margin >= 0 ? 'text-green-600' : 'text-red-600') }, formatCurrency(row.margin))
            )
          )
        )
      )
    )
  );
};
