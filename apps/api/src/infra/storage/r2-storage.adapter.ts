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
const STORAGE_UNAVAILABLE_MESSAGE = 'Fotograf deposuna su anda erisilemiyor, tekrar deneyin.';

@Injectable()
export class R2StorageAdapter implements StoragePort {
  private readonly logger = new Logger(R2StorageAdapter.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly urlTtlSeconds: number;

  constructor(config: ConfigService<AppEnv, true>) {
    this.bucket = config.get('R2_BUCKET', { infer: true });
    this.urlTtlSeconds = config.get('PRESIGNED_URL_TTL_SECONDS', { infer: true });
    this.client = new S3Client({
      region: STORAGE_REGION,
      endpoint: config.get('R2_ENDPOINT', { infer: true }),
      // MinIO sanal-host adresleme kullanmaz; yol tabanli erisim her iki tarafta da calisir.
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.get('R2_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('R2_SECRET_ACCESS_KEY', { infer: true }),
      },
    });
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
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: this.urlTtlSeconds },
      );
    } catch (error: unknown) {
      this.fail('On-imzali okuma URL"si uretilemedi', error);
    }
  }

  /** Saglayici hatasini tek noktada loglar ve sozlesmedeki hataya cevirir. */
  private fail(context: string, error: unknown): never {
    this.logger.error(`${context} (bucket=${this.bucket})`, error);
    throw new ExternalServiceError('STORAGE_UNAVAILABLE', STORAGE_UNAVAILABLE_MESSAGE);
  }
}
