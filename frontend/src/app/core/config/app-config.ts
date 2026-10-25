import { InjectionToken } from '@angular/core';

/** Settings that differ per deployment; each file in src/environments provides one. */
export interface AppConfig {
  /** REST API root, e.g. 'http://localhost:5000/api', or '/api' when a proxy serves it same-origin. */
  apiBaseUrl: string;
  swaggerUrl: string;
  repositoryUrl: string;
}

// Services inject this token instead of importing the environment file, so app.config.ts is the
// only place that knows which environment was built and tests can supply their own values.
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
