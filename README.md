# Goblin

An advanced, blazing-fast, and effortlessly approachable JavaScript UI framework with a batteries-included toolchain for compiling `.gbln` component files, rendering on client and server targets, and wiring modern developer workflows.

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Runtime Architecture](#runtime-architecture)
- [CLI Reference](#cli-reference)
- [Configuration (`goblin.config.json`)](#configuration-goblinconfigjson)
- [Development Workflow](#development-workflow)
- [Testing and Quality](#testing-and-quality)
- [Benchmarking](#benchmarking)
- [Project Templates](#project-templates)
- [Roadmap and Observability](#roadmap-and-observability)
- [Contributing](#contributing)
- [License](#license)

## Overview

Goblin blends a cutting-edge virtual DOM runtime with an incredibly streamlined build pipeline so you can author UI in strongly typed `.gbln` modules, compile to optimized JavaScript, and deploy across browsers or Node.js servers. The repository contains the framework runtime, CLI tooling, configuration surface, and starter templates—designed for maximum power with minimal friction.

## Core Features

- **Typed component model** powered by `.gbln` files that compile through esbuild with TypeScript support, giving you advanced DX with minimal setup.
- **Suspense-ready runtime** enabled by `src/runtime/suspense.gbln`, `useResource()`, and prioritized scheduling so async UI stays responsive and easy to author.
- **Universal rendering** via `src/index.gbln` for clients and `src/server/index.gbln` for JSON/streaming server rendering, keeping apps fast everywhere.
- **First-class CLI** (`cli/goblin.mjs`) for `compile`, `dev`, `build`, `preview`, `test`, `lint`, and `bench` workflows, wrapping complex flows in simple commands.
- **Hot module reload (HMR)** event source injected during development builds for instant feedback without manual refreshes.
- **Configurable bundling** with code splitting, source maps, and public asset copying baked into the compiler so production builds stay lean.
- **Testing harness** that executes `.test.gbln` suites with Node’s `assert/strict` utilities, making correctness straightforwards.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Compile the project once (development mode by default)
npm run compile

# 3. Start the dev server with HMR (defaults to http://127.0.0.1:5173)
npm run dev

# 4. Run the test suite
npm test
```

> **Node.js:** The toolchain targets modern runtimes (esbuild `target: 'es2022'` for browsers and `'node20'` for servers). Use Node 20+ for best compatibility.

## Project Structure

```
├── cli/                     # CLI entry point and supporting libraries
├── dist/                    # Build artifacts (client & server bundles)
├── docs/                    # Project documentation (e.g., ROADMAP.md)
├── src/                     # Framework source (runtime, server renderer)
│   ├── index.gbln           # Demo app entry point and createRoot()
│   ├── runtime/             # Virtual DOM, scheduler, hooks implementations
│   └── server/              # HTTP server and SSR helpers
├── templates/               # Starter templates (React integration sample)
├── tests/                   # Framework tests (`*.test.gbln` files)
├── goblin.config.json       # Build and dev server configuration
├── package.json             # Workspace metadata and scripts
└── tsconfig.json            # TypeScript configuration used during compilation
```

## Runtime Architecture

- **Virtual Nodes:** `src/runtime/vnode.gbln` defines cache-friendly vnode records plus ergonomic helpers like `h()` so authoring trees feels effortless.
- **Component Lifecycle:** `src/runtime/component.gbln` and `src/runtime/hooks.gbln` orchestrate hook state, effects, and context inheritance to deliver advanced composability with familiar ergonomics.
- **Reactive Hooks:** `useState`, `useReducer`, `useMemo`, and `useEffect` in `src/runtime/hooks.gbln` ensure high-performance reactivity while shielding you from manual bookkeeping.
- **Renderer:** `src/runtime/renderer.gbln` streams vnode diffs into the DOM or serializes payloads for transport, keeping updates extremely fast while hiding low-level details.
- **Scheduler:** `src/runtime/scheduler.gbln` prioritizes work, batches microtasks, and defers non-critical updates to maintain snappy interactivity even under heavy load.
- **Server Bridge:** `src/server/index.gbln` exposes `createServer()` and `renderToString()` so the same component tree powers edge JSON APIs, SSR, or static pre-rendering with minimal wiring.
- **Toolchain Integration:** `cli/lib/compiler.mjs` pipelines esbuild, public asset copying, and TypeScript diagnostics so projects stay production-ready without extra setup.
- **Stream-first Server:** `src/server/streaming.gbln` exposes async generators for chunked payloads, while `src/server/index.gbln` serves JSON or streaming responses with a flip of a flag.
- **Diagnostics Core:** `cli/lib/diagnostics.mjs` surfaces precise TypeScript errors, letting you ship confident changes without leaving the Goblin workflow.

### Advanced Capabilities & Ergonomics

- **Zero-Config Dev Server:** `cli/lib/dev-server.mjs` watches builds, streams HMR reload events, and serves static assets automatically—just run `goblin dev` and start iterating.
- **Unified Module Loading:** `cli/lib/module-loader.mjs` standardizes how `.gbln`, `.ts`, and `.tsx` files are resolved so you can import freely without custom bundler tweaks.
- **Configurable Yet Simple:** `goblin.config.json` enables per-target entrypoints, output directories, and asset pipelines with intuitive defaults that work out of the box.
- **Built-in Testing & Benchmarks:** `cli/lib/tester.mjs` and `cli/lib/bench.mjs` offer first-class CLIs for correctness and performance, keeping advanced workflows one command away.
- **Template Acceleration:** `templates/react-app/` demonstrates seamless interop with React 18, making it easy to bootstrap sophisticated apps while reusing Goblin’s runtime.

### Authoring Components

Example `App` component from `src/index.gbln`:

```ts
export function App(props: AppProps): VNode {
  const featureItems = (props.features ?? []).map(label => h('li', { class: 'feature-item' }, label));
  return h(
    'main',
    { class: 'goblin-app-shell' },
    h('h1', null, props.title),
    featureItems.length > 0
      ? h('ul', { class: 'feature-list' }, featureItems)
      : h('p', null, 'Configure features in src/index.gbln to see them here.')
  );
}
```

Components can leverage hooks (`useState`, `useReducer`, `useEffect`, etc.) from `src/runtime/hooks.gbln` to manage state and side effects.

## CLI Reference

The CLI surfaces all development workflows through a single binary (`bin/goblin`). Each command is defined in `cli/goblin.mjs` and lazily loads the corresponding library.

| Command | Description | Key Options |
| --- | --- | --- |
| `goblin compile` | Compile `.gbln` sources to JavaScript bundles. | `--config`, `--tsconfig`, `--mode <development|production>`, `--preset <name>` |
| `goblin build` | Production bundle with minification and asset copy. | `--config`, `--tsconfig`, `--preset <name>` |
| `goblin dev` | Start the dev server with HMR, proxy support, and structured event stream. | `--config`, `--host`, `--port`, `--tsconfig`, `--preset`, `--inspect`, `--profiling`, `--no-hmr`, `--streaming`, `--no-streaming` |
| `goblin preview` | Serve production assets with a static preview server. | `--config`, `--host`, `--port`, `--preset` |
| `goblin test` | Execute `*.test.gbln` suites with optional watch mode. | `--watch` |
| `goblin lint` | Type-check and validate project structure. | `--config` (tsconfig path) |
| `goblin bench` | Run benchmarks in `benchmarks/**/*.bench.gbln`. | `--runs <count>` (default 5) |

Use the npm scripts defined in `package.json` to invoke these commands without installing the CLI globally:

```json
{
  "scripts": {
    "compile": "node ./cli/goblin.mjs compile",
    "dev": "node ./cli/goblin.mjs dev",
    "build": "node ./cli/goblin.mjs build",
    "test": "node ./cli/goblin.mjs test",
    "lint": "node ./cli/goblin.mjs lint",
    "bench": "node ./cli/goblin.mjs bench"
  }
}
```

## Configuration (`goblin.config.json`)

The configuration file controls entry points, output directories, and server defaults. The repository ships with:

```json
{
  "entries": {
    "client": ["src/index.gbln"],
    "server": ["src/server/index.gbln"]
  },
  "outDir": {
    "client": "dist/client",
    "server": "dist/server"
  },
  "splitting": true,
  "minify": false,
  "sourcemap": true,
  "publicDir": "public",
  "server": {
    "host": "127.0.0.1",
    "port": 5173,
    "proxy": {}
  },
  "experiments": {
    "suspense": true,
    "streaming": true
  }
}
```

- **`entries`**: Declare build targets. When omitted, the compiler defaults to `src/index.gbln` for client bundles.
- **`outDir`**: Destination directories per target. Defaults to `dist/client` and `dist/server`.
- **`splitting`**: Enable esbuild code splitting for client bundles.
- **`minify`**: Toggle minification (commonly `true` in production builds).
- **`sourcemap`**: Include source maps for debugging.
- **`publicDir`**: Folder copied into `client` output during compile/build.
- **`server.host` / `server.port`**: Defaults consumed by the dev server.
- **`server.proxy`**: Object map for dev-server reverse proxies (e.g. `"/api": "http://localhost:3001"`).
- **`experiments`**: Feature flags (e.g. Suspense, streaming) that the CLI and runtime can toggle.

Update the file to point at your own entry modules or tweak server defaults. The CLI always resolves paths relative to the project root.

## Development Workflow

1. **Compilation**: `goblin compile --mode development` builds each declared target and copies public assets.
2. **Live Reload**: `goblin dev` establishes an `EventSource` (`/__goblin_events`) that reloads the browser when recompilation completes.
   - Leverage `--profiling` for timestamped rebuild output, `--inspect` to attach a Node debugger, and `--streaming/--no-streaming` to flip streaming experiments.
3. **Production Builds**: `goblin build` mirrors compile but forces production mode, minifying client bundles and generating build metadata.
4. **Preview**: `goblin preview` rebuilds production assets and serves them from `dist/client/` via `cli/lib/preview-server.mjs`.
4. **Type Safety**: After each build, `typeCheckProject()` runs through `collectDiagnostics()` to enforce TypeScript correctness. Failures emit detailed diagnostics and exit with a non-zero code.

## Testing and Quality

- **Unit Tests**: Place test modules under `tests/`. The example `tests/app.test.gbln` demonstrates verifying vnode output with Node’s `assert` helpers.
- **Linting**: `goblin lint` performs structural validation and type checking using the configured `tsconfig.json`.
- **Continuous Feedback**: Combine `--watch` on `goblin test` with the dev server for rapid development loops.

## Benchmarking

Use `goblin bench` to execute benchmark suites located in `benchmarks/**/*.bench.gbln`. The runner supports configurable iteration counts via `--runs`. Integrate these metrics with profiling outputs described in the roadmap to track performance regressions over time.

## Project Templates

Starter templates live in `templates/`. The `react-app/` template demonstrates integrating Goblin’s build pipeline with React 18:

- Scripts delegate to the Goblin CLI (`goblin dev`, `goblin build`, `node dist/server/index.js`).
- Includes a `README.md` outlining template-specific commands and features.

Copy the template into a new workspace or add forthcoming scaffolding commands to streamline project creation.

## Roadmap and Observability

Refer to `docs/ROADMAP.md` for the multi-phase roadmap covering compiler stabilization, application readiness, scale and performance improvements, and enterprise features. Highlights include:

- **Observability**: Planned metrics adapters (Prometheus, OpenTelemetry), structured logging transports, and built-in health probes.
- **Advanced Bundling**: Progressive hydration, server islands, and prefetched assets.
- **Ecosystem Growth**: Governance tooling, upgrade assistants, and education initiatives.

Tracking these initiatives ensures Goblin matures from an experimental framework to a production-ready platform with robust telemetry.

## Contributing

1. Fork the repository and create a feature branch.
2. Run `npm run lint` and `npm test` before submitting pull requests.
3. Update or add documentation/tests relevant to your changes.
4. Reference roadmap items when proposing new features to align with planned phases.

Issues, ideas, and discussion topics are welcome—open an issue to start the conversation.

## License

Goblin is released under the [MIT License](./LICENSE) as declared in `package.json`.
