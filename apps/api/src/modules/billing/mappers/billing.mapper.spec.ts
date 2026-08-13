import { toCheckoutDto } from './billing.mapper';

describe('toCheckoutDto', () => {
  it('saglayici oturumunu ve yapilandirmadaki tutari sozlesmedeki alanlara esler', () => {
    const dto = toCheckoutDto(
      { transactionReference: 'ref-1', checkoutUrl: 'https://odeme.example/oturum/1' },
      { amount: '199.00', currency: 'TRY' },
    );

    expect(dto).toEqual({
      transactionReference: 'ref-1',
      checkoutUrl: 'https://odeme.example/oturum/1',
      amount: '199.00',
      currency: 'TRY',
    });
  });

  it('tutari METIN olarak tasir (para float a cevrilmez — CLAUDE.md §5.1)', () => {
    const dto = toCheckoutDto(
      { transactionReference: 'ref-2', checkoutUrl: 'https://odeme.example/oturum/2' },
      { amount: '1249.90', currency: 'TRY' },
    );

    expect(dto.amount).toBe('1249.90');
    expect(typeof dto.amount).toBe('string');
  });
});
