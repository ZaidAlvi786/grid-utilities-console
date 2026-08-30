import React, { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { saveOverrideThunk } from '../store/dbSlice';
import { parseExcelDate } from '../utils/helpers';
import { getFilterFingerprint } from '../utils/helpers';
import { Pencil } from 'lucide-react';

export const Kpis: React.FC = () => {
  const dispatch = useDispatch();
  const filters = useSelector((state: RootState) => state.filters);
  const { workOrders, invoices, overrides, dailyExpenseRate } = useSelector((state: RootState) => state.db);

  const fingerprint = useMemo(() => getFilterFingerprint(filters), [filters]);
  const activeOverride = overrides[fingerprint] || { add_amount: 0, remove_amount: 0, profit_margin_override: null };

  const filteredWO = useMemo(() => {
    return workOrders.filter(w => {
      if (filters.generalForeman !== 'All crews' && w.general_foreman !== filters.generalForeman) return false;
      if (filters.foreman.length > 0 && !filters.foreman.includes(w.foreman)) return false;
      if (filters.area !== 'All areas' && w.area !== filters.area) return false;
      // Order date range filters
      if (w.customer_need_date) {
        const dateVal = parseExcelDate(w.customer_need_date);
        if (dateVal) {
          if (filters.startDate && dateVal < filters.startDate) return false;
          if (filters.endDate && dateVal > filters.endDate) return false;
        }
      }
      return true;
    });
  }, [workOrders, filters]);

  const filteredInvoices = useMemo(() => {
    const woNumbers = new Set(filteredWO.map(w => w.work_order_number));
    return invoices.filter(i => {
      if (!woNumbers.has(i.work_order_number || '')) return false;
      if (filters.status !== 'All statuses' && i.status !== filters.status) return false;
      return true;
    });
  }, [invoices, filteredWO, filters.status]);

  const woCount = filteredWO.length;
  const woCompleted = filteredWO.filter(w => w.status === 'Ready to Bill' || w.status === 'CTCC Completed').length;
  const woOpen = woCount - woCompleted;

  const invoicedAmount = filteredInvoices.reduce((sum, i) => sum + i.total, 0);
  const invoiceCount = filteredInvoices.length;
  const avgInvoice = invoiceCount > 0 ? invoicedAmount / invoiceCount : 0;

  const foremanBookedDays = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    filteredInvoices.forEach(inv => {
      const wo = filteredWO.find(w => w.work_order_number === inv.work_order_number);
      if (wo && inv.created_date) {
        const f = wo.foreman;
        if (!map[f]) map[f] = new Set();
        map[f].add(inv.created_date);
      }
    });
    let totalDays = 0;
    Object.values(map).forEach(set => { totalDays += set.size; });
    return totalDays;
  }, [filteredInvoices, filteredWO]);

  const baseExpense = foremanBookedDays * dailyExpenseRate;
  const totalExpense = baseExpense + activeOverride.add_amount - activeOverride.remove_amount;
  const computedMargin = invoicedAmount - totalExpense;
  const profitMargin = activeOverride.profit_margin_override !== null ? activeOverride.profit_margin_override : computedMargin;
  const profitMarginPct = invoicedAmount > 0 ? (profitMargin / invoicedAmount) * 100 : 0;

  const [addExpense, setAddExpense] = useState('');
  const [removeExpense, setRemoveExpense] = useState('');
  const [marginOverride, setMarginOverride] = useState('');
  const [showMarginInput, setShowMarginInput] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    setAddExpense(activeOverride.add_amount > 0 ? activeOverride.add_amount.toString() : '');
    setRemoveExpense(activeOverride.remove_amount > 0 ? activeOverride.remove_amount.toString() : '');
    setMarginOverride(activeOverride.profit_margin_override !== null ? activeOverride.profit_margin_override.toString() : '');
  }, [activeOverride]);

  const handleSaveOverrides = (updates: any) => {
    setSaveState('saving');
    const newOverride = {
      filter_fingerprint: fingerprint,
      add_amount: updates.add_amount !== undefined ? updates.add_amount : activeOverride.add_amount,
      remove_amount: updates.remove_amount !== undefined ? updates.remove_amount : activeOverride.remove_amount,
      profit_margin_override: updates.profit_margin_override !== undefined ? updates.profit_margin_override : activeOverride.profit_margin_override,
    };
    setTimeout(async () => {
      await dispatch(saveOverrideThunk(newOverride) as any);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1000);
    }, 200);
  };

  const formatCurrency = (num: number) => {
    return '$' + Math.round(num).toLocaleString();
  };

  return (
    React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6 select-none' },
      /* Work Orders card - commented out
      React.createElement('div', { className: 'bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all' },
        React.createElement('p', { className: 'text-xs font-bold tracking-wide text-slate-400 uppercase' }, 'Work Orders'),
        React.createElement('h1', { className: 'text-3xl font-extrabold text-slate-900 my-2' }, woCount),
        React.createElement('p', { className: 'text-xs text-slate-500' },
          React.createElement('span', { className: 'font-semibold text-blue-600' }, woCompleted + ' complete'),
          ' · 0 scheduled · ',
          React.createElement('span', { className: 'font-semibold text-slate-600' }, woOpen + ' open')
        ),
        React.createElement('div', { className: 'w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden' },
          React.createElement('div', { className: 'bg-blue-600 h-full', style: { width: (woCount > 0 ? (woCompleted / woCount) * 100 : 0) + '%' } })
        )
      ),
      */
      React.createElement('div', { className: 'bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all' },
        React.createElement('p', { className: 'text-xs font-bold tracking-wide text-slate-400 uppercase' }, 'Invoiced Amount'),
        React.createElement('h1', { className: 'text-3xl font-extrabold text-slate-900 my-2' }, formatCurrency(invoicedAmount)),
        React.createElement('p', { className: 'text-xs text-slate-500' },
          React.createElement('span', { className: 'font-semibold text-slate-700' }, invoiceCount + (invoiceCount === 1 ? ' invoice' : ' invoices')),
          ' · avg ' + formatCurrency(avgInvoice)
        ),
        React.createElement('div', { className: 'w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden' },
          React.createElement('div', { className: 'bg-blue-600 h-full', style: { width: '100%' } })
        )
      ),
      React.createElement('div', { className: 'bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all' },
        React.createElement('p', { className: 'text-xs font-bold tracking-wide text-slate-400 uppercase' }, 'Total Expense'),
        React.createElement('h1', { className: 'text-3xl font-extrabold text-slate-900 my-2' }, formatCurrency(totalExpense)),
        React.createElement('p', { className: 'text-[11px] text-slate-400 font-mono mt-1' },
          'base ' + formatCurrency(baseExpense) + ' · ' + foremanBookedDays + ' foreman-days x $5,800'
        ),
        React.createElement('div', { className: 'grid grid-cols-2 gap-2 mt-3' },
          React.createElement('div', null,
            React.createElement('label', { className: 'text-[9px] text-slate-400 uppercase' }, 'Add Expense Amount'),
            React.createElement('input', {
              type: 'text',
              value: addExpense,
              placeholder: '0',
              onChange: (e) => {
                const val = e.target.value;
                if (/^\d*\.?\d*$/.test(val)) {
                  setAddExpense(val);
                }
              },
              onBlur: () => handleSaveOverrides({ add_amount: parseFloat(addExpense || '0') }),
              className: 'w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:bg-white'
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: 'text-[9px] text-slate-400 uppercase' }, 'Remove Expense Amount'),
            React.createElement('input', {
              type: 'text',
              value: removeExpense,
              placeholder: '0',
              onChange: (e) => {
                const val = e.target.value;
                if (/^\d*\.?\d*$/.test(val)) {
                  setRemoveExpense(val);
                }
              },
              onBlur: () => handleSaveOverrides({ remove_amount: parseFloat(removeExpense || '0') }),
              className: 'w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:bg-white'
            })
          )
        ),
        React.createElement('div', { className: 'flex items-center justify-between mt-2 text-[9px] font-mono text-slate-400' },
          React.createElement('span', null, formatCurrency(baseExpense) + ' + ' + (activeOverride.add_amount ? '$' + activeOverride.add_amount : '') + ' - ' + (activeOverride.remove_amount ? '$' + activeOverride.remove_amount : '') + ' = ' + formatCurrency(totalExpense)),
          saveState === 'saving' ? React.createElement('span', { className: 'text-blue-500 animate-pulse' }, 'Saving...') : saveState === 'saved' ? React.createElement('span', { className: 'text-green-600' }, 'Saved') : null
        )
      ),
      React.createElement('div', { className: 'bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all relative group' },
        React.createElement('p', { className: 'text-xs font-bold tracking-wide text-slate-400 uppercase' }, 'Profit Margin'),
        React.createElement('div', { className: 'flex items-center gap-2 my-2' },
          showMarginInput ? React.createElement('input', {
            type: 'number',
            value: marginOverride,
            placeholder: 'Computed margin',
            onChange: (e) => setMarginOverride(e.target.value),
            onBlur: () => {
              setShowMarginInput(false);
              handleSaveOverrides({ profit_margin_override: marginOverride === '' ? null : parseFloat(marginOverride) });
            },
            autoFocus: true,
            className: 'text-xl font-extrabold text-slate-800 bg-slate-50 border border-slate-300 rounded px-2 py-0.5 w-36 focus:outline-none'
          }) : React.createElement('h1', { className: 'text-3xl font-extrabold text-slate-900 flex items-center gap-1.5' },
            formatCurrency(profitMargin),
            React.createElement(Pencil, {
              onClick: () => setShowMarginInput(true),
              className: 'w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-blue-600'
            })
          )
        ),
        React.createElement('p', { className: 'text-xs text-slate-500' },
          React.createElement('span', { className: 'font-semibold text-slate-700' }, Math.round(profitMarginPct) + '%'),
          ' of invoiced amount kept'
        ),
        React.createElement('div', { className: 'w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden' },
          React.createElement('div', { className: 'bg-emerald-600 h-full', style: { width: Math.max(0, Math.min(100, profitMarginPct)) + '%' } })
        ),
        React.createElement('div', { className: 'text-[9px] font-mono text-slate-400 mt-4' },
          formatCurrency(invoicedAmount) + ' - ' + formatCurrency(totalExpense) + ' = ' + formatCurrency(computedMargin),
          activeOverride.profit_margin_override !== null && React.createElement('span', { className: 'text-amber-600 font-semibold' }, ' (Overridden)')
        )
      )
    )
  );
};
