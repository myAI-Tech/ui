import type { Orientation, PostureKind } from "./device";
import { initialSpatialState, type DesktopState, type PairSpec, type SlotState, type SpatialState } from "./state";
import { clamp } from "./physics";

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

const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" ? value as Record<string, unknown> : null;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const slot = (value: unknown): SlotState | null => {
  const v = object(value);
  return v && typeof v.experience === "string" && v.experience ? { experience: v.experience, ...(typeof v.project === "string" ? { project: v.project } : {}) } : null;
};
const numberRecord = (value: unknown) => Object.fromEntries(Object.entries(object(value) ?? {}).filter((entry): entry is [string, number] => finite(entry[1])));
const indexRecord = (value: unknown) => Object.fromEntries(Object.entries(numberRecord(value)).map(([key, index]) => [key, Math.max(0, Math.round(index))]));
const booleanRecord = (value: unknown) => Object.fromEntries(Object.entries(object(value) ?? {}).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"));

function normalizedDesktop(value: unknown, index: number): DesktopState | null {
  const v = object(value), slots = Array.isArray(v?.slots) ? v.slots.map(slot).filter((item): item is SlotState => !!item) : [];
  if (!v || !slots.length) return null;
  const tileValue = finite(v.tiles) ? Math.round(v.tiles) : 2;
  const tiles = clamp(tileValue, 1, 4) as DesktopState["tiles"];
  const focus = clamp(finite(v.focus) ? Math.round(v.focus) : 0, 0, slots.length - 1);
  const stacks = object(v.stacks);
  const normalizedStacks = stacks ? Object.fromEntries(Object.entries(stacks).flatMap(([key, raw]) => {
    const stack = object(raw), saved = Array.isArray(stack?.saved) ? stack.saved.map(slot).filter((item): item is SlotState => !!item) : [];
    if (!saved.length) return [];
    return [[Number(key), { saved, at: clamp(finite(stack?.at) ? Math.round(stack.at) : 0, 0, saved.length - 1) }]];
  })) : undefined;
  return {
    id: typeof v.id === "string" && v.id ? v.id : `restored-${index}`,
    ...(typeof v.name === "string" ? { name: v.name } : {}),
    slots,
    inner: v.inner === "split" ? "split" : "span",
    focus,
    tiles,
    tileRatio: clamp(finite(v.tileRatio) ? v.tileRatio : 0.5, 0.25, 0.75),
    locked: v.locked === true,
    ...(v.swipeScope === "slot" || v.swipeScope === "device" ? { swipeScope: v.swipeScope } : {}),
    ...(normalizedStacks && Object.keys(normalizedStacks).length ? { stacks: normalizedStacks } : {}),
  };
}

export function normalizeSpatialState(value: unknown): SpatialState | null {
  const v = object(value), desktops = Array.isArray(v?.desktops)
    ? v.desktops.map(normalizedDesktop).filter((item): item is DesktopState => !!item)
    : [];
  if (!v || !desktops.length) return null;
  const base = initialSpatialState({ desktops });
  const pairs: PairSpec[] = Array.isArray(v.pairs) ? v.pairs.flatMap(raw => {
    const pair = object(raw), left = slot(pair?.left), right = slot(pair?.right);
    return pair && left && right ? [{ name: typeof pair.name === "string" ? pair.name : "Restored pair", left, right }] : [];
  }) : [];
  const duoPanes = Object.fromEntries(Object.entries(object(v.duoPanes) ?? {}).flatMap(([key, raw]) =>
    Array.isArray(raw) && raw.length === 2 && raw.every(item => typeof item === "string") ? [[key, raw as [string, string]]] : []));
  const windows = Object.fromEntries(Object.entries(object(v.windows) ?? {}).flatMap(([key, raw]) => {
    if (!Array.isArray(raw)) return [];
    const rects = raw.flatMap(item => {
      const r = object(item);
      return r && typeof r.pane === "string" && finite(r.x) && finite(r.y) && finite(r.w) && finite(r.h)
        ? [{ pane: r.pane, x: clamp(r.x, 0, 85), y: clamp(r.y, 0, 88), w: clamp(r.w, 15, 100 - clamp(r.x, 0, 85)), h: clamp(r.h, 12, 100 - clamp(r.y, 0, 88)) }]
        : [];
    });
    return rects.length ? [[key, rects]] : [];
  }));
  const overlays = Object.fromEntries(Object.entries(object(v.overlays) ?? {}).flatMap(([key, raw]) => {
    const overlay = object(raw);
    return overlay && finite(overlay.x) && finite(overlay.y)
      ? [[key, { x: overlay.x, y: overlay.y, minimized: overlay.minimized === true }]]
      : [];
  }));
  return {
    ...base,
    desktops,
    active: clamp(finite(v.active) ? Math.round(v.active) : 0, 0, desktops.length - 1),
    hand: v.hand === "left" ? "left" : "right",
    pairs,
    prevPane: indexRecord(v.prevPane),
    compactOverride: v.compactOverride === "tabs" || v.compactOverride === "banner" ? v.compactOverride : "auto",
    pane: indexRecord(v.pane),
    ratio: numberRecord(v.ratio),
    duoPanes,
    chatTucked: booleanRecord(v.chatTucked),
    windows,
    overlays,
  };
}

export function decodeSpatialSnapshot(value: unknown, maxAgeMs: number, now = Date.now()): SpatialSnapshot | null {
  const v = object(value);
  if (!v || v.v !== 1 || !finite(v.angle) || !finite(v.at) || v.at > now + 60_000 || now - v.at > maxAgeMs) return null;
  const posture = (["single", "cover", "book", "laptop", "canvas", "tiles"] as PostureKind[]).includes(v.posture as PostureKind)
    ? v.posture as PostureKind : "single";
  const orientation: Orientation = v.orientation === "landscape" ? "landscape" : "portrait";
  const state = v.state === undefined ? undefined : normalizeSpatialState(v.state);
  if (v.state !== undefined && !state) return null;
  return { v: 1, at: v.at, angle: clamp(v.angle, 0, 180), posture, orientation, ...(state ? { state } : {}) };
}

function storage(): Storage | null {
  try { const ls = window.localStorage, k = "__sp_probe__"; ls.setItem(k, "1"); ls.removeItem(k); return ls; } catch { return null; }
}

export function browserSnapshotStore({ key = "myai.spatial", maxAgeMs = 30 * 60_000, cookieFallback = true }: BrowserSnapshotOptions = {}): SnapshotStore {
  const ls = typeof window === "undefined" ? null : storage();
  const readCookie = () => typeof document === "undefined" ? undefined : document.cookie.split("; ").find(c => c.startsWith(`${key}=`))?.slice(key.length + 1);
  const writeCookie = (v: string, age: number) => { if (typeof document !== "undefined") document.cookie = `${key}=${v}; Max-Age=${age}; Path=/; SameSite=Lax`; };
  const fromRaw = (raw: string | null | undefined, encoded = false) => {
    try { return raw ? decodeSpatialSnapshot(JSON.parse(encoded ? decodeURIComponent(raw) : raw), maxAgeMs) : null; } catch { return null; }
  };
  const saveCookie = (snapshot: SpatialSnapshot) => {
    if (!cookieFallback || typeof document === "undefined") return;
    let value = encodeURIComponent(JSON.stringify(snapshot));
    if (value.length > COOKIE_LIMIT) value = encodeURIComponent(JSON.stringify({ ...snapshot, state: undefined }));
    writeCookie(value, Math.round(maxAgeMs / 1000));
  };
  return {
    load() {
      try { const snapshot = ls ? fromRaw(ls.getItem(key)) : null; if (snapshot) return snapshot; } catch { /* try cookie */ }
      return cookieFallback ? fromRaw(readCookie(), true) : null;
    },
    save(s) {
      try { if (ls) { ls.setItem(key, JSON.stringify(s)); return; } } catch { /* use cookie fallback */ }
      try { saveCookie(s); } catch { /* continuity is best-effort */ }
    },
    clear() {
      try { ls?.removeItem(key); if (cookieFallback && typeof document !== "undefined") writeCookie("", 0); } catch { /* ignore */ }
    },
  };
}
