import type { InnerMode } from "./device";
import type { ArrangementMemory, ChatPlacement, WindowRect } from "./experience";
import { clamp } from "./physics";

export type SlotState = { experience: string; project?: string };
/** A favourite pairing: two experiences (possibly in different projects), one per half. */
export type PairSpec = { name: string; left: SlotState; right: SlotState };

/**
 * A desktop is a whole-device workspace: everything on screen at once (one
 * screen, both halves of a foldable, or every tile of a large display).
 * Swiping moves between desktops; they exist only once added with ＋.
 */
export type DesktopState = {
  id: string;
  name?: string;
  /** 0 = primary (cover / right half / span); 1 = left half; 2–3 large displays only. */
  slots: SlotState[];
  inner: InnerMode;
  focus: number;
  tiles: 1 | 2 | 3 | 4;
  tileRatio: number;
  /** Per-slot stacks of saved single workspaces (swipeScope "slot"). Absent = just the slot itself. */
  stacks?: Record<number, { saved: SlotState[]; at: number }>;
};

export type SpatialState = ArrangementMemory & {
  desktops: DesktopState[];
  active: number;
  /** Side of the spatial handle when there is only one screen (accessibility). */
  hand: "left" | "right";
  pairs: PairSpec[];
  prevPane: Record<string, number>;
};

export type SpatialAction =
  | { type: "setExperience"; slot: number; id: string; viaLeftHandle?: boolean }
  | { type: "focus"; slot: number }
  | { type: "setInner"; inner: InnerMode }
  | { type: "swapHalves" }
  | { type: "addDesktop"; desktop: Omit<DesktopState, "id">; activate?: boolean }
  | { type: "closeDesktop"; index: number }
  | { type: "switchDesktop"; index: number }
  | { type: "renameDesktop"; index: number; name: string }
  | { type: "addSlotWorkspace"; slot: number; workspace: SlotState }
  | { type: "stepSlotWorkspace"; slot: number; dir: 1 | -1 }
  | { type: "setPane"; experience: string; index: number }
  | { type: "setRatio"; experience: string; ratio: number }
  | { type: "mergePanes"; experience: string; fromSlot: number; left: string; right: string; unfolded: boolean }
  | { type: "toggleChat"; experience: string; placement: ChatPlacement; chatIndex: number }
  | { type: "applyPair"; pair: PairSpec }
  | { type: "savePair"; name: string }
  | { type: "setHand"; hand: "left" | "right" }
  | { type: "setCompact"; mode: ArrangementMemory["compactOverride"] }
  | { type: "setWindows"; key: string; windows: WindowRect[] }
  | { type: "setTiles"; tiles: 1 | 2 | 3 | 4 }
  | { type: "setTileRatio"; ratio: number }
  | { type: "setProject"; slot: number; project: string };

let seq = 0;
const newId = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

export function desktop(partial: Partial<DesktopState> & { slots: SlotState[] }): DesktopState {
  return { id: newId(), inner: "span", focus: 0, tiles: 2, tileRatio: 0.5, ...partial };
}

export type InitialSpatialState = Partial<Omit<SpatialState, "desktops">> & { desktops: (Partial<DesktopState> & { slots: SlotState[] })[] };

export function initialSpatialState(init: InitialSpatialState): SpatialState {
  return {
    active: 0, hand: "right", pairs: [], prevPane: {},
    compactOverride: "auto", pane: {}, ratio: {}, duoPanes: {}, chatTucked: {}, windows: {},
    ...init,
    desktops: init.desktops.map(desktop),
  };
}

/** A slot's saved single workspaces; a slot with no stack is a stack of one. */
export const slotStack = (d: DesktopState, slot: number) => d.stacks?.[slot] ?? { saved: [d.slots[slot]], at: 0 };

/** The desktop currently on screen. */
export const activeDesktop = (s: SpatialState): DesktopState => s.desktops[clamp(s.active, 0, s.desktops.length - 1)];

const without = <T,>(r: Record<string, T>, k: string) => { const { [k]: _, ...rest } = r; return rest; };

/** Pure reducer. Desktop-scoped actions apply to the active desktop. */
export function spatialReducer(s: SpatialState, a: SpatialAction): SpatialState {
  const d = activeDesktop(s);
  const put = (next: Partial<DesktopState>): SpatialState => ({ ...s, desktops: s.desktops.map((x, i) => (i === s.active ? { ...d, ...next } : x)) });
  const setSlot = (i: number, v: Partial<SlotState>, extra: Partial<DesktopState> = {}) => put({ ...extra, slots: d.slots.map((x, j) => (j === i ? { ...x, ...v } : x)) });

  switch (a.type) {
    case "setExperience": {
      // the left handle claims the left half
      return setSlot(a.slot, { experience: a.id }, { focus: a.slot, ...(a.viaLeftHandle && d.inner === "span" ? { inner: "split" as const } : {}) });
    }
    case "focus": return d.focus === a.slot ? s : put({ focus: a.slot });
    case "setInner": return put({ inner: a.inner });
    case "swapHalves": return put({ slots: [d.slots[1], d.slots[0], ...d.slots.slice(2)] });
    case "addDesktop": {
      const desktops = [...s.desktops, { ...a.desktop, id: newId() }];
      return { ...s, desktops, active: a.activate === false ? s.active : desktops.length - 1 };
    }
    case "closeDesktop": {
      if (s.desktops.length <= 1) return s;
      const desktops = s.desktops.filter((_, i) => i !== a.index);
      return { ...s, desktops, active: clamp(a.index <= s.active ? s.active - 1 : s.active, 0, desktops.length - 1) };
    }
    case "switchDesktop": return { ...s, active: clamp(a.index, 0, s.desktops.length - 1) };
    case "renameDesktop": return { ...s, desktops: s.desktops.map((x, i) => (i === a.index ? { ...x, name: a.name } : x)) };
    case "addSlotWorkspace": {
      const st = slotStack(d, a.slot), saved = [...st.saved.map((w, i) => (i === st.at ? d.slots[a.slot] : w)), a.workspace];
      return setSlot(a.slot, a.workspace, { focus: a.slot, stacks: { ...d.stacks, [a.slot]: { saved, at: saved.length - 1 } } });
    }
    case "stepSlotWorkspace": {
      const st = slotStack(d, a.slot), at = clamp(st.at + a.dir, 0, st.saved.length - 1);
      if (at === st.at) return s;
      const saved = st.saved.map((w, i) => (i === st.at ? d.slots[a.slot] : w));   // keep edits made while it was showing
      return put({ focus: a.slot, slots: d.slots.map((x, j) => (j === a.slot ? saved[at] : x)), stacks: { ...d.stacks, [a.slot]: { saved, at } } });
    }
    case "setPane": return { ...s, pane: { ...s.pane, [a.experience]: a.index } };
    case "setRatio": return { ...s, ratio: { ...s.ratio, [a.experience]: a.ratio } };
    case "mergePanes": {
      const merged = { ...s, duoPanes: { ...s.duoPanes, [a.experience]: [a.left, a.right] as [string, string] } };
      const md = activeDesktop(merged), putM = (next: Partial<DesktopState>) => ({ ...merged, desktops: merged.desktops.map((x, i) => (i === s.active ? { ...md, ...next } : x)) });
      if (a.unfolded) return putM({ slots: md.slots.map((x, j) => (j === 0 ? { ...md.slots[a.fromSlot] } : x)), inner: "span", focus: 0 });
      return a.fromSlot === 0 ? putM({ inner: "span" }) : merged;   // applied when the device next unfolds
    }
    case "toggleChat": {
      const e = a.experience;
      switch (a.placement) {
        case "half": return { ...s, chatTucked: { ...s.chatTucked, [e]: true } };
        case "tucked": return { ...s, chatTucked: without(s.chatTucked, e) };
        case "tab": return { ...s, pane: { ...s.pane, [e]: s.prevPane[e] ?? (a.chatIndex === 0 ? 1 : 0) } };
        case "tab-hidden": return { ...s, prevPane: { ...s.prevPane, [e]: s.pane[e] ?? 0 }, pane: { ...s.pane, [e]: a.chatIndex } };
        default: return s;   // banners open/close locally
      }
    }
    case "applyPair": return put({ slots: [{ ...a.pair.right }, { ...a.pair.left }, ...d.slots.slice(2)], inner: "split", tiles: d.tiles < 2 ? 2 : d.tiles });
    case "savePair": return { ...s, pairs: [...s.pairs, { name: a.name, left: { ...d.slots[1] }, right: { ...d.slots[0] } }].slice(-6) };
    case "setHand": return { ...s, hand: a.hand };
    case "setCompact": return { ...s, compactOverride: a.mode };
    case "setWindows": return { ...s, windows: { ...s.windows, [a.key]: a.windows } };
    case "setTiles": return put({ tiles: a.tiles, focus: a.tiles > d.focus ? d.focus : 0 });
    case "setTileRatio": return put({ tileRatio: clamp(a.ratio, 0.25, 0.75) });
    case "setProject": return setSlot(a.slot, { project: a.project });
  }
}
