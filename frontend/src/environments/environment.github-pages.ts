import { AppConfig } from '../app/core/config/app-config';

// GitHub Pages serves static files only, so the API is called cross-origin on Render.
export const environment: AppConfig = {
  apiBaseUrl: 'https://tictactoe-abb-api.onrender.com/api',
  swaggerUrl: 'https://tictactoe-abb-api.onrender.com/swagger',
  repositoryUrl: 'https://github.com/intellectwithvivek/ABB',
};
