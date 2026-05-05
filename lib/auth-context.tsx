import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { getApiUrl } from '@/lib/query-client';
import { fetch } from 'expo/fetch';

// Default per-request timeout for auth flows. Mobile networks stall —
// without this the spinner spins forever on a hung connection. Mirrors
// the apiRequest behavior in lib/query-client.ts.
const AUTH_TIMEOUT_MS = 30_000;

// Wraps fetch with a 30s AbortController + maps low-level errors
// (timeout, no network, DNS) to user-actionable strings instead of
// surfacing TypeError or stack traces. The screens then just display
// `err.message` directly.
async function authFetch(
  url: string,
  init: { method?: string; body?: string; credentials?: RequestCredentials },
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: init.method,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: init.body,
      credentials: init.credentials ?? 'include',
      signal: controller.signal,
    });
    return res;
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e?.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection.');
    }
    throw new Error('Cannot reach server. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
}

// Reads JSON safely from a Response — returns the parsed object,
// or throws a friendly error if the body is non-JSON (e.g. an HTML
// error page from a proxy/gateway). Used everywhere we need to read
// the server's `error` field cleanly.
async function readJsonOrThrow(res: Response, fallback: string): Promise<any> {
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Cannot reach server. Check your connection.');
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || fallback);
  }
  return data;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  subscriptionPlan: string;
  voiceUsageCount: number;
  adsRemoved: boolean;
  voiceCreditsPurchased: number;
  hasSeenDemo: boolean;
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
  markDemoSeen: () => Promise<void>;
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
    const res = await authFetch(new URL('/api/auth/login', baseUrl).toString(), {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = await readJsonOrThrow(res, 'Login failed');
    setUser(data.user);
  };

  const register = async (name: string, email: string, password: string): Promise<string> => {
    const baseUrl = getApiUrl();
    const res = await authFetch(new URL('/api/auth/register', baseUrl).toString(), {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    const data = await readJsonOrThrow(res, 'Registration failed');
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
    const res = await authFetch(new URL('/api/auth/forgot-password', baseUrl).toString(), {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    const data = await readJsonOrThrow(res, 'Request failed');
    return data.message;
  };

  const resendConfirmation = async (email: string): Promise<string> => {
    const baseUrl = getApiUrl();
    const res = await authFetch(new URL('/api/auth/resend-confirmation', baseUrl).toString(), {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    const data = await readJsonOrThrow(res, 'Request failed');
    return data.message;
  };

  const updateProfile = async (name: string) => {
    const baseUrl = getApiUrl();
    const res = await authFetch(new URL('/api/auth/profile', baseUrl).toString(), {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    const data = await readJsonOrThrow(res, 'Update failed');
    setUser(data.user);
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<string> => {
    const baseUrl = getApiUrl();
    const res = await authFetch(new URL('/api/auth/password', baseUrl).toString(), {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await readJsonOrThrow(res, 'Password change failed');
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

  const markDemoSeen = async () => {
    // Optimistic local update so the gate doesn't flash the demo again.
    setUser((prev) => (prev ? { ...prev, hasSeenDemo: true } : prev));
    try {
      const baseUrl = getApiUrl();
      await fetch(new URL('/api/auth/mark-demo-seen', baseUrl).toString(), {
        method: 'POST',
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
    } catch {}
  };

  const deleteAccount = async (password: string) => {
    const baseUrl = getApiUrl();
    const res = await authFetch(new URL('/api/auth/account', baseUrl).toString(), {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
    await readJsonOrThrow(res, 'Account deletion failed');
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
    markDemoSeen,
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
