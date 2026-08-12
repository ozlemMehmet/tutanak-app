// GET /me — oturum sahibinin profili (api-contract.yaml: T-003, T-012).
// Endpoint adi sozlesmede tekil "me" olarak tanimlidir (CLAUDE.md §2 bilincli istisna).

import { Controller, Get } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { MeDto } from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<MeDto> {
    return this.usersService.getProfile(user.userId);
  }
}
