// ResendEmailAdapter: saglayici hatasi ISTISNA DEGILDIR (CLAUDE.md §4.2.2) — adapter hicbir
// kosulda firlatmaz, sonucu {sent|failed} olarak doner. Gercek ag cagrisi yapilmaz (§8.1);
// Resend istemcisi sahtelenir.
import { Logger } from '@nestjs/common';
import { ResendEmailAdapter } from './resend-email.adapter';
import type { ResendLikeClient } from './resend-email.adapter';

const FROM = 'Tutanak <noreply@ornek.test>';
const EMAIL = {
  to: 'kiraci@ornek.test',
  subject: 'Emlak teslim tutanagi',
  text: 'https://app.example.com/t/abc',
};

function clientWith(send: jest.Mock): ResendLikeClient {
  return { emails: { send } };
}

describe('ResendEmailAdapter.sendEmail', () => {
  it('e-postayi yapilandirilan gonderen adresiyle iletir ve saglayici mesaj kimligini doner', async () => {
    const send = jest.fn().mockResolvedValue({ data: { id: 'msg-1' }, error: null });

    const result = await new ResendEmailAdapter({ from: FROM }, clientWith(send)).sendEmail(EMAIL);

    expect(result).toEqual({ status: 'sent', providerMessageId: 'msg-1' });
    expect(send).toHaveBeenCalledWith({
      from: FROM,
      to: EMAIL.to,
      subject: EMAIL.subject,
      text: EMAIL.text,
    });
  });

  it('saglayici hata dondugunde failed sonucu doner; ham saglayici yaniti mesaja SIZMAZ (§4.3)', async () => {
    const send = jest.fn().mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'API key is invalid: sk_test_XYZ' },
    });

    const result = await new ResendEmailAdapter({ from: FROM }, clientWith(send)).sendEmail(EMAIL);

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.errorMessage).toBe('E-posta sağlayıcısı gönderimi reddetti.');
      expect(result.errorMessage).not.toContain('sk_test');
    }
  });

  it('istemci istisna firlattiginda bile firlatmaz; failed sonucu doner (§4.2.2)', async () => {
    const send = jest.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:443'));

    const result = await new ResendEmailAdapter({ from: FROM }, clientWith(send)).sendEmail(EMAIL);

    expect(result).toEqual({
      status: 'failed',
      errorMessage: 'E-posta sağlayıcısına ulaşılamadı.',
    });
  });

  it.each([
    [
      'saglayici hata dondugunde',
      jest.fn().mockResolvedValue({ data: null, error: { message: 'API key is invalid' } }),
    ],
    ['istemci istisna firlattiginda', jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))],
  ])('%s hatayi nesnesiyle loglar; alici adresi maskelenir (§4.3, §4.4)', async (_ad, send) => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await new ResendEmailAdapter({ from: FROM }, clientWith(send)).sendEmail(EMAIL);

    expect(logError).toHaveBeenCalledTimes(1);
    const [message, cause] = logError.mock.calls[0] as [string, unknown];
    expect(message).toContain('k***@ornek.test');
    expect(message).not.toContain(EMAIL.to);
    expect(cause).toBeDefined();
    logError.mockRestore();
  });

  it('saglayici mesaj kimligi vermezse null doner (kayit yine yazilabilir)', async () => {
    const send = jest.fn().mockResolvedValue({ data: null, error: null });

    const result = await new ResendEmailAdapter({ from: FROM }, clientWith(send)).sendEmail(EMAIL);

    expect(result).toEqual({ status: 'sent', providerMessageId: null });
  });
});
