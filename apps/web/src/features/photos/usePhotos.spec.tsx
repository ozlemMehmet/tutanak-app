// T-028: yukleme mutation'i, istegi kurmadan ONCE fotografi kucultur (perf raporu P-01).
// Burada olculen sey SINIR: `POST /reports/{id}/photos` govdesine hangi dosyanin girdigi.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ApiClient } from '../../api/client';
import { useUploadPhoto } from './usePhotos';

const ORIGINAL_BYTES = 5_000_000;
const DOWNSCALED_BYTES = 480_000;

function renderUseUploadPhoto(request: jest.Mock): {
  result: { current: ReturnType<typeof useUploadPhoto> };
} {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const client = { request } as unknown as ApiClient;
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useUploadPhoto(client, 'r-1'), { wrapper });
  return { result };
}

/** Tarayicinin goruntu hattini taklit eder (jsdom saglamaz); ayrintili testler downscale-photo.spec.ts'te. */
function stubBrowserImagePipeline(): void {
  Object.defineProperty(globalThis, 'createImageBitmap', {
    value: jest.fn((source: Blob) =>
      Promise.resolve({
        // Yoklama goruntusu (File olmayan Blob) yonu uygulanmis olarak 2x1 doner.
        width: source instanceof File ? 2400 : 2,
        height: source instanceof File ? 3200 : 1,
        close: jest.fn(),
      }),
    ),
    configurable: true,
  });
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ drawImage: jest.fn() } as unknown as CanvasRenderingContext2D);
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, contentType) => {
    callback(new Blob([new ArrayBuffer(DOWNSCALED_BYTES)], { type: String(contentType) }));
  });
}

function uploadedFile(request: jest.Mock): File {
  const [, init] = request.mock.calls[0] as [string, RequestInit];
  return (init.body as FormData).get('file') as File;
}

/**
 * Govdeye giren dosyayi SERILESTIRILEBILIR bicimde ozetler: jsdom `File` nesnesini dogrudan
 * assert'e vermek, test kirildiginda jest'in derin kopyalayicisini cokertir.
 */
function uploadedFileSummary(request: jest.Mock, original: File): string {
  const file = uploadedFile(request);
  return `${file === original ? 'orijinal' : 'kucultulmus'}:${String(file.size)}:${file.type}`;
}

afterEach(() => {
  jest.restoreAllMocks();
  Reflect.deleteProperty(globalThis, 'createImageBitmap');
});

describe('useUploadPhoto', () => {
  const photo = new File([new ArrayBuffer(ORIGINAL_BYTES)], 'kamera.jpg', { type: 'image/jpeg' });

  it('istek yapilmadan ONCE fotografi kucultur, sunucuya kucuk govde gider', async () => {
    stubBrowserImagePipeline();
    const request = jest.fn().mockResolvedValue({ id: 'foto-1' });
    const { result } = renderUseUploadPhoto(request);

    await result.current.mutateAsync(photo);

    await waitFor(() => {
      expect(request).toHaveBeenCalled();
    });
    expect(uploadedFileSummary(request, photo)).toBe(
      `kucultulmus:${String(DOWNSCALED_BYTES)}:image/jpeg`,
    );
  });

  it('kucultme basarisiz olursa orijinal dosya yuklenir ve yukleme HATA VERMEZ', async () => {
    Object.defineProperty(globalThis, 'createImageBitmap', {
      value: jest.fn().mockRejectedValue(new Error('cozulemedi')),
      configurable: true,
    });
    const request = jest.fn().mockResolvedValue({ id: 'foto-1' });
    const { result } = renderUseUploadPhoto(request);

    await result.current.mutateAsync(photo);

    expect(uploadedFileSummary(request, photo)).toBe(
      `orijinal:${String(ORIGINAL_BYTES)}:image/jpeg`,
    );
    expect(result.current.isError).toBe(false);
  });
});
