import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SUBSCRIPTION_CURRENCY } from '../../config/config.tokens';
import type { AppEnv } from '../../config/env.schema';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersRepository,
    {
      provide: SUBSCRIPTION_CURRENCY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>): string =>
        config.get('SUBSCRIPTION_CURRENCY', { infer: true }),
    },
  ],
  exports: [UsersRepository],
})
export class UsersModule {}
