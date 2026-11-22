import * as React from "react";
import { handleTargets, type Rect, type Surface } from "../device";
import { postureActions, resolveArrangement, type Arrangement, type ExperienceSpec } from "../experience";
import { lerp, smooth } from "../physics";
import { slotStack } from "../state";
import { physicsCssVars } from "../tokens";
import { useFoldFrame, useSpatial } from "./context";
import { useEdgeFlyout, type FlyoutItem } from "./EdgeFlyout";
import { ExperienceView, PaneHostProvider, ShellUiContext, cx } from "./ExperienceView";
import { GooFilter } from "./FoldTransition";
import { HalfFoldDeck } from "./HalfFoldDeck";

export type ShellActionContext = Pick<ReturnType<typeof useSpatial>, "state" | "desktop" | "posture" | "dispatch" | "emit"> & {
  slot: number;
  experience: string;
  targetExperience?: string;
};

export type ShellAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  code?: string;
  color?: string;
  /** Optional experience target. `force` allows global navigation such as Home through a locked desktop. */
  experience?: string;
  force?: boolean;
  placement?: "leading" | "trailing";
  active?: boolean | ((context: ShellActionContext) => boolean);
  disabled?: boolean | ((context: ShellActionContext) => boolean);
  onSelect?: (context: ShellActionContext) => void;
};

export type BuiltInShellCommand = "split" | "span" | "swap" | "newDesktop" | "closeDesktop" | "workspaceOptions" | "divide" | "merge" | "overview" | "lock" | "unlock" | "favorite" | "unfavorite";
export type ShellCommandPresentation = { label: string; icon: React.ReactNode; color: string; hidden?: boolean };

export type SpatialShellMessages = {
  workspace: (index: number) => string;
  newWorkspace: string;
  closeWorkspace: string;
  closeWorkspaceConfirmation: string;
  workspaceOptions: string;
  workspaceOverview: string;
  closeOverview: string;
  locked: string;
  screen: (index: number) => string;
  viewCount: (count: number) => string;
  experiences: string;
  emptySurface: string;
  dropLeft: string;
  dropRight: string;
};

export type FavoriteExperienceChange = {
  experience: ExperienceSpec;
  pinned: boolean;
  context: ShellActionContext;
};

export type ShellControls = {
  /** Ordered global actions rendered in the rail or floating chrome. */
  actions?: ShellAction[];
  /** Consumer-owned pinned experiences or arbitrary activities. Rendered in chrome and the picker's inner ring. */
  favorites?: ShellAction[];
  /** Enables the Pin/Unpin command for the focused experience. The consumer updates `favorites`. */
  onFavoriteExperienceChange?: (change: FavoriteExperienceChange) => void;
  commands?: Partial<Record<BuiltInShellCommand, Partial<ShellCommandPresentation>>>;
  messages?: Partial<SpatialShellMessages>;
  confirmCloseWorkspace?: (context: ShellActionContext) => boolean | Promise<boolean>;
};

export type SpatialShellProps = {
  controls?: ShellControls;
  /** Global keyboard shortcuts: ←/→ switch desktops, [ / ] open flyouts, Esc closes. */
  keyboard?: boolean;
  className?: string;
};

const INTERACTIVE = "button,input,select,textarea,a,[role=separator],.sp-win,.sp-banner,.sp-mk,.sp-flow-item,.sp-pager";

const defaultMessages: SpatialShellMessages = {
  workspace: index => `Workspace ${index + 1}`,
  newWorkspace: "New workspace",
  closeWorkspace: "Close workspace",
  closeWorkspaceConfirmation: "Close this workspace? Its active views will be removed.",
  workspaceOptions: "Workspace options",
  workspaceOverview: "Workspace overview",
  closeOverview: "Close overview",
  locked: "locked",
  screen: index => `Screen ${index + 1}`,
  viewCount: count => `${count} view${count === 1 ? "" : "s"}`,
  experiences: "Experiences",
  emptySurface: "Content is already visible on another surface.",
  dropLeft: "left",
  dropRight: "right",
};

const defaultCommands: Record<BuiltInShellCommand, ShellCommandPresentation> = {
  split: { label: "Split halves", icon: "◫", color: "#38bdf8" },
  span: { label: "Span inner", icon: "▭", color: "#38bdf8" },
  swap: { label: "Swap halves", icon: "⇄", color: "#38bdf8" },
  newDesktop: { label: "New desktop", icon: "＋", color: "#38bdf8" },
  closeDesktop: { label: "Close desktop", icon: "×", color: "#fb7185" },
  workspaceOptions: { label: "Workspace options", icon: "…", color: "#a78bfa" },
  divide: { label: "Divide into independent workspaces", icon: "◫", color: "#38bdf8" },
  merge: { label: "Merge into a unified workspace", icon: "▭", color: "#38bdf8" },
  overview: { label: "Overview active workspace views", icon: "⌗", color: "#a78bfa" },
  lock: { label: "Lock activities to screens", icon: "●", color: "#fbbf24" },
  unlock: { label: "Unlock activities", icon: "○", color: "#fbbf24" },
  favorite: { label: "Pin experience", icon: "★", color: "#fbbf24" },
  unfavorite: { label: "Unpin experience", icon: "☆", color: "#fbbf24" },
};

/** Horizontal swipe on `el` → onStep(±1). Live drag feedback is written straight to `feedback`. */
function useSwipe(onStep: (dir: 1 | -1) => void, canStep: (dir: 1 | -1) => boolean) {
  const { scale, tokens } = useSpatial();
  const swallow = React.useRef(false);
  const begin = (e: React.PointerEvent, feedback: HTMLElement | null) => {
    if (e.button > 0 || (e.target as HTMLElement).closest(INTERACTIVE) || !feedback) return;
    const x0 = e.clientX, y0 = e.clientY, t0 = performance.now(); let lock: "x" | "y" | null = null, dx = 0;
    const move = (ev: PointerEvent) => {
      const ddx = (ev.clientX - x0) / scale, ddy = (ev.clientY - y0) / scale;
      if (!lock) { if (Math.hypot(ddx, ddy) > 8) lock = Math.abs(ddx) > Math.abs(ddy) ? "x" : "y"; else return; }
      if (lock !== "x") return;
      dx = ddx;
      const free = canStep(dx < 0 ? 1 : -1), k = free ? 0.45 : 0.12;   // rubber-band when there is nowhere to go
      feedback.style.transform = `translateX(${dx * k}px)`; feedback.style.opacity = String(1 - Math.min(0.4, Math.abs(dx * k) / 500));
    };
    const up = () => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", up);
      if (lock !== "x") return;
      swallow.current = true; feedback.style.transform = feedback.style.opacity = "";
      const v = Math.abs(dx) / Math.max(1, performance.now() - t0) * 1000, dir = dx < 0 ? 1 : -1;
      if ((Math.abs(dx) > tokens.swipeDistance || v > tokens.swipeVelocity) && canStep(dir)) onStep(dir);
    };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  };
  const onClickCapture = (e: React.MouseEvent) => { if (swallow.current) { swallow.current = false; e.stopPropagation(); e.preventDefault(); } };
  return { begin, onClickCapture };
}

/** Slide new content in from the side it came from. */
function useEnterAnimation(key: string, dir: number) {
  const { tokens } = useSpatial();
  const ref = React.useRef<HTMLDivElement>(null), prev = React.useRef(key);
  React.useEffect(() => {
    if (prev.current === key || !ref.current || tokens.reduceMotion) { prev.current = key; return; }
    prev.current = key;
    ref.current.animate([{ transform: `translateX(${dir * 70}px) scale(.97)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" });
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

/** Page indicator + ＋: desktops in device scope, a slot's saved workspaces in slot scope. */
function Pager({ count, at, onGo, onAdd, onClose, menu, messages, addIcon = "＋", closeIcon = "×", style }: {
  count: number; at: number; onGo: (i: number) => void; onAdd?: () => void; onClose?: () => void; menu?: React.ReactNode;
  messages: SpatialShellMessages; addIcon?: React.ReactNode; closeIcon?: React.ReactNode; style: React.CSSProperties;
}) {
  return (
    <div className="sp-pager" style={style}>
      {count > 1 && Array.from({ length: count }, (_, i) => <button key={i} type="button" className={cx("sp-pg-dot", i === at && "is-on")} onClick={() => onGo(i)} aria-label={messages.workspace(i)} />)}
      {onAdd && <button type="button" className="sp-pg-add" onClick={onAdd} title={messages.newWorkspace} aria-label={messages.newWorkspace}>{addIcon}</button>}
      {onClose && count > 1 && <button type="button" className="sp-pg-add" onClick={onClose} title={messages.closeWorkspace} aria-label={messages.closeWorkspace}>{closeIcon}</button>}
      {menu}
    </div>
  );
}

/** One surface: focus on press; in slot scope it also swipes through its own saved workspaces. */
function SlotView({ surface, multi, messages, hidden = false, arrangement }: { surface: Surface; multi: boolean; messages: SpatialShellMessages; hidden?: boolean; arrangement?: Arrangement }) {
  const { desktop, dispatch, swipeScope, emit, newSlotWorkspace, experiences, state, tokens } = useSpatial();
  const id = desktop.slots[surface.slot]?.experience, stack = slotStack(desktop, surface.slot), slotScope = swipeScope === "slot";
  const dirRef = React.useRef(0);
  const inner = useEnterAnimation(`${id}:${stack.at}`, dirRef.current);
  React.useEffect(() => { emit({ type: "experience", slot: surface.slot, id }); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const step = (dir: 1 | -1) => { dirRef.current = dir; dispatch({ type: "stepSlotWorkspace", slot: surface.slot, dir }); };
  const swipe = useSwipe(step, dir => stack.at + dir >= 0 && stack.at + dir < stack.saved.length);
  const workspaces = slotScope ? stack.saved : [desktop.slots[surface.slot]];
  const activeWorkspace = slotScope ? stack.at : 0;
  return (
    <div className={cx("sp-slot", multi && desktop.focus === surface.slot && "is-focus")} style={{ left: surface.x, top: surface.y, width: surface.w, height: surface.h, display: hidden ? "none" : undefined }}
      onPointerDown={e => { dispatch({ type: "focus", slot: surface.slot }); if (slotScope) swipe.begin(e, inner.current); }}
      onClickCapture={swipe.onClickCapture} data-slot={surface.slot}>
      <div ref={inner} className="sp-slot-inner">
        {workspaces.map((saved, index) => {
          const workspace = slotScope && index === activeWorkspace ? desktop.slots[surface.slot] : saved;
          const experience = experiences[workspace?.experience];
          const crease = surface.span && surface.crease ? surface.crease.at : null;
          const resolved = index === activeWorkspace ? arrangement : experience ? resolveArrangement(experience, surface, state, tokens, crease) : undefined;
          return <div key={index} style={{ position: "absolute", inset: 0, display: index === activeWorkspace ? undefined : "none" }}>
            {workspace && <ExperienceView surface={surface} arrangement={resolved} experienceId={workspace.experience} projectId={workspace.project}
              identity={`${desktop.id}/stack-${surface.slot}-${index}/${workspace.project ?? ""}/${workspace.experience}`} />}
          </div>;
        })}
      </div>
      {slotScope && <Pager count={stack.saved.length} at={stack.at} messages={messages} style={{ left: `calc(50% - ${surface.rail ? 20 : 0}px)`, top: surface.h - 30 }}
        onGo={i => { dirRef.current = Math.sign(i - stack.at); for (let k = stack.at; k !== i; k += Math.sign(i - k)) dispatch({ type: "stepSlotWorkspace", slot: surface.slot, dir: (Math.sign(i - k) as 1 | -1) }); }}
        onAdd={() => { dirRef.current = 1; dispatch({ type: "addSlotWorkspace", slot: surface.slot, workspace: newSlotWorkspace(surface.slot) }); }} />}
    </div>
  );
}

/** Keeps a slot's pane hosts mounted while a fold posture temporarily hides that surface. */
function PersistentSlotView({ slot, surface, multi, messages }: { slot: number; surface?: Surface; multi: boolean; messages: SpatialShellMessages }) {
  const { arrangements } = useSpatial();
  const lastSurface = React.useRef<Surface | undefined>(surface);
  const lastArrangement = React.useRef<Arrangement | undefined>(surface ? arrangements.get(slot) : undefined);
  if (surface) {
    lastSurface.current = surface;
    lastArrangement.current = arrangements.get(slot) ?? lastArrangement.current;
  }
  if (!lastSurface.current) return null;
  return <SlotView surface={lastSurface.current} arrangement={surface ? arrangements.get(slot) : lastArrangement.current} multi={multi} messages={messages} hidden={!surface} />;
}

function Crease({ axis, at, width, separating }: { axis: "vertical" | "horizontal"; at: number; width: number; separating: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  useFoldFrame(f => { if (ref.current) ref.current.style.opacity = lerp(1, 0.3, smooth(120, 180, f.angle)).toFixed(2); });   // reads less as the panel flattens
  const renderedWidth = separating ? width : 12;
  return <div ref={ref} className={cx("sp-crease", `is-${axis}`, separating && "is-separating")}
    style={axis === "vertical" ? { left: at - renderedWidth / 2, width: renderedWidth } : { top: at - renderedWidth / 2, height: renderedWidth }} />;
}

export function SpatialShell({ controls = {}, keyboard = true, className }: SpatialShellProps) {
  const sp = useSpatial(), { viewport, surfaces, posture, device, state, desktop, visibleFocus, dispatch, experiences, order, tokens, emit, swipeScope, newDesktop } = sp;
  const messages = React.useMemo<SpatialShellMessages>(() => ({ ...defaultMessages, ...controls.messages }), [controls.messages]);
  const [banners, setBanners] = React.useState<Record<string, boolean>>({});
  const ui = React.useMemo(() => ({
    banners,
    setBanner: (k: string, o: boolean) => setBanners(b => ({ ...b, [k]: o })),
    emptySurface: messages.emptySurface,
    dropLeft: messages.dropLeft,
    dropRight: messages.dropRight,
  }), [banners, messages.emptySurface, messages.dropLeft, messages.dropRight]);
  const [overviewOpen, setOverviewOpen] = React.useState(false);
  const command = React.useCallback((id: BuiltInShellCommand): ShellCommandPresentation => ({ ...defaultCommands[id], ...controls.commands?.[id] }), [controls.commands]);

  // ── desktops (device scope) ─────────────────────────────────────────
  const deskDir = React.useRef(0);
  const stageRef = useEnterAnimation(desktop.id, deskDir.current);
  const goDesktop = (i: number) => { deskDir.current = Math.sign(i - state.active); dispatch({ type: "switchDesktop", index: i }); };
  const addDesktop = () => { deskDir.current = 1; dispatch({ type: "addDesktop", desktop: newDesktop() }); };
  const deviceSwipe = useSwipe(dir => goDesktop(state.active + dir), dir => state.active + dir >= 0 && state.active + dir < state.desktops.length);

  const app = viewport.app, targets = handleTargets(posture, viewport, desktop.inner, visibleFocus);
  const book = posture.kind === "book", showL = book || state.hand === "left", showR = book || state.hand === "right";
  const focused = experiences[desktop.slots[visibleFocus]?.experience] ?? experiences[desktop.slots[0].experience];
  const actionContext: ShellActionContext = { state, desktop, posture, dispatch, emit, slot: visibleFocus, experience: focused.id };
  const actionValue = (value: ShellAction["active"] | ShellAction["disabled"]) => typeof value === "function" ? value(actionContext) : !!value;
  const actionDisabled = (action: ShellAction) => actionValue(action.disabled) || (!!action.experience && !experiences[action.experience]);
  const runAction = (action: ShellAction) => {
    if (actionDisabled(action)) return;
    if (action.experience) dispatch({ type: "setExperience", slot: visibleFocus, id: action.experience, force: action.force });
    action.onSelect?.({ ...actionContext, targetExperience: action.experience });
  };
  const allActions = [...(controls.actions ?? []), ...(controls.favorites ?? [])];
  const pinned = (controls.favorites ?? []).some(action => action.experience === focused.id);
  const closeDesktop = async () => {
    const allowed = controls.confirmCloseWorkspace
      ? await controls.confirmCloseWorkspace(actionContext)
      : typeof window === "undefined" || window.confirm(messages.closeWorkspaceConfirmation);
    if (!allowed) return;
    deskDir.current = -1;
    dispatch({ type: "closeDesktop", index: state.active });
  };

  const spatialItems = (): FlyoutItem[] => [
    ...order.map(id => experiences[id]).map(e => ({ id: e.id, label: e.label, code: e.code, color: e.accent })),
    ...(controls.favorites ?? []).map(action => ({ id: `favorite:${action.id}`, label: action.label, icon: action.icon, code: action.code, color: action.color ?? "#fbbf24", ring: 2 as const })),
  ];
  const pick = (slot: number, viaLeftHandle: boolean) => (it: FlyoutItem) => {
    if (it.id.startsWith("favorite:")) return runAction((controls.favorites ?? []).find(action => action.id === it.id.slice(9))!);
    dispatch({ type: "setExperience", slot, id: it.id, viaLeftHandle });
  };
  const contextItems = (): FlyoutItem[] => {
    const builtIn = (id: string, commandId: BuiltInShellCommand): FlyoutItem[] => {
      const presentation = command(commandId);
      return presentation.hidden ? [] : [{ id, label: presentation.label, icon: presentation.icon, color: presentation.color }];
    };
    return [
      ...postureActions(focused, posture.kind).map(action => ({ id: action.id, label: action.label, icon: action.icon, code: action.glyph, color: focused.accent })),
      ...(book ? builtIn("sys:inner", desktop.inner === "span" ? "split" : "span") : []),
      ...(book ? builtIn("sys:swap", "swap") : []),
      ...(swipeScope === "device" ? builtIn("sys:new", "newDesktop") : []),
      ...(swipeScope === "device" && state.desktops.length > 1 ? builtIn("sys:close", "closeDesktop") : []),
      ...(controls.onFavoriteExperienceChange ? builtIn("sys:favorite", pinned ? "unfavorite" : "favorite") : []),
    ];
  };
  const onContext = (it: FlyoutItem) => {
    if (it.id === "sys:inner") return dispatch({ type: "setInner", inner: desktop.inner === "span" ? "split" : "span" });
    if (it.id === "sys:swap") return dispatch({ type: "swapHalves" });
    if (it.id === "sys:new") return addDesktop();
    if (it.id === "sys:close") return void closeDesktop();
    if (it.id === "sys:favorite") return controls.onFavoriteExperienceChange?.({ experience: focused, pinned: !pinned, context: actionContext });
    postureActions(focused, posture.kind).find(a => a.id === it.id)?.run?.({ slot: visibleFocus, experience: focused.id, posture: posture.kind });
    emit({ type: "action", experience: focused.id, action: it.id, slot: visibleFocus });
  };

  const left = useEdgeFlyout({ side: "left", region: targets.left.region, items: spatialItems, current: desktop.slots[targets.left.slot]?.experience, onSelect: pick(targets.left.slot, true), tapToggle: true });
  const right = useEdgeFlyout({ side: "right", region: targets.right.region, items: spatialItems, current: desktop.slots[targets.right.slot]?.experience, onSelect: pick(targets.right.slot, false), tapToggle: true });
  const context = useEdgeFlyout({ side: "right", region: targets.right.region, items: contextItems, onSelect: onContext });
  const workspaceItems = (): FlyoutItem[] => {
    const item = (id: string, commandId: BuiltInShellCommand): FlyoutItem[] => {
      const presentation = command(commandId);
      return presentation.hidden ? [] : [{ id, label: presentation.label, icon: presentation.icon, color: presentation.color }];
    };
    return [
      ...item(desktop.inner === "span" ? "workspace:divide" : "workspace:merge", desktop.inner === "span" ? "divide" : "merge"),
      ...item("workspace:overview", "overview"),
      ...item("workspace:lock", desktop.locked ? "unlock" : "lock"),
    ];
  };
  const onWorkspaceMenu = (item: FlyoutItem) => {
    if (item.id === "workspace:divide") { dispatch({ type: "setInner", inner: "split" }); dispatch({ type: "setSwipeScope", scope: "slot" }); }
    if (item.id === "workspace:merge") { dispatch({ type: "setInner", inner: "span" }); dispatch({ type: "setSwipeScope", scope: "device" }); }
    if (item.id === "workspace:overview") setOverviewOpen(true);
    if (item.id === "workspace:lock") dispatch({ type: "setLocked", locked: !desktop.locked });
  };
  const workspaceMenu = useEdgeFlyout({ side: "right", region: app, items: workspaceItems, onSelect: onWorkspaceMenu, current: desktop.locked ? "workspace:lock" : undefined });

  React.useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input,textarea,select,[contenteditable]")) return;
      const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (dir && swipeScope === "device") goDesktop(state.active + dir);
      if (dir && swipeScope === "slot") dispatch({ type: "stepSlotWorkspace", slot: visibleFocus, dir });
      if (e.key === "[") (showL ? left : right).toggle();
      if (e.key === "]") context.toggle();
      if (e.key === "Escape") { left.close(); right.close(); context.close(); }
    };
    addEventListener("keydown", onKey); return () => removeEventListener("keydown", onKey);
  });

  const gy = app.y + Math.min(app.h * tokens.handlePosition, app.h - 180) - 50;
  const glow = (side: "left" | "right", ctl: typeof left, x: number, y = gy) => (
    <div className={cx("sp-glow", `is-${side}`)} style={{ left: x, top: y }} title={messages.experiences}
      onClickCapture={ctl.handleProps.onClickCapture} onPointerDown={e => { e.stopPropagation(); ctl.handleProps.onPointerDown?.(e); }}><i /></div>
  );
  const actionButton = (action: ShellAction, style?: React.CSSProperties) => (
    <button key={action.id} type="button" className={cx(device.chrome === "floating" ? "sp-fab" : "sp-ib", (actionValue(action.active) || action.experience === focused.id) && "is-on")}
      style={style} title={action.label} aria-label={action.label} disabled={actionDisabled(action)} onClick={() => runAction(action)}>{action.icon}</button>
  );
  const leadingActions = allActions.filter(action => action.placement === "leading");
  const trailingActions = allActions.filter(action => action.placement !== "leading");
  const railX = app.x + app.w - 40;
  const slotIds = [...new Set([...desktop.slots.map((_, slot) => slot), ...surfaces.map(surface => surface.slot)])];

  return (
    <PaneHostProvider>
    <ShellUiContext.Provider value={ui}>
      <div className={cx("sp-shell", className)} style={{ width: viewport.w, height: viewport.h, ...(physicsCssVars(tokens) as React.CSSProperties) }} data-posture={posture.kind}>
        <GooFilter />
        <div ref={stageRef} className="sp-stage" onClickCapture={deviceSwipe.onClickCapture}
          onPointerDown={e => { if (swipeScope === "device") deviceSwipe.begin(e, stageRef.current); }}>
          {slotIds.map(slot => <PersistentSlotView key={`${desktop.id}:${slot}`} slot={slot} surface={surfaces.find(surface => surface.slot === slot)} multi={surfaces.length > 1} messages={messages} />)}
        </div>
        {viewport.crease && <Crease {...viewport.crease} />}
        {viewport.deck && <HalfFoldDeck rect={viewport.deck} experience={focused} />}
        <div className="sp-chrome">
          <Pager count={state.desktops.length} at={state.active} onGo={goDesktop} onAdd={command("newDesktop").hidden ? undefined : addDesktop} onClose={command("closeDesktop").hidden ? undefined : closeDesktop} messages={messages}
            addIcon={command("newDesktop").icon} closeIcon={command("closeDesktop").icon}
            menu={device.kind === "foldable" && !command("workspaceOptions").hidden ? <button type="button" className={cx("sp-pg-add", desktop.locked && "is-on")} onClick={workspaceMenu.toggle} title={messages.workspaceOptions} aria-label={messages.workspaceOptions}>{command("workspaceOptions").icon}</button> : undefined}
            style={{ left: app.x + (app.w - (device.chrome === "rail" ? 40 : 0)) / 2, top: app.y + app.h - 30 }} />
          {device.chrome === "rail" ? (
            <div className="sp-rail" style={{ left: railX, top: app.y, height: app.h }} {...context.handleProps}>
              {showR && glow("right", right, 0, gy - app.y)}
              {allActions.map(action => actionButton(action))}
            </div>
          ) : <>
            {leadingActions.map((action, index) => actionButton(action, { left: app.x + 14 + index * 48, top: app.y + 12 }))}
            {trailingActions.map((action, index) => actionButton(action, { left: app.x + app.w - 54 - (trailingActions.length - index - 1) * 48, top: app.y + 12 }))}
            <div className="sp-edge" style={{ left: app.x + app.w - 26, top: app.y + 72, height: app.h - 144 }} {...context.handleProps}><i /></div>
            {showR && glow("right", right, app.x + app.w - 40)}
          </>}
          {showL && glow("left", left, (targets.left.region as Rect).x)}
          <div className="sp-overlays">{left.overlay}{right.overlay}{context.overlay}{workspaceMenu.overlay}</div>
          {overviewOpen && <div className="sp-overview" role="dialog" aria-modal="true" aria-label={messages.workspaceOverview}>
            <div className="sp-overview-head"><div><strong>{messages.workspaceOverview}</strong><span>{desktop.name ?? messages.workspace(state.active)}{desktop.locked ? ` · ${messages.locked}` : ""}</span></div><button type="button" onClick={() => setOverviewOpen(false)} aria-label={messages.closeOverview}>{command("closeDesktop").icon}</button></div>
            <div className="sp-overview-grid">
              {desktop.slots.map((slot, index) => {
                const experience = experiences[slot.experience], stack = slotStack(desktop, index);
                return <button type="button" key={index} onClick={() => { dispatch({ type: "focus", slot: index }); setOverviewOpen(false); }}>
                  <span>{messages.screen(index)}</span><strong>{experience?.label ?? slot.experience}</strong><small>{messages.viewCount(stack.saved.length)}{slot.project ? ` · ${slot.project}` : ""}</small>
                </button>;
              })}
            </div>
          </div>}
        </div>
      </div>
    </ShellUiContext.Provider>
    </PaneHostProvider>
  );
}
