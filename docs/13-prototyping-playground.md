# 13 - Prototyping Playground

The Storybook prototype studio provides a visual sandbox built from the package's actual React components. Use it to compare themes, test responsive compositions, and sketch product-neutral flows before integrating them into an application.

## Start the studio

```bash
bun install --frozen-lockfile
bun run storybook
```

Open **Prototyping / Storyboard Playground** in Storybook. Storybook runs on port `6006` by default.

## Included canvases

- **Component library**: semantic color tokens, buttons, badges, inputs, switches, checkboxes, progress, avatars, and cards.
- **Workflow board**: a composed product storyboard showing hierarchy, metrics, tabs, journey steps, and evidence confidence.
- **Window workspace**: the real controlled `WindowWorkspace`, including responsive tiling, add/close behavior, and pane presets.
- **Task board**: the real controlled Kanban surface with drag-to-status, sprint, and delete targets.

The toolbar switches between `light`, `dark`, `myai`, `corporate`, and `business` themes and desktop, tablet, and mobile frame widths.

The task board currently uses its established dark visual language rather than semantic theme tokens. Theme comparison applies to the primitive, workflow, and workspace canvases; use the task-board canvas to evaluate its existing interaction and density.

## Prototyping guidance

- Treat the canvases as composition references, not application contracts.
- Copy component usage into a consuming app, then map domain data to the package's view-model props there.
- Keep new experimental layout CSS in Storybook until the pattern is reusable enough to become package API.
- Add a focused story for behavior that needs isolated testing; use the playground for cross-component composition and visual exploration.
- Validate workspace scenes with an explicit height because pane sizing depends on a measurable container.
- Treat task-board drag and drop as pointer-first behavior; keyboard movement is not yet implemented in the underlying composite.

## Extending the playground

The implementation lives in:

- `stories/PrototypePlayground.stories.tsx`
- `stories/prototype-playground.css`

Add a scene to the `PrototypeScene` union and `sceneOptions`, then render it inside `PrototypePlayground`. Import package components through `../src` so the story exercises the public entry point.

Story-specific CSS is intentionally separate from `src/styles/`; it is not shipped in the npm package.
