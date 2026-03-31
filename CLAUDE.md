<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->

# Project Context

This is a rewrite of a vanilla JS piano practice app (originally at `~/Downloads/chords/`) as a modern TypeScript + Vite+ static site deployed to GitHub Pages at `/piano/`.

## What We're Building

A collection of browser-based mini-games for learning piano chords, intervals, and rhythm using MIDI keyboard input. The old project was vanilla JS with global namespace, inline scripts, and no build step. We are porting it feature-by-feature into this TypeScript + Vite+ project.

## Porting Approach

- **One feature at a time** — we port, review, and agree on patterns as we go.
- **Full TypeScript** — all old JS code gets rewritten as proper TypeScript with types and interfaces.
- **ES modules** — no global namespace; everything uses proper imports/exports.
- **Rethink as we go** — each feature is revisited; some may be redesigned or dropped.
- **Old source reference** — original code lives at `~/Downloads/chords/` for reference.

## Development & Preview

- **Dev server**: `npm run dev` starts Vite+ on localhost.
- **DO NOT use Claude Desktop built-in preview** — it does not support permission-gated Web APIs (MIDI, geolocation, notifications, etc.) and will silently fail. Always use **Chrome DevTools MCP** instead.
- **Preview workflow**: Start the dev server, then use `mcp__chrome-devtools__navigate_page` to open the page in Chrome so both you and the user can see it.
- **Debugging**: Use Chrome DevTools MCP to check console logs and runtime errors.

## Architecture

- **Web Components** — `<piano-keyboard>`, `<session-progress>` etc. are Custom Elements with Shadow DOM, rewritten in TypeScript.
- **Shared modules** — `src/` contains reusable modules (chords, MIDI, session, voice-leading, audio, sheet music).
- **Multi-page app** — each game/tool is a separate HTML entry point, configured in `vite.config.ts` `rollupOptions.input`.
- **Debug pages** — `debug/*.html` pages for testing components in isolation. Each has a corresponding `src/debug/*.ts` entry.
- **MIDI input** — Web MIDI API for real-time keyboard input.
- **Audio** — Web Audio API for sound synthesis.

## Coding Conventions

### Pages & Layout

- All pages use `<div id="app">` as root, with `app.className = "page stack-lg"` applied in JS.
- `.page` handles max-width, centering, padding, and min-height. Do NOT add styles to `#app` — use `.page` instead.
- Use `stack-sm`/`stack-md`/`stack-lg` for vertical spacing within sections. Never leave elements without spacing.
- Use `center` class on flex rows to center buttons/controls.
- `text-align: center` is inherited from `.page` — headings and text center automatically.

### Styling

- **Never hardcode** colors, spacing, font sizes, or gaps — always use design tokens (`--space-*`, `--text-*`, `--fg-muted`, etc.).
- **Never invent UI elements** — use existing component classes (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.badge`, `.card`, etc.).
- For inline labels next to button rows, use plain `<span class="text-muted">` — not button-styled elements (avoid misleading affordances).
- Piano keyboards use `width` + `max-width: 100%` + `margin: 0 auto` when they need to be narrower than the container.

### Components

- Web Components use Shadow DOM with inline `<style>` blocks.
- The `<piano-keyboard>` component auto-hides octave numbers on C keys when keys are too narrow (< 25px).
- `<piano-keyboard>` dispatches a `key-click` custom event (with `detail.midi`) when a key is clicked. Register the click listener once in the constructor, NOT in `#render()` — otherwise re-renders from attribute changes add duplicate listeners.
- When elements inside Shadow DOM need to communicate clicks outward, use `CustomEvent` with `bubbles: true` — normal click events don't expose shadow-internal targets.

### Multi-Page Setup

- Debug pages auto-discovered: drop an HTML file in `debug/` and it's picked up by `vite.config.ts` glob. No manual entry needed.
- Each debug page needs a corresponding `src/debug/*.ts` entry script.
- Update `src/main.ts` index links when adding new pages.

### UI Consistency

- When an input and button share a row, they should be the same visual weight — don't use `btn-sm` next to a full-size input.
- Debug pages with multiple interactive sections should each have their own `<piano-keyboard>` instance rather than sharing one (avoids confusing scroll-to-top behavior).

## Old Project Features (for porting reference)

### Core Modules

- `chords.js` — chord data, 24 triads, 35 progressions, chord parsing (5 formats), MIDI↔note conversion
- `voice-leading.js` — inversion generation, distance calculation, optimal voice leading
- `midi.js` — MIDI device detection, note on/off routing
- `session.js` — timed practice sessions, progress tracking, inactivity timeout
- `audio.js` — Web Audio synthesis, note/chord playback
- `sheet.js` — VexFlow wrapper for music notation rendering

### Web Components

- `<piano-keyboard>` — 88-key piano, color states (gray/yellow/orange/red/green), Shadow DOM
- `<session-progress>` — progress bar with CSS variable animation

### Games

- `random.html` — timed random chord practice (3 min), 3 difficulty levels, hand selection
- `sequence.html` — custom/preset chord sequences, voice leading toggle, left hand bass
- `notes.html` — single note sight-reading from sheet music
- `intervals.html` — harmonic interval recognition from sheet music
- `rhythm.html` — rhythm pattern practice with timing validation
- `rhythm_v2/` — progressive 22-chapter rhythm curriculum

### Reference Tools

- `piano.html` — chord visualization with inversion controls
- `invert.html` — voice leading path explorer
- `scale-chords.html` — find scales containing given chords
- `visualize-notes.html` — note position learning

### Cheat Sheets

- `interval.html`, `scales.html`, `roman.html` — static reference pages

<!--DESIGN SYSTEM START-->

# Design System

This project uses a token-based design system. All visual values are defined as CSS custom properties in `src/styles/tokens.css`. Reusable component classes live in `src/styles/components.css`. Both are imported via `src/style.css`.

## Styling Rules

- **ALWAYS** use CSS custom properties from `src/styles/tokens.css` — never hardcode colors, spacing, or font sizes.
- **ALWAYS** use shared component classes from `src/styles/components.css` for common UI elements.
- Page-specific styles go in the page's own CSS, but **MUST** reference tokens.
- The site respects the user's OS light/dark preference automatically. Do not add a theme toggle.

## Available Tokens

### Colors

- `--accent` — brand color (oklch). Change `--accent-h`, `--accent-c`, `--accent-l` to rebrand.
- `--accent-hover`, `--accent-active` — interactive states
- `--accent-surface`, `--accent-ghost`, `--accent-border`, `--accent-text` — derived variants
- `--fg`, `--fg-muted` — foreground text
- `--bg`, `--bg-secondary` — backgrounds
- `--border`, `--border-focus` — borders
- `--color-error`, `--color-success`, `--color-warning`, `--color-info` — utility colors
- Each utility color has a `-surface` variant for backgrounds

### Typography

- `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--text-2xl` — fluid sizes via clamp()
- `--leading-tight` (1.2), `--leading-normal` (1.5)
- `--tracking-tight` (-0.02em), `--tracking-normal` (0)
- `--font-sans`, `--font-mono`

### Spacing

- `--space-xs` (4px), `--space-sm` (8px), `--space-md` (16px), `--space-lg` (24px), `--space-xl` (32px), `--space-2xl` (48px)

### Other

- `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (12px)
- `--shadow-sm`, `--shadow-md` — theme-aware shadows
- `--duration-fast` (120ms), `--duration-normal` (200ms)

## Available Component Classes

### Buttons

`.btn` base + `.btn-primary`, `.btn-secondary`, `.btn-ghost` variants. `.btn-sm` for small size.

### Form Elements

`.input`, `.select` — styled inputs with focus rings.

### Layout

`.page` — page container (max-width, centered, padded, min-height). `.card` — surface container. `.dialog` — modal styling for `<dialog>`.

### Badges

`.badge` base + `.badge-accent`, `.badge-error`, `.badge-success`, `.badge-warning`, `.badge-info`.

### Layout Utilities

`.stack-sm`, `.stack-md`, `.stack-lg` — vertical flex with gap.
`.row`, `.row-sm`, `.row-md` — horizontal flex with gap.
`.center` — flex center both axes.

### Text Utilities

`.text-muted`, `.text-accent`, `.text-error`, `.text-success`, `.text-warning`.

### Accessibility

`.sr-only` — visually hidden, screen reader accessible.

## DO NOT

- Hardcode hex, rgb, or oklch color values in page styles — use tokens.
- Invent new spacing values — use `--space-*` tokens.
- Create one-off button styles — use `.btn` variants or add a new variant to `components.css`.
- Add `@media (prefers-color-scheme)` in page styles — `light-dark()` handles this in tokens.
- Use arbitrary font sizes — use `--text-*` tokens.

## Review Checklist for Agents

- [ ] No hardcoded colors outside `tokens.css`.
- [ ] All buttons use `.btn` + variant class.
- [ ] All spacing uses `--space-*` tokens.
- [ ] New pages include `<meta name="theme-color">` tags for both light and dark.
<!--DESIGN SYSTEM END-->
