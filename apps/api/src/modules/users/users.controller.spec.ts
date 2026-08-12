import type { UsersService } from './users.service';
import { UsersController } from './users.controller';

const ME_DTO = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'selin@ornek.test',
  createdAt: '2026-08-13T10:00:00.000Z',
  subscription: {
    status: 'inactive' as const,
    priceAmount: null,
    currency: 'TRY',
    currentPeriodEnd: null,
  },
};

describe('UsersController.getMe', () => {
  it("profili yalnizca token'daki kullanici kimligi ile sorgular", async () => {
    const getProfile = jest.fn().mockResolvedValue(ME_DTO);
    const controller = new UsersController({ getProfile } as unknown as UsersService);

    const result = await controller.getMe({
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'selin@ornek.test',
    });

    expect(getProfile).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    expect(result).toEqual(ME_DTO);
  });
});
