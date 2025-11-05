import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import kleur from 'kleur';
import ts from 'typescript';

export function collectDiagnostics({ tsconfigPath } = {}) {
  const resolvedTsconfig = resolve(tsconfigPath || 'tsconfig.json');
  const configFile = ts.readConfigFile(resolvedTsconfig, fileName => {
    try {
      return readFileSync(fileName, 'utf-8');
    } catch (error) {
      throw new Error(`Unable to read tsconfig at ${fileName}: ${error.message}`);
    }
  });

  const diagnostics = [];
  if (configFile.error) {
    diagnostics.push(configFile.error);
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config ?? {},
    ts.sys,
    dirname(resolvedTsconfig)
  );

  if (parsed.errors?.length) {
    diagnostics.push(...parsed.errors);
  }

  const host = createGoblinCompilerHost(parsed.options);
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  diagnostics.push(...ts.getPreEmitDiagnostics(program));

  return { diagnostics, options: parsed.options };
}

export function printDiagnostics(diagnostics) {
  diagnostics.forEach(diagnostic => {
    console.error(formatDiagnostic(diagnostic));
  });
}

export function formatDiagnostic(diagnostic) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  const category = ts.DiagnosticCategory[diagnostic.category];
  if (diagnostic.file) {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    return `${kleur.red('[goblin:diagnostics]')} ${diagnostic.file.fileName}:${line + 1}:${character + 1} - ${category} TS${diagnostic.code}: ${message}`;
  }
  return `${kleur.red('[goblin:diagnostics]')} ${category} TS${diagnostic.code}: ${message}`;
}

function createGoblinCompilerHost(options) {
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const extension = fileName.slice(fileName.lastIndexOf('.'));
    if (extension === '.gbln') {
      try {
        const source = ts.sys.readFile(fileName, options.charset);
        if (source == null) {
          return undefined;
        }
        return ts.createSourceFile(
          fileName,
          source,
          languageVersion,
          shouldCreateNewSourceFile,
          ts.ScriptKind.TSX
        );
      } catch (error) {
        if (onError) {
          onError(error.message);
          return undefined;
        }
        throw error;
      }
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };
  return host;
}
