import { AppConfig } from '../app/core/config/app-config';

// Same-origin hosting (Docker/nginx, Vercel, DigitalOcean): the host proxies /api and /swagger to
// the API, so relative URLs work and the browser needs no CORS.
export const environment: AppConfig = {
  apiBaseUrl: '/api',
  swaggerUrl: '/swagger',
  repositoryUrl: 'https://github.com/intellectwithvivek/ABB',
};
