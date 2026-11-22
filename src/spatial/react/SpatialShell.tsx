import * as React from "react";
import { handleTargets, type Rect, type Surface } from "../device";
import { chatPlacement, postureActions, type ChatPlacement } from "../experience";
import { lerp, smooth } from "../physics";
import { slotStack } from "../state";
import { physicsCssVars } from "../tokens";
import { useFoldFrame, useSpatial } from "./context";
import { useEdgeFlyout, type FlyoutItem } from "./EdgeFlyout";
import { ExperienceView, ShellUiContext, bannerKey, cx } from "./ExperienceView";
import { GooFilter } from "./FoldTransition";
import { HalfFoldDeck } from "./HalfFoldDeck";
import { OverlayPanel } from "./OverlayPanel";

const Icon = {
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  chat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z" /></svg>,
  account: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
};

export type ShellControls = {
  onSearch?: () => void;
  onAccount?: () => void;
  /** Overlay chat content, shown when no chat pane already occupies screen space. */
  chat?: React.ReactNode;
  icons?: Partial<typeof Icon>;
};

export type SpatialShellProps = {
  controls?: ShellControls;
  /** Global keyboard shortcuts: ←/→ switch desktops, [ / ] open flyouts, Esc closes. */
  keyboard?: boolean;
  className?: string;
};

const INTERACTIVE = "button,input,select,textarea,a,[role=separator],.sp-win,.sp-banner,.sp-mk,.sp-flow-item,.sp-pager";

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
function Pager({ count, at, onGo, onAdd, onClose, style }: { count: number; at: number; onGo: (i: number) => void; onAdd: () => void; onClose?: () => void; style: React.CSSProperties }) {
  return (
    <div className="sp-pager" style={style}>
      {count > 1 && Array.from({ length: count }, (_, i) => <button key={i} type="button" className={cx("sp-pg-dot", i === at && "is-on")} onClick={() => onGo(i)} aria-label={`Workspace ${i + 1}`} />)}
      <button type="button" className="sp-pg-add" onClick={onAdd} title="New workspace">＋</button>
      {onClose && count > 1 && <button type="button" className="sp-pg-add" onClick={onClose} title="Close workspace">−</button>}
    </div>
  );
}

/** One surface: focus on press; in slot scope it also swipes through its own saved workspaces. */
function SlotView({ surface, multi }: { surface: Surface; multi: boolean }) {
  const { desktop, dispatch, swipeScope, emit, newSlotWorkspace } = useSpatial();
  const id = desktop.slots[surface.slot]?.experience, stack = slotStack(desktop, surface.slot), slotScope = swipeScope === "slot";
  const dirRef = React.useRef(0);
  const inner = useEnterAnimation(`${id}:${stack.at}`, dirRef.current);
  React.useEffect(() => { emit({ type: "experience", slot: surface.slot, id }); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const step = (dir: 1 | -1) => { dirRef.current = dir; dispatch({ type: "stepSlotWorkspace", slot: surface.slot, dir }); };
  const swipe = useSwipe(step, dir => stack.at + dir >= 0 && stack.at + dir < stack.saved.length);
  return (
    <div className={cx("sp-slot", multi && desktop.focus === surface.slot && "is-focus")} style={{ left: surface.x, top: surface.y, width: surface.w, height: surface.h }}
      onPointerDown={e => { dispatch({ type: "focus", slot: surface.slot }); if (slotScope) swipe.begin(e, inner.current); }}
      onClickCapture={swipe.onClickCapture} data-slot={surface.slot}>
      <div ref={inner} className="sp-slot-inner"><ExperienceView surface={surface} /></div>
      {slotScope && <Pager count={stack.saved.length} at={stack.at} style={{ left: `calc(50% - ${surface.rail ? 20 : 0}px)` }}
        onGo={i => { dirRef.current = Math.sign(i - stack.at); for (let k = stack.at; k !== i; k += Math.sign(i - k)) dispatch({ type: "stepSlotWorkspace", slot: surface.slot, dir: (Math.sign(i - k) as 1 | -1) }); }}
        onAdd={() => { dirRef.current = 1; dispatch({ type: "addSlotWorkspace", slot: surface.slot, workspace: newSlotWorkspace(surface.slot) }); }} />}
    </div>
  );
}

function Crease({ axis, at }: { axis: "vertical" | "horizontal"; at: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  useFoldFrame(f => { if (ref.current) ref.current.style.opacity = lerp(1, 0.3, smooth(120, 180, f.angle)).toFixed(2); });   // reads less as the panel flattens
  return <div ref={ref} className={cx("sp-crease", `is-${axis}`)} style={axis === "vertical" ? { left: at - 6 } : { top: at - 6 }} />;
}

export function SpatialShell({ controls = {}, keyboard = true, className }: SpatialShellProps) {
  const sp = useSpatial(), { viewport, surfaces, posture, device, state, desktop, arrangements, dispatch, experiences, order, tokens, emit, swipeScope, newDesktop } = sp;
  const icons = { ...Icon, ...controls.icons };
  const [banners, setBanners] = React.useState<Record<string, boolean>>({});
  const ui = React.useMemo(() => ({ banners, setBanner: (k: string, o: boolean) => setBanners(b => ({ ...b, [k]: o })) }), [banners]);
  const [chatOpen, setChatOpen] = React.useState(false);

  // ── desktops (device scope) ─────────────────────────────────────────
  const deskDir = React.useRef(0);
  const stageRef = useEnterAnimation(desktop.id, deskDir.current);
  const goDesktop = (i: number) => { deskDir.current = Math.sign(i - state.active); dispatch({ type: "switchDesktop", index: i }); };
  const addDesktop = () => { deskDir.current = 1; dispatch({ type: "addDesktop", desktop: newDesktop() }); };
  const closeDesktop = () => { deskDir.current = -1; dispatch({ type: "closeDesktop", index: state.active }); };
  const deviceSwipe = useSwipe(dir => goDesktop(state.active + dir), dir => state.active + dir >= 0 && state.active + dir < state.desktops.length);

  const app = viewport.app, targets = handleTargets(posture, viewport, desktop.inner, desktop.focus);
  const book = posture.kind === "book", showL = book || state.hand === "left", showR = book || state.hand === "right";
  const focused = experiences[desktop.slots[desktop.focus]?.experience] ?? experiences[desktop.slots[0].experience];

  const spatialItems = (): FlyoutItem[] => [
    ...order.map(id => experiences[id]).map(e => ({ id: e.id, label: e.label, code: e.code, color: e.accent })),
    ...state.pairs.slice(-4).map(p => ({ id: `pair:${state.pairs.indexOf(p)}`, label: `★ ${p.name}`, code: "★", color: "#fbbf24", ring: 2 as const })),
    { id: "save", label: "Save current pair", code: "＋", color: "#fbbf24", ring: 2 },
  ];
  const pick = (slot: number, viaLeftHandle: boolean) => (it: FlyoutItem) => {
    if (it.id === "save") {
      const name = [desktop.slots[1], desktop.slots[0]].map(s => experiences[s?.experience]?.label ?? "—").join(" ⇄ ");
      dispatch({ type: "savePair", name }); return emit({ type: "pair-saved", name });
    }
    if (it.id.startsWith("pair:")) {
      const pair = state.pairs[+it.id.slice(5)]; dispatch({ type: "applyPair", pair });
      return emit({ type: "pair-applied", name: pair.name, needsUnfold: posture.kind === "cover" || posture.kind === "single" });
    }
    dispatch({ type: "setExperience", slot, id: it.id, viaLeftHandle });
  };
  const contextItems = (): FlyoutItem[] => {
    const sys = [
      ...(book ? [{ id: "sys:inner", label: desktop.inner === "span" ? "Split halves" : "Span inner", glyph: desktop.inner === "span" ? "◫" : "▭" }, { id: "sys:swap", label: "Swap halves", glyph: "⇄" }] : []),
      ...(swipeScope === "device" ? [{ id: "sys:new", label: "New desktop", glyph: "＋" }, ...(state.desktops.length > 1 ? [{ id: "sys:close", label: "Close desktop", glyph: "−" }] : [])] : []),
    ];
    return [...postureActions(focused, posture.kind), ...sys].map(a => ({ id: a.id, label: a.label, code: a.glyph ?? "•", color: focused.accent }));
  };
  const onContext = (it: FlyoutItem) => {
    if (it.id === "sys:inner") return dispatch({ type: "setInner", inner: desktop.inner === "span" ? "split" : "span" });
    if (it.id === "sys:swap") return dispatch({ type: "swapHalves" });
    if (it.id === "sys:new") return addDesktop();
    if (it.id === "sys:close") return closeDesktop();
    postureActions(focused, posture.kind).find(a => a.id === it.id)?.run?.({ slot: desktop.focus, experience: focused.id, posture: posture.kind });
    emit({ type: "action", experience: focused.id, action: it.id, slot: desktop.focus });
  };

  const left = useEdgeFlyout({ side: "left", region: targets.left.region, items: spatialItems, current: desktop.slots[targets.left.slot]?.experience, onSelect: pick(targets.left.slot, true), tapToggle: true });
  const right = useEdgeFlyout({ side: "right", region: targets.right.region, items: spatialItems, current: desktop.slots[targets.right.slot]?.experience, onSelect: pick(targets.right.slot, false), tapToggle: true });
  const context = useEdgeFlyout({ side: "right", region: targets.right.region, items: contextItems, onSelect: onContext });

  // Chat already on screen? Focused surface first.
  const chats = [...surfaces].sort((a, b) => +(b.slot === desktop.focus) - +(a.slot === desktop.focus)).flatMap(s => {
    const exp = experiences[desktop.slots[s.slot]?.experience], arr = arrangements.get(s.slot);
    if (!exp || !arr || exp.render) return [];
    const placement = chatPlacement(exp, arr, state);
    return placement ? [{ s, exp, placement }] : [];
  });
  const chatOn = chatOpen || chats.some(c => (["half", "tab", "banner"] as ChatPlacement[]).includes(c.placement));
  const toggleChat = () => {
    const c = chats[0];
    if (chatOpen || !c) return setChatOpen(o => !o);
    const chatId = c.exp.panes.find(p => p.role === "chat")!.id;
    if (c.placement === "banner") { const k = bannerKey(c.s.slot, c.exp.id, chatId); return ui.setBanner(k, !banners[k]); }
    dispatch({ type: "toggleChat", experience: c.exp.id, placement: c.placement, chatIndex: c.exp.panes.findIndex(p => p.id === chatId) });
  };

  React.useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input,textarea,select,[contenteditable]")) return;
      const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (dir && swipeScope === "device") goDesktop(state.active + dir);
      if (dir && swipeScope === "slot") dispatch({ type: "stepSlotWorkspace", slot: desktop.focus, dir });
      if (e.key === "[") (showL ? left : right).toggle();
      if (e.key === "]") context.toggle();
      if (e.key === "Escape") { left.close(); right.close(); context.close(); }
    };
    addEventListener("keydown", onKey); return () => removeEventListener("keydown", onKey);
  });

  const gy = app.y + Math.min(app.h * tokens.handlePosition, app.h - 180) - 50;
  const glow = (side: "left" | "right", ctl: typeof left, x: number, y = gy) => (
    <div className={cx("sp-glow", `is-${side}`)} style={{ left: x, top: y }} title="Experiences"
      onClickCapture={ctl.handleProps.onClickCapture} onPointerDown={e => { e.stopPropagation(); ctl.handleProps.onPointerDown?.(e); }}><i /></div>
  );
  const btn = (a: "search" | "chat" | "account", style?: React.CSSProperties) => (
    <button type="button" className={cx(device.chrome === "floating" ? "sp-fab" : "sp-ib", a === "chat" && chatOn && "is-on")} style={style} title={a}
      onClick={a === "chat" ? toggleChat : a === "search" ? controls.onSearch : controls.onAccount}>{icons[a]}</button>
  );
  const railX = app.x + app.w - 40;

  return (
    <ShellUiContext.Provider value={ui}>
      <div className={cx("sp-shell", className)} style={{ width: viewport.w, height: viewport.h, ...(physicsCssVars(tokens) as React.CSSProperties) }} data-posture={posture.kind}>
        <GooFilter />
        <div ref={stageRef} className="sp-stage" onClickCapture={deviceSwipe.onClickCapture}
          onPointerDown={e => { if (swipeScope === "device") deviceSwipe.begin(e, stageRef.current); }}>
          {surfaces.map(s => <SlotView key={s.slot} surface={s} multi={surfaces.length > 1} />)}
        </div>
        {viewport.crease && <Crease axis={viewport.crease.axis} at={viewport.crease.at} />}
        {viewport.deck && <HalfFoldDeck rect={viewport.deck} experience={focused} />}
        <div className="sp-chrome">
          {swipeScope === "device" && <Pager count={state.desktops.length} at={state.active} onGo={goDesktop} onAdd={addDesktop} onClose={closeDesktop}
            style={{ left: app.x + (app.w - (device.chrome === "rail" ? 40 : 0)) / 2, top: app.y + app.h - 30 }} />}
          {device.chrome === "rail" ? (
            <div className="sp-rail" style={{ left: railX, top: app.y, height: app.h }} {...context.handleProps}>
              {showR && glow("right", right, 0, gy - app.y)}
              {btn("search")}{btn("chat")}{btn("account")}
            </div>
          ) : <>
            {btn("account", { left: app.x + 14, top: app.y + 12 })}
            {btn("search", { left: app.x + app.w - 102, top: app.y + 12 })}
            {btn("chat", { left: app.x + app.w - 54, top: app.y + 12 })}
            <div className="sp-edge" style={{ left: app.x + app.w - 26, top: app.y + 72, height: app.h - 144 }} {...context.handleProps}><i /></div>
            {showR && glow("right", right, app.x + app.w - 40)}
          </>}
          {showL && glow("left", left, (targets.left.region as Rect).x)}
          <div className="sp-overlays">{left.overlay}{right.overlay}{context.overlay}</div>
          <OverlayPanel open={chatOpen} onClose={() => setChatOpen(false)} title="Chat" subtitle={focused.label}
            initial={{ x: app.x + app.w - (device.chrome === "rail" ? 340 : 300), y: Math.max(app.y + 60, app.y + app.h - 420) }}>
            {controls.chat}
          </OverlayPanel>
        </div>
      </div>
    </ShellUiContext.Provider>
  );
}
