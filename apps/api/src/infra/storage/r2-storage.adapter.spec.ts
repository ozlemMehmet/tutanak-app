// Adapter'in davranis sozlesmesi: gercek ag cagrisi YAPILMAZ (CLAUDE.md §8.1),
// S3 istemcisi ve on-imzalayici sahtelenir; sinanan sey saglayici hatasinin
// ExternalServiceError(STORAGE_UNAVAILABLE) olarak disari cikmasidir (§4.2.1).

import { S3Client } from '@aws-sdk/client-s3';
import type { ConfigService } from '@nestjs/config';
import { ExternalServiceError } from '../../common/errors/app-error';
import type { AppEnv } from '../../config/env.schema';
import { R2StorageAdapter } from './r2-storage.adapter';

const send = jest.fn();
const getSignedUrlMock = jest.fn();
/** Her `send` cagrisinda hangi endpoint ile kurulmus istemcinin kullanildigini kaydeder. */
const sendEndpoints: string[] = [];

jest.mock('@aws-sdk/client-s3', () => ({
  // Istemci, kuruldugu endpoint'i tasir; boylece imzalamanin hangi adresle
  // yapildigi (tarayiciya donen URL'nin host'u) sinanabilir.
  S3Client: jest.fn().mockImplementation((options: { endpoint: string }) => ({
    options,
    send: (command: unknown): unknown => {
      sendEndpoints.push(options.endpoint);
      return send(command);
    },
  })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]): unknown => getSignedUrlMock(...args),
}));

type StorageEnv = Pick<
  AppEnv,
  | 'R2_BUCKET'
  | 'R2_ENDPOINT'
  | 'R2_PUBLIC_ENDPOINT'
  | 'R2_ACCESS_KEY_ID'
  | 'R2_SECRET_ACCESS_KEY'
  | 'PRESIGNED_URL_TTL_SECONDS'
>;

const ENV: StorageEnv = {
  R2_BUCKET: 'tutanak-photos',
  R2_ENDPOINT: 'http://localhost:9000',
  R2_PUBLIC_ENDPOINT: 'http://localhost:9000',
  R2_ACCESS_KEY_ID: 'minioadmin',
  R2_SECRET_ACCESS_KEY: 'minioadmin',
  PRESIGNED_URL_TTL_SECONDS: 900,
};

function adapter(overrides: Partial<StorageEnv> = {}): R2StorageAdapter {
  const env: StorageEnv = { ...ENV, ...overrides };
  const config = {
    get: (key: keyof StorageEnv) => env[key],
  } as unknown as ConfigService<AppEnv, true>;
  return new R2StorageAdapter(config);
}

/** Imzalamada kullanilan istemcinin kuruldugu endpoint (URL'nin host'u buradan gelir). */
function signingEndpoint(): string {
  const client = callArg(getSignedUrlMock, 0, 0) as { options: { endpoint: string } };
  return client.options.endpoint;
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

/** Kurulan S3 istemcisi sayisi; uygulamayi degil yalnizca cagri kaydini temizler. */
const s3ClientMock = S3Client as unknown as jest.Mock;

beforeEach(() => {
  send.mockReset();
  getSignedUrlMock.mockReset();
  s3ClientMock.mockClear();
  sendEndpoints.length = 0;
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

// T-006 QA iadesi: uretilen URL'yi TARAYICI acar. SigV4 imzasi host'u da kapsadigi icin
// URL, imzalandigi endpoint ile acilmak zorundadir; ic ag adiyla (http://minio:9000)
// imzalanan URL ne masaustu tarayicida ne de LAN'daki telefonda cozulebilir.
describe('R2StorageAdapter on-imzali URL adresi (ic ag vs. tarayici)', () => {
  const SPLIT_ENV = {
    R2_ENDPOINT: 'http://minio:9000',
    R2_PUBLIC_ENDPOINT: 'http://localhost:9000',
  };

  it('okuma URL"sini tarayicidan erisilebilen R2_PUBLIC_ENDPOINT ile imzalar', async () => {
    getSignedUrlMock.mockResolvedValue('http://localhost:9000/tutanak-photos/abc.jpg?imza');

    await adapter(SPLIT_ENV).createReadUrl(OBJECT.key);

    expect(signingEndpoint()).toBe(SPLIT_ENV.R2_PUBLIC_ENDPOINT);
    expect(signingEndpoint()).not.toBe(SPLIT_ENV.R2_ENDPOINT);
  });

  it('yazmayi ic ag endpoint"i uzerinden yapar (sunucudan sunucuya yol degismez)', async () => {
    send.mockResolvedValue({});

    await adapter(SPLIT_ENV).putObject(OBJECT);

    expect(sendEndpoints).toEqual([SPLIT_ENV.R2_ENDPOINT]);
  });

  it('iki adres ayni oldugunda tek istemci kullanir (tek adresli uretim kurulumu)', async () => {
    getSignedUrlMock.mockResolvedValue('http://localhost:9000/tutanak-photos/abc.jpg?imza');
    send.mockResolvedValue({});

    const single = adapter({ R2_ENDPOINT: ENV.R2_PUBLIC_ENDPOINT });
    await single.putObject(OBJECT);
    await single.createReadUrl(OBJECT.key);

    expect(s3ClientMock).toHaveBeenCalledTimes(1);
    expect(signingEndpoint()).toBe(ENV.R2_PUBLIC_ENDPOINT);
    expect(sendEndpoints).toEqual([ENV.R2_PUBLIC_ENDPOINT]);
  });
});

// T-007: PDF uretimi fotograf baytlarini SUNUCUDA okur (on-imzali URL ile degil).
describe('R2StorageAdapter.getObject', () => {
  it('objenin baytlarini yapilandirilmis kovadan verilen anahtarla okur', async () => {
    send.mockResolvedValue({
      Body: { transformToByteArray: () => Promise.resolve(new Uint8Array(OBJECT.body)) },
    });

    const result = await adapter().getObject(OBJECT.key);

    expect((callArg(send, 0, 0) as { input: unknown }).input).toEqual({
      Bucket: ENV.R2_BUCKET,
      Key: OBJECT.key,
    });
    expect(result.equals(OBJECT.body)).toBe(true);
  });

  it('okuma ic ag endpoint"i uzerinden yapilir (sunucudan sunucuya yol)', async () => {
    send.mockResolvedValue({
      Body: { transformToByteArray: () => Promise.resolve(new Uint8Array(OBJECT.body)) },
    });

    await adapter({
      R2_ENDPOINT: 'http://minio:9000',
      R2_PUBLIC_ENDPOINT: 'http://localhost:9000',
    }).getObject(OBJECT.key);

    expect(sendEndpoints).toEqual(['http://minio:9000']);
  });

  it('depolama erisilemezse 502 STORAGE_UNAVAILABLE firlatir', async () => {
    send.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:9000'));

    const error = await adapter()
      .getObject(OBJECT.key)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ExternalServiceError);
    expect((error as ExternalServiceError).code).toBe('STORAGE_UNAVAILABLE');
    // Saglayici ham hata metni istemciye sizmaz (CLAUDE.md §4.3).
    expect((error as ExternalServiceError).message).not.toContain('ECONNREFUSED');
  });

  it('yanit govdesi bos gelirse 502 STORAGE_UNAVAILABLE firlatir (yarim icerik kullanilmaz)', async () => {
    send.mockResolvedValue({});

    await expect(adapter().getObject(OBJECT.key)).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
