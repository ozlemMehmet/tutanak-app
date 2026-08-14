// Entity -> DTO donusumu saf fonksiyondur (CLAUDE.md §7 Mapper); birim test SART (§8.1).
import type { ShareDeliveryRecord, ShareLinkRecord } from '../sharing.repository';
import { toShareDeliveryDto, toShareLinkDto } from './share-link.mapper';

const PUBLIC_APP_URL = 'https://app.example.com';
const TOKEN = 'AbC123_-tokenAbC123_-tokenAbC123_-tokenAbc';

const LINK: ShareLinkRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  reportId: '22222222-2222-4222-8222-222222222222',
  token: TOKEN,
  createdAt: new Date('2026-08-14T09:00:00.000Z'),
};

const DELIVERY: ShareDeliveryRecord = {
  id: '33333333-3333-4333-8333-333333333333',
  shareLinkId: LINK.id,
  channel: 'email',
  recipientEmail: 'kiraci@ornek.test',
  status: 'sent',
  errorMessage: null,
  createdAt: new Date('2026-08-14T09:05:00.000Z'),
};

describe('toShareLinkDto', () => {
  it('kimlik dogrulamasi gerektirmeyen genel /t/{token} URL formatini uretir (kriter 2)', () => {
    const dto = toShareLinkDto(LINK, PUBLIC_APP_URL);

    expect(dto.url).toBe(`${PUBLIC_APP_URL}/t/${TOKEN}`);
  });

  it('PUBLIC_APP_URL sonundaki egik cizgiyi cift cizgi uretmeden tolere eder', () => {
    const dto = toShareLinkDto(LINK, `${PUBLIC_APP_URL}/`);

    expect(dto.url).toBe(`${PUBLIC_APP_URL}/t/${TOKEN}`);
  });

  it('sozlesmedeki ShareLink alanlarini tasir; ic kimlikler (id, reportId) sizmaz', () => {
    const dto = toShareLinkDto(LINK, PUBLIC_APP_URL);

    expect(Object.keys(dto).sort()).toEqual(['createdAt', 'token', 'url', 'whatsAppUrl']);
    expect(dto.token).toBe(TOKEN);
    expect(dto.createdAt).toBe('2026-08-14T09:00:00.000Z');
  });

  it('whatsAppUrl paylasim linkini iceren wa.me URL"sidir (kriter 5)', () => {
    const dto = toShareLinkDto(LINK, PUBLIC_APP_URL);

    const url = new URL(dto.whatsAppUrl);
    expect(url.origin).toBe('https://wa.me');
    expect(url.searchParams.get('text')).toContain(dto.url);
  });
});

describe('toShareDeliveryDto', () => {
  it('sozlesmedeki ShareDelivery alanlarini tasir; shareLinkId ve saglayici kimligi sizmaz', () => {
    const dto = toShareDeliveryDto(DELIVERY);

    expect(Object.keys(dto).sort()).toEqual([
      'channel',
      'createdAt',
      'errorMessage',
      'id',
      'recipientEmail',
      'status',
    ]);
    expect(dto.status).toBe('sent');
    expect(dto.errorMessage).toBeNull();
    expect(dto.createdAt).toBe('2026-08-14T09:05:00.000Z');
  });

  it('basarisiz gonderimde errorMessage dolu doner (sozlesme: failed ise DOLU)', () => {
    const dto = toShareDeliveryDto({
      ...DELIVERY,
      status: 'failed',
      errorMessage: 'E-posta saglayicisina ulasilamadi.',
    });

    expect(dto.status).toBe('failed');
    expect(dto.errorMessage).toBe('E-posta saglayicisina ulasilamadi.');
  });
});
