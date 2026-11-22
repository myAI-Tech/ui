# Session Handoff

Updated: 2026-10-24

This file records task-specific state. Stable repository conventions are in `AGENTS.md`.

## Verified State

- Repository: `https://github.com/myAI-Tech/ui` (public).
- Default/current branch: `master`.
- Implementation baseline before this documentation handoff: `d169f78ddae52b7c65add31d981bfd44f24b8701` (`feat: add responsive workspace tiling`). The remote `master` ref was verified at this commit before adding the handoff files; run `git rev-parse HEAD` after cloning for the documentation commit containing this note.
- npm package: `@myai-tech/myui@0.1.3-alpha.14`, published under the `alpha` tag.
- Published alpha.14 tarball shasum: `902ea1978280c2a1b0f5b4ba6f7a7b9c891c7461`.
- The repository was transferred from `SeanWilken/kairos-ui` to `myAI-Tech/ui`; GitHub redirects the old URL and this checkout's `origin` points to the organization repository.

## Objective and Progress

The completed objective was to ship responsive `WindowWorkspace`/`SplitWorkspace` pane management and make the package discoverable under the myAI-Tech organization.

Completed and published in alpha.14:

- Responsive tiling presets: landscape/portrait grids, columns, rows, and four main-pane arrangements.
- Automatic tiling when panes are added and when the workspace resizes.
- Browser-style pane tabs with one add control after the tabs.
- Persistent pane ellipsis menus for consumer actions and built-in content, refresh, expand, and close operations.
- Fixes for zero-height initial measurements, newly added pane visibility, responsive overflow, and close defaults.
- Browser checks at desktop, tablet, and mobile widths.
- Repository transfer to `myAI-Tech/ui` and local remote update.

Final release validation completed in the preceding session:

- `bun run typecheck` passed.
- `bun run build` passed.
- `bun run build-storybook` passed with warnings noted below.
- `bun publish --dry-run --tag alpha --access public` showed the expected 14-file package.
- The exact alpha.14 npm registry endpoint returned the published package and matching shasum.

## Decisions and Rationale

- Workspaces remain controlled: consumers own the `panes` array and append/remove panes in callbacks. This avoids hidden state diverging from persisted app state.
- `autoTileOnPaneAdd` and `autoTileOnResize` default to `true` in `WindowWorkspace` so new panes remain visible and layouts adapt without consumer boilerplate.
- A pane is closable by default when `onPaneClose` exists; `canClose: false` explicitly pins it. Requiring every pane to opt in was rejected as repetitive and made callback availability misleading.
- Workspace-wide controls stay in the top bar, while pane actions live in a persistent ellipsis menu. Repeated per-pane add controls and always-visible action rows were rejected because they consumed space and became unusable at narrow widths.
- Closed-pane restoration was deliberately deferred. Implementing it correctly needs a consumer-owned history/persistence contract rather than package-local compatibility state.
- The graph workspace added `KnowledgeGraphNode` instead of replacing the existing `KnowledgeNode`; replacement was rejected because it would collide with and break an established public contract.
- `src/styles/tailwind.css` scans `dist/**/*.{js,cjs}`. Scanning source alone was rejected because consumers install the package artifact and generated utility classes were missing from downstream CSS.
- The existing repository was transferred rather than mirrored into a new organization repository, preserving history and old-URL redirects.

## Relevant Entry Points

- `src/index.ts`: package export surface.
- `src/components/SplitWorkspace.tsx`: tiling engine, responsive observation, tabs, pane actions, and controlled pane behavior.
- `src/components/WindowWorkspace.tsx`: higher-level workspace defaults and public tiling props.
- `src/types/workspaces.ts`: persisted workspace contracts, including `tilePreset`.
- `stories/WindowWorkspace.stories.tsx`: interactive add, tile, resize, and close coverage.
- `src/components/KnowledgeWorkspace.tsx` and `src/types/knowledge.ts`: reusable knowledge graph workspace and non-colliding graph contracts.
- `src/components/tasking/` and `src/components/whiteboard/`: controlled tasking/Kanban and whiteboard families.
- `src/styles/tailwind.css` and `src/styles/theme.css`: packaged utility discovery and semantic themes.
- `package.json`, `tsup.config.ts`, and `docs/06-release-and-publishing.md`: package/release configuration.

## Commands

```bash
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run build-storybook
bun run storybook
bun publish --dry-run --tag alpha --access public
```

Use `bun publish --tag alpha --access public` only for an intentional release after bumping `package.json` and updating `CHANGELOG.md`. npm may open an interactive browser authentication challenge.

## Risks and Next Steps

1. Verify alpha.14 in each intended consumer, especially `studio`, `core`, and `knowledger`; cross-repository integration was not verified in this repository session.
2. Fix `.github/workflows/storybook-pages.yml`: it triggers on `main`, but the verified default branch is `master`. Until changed or manually dispatched, pushes to `master` will not deploy Storybook.
3. Decide whether to keep `master` or rename the default branch to `main`; update documentation and workflows consistently rather than changing one reference in isolation.
4. Add meaningful automated interaction tests for workspace tiling, pane addition/removal, and responsive transitions. There is currently no test script.
5. Consider adding `repository`, `homepage`, and `bugs` metadata to `package.json` now that the canonical organization URL is known.
6. Reconcile release bookkeeping: `package.json` is alpha.14, while Git has only the old `v0.1.0-alpha.1` tag and `CHANGELOG.md` still groups recent work under `Unreleased`.

Known non-failing build warnings: Storybook reports large chunks and direct `eval` inside Storybook's own preview runtime. These did not fail the static build but should not be confused with a warning-free build.

## Machine-Specific and Unverified

- The previous machine used Windows PowerShell and had the checkout under a user-specific development directory. Do not reuse that absolute path on another machine.
- Local directories/artifacts such as `.claude/`, `node_modules/`, `dist/`, `storybook-static/`, `internal/`, and old `.tgz` files are not transferable task state. Do not commit machine-local configuration or package credentials.
- A prior attempt to update a separate KnowLedger checkout was interrupted; its dependency/lockfile state was not verified here. Treat any claim that a consumer already uses alpha.14 as an assumption until checked in that repository.
- Assumption: alpha.14 should remain the integration target until consumer validation identifies a concrete fix; no alpha.15 work has been requested yet.
