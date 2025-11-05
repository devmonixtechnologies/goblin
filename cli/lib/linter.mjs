import { readFileSync } from 'fs';
import { resolve } from 'path';
import kleur from 'kleur';
import ts from 'typescript';

export async function runLint({ configPath } = {}) {
  const tsconfigPath = resolve(configPath || 'tsconfig.json');
  const configFile = ts.readConfigFile(tsconfigPath, filePath => {
    try {
      return readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Unable to read tsconfig at ${filePath}: ${error.message}`);
    }
  });

  if (configFile.error) {
    reportDiagnostic(configFile.error);
    throw new Error('Failed to parse tsconfig.json');
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, resolve('.'));
  const host = createGoblinCompilerHost(parsed.options);
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);

  const diagnostics = [
    ...ts.getPreEmitDiagnostics(program)
  ];

  if (diagnostics.length === 0) {
    console.log(kleur.green('[goblin:lint] no issues found'));
    return;
  }

  diagnostics.forEach(reportDiagnostic);
  throw new Error(`[goblin:lint] found ${diagnostics.length} issue(s)`);
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
        return ts.createSourceFile(fileName, source, languageVersion, shouldCreateNewSourceFile, ts.ScriptKind.TSX);
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

function reportDiagnostic(diagnostic) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  const category = ts.DiagnosticCategory[diagnostic.category];
  const file = diagnostic.file;
  if (file) {
    const { line, character } = file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    console.error(
      `${kleur.red('[goblin:lint]')} ${file.fileName}:${line + 1}:${character + 1} - ${category} TS${diagnostic.code}: ${message}`
    );
  } else {
    console.error(`${kleur.red('[goblin:lint]')} ${category} TS${diagnostic.code}: ${message}`);
  }
}
