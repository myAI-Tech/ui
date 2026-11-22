# Repository Guide

## Purpose and Boundaries

`@myai-tech/myui` is the public React component package for reusable myAI UI primitives and composable workspace surfaces. It serves myAI applications and external consumers through npm while keeping application data access, domain contracts, authentication, and business workflows in consuming repositories.

Keep components contract-agnostic. Consumers should map domain data into view-model props; this package should render those props without importing from `core`, `studio`, or other product repositories.

## Architecture

- `src/index.ts` is the single public TypeScript entry point. Export every public component and type there.
- `src/components/ui/` contains low-level shadcn/Radix-style primitives.
- `src/components/` contains reusable composites and workspace surfaces.
- `src/components/tasking/` and `src/components/whiteboard/` contain feature-oriented but controlled, domain-neutral component families.
- `src/types/` contains public UI/view-model contracts. Avoid names that collide with established exported contracts.
- `src/styles/index.css` is the complete style entry point; `theme.css`, `tailwind.css`, `font.css`, and `knowledge.css` are separately exported options.
- `stories/` is the interactive catalog and primary behavior harness.
- `docs/` contains consumer, authoring, theming, adoption, and release guidance.
- `tsup.config.ts` emits ESM, CommonJS, declarations, and source maps from `src/index.ts`; React and React DOM remain external peer dependencies.

The package is controlled-component oriented. State such as workspace panes belongs to consumers and is changed through callbacks rather than hidden package state unless a component is explicitly documented as a stateful wrapper.

## Component Conventions

- Match surrounding shadcn/Radix patterns and preserve accessibility and keyboard behavior.
- Prefer composition and prop-driven behavior over app-specific branches.
- Forward native or Radix props and refs where applicable.
- Support `className`; use `classNames` or `slotProps` when consumers need internal-slot customization.
- Keep Tailwind optional at the package boundary. Default packaged styles currently require Tailwind v4 tooling when imported.
- Add or update a Storybook story for meaningful interactive behavior.
- Update `CHANGELOG.md` and relevant docs for public API or behavior changes.

## Development

The declared package manager is Bun. Install with:

```bash
bun install --frozen-lockfile
```

Common commands:

```bash
bun run typecheck
bun run build
bun run check
bun run test:spatial
bun run storybook
bun run build-storybook
```

Storybook runs on port `6006`. There is currently no unit/integration test script; do not describe `bun run check` as tests because it only typechecks and builds.

Before publishing, also build Storybook, manually exercise affected stories, inspect the packed artifact, and test the prerelease in relevant consuming applications.

## Release

- npm package: `@myai-tech/myui`
- source repository: `https://github.com/myAI-Tech/ui`
- prerelease channel: `alpha`
- publish command: `bun publish --tag alpha --access public`

Publishing requires authorized npm organization access and may require interactive browser/security-key authentication. Never add tokens or credentials to the repository.

See `docs/06-release-and-publishing.md` for the release checklist. GitHub CI typechecks and builds on pushes and pull requests.
