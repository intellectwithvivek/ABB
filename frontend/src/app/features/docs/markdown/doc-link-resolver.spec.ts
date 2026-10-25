import { resolveRepositoryPath } from './doc-link-resolver';

describe('resolveRepositoryPath', () => {
  it('resolves a plain file name against the folder of the current document', () => {
    expect(resolveRepositoryPath('docs/AI_WORKFLOW.md', 'SPEC_PROMPT.md')).toBe(
      'docs/SPEC_PROMPT.md',
    );
  });

  it('resolves paths from the repository root document', () => {
    expect(resolveRepositoryPath('README.md', 'docs/API.md')).toBe('docs/API.md');
  });

  it('follows ./ and ../ segments', () => {
    expect(resolveRepositoryPath('docs/API.md', '../README.md')).toBe('README.md');
    expect(resolveRepositoryPath('docs/API.md', './assets/../DECISIONS.md')).toBe(
      'docs/DECISIONS.md',
    );
  });

  it('treats a leading slash as the repository root, as GitHub does', () => {
    expect(resolveRepositoryPath('docs/API.md', '/backend/Dockerfile')).toBe('backend/Dockerfile');
  });
});
