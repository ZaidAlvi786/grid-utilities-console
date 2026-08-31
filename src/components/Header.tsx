import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { logout, setRolePreview, UserRole } from '../store/authSlice';
import { LayoutGrid, UploadCloud, Settings, LogOut, ChevronDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HeaderProps {
  onOpenUpload: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenUpload, onOpenSettings }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { workOrders, invoices } = useSelector((state: RootState) => state.db);
  const { currentUser } = useSelector((state: RootState) => state.auth);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formattedDate = '18 Aug 2026';
  const role = currentUser?.role || 'Supervisor';
  const isEmployee = role === 'Employee';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleSwitch = (newRole: UserRole) => {
    dispatch(setRolePreview(newRole));
    setDropdownOpen(false);
  };

  const handleLogout = () => {
    dispatch(logout());
    setDropdownOpen(false);
  };

  const getRoleBadgeClasses = (userRole: UserRole) => {
    switch (userRole) {
      case 'Supervisor':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Admin':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Employee':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center py-5 px-6 sm:px-8 bg-slate-900 border-b border-slate-800 text-white select-none relative z-40">
      {/* Brand & Stats */}
      <div className="flex items-center gap-3.5">
        <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
          <LayoutGrid className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white my-0">
              Grid Utilities Console
            </h1>
            <span
              className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider border ${getRoleBadgeClasses(
                role
              )}`}
            >
              {role}
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5 font-mono">
            {isEmployee
              ? `${workOrders.length} active work orders · as of ${formattedDate}`
              : `${workOrders.length} work orders · ${invoices.length} invoices · as of ${formattedDate}`}
          </p>
        </div>
      </div>

      {/* Action Buttons & User Menu */}
      <div className="mt-4 md:mt-0 flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
        {/* Upload Console Data button - hidden for basic employee if desired or available for field admins */}
        {!isEmployee && (
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-850 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 shadow-sm transition-all duration-200 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Upload Console Data</span>
            <span className="sm:hidden">Upload</span>
          </button>
        )}

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 pl-2.5 pr-2 bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {currentUser?.name?.slice(0, 2).toUpperCase() || 'GU'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-white leading-tight">
                {currentUser?.name || 'Supervisor'}
              </div>
              <div className="text-[10px] text-slate-400 leading-tight">
                {role}
              </div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 py-2 z-50 text-slate-200"
              >
                {/* User Info Header */}
                <div className="px-4 py-2.5 border-b border-slate-800/80">
                  <p className="text-xs font-bold text-white truncate">{currentUser?.name}</p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">{currentUser?.email}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider border ${getRoleBadgeClasses(
                        role
                      )}`}
                    >
                      {role} Access
                    </span>
                  </div>
                </div>

                {/* User Settings Option */}
                <div className="p-1 border-b border-slate-800/80">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer text-left"
                  >
                    <Settings className="w-4 h-4 text-blue-400" />
                    <span>User Settings & Team</span>
                  </button>
                </div>

                {/* Quick Role Preview Switcher for Testing */}
                <div className="p-2 border-b border-slate-800/80">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    <span>Test Role Persona</span>
                  </p>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => handleRoleSwitch('Supervisor')}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                        role === 'Supervisor'
                          ? 'bg-purple-950/60 text-purple-300 font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      <span>Supervisor (Full)</span>
                      {role === 'Supervisor' && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                    </button>
                    <button
                      onClick={() => handleRoleSwitch('Admin')}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                        role === 'Admin'
                          ? 'bg-blue-950/60 text-blue-300 font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      <span>Admin (No Margin)</span>
                      {role === 'Admin' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                    </button>
                    <button
                      onClick={() => handleRoleSwitch('Employee')}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                        role === 'Employee'
                          ? 'bg-emerald-950/60 text-emerald-300 font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      <span>Employee (No Money)</span>
                      {role === 'Employee' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </button>
                  </div>
                </div>

                {/* Sign Out Option */}
                <div className="p-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
export default Header;
