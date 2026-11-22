import { clamp } from "./physics";
import type { PhysicsTokens } from "./tokens";

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };
export type Orientation = "portrait" | "landscape";
export type FoldState = "closed" | "half" | "flat";
export type CreaseAxis = "vertical" | "horizontal";

export type DeviceProfile = {
  id: string;
  label: string;
  kind: "slab" | "foldable" | "tablet" | "desktop";
  /** Portrait size of the main display. For a foldable this is the cover screen. */
  screen: Size;
  /** Foldable inner display, described as one half in book orientation. Continuous displays have creaseWidth 0. */
  inner?: { half: Size; creaseWidth: number };
  /** Authoritative display segments in the profile's current orientation, when measured by the host. */
  segments?: Rect[];
  /** Where global controls live: a right control rail, or floating buttons over full-width content. */
  chrome: "rail" | "floating";
  frame: { bezel: number; radius: number; innerRadius?: number; island?: boolean };
  /** Managed tiles available on large displays (experimental). */
  maxTiles?: 1 | 2 | 3 | 4;
};

// Dimensions are CSS px. The iPhone Duo values are placeholders until real specs exist.
export const devices = {
  slab: { id: "slab", label: "Slab phone", kind: "slab", screen: { w: 390, h: 844 }, chrome: "floating", frame: { bezel: 12, radius: 48, island: true } },
  iphoneDuo: {
    id: "iphone-duo", label: "iPhone Duo", kind: "foldable", screen: { w: 520, h: 740 },
    inner: { half: { w: 520, h: 740 }, creaseWidth: 0 }, chrome: "rail", frame: { bezel: 10, radius: 46, innerRadius: 38, island: true },
  },
  dualScreen: {
    id: "dual-screen-passport", label: "Dual-screen passport", kind: "foldable", screen: { w: 540, h: 720 },
    inner: { half: { w: 540, h: 720 }, creaseWidth: 14 }, chrome: "rail", frame: { bezel: 10, radius: 30, innerRadius: 18 },
  },
  compactBook: {
    id: "compact-book", label: "Compact book foldable", kind: "foldable", screen: { w: 360, h: 800 },
    inner: { half: { w: 345, h: 830 }, creaseWidth: 0 }, chrome: "floating", frame: { bezel: 8, radius: 28, innerRadius: 22 },
  },
  wideBook: {
    id: "wide-book", label: "Wide book foldable", kind: "foldable", screen: { w: 390, h: 840 },
    inner: { half: { w: 380, h: 840 }, creaseWidth: 0 }, chrome: "floating", frame: { bezel: 8, radius: 30, innerRadius: 22 },
  },
  ipadPro: { id: "ipad-pro", label: "iPad Pro", kind: "tablet", screen: { w: 1024, h: 1366 }, chrome: "rail", frame: { bezel: 18, radius: 34 }, maxTiles: 4 },
  desktop: { id: "desktop", label: "Desktop", kind: "desktop", screen: { w: 1680, h: 1050 }, chrome: "rail", frame: { bezel: 8, radius: 12 }, maxTiles: 4 },
} satisfies Record<string, DeviceProfile>;

/**
 * Posture is what layouts react to. It only changes at thresholds, so it is
 * React state; the continuous angle/openness is delivered per frame instead.
 *  - single  slab / tablet with one surface
 *  - cover   foldable closed, cover screen
 *  - book    foldable open with a vertical crease (fold = half | flat)
 *  - laptop  foldable half-open with a horizontal crease: app on top, deck below
 *  - canvas  foldable flat with a horizontal crease: one tall surface
 *  - tiles   large display with managed tiles
 */
export type PostureKind = "single" | "cover" | "book" | "laptop" | "canvas" | "tiles";
export type Posture = { kind: PostureKind; fold: FoldState | null; axis: CreaseAxis | null; orientation: Orientation };

export function foldStateFor(angle: number, t: PhysicsTokens): FoldState {
  return angle < t.closedBelow ? "closed" : angle < t.halfFoldBelow ? "half" : "flat";
}

export function computePosture(device: DeviceProfile, orientation: Orientation, angle: number, t: PhysicsTokens): Posture {
  if (device.kind === "foldable" && device.inner) {
    const fold = foldStateFor(angle, t);
    if (fold === "closed") return { kind: "cover", fold, axis: null, orientation };
    if (orientation === "portrait") return { kind: "book", fold, axis: "vertical", orientation };
    return { kind: fold === "half" ? "laptop" : "canvas", fold, axis: "horizontal", orientation };
  }
  if (device.maxTiles && device.maxTiles > 1) return { kind: "tiles", fold: null, axis: null, orientation };
  return { kind: "single", fold: null, axis: null, orientation };
}

export const samePosture = (a: Posture, b: Posture) =>
  a.kind === b.kind && a.fold === b.fold && a.axis === b.axis && a.orientation === b.orientation;

/** 0 → 1 as a book-style foldable unfolds; drives fold transitions. Always 1 on displays that don't fold. */
export function foldOpenness(device: DeviceProfile, orientation: Orientation, angle: number, t: PhysicsTokens): number {
  if (device.kind !== "foldable") return 1;
  if (orientation === "landscape") return angle < t.closedBelow ? 0 : 1;
  return clamp((angle - t.closedBelow - 2) / 150, 0, 1);
}

export type ViewportLayout = {
  /** Full drawable size, including parts hidden while folded. */
  w: number;
  h: number;
  /** Where experiences render. */
  app: Rect;
  /** Crease position in viewport coordinates (null on unfolded / non-foldable displays). */
  crease: { axis: CreaseAxis; at: number; width: number; separating: boolean } | null;
  /** Exact display segments in viewport coordinates, when the host or profile provides them. */
  segments: Rect[] | null;
  /** Pixels that cannot display content, such as a physical dual-screen hinge. */
  occlusion: Rect | null;
  /** Half-fold lower surface (laptop deck), if any. */
  deck: Rect | null;
};

export function viewportFor(device: DeviceProfile, posture: Posture): ViewportLayout {
  const land = posture.orientation === "landscape";
  if (device.kind === "foldable" && device.inner) {
    const { w: hw, h: hh } = device.inner.half;
    const fallback = !land
      ? [{ x: 0, y: 0, w: hw, h: hh }, { x: hw + device.inner.creaseWidth, y: 0, w: hw, h: hh }]
      : [{ x: 0, y: 0, w: hh, h: hw }, { x: 0, y: hw + device.inner.creaseWidth, w: hh, h: hw }];
    const segments = normalizeSegments(device.segments?.length === 2 ? device.segments : fallback);
    const [first, second] = segments.rects;
    const full = segments.bounds;
    const axis = segments.axis;
    const gap = segments.gap;
    const crease = posture.kind === "cover" ? null : {
      axis,
      at: axis === "vertical" ? gap.x + gap.w / 2 : gap.y + gap.h / 2,
      width: axis === "vertical" ? gap.w : gap.h,
      separating: (axis === "vertical" ? gap.w : gap.h) > 0,
    };
    const occlusion = crease?.separating ? gap : null;
    if (!land) {   // book: the cover sits on the right segment's footprint
      const app = posture.kind === "cover" ? second : full;
      return { w: full.w, h: full.h, app, crease: posture.kind === "book" ? crease : null, segments: [first, second], occlusion, deck: null };
    }
    const top = first;
    return {
      w: full.w, h: full.h,
      app: posture.kind === "canvas" ? full : top,
      crease,
      segments: [first, second],
      occlusion,
      deck: posture.kind === "laptop" ? second : null,
    };
  }
  const { w, h } = land && device.kind !== "desktop" ? { w: device.screen.h, h: device.screen.w } : device.screen;   // desktops don't rotate
  return { w, h, app: { x: 0, y: 0, w, h }, crease: null, segments: null, occlusion: null, deck: null };
}

export type InnerMode = "split" | "span";
export type SurfaceSide = "left" | "right" | "single" | "tile";
export type Surface = Rect & {
  /** Index into SpatialState.slots. 0 = primary (cover / right half / span); 1 = left half; 2–3 large displays only. */
  slot: number;
  side: SurfaceSide;
  /** True when the control rail overlays this surface's right edge. */
  rail: boolean;
  /** True when floating controls overlay this surface's top edge. */
  floating: boolean;
  /** True when one experience covers both halves of an unfolded display. */
  span: boolean;
  /** Surface-local physical occlusion. Spanning content must avoid this rectangle. */
  occlusion?: Rect | null;
  /** Surface-local crease used to route two-pane arrangements. */
  crease?: { axis: CreaseAxis; at: number; width: number; separating: boolean } | null;
};

export function surfacesFor(device: DeviceProfile, posture: Posture, vp: ViewportLayout, inner: InnerMode, tiles = 2, tileRatio = 0.5): Surface[] {
  const { app } = vp, rail = device.chrome === "rail", floating = device.chrome === "floating";
  const localOcclusion = vp.occlusion
    && vp.occlusion.x < app.x + app.w && vp.occlusion.x + vp.occlusion.w > app.x
    && vp.occlusion.y < app.y + app.h && vp.occlusion.y + vp.occlusion.h > app.y
    ? { ...vp.occlusion, x: vp.occlusion.x - app.x, y: vp.occlusion.y - app.y }
    : null;
  const creaseStart = vp.crease?.axis === "vertical" ? app.x : app.y;
  const creaseEnd = vp.crease?.axis === "vertical" ? app.x + app.w : app.y + app.h;
  const localCrease = vp.crease && vp.crease.at > creaseStart && vp.crease.at < creaseEnd
    ? { ...vp.crease, at: vp.crease.at - (vp.crease.axis === "vertical" ? app.x : app.y) }
    : null;
  const one = (extra: Partial<Surface> = {}): Surface => ({ ...app, slot: 0, side: "single", rail, floating, span: false, occlusion: localOcclusion, crease: localCrease, ...extra });
  if (posture.kind === "book") {
    if (inner === "span") return [one({ span: true })];
    if (vp.segments?.length === 2) {
      const [left, right] = vp.segments;
      return [
        { ...left, slot: 1, side: "left", rail: false, floating, span: false },
        { ...right, slot: 0, side: "right", rail, floating, span: false },
      ];
    }
    const half = app.w / 2;
    return [
      { x: app.x, y: app.y, w: half, h: app.h, slot: 1, side: "left", rail: false, floating, span: false },
      { x: app.x + half, y: app.y, w: half, h: app.h, slot: 0, side: "right", rail, floating, span: false },
    ];
  }
  if (posture.kind === "canvas" && inner === "split" && vp.segments?.length === 2) {
    return vp.segments.map((segment, index) => ({ ...segment, slot: index, side: "tile", rail: rail && index === 0, floating, span: false }));
  }
  if (posture.kind !== "tiles") return [one()];
  const n = clamp(tiles, 1, device.maxTiles ?? 1), g = 10, W = app.w, H = app.h;
  const w1 = Math.round((W - g) * (n === 2 ? tileRatio : 0.5)), h2 = Math.round((H - g) / 2), xr = w1 + g, wr = W - xr;
  const grid: Record<number, [number, number, number, number, number][]> = {
    1: [[0, 0, 0, W, H]],
    2: [[1, 0, 0, w1, H], [0, xr, 0, wr, H]],
    3: [[1, 0, 0, w1, H], [0, xr, 0, wr, h2], [2, xr, h2 + g, wr, H - h2 - g]],
    4: [[1, 0, 0, w1, h2], [0, xr, 0, wr, h2], [2, 0, h2 + g, w1, H - h2 - g], [3, xr, h2 + g, wr, H - h2 - g]],
  };
  return grid[n].map(([slot, x, y, w, h]) => ({ x, y, w, h, slot, side: "tile" as const, rail: rail && x + w >= W - 1, floating, span: false }));
}

/** Which slot each spatial handle drives, and the region its flyout occupies. */
export function handleTargets(posture: Posture, vp: ViewportLayout, inner: InnerMode, focus: number) {
  const { app } = vp;
  if (posture.kind === "book" && inner === "split") {
    if (vp.segments?.length === 2) return { left: { slot: 1, region: vp.segments[0] }, right: { slot: 0, region: vp.segments[1] } };
    const half = app.w / 2;
    return { left: { slot: 1, region: { ...app, w: half } }, right: { slot: 0, region: { ...app, x: app.x + half, w: half } } };
  }
  const slot = posture.kind === "tiles" ? focus : 0;
  return { left: { slot: posture.kind === "book" ? 1 : slot, region: app }, right: { slot, region: app } };
}

export type MeasureOptions = {
  /** Override the chrome choice (default: floating on compact screens, rail otherwise). */
  chrome?: DeviceProfile["chrome"];
  /** Short-side width (CSS px) below which a single screen is treated as a phone. */
  compactBelow?: number;
};

export type NormalizedSegments = { rects: Rect[]; bounds: Rect; axis: CreaseAxis; gap: Rect };

/** Sort and normalize two reported display segments without assuming API order or equal dimensions. */
export function normalizeSegments(input: Rect[]): NormalizedSegments {
  if (input.length !== 2) throw new Error("Exactly two display segments are required");
  const [a, b] = input, ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const axis: CreaseAxis = Math.abs(ac.x - bc.x) >= Math.abs(ac.y - bc.y) ? "vertical" : "horizontal";
  const sorted = [...input].sort((x, y) => axis === "vertical" ? x.x - y.x : x.y - y.y);
  const minX = Math.min(...sorted.map(r => r.x)), minY = Math.min(...sorted.map(r => r.y));
  const maxX = Math.max(...sorted.map(r => r.x + r.w)), maxY = Math.max(...sorted.map(r => r.y + r.h));
  const rects = sorted.map(r => ({ x: r.x - minX, y: r.y - minY, w: r.w, h: r.h }));
  const [first, second] = rects;
  const gap = axis === "vertical"
    ? { x: first.x + first.w, y: 0, w: Math.max(0, second.x - first.x - first.w), h: maxY - minY }
    : { x: 0, y: first.y + first.h, w: maxX - minX, h: Math.max(0, second.y - first.y - first.h) };
  return { rects, bounds: { x: 0, y: 0, w: maxX - minX, h: maxY - minY }, axis, gap };
}

/**
 * A device profile from what the browser actually reports, for real
 * deployments (the `devices` presets are for labs and Storybook). Two
 * side-by-side viewport segments mean an unfolded book-style foldable; two
 * stacked segments mean a horizontal crease. Anything else is one screen.
 * Note: a folded foldable reports no segments, so it measures as a slab and
 * the unfold arrives as a profile change rather than a continuous transition.
 */
export function measuredDevice(size: Size, segments: Rect[] | null, opts: MeasureOptions = {}): { device: DeviceProfile; orientation: Orientation } {
  const frame = { bezel: 0, radius: 0 };
  if (segments && segments.length === 2) {
    const normalized = normalizeSegments(segments), [first] = normalized.rects, sideBySide = normalized.axis === "vertical";
    const gap = sideBySide ? normalized.gap.w : normalized.gap.h;
    const half = sideBySide ? { w: first.w, h: first.h } : { w: first.h, h: first.w };   // inner.half is described in book orientation
    return {
      device: { id: "measured-foldable", label: "Measured foldable", kind: "foldable", screen: half, inner: { half, creaseWidth: Math.max(0, gap) }, segments: normalized.rects, chrome: opts.chrome ?? "rail", frame },
      orientation: sideBySide ? "portrait" : "landscape",
    };
  }
  const portrait = { w: Math.min(size.w, size.h), h: Math.max(size.w, size.h) };
  const compact = portrait.w < (opts.compactBelow ?? 600);
  return {
    device: { id: compact ? "measured-slab" : "measured-large", label: compact ? "Measured phone" : "Measured large screen", kind: compact ? "slab" : "tablet", screen: portrait, chrome: opts.chrome ?? (compact ? "floating" : "rail"), frame },
    orientation: size.w > size.h ? "landscape" : "portrait",
  };
}
