import * as esbuild from 'esbuild';
import { isAbsolute } from 'path';
import { Buffer } from 'buffer';
import { resolveProjectPath } from './compiler.mjs';

const loader = {
  '.gbln': 'ts',
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.js': 'js',
  '.jsx': 'jsx'
};

export async function loadModule(filePath) {
  const absolute = isAbsolute(filePath) ? filePath : resolveProjectPath(filePath);
  const result = await esbuild.build({
    entryPoints: [absolute],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    target: 'node20',
    sourcemap: 'inline',
    loader,
    logLevel: 'silent'
  });
  const output =
    result.outputFiles.find(item => item.path.endsWith('.js')) ?? result.outputFiles[0];
  if (!output) {
    throw new Error(`Unable to compile module: ${absolute}`);
  }
  const serialized = Buffer.from(output.text, 'utf-8').toString('base64');
  const url = `data:text/javascript;base64,${serialized}#${Date.now()}`;
  return import(url);
}
