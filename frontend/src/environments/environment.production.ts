import { AppConfig } from '../app/core/config/app-config';

// Vercel serves the app and proxies /api and /swagger to the API (see vercel.json), so relative
// URLs keep the browser on one origin and no CORS is needed.
export const environment: AppConfig = {
  apiBaseUrl: '/api',
  swaggerUrl: '/swagger',
  repositoryUrl: 'https://github.com/intellectwithvivek/ABB',
};
