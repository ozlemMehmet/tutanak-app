import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { readAccessToken } from './api/access-token';
import { createApiClient } from './api/client';
import { registerServiceWorker } from './pwa/register-service-worker';
import './styles/tokens.css';
import './styles/app.css';

// API ayni kaynaktan servis edilir: yerelde Vite gelistirme vekili, uretimde ters vekil
// `/api` yolunu API'ye tasir. Boylece tarayici capraz kaynak (CORS) istegi yapmaz.
const API_BASE_URL = '/api/v1';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Uygulama kok elemani (#root) bulunamadi');
}

const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  readAccessToken: () => readAccessToken(window.localStorage),
});

createRoot(rootElement).render(
  <StrictMode>
    <App client={apiClient} />
  </StrictMode>,
);

void registerServiceWorker(navigator.serviceWorker);
