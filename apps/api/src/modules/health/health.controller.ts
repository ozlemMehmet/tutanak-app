import { Controller, Get } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
}

/**
 * Altyapi/izleme endpoint'i: `/api/v1` onekinin disindadir ve kimlik dogrulama istemez.
 * api-contract.yaml kapsaminin disindadir (sozlesme basliginda not edilmistir).
 */
@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthStatus {
    return { status: 'ok' };
  }
}
