import { ViewportScroller } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_CONFIG } from '../../core/config/app-config';
import { TEST_APP_CONFIG } from '../../testing/app-config.fixture';
import { DocViewerPageComponent } from './doc-viewer-page.component';

const API_MARKDOWN = [
  '# API contract',
  'Written for [the spec](SPEC_PROMPT.md).',
  '## Errors',
  'Problem details.',
  '### Not found',
  'Unknown ids.',
].join('\n\n');

describe('DocViewerPageComponent', () => {
  let harness: RouterTestingHarness;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'docs/:slug', component: DocViewerPageComponent }],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: TEST_APP_CONFIG },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => httpTesting.verify());

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url, DocViewerPageComponent);
  }

  async function respondWith(markdown: string, path = 'content/docs/API.md'): Promise<void> {
    httpTesting.expectOne(path).flush(markdown);
    await harness.fixture.whenStable();
  }

  function page(): HTMLElement {
    return harness.fixture.nativeElement;
  }

  function link(text: string): HTMLAnchorElement | undefined {
    return Array.from(page().querySelectorAll('a')).find((anchor) =>
      anchor.textContent?.trim().startsWith(text),
    );
  }

  it('shows the title right away and the rendered Markdown once it arrives', async () => {
    await open('/docs/api');

    expect(page().querySelector('h1')?.textContent).toBe('API reference');
    expect(page().textContent).toContain('Loading document…');

    await respondWith(API_MARKDOWN);

    const heading = page().querySelector('article h2');
    expect(heading?.textContent).toBe('Errors');
    expect(heading?.id).toBe('errors');
    expect(page().textContent).not.toContain('Loading document…');
  });

  it('lists the h2 and h3 headings under "On this page"', async () => {
    await open('/docs/api');
    await respondWith(API_MARKDOWN);

    const entries = Array.from(page().querySelectorAll('app-doc-toc a'), (anchor) =>
      anchor.getAttribute('href'),
    );
    expect(entries).toEqual(['/docs/api#errors', '/docs/api#not-found']);
  });

  it('scrolls to the URL fragment once the document has rendered', async () => {
    const scrollToAnchor = vi
      .spyOn(TestBed.inject(ViewportScroller), 'scrollToAnchor')
      .mockReturnValue(undefined);

    await open('/docs/api#not-found');
    await respondWith(API_MARKDOWN);

    expect(scrollToAnchor).toHaveBeenCalledWith('not-found');
  });

  it('moves keyboard focus to the heading of the URL fragment', async () => {
    vi.spyOn(TestBed.inject(ViewportScroller), 'scrollToAnchor').mockReturnValue(undefined);
    await open('/docs/api#not-found');
    await respondWith(API_MARKDOWN);

    const heading = page().querySelector<HTMLElement>('article h3');
    expect(document.activeElement).toBe(heading);
    expect(heading?.getAttribute('tabindex')).toBe('-1');
  });

  it('opens links to other documents inside the app, without a page reload', async () => {
    await open('/docs/api');
    await respondWith(API_MARKDOWN);

    link('the spec')?.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/docs/spec-prompt');
    expect(page().querySelector('h1')?.textContent).toBe('Specification prompt');
    await respondWith('# Spec', 'content/docs/SPEC_PROMPT.md');
  });

  it('highlights the open document in the sidebar', async () => {
    await open('/docs/api');
    await respondWith(API_MARKDOWN);

    const sidebar = page().querySelector('app-docs-sidebar');
    const active = sidebar?.querySelectorAll('[aria-current="page"]');
    expect(active?.length).toBe(1);
    expect(active?.[0].textContent?.trim()).toBe('API reference');
  });

  it('links to the previous and next documents', async () => {
    await open('/docs/api');
    await respondWith(API_MARKDOWN);

    expect(link('← Previous')?.getAttribute('href')).toBe('/docs/architecture');
    expect(link('Next →')?.getAttribute('href')).toBe('/docs/decisions');
  });

  it('links to the source on GitHub, and offers the Word original for the problem statement', async () => {
    await open('/docs/problem-statement');
    await respondWith('# Brief', 'content/docs/PROBLEM_STATEMENT.md');

    expect(link('View source on GitHub')?.href).toBe(
      `${TEST_APP_CONFIG.repositoryUrl}/blob/main/docs/PROBLEM_STATEMENT.md`,
    );
    const download = link('Download original (.docx)');
    expect(download?.getAttribute('href')).toBe(
      'content/docs/assets/Round-2-Problem-Statement.docx',
    );
    expect(download?.hasAttribute('download')).toBe(true);
  });

  it('shows "Document not found" for an unknown slug and requests nothing', async () => {
    await open('/docs/no-such-doc');

    expect(page().querySelector('h1')?.textContent).toBe('Document not found');
    expect(link('Browse all documents')?.getAttribute('href')).toBe('/docs');
  });

  it('explains that a document is not published yet when its file is missing', async () => {
    await open('/docs/testing');

    httpTesting
      .expectOne('content/docs/TESTING.md')
      .flush('Not found', { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();

    expect(page().textContent).toContain('This document is not published yet');
    expect(link('Read it on GitHub')?.href).toBe(
      `${TEST_APP_CONFIG.repositoryUrl}/blob/main/docs/TESTING.md`,
    );
  });

  it('reports a document that could not be loaded', async () => {
    await open('/docs/api');

    httpTesting.expectOne('content/docs/API.md').error(new ProgressEvent('error'));
    await harness.fixture.whenStable();

    expect(page().querySelector('[role="alert"]')?.textContent).toContain(
      'The document could not be loaded',
    );
  });
});
