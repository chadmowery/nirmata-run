import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ShellRegistry } from './shell-registry';
import { ShellTemplate } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, '../shared/templates');
export const globalShellRegistry = new ShellRegistry();

if (fs.existsSync(TEMPLATES_DIR)) {
  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const filePath = path.join(TEMPLATES_DIR, file);
    const template: ShellTemplate = JSON.parse(
      fs.readFileSync(filePath, 'utf-8')
    );
    globalShellRegistry.register(template);
  }
}
