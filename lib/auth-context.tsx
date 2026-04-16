import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { getApiUrl } from '@/lib/query-client';
import { fetch } from 'expo/fetch';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  subscriptionPlan: string;
  voiceUsageCount: number;
  adsRemoved: boolean;
  voiceCreditsPurchased: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  resendConfirmation: (email: string) => Promise<string>;
  updateProfile: (name: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string>;
  deleteAccount: (password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL('/api/auth/me', baseUrl).toString(), {
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const baseUrl = getApiUrl();
    const res = await fetch(new URL('/api/auth/login', baseUrl).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Cannot reach server. Check your connection.');
    }
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setUser(data.user);
  };

  const register = async (name: string, email: string, password: string): Promise<string> => {
    const baseUrl = getApiUrl();
    const res = await fetch(new URL('/api/auth/register', baseUrl).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data.message;
  };

  const logout = async () => {
    try {
      const baseUrl = getApiUrl();
      await fetch(new URL('/api/auth/logout', baseUrl).toString(), {
        method: 'POST',
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
    } catch {}
    setUser(null);
  };

  const forgotPassword = async (email: string): Promise<string> => {
    const baseUrl = getApiUrl();
    const res = await fetch(new URL('/api/auth/forgot-password', baseUrl).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data.message;
  };

  const resendConfirmation = async (email: string): Promise<string> => {
    const baseUrl = getApiUrl();
    const res = await fetch(new URL('/api/auth/resend-confirmation', baseUrl).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data.message;
  };

  const updateProfile = async (name: string) => {
    const baseUrl = getApiUrl();
    const res = await fetch(new URL('/api/auth/profile', baseUrl).toString(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');
    setUser(data.user);
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<string> => {
    const baseUrl = getApiUrl();
    const res = await fetch(new URL('/api/auth/password', baseUrl).toString(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Password change failed');
    return data.message;
  };

  const refreshUser = async () => {
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL('/api/auth/me', baseUrl).toString(), {
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {}
  };

  const deleteAccount = async (password: string) => {
    const baseUrl = getApiUrl();
    const res = await fetch(new URL('/api/auth/account', baseUrl).toString(), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Account deletion failed');
    setUser(null);
  };

  const value = useMemo(() => ({
    user,
    isLoading,
    login,
    register,
    logout,
    forgotPassword,
    resendConfirmation,
    updateProfile,
    changePassword,
    deleteAccount,
    refreshUser,
  }), [user, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
