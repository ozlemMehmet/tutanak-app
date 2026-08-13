import type { ApiClient } from '../../api/client';
import { fetchPhotos, uploadPhoto } from './photos.api';

describe('photos.api', () => {
  const createClientSpy = (): { client: ApiClient; request: jest.Mock } => {
    const request = jest.fn().mockResolvedValue({ id: 'foto-1' });
    return { client: { request }, request };
  };

  describe('uploadPhoto', () => {
    it('dosyayi sozlesmedeki `file` alaniyla POST eder', async () => {
      const { client, request } = createClientSpy();
      const file = new File(['icerik'], 'kamera.jpg', { type: 'image/jpeg' });

      await uploadPhoto(client, 'r-1', file);

      const [path, init] = request.mock.calls[0] as [string, RequestInit];
      expect(path).toBe('/reports/r-1/photos');
      expect(init.method).toBe('POST');
      expect((init.body as FormData).get('file')).toBe(file);
    });

    it('govdeye HICBIR tarih alani koymaz; damga sunucuda uretilir (kabul kriteri 3)', async () => {
      const { client, request } = createClientSpy();
      const file = new File(['icerik'], 'kamera.jpg', { type: 'image/jpeg' });

      await uploadPhoto(client, 'r-1', file);

      const [, init] = request.mock.calls[0] as [string, RequestInit];
      expect([...(init.body as FormData).keys()]).toEqual(['file']);
    });
  });

  describe('fetchPhotos', () => {
    it('tutanagin fotograf listesini GET eder', async () => {
      const { client, request } = createClientSpy();
      request.mockResolvedValue([]);

      await fetchPhotos(client, 'r-1');

      expect(request).toHaveBeenCalledWith('/reports/r-1/photos');
    });
  });
});
