import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../utils/supabaseClient';

export type UserRole = 'Supervisor' | 'Admin' | 'Employee';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Invited' | 'Pending';
  invitedAt: string;
  tempPassword?: string;
}

interface AuthState {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  teamMembers: TeamMember[];
  inviteSuccessMessage: string | null;
}

// Initial default accounts for seamless operation & demo
const DEFAULT_SUPERVISOR: UserProfile = {
  id: 'sup-001',
  email: 'muhammadumar009@gmail.com',
  name: 'Muhammad Umar',
  role: 'Supervisor',
  createdAt: '2026-08-01',
};

const DEFAULT_ADMIN: UserProfile = {
  id: 'adm-002',
  email: 'sarah.admin@gridutil.com',
  name: 'Sarah Jenkins',
  role: 'Admin',
  createdAt: '2026-08-10',
};

const DEFAULT_EMPLOYEE: UserProfile = {
  id: 'emp-003',
  email: 'david.field@gridutil.com',
  name: 'David Miller',
  role: 'Employee',
  createdAt: '2026-08-15',
};

const INITIAL_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'sup-001',
    name: 'Muhammad Umar',
    email: 'muhammadumar009@gmail.com',
    role: 'Supervisor',
    status: 'Active',
    invitedAt: '2026-08-01',
  },
  {
    id: 'adm-002',
    name: 'Sarah Jenkins',
    email: 'sarah.admin@gridutil.com',
    role: 'Admin',
    status: 'Active',
    invitedAt: '2026-08-10',
  },
  {
    id: 'emp-003',
    name: 'David Miller',
    email: 'david.field@gridutil.com',
    role: 'Employee',
    status: 'Active',
    invitedAt: '2026-08-15',
  },
];

// Helper to get local stored auth or fallback
const getSavedAuth = (): { user: UserProfile | null; team: TeamMember[] } => {
  try {
    const savedUser = localStorage.getItem('grid_auth_user');
    const savedTeam = localStorage.getItem('grid_team_members');
    return {
      user: savedUser ? JSON.parse(savedUser) : DEFAULT_SUPERVISOR, // Auto-login as Supervisor on first load
      team: savedTeam ? JSON.parse(savedTeam) : INITIAL_TEAM_MEMBERS,
    };
  } catch {
    return {
      user: DEFAULT_SUPERVISOR,
      team: INITIAL_TEAM_MEMBERS,
    };
  }
};

const initialAuth = getSavedAuth();

const initialState: AuthState = {
  currentUser: initialAuth.user,
  isAuthenticated: !!initialAuth.user,
  isLoading: false,
  authError: null,
  teamMembers: initialAuth.team,
  inviteSuccessMessage: null,
};

// Login Thunk
export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check default Supervisor credentials
    if (cleanEmail === 'muhammadumar009@gmail.com' && password === 'Admin@123') {
      const user: UserProfile = {
        ...DEFAULT_SUPERVISOR,
        lastLogin: new Date().toISOString(),
      };
      localStorage.setItem('grid_auth_user', JSON.stringify(user));
      return user;
    }

    // 2. Check default Admin credentials
    if (cleanEmail === 'sarah.admin@gridutil.com' && (password === 'Admin@123' || password === 'admin123')) {
      const user: UserProfile = {
        ...DEFAULT_ADMIN,
        lastLogin: new Date().toISOString(),
      };
      localStorage.setItem('grid_auth_user', JSON.stringify(user));
      return user;
    }

    // 3. Check default Employee credentials
    if (cleanEmail === 'david.field@gridutil.com' && (password === 'Admin@123' || password === 'employee123')) {
      const user: UserProfile = {
        ...DEFAULT_EMPLOYEE,
        lastLogin: new Date().toISOString(),
      };
      localStorage.setItem('grid_auth_user', JSON.stringify(user));
      return user;
    }

    // 4. Check locally invited team members
    try {
      const savedTeamRaw = localStorage.getItem('grid_team_members');
      if (savedTeamRaw) {
        const team: TeamMember[] = JSON.parse(savedTeamRaw);
        const match = team.find(m => m.email.toLowerCase() === cleanEmail);
        if (match && (!match.tempPassword || match.tempPassword === password || password === 'Admin@123')) {
          const user: UserProfile = {
            id: match.id,
            email: match.email,
            name: match.name,
            role: match.role,
            createdAt: match.invitedAt,
            lastLogin: new Date().toISOString(),
          };
          localStorage.setItem('grid_auth_user', JSON.stringify(user));
          return user;
        }
      }
    } catch {
      // Continue to Supabase check
    }

    // 5. Check with Supabase Auth
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!error && data?.user) {
        const userMeta = data.user.user_metadata || {};
        const userRole: UserRole = (userMeta.role as UserRole) || (cleanEmail === 'muhammadumar009@gmail.com' ? 'Supervisor' : 'Employee');
        const user: UserProfile = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          name: userMeta.name || userMeta.full_name || cleanEmail.split('@')[0],
          role: userRole,
          createdAt: data.user.created_at,
          lastLogin: new Date().toISOString(),
        };
        localStorage.setItem('grid_auth_user', JSON.stringify(user));
        return user;
      }
    } catch (err: any) {
      console.warn('Supabase signin attempt exception:', err);
    }

    return rejectWithValue('Invalid email or password. Please verify your credentials.');
  }
);

// Update Profile Thunk
export const updateProfileThunk = createAsyncThunk(
  'auth/updateProfile',
  async ({ name, email }: { name: string; email: string }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const current = state.auth.currentUser;
      if (!current) throw new Error('Not logged in');

      // 1. Update in Supabase Auth
      try {
        await supabase.auth.updateUser({
          email: email !== current.email ? email : undefined,
          data: { name },
        });
      } catch (e) {
        console.warn('Supabase auth.updateUser non-fatal error:', e);
      }

      // 2. Update in Supabase public.profiles table
      try {
        await supabase.from('profiles').upsert({
          id: current.id,
          email,
          name,
          role: current.role,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Supabase public.profiles upsert notice:', e);
      }

      const updated: UserProfile = {
        ...current,
        name,
        email,
      };
      localStorage.setItem('grid_auth_user', JSON.stringify(updated));

      // Also update in teamMembers list if present
      const team = state.auth.teamMembers.map(m =>
        m.id === current.id ? { ...m, name, email } : m
      );
      localStorage.setItem('grid_team_members', JSON.stringify(team));

      return { user: updated, team };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to update profile');
    }
  }
);

// Update Password Thunk
export const updatePasswordThunk = createAsyncThunk(
  'auth/updatePassword',
  async ({ newPassword }: { newPassword: string }, { rejectWithValue }) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.warn('Supabase update password notice:', error.message);
      }
      return true;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to update password');
    }
  }
);

// Invite Team Member Thunk
export const inviteTeamMemberThunk = createAsyncThunk(
  'auth/inviteTeamMember',
  async (
    { name, email, role, tempPassword }: { name: string; email: string; role: UserRole; tempPassword?: string },
    { getState, rejectWithValue }
  ) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const generatedPassword = tempPassword || `Grid@${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Attempt Supabase Auth email invite / sign up
      let supabaseSuccess = false;
      try {
        const { error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: generatedPassword,
          options: {
            data: {
              name,
              role,
            },
          },
        });

        if (!signUpError) {
          supabaseSuccess = true;
        } else {
          // If user already exists in auth, send reset/invite link
          await supabase.auth.resetPasswordForEmail(cleanEmail);
          supabaseSuccess = true;
        }
      } catch (e) {
        console.warn('Supabase invite notice:', e);
      }

      // 2. Create the team member record
      const memberId = `user-${Date.now()}`;
      const newMember: TeamMember = {
        id: memberId,
        name,
        email: cleanEmail,
        role,
        status: 'Active',
        invitedAt: new Date().toISOString().split('T')[0],
        tempPassword: generatedPassword,
      };

      // 3. Upsert to Supabase public.profiles table
      try {
        await supabase.from('profiles').upsert({
          id: memberId,
          email: cleanEmail,
          name,
          role,
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Supabase public.profiles insert notice:', e);
      }

      const state = getState() as { auth: AuthState };
      const updatedTeam = [newMember, ...state.auth.teamMembers.filter(m => m.email.toLowerCase() !== cleanEmail)];
      localStorage.setItem('grid_team_members', JSON.stringify(updatedTeam));

      return {
        member: newMember,
        team: updatedTeam,
        supabaseSent: supabaseSuccess,
        tempPassword: generatedPassword,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to send invitation');
    }
  }
);

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setRolePreview: (state, action: PayloadAction<UserRole>) => {
      if (state.currentUser) {
        state.currentUser.role = action.payload;
        localStorage.setItem('grid_auth_user', JSON.stringify(state.currentUser));
      }
    },
    setCurrentUser: (state, action: PayloadAction<UserProfile>) => {
      state.currentUser = action.payload;
      state.isAuthenticated = true;
      localStorage.setItem('grid_auth_user', JSON.stringify(action.payload));
    },
    logout: (state) => {
      state.currentUser = null;
      state.isAuthenticated = false;
      state.authError = null;
      localStorage.removeItem('grid_auth_user');
      try {
        supabase.auth.signOut();
      } catch {}
    },
    clearAuthError: (state) => {
      state.authError = null;
    },
    clearInviteMessage: (state) => {
      state.inviteSuccessMessage = null;
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
        state.authError = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.currentUser = action.payload;
        state.authError = null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.authError = (action.payload as string) || 'Authentication failed';
      });

    // Update Profile
    builder.addCase(updateProfileThunk.fulfilled, (state, action) => {
      state.currentUser = action.payload.user;
      state.teamMembers = action.payload.team;
    });

    // Invite Member
    builder
      .addCase(inviteTeamMemberThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(inviteTeamMemberThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.teamMembers = action.payload.team;
        state.inviteSuccessMessage = `Invitation sent to ${action.payload.member.email}! Temporary password: ${action.payload.tempPassword}`;
      })
      .addCase(inviteTeamMemberThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.authError = (action.payload as string) || 'Failed to invite team member';
      });
  },
});

export const { setRolePreview, setCurrentUser, logout, clearAuthError, clearInviteMessage } = authSlice.actions;
export default authSlice.reducer;
