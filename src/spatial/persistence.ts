import type { Orientation, PostureKind } from "./device";
import type { SpatialState } from "./state";

/**
 * Reload continuity until native clients exist: the last spatial state plus
 * the fold angle and posture, so a reload restores the same desktops and the
 * fold spring animates from where it was (`SpatialProvider resumeAngle`).
 * Deliberately small: browser storage only, versioned, expiring.
 */
export type SpatialSnapshot = {
  v: 1;
  at: number;
  angle: number;
  posture: PostureKind;
  orientation: Orientation;
  /** Omitted in the cookie fallback when it would not fit. */
  state?: SpatialState;
};

export type SnapshotStore = {
  load(): SpatialSnapshot | null;
  save(s: SpatialSnapshot): void;
  clear(): void;
};

export type BrowserSnapshotOptions = {
  key?: string;
  /** Snapshots older than this are ignored (default 30 minutes). */
  maxAgeMs?: number;
  /** Fall back to a cookie when localStorage is unavailable (private modes, blocked storage). */
  cookieFallback?: boolean;
};

const COOKIE_LIMIT = 3800;

function valid(x: unknown, maxAgeMs: number): x is SpatialSnapshot {
  const s = x as SpatialSnapshot | null;
  return !!s && s.v === 1 && typeof s.angle === "number" && typeof s.at === "number" && Date.now() - s.at <= maxAgeMs
    && (s.state === undefined || Array.isArray(s.state.desktops));
}

function storage(): Storage | null {
  try { const ls = window.localStorage, k = "__sp_probe__"; ls.setItem(k, "1"); ls.removeItem(k); return ls; } catch { return null; }
}

export function browserSnapshotStore({ key = "myai.spatial", maxAgeMs = 30 * 60_000, cookieFallback = true }: BrowserSnapshotOptions = {}): SnapshotStore {
  const ls = typeof window === "undefined" ? null : storage();
  const readCookie = () => document.cookie.split("; ").find(c => c.startsWith(`${key}=`))?.slice(key.length + 1);
  const writeCookie = (v: string, age: number) => { document.cookie = `${key}=${v}; Max-Age=${age}; Path=/; SameSite=Lax`; };
  return {
    load() {
      try {
        const raw = ls ? ls.getItem(key) : cookieFallback && typeof document !== "undefined" ? decodeURIComponent(readCookie() ?? "") : null;
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        return valid(parsed, maxAgeMs) ? parsed : null;
      } catch { return null; }
    },
    save(s) {
      try {
        if (ls) return ls.setItem(key, JSON.stringify(s));
        if (!cookieFallback || typeof document === "undefined") return;
        let v = encodeURIComponent(JSON.stringify(s));
        if (v.length > COOKIE_LIMIT) v = encodeURIComponent(JSON.stringify({ ...s, state: undefined }));   // keep the fold continuity at least
        writeCookie(v, Math.round(maxAgeMs / 1000));
      } catch { /* storage full or blocked: continuity is best-effort */ }
    },
    clear() {
      try { ls?.removeItem(key); if (cookieFallback && typeof document !== "undefined") writeCookie("", 0); } catch { /* ignore */ }
    },
  };
}
