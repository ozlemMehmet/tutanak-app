// ApprovalForm (design.md → PublicReportPage: "ApprovalForm (e-posta input + Onayla
// butonu)"). Sunum bilesenidir: veri cekmez, mutation'i sayfa kurar (CLAUDE.md §3.9).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../api/client';
import { ApprovalForm } from './ApprovalForm';

const EMAIL = 'kiraci@ornek.test';

describe('ApprovalForm', () => {
  it('e-posta alani ve Onayla butonu ile tek adimli onay sunar', () => {
    render(<ApprovalForm onApprove={jest.fn()} isPending={false} error={null} />);

    expect(screen.getByLabelText('E-posta adresiniz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Onayla' })).toBeInTheDocument();
  });

  it('gonderimde girilen e-posta ile onay eylemini tetikler', async () => {
    const onApprove = jest.fn();
    render(<ApprovalForm onApprove={onApprove} isPending={false} error={null} />);

    await userEvent.type(screen.getByLabelText('E-posta adresiniz'), EMAIL);
    await userEvent.click(screen.getByRole('button', { name: 'Onayla' }));

    expect(onApprove).toHaveBeenCalledWith(EMAIL);
  });

  it('istek suruyorken butonu devre disi birakir (cift gonderim onlenir)', () => {
    render(<ApprovalForm onApprove={jest.fn()} isPending error={null} />);

    expect(screen.getByRole('button', { name: 'Onaylanıyor...' })).toBeDisabled();
  });

  it('400 alan hatasini ilgili girdinin altinda gosterir (design.md inline alan hatasi)', () => {
    const error = new ApiError('VALIDATION_ERROR', 'Girdi doğrulanamadı.', 400, [
      { field: 'approverEmail', message: 'gecerli bir e-posta adresi giriniz' },
    ]);

    render(<ApprovalForm onApprove={jest.fn()} isPending={false} error={error} />);

    expect(screen.getByRole('alert')).toHaveTextContent('gecerli bir e-posta adresi giriniz');
  });

  it('alan bilgisi tasimayan hatada genel hata mesajini gosterir', () => {
    const error = new ApiError('INTERNAL_ERROR', 'Beklenmeyen bir hata olustu.', 500);

    render(<ApprovalForm onApprove={jest.fn()} isPending={false} error={error} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Beklenmeyen bir hata olustu.');
  });

  it('hata yokken hicbir hata mesaji gostermez', () => {
    render(<ApprovalForm onApprove={jest.fn()} isPending={false} error={null} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
