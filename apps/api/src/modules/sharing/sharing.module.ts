import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SharingConfig } from '../../config/config.tokens';
import { SHARING_CONFIG } from '../../config/config.tokens';
import type { AppEnv } from '../../config/env.schema';
import { EmailModule } from '../../infra/email/email.module';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { ShareLinkService } from './share-link.service';
import { SharingController } from './sharing.controller';
import { SharingRepository } from './sharing.repository';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [SharingController],
  providers: [
    ShareLinkService,
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
