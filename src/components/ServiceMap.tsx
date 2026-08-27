import React, { useMemo } from 'react';
import { parseExcelDate } from '../utils/helpers';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

export const ServiceMap: React.FC = () => {
  const filters = useSelector((state: RootState) => state.filters);
  const { workOrders, invoices } = useSelector((state: RootState) => state.db);

  const filteredSites = useMemo(() => {
    const woNumbers = new Set(workOrders.filter(w => {
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
    }).map(w => w.work_order_number));

    return workOrders.filter(w => woNumbers.has(w.work_order_number)).map(w => {
      const associatedInvoices = invoices.filter(i => i.work_order_number === w.work_order_number);
      let status: 'Approved' | 'Unapproved' | 'Not yet invoiced' = 'Not yet invoiced';
      
      if (associatedInvoices.length > 0) {
        const approved = associatedInvoices.filter(i => i.status === 'Approved');
        const unapproved = associatedInvoices.filter(i => i.status === 'Unapproved');
        
        if (unapproved.length > 0) {
          status = 'Unapproved';
        } else if (approved.length > 0) {
          status = 'Approved';
        }
      }

      return {
        ...w,
        invoiceStatus: status,
      };
    });
  }, [workOrders, invoices, filters]);

  const boundaries = useMemo(() => {
    let minLat = 29.6;
    let maxLat = 30.2;
    let minLng = -95.9;
    let maxLng = -95.1;
    
    const validPoints = filteredSites.filter(s => s.latitude && s.longitude);
    if (validPoints.length > 0) {
      minLat = Math.min(...validPoints.map(p => p.latitude!));
      maxLat = Math.max(...validPoints.map(p => p.latitude!));
      minLng = Math.min(...validPoints.map(p => p.longitude!));
      maxLng = Math.max(...validPoints.map(p => p.longitude!));
    }
    return {
      minLat: minLat - 0.05,
      maxLat: maxLat + 0.05,
      minLng: minLng - 0.05,
      maxLng: maxLng + 0.05,
    };
  }, [filteredSites]);

  const projectX = (lng: number) => {
    return ((lng - boundaries.minLng) / (boundaries.maxLng - boundaries.minLng)) * 500 + 50;
  };
  const projectY = (lat: number) => {
    return (1 - (lat - boundaries.minLat) / (boundaries.maxLat - boundaries.minLat)) * 320 + 40;
  };

  const areaLabels = [
    { name: 'TOMBALL', lat: 30.1, lng: -95.62 },
    { name: 'SPRING', lat: 30.08, lng: -95.42 },
    { name: 'CYPRESS', lat: 29.98, lng: -95.69 },
    { name: 'KATY', lat: 29.79, lng: -95.8 },
    { name: 'BEAR CREEK', lat: 29.87, lng: -95.63 },
    { name: 'SPRING BRANCH', lat: 29.8, lng: -95.49 },
  ];

  const unapprovedCount = filteredSites.filter(s => s.invoiceStatus === 'Unapproved').length;

  return (
    React.createElement('div', { className: 'bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[450px] relative select-none' },
      React.createElement('div', { className: 'flex justify-between items-start mb-2' },
        React.createElement('h2', { className: 'text-lg font-semibold text-slate-800 my-0' }, 'Area of Service'),
        React.createElement('span', { className: 'text-xs text-slate-400 font-mono mt-1' }, filteredSites.length + ' sites · 6 of 6 areas · ' + unapprovedCount + ' unapproved')
      ),
      React.createElement('p', { className: 'text-xs text-slate-500 mb-4' }, 'Every work order plotted at its service address, coloured by invoice status. No street basemap - area labels and the scale bar carry the geography.'),
      React.createElement('div', { className: 'flex gap-4 text-xs font-medium text-slate-600 mb-4' },
        React.createElement('span', { className: 'flex items-center gap-1.5' },
          React.createElement('span', { className: 'w-3 h-3 rounded-full bg-blue-600' }), 'Approved'
        ),
        React.createElement('span', { className: 'flex items-center gap-1.5' },
          React.createElement('span', { className: 'w-3 h-3 rounded-full bg-red-600' }), 'Unapproved'
        ),
        React.createElement('span', { className: 'flex items-center gap-1.5' },
          React.createElement('span', { className: 'w-3 h-3 rounded-full bg-slate-300' }), 'Not yet invoiced'
        )
      ),
      React.createElement('div', { className: 'relative bg-slate-50 border border-slate-100 rounded-lg overflow-hidden' },
        React.createElement('svg', { viewBox: '0 0 600 400', className: 'w-full h-[360px]' },
          areaLabels.map(label =>
             React.createElement('text', {
               key: label.name,
               x: projectX(label.lng),
               y: projectY(label.lat),
               textAnchor: 'middle',
               className: 'fill-slate-400 font-bold font-mono tracking-widest text-[9px]'
             }, label.name)
          ),
          filteredSites.filter(s => s.latitude && s.longitude).map(site =>
            React.createElement('circle', {
              key: site.id,
              cx: projectX(site.longitude!),
              cy: projectY(site.latitude!),
              r: 3.5,
              className: 'cursor-pointer transition-all duration-150 ' +
                (site.invoiceStatus === 'Approved' ? 'fill-blue-600' :
                 site.invoiceStatus === 'Unapproved' ? 'fill-red-600' : 'fill-slate-300') +
                ' hover:stroke-white hover:stroke-2'
            })
          ),
          React.createElement('g', { transform: 'translate(40, 340)' },
            React.createElement('line', { x1: 0, y1: 0, x2: 60, y2: 0, stroke: '#94a3b8', strokeWidth: 1.5 }),
            React.createElement('line', { x1: 0, y1: -3, x2: 0, y2: 3, stroke: '#94a3b8', strokeWidth: 1.5 }),
            React.createElement('line', { x1: 60, y1: -3, x2: 60, y2: 3, stroke: '#94a3b8', strokeWidth: 1.5 }),
            React.createElement('text', { x: 70, y: 3, className: 'fill-slate-400 font-mono text-[9px]' }, '5 km')
          )
        )
      )
    )
  );
};
