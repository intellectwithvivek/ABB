import { AppConfig } from '../core/config/app-config';

/**
 * APP_CONFIG value for specs. The URLs deliberately differ from every environment file, so a test
 * fails if code reads an environment file instead of the injected token.
 */
export const TEST_APP_CONFIG: AppConfig = {
  apiBaseUrl: 'https://api.test/api',
  swaggerUrl: 'https://api.test/swagger',
  repositoryUrl: 'https://github.com/example/tictactoe',
};
