// PasswordField (design.md §3 LoginPage: "Input (... password + goster/gizle toggle)").
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordField } from './PasswordField';

describe('PasswordField', () => {
  it('varsayilan olarak sifreyi gizler ve goster kontrolu sunar', () => {
    render(
      <PasswordField
        id="sifre"
        label="Sifre"
        value="gizli"
        onChange={jest.fn()}
        disabled={false}
        autoComplete="current-password"
      />,
    );

    expect(screen.getByLabelText('Sifre')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Sifreyi goster' })).toBeInTheDocument();
  });

  it('goster kontrolu sifreyi okunur yapar, tekrar tiklanınca gizler', async () => {
    render(
      <PasswordField
        id="sifre"
        label="Sifre"
        value="gizli"
        onChange={jest.fn()}
        disabled={false}
        autoComplete="current-password"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Sifreyi goster' }));
    expect(screen.getByLabelText('Sifre')).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: 'Sifreyi gizle' }));
    expect(screen.getByLabelText('Sifre')).toHaveAttribute('type', 'password');
  });

  it('yazilan degeri cagirana bildirir', async () => {
    const onChange = jest.fn();
    render(
      <PasswordField
        id="sifre"
        label="Sifre"
        value=""
        onChange={onChange}
        disabled={false}
        autoComplete="current-password"
      />,
    );

    await userEvent.type(screen.getByLabelText('Sifre'), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('istek surerken hem girdiyi hem goster/gizle kontrolunu devre disi birakir', () => {
    render(
      <PasswordField
        id="sifre"
        label="Sifre"
        value="gizli"
        onChange={jest.fn()}
        disabled
        autoComplete="current-password"
      />,
    );

    expect(screen.getByLabelText('Sifre')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sifreyi goster' })).toBeDisabled();
  });

  it('yardimci metni girdiye `aria-describedby` ile baglar', () => {
    render(
      <PasswordField
        id="sifre"
        label="Sifre"
        value=""
        onChange={jest.fn()}
        disabled={false}
        autoComplete="new-password"
        hint="En az 8 karakter"
      />,
    );

    const input = screen.getByLabelText('Sifre');
    const hintId = screen.getByText('En az 8 karakter').getAttribute('id');
    expect(hintId).not.toBeNull();
    expect(input.getAttribute('aria-describedby')).toContain(hintId);
  });

  it('hata varsa girdiyi gecersiz isaretler ve mesaji girdiye baglar', () => {
    render(
      <PasswordField
        id="sifre"
        label="Sifre"
        value=""
        onChange={jest.fn()}
        disabled={false}
        autoComplete="new-password"
        hint="En az 8 karakter"
        error="en az 8 karakter olmalidir"
      />,
    );

    const input = screen.getByLabelText('Sifre');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const errorId = screen.getByText('en az 8 karakter olmalidir').getAttribute('id');
    expect(input.getAttribute('aria-describedby')).toContain(errorId);
    // Yardimci metin hata varken de gorunur kalir (T-018 kriter 9).
    expect(screen.getByText('En az 8 karakter')).toBeInTheDocument();
  });

  it('hata yokken girdiyi gecersiz isaretlemez', () => {
    render(
      <PasswordField
        id="sifre"
        label="Sifre"
        value=""
        onChange={jest.fn()}
        disabled={false}
        autoComplete="current-password"
      />,
    );

    expect(screen.getByLabelText('Sifre')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('birden fazla sifre alani ayirt edilebilsin diye kontrol adi ozellestirilebilir', () => {
    render(
      <PasswordField
        id="sifre-tekrar"
        label="Sifre (tekrar)"
        value=""
        onChange={jest.fn()}
        disabled={false}
        autoComplete="new-password"
        showToggleLabel="Sifre tekrarini goster"
        hideToggleLabel="Sifre tekrarini gizle"
      />,
    );

    expect(screen.getByRole('button', { name: 'Sifre tekrarini goster' })).toBeInTheDocument();
  });
});
