import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

export interface HealthStatus {
  status: 'ok';
}

/**
 * Altyapi/izleme endpoint'i: `/api/v1` onekinin disindadir ve kimlik dogrulama istemez.
 * api-contract.yaml kapsaminin disindadir (sozlesme basliginda not edilmistir).
 * T-003 ile gelen global JwtAuthGuard varsayilan olarak kapali oldugu icin bu endpoint
 * acikca @Public() isaretlenir.
 */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  getHealth(): HealthStatus {
    return { status: 'ok' };
  }
}
