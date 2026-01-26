#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import process from 'process';
import { Command } from 'commander';
import kleur from 'kleur';

const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

const program = new Command();

program
  .name('goblin')
  .description('Goblin framework CLI')
  .version(pkg.version);

function wrapAction(fn) {
  return (...args) => {
    Promise.resolve(fn(...args)).catch(error => {
      console.error(kleur.red(error.stack || error.message));
      process.exitCode = 1;
    });
  };
}

program
  .command('compile')
  .description('Compile .gbln sources to JavaScript')
  .option('-c, --config <path>', 'Path to goblin.config.json')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json')
  .option('-m, --mode <mode>', 'development or production', 'development')
  .option('-p, --preset <name>', 'Apply build preset (e.g. modern)')
  .action(
    wrapAction(async options => {
      const { loadConfig } = await import('./lib/config.mjs');
      const { compileProject } = await import('./lib/compiler.mjs');
      const config = await loadConfig(options.config, { preset: options.preset });
      await compileProject(config, { mode: options.mode, tsconfigPath: options.tsconfig });
    })
  );

program
  .command('build')
  .description('Bundle application for production with optimizations')
  .option('-c, --config <path>', 'Path to goblin.config.json')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json')
  .option('-p, --preset <name>', 'Apply build preset (e.g. modern)')
  .action(
    wrapAction(async options => {
      const { loadConfig } = await import('./lib/config.mjs');
      const { compileProject } = await import('./lib/compiler.mjs');
      const config = await loadConfig(options.config, { preset: options.preset });
      await compileProject(config, { mode: 'production', tsconfigPath: options.tsconfig });
    })
  );

program
  .command('dev')
  .description('Start Goblin dev server with live reload and HMR')
  .option('-c, --config <path>', 'Path to goblin.config.json')
  .option('--host <host>', 'Override host binding')
  .option('-p, --port <port>', 'Override port', value => parseInt(value, 10))
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json')
  .option('-P, --preset <name>', 'Apply dev preset (e.g. modern)')
  .option('--inspect [hostport]', 'Enable Node inspector for server bundle (default 127.0.0.1:9229)')
  .option('--profiling', 'Print incremental build timings')
  .option('--no-hmr', 'Disable HMR reload channel')
  .option('--streaming', 'Force-enable streaming experiments in dev server')
  .option('--no-streaming', 'Disable streaming experiments in dev server')
  .action(
    wrapAction(async options => {
      const { loadConfig } = await import('./lib/config.mjs');
      const { startDevServer } = await import('./lib/dev-server.mjs');
      const config = await loadConfig(options.config, { preset: options.preset });
      await startDevServer(config, options);
    })
  );

program
  .command('preview')
  .description('Preview the production build with a static file server')
  .option('-c, --config <path>', 'Path to goblin.config.json')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json')
  .option('--host <host>', 'Override preview host', '127.0.0.1')
  .option('-p, --port <port>', 'Override preview port', value => parseInt(value, 10), 4173)
  .option('-P, --preset <name>', 'Apply preset before building (e.g. modern)')
  .action(
    wrapAction(async options => {
      const { loadConfig } = await import('./lib/config.mjs');
      const { compileProject } = await import('./lib/compiler.mjs');
      const { createPreviewServer } = await import('./lib/preview-server.mjs');
      const config = await loadConfig(options.config, { preset: options.preset });
      await compileProject(config, { mode: 'production', tsconfigPath: options.tsconfig });
      const server = await createPreviewServer(config, { port: options.port, host: options.host });
      server.listen(() => {
        console.log(kleur.cyan(`[goblin] preview server running at ${server.url}`));
      });
    })
  );

program
  .command('test')
  .description('Run Goblin test harness over *.test.gbln files')
  .option('--watch', 'Re-run tests on file changes', false)
  .action(
    wrapAction(async options => {
      const { runTests } = await import('./lib/tester.mjs');
      await runTests({ watch: Boolean(options.watch) });
    })
  );

program
  .command('lint')
  .description('Type-check and validate project structure')
  .option('-c, --config <path>', 'Path to tsconfig.json')
  .action(
    wrapAction(async options => {
      const { runLint } = await import('./lib/linter.mjs');
      await runLint({ configPath: options.config });
    })
  );

program
  .command('bench')
  .description('Execute benchmark suites in benchmarks/**/*.bench.gbln')
  .option('-r, --runs <count>', 'Number of runs per benchmark', value => parseInt(value, 10), 5)
  .action(
    wrapAction(async options => {
      const { runBenchmarks } = await import('./lib/bench.mjs');
      await runBenchmarks({ runs: options.runs });
    })
  );

program
  .command('templates')
  .description('List available Goblin starter templates')
  .option('--json', 'Emit template metadata as JSON', false)
  .action(
    wrapAction(async options => {
      if (options.json) {
        const { listTemplates } = await import('./lib/scaffold.mjs');
        const templates = await listTemplates();
        console.log(JSON.stringify(templates, null, 2));
        return;
      }
      const { printTemplateList } = await import('./lib/scaffold.mjs');
      await printTemplateList();
    })
  );

program
  .command('create')
  .description('Scaffold a new project from a Goblin template')
  .argument('<template>', 'Template name to scaffold')
  .argument('[directory]', 'Destination directory (defaults to template name)')
  .option('--list', 'List templates before scaffolding', false)
  .action(
    wrapAction(async (template, directory, options) => {
      if (options.list) {
        const { printTemplateList } = await import('./lib/scaffold.mjs');
        await printTemplateList();
      }
      const { scaffoldProject } = await import('./lib/scaffold.mjs');
      await scaffoldProject(template, directory);
    })
  );

program.parseAsync(process.argv);
