import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { createThrottlerOptions } from './common/guards/rate-limit.factory';
import { AppConfigModule } from './config/config.module';
import type { AppEnv } from './config/env.schema';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { HealthModule } from './modules/health/health.module';
import { PhotosModule } from './modules/photos/photos.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SharingModule } from './modules/sharing/sharing.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    // Hiz siniri (T-014): degerler env'den okunur, koda gomulmez (CLAUDE.md §5.1).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) =>
        createThrottlerOptions({
          windowSeconds: config.get('RATE_LIMIT_WINDOW_SECONDS', { infer: true }),
          defaultMaxRequests: config.get('RATE_LIMIT_MAX_REQUESTS', { infer: true }),
          strictMaxRequests: config.get('AUTH_RATE_LIMIT_MAX_REQUESTS', { infer: true }),
        }),
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    TemplatesModule,
    ReportsModule,
    BillingModule,
    PhotosModule,
    SharingModule,
    ApprovalsModule,
  ],
  providers: [
    // SIRA BAGLAYICI (T-014): hiz siniri kimlik dogrulamasindan ONCE calisir; aksi halde
    // kimliksiz kaba kuvvet istekleri once auth maliyetini (JWT dogrulama/bcrypt) odetirdi.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Kimlik dogrulama VARSAYILAN OLARAK KAPALI; istisnalar @Public() ile isaretlenir
    // (api-contract.yaml: /public/* disindaki her endpoint bearerAuth ister).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
