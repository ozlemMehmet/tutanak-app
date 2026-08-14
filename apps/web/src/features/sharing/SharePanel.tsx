// Paylasim paneli (design.md → ReportDetailPage: "Paylas" acilir paneli — link kutusu +
// kopyala + WhatsApp butonu + e-posta gonderim formu). Durumlar sartnameden gelir:
// link uretim hatasi -> banner + Tekrar Dene; gonderim `failed` -> WARNING tonunda inline
// mesaj (danger DEGIL — link gecerliligini korur, akis durmamali).
import { useState } from 'react';
import { ApiError } from '../../api/client';
import type { ApiClient } from '../../api/client';
import { useCreateShareLink, useSendShareEmail } from './useShareLink';

interface SharePanelProps {
  client: ApiClient;
  reportId: string;
}

const GENERIC_ERROR_MESSAGE = 'Beklenmeyen bir hata olustu, lutfen tekrar deneyin.';

function errorMessageOf(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message === '' ? GENERIC_ERROR_MESSAGE : error.message;
  }
  return GENERIC_ERROR_MESSAGE;
}

export function SharePanel({ client, reportId }: SharePanelProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  // Pano API'si guvenli olmayan baglamda (LAN uzerinden http) tanimsiz olabilir veya izin
  // reddedilebilir; sonuc kullaniciya gorunur olmali, sessizce yutulmamali.
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const createLink = useCreateShareLink(client, reportId);
  const sendEmail = useSendShareEmail(client, reportId);

  const openPanel = (): void => {
    setIsOpen(true);
    // Endpoint idempotent: mevcut link varsa AYNI token doner (T-008 kriter 3).
    createLink.mutate();
  };

  const copyLink = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const submitEmail = (event: React.SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    sendEmail.mutate(recipientEmail);
  };

  return (
    <section className="share-panel">
      <h2>Paylasim</h2>
      {!isOpen && (
        <button type="button" className="button button--primary" onClick={openPanel}>
          Paylas
        </button>
      )}

      {isOpen && createLink.isPending && (
        <p className="skeleton-text">Paylasim linki hazirlaniyor...</p>
      )}

      {isOpen && createLink.isError && (
        <div className="banner banner--danger" role="alert">
          <p>Paylasim linki olusturulamadi</p>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              createLink.mutate();
            }}
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {isOpen && createLink.data !== undefined && (
        <div className="share-panel__body">
          <div className="share-link-box">
            <input
              className="share-link-box__url"
              aria-label="Paylasim linki"
              readOnly
              value={createLink.data.url}
            />
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                void copyLink(createLink.data.url);
              }}
            >
              Kopyala
            </button>
          </div>
          {copyState === 'copied' && <p className="share-panel__copied">Kopyalandi</p>}
          {copyState === 'failed' && (
            <p className="toast toast--warning" role="status">
              Kopyalanamadi — linki yukaridaki kutudan elle secip kopyalayabilirsiniz.
            </p>
          )}

          {/* WhatsApp paylasimi istemcinin actigi bir wa.me URL'sidir; sunucudan gonderim
              ve teslim kaydi YOKTUR (api-contract ShareDelivery.channel aciklamasi). */}
          <a
            className="button button--primary share-panel__whatsapp"
            href={createLink.data.whatsAppUrl}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp ile Paylas
          </a>

          <form className="share-panel__email-form" onSubmit={submitEmail}>
            <label htmlFor="share-recipient-email">Alici e-posta</label>
            <input
              id="share-recipient-email"
              type="email"
              required
              value={recipientEmail}
              onChange={(event) => {
                setRecipientEmail(event.target.value);
              }}
            />
            <button type="submit" className="button button--primary" disabled={sendEmail.isPending}>
              E-posta Gonder
            </button>
          </form>

          {sendEmail.data?.status === 'sent' && (
            <p className="toast toast--success" role="status">
              E-posta gonderildi ({sendEmail.data.recipientEmail})
            </p>
          )}
          {sendEmail.data?.status === 'failed' && (
            <p className="toast toast--warning" role="status">
              E-postayi gonderemedik ({sendEmail.data.errorMessage ?? 'bilinmeyen neden'}). Link her
              zaman gecerli — WhatsApp veya kopyalama ile paylasabilirsiniz.
            </p>
          )}
          {sendEmail.isError && (
            <p className="toast toast--danger" role="alert">
              {errorMessageOf(sendEmail.error)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
