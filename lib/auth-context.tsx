import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getApiUrl } from '@/lib/query-client';
import { getOrCreateDeviceId } from '@/lib/device-id';
import { V2_PASSIVE_MODE } from '@/lib/feature-flags';
import { fetch as expoFetch } from 'expo/fetch';

// expo/fetch is built for native (streaming, native cookie store) and does NOT
// behave on web — there the call silently never resolves. Use the browser's
// native fetch on web. Mirrors the split already used in app/voice-expense.tsx.
// Keeping the name `fetch` means every call site below is unchanged.
const fetch: typeof globalThis.fetch =
  Platform.OS === 'web'
    ? globalThis.fetch.bind(globalThis)
    : (expoFetch as unknown as typeof globalThis.fetch);

// Persist the user object across app launches. Without this, the
// splash screen blocks the entire UI behind a network round-trip to
// /api/auth/me on every cold start (~500ms PKT → Singapore). Cache
// hydration happens in <50ms; the network validation happens in the
// background. If validation returns 401 we kick to login then.
const USER_CACHE_KEY = 'hisaabit:user';

async function loadCachedUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function persistUser(user: AuthUser | null): Promise<void> {
  try {
    if (user) {
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    // Cache failures are non-fatal — the app still works without it,
    // just slower on next launch.
  }
}

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
  anonymousSignIn: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    bootstrapAuth();
  }, []);

  // Boot sequence: hydrate the cached user (instant), then validate
  // the session against the server in the background. If the network
  // call comes back 401, the cached user is stale — clear and bounce
  // to login. Network errors are tolerated: keep the cached user so
  // a brief outage doesn't log everyone out.
  const bootstrapAuth = async () => {
    const cached = await loadCachedUser();
    if (cached) {
      setUser(cached);
      setIsLoading(false);
      validateSession();
      return;
    }
    // No cached user. In v2 there is no login screen — silently establish a
    // device-tied anonymous session BEFORE finishing load, so the gate routes
    // straight into the app instead of flashing an auth screen.
    if (V2_PASSIVE_MODE) {
      await ensureAnonymousSession();
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
    validateSession();
  };

  // v2: obtain or resume the device-tied anonymous session. The device id is
  // the identity; no email/password involved.
  const ensureAnonymousSession = async () => {
    try {
      const deviceId = await getOrCreateDeviceId();
      const baseUrl = getApiUrl();
      const res = await authFetch(new URL('/api/auth/anonymous', baseUrl).toString(), {
        method: 'POST',
        body: JSON.stringify({ deviceId }),
      });
      const data = await readJsonOrThrow(res, 'Could not start session');
      setUser(data.user);
      await persistUser(data.user);
    } catch {
      // Offline / server down: leave user null. The gate shows a connecting
      // state; bootstrap/validate retry on next launch or focus.
    }
  };

  const validateSession = async () => {
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL('/api/auth/me', baseUrl).toString(), {
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        await persistUser(data.user);
      } else if (res.status === 401) {
        // In v2, an expired session silently re-establishes anonymously rather
        // than bouncing to a (non-existent) login screen.
        if (V2_PASSIVE_MODE) {
          await ensureAnonymousSession();
        } else {
          setUser(null);
          await persistUser(null);
        }
      }
      // Other status codes (5xx, 502 from a Railway redeploy, etc.)
      // we treat as transient — keep the cached user.
    } catch {
      // Network unreachable — also transient, keep cached user.
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
    await persistUser(data.user);
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
    await persistUser(null);
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
    await persistUser(data.user);
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
        await persistUser(data.user);
      }
    } catch {}
  };

  const markDemoSeen = async () => {
    // Optimistic local update so the gate doesn't flash the demo again.
    setUser((prev) => {
      const next = prev ? { ...prev, hasSeenDemo: true } : prev;
      // Persist optimistically too so the next cold launch doesn't
      // flash the demo before the server roundtrip lands.
      if (next) {
        persistUser(next).catch(() => {});
      }
      return next;
    });
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
    await persistUser(null);
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
    anonymousSignIn: ensureAnonymousSession,
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
