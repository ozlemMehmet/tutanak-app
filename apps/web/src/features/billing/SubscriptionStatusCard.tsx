// Durum karti (design.md SubscriptionPage "Bolgeler"): durum rozeti + tutar/para birimi +
// (varsa) donem sonu. Rozet tonlari §4.1 renk anlamlarindan gelir: inactive notr,
// pending `warning`, active `success`.
import { formatStamp } from '../../lib/format-timestamp';
import type { Subscription } from './billing.api';

interface SubscriptionStatusCardProps {
  subscription: Subscription;
}

const STATUS_LABELS: Record<Subscription['status'], string> = {
  inactive: 'Pasif',
  pending: 'Beklemede',
  active: 'Aktif',
};

const STATUS_CHIP_MODIFIERS: Record<Subscription['status'], string> = {
  inactive: 'status-chip--neutral',
  pending: 'status-chip--warning',
  active: 'status-chip--success',
};

export function SubscriptionStatusCard({
  subscription,
}: SubscriptionStatusCardProps): React.JSX.Element {
  const { status, priceAmount, currency, currentPeriodEnd } = subscription;

  return (
    <section className="status-card" aria-label="Abonelik durumu">
      <span
        className={`status-chip ${STATUS_CHIP_MODIFIERS[status]}`}
        data-testid="abonelik-rozeti"
      >
        {STATUS_LABELS[status]}
      </span>

      {/* Tutar SUNUCUDAN gelen metindir; float'a parse edilmez (CLAUDE.md §5.1). */}
      {priceAmount !== null && priceAmount !== undefined && (
        <p className="status-card__row" data-testid="abonelik-tutari">
          {priceAmount} {currency}
        </p>
      )}

      {currentPeriodEnd !== null && currentPeriodEnd !== undefined && (
        <p className="status-card__row" data-testid="abonelik-donem-sonu">
          Yenileme tarihi: {formatStamp(currentPeriodEnd)}
        </p>
      )}
    </section>
  );
}
