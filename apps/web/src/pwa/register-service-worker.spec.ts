import {
  SERVICE_WORKER_SCOPE,
  SERVICE_WORKER_URL,
  registerServiceWorker,
} from './register-service-worker';

describe('registerServiceWorker', () => {
  it('tarayici destekliyorsa service workeri kaydeder ve kaydi doner', async () => {
    const registration = { scope: SERVICE_WORKER_SCOPE } as ServiceWorkerRegistration;
    const register = jest.fn().mockResolvedValue(registration);
    const container = { register } as unknown as ServiceWorkerContainer;

    const result = await registerServiceWorker(container);

    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_URL, { scope: SERVICE_WORKER_SCOPE });
    expect(result).toBe(registration);
  });

  it('tarayici service worker desteklemiyorsa null doner ve hata firlatmaz', async () => {
    await expect(registerServiceWorker(undefined)).resolves.toBeNull();
  });

  it('kayit basarisiz olursa null doner ve uygulama kabugunu kirmaz', async () => {
    const register = jest.fn().mockRejectedValue(new Error('kayit reddedildi'));
    const container = { register } as unknown as ServiceWorkerContainer;

    await expect(registerServiceWorker(container)).resolves.toBeNull();
    expect(register).toHaveBeenCalledTimes(1);
  });
});
