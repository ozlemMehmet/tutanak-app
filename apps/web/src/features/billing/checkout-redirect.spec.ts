// Odeme sayfasina gecis TAM SAYFA yonlendirmedir (design.md SubscriptionPage: yeni sekme
// DEGIL — mobilde pop-up engelleme riski). Bu davranis burada sabitlenir.
import { redirectToCheckout } from './checkout-redirect';

describe('redirectToCheckout', () => {
  it('mevcut sekmeyi checkout adresine tasir (tam sayfa yonlendirme)', () => {
    const target = { assign: jest.fn() };

    redirectToCheckout('https://odeme.example.test/oturum/txn-1', target);

    expect(target.assign).toHaveBeenCalledWith('https://odeme.example.test/oturum/txn-1');
  });

  it('yeni sekme acmaz (window.open kullanilmaz)', () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    const target = { assign: jest.fn() };

    redirectToCheckout('https://odeme.example.test/oturum/txn-1', target);

    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });
});
