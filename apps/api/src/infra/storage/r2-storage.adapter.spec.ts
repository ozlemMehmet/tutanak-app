// Adapter'in davranis sozlesmesi: gercek ag cagrisi YAPILMAZ (CLAUDE.md §8.1),
// S3 istemcisi ve on-imzalayici sahtelenir; sinanan sey saglayici hatasinin
// ExternalServiceError(STORAGE_UNAVAILABLE) olarak disari cikmasidir (§4.2.1).

import type { ConfigService } from '@nestjs/config';
import { ExternalServiceError } from '../../common/errors/app-error';
import type { AppEnv } from '../../config/env.schema';
import { R2StorageAdapter } from './r2-storage.adapter';

const send = jest.fn();
const getSignedUrlMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]): unknown => getSignedUrlMock(...args),
}));

const ENV: Pick<
  AppEnv,
  | 'R2_BUCKET'
  | 'R2_ENDPOINT'
  | 'R2_ACCESS_KEY_ID'
  | 'R2_SECRET_ACCESS_KEY'
  | 'PRESIGNED_URL_TTL_SECONDS'
> = {
  R2_BUCKET: 'tutanak-photos',
  R2_ENDPOINT: 'http://localhost:9000',
  R2_ACCESS_KEY_ID: 'minioadmin',
  R2_SECRET_ACCESS_KEY: 'minioadmin',
  PRESIGNED_URL_TTL_SECONDS: 900,
};

function adapter(): R2StorageAdapter {
  const config = {
    get: (key: keyof typeof ENV) => ENV[key],
  } as unknown as ConfigService<AppEnv, true>;
  return new R2StorageAdapter(config);
}

/** jest.fn() cagri kayitlari tipsizdir; erisim tek noktada daraltilir. */
function callArg(mock: jest.Mock, callIndex: number, argIndex: number): unknown {
  return (mock.mock.calls as unknown[][])[callIndex]?.[argIndex];
}

const OBJECT = {
  key: 'reports/22222222-2222-4222-8222-222222222222/abc.jpg',
  body: Buffer.from('goruntu-baytlari'),
  contentType: 'image/jpeg',
};

beforeEach(() => {
  send.mockReset();
  getSignedUrlMock.mockReset();
});

describe('R2StorageAdapter.putObject', () => {
  it('objeyi yapilandirilmis kovaya verilen anahtar ve icerik tipiyle yazar', async () => {
    send.mockResolvedValue({});

    await adapter().putObject(OBJECT);

    expect(send).toHaveBeenCalledTimes(1);
    expect((callArg(send, 0, 0) as { input: unknown }).input).toEqual({
      Bucket: ENV.R2_BUCKET,
      Key: OBJECT.key,
      Body: OBJECT.body,
      ContentType: OBJECT.contentType,
    });
  });

  it('depolama erisilemezse 502 STORAGE_UNAVAILABLE firlatir', async () => {
    send.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:9000'));

    const error = await adapter()
      .putObject(OBJECT)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ExternalServiceError);
    expect((error as ExternalServiceError).code).toBe('STORAGE_UNAVAILABLE');
    expect((error as ExternalServiceError).httpStatus).toBe(502);
    // Saglayici ham hata metni istemciye sizmaz (CLAUDE.md §4.3).
    expect((error as ExternalServiceError).message).not.toContain('ECONNREFUSED');
  });
});

describe('R2StorageAdapter.createReadUrl', () => {
  it('yapilandirilmis omurle on-imzali okuma URL"si uretir', async () => {
    getSignedUrlMock.mockResolvedValue('https://r2.test/imzali');

    await expect(adapter().createReadUrl(OBJECT.key)).resolves.toBe('https://r2.test/imzali');
    expect(callArg(getSignedUrlMock, 0, 2)).toEqual({
      expiresIn: ENV.PRESIGNED_URL_TTL_SECONDS,
    });
  });

  it('imzalama basarisiz olursa 502 STORAGE_UNAVAILABLE firlatir', async () => {
    getSignedUrlMock.mockRejectedValue(new Error('imzalama hatasi'));

    await expect(adapter().createReadUrl(OBJECT.key)).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
