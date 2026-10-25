import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DocsService } from './docs.service';

describe('DocsService', () => {
  let service: DocsService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DocsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads the Markdown as text from a URL relative to <base href>', () => {
    let markdown: string | undefined;

    service.getMarkdown('docs/API.md').subscribe((text) => (markdown = text));

    // No leading slash: under <base href="/ABB/"> this becomes /ABB/content/docs/API.md.
    const request = httpTesting.expectOne('content/docs/API.md');
    expect(request.request.responseType).toBe('text');
    request.flush('# API contract', { headers: { 'Content-Type': 'text/markdown' } });
    expect(markdown).toBe('# API contract');
  });

  it('passes a missing file on as a 404 error', () => {
    let error: HttpErrorResponse | undefined;

    service.getMarkdown('docs/TESTING.md').subscribe({ error: (e) => (error = e) });

    httpTesting
      .expectOne('content/docs/TESTING.md')
      .flush('Not found', { status: 404, statusText: 'Not Found' });
    expect(error?.status).toBe(404);
  });

  it("treats a host's index.html fallback for a missing file as a 404", () => {
    let error: HttpErrorResponse | undefined;

    service.getMarkdown('docs/TESTING.md').subscribe({ error: (e) => (error = e) });

    httpTesting.expectOne('content/docs/TESTING.md').flush('<!doctype html><app-root></app-root>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    expect(error?.status).toBe(404);
  });
});
