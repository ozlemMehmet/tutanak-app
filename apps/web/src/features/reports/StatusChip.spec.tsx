// Durum rozeti (design.md §4.5 `StatusChip`): tutanagin uc durumu icin etkilesimsiz rozet.
// Tonlar sartnameden gelir: draft notr, shared primary, approved success.
import { render, screen } from '@testing-library/react';
import { StatusChip } from './StatusChip';

describe('StatusChip', () => {
  it('taslak durumunu notr tonda gosterir', () => {
    render(<StatusChip status="draft" />);

    const chip = screen.getByText('Taslak');
    expect(chip).toHaveClass('status-chip', 'status-chip--neutral');
  });

  it('paylasildi durumunu primary tonda gosterir', () => {
    render(<StatusChip status="shared" />);

    expect(screen.getByText('Paylaşıldı')).toHaveClass('status-chip--primary');
  });

  it('onaylandi durumunu success tonda gosterir', () => {
    render(<StatusChip status="approved" />);

    expect(screen.getByText('Onaylandı')).toHaveClass('status-chip--success');
  });
});
