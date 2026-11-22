import * as React from "react";
import type { Rect } from "../device";
import { postureActions, type ExperienceSpec, type VirtualKeyboardLayout } from "../experience";
import { slotStack } from "../state";
import { useFoldFrame, useSpatial } from "./context";
import { PaneFrame, cx, usePaneHost } from "./ExperienceView";

const GLYPH: Record<string, string> = { Backspace: "⌫", Tab: "⇥", CapsLock: "⇪", Enter: "⏎", Shift: "⇧", Control: "⌃", Alt: "⌥", Meta: "⌘", ArrowLeft: "◀", ArrowRight: "▶", " ": "space" };
export const defaultVirtualKeyboardLayout: VirtualKeyboardLayout = {
  rows: [
    { characters: "1234567890-=", after: ["Backspace"] },
    { characters: "QWERTYUIOP[]", before: ["Tab"] },
    { characters: "ASDFGHJKL;'", before: ["CapsLock"], after: ["Enter"] },
    { characters: "ZXCVBNM,./", before: ["Shift"], after: ["Shift"] },
  ],
  bottom: ["Control", "Alt", "Meta", " ", "Meta", "ArrowLeft", "ArrowRight"],
};

/** On-screen keyboard for the deck. `onKey` receives KeyboardEvent.key values. */
export function VirtualKeyboard({ onKey, layout = defaultVirtualKeyboardLayout }: { onKey: (key: string) => void; layout?: VirtualKeyboardLayout }) {
  const key = (k: string, wide?: string) => (
    <button key={k + (wide ?? "")} type="button" className={cx("sp-key", wide)} onPointerDown={e => { e.preventDefault(); onKey(k); }}>{layout.labels?.[k] ?? GLYPH[k] ?? k}</button>
  );
  return (
    <div className="sp-keys">
      {layout.rows.map((row, r) => (
        <div key={r} className="sp-krow">{(row.before ?? []).map(k => key(k, "is-wide"))}{[...row.characters].map(c => key(c))}{(row.after ?? []).map(k => key(k, "is-wide"))}</div>
      ))}
      <div className="sp-krow">{layout.bottom.map(k => key(k, k === " " ? "is-space" : k.startsWith("Arrow") ? undefined : "is-wide"))}</div>
    </div>
  );
}

/** Touch bar: switch workspaces and run the actions the focused experience exposes in this posture. */
export function TouchBar({ experience }: { experience: ExperienceSpec }) {
  const { state, dispatch, posture, emit, swipeScope, visibleFocus } = useSpatial();
  const slot = visibleFocus, run = (id: string) => {
    postureActions(experience, posture.kind).find(a => a.id === id)?.run?.({ slot, experience: experience.id, posture: posture.kind });
    emit({ type: "action", experience: experience.id, action: id, slot });
  };
  const go = (dir: 1 | -1) => swipeScope === "device"
    ? dispatch({ type: "switchDesktop", index: state.active + dir })
    : dispatch({ type: "stepSlotWorkspace", slot, dir });
  const ci = experience.panes.length > 1 ? state.pane[experience.id] ?? 0 : -1;
  return (
    <div className="sp-touchbar">
      <button type="button" className="sp-tb" onClick={() => go(-1)}>‹</button>
      <button type="button" className="sp-tb is-on" style={{ "--c": experience.accent } as React.CSSProperties}>{experience.label}</button>
      <button type="button" className="sp-tb" onClick={() => go(1)}>›</button>
      {ci >= 0 && <span className="sp-tb-sep" />}
      {ci >= 0 && experience.panes.map((p, i) => (
        <button key={p.id} type="button" className={cx("sp-tb", i === ci && "is-on")} style={{ "--c": p.color } as React.CSSProperties}
          onClick={() => dispatch({ type: "setPane", experience: experience.id, index: i })}>{p.short ?? p.title}</button>
      ))}
      <span className="sp-tb-sep" />
      {postureActions(experience, posture.kind).map(a => <button key={a.id} type="button" className="sp-tb" onClick={() => run(a.id)}>{a.icon ?? a.glyph} {a.label}</button>)}
    </div>
  );
}

/**
 * Lower surface in the half-fold (laptop) posture. The experience decides what
 * it exposes there via `postures.laptop.deck`; no body is invented when absent.
 * The deck tilts with the hinge so it reads as the base of a laptop.
 */
export function HalfFoldDeck({ rect, experience, onKey }: { rect: Rect; experience: ExperienceSpec; onKey?: (key: string) => void }) {
  const { desktop, posture, surfaces, visibleFocus, swipeScope } = useSpatial();
  const ref = React.useRef<HTMLDivElement>(null);
  useFoldFrame(f => { if (ref.current) ref.current.style.transform = `perspective(1100px) rotateX(${((180 - f.angle) * 0.22).toFixed(1)}deg)`; });
  const deck = experience.postures?.laptop?.deck;
  const ctx = { slot: visibleFocus, experience: experience.id, posture: posture.kind };
  const surface = surfaces.find(s => s.slot === visibleFocus) ?? surfaces[0];
  const project = desktop.slots[visibleFocus]?.project;
  const stack = slotStack(desktop, visibleFocus);
  const identity = swipeScope === "slot"
    ? `${desktop.id}/stack-${visibleFocus}-${stack.at}/${project ?? ""}/${experience.id}`
    : `${desktop.id}/${project ?? ""}/${visibleFocus}/${experience.id}`;
  const deckHost = usePaneHost(deck?.kind === "pane" ? `${identity}/${deck.pane}` : null);
  const send = onKey ?? (deck?.kind === "keyboard" ? (key: string) => deck.onKey(key, ctx) : undefined);
  return (
    <div ref={ref} className="sp-deck" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
      <TouchBar experience={experience} />
      {deck?.kind === "keyboard" && send && <VirtualKeyboard onKey={send} layout={deck.layout} />}
      {deck?.kind === "controls" && <div className="sp-deck-controls">{deck.render(ctx)}</div>}
      {deck?.kind === "pane" && <PaneFrame spec={experience.panes.find(p => p.id === deck.pane)!}
        host={deckHost} ctx={{ experience: experience.id, slot: visibleFocus, surface: { ...surface, ...rect }, posture: posture.kind, condensed: false }} />}
    </div>
  );
}
