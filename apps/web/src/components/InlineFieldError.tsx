// InlineFieldError (design.md §4.5 `Input` error durumu). Hata YALNIZCA renkle ifade
// edilmez: her zaman ikon + yazili mesaj birlikte gosterilir (design.md §5, renk korlugu).
// Ikon kutuphanesi secilmedi (CLAUDE.md §6.1) — tek renkli inline SVG `currentColor`
// ile metin rengini devralir.

interface InlineFieldErrorProps {
  /** Girdinin `aria-describedby` ile baglanacagi kimlik (design.md §5). */
  id: string;
  message: string;
}

export function InlineFieldError({ id, message }: InlineFieldErrorProps): React.JSX.Element {
  return (
    <p className="field-error" id={id} aria-live="polite">
      {/* Olcusu CSS'te `1em`: ikon metin boyutunu (tipografi token'i) devralir, sabit px yazilmaz. */}
      <svg className="field-error__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.9" fill="currentColor" />
      </svg>
      {message}
    </p>
  );
}
