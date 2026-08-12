import type { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.schema';
import { JwtStrategy } from './jwt.strategy';

function strategy(): JwtStrategy {
  const config = {
    get: jest.fn().mockReturnValue('test-ortami-icin-yeterince-uzun-imzalama-anahtari'),
  } as unknown as ConfigService<AppEnv, true>;
  return new JwtStrategy(config);
}

describe('JwtStrategy.validate', () => {
  it("token payload'indaki sub ve email alanlarini oturum kullanicisina cevirir", () => {
    expect(
      strategy().validate({
        sub: '11111111-1111-4111-8111-111111111111',
        email: 'selin@ornek.test',
      }),
    ).toEqual({ userId: '11111111-1111-4111-8111-111111111111', email: 'selin@ornek.test' });
  });
});
