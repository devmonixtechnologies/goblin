import { cp, mkdir, readdir, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import kleur from 'kleur';

const cliDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(cliDir, '../..');
const templatesRoot = resolve(projectRoot, 'templates');

export async function listTemplates() {
  try {
    const entries = await readdir(templatesRoot, { withFileTypes: true });
    const templates = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const templatePath = join(templatesRoot, entry.name);
      const description = await readTemplateDescription(templatePath);
      templates.push({
        name: entry.name,
        path: templatePath,
        description
      });
    }
    return templates.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function scaffoldProject(templateName, destinationDir) {
  if (!templateName) {
    throw new Error('Template name is required');
  }
  const templates = await listTemplates();
  const template = templates.find(entry => entry.name === templateName);
  if (!template) {
    const available = templates.map(entry => entry.name).join(', ') || 'none';
    throw new Error(`Unknown template "${templateName}". Available templates: ${available}`);
  }

  const destination = resolve(process.cwd(), destinationDir || templateName);
  await assertDestinationIsWritable(destination);

  await mkdir(destination, { recursive: true });
  await cp(template.path, destination, { recursive: true });

  console.log(kleur.green(`[goblin] created ${templateName} in ${destination}`));
  console.log(kleur.gray('Next steps:'));
  console.log(`  cd ${destination}`);
  console.log('  npm install');
  console.log('  npm run dev');
}

async function readTemplateDescription(templatePath) {
  try {
    const pkgSource = await readFile(join(templatePath, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgSource);
    return pkg.description || '';
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

async function assertDestinationIsWritable(destination) {
  if (!existsSync(destination)) {
    return;
  }
  const stats = await stat(destination);
  if (!stats.isDirectory()) {
    throw new Error(`Destination ${destination} exists and is not a directory`);
  }
  const contents = await readdir(destination);
  if (contents.length > 0) {
    throw new Error(`Destination ${destination} is not empty`);
  }
}

export async function printTemplateList() {
  const templates = await listTemplates();
  if (templates.length === 0) {
    console.log(kleur.yellow('[goblin] no templates available'));
    return;
  }
  console.log(kleur.cyan('[goblin] available templates'));
  for (const template of templates) {
    const description = template.description ? ` - ${template.description}` : '';
    console.log(`  • ${template.name}${description}`);
  }
}
