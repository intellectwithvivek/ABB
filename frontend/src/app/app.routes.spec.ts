import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { RouterTestingHarness } from '@angular/router/testing';
import { appConfig } from './app.config';
import { APP_CONFIG } from './core/config/app-config';
import { NotFoundPageComponent } from './core/layout/not-found-page/not-found-page.component';
import { DocViewerPageComponent } from './features/docs/doc-viewer-page.component';
import { DocsHubPageComponent } from './features/docs/docs-hub-page.component';
import { GamePageComponent } from './features/game/game-page.component';
import { HomePageComponent } from './features/home/home-page.component';
import { TEST_APP_CONFIG } from './testing/app-config.fixture';

interface RouteCase {
  url: string;
  page: Type<unknown>;
  title: string;
}

const ROUTE_CASES: RouteCase[] = [
  { url: '/', page: HomePageComponent, title: 'Overview · Tic Tac Toe' },
  { url: '/play', page: GamePageComponent, title: 'Play · Tic Tac Toe' },
  { url: '/docs', page: DocsHubPageComponent, title: 'Documentation · Tic Tac Toe' },
  { url: '/docs/api', page: DocViewerPageComponent, title: 'API reference · Tic Tac Toe' },
  {
    url: '/docs/no-such-doc',
    page: DocViewerPageComponent,
    title: 'Document not found · Tic Tac Toe',
  },
  { url: '/no-such-page', page: NotFoundPageComponent, title: 'Not found · Tic Tac Toe' },
];

describe('app routes', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      // The real application providers, so routing features and the title strategy are the
      // production ones; only the network and the environment-specific config are replaced.
      providers: [
        appConfig.providers,
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: TEST_APP_CONFIG },
      ],
    });
  });

  it.each(ROUTE_CASES)('$url shows its page titled "$title"', async ({ url, page, title }) => {
    const harness = await RouterTestingHarness.create();

    // Throws if the URL activates a different component than `page`.
    await harness.navigateByUrl(url, page);

    expect(TestBed.inject(Title).getTitle()).toBe(title);
  });

  it('passes the :slug parameter to the doc viewer as an input', async () => {
    const harness = await RouterTestingHarness.create();

    const viewer = await harness.navigateByUrl('/docs/testing', DocViewerPageComponent);

    expect(viewer.slug()).toBe('testing');
  });
});
