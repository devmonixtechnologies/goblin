import * as esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, cp } from 'fs/promises';
import { existsSync } from 'fs';
import kleur from 'kleur';
import { collectDiagnostics, printDiagnostics } from './diagnostics.mjs';

const cliDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(cliDir, '../..');
export const HMR_ENDPOINT = '/__goblin_events';

export function resolveProjectPath(relativePath) {
  return resolve(projectRoot, relativePath);
}

export function getOutDir(config, target) {
  const out = typeof config.outDir === 'string' ? config.outDir : config.outDir?.[target];
  const fallback = target === 'server' ? 'dist/server' : 'dist/client';
  return resolveProjectPath(out || fallback);
}

export function getPublicDir(config) {
  if (!config.publicDir) {
    return null;
  }
  return resolveProjectPath(config.publicDir);
}

export async function copyPublicAssets(config) {
  const source = getPublicDir(config);
  if (!source || !existsSync(source)) {
    return;
  }
  const target = getOutDir(config, 'client');
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true, force: true });
}

export async function compileProject(config, { mode, tsconfigPath, hmr = true } = {}) {
  const targets = resolveTargets(config);
  for (const target of targets) {
    const options = await buildOptions(config, target, mode, { hmr });
    await esbuild.build(options);
  }
  if (mode === 'development' || mode === 'production') {
    await copyPublicAssets(config);
  }
  await typeCheckProject(tsconfigPath, { throwOnError: true });
}

export async function createBuildContexts(config, { mode, onRebuild, tsconfigPath, hmr = true } = {}) {
  const targets = resolveTargets(config);
  const contexts = [];
  for (const target of targets) {
    const options = await buildOptions(config, target, mode, { hmr });
    const ctx = await esbuild.context(options);
    await ctx.watch({
      onRebuild: async (error, result) => {
        if (!error && (mode === 'development' || mode === 'production')) {
          await copyPublicAssets(config);
        }
        await typeCheckProject(tsconfigPath, { throwOnError: false });
        if (onRebuild) {
          onRebuild({ target, error, result });
        }
      }
    });
    contexts.push({ target, ctx });
  }
  if (mode === 'development' || mode === 'production') {
    await copyPublicAssets(config);
  }
  await typeCheckProject(tsconfigPath, { throwOnError: false });
  return contexts;
}

export async function disposeContexts(contexts) {
  await Promise.all(contexts.map(entry => entry.ctx.dispose()));
}

export async function typeCheckProject(tsconfigPath, { throwOnError = true } = {}) {
  try {
    const { diagnostics } = collectDiagnostics({ tsconfigPath });
    if (!diagnostics.length) {
      return true;
    }
    printDiagnostics(diagnostics);
    if (throwOnError) {
      const error = new Error('[goblin] type check failed');
      error.diagnostics = diagnostics;
      throw error;
    }
    console.warn(kleur.yellow('[goblin] continuing despite type errors'));
    return false;
  } catch (error) {
    if (throwOnError) {
      throw error;
    }
    console.error(kleur.red('[goblin] type check failed to run'));
    console.error(error.stack || error.message);
    return false;
  }
}

async function buildOptions(config, target, mode, { hmr = true } = {}) {
  const entries = resolveEntries(config, target).map(path => resolveProjectPath(path));
  const outdir = getOutDir(config, target);
  await mkdir(outdir, { recursive: true });
  const devBanner = mode === 'development' && target === 'client' && hmr ? hmrBanner() : undefined;
  return {
    entryPoints: entries,
    bundle: true,
    splitting: Boolean(config.splitting && target === 'client'),
    outdir,
    format: 'esm',
    sourcemap: Boolean(config.sourcemap),
    minify: Boolean(config.minify && mode === 'production'),
    target: target === 'server' ? 'node20' : 'es2022',
    platform: target === 'server' ? 'node' : 'browser',
    loader: {
      '.gbln': 'ts',
      '.ts': 'ts',
      '.tsx': 'tsx',
      '.js': 'js',
      '.jsx': 'jsx'
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode)
    },
    banner: devBanner ? { js: devBanner } : undefined,
    logLevel: 'info',
    metafile: mode === 'production',
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: 'assets/[name]-[hash]'
  };
}

function hmrBanner() {
  return "if (typeof window !== 'undefined') {window.__goblinEventSource = window.__goblinEventSource || (function(){try{const source=new EventSource('" + HMR_ENDPOINT + "');source.addEventListener('message',function(event){try{const payload=JSON.parse(event.data);if(payload.type==='reload'){window.location.reload();}}catch(error){console.error('[goblin] failed to parse HMR message',error);}});return source;}catch(error){console.warn('[goblin] unable to establish HMR channel', error);}return null;})();}";
}

function resolveEntries(config, target) {
  if (!config.entries) {
    return target === 'server' ? [] : ['src/index.gbln'];
  }
  if (Array.isArray(config.entries)) {
    return config.entries;
  }
  const result = config.entries[target];
  if (!result || result.length === 0) {
    if (target === 'server') {
      return [];
    }
    return ['src/index.gbln'];
  }
  return result;
}

function resolveTargets(config) {
  if (!config.entries) {
    return ['client'];
  }
  if (Array.isArray(config.entries)) {
    return ['client'];
  }
  return Object.keys(config.entries);
}
