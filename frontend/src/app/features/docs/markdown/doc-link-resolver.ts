import { contentUrl, repositoryUrlOf } from '../doc-urls';
import { DocEntry, findDocBySourcePath } from '../docs.catalog';

/** What a link written in a document becomes in the portal. */
export type ResolvedLink =
  /** A page of this app, relative to <base href>, opened by the Angular Router. */
  | { kind: 'in-app'; href: string }
  /** A file published with the site that the browser should download. */
  | { kind: 'download'; href: string }
  /** Another website, or a repository file shown on GitHub; opened in a new tab. */
  | { kind: 'external'; href: string }
  /** Any other scheme (mailto:, …) stays as written. */
  | { kind: 'unchanged'; href: string };

const WEB_URL = /^(https?:)?\/\//i;
const ANY_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/**
 * Rewrites a link the way a reader expects: a link to another catalog document opens it in the
 * portal (keeping its #anchor), the Word original is downloaded, and any other repository path
 * (source code, folders) opens on GitHub. Relative paths resolve against the document's folder,
 * exactly as GitHub resolves them, so the Markdown works the same in both places.
 */
export function resolveDocLink(href: string, doc: DocEntry, repositoryUrl: string): ResolvedLink {
  if (href.startsWith('#')) {
    // A bare "#x" would resolve against <base href> and leave the page, so name the page.
    return { kind: 'in-app', href: `docs/${doc.slug}${href}` };
  }
  if (WEB_URL.test(href)) {
    return { kind: 'external', href };
  }
  if (ANY_SCHEME.test(href)) {
    return { kind: 'unchanged', href };
  }

  const [relativePath, fragment] = splitFragment(href);
  const path = resolveRepositoryPath(doc.sourcePath, relativePath);
  const linkedDoc = findDocBySourcePath(path);
  if (linkedDoc) {
    return { kind: 'in-app', href: `docs/${linkedDoc.slug}${fragment}` };
  }
  if (path.startsWith('docs/assets/')) {
    return { kind: 'download', href: contentUrl(path) };
  }
  const view = relativePath.endsWith('/') ? 'tree' : 'blob';
  return { kind: 'external', href: repositoryUrlOf(repositoryUrl, path, view) + fragment };
}

/** Images under docs/ are published with the site; any other repository image comes from GitHub. */
export function resolveImageSource(src: string, doc: DocEntry, repositoryUrl: string): string {
  if (WEB_URL.test(src) || ANY_SCHEME.test(src)) {
    return src;
  }
  const path = resolveRepositoryPath(doc.sourcePath, src);
  return path.startsWith('docs/') ? contentUrl(path) : repositoryUrlOf(repositoryUrl, path, 'raw');
}

/**
 * Resolves a relative link found in `fromFile` to a path from the repository root:
 * ('docs/AI_WORKFLOW.md', 'SPEC_PROMPT.md') → 'docs/SPEC_PROMPT.md',
 * ('docs/API.md', '../README.md') → 'README.md'.
 * A leading '/' means the repository root, as on GitHub.
 */
export function resolveRepositoryPath(fromFile: string, relativePath: string): string {
  const segments = relativePath.startsWith('/') ? [] : fromFile.split('/').slice(0, -1);
  for (const segment of relativePath.split('/')) {
    if (segment === '..') {
      segments.pop();
    } else if (segment !== '' && segment !== '.') {
      segments.push(segment);
    }
  }
  return segments.join('/');
}

function splitFragment(href: string): [path: string, fragment: string] {
  const hashIndex = href.indexOf('#');
  return hashIndex === -1 ? [href, ''] : [href.slice(0, hashIndex), href.slice(hashIndex)];
}
