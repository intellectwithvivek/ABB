import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DocsHubPageComponent } from './docs-hub-page.component';
import { DOC_CATEGORIES, DOCS_CATALOG } from './docs.catalog';

describe('DocsHubPageComponent', () => {
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DocsHubPageComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('shows one section per category, in order', () => {
    const titles = Array.from(element.querySelectorAll('section h2'), (h2) => h2.textContent);

    expect(titles).toEqual([...DOC_CATEGORIES]);
  });

  it('shows a card for every document, linking to its page', () => {
    const cards = Array.from(element.querySelectorAll<HTMLAnchorElement>('a.card'));

    expect(cards.map((card) => card.getAttribute('href'))).toEqual(
      DOCS_CATALOG.map((doc) => `/docs/${doc.slug}`),
    );
    expect(cards[1].textContent).toContain('Problem statement');
    expect(cards[1].textContent).toContain('docs/PROBLEM_STATEMENT.md');
  });
});
