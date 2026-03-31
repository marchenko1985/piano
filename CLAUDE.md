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

`.card` — surface container. `.dialog` — modal styling for `<dialog>`.

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
