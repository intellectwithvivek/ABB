// Publishes the repository's README.md and docs/ folder with the site, under public/content/, so the
// in-app docs viewer renders the very files reviewers read on GitHub (one source of truth).
// The Angular builder refuses asset folders outside the workspace (frontend/), hence this copy step;
// package.json runs it before `npm start` and `npm run build`.
import { cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = join(frontendRoot, '..');
const contentRoot = join(frontendRoot, 'public', 'content');

// Start clean so a document deleted from docs/ also disappears from the site.
rmSync(contentRoot, { recursive: true, force: true });
cpSync(join(repositoryRoot, 'README.md'), join(contentRoot, 'README.md'));
cpSync(join(repositoryRoot, 'docs'), join(contentRoot, 'docs'), { recursive: true });

console.log(`Copied README.md and docs/ to ${contentRoot}`);
