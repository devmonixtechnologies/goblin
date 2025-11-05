# Goblin React Template

This template bootstraps a React project powered by the Goblin framework.

## Commands

- `npm run dev` – Start the Goblin dev server with HMR, proxy support, and streaming toggles.
- `npm run build` – Build client and server bundles.
- `npm run preview` – Serve the production client bundle locally via `goblin preview`.
- `npm run start` – Run the production server from `dist/server/index.js`.

## Features

- React 18 client with JSX transpiled via `.gbln` pipeline.
- Server entry using Express + React streaming SSR.
- Shared configuration through `goblin.config.json`.
- Suspense-ready data fetching via Goblin `createResource()` helpers (see `src/App.gbln`).
- Compatible with streaming experiments toggled through `experiments.streaming` in `goblin.config.json`.
