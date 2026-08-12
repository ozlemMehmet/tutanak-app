import { Inject, Injectable } from '@nestjs/common';
import { UnauthenticatedError } from '../../common/errors/app-error';
import { SUBSCRIPTION_CURRENCY } from '../../config/config.tokens';
import type { MeDto } from './dto/user.dto';
import { toMeDto } from './mappers/user.mapper';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    @Inject(SUBSCRIPTION_CURRENCY) private readonly defaultCurrency: string,
  ) {}

  async getProfile(userId: string): Promise<MeDto> {
    const profile = await this.usersRepository.findProfileById(userId);
    if (profile === null) {
      // Token imzali ama kullanici artik yok: oturum gecersizdir (sozlesmede /me icin
      // tanimli tek hata yaniti 401'dir).
      throw new UnauthenticatedError('UNAUTHENTICATED', 'Oturum gecerli degil.');
    }
    return toMeDto(profile, this.defaultCurrency);
  }
}
