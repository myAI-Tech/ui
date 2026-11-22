import type { ReactNode } from "react";
import type { PostureKind, Surface } from "./device";
import { clamp } from "./physics";
import type { PhysicsTokens } from "./tokens";

/**
 * How an element travels when a fold moves it between surfaces:
 *  - melt       backs up, turns molten, runs down the crease and re-solidifies (cards, tiles)
 *  - slide      moves rigidly along the same route (lists, text blocks)
 *  - crossfade  fades out at the source and in at the destination (editors, media, canvases —
 *               anything too expensive or too stateful to deform)
 *  - pin        does not move
 */
export type FlowProfile = "melt" | "slide" | "crossfade" | "pin";
export type PaneRole = "primary" | "context" | "chat" | "tool";

export type PaneContext = {
  experience: string;
  slot: number;
  surface: Surface;
  posture: PostureKind;
  /** True when rendered in a condensed form (banner drop-down, small tile). */
  condensed: boolean;
};

export type PaneSpec = {
  id: string;
  title: string;
  /** Label for page-marker tabs and the touch bar. */
  short?: string;
  expandIcon?: ReactNode;
  color?: string;
  role?: PaneRole;
  /** Who owns the pane: a shared myui primitive or an app-local surface. Informational. */
  owner?: "shared" | "local";
  /** Optional visible badge; ownership metadata is not rendered automatically. */
  badge?: ReactNode;
  flow?: FlowProfile;
  render: (ctx: PaneContext) => ReactNode;
  /** One-line condensed form for banner layouts. Defaults to `summary` or the title. */
  banner?: (ctx: PaneContext) => ReactNode;
  summary?: string;
};

export type ActionContext = { slot: number; experience: string; posture: PostureKind };
export type ActionSpec = { id: string; label: string; icon?: ReactNode; glyph?: string; run?: (ctx: ActionContext) => void };

/** What the lower surface shows in a half-fold (laptop) posture. */
export type DeckSpec =
  | { kind: "keyboard"; onKey: (key: string, ctx: ActionContext) => void; layout?: VirtualKeyboardLayout }
  | { kind: "pane"; pane: string }
  | { kind: "controls"; render: (ctx: ActionContext) => ReactNode };

export type VirtualKeyboardLayout = {
  rows: Array<{ characters: string; before?: string[]; after?: string[] }>;
  bottom: string[];
  labels?: Record<string, ReactNode>;
};

export type ExperienceHeaderContext = {
  experience: ExperienceSpec;
  slot: number;
  surface: Surface;
  posture: PostureKind;
  scopeId?: string;
};

/**
 * What an experience exposes in a given posture: extra actions (touch bar,
 * context flyout), published state other surfaces can read, and — for the
 * half-fold posture — what the deck shows.
 */
export type PostureCapability = {
  actions?: ActionSpec[];
  state?: (ctx: ActionContext) => Record<string, unknown>;
  deck?: DeckSpec;
};

export type WindowRect = { pane: string; x: number; y: number; w: number; h: number };

export type ExperienceRenderContext = {
  slot: number;
  surface: Surface;
  posture: PostureKind;
  /** True when this experience covers both halves of an unfolded display. */
  span: boolean;
};

export type ExperienceSpec = {
  id: string;
  label: string;
  /** Two-letter code for radial nodes. */
  code: string;
  accent: string;
  /** Informational, e.g. the app's own ModeContract layout name. */
  layout?: string;
  panes: PaneSpec[];
  /** How the experience condenses onto one small surface. Default "tabs". */
  compact?: "tabs" | "banner";
  /** Panes for the two halves when spanned. Default: first pane | the rest. */
  span?: [string, string];
  postures?: Partial<Record<PostureKind, PostureCapability>>;
  actions?: ActionSpec[];
  /** Free-form window canvas instead of managed panes (the "Custom" mode). */
  free?: { windows: WindowRect[] };
  /** Fully custom rendering (e.g. Home with fold transitions). Bypasses the resolver. */
  render?: (ctx: ExperienceRenderContext) => ReactNode;
  /** Replaces the default label-only header. `false` removes the header. */
  header?: false | ((ctx: ExperienceHeaderContext) => ReactNode);
};

export function pane(id: string, title: string, render: PaneSpec["render"], opts: Omit<PaneSpec, "id" | "title" | "render"> = {}): PaneSpec {
  return { id, title, render, ...opts };
}

export function defineExperience(spec: ExperienceSpec): ExperienceSpec {
  const ids = new Set<string>();
  for (const p of spec.panes) {
    if (ids.has(p.id)) throw new Error(`Experience "${spec.id}": duplicate pane id "${p.id}"`);
    ids.add(p.id);
  }
  const refs = [...(spec.span ?? []), ...(spec.free?.windows.map(w => w.pane) ?? []),
    ...Object.values(spec.postures ?? {}).flatMap(c => (c?.deck?.kind === "pane" ? [c.deck.pane] : []))];
  for (const r of refs) if (!ids.has(r)) throw new Error(`Experience "${spec.id}": unknown pane "${r}"`);
  if (!spec.render && !spec.free && spec.panes.length === 0) throw new Error(`Experience "${spec.id}" has no panes, free canvas or render`);
  return spec;
}

/** Per-experience layout memory. Part of SpatialState, but only what the resolver reads. */
export type ArrangementMemory = {
  compactOverride: "auto" | "tabs" | "banner";
  pane: Record<string, number>;
  ratio: Record<string, number>;
  duoPanes: Record<string, [string, string]>;
  chatTucked: Record<string, boolean>;
  windows: Record<string, WindowRect[]>;
};

export type Arrangement =
  | { kind: "empty" }
  | { kind: "custom" }
  | { kind: "free"; windows: WindowRect[]; key: string }
  | { kind: "single"; pane: string }
  | { kind: "stack"; panes: string[] }
  | { kind: "two"; left: string; right: string[]; banners: string[]; ratio: number; snap: number | null; axis: "vertical" | "horizontal" }
  | { kind: "tabs"; panes: string[]; active: number; side: "left" | "right" }
  | { kind: "banner"; primary: string; banners: string[] };

/**
 * Pure: decide how an experience lays out on one surface. `crease` is the
 * crease position in surface-local px when the surface spans a fold.
 */
export function resolveArrangement(exp: ExperienceSpec, surface: Surface, mem: ArrangementMemory, t: PhysicsTokens, crease: number | null = null): Arrangement {
  if (exp.render) return { kind: "custom" };
  if (exp.free) return { kind: "free", windows: mem.windows[`${surface.slot}:${exp.id}`] ?? exp.free.windows, key: `${surface.slot}:${exp.id}` };
  const ids = exp.panes.map(p => p.id);
  if (ids.length === 1) return { kind: "single", pane: ids[0] };

  if (surface.span || surface.w >= t.twoUpMinWidth) {
    const chat = exp.panes.find(p => p.role === "chat")?.id;
    const shown = chat && mem.chatTucked[exp.id] ? ids.filter(id => id !== chat) : ids;
    if (shown.length === 1) return { kind: "single", pane: shown[0] };
    const axis = surface.crease?.axis ?? "vertical";
    const dimension = axis === "vertical" ? surface.w : surface.h;
    const snap = crease != null ? crease / dimension : null;
    const ratio = surface.crease?.separating && snap != null
      ? snap
      : clamp(mem.ratio[exp.id] ?? snap ?? 0.5, t.dividerMin, t.dividerMax);
    const pair = mem.duoPanes[exp.id] ?? exp.span;
    if (pair && pair.every(id => shown.includes(id))) {
      const [left, right] = pair;
      return { kind: "two", left, right: [right], banners: shown.filter(id => id !== left && id !== right), ratio, snap, axis };
    }
    return { kind: "two", left: shown[0], right: shown.slice(1), banners: [], ratio, snap, axis };
  }

  if (surface.w * surface.h < t.compactArea) {
    const strategy = mem.compactOverride === "auto" ? exp.compact ?? "tabs" : mem.compactOverride;
    if (strategy === "banner") {
      const primary = exp.panes.find(p => p.role === "primary")?.id ?? ids[0];
      return { kind: "banner", primary, banners: ids.filter(id => id !== primary) };
    }
    return { kind: "tabs", panes: ids, active: clamp(mem.pane[exp.id] ?? 0, 0, ids.length - 1), side: surface.rail || surface.floating ? "right" : "left" };
  }
  return { kind: "stack", panes: ids };
}

/** Pane ids an arrangement actually shows (condensed banners and hidden tabs don't count). */
export function visiblePanes(arr: Arrangement): string[] {
  switch (arr.kind) {
    case "two": return [arr.left, ...arr.right];
    case "single": return [arr.pane];
    case "stack": return arr.panes;
    case "banner": return [arr.primary];
    case "tabs": return [arr.panes[arr.active]];
    case "free": return arr.windows.map(w => w.pane);
    default: return [];
  }
}

/** Remove a pane that is rendered by another physical surface, such as a laptop deck. */
export function excludePane(arr: Arrangement, paneId: string): Arrangement {
  switch (arr.kind) {
    case "single": return arr.pane === paneId ? { kind: "empty" } : arr;
    case "stack": {
      const panes = arr.panes.filter(id => id !== paneId);
      return panes.length ? panes.length === 1 ? { kind: "single", pane: panes[0] } : { ...arr, panes } : { kind: "empty" };
    }
    case "tabs": {
      const activeId = arr.panes[arr.active], panes = arr.panes.filter(id => id !== paneId);
      return panes.length ? panes.length === 1 ? { kind: "single", pane: panes[0] } : { ...arr, panes, active: Math.max(0, panes.indexOf(activeId)) } : { kind: "empty" };
    }
    case "banner": {
      const banners = arr.banners.filter(id => id !== paneId);
      if (arr.primary !== paneId) return { ...arr, banners };
      return banners.length ? { kind: "single", pane: banners[0] } : { kind: "empty" };
    }
    case "two": {
      const remaining = [arr.left, ...arr.right].filter(id => id !== paneId), banners = arr.banners.filter(id => id !== paneId);
      if (!remaining.length) return banners.length ? { kind: "stack", panes: banners } : { kind: "empty" };
      if (remaining.length === 1 && !banners.length) return { kind: "single", pane: remaining[0] };
      return { ...arr, left: remaining[0], right: remaining.slice(1), banners };
    }
    case "free": {
      const windows = arr.windows.filter(window => window.pane !== paneId);
      return windows.length ? { ...arr, windows } : { kind: "empty" };
    }
    default: return arr;
  }
}

export type SurfaceItem = { surface: Surface; exp: ExperienceSpec; project?: string; crease: number | null };

/**
 * Resolve every surface on the device together so the same content never
 * shows twice. Only tabbed arrangements can give a pane up, so they yield:
 * every other surface claims its visible panes first, then tabbed surfaces
 * (focused first) drop panes already visible for the same project. Pane ids
 * identify content across experiences ("code" is the same editor in Pair
 * Program and Code Assist).
 */
export function resolveDevice(items: SurfaceItem[], focusSlot: number, mem: ArrangementMemory, t: PhysicsTokens): Map<number, Arrangement> {
  const resolved = items.map(it => ({ it, arr: resolveArrangement(it.exp, it.surface, mem, t, it.crease) }));
  const rank = (r: (typeof resolved)[number]) => (r.arr.kind === "tabs" ? 2 : 0) + (r.it.surface.slot === focusSlot ? 0 : 1);
  const shown = new Set<string>(), out = new Map<number, Arrangement>();
  for (const { it, arr: initial } of [...resolved].sort((a, b) => rank(a) - rank(b))) {
    const key = (id: string) => `${it.project ?? ""}::${id}`;
    let arr = initial;
    if (arr.kind === "tabs") {
      const keep = arr.panes.filter(id => !shown.has(key(id)));
      if (!keep.length) arr = { kind: "empty" };
      else if (keep.length < arr.panes.length) {
        const activeId = arr.panes[arr.active];
        arr = keep.length === 1 ? { kind: "single", pane: keep[0] } : { ...arr, panes: keep, active: Math.max(0, keep.indexOf(activeId)) };
      }
    }
    visiblePanes(arr).forEach(id => shown.add(key(id)));
    out.set(it.surface.slot, arr);
  }
  return out;
}

export type ChatPlacement = "half" | "tucked" | "tab" | "tab-hidden" | "banner";

/** Where a chat-role pane sits in an arrangement, so a chat toggle can light up and act in place. */
export function chatPlacement(exp: ExperienceSpec, arr: Arrangement, mem: ArrangementMemory): ChatPlacement | null {
  const chat = exp.panes.find(p => p.role === "chat")?.id;
  if (!chat) return null;
  switch (arr.kind) {
    case "two": return arr.left === chat || arr.right.includes(chat) ? "half" : arr.banners.includes(chat) ? "banner" : null;
    case "single": return arr.pane === chat ? "half" : mem.chatTucked[exp.id] ? "tucked" : null;
    case "tabs": return arr.panes[arr.active] === chat ? "tab" : arr.panes.includes(chat) ? "tab-hidden" : null;
    case "banner": return arr.banners.includes(chat) ? "banner" : arr.primary === chat ? "half" : null;
    case "stack": return "half";
    default: return null;
  }
}

/** Capabilities an experience exposes in the current posture, merged with its always-on actions. */
export function postureActions(exp: ExperienceSpec, posture: PostureKind): ActionSpec[] {
  return [...(exp.postures?.[posture]?.actions ?? []), ...(exp.actions ?? [])];
}
