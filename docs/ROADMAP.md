# Goblin Adoption & Observability Roadmap

## Phase 0 · Foundations
- **Compiler core**: Stabilize `.gbln` transpilation, incremental rebuilds, source maps, and diagnostics.
- **Runtime MVP**: Deliver client renderer, server renderer, hydration strategy, and core hooks/signals.
- **CLI ergonomics**: Polished `compile`, `dev`, `build`, `test`, `lint`, `bench` flows; global install instructions.

## Phase 1 · Application Readiness
- **Project templates**: `goblin create` scaffolds for SPA, SSR, edge, and microservice targets.
- **Routing & data**: File-based routes, loaders/actions, streaming suspense, error boundaries.
- **Configuration**: Typed `goblin.config.gbln`, environment layering, secrets vault integrations.

## Phase 2 · Scale & Performance
- **Advanced bundling**: Automatic code-splitting, server islands, progressive hydration, prefetch hints.
- **Edge adapters**: Vercel, Cloudflare, Bun, Deno, AWS Lambda handlers with runtime feature negotiation.
- **Observability hooks**: Structured logging, metrics exporters, trace propagation helpers.

## Phase 3 · Enterprise Experience
- **Testing ecosystem**: Component test runner, contract tests, snapshot diffing, coverage reports.
- **Governance tooling**: Workspace monorepo mode, upgrade assistant, compatibility checks.
- **Security posture**: CSP generator, dependency risk scanner, secrets linting.

## Near-Term Objectives

The next sequence of releases will focus on improving developer experience and runtime performance.

### 0.1.x Series

- Solidify `.gbln` syntax and TypeScript support
+ Continue tightening TypeScript diagnostics for CLI workflows
- Expand template coverage beyond React
- Pilot Suspense resource patterns (`src/runtime/suspense.gbln`) with example templates
- Introduce streaming renderer primitives and expose `renderToStream()` helpers

### 0.2.0 Release Candidates

- Harden hooks lifecycle semantics
- Batch DOM operations more intelligently
- Provide first-class testing utilities for `.gbln`
- Graduate Suspense/streaming API to stable status and document fallback patterns
- Ship CLI presets (`modern`, etc.) and ensure dev-server respects `experiments.streaming`

### 0.3.0+ Explorations

- Investigate hybrid rendering with React/Vue compatibility layers
- Integrate binary protocols for asset delivery
- Package management for reusable Goblin components
- Add server-driven streaming data sources and middleware hooks in dev server
- Expand preview server (`cli/lib/preview-server.mjs`) with HTTPS and middleware support

## Observability Strategy
- **Metrics**: Built-in counter/gauge API with adapters for Prometheus, OpenTelemetry, StatsD.
- **Distributed tracing**: Optional instrumentation layer emitting OTLP spans for server render, loader execution, and client hydration.
- **Logging**: Structured logger with transports (stdout, file, HTTP) and redaction rules; default JSON output.
- **Profiling**: CLI `bench` integration to output flamegraph data, CPU/heap snapshots, and waterfall traces.
- **Health checks**: Auto-generated `/healthz` and `/readyz` endpoints wired into server adapters.

## Adoption Checklist
- **Upgrade path**: Document migration guides from existing Node/TS stacks, codemods for `.gbln` conversion.
- **Education**: Publish deep-dive docs, live playground, and reference app.
- **Community**: Establish RFC process, plugin marketplace, and office hours.

## Immediate Follow-ups
- **Docs**: Create API reference for CLI modules and runtime exports.
- **Examples**: Add `examples/` repo demonstrating SPA, SSR, and edge deployments.
- **Telemetry**: Implement default OpenTelemetry exporter and config surface in `goblin.config.json`.
