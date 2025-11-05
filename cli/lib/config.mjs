import { readFile, access } from 'fs/promises';
import { resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const defaults = {
  entries: {
    client: ['src/index.gbln'],
    server: ['src/server/index.gbln']
  },
  outDir: {
    client: 'dist/client',
    server: 'dist/server'
  },
  splitting: true,
  minify: false,
  sourcemap: true,
  publicDir: 'public',
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  experiments: {
    suspense: true,
    streaming: true
  },
  templates: {
    react: '@goblin/templates-react',
    vue: '@goblin/templates-vue',
    svelte: '@goblin/templates-svelte'
  }
};

const presetDefinitions = {
  modern: {
    splitting: true,
    minify: true,
    sourcemap: true,
    experiments: {
      suspense: true,
      streaming: true
    }
  }
};

export const availablePresets = Object.freeze(Object.keys(presetDefinitions));

export async function loadConfig(configPath, options = {}) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const resolvedPath = configPath ? resolve(configPath) : resolve(root, '../goblin.config.json');
  const requestedPreset = options.preset;

  try {
    await access(resolvedPath);
    const source = await readFile(resolvedPath, 'utf-8');
    const loaded = JSON.parse(source);
    const config = merge(defaults, loaded);
    return applyPreset(config, requestedPreset ?? config.preset);
  } catch (error) {
    if (configPath) {
      throw error;
    }
    return applyPreset({ ...defaults }, requestedPreset);
  }
}

function applyPreset(config, presetName) {
  if (!presetName) {
    return config;
  }
  const preset = presetDefinitions[presetName];
  if (!preset) {
    throw new Error(`Unknown Goblin preset: ${presetName}`);
  }
  const merged = merge(config, preset);
  merged.preset = presetName;
  return merged;
}

function merge(base, override) {
  if (Array.isArray(base) && Array.isArray(override)) {
    return [...base, ...override];
  }
  if (isPlainObject(base) && isPlainObject(override)) {
    const entries = new Set([...Object.keys(base), ...Object.keys(override)]);
    const result = {};
    for (const key of entries) {
      if (key in override) {
        result[key] = key in base ? merge(base[key], override[key]) : override[key];
      } else {
        result[key] = base[key];
      }
    }
    return result;
  }
  return override ?? base;
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}
