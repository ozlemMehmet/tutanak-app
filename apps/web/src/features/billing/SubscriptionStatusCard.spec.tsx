// Durum karti + rozet tonlari (design.md SubscriptionPage "Bolgeler"/"Bilesenler";
// §4.1 renk anlami: inactive notr, pending `warning`, active `success`).
import { render, screen } from '@testing-library/react';
import type { Subscription } from './billing.api';
import { SubscriptionStatusCard } from './SubscriptionStatusCard';

const INACTIVE: Subscription = {
  status: 'inactive',
  priceAmount: null,
  currency: 'TRY',
  currentPeriodEnd: null,
};

describe('SubscriptionStatusCard', () => {
  it('inactive durumda notr tonlu rozet gosterir', () => {
    render(<SubscriptionStatusCard subscription={INACTIVE} />);

    const chip = screen.getByTestId('abonelik-rozeti');
    expect(chip).toHaveTextContent('Pasif');
    expect(chip).toHaveClass('status-chip--neutral');
  });

  it('pending durumda uyari tonlu rozet gosterir', () => {
    render(
      <SubscriptionStatusCard
        subscription={{ ...INACTIVE, status: 'pending', priceAmount: '199.00' }}
      />,
    );

    const chip = screen.getByTestId('abonelik-rozeti');
    expect(chip).toHaveTextContent('Beklemede');
    expect(chip).toHaveClass('status-chip--warning');
  });

  it('active durumda basari tonlu rozet gosterir', () => {
    render(
      <SubscriptionStatusCard
        subscription={{
          status: 'active',
          priceAmount: '199.00',
          currency: 'TRY',
          currentPeriodEnd: '2026-09-14T09:30:00.000Z',
        }}
      />,
    );

    const chip = screen.getByTestId('abonelik-rozeti');
    expect(chip).toHaveTextContent('Aktif');
    expect(chip).toHaveClass('status-chip--success');
  });

  it('tutari ve para birimini sunucudan geldigi gibi gosterir (parse etmez)', () => {
    render(<SubscriptionStatusCard subscription={{ ...INACTIVE, priceAmount: '199.00' }} />);

    expect(screen.getByText('199.00 TRY')).toBeInTheDocument();
  });

  it('tutar yokken tutar satirini hic gostermez', () => {
    render(<SubscriptionStatusCard subscription={INACTIVE} />);

    expect(screen.queryByTestId('abonelik-tutari')).not.toBeInTheDocument();
  });

  it('donem sonunu okunur tarih bicimiyle gosterir', () => {
    render(
      <SubscriptionStatusCard
        subscription={{
          status: 'active',
          priceAmount: '199.00',
          currency: 'TRY',
          currentPeriodEnd: '2026-09-14T09:30:00.000Z',
        }}
      />,
    );

    // Bicim yerel ayara baglidir; dogrulanan sey ham ISO damganin DEGIL, bicimlenmis
    // gun/ay/yil degerinin gosterildigidir.
    const period = screen.getByTestId('abonelik-donem-sonu');
    expect(period).toHaveTextContent(/\d{2}\.\d{2}\.\d{4}/);
    expect(period).not.toHaveTextContent('2026-09-14T09:30:00.000Z');
  });

  it('donem sonu bos olan durumda donem satirini gostermez', () => {
    render(<SubscriptionStatusCard subscription={{ ...INACTIVE, status: 'pending' }} />);

    expect(screen.queryByTestId('abonelik-donem-sonu')).not.toBeInTheDocument();
  });
});
