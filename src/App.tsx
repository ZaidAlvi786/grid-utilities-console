import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from './store/store';
import { fetchDbState } from './store/dbSlice';
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
import { UserSettingsModal } from './components/UserSettingsModal';
import { LoginPage } from './components/LoginPage';
import { motion, AnimatePresence } from 'framer-motion';

export const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { status } = useSelector((state: RootState) => state.db);
  const { isAuthenticated, currentUser } = useSelector((state: RootState) => state.auth);

  const role = currentUser?.role || 'Supervisor';
  const isSupervisor = role === 'Supervisor';
  const isAdmin = role === 'Admin';
  const isEmployee = role === 'Employee';

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchDbState() as any);
    }
  }, [dispatch, isAuthenticated]);

  // If not authenticated, render Login Page
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      <Header
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <Filters />

      <main className="flex-1 flex flex-col gap-6 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
        {/* Loading Indicator */}
        <AnimatePresence>
          {status === 'loading' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl font-mono"
            >
              <div className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Connecting to persistent Supabase cloud database & syncing records...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPIs Row */}
        <Kpis />

        {/* Financial Charts (Role-Dependent) */}
        {isSupervisor && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ApprovedVsUnapprovedChart />
            <ProfitMarginOverTime />
          </div>
        )}

        {isAdmin && (
          <div className="grid grid-cols-1 gap-6">
            <ApprovedVsUnapprovedChart />
          </div>
        )}

        {/* Operational Status Charts (Status Categories by Days + Status Count Percentage Breakdown) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatusDaysChart />
          <StatusPercentage />
        </div>

        {/* Service Requirements & Service Map */}
        {isSupervisor ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ServiceMap />
            <ServiceRequirements />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            <ServiceRequirements />
          </div>
        )}

        {/* Money Aging (Supervisor & Admin only) */}
        {!isEmployee && <MoneyHeldAging />}

        {/* Crew Performance Metrics (Adapts columns per role) */}
        <CrewMetricsTable />
      </main>

      {/* Upload Data Modal */}
      {isUploadOpen && <UploadModal onClose={() => setIsUploadOpen(false)} />}

      {/* User Settings & Team Modal */}
      {isSettingsOpen && <UserSettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
};

export default App;
