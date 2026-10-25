import { ResolveFn, Routes } from '@angular/router';

/**
 * The open document's title, so each tab reads e.g. "API reference · Tic Tac Toe". The catalog is
 * imported lazily, like the docs pages themselves, so it stays out of the initial bundle.
 */
const docTitle: ResolveFn<string> = (route) =>
  import('./features/docs/docs.catalog').then(
    (m) => m.findDocBySlug(route.paramMap.get('slug') ?? '')?.title ?? 'Document not found',
  );

// loadComponent makes every page its own lazy chunk, so the initial download stays small and
// heavy page-only code (e.g. the markdown renderer) is fetched only when that page is opened.
// Titles get the app name appended by PageTitleStrategy.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Overview',
    loadComponent: () =>
      import('./features/home/home-page.component').then((m) => m.HomePageComponent),
  },
  {
    path: 'play',
    title: 'Play',
    loadComponent: () =>
      import('./features/game/game-page.component').then((m) => m.GamePageComponent),
  },
  {
    path: 'docs',
    title: 'Documentation',
    loadComponent: () =>
      import('./features/docs/docs-hub-page.component').then((m) => m.DocsHubPageComponent),
  },
  {
    path: 'docs/:slug',
    title: docTitle,
    loadComponent: () =>
      import('./features/docs/doc-viewer-page.component').then((m) => m.DocViewerPageComponent),
  },
  {
    path: '**',
    title: 'Not found',
    loadComponent: () =>
      import('./core/layout/not-found-page/not-found-page.component').then(
        (m) => m.NotFoundPageComponent,
      ),
  },
];
