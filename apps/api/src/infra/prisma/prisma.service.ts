// Veritabani baglantisi (CLAUDE.md §1 infra/). Baglanti adresi env'den DOGRUDAN degil,
// dogrulanmis yapilandirma uzerinden gelir (CLAUDE.md §5).

import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import type { AppEnv } from '../../config/env.schema';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<AppEnv, true>) {
    super({ datasourceUrl: config.get('DATABASE_URL', { infer: true }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
