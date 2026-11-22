import * as React from "react";
import { createPortal } from "react-dom";
import type { Surface } from "../device";
import type { Arrangement, ExperienceSpec, PaneContext, PaneSpec, WindowRect } from "../experience";
import { clamp } from "../physics";
import { useSpatial } from "./context";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const cssVar = (name: string, v: string | undefined) => (v ? ({ [name]: v } as React.CSSProperties) : undefined);

/** Shell-level UI state that chrome and views share (banner drop-downs). */
type ShellUi = { banners: Record<string, boolean>; setBanner: (key: string, open: boolean) => void; emptySurface: string; dropLeft: string; dropRight: string };
export const ShellUiContext = React.createContext<ShellUi>({ banners: {}, setBanner: () => {}, emptySurface: "Content is already visible on another surface.", dropLeft: "left", dropRight: "right" });
export const bannerKey = (slot: number, exp: string, pane: string) => `${slot}:${exp}:${pane}`;

type PaneHosts = { get(key: string): HTMLElement | undefined };
const PaneHostContext = React.createContext<PaneHosts | null>(null);

export function PaneHostProvider({ children }: { children: React.ReactNode }) {
  const hosts = React.useRef(new Map<string, HTMLElement>());
  const value = React.useMemo<PaneHosts>(() => ({
    get(key) {
      if (typeof document === "undefined") return undefined;
      let host = hosts.current.get(key);
      if (!host) {
        host = document.createElement("div");
        host.className = "sp-pane-host";
        host.dataset.paneHost = key;
        hosts.current.set(key, host);
      }
      return host;
    },
  }), []);
  return <PaneHostContext.Provider value={value}>{children}</PaneHostContext.Provider>;
}

export const usePaneHost = (key: string | null) => {
  const registry = React.useContext(PaneHostContext);
  return key ? registry?.get(key) : undefined;
};

function PaneHost({ host, fallback }: { host?: HTMLElement; fallback: () => React.ReactNode }) {
  const attach = React.useCallback((element: HTMLDivElement | null) => {
    if (element && host && host.parentElement !== element) element.appendChild(host);
  }, [host]);
  return <div ref={attach} className="sp-pane-b">{host ? null : fallback()}</div>;
}

export function PaneFrame({ spec, ctx, className, host }: { spec: PaneSpec; ctx: PaneContext; className?: string; host?: HTMLElement }) {
  return (
    <section className={cx("sp-pane", className)} style={cssVar("--c", spec.color)} data-pane={spec.id}>
      <header className="sp-pane-h"><i />{spec.title}{spec.badge && <em>{spec.badge}</em>}</header>
      <PaneHost host={host} fallback={() => spec.render(ctx)} />
    </section>
  );
}

export function PaneBanner({ spec, ctx, open, onToggle, host }: { spec: PaneSpec; ctx: PaneContext; open: boolean; onToggle: () => void; host?: HTMLElement }) {
  return (
    <div className={cx("sp-banner", open && "is-open")} style={cssVar("--c", spec.color)} onClick={onToggle} data-pane={spec.id}>
      <span className="sp-bn-k">{spec.short ?? spec.title}</span>
      <span className="sp-bn-t">{spec.banner?.(ctx) ?? spec.summary ?? spec.title}</span>
      <span className="sp-bn-x">{spec.expandIcon ?? "⌄"}</span>
      <div className="sp-bn-drop" onClick={e => e.stopPropagation()}>{open && <PaneHost host={host} fallback={() => spec.render({ ...ctx, condensed: true })} />}</div>
    </div>
  );
}

export function ExperienceHeader({ exp, slot, surface, projectId }: { exp: ExperienceSpec; slot: number; surface: Surface; projectId?: string }) {
  const { posture } = useSpatial();
  if (exp.header === false) return null;
  if (exp.header) return <>{exp.header({ experience: exp, slot, surface, posture: posture.kind, scopeId: projectId })}</>;
  return (
    <div className="sp-desk-head">
      <span className="sp-chip" style={cssVar("--c", exp.accent)}>{exp.label}</span>
    </div>
  );
}

type MarkerDrag = { id: string; x: number; y: number; hot: { id: string; side: "L" | "R" } | null };

/** Page-marker tabs. Tap to switch; drag one onto another to put both panes across the two halves. */
export function PageMarkers({ panes, active, side, onSelect, onMerge }: {
  panes: PaneSpec[]; active: number; side: "left" | "right"; onSelect: (i: number) => void; onMerge: (left: string, right: string) => void;
}) {
  const [drag, setDrag] = React.useState<MarkerDrag | null>(null);
  const ui = React.useContext(ShellUiContext);
  const begin = (e: React.PointerEvent, p: PaneSpec, i: number) => {
    const x0 = e.clientX, y0 = e.clientY; let cur: MarkerDrag | null = null;
    const move = (ev: PointerEvent) => {
      if (!cur && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-drop]");
      cur = { id: p.id, x: ev.clientX, y: ev.clientY, hot: el ? { id: el.dataset.pane!, side: el.dataset.drop as "L" | "R" } : null };
      setDrag(cur);
    };
    const up = () => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", up);
      setDrag(null);
      if (!cur) return onSelect(i);
      if (cur.hot) cur.hot.side === "L" ? onMerge(p.id, cur.hot.id) : onMerge(cur.hot.id, p.id);
    };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  };
  return (
    <div className={cx("sp-markers", side === "left" && "is-left")}>
      {panes.map((p, i) => (
        <button key={p.id} type="button" className={cx("sp-mk", i === active && "is-on")} style={cssVar("--c", p.color)} onPointerDown={e => begin(e, p, i)}>
          {p.short ?? p.title}
          {drag && drag.id !== p.id && (
            <span className="sp-mk-drop">
              {(["L", "R"] as const).map(sd => (
                <b key={sd} data-drop={sd} data-pane={p.id} className={cx(drag.hot?.id === p.id && drag.hot.side === sd && "is-hot")}>{sd === "L" ? `◧ ${ui.dropLeft}` : `${ui.dropRight} ◨`}</b>
              ))}
            </span>
          )}
        </button>
      ))}
      {drag && <div className="sp-mk-ghost" style={{ transform: `translate(${drag.x + 8}px,${drag.y + 8}px)`, ...cssVar("--c", panes.find(p => p.id === drag.id)?.color) }}>
        {panes.find(p => p.id === drag.id)?.short}</div>}
    </div>
  );
}

function SplitBody({ surface, expId, ratio, snap, axis, padLeft, padTop, left, right }: {
  surface: Surface; expId: string; ratio: number; snap: number | null; axis: "vertical" | "horizontal"; padLeft: number; padTop: number; left: React.ReactNode; right: React.ReactNode;
}) {
  const { tokens, scale, dispatch } = useSpatial();
  const body = React.useRef<HTMLDivElement>(null);
  const dividerWidth = surface.occlusion ? Math.max(14, axis === "vertical" ? surface.occlusion.w : surface.occlusion.h) : 14;
  const tracks = (r: number) => `${Math.max(0, r * (axis === "vertical" ? surface.w : surface.h) - (axis === "vertical" ? padLeft : body.current?.offsetTop ?? padTop) - dividerWidth / 2)}px ${dividerWidth}px minmax(0,1fr)`;
  React.useLayoutEffect(() => {
    if (axis === "horizontal" && body.current) body.current.style.gridTemplateRows = tracks(ratio);
  }, [axis, ratio, surface.h, dividerWidth]); // eslint-disable-line react-hooks/exhaustive-deps
  const onPointerDown = (e: React.PointerEvent) => {
    if (surface.crease?.separating) return;
    e.stopPropagation();
    let r = ratio;
    const move = (ev: PointerEvent) => {
      const desk = body.current?.closest(".sp-desk"); if (!desk || !body.current) return;
      const bounds = desk.getBoundingClientRect();
      r = clamp(((axis === "vertical" ? ev.clientX - bounds.left : ev.clientY - bounds.top) / scale) / (axis === "vertical" ? surface.w : surface.h), tokens.dividerMin, tokens.dividerMax);
      if (snap != null && Math.abs(r - snap) < tokens.creaseSnap) r = snap;   // magnetic to the crease
      if (axis === "vertical") body.current.style.gridTemplateColumns = tracks(r);
      else body.current.style.gridTemplateRows = tracks(r);
    };
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); dispatch({ type: "setRatio", experience: expId, ratio: r }); };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  };
  return (
    <div ref={body} className={cx("sp-two", axis === "horizontal" && "is-horizontal")} style={axis === "vertical" ? { gridTemplateColumns: tracks(ratio) } : { gridTemplateRows: tracks(ratio) }}>
      <div className="sp-col">{left}</div>
      <div className={cx("sp-divider", axis === "horizontal" && "is-horizontal")} onPointerDown={onPointerDown} role="separator" aria-orientation={axis}><i /></div>
      <div className="sp-col">{right}</div>
    </div>
  );
}

export function FreeCanvas({ windows, panes, ctx, hosts, onCommit }: { windows: WindowRect[]; panes: PaneSpec[]; ctx: PaneContext; hosts?: Map<string, HTMLElement | undefined>; onCommit: (w: WindowRect[]) => void }) {
  const [wins, setWins] = React.useState(windows);
  const [order, setOrder] = React.useState(() => windows.map((_, i) => i));
  React.useEffect(() => setWins(windows), [windows]);
  const start = (e: React.PointerEvent, i: number, mode: "move" | "size") => {
    e.stopPropagation();
    setOrder(o => [...o.filter(x => x !== i), i]);
    const cv = (e.currentTarget as HTMLElement).closest(".sp-canvas")!.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, w0 = wins[i];
    let next = wins;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / cv.width * 100, dy = (ev.clientY - y0) / cv.height * 100;
      const w = mode === "move" ? { ...w0, x: clamp(w0.x + dx, 0, 100 - w0.w), y: clamp(w0.y + dy, 0, 100 - w0.h) }
        : { ...w0, w: clamp(w0.w + dx, 15, 100 - w0.x), h: clamp(w0.h + dy, 12, 100 - w0.y) };
      next = wins.map((x, j) => (j === i ? w : x)); setWins(next);
    };
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); onCommit(next); };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  };
  return (
    <div className="sp-canvas">
      {wins.map((w, i) => {
        const p = panes.find(x => x.id === w.pane); if (!p) return null;
        return (
          <div key={i} className="sp-win" style={{ left: `${w.x}%`, top: `${w.y}%`, width: `${w.w}%`, height: `${w.h}%`, zIndex: order.indexOf(i) + 1 }}
            onPointerDown={() => setOrder(o => [...o.filter(x => x !== i), i])}>
            <div className="sp-win-h" style={cssVar("--c", p.color)} onPointerDown={e => start(e, i, "move")}><i />{p.title}</div>
            <PaneHost host={hosts?.get(p.id)} fallback={() => p.render(ctx)} />
            <span className="sp-win-rz" onPointerDown={e => start(e, i, "size")} />
          </div>
        );
      })}
    </div>
  );
}

/** Renders one experience on one surface according to its device-resolved arrangement. */
export function ExperienceView({ surface, arrangement, experienceId, projectId, identity }: {
  surface: Surface; arrangement?: Arrangement; experienceId?: string; projectId?: string; identity?: string;
}) {
  const { experiences, desktop, arrangements, posture, viewport, visibleFocus, dispatch, emit } = useSpatial();
  const ui = React.useContext(ShellUiContext);
  const registry = React.useContext(PaneHostContext);
  const exp = experiences[experienceId ?? desktop.slots[surface.slot]?.experience], arr = arrangement ?? arrangements.get(surface.slot);
  if (!exp || !arr) return null;
  if (exp.render) return <>{exp.render({ slot: surface.slot, surface, posture: posture.kind, span: surface.span })}</>;

  const byId = (id: string) => exp.panes.find(p => p.id === id)!;
  const ctx: PaneContext = { experience: exp.id, slot: surface.slot, surface, posture: posture.kind, condensed: false };
  const project = projectId ?? desktop.slots[surface.slot]?.project;
  const hostIdentity = identity ?? `${desktop.id}/${project ?? ""}/${surface.slot}/${exp.id}`;
  const hosts = new Map(exp.panes.map(pane => [pane.id, registry?.get(`${hostIdentity}/${pane.id}`)]));
  const pad = { top: surface.floating ? 62 : 16, right: surface.rail ? 46 : 16, left: 16 };
  const banner = (id: string) => {
    const k = bannerKey(surface.slot, exp.id, id);
    return <PaneBanner key={id} spec={byId(id)} ctx={ctx} host={hosts.get(id)} open={!!ui.banners[k]} onToggle={() => ui.setBanner(k, !ui.banners[k])} />;
  };
  const frame = (id: string, small = false) => <PaneFrame key={id} spec={byId(id)} ctx={ctx} host={hosts.get(id)} className={small ? "is-small" : undefined} />;

  let body: React.ReactNode;
  switch (arr.kind) {
    case "free": body = <FreeCanvas windows={arr.windows} panes={exp.panes} ctx={ctx} hosts={hosts} onCommit={w => dispatch({ type: "setWindows", key: arr.key, windows: w })} />; break;
    case "single": body = frame(arr.pane); break;
    case "stack": body = arr.panes.map((id, i) => frame(id, i > 0)); break;
    case "banner": body = <>{arr.banners.map(banner)}{frame(arr.primary)}</>; break;
    case "two":
      body = <SplitBody surface={surface} expId={exp.id} ratio={arr.ratio} snap={arr.snap} axis={arr.axis} padLeft={pad.left} padTop={pad.top}
        left={frame(arr.left)} right={<>{arr.banners.map(banner)}{arr.right.map(id => frame(id))}</>} />;
      break;
    case "tabs":
      body = <>
        <div className="sp-tab-slots">{arr.panes.map((id, i) => <div key={id} className={cx("sp-tab-slot", i === arr.active && "is-on")}>{frame(id)}</div>)}</div>
        <PageMarkers panes={arr.panes.map(byId)} active={arr.active} side={arr.side}
          onSelect={i => dispatch({ type: "setPane", experience: exp.id, index: exp.panes.findIndex(p => p.id === arr.panes[i]) })}
          onMerge={(l, r) => {
            const unfolded = posture.kind === "book";
            dispatch({ type: "mergePanes", experience: exp.id, fromSlot: surface.slot, left: l, right: r, unfolded });
            emit({ type: "merge", experience: exp.id, left: l, right: r, deferred: !unfolded });
          }} />
      </>;
      break;
    case "empty": body = <div className="sp-empty-surface">{ui.emptySurface}</div>; break;
    default: body = null;
  }
  const tabsPad = arr.kind === "tabs" ? (arr.side === "right" ? { paddingRight: pad.right + 28 } : { paddingLeft: pad.left + 30 }) : {};
  return (
    <>
      {typeof document !== "undefined" && exp.panes.flatMap(pane => {
        const host = hosts.get(pane.id);
        if (!host) return [];
        const deck = posture.kind === "laptop" && surface.slot === visibleFocus ? exp.postures?.laptop?.deck : undefined;
        const onDeck = deck?.kind === "pane" && deck.pane === pane.id && viewport.deck;
        const condensed = arr.kind === "banner" && arr.banners.includes(pane.id);
        const paneContext: PaneContext = { ...ctx, ...(onDeck ? { surface: { ...surface, ...viewport.deck! } } : {}), condensed };
        return [createPortal(pane.render(paneContext), host, pane.id)];
      })}
      <div className={cx("sp-desk", `is-${arr.kind}`)} style={{ paddingTop: pad.top, paddingRight: pad.right, paddingLeft: pad.left, ...tabsPad,
        ...cssVar("--sp-marker-right", `${surface.rail ? 40 : 0}px`), ...cssVar("--sp-marker-top", `${pad.top + 40}px`) }}>
        <ExperienceHeader exp={exp} slot={surface.slot} surface={surface} projectId={project} />
        {body}
      </div>
    </>
  );
}
