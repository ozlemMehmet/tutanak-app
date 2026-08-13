import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppConfigModule } from './config/config.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [AppConfigModule, HealthModule, AuthModule, UsersModule, TemplatesModule, ReportsModule],
  providers: [
    // Kimlik dogrulama VARSAYILAN OLARAK KAPALI; istisnalar @Public() ile isaretlenir
    // (api-contract.yaml: /public/* disindaki her endpoint bearerAuth ister).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
