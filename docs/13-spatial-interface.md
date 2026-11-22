# 13 · Spatial interface contract

One interface contract for every myAI frontend. Apps declare **experiences**
(what panes they have, how they condense, what they expose per posture); the
shell owns **devices, postures, chrome, gestures and motion**. Council,
KnowLedger, DevEn and Studio then behave the same way on a slab phone, a
foldable, and (later) tablets and desktops.

Status: **alpha, extracted from the DevEn spatial lab** (`aide/docs/sandbox/spatial-lab.html` in the DevEn repo).
Phones (slab, iPhone Duo) are the supported targets. Tablet/desktop tiling exists
in the core but is parked until its UX is designed.

---

## 1. Architecture

```
HingeSource ──reading──▶ targetAngle() ──▶ hinge Spring ──▶ FoldClock (per frame: angle, openness)
 (native | web |                              (low-pass)        │                    │
  simulated)                                                   ▼                    ▼
                                                   computePosture()   FoldTransition, Crease,
                                                   (React state, rare)  DeviceFrame, HalfFoldDeck
                                                          │              (write styles directly)
                                                          ▼
                     SpatialState ──▶ viewportFor() ──▶ surfacesFor() ──▶ resolveArrangement() ──▶ ExperienceView
                     (reducer)        (app rect, crease,   (slots → rects)   (two | tabs | banner |
                                       half-fold deck)                         stack | single | free)
```

* **Core** (`tokens`, `physics`, `device`, `hinge`, `experience`, `state`) is
  framework-free and mostly pure: posture, geometry, layout resolution and state
  transitions are plain functions. They can be unit-tested and bound from Fable.
* **React layer** renders it. Continuous motion never re-renders React:
  subscribers to `FoldClock` write styles on each animation frame. React state
  changes only when the posture crosses a threshold.

### Desktops, slots and surfaces

A **desktop** is a whole-device workspace: everything on screen at once (the
slab screen, both halves of an unfolded Duo, or every tile of a large display).
`SpatialState.desktops[active]` holds that desktop's `slots`, `inner`
(split/span), `focus` and tile layout. Desktops exist only once the user adds one
with **＋**. Swiping, ←/→ and the touch bar's ‹ › move between them.

Within a desktop, `slots` lists the experiences on screen: `0` = primary
(cover / right half / span), `1` = left half, `2–3` = extra tiles on large
displays. `surfacesFor()` maps slots onto rectangles for the current posture:

| Posture | Surfaces |
|---|---|
| `single` (slab) | slot 0, full screen, floating controls |
| `cover` (foldable closed) | slot 0 on the cover screen, rail |
| `book` + `split` | slot 1 left half, slot 0 right half (rail) |
| `book` + `span` | slot 0 across both halves; two-pane experiences put one pane per half |
| `laptop` | slot 0 on the top half; the bottom half is the **deck** |
| `canvas` | slot 0 on the full tall surface |
| `tiles` *(parked)* | 1–4 managed tiles |

### Swipe scope

`<SpatialProvider swipeScope>` decides what a swipe switches:

| `swipeScope` | Swipe / ←→ / touch-bar ‹ › | ＋ adds | Pager |
|---|---|---|---|
| `"device"` *(default)* | the whole-device desktop | a desktop (`newDesktop()`) | one device-level pager at the bottom, with − to close the current desktop |
| `"slot"` | the touched half's own stack of saved single workspaces | a workspace to the focused half (`newSlotWorkspace()`) | one pager per half |

Both are the same model seen at different granularity: in slot scope each half
keeps `desktop.stacks[slot] = { saved, at }`, and edits made while a workspace is
showing are kept when you swipe away. With nothing added there is nothing to
swipe to; the gesture just rubber-bands.

### No duplicated content (`resolveDevice`)

All surfaces are resolved together. Pane ids are **content identity** across
experiences ("code" is the same editor in Pair Program and Code Assist), scoped
by the slot's project. Only tabbed arrangements can give a pane up, so they
yield: every non-tabbed surface claims its visible panes first, then tabbed
surfaces (focused first) drop any pane already visible elsewhere. A tab set
reduced to one pane renders it as a single pane. Example: Walkthrough (editor +
guide banner) on the left and Pair Program (tabs Code | Chat) on the right gives
the editor once on the left and Chat alone on the right.

### Arrangement rules (`resolveArrangement`)

Evaluated per surface, first match wins:

1. `render` defined → **custom** (the experience draws itself, e.g. Home with `FoldTransition`).
2. `free` defined → **free**-form window canvas (the "Custom" mode).
3. One pane → **single**.
4. Spanned, or width ≥ `twoUpMinWidth` → **two** halves with a divider. Defaults to
   `span` pair or first | rest; `duoPanes` (from dragging a tab onto a tab) overrides it;
   a tucked chat pane is removed.
5. Area < `compactArea` → **tabs** (page markers on the rail side) or **banner**
   (secondary panes become 40px strips). `compact` on the experience picks one;
   `compactOverride` in state can force it.
6. Otherwise → **stack**.

---

## 2. The DSL

```tsx
import { defineExperience, pane } from "@myai-tech/myui";

export const walkthrough = defineExperience({
  id: "Walkthrough", label: "Walkthrough", code: "WT", accent: "#2dd4bf", layout: "Split",
  panes: [
    pane("code",  "Editor", ctx => <Monaco />,        { role: "primary", short: "Code",  flow: "crossfade", owner: "local" }),
    pane("guide", "Guide",  ctx => <GuideSteps />,    { role: "context", short: "Guide", summary: "2/4 Compose panes", owner: "shared" }),
  ],
  compact: "banner",                 // one screen: guide condenses to a banner over the editor
  span: ["code", "guide"],           // unfolded: one per half, divider snaps to the crease
  postures: {
    laptop: {                        // half-fold: what this mode exposes
      deck: { kind: "pane", pane: "guide" },
      actions: [{ id: "next", label: "Next step", glyph: "›", run: ctx => guide.next() }],
      state: () => ({ step: guide.step, total: guide.total }),
    },
  },
  actions: [{ id: "save", label: "Save to Knowledge", glyph: "◈" }],
});
```

| Field | Meaning |
|---|---|
| `panes[].role` | `primary` (keeps the screen when condensed), `context`, `chat` (drives chat-toggle semantics), `tool` |
| `panes[].flow` | How the pane travels across a fold. See §4 |
| `panes[].short` / `summary` / `banner` | Labels for page markers / touch bar, and the one-line banner form |
| `panes[].owner` | `shared` (a myui primitive) or `local` (app-owned). Informational, mirrors DevEn's ModeContract |
| `compact` | `tabs` (default) or `banner` |
| `span` | Default pane pair when the experience covers both halves |
| `postures[kind]` | `actions`, `state`, `deck` exposed only in that posture. See §6 |
| `free.windows` | Percent-based window rects for free-form mode |
| `render` | Fully custom view; bypasses the resolver |

`defineExperience` validates pane ids and references at definition time.

### Shell wiring

```tsx
<SpatialProvider device={devices.iphoneDuo} hinge={detectHinge()} experiences={experiences}
  initialState={{ desktops: [{ slots: [{ experience: "home" }, { experience: "Walkthrough" }] }], pairs }}
  swipeScope="device" newDesktop={() => ({ slots: [{ experience: "home" }], inner: "span", focus: 0, tiles: 2, tileRatio: 0.5 })}
  projects={projects} onEvent={toastOrTelemetry} onStateChange={persist}>
  <SpatialShell controls={{ chat: <ChatWorkspace />, onSearch, onAccount }} />
</SpatialProvider>
```

`onEvent` reports `experience`, `action`, `pair-applied` (with `needsUnfold`),
`pair-saved`, and `merge` (with `deferred` when the device is folded). Apps turn
these into toasts or telemetry. `onStateChange` is the persistence hook (pairs,
handedness, layout memory).

### Interaction contract (built into the shell)

* **Spatial handle (glow):** placed about 30% up from the bottom (`handlePosition`).
  Pull it to open the experience flyout for that side's slot. When open as a book,
  there is one on each half. On a single screen, `hand` picks the side.
* **Context pull:** dragging the rail (or, on floating-chrome devices, the right edge)
  inward opens the context flyout for the focused slot. It holds the experience's
  posture actions, plus Split/Span and Swap halves when unfolded.
* **Controls:** bottom-justified rail (search, chat, account) on rail devices. On
  slab phones, floating round buttons: account top-left, search and chat top-right.
* **Chat toggle:** lit whenever a `chat`-role pane is already on screen. Tapping
  tucks or restores that half, flips the tab, or opens/closes the banner. Only when
  no chat is on screen does it open the overlay panel.
* **Swipe** horizontally to switch desktops (or, in slot scope, the touched half's saved workspaces).
  **＋** in the pager adds one; the context flyout also offers *New desktop* / *Close desktop*.
  Experiences inside a desktop change through the spatial handles, not by swiping.
* **Drag a page-marker onto another marker** to put both panes across the two halves.
  Drop on the target's left half for the left screen, right half for the right.
* **Pairs** (favourites) live on the flyout's inner arc. A pair can span two
  projects or two experiences in one project.

---

## 3. Physics tokens

All motion is damped springs (`x'' = k·(target − x) − c·x'`). Two derived numbers
predict the feel:

* natural frequency ω = √k (rad/s). Higher means snappier.
* damping ratio ζ = c / (2√k). Below 1 overshoots (bouncy), 1 is critically damped
  (fastest with no overshoot), above 1 is sluggish.

| Token | Default | ζ / unit | Drives | Tuning notes |
|---|---|---|---|---|
| `springStiffness` / `springDamping` | 240 / 24 | ζ ≈ 0.77 | Flyout open/close, generic UI springs | Slight overshoot gives the "plop". Keep ζ in 0.6–0.9 |
| `hingeStiffness` / `hingeDamping` | 90 / 19 | ζ ≈ 1.0 | Low-pass on every hinge reading → animated angle | Critically damped so sensor jitter never overshoots. Lower k for heavier, more viscous unfolds. `FoldClock.setResponse(9, 6)` is the slow demo unfold (ω = 3, ≈1.5 s) |
| `foldViscosityK` / `C` | 55 / 13 | ζ ≈ 0.88 | Lag between angle and melt progress | The liquid trails the hinge slightly; raise k to tighten |
| `jellyK` / `jellyC` | 150 / 11 | ζ ≈ 0.45 | Re-solidify settle of melted elements | The only deliberately bouncy spring. Below ~0.35 looks rubbery |
| `meltTint` | 0.22 | 0–1 | Accent mixed into molten material | 0 = neutral grey melt |
| `meltDroplets` | 28 | beads / element | Stream continuity | Fewer beads look like drips, more cost more. Gaps over ~2× the blur radius stop merging |
| `flowStagger` | 0.14 | fraction of the fold | Delay between successive items in a `FoldTransition` | Item 0 moves first and lands first |
| `flyoutRadius` / `flyoutSpread` | 150 px / 136° | — | Outer arc; the inner arc is 0.5 × radius | The radius auto-grows by 16 / 26 px for more than 6 / 9 items |
| `membraneTension` | 0.62 | 0–1 | Bezier control ratio of the glass bulge | Higher is rounder; low values look pinched |
| `latchThreshold` | 0.45 | progress | Release beyond this keeps the flyout open | — |
| `pullDistance` / `pullSlop` | 220 / 8 px | — | Pull length for full open, plus the dead zone before a press becomes a pull | The slop keeps rail buttons tappable |
| `glassAlpha` / `glassBlur` | 0.62 / 18 px | — | Membrane fill opacity and backdrop blur | Emitted as CSS variables |
| `closedBelow` / `halfFoldBelow` | 2° / 150° | degrees | Posture thresholds: closed / half / flat | Laptop posture = landscape and half |
| `discreteAngles` | 0 / 100 / 180 | degrees | Targets when a source only reports posture | See §5. The spring animates between them |
| `compactArea` / `twoUpMinWidth` | 500 000 px² / 900 px | — | When to condense, and when one surface may show two halves | — |
| `creaseSnap` / `dividerMin` / `dividerMax` | 0.03 / 0.22 / 0.78 | ratio | Divider magnetism to the crease, and its limits | — |
| `handlePosition` | 0.7 | ratio from top | Glow handle centre (≈ 30% from the bottom) | Clamped above the rail buttons |
| `swipeDistance` / `swipeVelocity` | 60 px / 650 px/s | — | Slot swipe thresholds | — |
| `reduceMotion` | OS setting | bool | Snaps every spring to its target | Defaults from `prefers-reduced-motion` |

Override with `<SpatialProvider tokens={{ … }}>`. Unspecified tokens keep their defaults.

---

## 4. Element flow profiles: what can be pushed through a fold

`FoldTransition` moves elements between their folded (`from`) and unfolded (`to`)
rects. Melt, route and stream are pure functions of fold progress, so scrubbing
the hinge scrubs the animation. Only the re-solidify settle runs on time. Choose
the profile by what the element *is*:

| Profile | Motion | Use for | Never use for |
|---|---|---|---|
| `melt` | Backs up against the top margin → turns molten → routes into the crease → bead stream down it → re-solidifies at the destination with a jelly settle | Cards, tiles, buttons, chips — solid shapes with little internal state | Anything with live internal layout |
| `slide` | Moves rigidly. Crosses the crease only if `from` and `to` are on different sides; otherwise it takes the direct path | Lists, text blocks, headers | Large surfaces (it traces the whole route) |
| `crossfade` | Fades out at the source, in at the destination | Editors (Monaco), iframes, video, canvases, WebGL — anything too costly or stateful to deform | — |
| `pin` | Stays put | Status, the header on the side that doesn't move | — |

**Performance budget.** Melting uses an SVG goo filter (Gaussian blur + alpha
threshold) over a dedicated layer. Keep it to ≤ 3 melting elements per transition
and modest sizes. Content inside a melting element fades out while it is molten,
so only its blob is filtered. Frames write `left/top/width/height` plus
transforms on a handful of nodes. A transforms-only path (scale from a fixed
box) is a possible optimisation if low-end devices struggle.

**Direction.** The current route assumes a **vertical crease** (book unfold) and
a top margin. Horizontal-crease routes (laptop / tent) are not implemented yet.
In landscape, experiences use their normal layouts and the deck appears without
melting.

---

## 5. Hinge data and iOS integration

### 5.1 What each platform can actually provide

| Platform | Angle | Posture | Segments | How |
|---|---|---|---|---|
| **Web (Chromium on Android foldables)** | ✗ | ✓ `navigator.devicePosture.type` = `continuous` \| `folded`; CSS `@media (device-posture: folded)` | ✓ `window.viewport.segments`, `@media (horizontal-viewport-segments: 2)`, `env(viewport-segment-*)` | `webHinge()` |
| **Android native** | ✓ `Sensor.TYPE_HINGE_ANGLE` (0–180°) | ✓ Jetpack WindowManager `FoldingFeature.state` (`FLAT` / `HALF_OPENED`), `orientation`, `isSeparating`, `bounds` | ✓ | WebView bridge → `nativeBridgeHinge()` |
| **iOS / iPadOS** | ? | ? | ? | **No public hinge or fold API exists today** that I can point to. An Apple foldable would most likely expose posture through UIKit/SwiftUI scene geometry or traits. Treat iOS as *posture-only* until Apple documents otherwise, and plan for an angle if one appears |
| **Lab / Storybook / tests** | ✓ | — | — | `simulatedHinge()` |

Safari has no Device Posture or Viewport Segments support as far as I know.
On iOS the web layer therefore depends on the native bridge. CoreMotion
reports the attitude of the device as a whole, not the angle between halves, so
it cannot be used to derive a hinge angle.

### 5.2 One rule that makes every fidelity look clean

Every reading becomes a **target** for a single critically damped hinge spring
(`targetAngle()` → `FoldClock.angle`):

* **Continuous angle** (Android sensor, a future iOS API): the target follows the
  sensor, and the spring removes jitter. Animations track the hand, and melting
  scrubs as the user opens the device.
* **Posture only** (web, iOS today): `closed / half / flat` map to
  `discreteAngles` (0 / 100 / 180). The spring sweeps between them, so the same
  choreography plays as a scripted unfold of about 1–1.5 s. Use `FoldClock.setResponse(k, c)`
  for a slower, more viscous sweep on discrete sources.
* **Nothing** (desktop browsers): flat, no fold transitions.

Posture is derived from the smoothed angle, never from raw readings, so layouts
cannot flap. **Recommended next step:** add ±3° hysteresis around `closedBelow`
and `halfFoldBelow` for continuous sources held near a threshold (not
implemented yet).

### 5.3 Native bridge contract (`nativeBridgeHinge`)

Page → native (start or stop streaming):

```js
webkit.messageHandlers.myaiHinge.postMessage({ type: "subscribe" })   // iOS (WKScriptMessageHandler)
window.MyAIHinge.subscribe()                                          // Android (@JavascriptInterface)
```

Native → page (coalesce to ≤ 60 Hz; send only on change):

```js
window.__myaiHinge({
  angle: 112.5,                 // degrees 0–180, or null when unknown
  fold: "half",                 // "closed" | "half" | "flat" | null
  axis: "vertical",             // crease direction in *current* orientation
  segments: [{ x: 0, y: 0, w: 520, h: 740 }, { x: 520, y: 0, w: 520, h: 740 }]  // CSS px of the web view
})
```

* Only native code can call `__myaiHinge` (`evaluateJavaScript` / `evaluateJavascript`).
  The bridge does **not** listen to `window.postMessage`, so other frames cannot spoof hinge data.
* Units are CSS px of the web view and degrees. Use `null`, not `0`, for unknown.
* `detectHinge()` picks native → web → simulated automatically.

iOS sketch (Swift):

```swift
final class HingeBridge: NSObject, WKScriptMessageHandler {
  weak var webView: WKWebView?
  private var monitor: HingeMonitor?          // wraps whatever Apple exposes; posture-only today

  func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
    guard let body = m.body as? [String: Any], let type = body["type"] as? String else { return }
    type == "subscribe" ? start() : monitor?.stop()
  }
  private func start() {
    monitor = HingeMonitor { [weak self] r in      // r: angle?, fold, axis, segments
      let json = r.jsonString                      // encode with JSONEncoder, never string-interpolate
      DispatchQueue.main.async { self?.webView?.evaluateJavaScript("window.__myaiHinge(\(json))") }
    }
    monitor?.start()
  }
}
// setup: config.userContentController.add(HingeBridge(...), name: "myaiHinge")
```

Android sketch (Kotlin):

```kotlin
WindowInfoTracker.getOrCreate(activity).windowLayoutInfo(activity).collect { info ->
  val f = info.displayFeatures.filterIsInstance<FoldingFeature>().firstOrNull()
  push(fold = when (f?.state) { FoldingFeature.State.HALF_OPENED -> "half"; FoldingFeature.State.FLAT -> "flat"; else -> null },
       axis = if (f?.orientation == FoldingFeature.Orientation.VERTICAL) "vertical" else "horizontal")
}
sensorManager.getDefaultSensor(Sensor.TYPE_HINGE_ANGLE)?.let { s -> sensorManager.registerListener(listener, s, SENSOR_DELAY_UI) }
// push(...) → webView.evaluateJavascript("window.__myaiHinge($json)", null)
```

### 5.4 Matching motion to what is being pushed through

The bridge only delivers the angle. Each element's `flow` profile (§4) decides
how it reacts. Guidance for clean results on real hardware:

* **Melt** only lightweight solids. Its phases sit inside fixed openness windows
  (squish 0–0.2, route 0.18–0.45, stream 0.24–0.74, re-solidify 0.46–0.8). A
  continuous sensor scrubs them; a discrete one plays them in about one sweep.
* **Crossfade** anything that owns a heavy DOM, a GPU context or editing state.
  Never deform it, and keep its instance mounted so state survives.
* **Throttle work, not motion.** Posture (React) changes once per threshold
  crossing; geometry writes happen on animation frames only. Don't subscribe
  React state to `FoldClock`.
* **Reduced motion:** all springs snap, and transitions resolve to their end state.

---

## 6. Half-fold mode: exposing state and functions per posture

A half-fold is a posture with its own affordances. In the laptop posture the top
half shows the app and the **deck** below is controlled by the experience:

```ts
postures: {
  laptop: {
    deck: { kind: "keyboard" }                       // default
        | { kind: "pane", pane: "guide" }            // move a pane to the deck
        | { kind: "controls", render: ctx => <Transport /> },
    actions: [{ id: "stop", label: "Stop job", glyph: "■", run }],   // touch bar + context flyout
    state: ctx => ({ running: job.running }),        // readable via usePostureState()
  },
  book: { actions: [...] },                          // capabilities while unfolded as a book
}
```

* **Touch bar:** always present on the deck. ‹ › switch workspaces (per `swipeScope`); it also
  switches panes for tabbed experiences and runs the posture's actions.
* **Context flyout:** merges posture actions with the experience's always-on actions.
* **Published state:** `usePostureState()` returns the focused experience's `state()`
  for the current posture, so chrome, other experiences or Core can show "step 2/4",
  "job running" and so on without knowing the experience's internals.
* **Book half-open (tent-like):** `posture.kind` stays `book`, and `usePosture().fold`
  is `"half"` while the book isn't flat. Experiences that want different behaviour
  there read `fold`. Capabilities are keyed by kind only today.

Suggested per-mode mapping for DevEn (to confirm):

| Experience | Laptop deck | Posture actions |
|---|---|---|
| Walkthrough | guide pane | Prev / Next step |
| Terminal | keyboard | Stop job, Tail logs |
| Play | transport controls | Reload, Expose route, Attach debugger |
| Pair Program | chat pane | Approve / Roll back patch |
| Designer | style inspector pane | Persist tokens |

---

## 7. Using it from myui

* Code: `src/spatial/` (re-exported from the package root). Generic math helpers are
  namespaced as `spatialMath`, so `clamp` / `lerp` don't collide with other exports.
* Styles: opt-in, like `knowledge.css`:
  ```ts
  import "@myai-tech/myui/spatial.css";
  ```
* Storybook: *Workspaces / Spatial Interface* (`stories/SpatialInterface.stories.tsx`,
  fixtures in `stories/spatialFixtures.tsx`). It uses `DeviceFrame` and a simulated hinge.
* Still to do: unit tests for `resolveArrangement`, `resolveDevice`, `spatialReducer`,
  `computePosture`, `surfacesFor` and `targetAngle`. They are pure functions. The repo has
  no test runner yet.

No new dependencies: React ≥ 18 only. Tailwind is not required; colours come from
the myui theme variables (`--background`, `--card`, `--muted`, `--border`,
`--foreground`, `--muted-foreground`) with standalone fallbacks. Set `--sp-accent`
per app.

**From Fable (DevEn):** bind `SpatialProvider`, `SpatialShell` and `defineExperience` in
`MyUi.fs` the same way as the existing components (`ImportMember "@myai-tech/myui"`).
Experiences are plain objects, so build them with `createObj` from DevEn's
`WorkspaceMode.contract`. That keeps the ModeContract the single source of truth,
and pane `render` functions are F# lambdas returning `ReactElement`.

---

## 8. Known gaps

* Posture hysteresis (§5.2).
* Horizontal-crease fold transitions (§4).
* Tablet / desktop tiling UX is parked; the core supports 1–4 tiles plus a divider only.
* Real iPhone Duo dimensions are placeholders (`devices.iphoneDuo`).
* Accessibility: flyout nodes are buttons, but there is no roving focus / ARIA menu
  semantics yet, and pulls have no keyboard equivalent beyond `[` / `]`.
* Bezel-started pulls (a drag beginning on the hardware frame) are lab-only.
