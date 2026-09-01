import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import {
  updateProfileThunk,
  updatePasswordThunk,
  inviteTeamMemberThunk,
  updateTeamMemberRoleThunk,
  removeTeamMemberThunk,
  UserRole,
} from '../store/authSlice';
import { validateEmailAddress } from '../utils/helpers';
import { motion } from 'framer-motion';
import {
  X,
  User,
  Lock,
  UserPlus,
  Shield,
  Check,
  Copy,
  Mail,
  Send,
  Sparkles,
  Users,
  Info,
  CheckCircle2,
  Trash2,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';

interface UserSettingsModalProps {
  onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { currentUser, teamMembers, isLoading } = useSelector(
    (state: RootState) => state.auth
  );

  const isSupervisor = currentUser?.role === 'Supervisor';
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'team'>('profile');

  // Profile Form State
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [profileEmailError, setProfileEmailError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  // Password Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Invite Form State (Supervisor only)
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmailError, setInviteEmailError] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('Employee');
  const [invitePassword, setInvitePassword] = useState('');
  const [lastInvitedCredentials, setLastInvitedCredentials] = useState<{
    name: string;
    email: string;
    pass: string;
    role: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedEmailText, setCopiedEmailText] = useState(false);

  // Team Directory Management State
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [roleUpdateSuccess, setRoleUpdateSuccess] = useState<{ id: string; role: string } | null>(null);

  // Profile update handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileEmailError('');

    const emailErr = validateEmailAddress(email);
    if (emailErr) {
      setProfileEmailError(emailErr);
      return;
    }
    if (!name.trim()) return;

    const res = await dispatch(updateProfileThunk({ name: name.trim(), email: email.trim() }));
    if (updateProfileThunk.fulfilled.match(res)) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } else if (updateProfileThunk.rejected.match(res)) {
      setProfileEmailError((res.payload as string) || 'Failed to update profile');
    }
  };

  // Password update handler
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    const res = await dispatch(updatePasswordThunk({ newPassword }));
    if (updatePasswordThunk.fulfilled.match(res)) {
      setPasswordSaved(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSaved(false), 3000);
    } else {
      setPasswordError('Failed to update password.');
    }
  };

  // Generate standard invitation email body text with credentials
  const generateInviteEmailBody = (
    memberName: string,
    memberEmail: string,
    pass: string,
    role: string
  ) => {
    const loginUrl = window.location.origin;
    const roleLabel = role === 'Supervisor' ? 'Supervisor (Owner)' : role;
    return `Hello ${memberName || 'Team Member'},\n\nYou have been invited to join the Grid Utilities Console portal as a ${roleLabel}.\n\nHere are your login credentials:\n• Portal URL: ${loginUrl}\n• Work Email: ${memberEmail}\n• Temporary Password: ${pass}\n• Assigned Role: ${roleLabel}\n\nPlease visit ${loginUrl} to log in. You can change your password anytime under Settings > Password & Security.\n\nBest regards,\nGrid Utilities Operations Team`;
  };

  // Invite member handler
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteEmailError('');

    if (!inviteName.trim()) return;

    const emailErr = validateEmailAddress(inviteEmail);
    if (emailErr) {
      setInviteEmailError(emailErr);
      return;
    }

    const generatedPass = invitePassword.trim() || `Grid@${Math.floor(1000 + Math.random() * 9000)}`;

    const res = await dispatch(
      inviteTeamMemberThunk({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        tempPassword: generatedPass,
      })
    );

    if (inviteTeamMemberThunk.fulfilled.match(res)) {
      setLastInvitedCredentials({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        pass: res.payload.tempPassword,
        role: inviteRole,
      });
      setInviteName('');
      setInviteEmail('');
      setInvitePassword('');
      setInviteEmailError('');
    } else if (inviteTeamMemberThunk.rejected.match(res)) {
      setInviteEmailError((res.payload as string) || 'Failed to send invite');
    }
  };

  const handleCopyCredentials = () => {
    if (!lastInvitedCredentials) return;
    const roleLabel =
      lastInvitedCredentials.role === 'Supervisor'
        ? 'Supervisor (Owner)'
        : lastInvitedCredentials.role;
    const text = `Grid Utilities Portal Login Credentials:\nEmail: ${lastInvitedCredentials.email}\nPassword: ${lastInvitedCredentials.pass}\nRole: ${roleLabel}\nLogin at: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyFullInviteEmail = (
    memberName: string,
    memberEmail: string,
    pass: string,
    role: string
  ) => {
    const emailBody = generateInviteEmailBody(memberName, memberEmail, pass, role);
    navigator.clipboard.writeText(emailBody);
    setCopiedEmailText(true);
    setTimeout(() => setCopiedEmailText(false), 2500);
  };

  const handleOpenMailClient = (
    memberName: string,
    memberEmail: string,
    pass: string,
    role: string
  ) => {
    const subject = encodeURIComponent(`Welcome to Grid Utilities Console - Login Credentials`);
    const body = encodeURIComponent(generateInviteEmailBody(memberName, memberEmail, pass, role));
    window.open(`mailto:${memberEmail}?subject=${subject}&body=${body}`, '_blank');
  };

  const togglePasswordVisibility = (id: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopySinglePassword = (id: string, pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedPasswordId(id);
    setTimeout(() => setCopiedPasswordId(null), 2000);
  };

  // Role change handler
  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    await dispatch(updateTeamMemberRoleThunk({ memberId, newRole }));
    setRoleUpdateSuccess({ id: memberId, role: newRole === 'Supervisor' ? 'Supervisor (Owner)' : newRole });
    setTimeout(() => setRoleUpdateSuccess(null), 2500);
  };

  // Member removal handler
  const handleConfirmRemove = async (memberId: string, memberEmail: string) => {
    await dispatch(removeTeamMemberThunk({ memberId, email: memberEmail }));
    setDeletingMemberId(null);
  };

  const getMemberPassword = (member: any) => {
    if (member.tempPassword) return member.tempPassword;
    if (member.email === 'samkanalytics@gmail.com' || member.email === 'muhammadumar009@gmail.com') return 'Admin@123';
    if (member.email === 'sarah.admin@gridutil.com') return 'Admin@123';
    if (member.email === 'david.field@gridutil.com') return 'Admin@123';
    return 'Admin@123';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white border border-slate-200 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 text-blue-600 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">User & Team Settings</h2>
              <p className="text-xs text-slate-400">
                Manage your credentials, preferences, and organization roles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-100 px-6 bg-white gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'password'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Password & Security</span>
          </button>

          {isSupervisor && (
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'team'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-purple-500" />
              <span>Team & Invitations</span>
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded-full">
                Owner
              </span>
            </button>
          )}
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 font-sans">
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-blue-500/20">
                  {currentUser?.name?.slice(0, 2).toUpperCase() || 'GU'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{currentUser?.name}</h3>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                        currentUser?.role === 'Supervisor'
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : currentUser?.role === 'Admin'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {currentUser?.role === 'Supervisor' ? 'Supervisor (Owner)' : currentUser?.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{currentUser?.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Email Address
                  </label>
                  {profileEmailError && (
                    <span className="text-[10px] font-semibold text-rose-500 animate-fadeIn">
                      {profileEmailError}
                    </span>
                  )}
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (profileEmailError) setProfileEmailError('');
                  }}
                  onBlur={() => {
                    const err = validateEmailAddress(email);
                    setProfileEmailError(err);
                  }}
                  className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white transition-all font-medium ${
                    profileEmailError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-400'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Role & Permissions
                </label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800">
                      {currentUser?.role === 'Supervisor' ? 'Supervisor (Owner)' : currentUser?.role}:{' '}
                    </span>
                    {currentUser?.role === 'Supervisor' &&
                      'Highest organization tier (Owner). Full access to profit margins, all financials, upload consoles, and team role management.'}
                    {currentUser?.role === 'Admin' &&
                      'Operational administrative access (invoices and expenses, profit margins hidden).'}
                    {currentUser?.role === 'Employee' &&
                      'Field operational access only (all money-related figures and financial charts are hidden).'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {profileSaved && (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Profile updated successfully!
                  </span>
                )}
                <div className="ml-auto">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: PASSWORD & SECURITY */}
          {activeTab === 'password' && (
            <form onSubmit={handleSavePassword} className="space-y-5">
              <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl text-xs text-blue-800">
                Update your account password securely. Once changed, use your new credentials for future logins.
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password (min. 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                />
              </div>

              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-semibold">
                  {passwordError}
                </div>
              )}

              {passwordSaved && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Password updated successfully!
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                >
                  Update Password
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: TEAM & INVITATIONS (SUPERVISOR / OWNER ONLY) */}
          {activeTab === 'team' && isSupervisor && (
            <div className="space-y-6">
              {/* Invite Form */}
              <form
                onSubmit={handleSendInvite}
                className="p-5 bg-gradient-to-br from-slate-50 to-purple-50/40 border border-purple-100 rounded-2xl space-y-4"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-900">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Invite New Team Member</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Morgan"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold uppercase text-slate-500">
                        Work Email
                      </label>
                      {inviteEmailError && (
                        <span className="text-[10px] font-semibold text-rose-500 animate-fadeIn">
                          {inviteEmailError}
                        </span>
                      )}
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="alex@company.com"
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value);
                        if (inviteEmailError) setInviteEmailError('');
                      }}
                      onBlur={() => {
                        const err = validateEmailAddress(inviteEmail);
                        setInviteEmailError(err);
                      }}
                      className={`w-full bg-white border rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none transition-all ${
                        inviteEmailError
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-400'
                          : 'border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Assigned Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as UserRole)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-purple-500 transition-all cursor-pointer"
                    >
                      <option value="Employee">Employee (Hidden money & financial metrics)</option>
                      <option value="Admin">Admin (Invoices & expenses, no profit margins)</option>
                      <option value="Supervisor">Supervisor (Owner) (Full owner control & all figures)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Initial Password (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Leave blank to auto-generate"
                      value={invitePassword}
                      onChange={(e) => setInvitePassword(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Password included in Supabase Auth confirmation email & quick mailer</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Invite</span>
                  </button>
                </div>
              </form>

              {/* Credentials & Email Dispatch Card if recently invited */}
              {lastInvitedCredentials && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col gap-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Member Invited Successfully!</span>
                      </div>
                      <p className="text-xs text-emerald-700 font-mono mt-1">
                        Email: <span className="font-bold">{lastInvitedCredentials.email}</span> · Temp Password:{' '}
                        <span className="font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-900 select-all">
                          {lastInvitedCredentials.pass}
                        </span>{' '}
                        · Role:{' '}
                        <span className="font-bold">
                          {lastInvitedCredentials.role === 'Supervisor'
                            ? 'Supervisor (Owner)'
                            : lastInvitedCredentials.role}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Email & Credentials Quick Action Bar */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-200/60">
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenMailClient(
                          lastInvitedCredentials.name,
                          lastInvitedCredentials.email,
                          lastInvitedCredentials.pass,
                          lastInvitedCredentials.role
                        )
                      }
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Send Credentials via Email</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyFullInviteEmail(
                          lastInvitedCredentials.name,
                          lastInvitedCredentials.email,
                          lastInvitedCredentials.pass,
                          lastInvitedCredentials.role
                        )
                      }
                      className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedEmailText ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>{copiedEmailText ? 'Email Copied!' : 'Copy Full Invite Email'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyCredentials}
                      className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Key className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>{copied ? 'Copied!' : 'Copy Login Details'}</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Team Directory Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span>Team Members Directory ({teamMembers.length})</span>
                  </div>
                  {roleUpdateSuccess && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 text-purple-600" />
                      <span>Role updated to {roleUpdateSuccess.role}!</span>
                    </motion.div>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Member</th>
                        <th className="py-2.5 px-3">Role (Editable)</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Password / Credentials</th>
                        <th className="py-2.5 px-3 text-right">Invited Date</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {teamMembers.map((member) => {
                        const isSelf =
                          currentUser &&
                          (currentUser.id === member.id ||
                            currentUser.email.toLowerCase() === member.email.toLowerCase());
                        const pass = getMemberPassword(member);
                        const isRevealed = !!revealedPasswords[member.id];
                        const isDeleting = deletingMemberId === member.id;

                        return (
                          <tr
                            key={member.id}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              isDeleting ? 'bg-red-50/40' : ''
                            }`}
                          >
                            {/* Member Name & Email */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800">{member.name}</span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 text-[9px] font-bold bg-slate-100 text-slate-600 rounded border border-slate-200">
                                    You (Owner)
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">{member.email}</div>
                            </td>

                            {/* Role (Editable selector for Supervisor) */}
                            <td className="py-2.5 px-3">
                              <div className="relative inline-block">
                                <select
                                  value={member.role}
                                  onChange={(e) =>
                                    handleRoleChange(member.id, e.target.value as UserRole)
                                  }
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border appearance-none pr-6 cursor-pointer focus:outline-none focus:ring-1 transition-all ${
                                    member.role === 'Supervisor'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 focus:border-purple-400 focus:ring-purple-300'
                                      : member.role === 'Admin'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 focus:border-blue-400 focus:ring-blue-300'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 focus:border-emerald-400 focus:ring-emerald-300'
                                  }`}
                                  title="Click to edit member role"
                                >
                                  <option value="Employee">Employee</option>
                                  <option value="Admin">Admin</option>
                                  <option value="Supervisor">Supervisor (Owner)</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500 text-[10px]">
                                  ▼
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {member.status || 'Active'}
                              </span>
                            </td>

                            {/* Password / Credentials Quick Access */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px] min-w-[75px]">
                                  {isRevealed ? pass : '••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => togglePasswordVisibility(member.id)}
                                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                  title={isRevealed ? 'Hide Password' : 'Show Password'}
                                >
                                  {isRevealed ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopySinglePassword(member.id, pass)}
                                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                  title="Copy Password"
                                >
                                  {copiedPasswordId === member.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Invited Date */}
                            <td className="py-2.5 px-3 text-right font-mono text-slate-400 text-[11px]">
                              {member.invitedAt || 'Active'}
                            </td>

                            {/* Actions Column */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1">
                                {/* Email / Mailto Action */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenMailClient(member.name, member.email, pass, member.role)
                                  }
                                  className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                  title="Send confirmation email with password"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </button>

                                {/* Remove Member Action */}
                                {isSelf ? (
                                  <button
                                    disabled
                                    className="p-1.5 text-slate-300 cursor-not-allowed"
                                    title="You cannot remove your active Owner account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : isDeleting ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleConfirmRemove(member.id, member.email)}
                                      className="px-2 py-0.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-[10px] font-bold rounded transition-colors cursor-pointer shadow-sm"
                                      title="Confirm Removal"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingMemberId(null)}
                                      className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-medium rounded transition-colors cursor-pointer"
                                      title="Cancel"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingMemberId(member.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title={`Remove ${member.name}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
export default UserSettingsModal;

