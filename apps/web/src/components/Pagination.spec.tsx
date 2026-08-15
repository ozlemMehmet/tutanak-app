// Pagination (design.md §4.5): ok butonlari + sayfa gostergesi; ilk/son sayfada disabled.
// T-021 kriter 5.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

const noop = (): void => undefined;

describe('Pagination', () => {
  it('yanittaki total ve pageSize degerlerinden sayfa sayisini hesaplar', () => {
    render(<Pagination page={1} pageSize={20} total={45} onPageChange={noop} />);

    expect(screen.getByText('Sayfa 1 / 3')).toBeInTheDocument();
  });

  it('tek sayfalik sonucta hic kontrol gostermez', () => {
    render(<Pagination page={1} pageSize={20} total={20} onPageChange={noop} />);

    expect(screen.queryByRole('navigation', { name: 'Sayfalama' })).not.toBeInTheDocument();
  });

  it('ilk sayfada "Onceki" devre disidir', () => {
    render(<Pagination page={1} pageSize={20} total={45} onPageChange={noop} />);

    expect(screen.getByRole('button', { name: 'Onceki sayfa' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sonraki sayfa' })).toBeEnabled();
  });

  it('son sayfada "Sonraki" devre disidir', () => {
    render(<Pagination page={3} pageSize={20} total={45} onPageChange={noop} />);

    expect(screen.getByRole('button', { name: 'Sonraki sayfa' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Onceki sayfa' })).toBeEnabled();
  });

  it('sonraki sayfa istegini bir sonraki sayfa numarasiyla bildirir', async () => {
    const onPageChange = jest.fn();
    render(<Pagination page={2} pageSize={20} total={45} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Sonraki sayfa' }));

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('onceki sayfa istegini bir onceki sayfa numarasiyla bildirir', async () => {
    const onPageChange = jest.fn();
    render(<Pagination page={2} pageSize={20} total={45} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Onceki sayfa' }));

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('pageSize sifir gelirse tek sayfa varsayar ve cokmez', () => {
    render(<Pagination page={1} pageSize={0} total={45} onPageChange={noop} />);

    expect(screen.queryByRole('navigation', { name: 'Sayfalama' })).not.toBeInTheDocument();
  });
});
