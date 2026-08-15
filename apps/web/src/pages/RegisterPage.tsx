// RegisterPage (`/register`) — design.md §3 RegisterPage sartnamesi (T-018). Iskelet
// LoginPage ile ayni; fark ucuncu alan (sifre tekrari) ve basari akisidir.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ApiClient } from '../api/client';
import { InlineFieldError } from '../components/InlineFieldError';
import { toAuthFormError } from '../features/auth/auth-error';
import { PasswordField } from '../features/auth/PasswordField';
import { useRegister } from '../features/auth/useRegister';

interface RegisterPageProps {
  client: ApiClient;
}

/** Sunucudan alan bazli hata gelebilecek alanlar; `passwordConfirm` sozlesmede YOKTUR. */
const FORM_FIELDS = ['email', 'password'] as const;
const FALLBACK_ERROR_MESSAGE = 'Kayit tamamlanamadi, birazdan tekrar deneyin';
const PASSWORD_HINT = 'En az 8 karakter';
const PASSWORD_MISMATCH_MESSAGE = 'sifreler eslesmiyor';

export function RegisterPage({ client }: RegisterPageProps): React.JSX.Element {
  const navigate = useNavigate();
  const register = useRegister(client);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  // Sifre tekrari YALNIZCA istemci tarafi bir dogrulamadir: sunucuya gonderilmez, bu
  // yuzden hatasi da sunucu hata zarfindan degil buradan gelir (design.md §3).
  const [isPasswordMismatch, setIsPasswordMismatch] = useState(false);

  const formError = toAuthFormError(register.error, {
    knownFields: FORM_FIELDS,
    fallbackMessage: FALLBACK_ERROR_MESSAGE,
  });
  const emailError = formError.fields.email;

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (password !== passwordConfirm) {
      setIsPasswordMismatch(true);
      return;
    }
    setIsPasswordMismatch(false);

    register.mutate(
      { email, password },
      {
        onSuccess: () => {
          // Otomatik giris YOK: `POST /auth/register` token dondurmez. Basari mesaji
          // hedef ekranda gosterilsin diye adres uzerinden tasinir.
          void navigate('/login?registered=1', { replace: true });
        },
      },
    );
  };

  return (
    <main className="page auth-page">
      <p className="auth-page__brand">Tutanak</p>
      <h1>Kayit Ol</h1>

      {formError.banner !== null && (
        <p className="banner banner--danger" role="alert">
          {formError.banner}
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label className="form-field__label" htmlFor="register-email">
            E-posta
          </label>
          <input
            id="register-email"
            className="form-field__input"
            type="email"
            value={email}
            autoComplete="email"
            disabled={register.isPending}
            aria-invalid={emailError === undefined ? undefined : true}
            aria-describedby={emailError === undefined ? undefined : 'register-email-error'}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
          {emailError !== undefined && (
            <InlineFieldError id="register-email-error" message={emailError} />
          )}
        </div>

        <PasswordField
          id="register-password"
          label="Sifre"
          value={password}
          onChange={setPassword}
          disabled={register.isPending}
          autoComplete="new-password"
          // Kural onceden gorunur: kullanici hatali gonderim yapip geri donmek zorunda
          // kalmaz (design.md §3 RegisterPage mobil notu, T-018 kriter 9).
          hint={PASSWORD_HINT}
          error={formError.fields.password}
        />

        <PasswordField
          id="register-password-confirm"
          label="Sifre (tekrar)"
          value={passwordConfirm}
          onChange={setPasswordConfirm}
          disabled={register.isPending}
          autoComplete="new-password"
          error={isPasswordMismatch ? PASSWORD_MISMATCH_MESSAGE : undefined}
          showToggleLabel="Sifre tekrarini goster"
          hideToggleLabel="Sifre tekrarini gizle"
        />

        <button
          type="submit"
          className="button button--primary auth-form__submit"
          disabled={register.isPending}
        >
          {register.isPending ? 'Hesap olusturuluyor...' : 'Hesap Olustur'}
        </button>
      </form>

      <p className="auth-page__alternative">
        Zaten hesabiniz var mi? <Link to="/login">Giris yapin</Link>
      </p>
    </main>
  );
}
