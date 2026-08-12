import type { UserProfileRecord, UserRecord } from '../users.repository';
import { toMeDto, toUserDto } from './user.mapper';

const USER: UserRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'selin@ornek.test',
  passwordHash: '$2b$10$sabit.test.hash.degeri',
  createdAt: new Date('2026-08-13T10:00:00.000Z'),
};

describe('toUserDto', () => {
  it('yalnizca sozlesmedeki id, email ve createdAt alanlarini doner', () => {
    expect(toUserDto(USER)).toEqual({
      id: USER.id,
      email: USER.email,
      createdAt: '2026-08-13T10:00:00.000Z',
    });
  });

  it("parola hash'ini yanit nesnesine tasimaz", () => {
    expect(Object.keys(toUserDto(USER))).not.toContain('passwordHash');
  });
});

describe('toMeDto', () => {
  const profile: UserProfileRecord = { ...USER, subscription: null };

  it('abonelik satiri yokken varsayilan para birimiyle pasif abonelik uretir', () => {
    expect(toMeDto(profile, 'TRY').subscription).toEqual({
      status: 'inactive',
      priceAmount: null,
      currency: 'TRY',
      currentPeriodEnd: null,
    });
  });

  it('donem sonunu ISO-8601 metnine cevirir', () => {
    const withSubscription: UserProfileRecord = {
      ...USER,
      subscription: {
        status: 'active',
        priceAmount: '199.00',
        currency: 'TRY',
        currentPeriodEnd: new Date('2026-09-12T10:00:00.000Z'),
      },
    };

    expect(toMeDto(withSubscription, 'TRY').subscription.currentPeriodEnd).toBe(
      '2026-09-12T10:00:00.000Z',
    );
  });
});
