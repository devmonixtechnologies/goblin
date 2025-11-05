import { readdir, stat } from 'fs/promises';
import { join, relative, dirname } from 'path';
import chokidar from 'chokidar';
import kleur from 'kleur';
import { performance } from 'perf_hooks';
import { loadModule } from './module-loader.mjs';
import { resolveProjectPath } from './compiler.mjs';

const TEST_DIR = 'tests';
const TEST_PATTERN = /\.test\.gbln$/i;

export async function runTests({ watch = false } = {}) {
  const projectTestsDir = resolveProjectPath(TEST_DIR);
  const execute = async () => {
    const files = await collectTestFiles(projectTestsDir);
    if (files.length === 0) {
      console.log(kleur.yellow('[goblin:test] no test files found'));
      return;
    }
    let passed = 0;
    let failed = 0;
    for (const file of files) {
      const relativePath = relative(process.cwd(), file);
      try {
        const mod = await loadModule(file);
        const cases = extractTestCases(mod, relativePath);
        if (cases.length === 0) {
          console.log(kleur.yellow(`[goblin:test] no test cases in ${relativePath}`));
          continue;
        }
        for (const testCase of cases) {
          const start = performance.now();
          await Promise.resolve().then(() => testCase.run());
          const duration = performance.now() - start;
          console.log(
            kleur.green(`[PASS] ${testCase.name}`),
            kleur.dim(`${duration.toFixed(2)}ms`) + kleur.dim(` (${relativePath})`)
          );
          passed += 1;
        }
      } catch (error) {
        failed += 1;
        console.error(kleur.red(`[FAIL] ${relativePath}`));
        console.error(error.stack || error.message);
      }
    }
    const summary = `[goblin:test] ${passed} passed, ${failed} failed`;
    if (failed > 0) {
      console.error(kleur.red(summary));
      throw new Error('Test suite failed');
    }
    console.log(kleur.green(summary));
  };

  await execute();

  if (!watch) {
    return;
  }

  const watcher = chokidar.watch([projectTestsDir, resolveProjectPath('src')], {
    ignoreInitial: true,
    persistent: true
  });

  const rerun = async pathChanged => {
    console.log(kleur.cyan(`[goblin:test] change detected in ${relative(process.cwd(), pathChanged)}`));
    try {
      await execute();
    } catch (error) {
      console.error(kleur.red('[goblin:test] rerun failed'), error);
    }
  };

  watcher.on('add', rerun).on('change', rerun).on('unlink', rerun);
}

async function collectTestFiles(dir) {
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
  const stack = [dir];
  const files = [];
  while (stack.length) {
    const current = stack.pop();
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (TEST_PATTERN.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  return files.sort();
}

function extractTestCases(mod, fileLabel) {
  const cases = [];
  if (Array.isArray(mod.tests)) {
    for (const item of mod.tests) {
      if (item && typeof item.name === 'string' && typeof item.run === 'function') {
        cases.push(item);
      }
    }
  }
  if (typeof mod.default === 'function') {
    cases.push({ name: mod.default.name || fileLabel, run: mod.default });
  }
  const exported = Object.entries(mod).filter(([key]) => key.startsWith('test'));
  for (const [key, value] of exported) {
    if (typeof value === 'function') {
      cases.push({ name: key, run: value });
    }
  }
  return cases;
}
