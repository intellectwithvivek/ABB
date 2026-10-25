/** The branch the portal links to; source links always show the published code. */
const REPOSITORY_BRANCH = 'main';

/**
 * URL of a repository file published with the site (scripts/copy-docs.mjs copies README.md and
 * docs/ to content/). Relative, so it resolves against <base href> rather than the site root.
 */
export function contentUrl(repositoryPath: string): string {
  return `content/${repositoryPath}`;
}

/** GitHub's views: 'blob' shows a file, 'tree' a folder, 'raw' serves a file's bytes (images). */
export type RepositoryView = 'blob' | 'tree' | 'raw';

export function repositoryUrlOf(
  repositoryUrl: string,
  repositoryPath: string,
  view: RepositoryView = 'blob',
): string {
  return `${repositoryUrl}/${view}/${REPOSITORY_BRANCH}/${repositoryPath}`;
}
