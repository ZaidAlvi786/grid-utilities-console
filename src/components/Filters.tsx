import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { setFilters, resetFilters } from '../store/filtersSlice';
import { RotateCcw, ChevronDown } from 'lucide-react';

export const Filters: React.FC = () => {
  const dispatch = useDispatch();
  const filters = useSelector((state: RootState) => state.filters);
  const { workOrders } = useSelector((state: RootState) => state.db);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const gfList = useMemo(() => {
    const sets = new Set(workOrders.map(w => w.general_foreman).filter(Boolean));
    return ['All crews', ...Array.from(sets)];
  }, [workOrders]);

  const foremanList = useMemo(() => {
    if (filters.generalForeman === 'All crews') return [];
    const filteredWH = workOrders.filter(w => w.general_foreman === filters.generalForeman);
    const sets = new Set(filteredWH.map(w => w.foreman).filter(Boolean));
    return Array.from(sets);
  }, [workOrders, filters.generalForeman]);

  const areaList = useMemo(() => {
    const sets = new Set(workOrders.map(w => w.area).filter(Boolean));
    return ['All areas', ...Array.from(sets)];
  }, [workOrders]);

  const handleForemanToggle = (foremanName: string) => {
    let current = [...filters.foreman];
    if (current.includes(foremanName)) {
      current = current.filter(f => f !== foremanName);
    } else {
      current.push(foremanName);
    }
    dispatch(setFilters({ foreman: current }));
  };

  const handleSelectAllForemen = () => {
    if (filters.foreman.length === foremanList.length) {
      dispatch(setFilters({ foreman: [] }));
    } else {
      dispatch(setFilters({ foreman: [...foremanList] }));
    }
  };

  return (
    React.createElement('div', { className: 'flex flex-wrap items-end gap-4 px-8 py-4 bg-slate-50 border-b border-slate-200 text-slate-700 select-none' },
      React.createElement('div', { className: 'flex flex-col gap-1' },
        React.createElement('label', { className: 'text-[10px] font-bold uppercase tracking-wide text-slate-500' }, 'Order Date'),
        React.createElement('div', { className: 'flex items-center gap-2' },
          React.createElement('input', {
            type: 'date',
            value: filters.startDate || '',
            onChange: (e) => dispatch(setFilters({ startDate: e.target.value || null })),
            className: 'px-2 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          }),
          React.createElement('span', { className: 'text-slate-400' }, '–'),
          React.createElement('input', {
            type: 'date',
            value: filters.endDate || '',
            onChange: (e) => dispatch(setFilters({ endDate: e.target.value || null })),
            className: 'px-2 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          })
        )
      ),
      React.createElement('div', { className: 'flex flex-col gap-1' },
        React.createElement('label', { className: 'text-[10px] font-bold uppercase tracking-wide text-slate-500' }, 'General Foreman'),
        React.createElement('select', {
          value: filters.generalForeman,
          onChange: (e) => dispatch(setFilters({ generalForeman: (e.target as HTMLSelectElement).value, foreman: [] })),
          className: 'px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer'
        },
          gfList.map(gf => React.createElement('option', { key: gf, value: gf }, gf))
        )
      ),
      React.createElement('div', { className: 'flex flex-col gap-1 relative w-64', ref: dropdownRef },
        React.createElement('label', { className: 'text-[10px] font-bold uppercase tracking-wide text-slate-500' }, 'Foreman'),
        filters.generalForeman === 'All crews' ? (
          React.createElement('select', {
            disabled: true,
            className: 'px-3 py-1.5 text-sm bg-slate-100 border border-slate-300 rounded-md text-slate-400 cursor-not-allowed w-full'
          },
            React.createElement('option', null, 'Select General Foreman first')
          )
        ) : (
          React.createElement('div', { className: 'w-full' },
            React.createElement('button', {
              type: 'button',
              onClick: () => setIsOpen(!isOpen),
              className: 'w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex justify-between items-center cursor-pointer font-medium text-left'
            },
              filters.foreman.length === 0 ? 'Select Foreman' :
              filters.foreman.length === foremanList.length ? 'All foremen selected' :
              filters.foreman.length + ' foremen selected',
              React.createElement(ChevronDown, { className: 'w-4 h-4 text-slate-400' })
            ),
            isOpen && React.createElement('div', { className: 'absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto p-2 space-y-1' },
              React.createElement('div', {
                onClick: handleSelectAllForemen,
                className: 'flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs font-semibold border-b border-slate-100 pb-2 mb-1'
              },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: filters.foreman.length === foremanList.length && foremanList.length > 0,
                  onChange: () => {},
                  className: 'rounded text-blue-600 focus:ring-blue-500 pointer-events-none'
                }),
                'Select All'
              ),
              foremanList.map(fore =>
                React.createElement('div', {
                  key: fore,
                  onClick: () => handleForemanToggle(fore),
                  className: 'flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs'
                },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: filters.foreman.includes(fore),
                    onChange: () => {},
                    className: 'rounded text-blue-600 focus:ring-blue-500 pointer-events-none'
                  }),
                  fore
                )
              )
            )
          )
        )
      ),
      React.createElement('div', { className: 'flex flex-col gap-1' },
        React.createElement('label', { className: 'text-[10px] font-bold uppercase tracking-wide text-slate-500' }, 'Area'),
        React.createElement('select', {
          value: filters.area,
          onChange: (e) => dispatch(setFilters({ area: (e.target as HTMLSelectElement).value })),
          className: 'px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer'
        },
          areaList.map(a => React.createElement('option', { key: a, value: a }, a))
        )
      ),
      React.createElement('div', { className: 'flex flex-col gap-1' },
        React.createElement('label', { className: 'text-[10px] font-bold uppercase tracking-wide text-slate-500' }, 'Invoice Status'),
        React.createElement('select', {
          value: filters.status,
          onChange: (e) => dispatch(setFilters({ status: (e.target as HTMLSelectElement).value })),
          className: 'px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer'
        },
          React.createElement('option', { value: 'All statuses' }, 'All statuses'),
          React.createElement('option', { value: 'Approved' }, 'Approved'),
          React.createElement('option', { value: 'Unapproved' }, 'Unapproved')
        )
      ),
      React.createElement('button', {
        onClick: () => dispatch(resetFilters()),
        className: 'ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-sm font-semibold border border-slate-300 rounded-md shadow-sm cursor-pointer select-none'
      },
        React.createElement(RotateCcw, { className: 'w-4 h-4' }),
        'Reset'
      )
    )
  );
};
