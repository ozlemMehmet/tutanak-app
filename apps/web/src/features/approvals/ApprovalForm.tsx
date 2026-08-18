// ApprovalForm (design.md → PublicReportPage: e-posta input + "Onayla" butonu). Sunum
// bilesenidir: veri cekmez, ag cagrisi yapmaz — mutation'i sayfa kurar (CLAUDE.md §3.9).
import { useState } from 'react';
import { ApiError } from '../../api/client';

interface ApprovalFormProps {
  onApprove: (approverEmail: string) => void;
  isPending: boolean;
  /** Onay istegi hatasi; alan bazli hata varsa girdinin altina baglanir (§4.5). */
  error: unknown;
}

const APPROVER_EMAIL_FIELD = 'approverEmail';
const GENERIC_ERROR_MESSAGE = 'Onay kaydedilemedi, birazdan tekrar deneyin.';

/** Alan bazli hata mesajini (details[]) secer; yoksa gosterilebilir genel mesaja duser. */
function errorMessageOf(error: unknown): string | null {
  if (error === null || error === undefined) {
    return null;
  }
  if (error instanceof ApiError) {
    const fieldError = error.details?.find((detail) => detail.field === APPROVER_EMAIL_FIELD);
    return fieldError?.message ?? error.message;
  }
  return GENERIC_ERROR_MESSAGE;
}

export function ApprovalForm({
  onApprove,
  isPending,
  error,
}: ApprovalFormProps): React.JSX.Element {
  const [approverEmail, setApproverEmail] = useState('');
  const message = errorMessageOf(error);

  const submit = (event: React.SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onApprove(approverEmail);
  };

  return (
    // `noValidate`: dogrulamanin tek kaynagi sunucu sozlesmesidir (bos/gecersiz e-posta
    // 400 + alan hatasi doner) — tarayici ve sunucu mesajlari ikilestirilmez.
    <form className="approval-form" onSubmit={submit} noValidate>
      <h2>Tutanağı onayla</h2>
      <label htmlFor="approver-email">E-posta adresiniz</label>
      <input
        id="approver-email"
        // Mobil klavyeyi e-posta duzenine getirir (bu ekran cogunlukla mobilde acilir).
        type="email"
        value={approverEmail}
        disabled={isPending}
        onChange={(event) => {
          setApproverEmail(event.target.value);
        }}
      />
      {message !== null && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
      <button type="submit" className="button button--primary" disabled={isPending}>
        {isPending ? 'Onaylanıyor...' : 'Onayla'}
      </button>
    </form>
  );
}
