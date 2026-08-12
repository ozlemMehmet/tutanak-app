// Yapilandirma modulu (CLAUDE.md §1, §5): env okuma yalnizca burada olur,
// dogrulama acilista yapilir — eksik/gecersiz deger varsa uygulama ACILMAZ.

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
