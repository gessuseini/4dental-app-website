/**
 * In-memory cache + rate gate for Paddle API calls.
 * Prevents Cloudflare 1015 bans from success-page / activate refresh spam.
 */

type CacheEntry<T> = { value: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();
const lastHitAt = new Map<string, number>();

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour — verified checkouts stay local
const MIN_GAP_MS = 45_000; // at most one live fetch per key every 45s
const GLOBAL_COOLDOWN_MS = 10 * 60 * 1000; // after 429, pause all Paddle calls 10 min

let globalCooldownUntil = 0;

export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function markPaddleRateLimited(ms = GLOBAL_COOLDOWN_MS) {
  globalCooldownUntil = Math.max(globalCooldownUntil, Date.now() + ms);
}

export function isPaddleCoolingDown(): boolean {
  return Date.now() < globalCooldownUntil;
}

export function paddleCooldownRemainingMs(): number {
  return Math.max(0, globalCooldownUntil - Date.now());
}

/** Returns false if caller should skip hitting Paddle again so soon. */
export function allowPaddleFetch(key: string, gapMs = MIN_GAP_MS): boolean {
  if (isPaddleCoolingDown()) return false;
  const last = lastHitAt.get(key) ?? 0;
  const now = Date.now();
  if (now - last < gapMs) return false;
  lastHitAt.set(key, now);
  return true;
}

export function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const status =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  return (
    status === "429" ||
    lower.includes("429") ||
    lower.includes("1015") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("banned you temporarily") ||
    lower.includes("<!doctype") // Cloudflare HTML challenge/ban page
  );
}
