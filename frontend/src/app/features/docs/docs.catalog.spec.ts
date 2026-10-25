import {
  DOC_CATEGORIES,
  DOC_SECTIONS,
  DOCS_CATALOG,
  findAdjacentDocs,
  findDocBySlug,
  findDocBySourcePath,
} from './docs.catalog';

describe('docs catalog', () => {
  it('gives every document a unique slug and a unique source file', () => {
    const slugs = DOCS_CATALOG.map((doc) => doc.slug);
    const sourcePaths = DOCS_CATALOG.map((doc) => doc.sourcePath);

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(sourcePaths).size).toBe(sourcePaths.length);
  });

  it('puts every document in a known category and leaves no category empty', () => {
    for (const doc of DOCS_CATALOG) {
      expect(DOC_CATEGORIES).toContain(doc.category);
    }
    for (const section of DOC_SECTIONS) {
      expect(section.docs.length).toBeGreaterThan(0);
    }
  });

  it('lists documents in sidebar order, so previous/next follow what the reader sees', () => {
    const sidebarOrder = DOC_SECTIONS.flatMap((section) => section.docs);

    expect(sidebarOrder).toEqual(DOCS_CATALOG);
  });

  it('points every entry at a Markdown file from the repository root', () => {
    for (const doc of DOCS_CATALOG) {
      expect(doc.sourcePath).toMatch(/^(docs\/)?[A-Z_]+\.md$/);
    }
  });

  it('offers the Word original only for the problem statement', () => {
    const withOriginal = DOCS_CATALOG.filter((doc) => doc.originalPath);

    expect(withOriginal.map((doc) => doc.slug)).toEqual(['problem-statement']);
    expect(withOriginal[0].originalPath).toBe('docs/assets/Round-2-Problem-Statement.docx');
  });

  it('finds documents by slug and by source path', () => {
    expect(findDocBySlug('api')?.sourcePath).toBe('docs/API.md');
    expect(findDocBySourcePath('README.md')?.slug).toBe('readme');
    expect(findDocBySlug('no-such-doc')).toBeUndefined();
  });

  it('has no previous document before the first one and no next one after the last', () => {
    const first = DOCS_CATALOG[0];
    const last = DOCS_CATALOG[DOCS_CATALOG.length - 1];

    expect(findAdjacentDocs(first)).toEqual({ previous: undefined, next: DOCS_CATALOG[1] });
    expect(findAdjacentDocs(last).next).toBeUndefined();
  });
});
