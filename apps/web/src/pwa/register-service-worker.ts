/** vite-plugin-pwa (generateSW) uretimi service worker dosyasi. */
export const SERVICE_WORKER_URL = '/sw.js';
export const SERVICE_WORKER_SCOPE = '/';

/**
 * Service workeri kaydeder. Kayit basarisiz olursa ya da tarayici desteklemiyorsa
 * uygulama kabugu calismaya devam eder (PWA kurulabilirligi opsiyonel bir katmandir).
 */
export async function registerServiceWorker(
  container: ServiceWorkerContainer | undefined,
): Promise<ServiceWorkerRegistration | null> {
  if (!container) {
    return null;
  }

  try {
    return await container.register(SERVICE_WORKER_URL, { scope: SERVICE_WORKER_SCOPE });
  } catch {
    return null;
  }
}
