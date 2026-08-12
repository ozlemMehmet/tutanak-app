import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerServiceWorker } from './pwa/register-service-worker';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Uygulama kok elemani (#root) bulunamadi');
}

createRoot(rootElement).render(
  <StrictMode>
    <main>
      <h1>Emlak Teslim Tutanagi</h1>
      <p>Uygulama iskeleti hazir.</p>
    </main>
  </StrictMode>,
);

void registerServiceWorker(navigator.serviceWorker);
