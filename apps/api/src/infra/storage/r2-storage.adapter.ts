// Cloudflare R2 / MinIO adapter'i (CLAUDE.md §7). Depolama hatalari disariya
// ExternalServiceError(STORAGE_UNAVAILABLE) olarak cikar; saglayici ham hatasi
// istemciye sizmaz, yalnizca sunucu logunda kalir (§4.2.1, §4.3).

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExternalServiceError } from '../../common/errors/app-error';
import type { AppEnv } from '../../config/env.schema';
import type { StorageObjectInput, StoragePort } from './storage.port';

/** R2 tek bolgelidir; MinIO da bu degeri yok sayar (S3 SDK zorunlu alan istiyor). */
const STORAGE_REGION = 'auto';
const STORAGE_UNAVAILABLE_MESSAGE = 'Fotoğraf deposuna şu anda erişilemiyor, tekrar deneyin.';

interface StorageCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

/** Iki istemci de ayni ayarlarla kurulur; yalnizca adresleri farklidir. */
function createClient(endpoint: string, credentials: StorageCredentials): S3Client {
  return new S3Client({
    region: STORAGE_REGION,
    endpoint,
    // MinIO sanal-host adresleme kullanmaz; yol tabanli erisim her iki tarafta da calisir.
    forcePathStyle: true,
    credentials,
  });
}

@Injectable()
export class R2StorageAdapter implements StoragePort {
  private readonly logger = new Logger(R2StorageAdapter.name);
  /** Sunucudan sunucuya yazma/okuma yolu (docker aginda servis adi olabilir). */
  private readonly client: S3Client;
  /**
   * On-imzali URL'yi imzalayan istemci. SigV4 imzasi host'u da kapsadigi icin URL
   * yalnizca imzalandigi adresle acilabilir; tarayici (masaustu ya da LAN'daki telefon)
   * ic ag adini (`http://minio:9000`) cozemez. Iki adres esitse ayni istemci kullanilir.
   */
  private readonly presignClient: S3Client;
  private readonly bucket: string;
  private readonly urlTtlSeconds: number;

  constructor(config: ConfigService<AppEnv, true>) {
    this.bucket = config.get('R2_BUCKET', { infer: true });
    this.urlTtlSeconds = config.get('PRESIGNED_URL_TTL_SECONDS', { infer: true });
    const credentials = {
      accessKeyId: config.get('R2_ACCESS_KEY_ID', { infer: true }),
      secretAccessKey: config.get('R2_SECRET_ACCESS_KEY', { infer: true }),
    };
    const endpoint = config.get('R2_ENDPOINT', { infer: true });
    const publicEndpoint = config.get('R2_PUBLIC_ENDPOINT', { infer: true });
    this.client = createClient(endpoint, credentials);
    this.presignClient =
      publicEndpoint === endpoint ? this.client : createClient(publicEndpoint, credentials);
  }

  async putObject(input: StorageObjectInput): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    } catch (error: unknown) {
      this.fail('Obje depolamaya yazilamadi', error);
    }
  }

  async createReadUrl(key: string): Promise<string> {
    try {
      return await getSignedUrl(
        this.presignClient,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: this.urlTtlSeconds },
      );
    } catch (error: unknown) {
      this.fail('On-imzali okuma URL"si uretilemedi', error);
    }
  }

  /**
   * Objeyi sunucudan sunucuya (ic ag) okur — on-imzali URL kullanilmaz; PDF uretimi
   * fotograf baytlarina dogrudan ihtiyac duyar. Govdesi olmayan yanit da erisim hatasi
   * sayilir: eksik icerikle yarim PDF uretilmez (CLAUDE.md §4.2.1).
   */
  async getObject(key: string): Promise<Buffer> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (response.Body === undefined) {
        throw new Error('yanit govdesi bos');
      }
      return Buffer.from(await response.Body.transformToByteArray());
    } catch (error: unknown) {
      this.fail('Obje depolamadan okunamadi', error);
    }
  }

  /** Saglayici hatasini tek noktada loglar ve sozlesmedeki hataya cevirir. */
  private fail(context: string, error: unknown): never {
    this.logger.error(`${context} (bucket=${this.bucket})`, error);
    throw new ExternalServiceError('STORAGE_UNAVAILABLE', STORAGE_UNAVAILABLE_MESSAGE);
  }
}
