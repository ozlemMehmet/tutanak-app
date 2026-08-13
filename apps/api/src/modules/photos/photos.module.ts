import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { PHOTO_MAX_PER_REPORT } from '../../config/config.tokens';
import type { AppEnv } from '../../config/env.schema';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { StorageModule } from '../../infra/storage/storage.module';
import { PhotosController } from './photos.controller';
import { PhotosRepository } from './photos.repository';
import { PhotosService } from './photos.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    // Boyut siniri istek govdesi bellege alinirken uygulanir; asildiginda olusan 413,
    // PhotoUploadLimitInterceptor tarafindan sozlesmedeki 400 FILE_TOO_LARGE'a cevrilir.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        limits: { fileSize: config.get('PHOTO_MAX_BYTES', { infer: true }) },
      }),
    }),
  ],
  controllers: [PhotosController],
  providers: [
    PhotosService,
    PhotosRepository,
    {
      provide: PHOTO_MAX_PER_REPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>): number =>
        config.get('PHOTO_MAX_PER_REPORT', { infer: true }),
    },
  ],
  // Tutanak detayi (GET /reports/{id}) fotograf listesini bu servisten alir.
  exports: [PhotosService],
})
export class PhotosModule {}
