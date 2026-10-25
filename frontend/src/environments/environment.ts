import { AppConfig } from '../app/core/config/app-config';

// Local development: the API runs separately on port 5000 (see backend launchSettings.json).
export const environment: AppConfig = {
  apiBaseUrl: 'http://localhost:5000/api',
  swaggerUrl: 'http://localhost:5000/swagger',
  repositoryUrl: 'https://github.com/intellectwithvivek/ABB',
};
