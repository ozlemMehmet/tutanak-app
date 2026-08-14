import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SharingConfig } from '../../config/config.tokens';
import { SHARING_CONFIG } from '../../config/config.tokens';
import type { AppEnv } from '../../config/env.schema';
import { EmailModule } from '../../infra/email/email.module';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { PhotosModule } from '../photos/photos.module';
import { PublicReportController } from './public-report.controller';
import { PublicReportService } from './public-report.service';
import { ShareLinkService } from './share-link.service';
import { SharingController } from './sharing.controller';
import { SharingRepository } from './sharing.repository';

// Bagimlilik yonu tek yonludur: sharing -> photos (reports -> photos ile ayni desen);
// fotograf modulu sharing'i tanimadigi icin modul grafi dongusuz kalir.
@Module({
  imports: [PrismaModule, EmailModule, PhotosModule],
  controllers: [SharingController, PublicReportController],
  providers: [
    ShareLinkService,
    PublicReportService,
    SharingRepository,
    {
      provide: SHARING_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>): SharingConfig => ({
        publicAppUrl: config.get('PUBLIC_APP_URL', { infer: true }),
      }),
    },
  ],
})
export class SharingModule {}
