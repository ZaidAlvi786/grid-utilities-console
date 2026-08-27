import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Filters } from './components/Filters';
import { Kpis } from './components/Kpis';
import { StatusDaysChart } from './components/StatusDaysChart';
import { StatusPercentage } from './components/StatusPercentage';
import { ServiceRequirements } from './components/ServiceRequirements';
import { ApprovedVsUnapprovedChart } from './components/ApprovedVsUnapprovedChart';
import { ProfitMarginOverTime } from './components/ProfitMarginOverTime';
import { MoneyHeldAging } from './components/MoneyHeldAging';
import { ServiceMap } from './components/ServiceMap';
import { CrewMetricsTable } from './components/CrewMetricsTable';
import { UploadModal } from './components/UploadModal';
import { fetchDbState } from './store/dbSlice';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from './store/store';

export const App: React.FC = () => {
  const dispatch = useDispatch();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const { status } = useSelector((state: RootState) => state.db);

  useEffect(() => {
    dispatch(fetchDbState() as any);
  }, [dispatch]);

  return (
    React.createElement('div', { className: 'min-h-screen bg-slate-100 flex flex-col font-sans' },
      React.createElement(Header, { onOpenUpload: () => setIsUploadOpen(true) }),
      React.createElement(Filters, null),
      React.createElement('main', { className: 'flex-1 flex flex-col gap-6 p-6' },
        status === 'loading' && React.createElement('div', { className: 'text-xs text-blue-600 font-mono animate-pulse px-2' }, 'Connecting to persistent cloud database...'),
        React.createElement(Kpis, null),
        
        React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-6' },
          React.createElement(StatusDaysChart, null),
          React.createElement(StatusPercentage, null)
        ),
        
        React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-6' },
          React.createElement(ServiceMap, null),
          React.createElement(ServiceRequirements, null)
        ),

        React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-6' },
          React.createElement(ApprovedVsUnapprovedChart, null),
          React.createElement(ProfitMarginOverTime, null)
        ),
        
        React.createElement(MoneyHeldAging, null),
        React.createElement(CrewMetricsTable, null)
      ),
      isUploadOpen && React.createElement(UploadModal, { onClose: () => setIsUploadOpen(false) })
    )
  );
};
export default App;
