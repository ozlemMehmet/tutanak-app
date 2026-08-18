// LoginPage (`/login`) — design.md §3 LoginPage sartnamesi (T-018). Sayfa duzeni ve
// etkilesimi kurar; ag cagrisini `useLogin` hook'una devreder (CLAUDE.md §3.9).
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { ApiClient } from '../api/client';
import { InlineFieldError } from '../components/InlineFieldError';
import { toAuthFormError } from '../features/auth/auth-error';
import { PasswordField } from '../features/auth/PasswordField';
import { safeRedirectTarget } from '../features/auth/redirect-target';
import { useLogin } from '../features/auth/useLogin';

interface LoginPageProps {
  client: ApiClient;
}

const FORM_FIELDS = ['email', 'password'] as const;
const FALLBACK_ERROR_MESSAGE = 'Giriş yapılamadı, birazdan tekrar deneyin';
const REGISTERED_BANNER_MESSAGE = 'Hesabınız oluşturuldu, giriş yapın';

export function LoginPage({ client }: LoginPageProps): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const signIn = useLogin(client);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Kayit ekranindan gelindiginin isareti adres uzerinden tasinir: rota state'i yerine
  // sorgu parametresi kullanilir, boylece deger tiplidir (string) ve tazelemede kaybolmaz.
  const isJustRegistered = searchParams.get('registered') === '1';

  const formError = toAuthFormError(signIn.error, {
    knownFields: FORM_FIELDS,
    fallbackMessage: FALLBACK_ERROR_MESSAGE,
  });
  const emailError = formError.fields.email;

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    signIn.mutate(
      { email, password },
      {
        onSuccess: () => {
          // Hedef rota T-017'nin `redirectTo` sozlesmesinden gelir; dogrulama
          // `safeRedirectTarget` icindedir (acik yonlendirme onlenir).
          void navigate(safeRedirectTarget(searchParams.get('redirectTo')), { replace: true });
        },
      },
    );
  };

  return (
    <main className="page auth-page">
      <p className="auth-page__brand">Tutanak</p>
      <h1>Giriş Yap</h1>

      {isJustRegistered && (
        <p className="banner banner--info" role="status">
          {REGISTERED_BANNER_MESSAGE}
        </p>
      )}

      {/* Form-genel hatalar (401/429) sayfa ustunde `role="alert"` banner'idir (design.md §5). */}
      {formError.banner !== null && (
        <p className="banner banner--danger" role="alert">
          {formError.banner}
        </p>
      )}

      {/* `noValidate`: dogrulamanin kaynagi sunucu sozlesmesidir — tarayici ve sunucu
          mesajlari ikilestirilmez (ApprovalForm ile ayni yaklasim). */}
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label className="form-field__label" htmlFor="login-email">
            E-posta
          </label>
          <input
            id="login-email"
            className="form-field__input"
            type="email"
            value={email}
            autoComplete="email"
            disabled={signIn.isPending}
            aria-invalid={emailError === undefined ? undefined : true}
            aria-describedby={emailError === undefined ? undefined : 'login-email-error'}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
          {emailError !== undefined && (
            <InlineFieldError id="login-email-error" message={emailError} />
          )}
        </div>

        <PasswordField
          id="login-password"
          label="Şifre"
          value={password}
          onChange={setPassword}
          disabled={signIn.isPending}
          autoComplete="current-password"
          error={formError.fields.password}
        />

        <button
          type="submit"
          className="button button--primary auth-form__submit"
          disabled={signIn.isPending}
        >
          {signIn.isPending ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>
      </form>

      <p className="auth-page__alternative">
        Hesabınız yok mu? <Link to="/register">Kayıt olun</Link>
      </p>
    </main>
  );
}
