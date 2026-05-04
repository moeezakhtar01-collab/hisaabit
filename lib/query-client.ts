import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:3000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN;
  if (!host) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }
  const hasProtocol = host.startsWith("http://") || host.startsWith("https://");
  let url = new URL(hasProtocol ? host : `https://${host}`);
  return url.href;
}

// Default per-request timeout. Mobile networks stall — without this
// a hung request keeps the loading spinner on forever and the user
// thinks the app is broken. 30s is generous for slow PKT connections
// while still letting Whisper transcribes finish (those use a longer
// per-request override on the voice endpoint side).
const DEFAULT_TIMEOUT_MS = 30_000;

async function throwIfResNotOk(res: Response) {
  if (res.ok) return;
  // Pull the server's `error` field out of JSON responses so the
  // thrown message is something the screens can show directly. Falls
  // back through plain text → statusText → status code.
  let message = res.statusText || `Request failed (${res.status})`;
  try {
    const text = await res.text();
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error) message = parsed.error;
        else if (parsed?.message) message = parsed.message;
        else message = text;
      } catch {
        message = text;
      }
    }
  } catch {
    // Body already consumed or unreadable — keep the fallback message.
  }
  const err = new Error(message) as Error & { status?: number };
  err.status = res.status;
  throw err;
}

interface ApiRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
  options?: ApiRequestOptions,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // If the caller passed their own signal (e.g. a screen that
  // unmounts), abort our combined controller too.
  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener(
        "abort",
        () => controller.abort(),
        { once: true },
      );
    }
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        // Match auth-context: bypass ngrok's HTML interstitial when
        // the dev API is exposed through a tunnel. Harmless on prod.
        "ngrok-skip-browser-warning": "true",
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    const e = err as { name?: string };
    if (e?.name === "AbortError") {
      throw new Error("Request timed out. Check your connection.");
    }
    // DNS, no internet, refused, etc. Map to a friendly message —
    // screens shouldn't need to recognize TypeError.
    throw new Error("Cannot reach server. Check your connection.");
  }
  clearTimeout(timer);

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    // Same timeout treatment as apiRequest. React Query also passes
    // its own AbortSignal for cancellation on unmount — combine.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
      }
    }

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        credentials: "include",
        headers: { "ngrok-skip-browser-warning": "true" },
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const e = err as { name?: string };
      if (e?.name === "AbortError") {
        throw new Error("Request timed out. Check your connection.");
      }
      throw new Error("Cannot reach server. Check your connection.");
    }
    clearTimeout(timer);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
