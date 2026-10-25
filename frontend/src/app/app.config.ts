import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { APP_CONFIG } from './core/config/app-config';
import { PageTitleStrategy } from './core/routing/page-title.strategy';

// No provideZonelessChangeDetection(): zoneless is the default since Angular 21,
// so change detection is driven by signals instead of zone.js.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // Route parameters such as :slug arrive as component inputs instead of via ActivatedRoute.
      withComponentInputBinding(),
      // New page → scroll to the top; /docs/api#errors → scroll to that heading.
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'top' }),
    ),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideHttpClient(),
    // The only import of the environment file: angular.json swaps it per build configuration.
    { provide: APP_CONFIG, useValue: environment },
  ],
};
