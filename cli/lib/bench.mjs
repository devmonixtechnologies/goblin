import { performance } from 'perf_hooks';
import kleur from 'kleur';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { loadModule } from './module-loader.mjs';
import { resolveProjectPath } from './compiler.mjs';

const BENCH_DIR = 'benchmarks';
const BENCH_PATTERN = /\.bench\.gbln$/i;

export async function runBenchmarks({ runs = 5 } = {}) {
  const dir = resolveProjectPath(BENCH_DIR);
  const files = await collectBenchFiles(dir);
  if (files.length === 0) {
    console.log(kleur.yellow('[goblin:bench] no benchmarks found'));
    return;
  }

  for (const file of files) {
    await executeBenchmarkFile(file, runs);
  }
}

async function executeBenchmarkFile(filePath, runs) {
  try {
    const mod = await loadModule(filePath);
    const benches = Object.entries(mod).filter(([key, value]) => typeof value === 'function');
    if (benches.length === 0) {
      console.log(kleur.yellow(`[goblin:bench] no benchmarks in ${filePath}`));
      return;
    }
    console.log(kleur.cyan(`[goblin:bench] running ${filePath}`));
    for (const [name, fn] of benches) {
      await executeBench(name, fn, runs);
    }
  } catch (error) {
    console.error(kleur.red(`[goblin:bench] failed to run ${filePath}`));
    console.error(error.stack || error.message);
  }
}

async function executeBench(name, fn, runs) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await Promise.resolve().then(() => fn());
    const duration = performance.now() - start;
    samples.push(duration);
  }
  const stats = summarize(samples);
  console.log(
    kleur.green(`[benchmark] ${name}`),
    kleur.dim(`avg ${stats.avg.toFixed(3)}ms ±${stats.std.toFixed(3)}ms (n=${runs})`)
  );
}

function summarize(samples) {
  const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const variance = samples.reduce((sum, value) => sum + (value - avg) ** 2, 0) / samples.length;
  return {
    avg,
    std: Math.sqrt(variance)
  };
}

async function collectBenchFiles(dir) {
  try {
    const stats = await stat(dir);
    if (!stats.isDirectory()) {
      return [];
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectBenchFiles(fullPath)));
    } else if (BENCH_PATTERN.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files.sort();
}
