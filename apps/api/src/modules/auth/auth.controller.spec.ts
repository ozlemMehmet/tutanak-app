import type { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

const USER_DTO = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'selin@ornek.test',
  createdAt: '2026-08-13T10:00:00.000Z',
};

describe('AuthController.register', () => {
  it('istegi servise devreder ve olusan kullaniciyi doner', async () => {
    const register = jest.fn().mockResolvedValue(USER_DTO);
    const controller = new AuthController({ register, login: jest.fn() } as unknown as AuthService);

    const result = await controller.register({
      email: 'selin@ornek.test',
      password: 'gizli-parola-123',
    });

    expect(register).toHaveBeenCalledWith({
      email: 'selin@ornek.test',
      password: 'gizli-parola-123',
    });
    expect(result).toEqual(USER_DTO);
  });
});

describe('AuthController.login', () => {
  it('istegi servise devreder ve token yanitini doner', async () => {
    const loginResponse = { accessToken: 'jwt', expiresIn: 604_800, user: USER_DTO };
    const login = jest.fn().mockResolvedValue(loginResponse);
    const controller = new AuthController({ register: jest.fn(), login } as unknown as AuthService);

    const result = await controller.login({
      email: 'selin@ornek.test',
      password: 'gizli-parola-123',
    });

    expect(login).toHaveBeenCalledWith({
      email: 'selin@ornek.test',
      password: 'gizli-parola-123',
    });
    expect(result).toEqual(loginResponse);
  });
});
