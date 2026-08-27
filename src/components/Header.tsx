import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { LayoutGrid, UploadCloud } from 'lucide-react';

interface HeaderProps {
  onOpenUpload: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenUpload }) => {
  const { workOrders, invoices } = useSelector((state: RootState) => state.db);
  const formattedDate = '18 Aug 2026';

  return (
    React.createElement('header', { className: 'flex flex-col md:flex-row justify-between items-start md:items-center py-6 px-8 bg-slate-900 border-b border-slate-800 text-white select-none' },
      React.createElement('div', { className: 'flex items-center gap-3' },
        React.createElement('div', { className: 'bg-blue-600 p-2.5 rounded-lg shadow-lg shadow-blue-500/20' },
          React.createElement(LayoutGrid, { className: 'w-6 h-6 text-white' })
        ),
        React.createElement('div', null,
          React.createElement('h1', { className: 'text-xl md:text-2xl font-bold tracking-tight text-white my-0' }, 'Grid Utilities Performance Console'),
          React.createElement('p', { className: 'text-xs md:text-sm text-slate-400 mt-1 font-mono' },
            workOrders.length + ' work orders · ' + invoices.length + ' invoices · as of ' + formattedDate
          )
        )
      ),
      React.createElement('button', {
        onClick: onOpenUpload,
        className: 'mt-4 md:mt-0 flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-200 cursor-pointer select-none'
      },
        React.createElement(UploadCloud, { className: 'w-4 h-4' }),
        'Upload Console Data'
      )
    )
  );
};
