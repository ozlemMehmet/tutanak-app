// Test sahtesi de sozlesmeye uyar (CLAUDE.md §7 Adapter+Port): birim/e2e testleri
// gercek ag cagrisi yapmadan hem basarili hem basarisiz gonderimi kurgulayabilmelidir.
import { FakeEmailAdapter } from './fake-email.adapter';

const EMAIL = {
  to: 'kiraci@ornek.test',
  subject: 'Emlak teslim tutanagi',
  text: 'https://app.example.com/t/abc',
};

describe('FakeEmailAdapter', () => {
  it('gonderilen e-postayi kaydeder ve sent sonucu doner', async () => {
    const adapter = new FakeEmailAdapter();

    const result = await adapter.sendEmail(EMAIL);

    expect(result.status).toBe('sent');
    expect(result.status === 'sent' && result.providerMessageId).toBeTruthy();
    expect(adapter.sentEmails).toEqual([EMAIL]);
  });

  it('failNextWith kurgulandiginda bir sonraki gonderim failed doner ve kayit tutulmaz', async () => {
    const adapter = new FakeEmailAdapter();
    adapter.failNextWith('E-posta saglayicisina ulasilamadi.');

    const failed = await adapter.sendEmail(EMAIL);
    const recovered = await adapter.sendEmail(EMAIL);

    expect(failed).toEqual({
      status: 'failed',
      errorMessage: 'E-posta saglayicisina ulasilamadi.',
    });
    // Basarisizlik tek seferliktir: sonraki gonderim normale doner.
    expect(recovered.status).toBe('sent');
    expect(adapter.sentEmails).toHaveLength(1);
  });
});
