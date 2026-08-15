// Sifre girdisi + goster/gizle kontrolu (design.md §3 LoginPage bilesenleri, §4.5 `Input`
// password varyanti). LoginPage'de bir, RegisterPage'de iki kez kullanilir; goster/gizle
// durumu ve erisilebilirlik baglantilari tek yerde tutulur.
import { useState } from 'react';
import { InlineFieldError } from '../../components/InlineFieldError';

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  /** Tarayici/sifre yoneticisi ipucu: `current-password` (giris) veya `new-password` (kayit). */
  autoComplete: 'current-password' | 'new-password';
  /** Kalici yardimci metin; hata olsun olmasin gorunur kalir (T-018 kriter 9). */
  hint?: string;
  error?: string;
  /** Ayni ekranda birden fazla sifre alani varken kontrol adlari ayirt edilebilmelidir. */
  showToggleLabel?: string;
  hideToggleLabel?: string;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  disabled,
  autoComplete,
  hint,
  error,
  showToggleLabel = 'Sifreyi goster',
  hideToggleLabel = 'Sifreyi gizle',
}: PasswordFieldProps): React.JSX.Element {
  const [isRevealed, setIsRevealed] = useState(false);

  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint === undefined ? null : hintId, error === undefined ? null : errorId]
    .filter((token): token is string => token !== null)
    .join(' ');

  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        {label}
      </label>
      <div className="password-field">
        <input
          id={id}
          className="form-field__input password-field__input"
          type={isRevealed ? 'text' : 'password'}
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy === '' ? undefined : describedBy}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <button
          type="button"
          className="button button--ghost password-field__toggle"
          // Kontrolun adi durumu anlatir; ikon kullanilmadigi icin metin tek kaynaktir.
          aria-label={isRevealed ? hideToggleLabel : showToggleLabel}
          aria-pressed={isRevealed}
          disabled={disabled}
          onClick={() => {
            setIsRevealed((revealed) => !revealed);
          }}
        >
          {isRevealed ? 'Gizle' : 'Goster'}
        </button>
      </div>
      {hint !== undefined && (
        <p className="form-field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error !== undefined && <InlineFieldError id={errorId} message={error} />}
    </div>
  );
}
