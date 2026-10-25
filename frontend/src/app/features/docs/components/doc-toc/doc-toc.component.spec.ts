import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TocEntry } from '../../markdown/markdown-renderer';
import { DocTocComponent, MAX_TOC_ENTRIES_WITH_SUBSECTIONS } from './doc-toc.component';

function headings(sections: number, subsectionsPerSection: number): TocEntry[] {
  return Array.from({ length: sections }, (_, s) => [
    { id: `section-${s}`, text: `Section ${s}`, level: 2 as const },
    ...Array.from({ length: subsectionsPerSection }, (_, i) => ({
      id: `section-${s}-${i}`,
      text: `Subsection ${s}.${i}`,
      level: 3 as const,
    })),
  ]).flat();
}

async function renderToc(entries: TocEntry[]): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(DocTocComponent);
  fixture.componentRef.setInput('slug', 'decisions');
  fixture.componentRef.setInput('entries', entries);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('DocTocComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('lists every h2 and h3 heading of a short document', async () => {
    const entries = headings(3, 2);

    const links = (await renderToc(entries)).querySelectorAll('a.entry');

    expect(links).toHaveLength(entries.length);
  });

  it('lists only the sections of a long document', async () => {
    const entries = headings(8, 8);
    expect(entries.length).toBeGreaterThan(MAX_TOC_ENTRIES_WITH_SUBSECTIONS);

    const links = Array.from((await renderToc(entries)).querySelectorAll('a.entry'));

    expect(links.map((link) => link.textContent?.trim())).toEqual(
      Array.from({ length: 8 }, (_, s) => `Section ${s}`),
    );
    expect(links[0].getAttribute('href')).toBe('/docs/decisions#section-0');
  });

  it('keeps every entry of a long document that has no h2 sections', async () => {
    const entries = headings(1, MAX_TOC_ENTRIES_WITH_SUBSECTIONS + 5).filter((e) => e.level === 3);

    const links = (await renderToc(entries)).querySelectorAll('a.entry');

    expect(links).toHaveLength(entries.length);
  });

  it('renders nothing when the document has no headings', async () => {
    expect((await renderToc([])).querySelector('nav')).toBeNull();
  });
});
