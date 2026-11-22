import * as React from "react";
import {
  computePosture, foldOpenness, samePosture, surfacesFor, viewportFor,
  type DeviceProfile, type Orientation, type Posture, type Surface, type ViewportLayout,
} from "../device";
import { excludePane, resolveDevice, type Arrangement, type ExperienceSpec } from "../experience";
import { simulatedHinge, targetAngle, type HingeReading, type HingeSource } from "../hinge";
import { Spring, ticker } from "../physics";
import { activeDesktop, initialSpatialState, spatialReducer, type DesktopState, type InitialSpatialState, type SlotState, type SpatialAction, type SpatialState } from "../state";
import { defaultPhysics, withPhysics, type PhysicsTokens } from "../tokens";

export type FoldFrame = { angle: number; openness: number; dt: number; now: number };

/**
 * Per-frame fold signal. Subscribers write styles directly so a fold animates
 * at display rate without re-rendering React; posture changes (rare) go
 * through React state instead.
 */
export class FoldClock {
  readonly angle: Spring;
  openness: number;
  private subs = new Set<(f: FoldFrame) => void>();
  private last: FoldFrame;

  constructor(initialAngle: number, t: PhysicsTokens) {
    this.angle = new Spring(initialAngle, { k: t.hingeStiffness, c: t.hingeDamping, eps: 0.05 });
    this.openness = Math.min(1, Math.max(0, initialAngle / 180));
    this.last = { angle: initialAngle, openness: this.openness, dt: 0, now: 0 };
  }
  /** Override the hinge spring response, e.g. a slow scripted unfold in a demo. */
  setResponse(k: number, c: number) { this.angle.k = k; this.angle.c = c; }
  subscribe(fn: (f: FoldFrame) => void) { this.subs.add(fn); fn(this.last); return () => { this.subs.delete(fn); }; }
  frame() { return this.last; }
  /** @internal */
  publish(f: FoldFrame) { this.last = f; this.subs.forEach(s => s(f)); }
}

export type SpatialEvent =
  | { type: "experience"; slot: number; id: string }
  | { type: "action"; experience: string; action: string; slot: number }
  | { type: "pair-applied"; name: string; needsUnfold: boolean }
  | { type: "pair-saved"; name: string }
  | { type: "merge"; experience: string; left: string; right: string; deferred: boolean }
  | { type: "notice"; message: string; color?: string };

export type ProjectSpec = { id: string; name: string; color?: string };

export type SpatialContextValue = {
  device: DeviceProfile;
  orientation: Orientation;
  posture: Posture;
  viewport: ViewportLayout;
  surfaces: Surface[];
  tokens: PhysicsTokens;
  state: SpatialState;
  dispatch: React.Dispatch<SpatialAction>;
  experiences: Record<string, ExperienceSpec>;
  order: string[];
  /** The desktop on screen; desktop-scoped actions apply to it. */
  desktop: DesktopState;
  /** Focus used by visible chrome. Persisted focus is retained when its surface is temporarily hidden. */
  visibleFocus: number;
  /** Resolved layout for every visible slot, computed once for the whole device (tab de-duplication needs all of them). */
  arrangements: Map<number, Arrangement>;
  /** What a swipe switches: whole-device desktops, or a slot's own stack of saved workspaces. */
  swipeScope: "device" | "slot";
  newDesktop: () => Omit<DesktopState, "id">;
  newSlotWorkspace: (slot: number) => SlotState;
  projects: ProjectSpec[];
  fold: FoldClock;
  hinge: HingeSource;
  /** Rendered px per layout px (a lab scales the device to fit; real devices are 1). */
  scale: number;
  emit: (e: SpatialEvent) => void;
};

const SpatialContext = React.createContext<SpatialContextValue | null>(null);

export function useSpatial(): SpatialContextValue {
  const ctx = React.useContext(SpatialContext);
  if (!ctx) throw new Error("useSpatial must be used inside <SpatialProvider>");
  return ctx;
}

/** Subscribe to fold frames with a callback that writes styles directly. */
export function useFoldFrame(fn: (f: FoldFrame) => void, deps: React.DependencyList = []) {
  const { fold } = useSpatial();
  const ref = React.useRef(fn);
  ref.current = fn;
  React.useEffect(() => fold.subscribe(f => ref.current(f)), [fold, ...deps]);   // eslint-disable-line react-hooks/exhaustive-deps
}

export const usePosture = () => useSpatial().posture;

/** State the focused experience publishes for the current posture (e.g. the walkthrough step while half-folded). */
export function usePostureState(): Record<string, unknown> {
  const { experiences, state, posture, visibleFocus } = useSpatial();
  const d = activeDesktop(state), exp = experiences[d.slots[visibleFocus]?.experience];
  return exp?.postures?.[posture.kind]?.state?.({ slot: visibleFocus, experience: exp.id, posture: posture.kind }) ?? {};
}
export const useExperience = (id: string) => useSpatial().experiences[id];

type SpatialProviderSharedProps = {
  device: DeviceProfile;
  orientation?: Orientation;
  hinge?: HingeSource;
  experiences: ExperienceSpec[];
  /** Order experiences appear in the spatial flyout; defaults to the experiences' order. */
  order?: string[];
  /** Angle to start the fold spring from (e.g. restored after a reload) so the first frame animates from it. */
  resumeAngle?: number;
  /** Default "device": swiping switches whole-device desktops. "slot": each half swipes its own saved workspaces. */
  swipeScope?: "device" | "slot";
  /** Contents of a desktop created with ＋. Default: the first experience (usually Home), spanned. */
  newDesktop?: (s: SpatialState) => Omit<DesktopState, "id">;
  /** Contents of a slot workspace created with ＋ in slot scope. Default: the first experience. */
  newSlotWorkspace?: (s: SpatialState, slot: number) => SlotState;
  tokens?: Partial<PhysicsTokens>;
  projects?: ProjectSpec[];
  scale?: number;
  onEvent?: (e: SpatialEvent) => void;
  onStateChange?: (s: SpatialState) => void;
  children: React.ReactNode;
};

export type ControlledSpatialProviderProps = SpatialProviderSharedProps & {
  /** Application-owned state. The application must reduce every action received by `onAction`. */
  state: SpatialState;
  onAction: (action: SpatialAction) => void;
  initialState?: never;
};

export type UncontrolledSpatialProviderProps = SpatialProviderSharedProps & {
  state?: never;
  /** Starting state when the provider owns its reducer. */
  initialState: InitialSpatialState;
  /** Optional action observer; the provider still reduces internally. */
  onAction?: (action: SpatialAction) => void;
};

export type SpatialProviderProps = ControlledSpatialProviderProps | UncontrolledSpatialProviderProps;

export function SpatialProvider({
  device, orientation = "portrait", hinge: hingeProp, experiences, order: orderProp, state: stateProp, onAction, initialState, resumeAngle, tokens: tokenOverrides,
  swipeScope = "device", newDesktop: newDesktopProp, newSlotWorkspace: newSlotProp,
  projects = [], scale = 1, onEvent, onStateChange, children,
}: SpatialProviderProps) {
  const tokens = React.useMemo(() => (tokenOverrides ? withPhysics(tokenOverrides) : defaultPhysics), [tokenOverrides]);
  const tokensRef = React.useRef(tokens);
  tokensRef.current = tokens;

  const hinge = React.useMemo(() => hingeProp ?? simulatedHinge(180), [hingeProp]);
  const byId = React.useMemo(() => Object.fromEntries(experiences.map(e => [e.id, e])), [experiences]);
  const order = React.useMemo(() => orderProp ?? experiences.map(e => e.id), [orderProp, experiences]);
  const [own, ownDispatch] = React.useReducer(spatialReducer, initialState ?? { desktops: [{ slots: [{ experience: experiences[0]?.id ?? "" }] }] }, initialSpatialState);
  const controlled = stateProp !== undefined;
  const controlledAtMount = React.useRef(controlled);
  if (controlledAtMount.current !== controlled) throw new Error("SpatialProvider cannot switch between controlled and uncontrolled state");
  if (controlled && !onAction) throw new Error("SpatialProvider requires onAction when state is controlled");
  const state = controlled ? stateProp : own;
  const onActionRef = React.useRef(onAction);
  onActionRef.current = onAction;
  // Controlled: the app reduces. Uncontrolled: reduce here, and still report to onAction as an observer.
  const dispatch = React.useCallback<React.Dispatch<SpatialAction>>(a => { if (!controlled) ownDispatch(a); onActionRef.current?.(a); }, [controlled]);
  const desk = activeDesktop(state);

  const fold = React.useMemo(() => new FoldClock(resumeAngle ?? targetAngle(hinge.read(), tokens), tokens), [hinge]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [posture, setPosture] = React.useState(() => computePosture(device, orientation, fold.angle.x, tokens));

  // Hinge readings only move the spring's target. An unknown first native
  // reading must not erase a restored angle before the host reports a posture.
  React.useEffect(() => {
    let hasAuthoritativeReading = false;
    const aim = (r: HingeReading) => {
      const authoritative = r.angle != null || r.fold != null;
      if (!authoritative && resumeAngle != null && !hasAuthoritativeReading) return;
      hasAuthoritativeReading ||= authoritative;
      fold.angle.target = targetAngle(r, tokensRef.current);
    };
    aim(hinge.read());
    return hinge.subscribe(aim);
  }, [hinge, fold, resumeAngle]);

  const postureRef = React.useRef(posture);
  React.useEffect(() => ticker.add((dt, now) => {
    const t = tokensRef.current;
    fold.angle.step(dt, t);
    const angle = Math.min(180, Math.max(0, fold.angle.x));
    fold.openness = foldOpenness(device, orientation, angle, t);
    const next = computePosture(device, orientation, angle, t);
    if (!samePosture(next, postureRef.current)) { postureRef.current = next; setPosture(next); }
    fold.publish({ angle, openness: fold.openness, dt, now });
  }), [fold, device, orientation]);

  React.useEffect(() => { onStateChange?.(state); }, [state, onStateChange]);

  const viewport = React.useMemo(() => viewportFor(device, posture), [device, posture]);
  const surfaces = React.useMemo(() => surfacesFor(device, posture, viewport, desk.inner, desk.tiles, desk.tileRatio),
    [device, posture, viewport, desk.inner, desk.tiles, desk.tileRatio]);
  const visibleFocus = surfaces.some(surface => surface.slot === desk.focus) ? desk.focus : surfaces[0]?.slot ?? 0;
  const resolvedSwipeScope = desk.swipeScope ?? swipeScope;
  const arrangements = React.useMemo(() => {
    const resolved = resolveDevice(surfaces.flatMap(sf => {
      const slot = desk.slots[sf.slot], exp = slot && byId[slot.experience];
      const crease = sf.span && sf.crease ? sf.crease.at : null;
      return exp ? [{ surface: sf, exp, project: slot.project, crease }] : [];
    }), visibleFocus, state, tokens);
    const focused = byId[desk.slots[visibleFocus]?.experience], deck = focused?.postures?.[posture.kind]?.deck;
    if (posture.kind === "laptop" && deck?.kind === "pane") {
      const arrangement = resolved.get(visibleFocus);
      if (arrangement) resolved.set(visibleFocus, excludePane(arrangement, deck.pane));
    }
    return resolved;
  }, [surfaces, desk, byId, viewport, state, tokens, visibleFocus, posture.kind]);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const newDesktop = React.useCallback(() => newDesktopProp?.(stateRef.current) ?? { slots: [{ experience: order[0] }, { experience: order[1] ?? order[0] }], inner: "span" as const, focus: 0, tiles: 2 as const, tileRatio: 0.5 },
    [newDesktopProp, order]);
  const newSlotWorkspace = React.useCallback((slot: number) => newSlotProp?.(stateRef.current, slot) ?? { experience: order[0] }, [newSlotProp, order]);
  const emitRef = React.useRef(onEvent);
  emitRef.current = onEvent;
  const emit = React.useCallback((e: SpatialEvent) => emitRef.current?.(e), []);

  const value = React.useMemo<SpatialContextValue>(() => ({
    device, orientation, posture, viewport, surfaces, tokens, state, dispatch, experiences: byId, order, projects, fold, hinge, scale, emit,
    desktop: desk, visibleFocus, arrangements, swipeScope: resolvedSwipeScope, newDesktop, newSlotWorkspace,
  }), [device, orientation, posture, viewport, surfaces, tokens, state, byId, order, projects, fold, hinge, scale, emit, desk, visibleFocus, arrangements, resolvedSwipeScope, newDesktop, newSlotWorkspace]);

  return <SpatialContext.Provider value={value}>{children}</SpatialContext.Provider>;
}
