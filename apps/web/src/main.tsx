import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createSessionStore } from './features/auth/session';
import { createSessionAwareClient } from './features/auth/session-client';
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

// Oturum kaynagi ve API istemcisi ayni yerde kurulur: istemci token'i buradan okur ve 401
// aldiginda oturumu burada bitirir (T-017).
const session = createSessionStore(window.localStorage);
const apiClient = createSessionAwareClient({ baseUrl: API_BASE_URL, session });

createRoot(rootElement).render(
  <StrictMode>
    <App client={apiClient} session={session} />
  </StrictMode>,
);

void registerServiceWorker(navigator.serviceWorker);
