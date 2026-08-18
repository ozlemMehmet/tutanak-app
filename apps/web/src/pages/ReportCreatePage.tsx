// ReportCreatePage (`/reports/new`) — design.md §3 ReportCreatePage sartnamesi (T-019).
// Tek sayfada iki adimli akis: (1) hazir sablon secimi, (2) baslik + not ile taslak olusturma.
// Sayfa yalnizca duzen/etkilesim kurar; veri cekme ve yazma hook'lara devredilir (CLAUDE.md §3.9).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiClient } from '../api/client';
import { InlineFieldError } from '../components/InlineFieldError';
import {
  DRAFT_FALLBACK_MESSAGE,
  isTemplateInvalidError,
  toReportFormError,
} from '../features/reports/report-error';
import { StepIndicator } from '../features/reports/StepIndicator';
import { TemplateCard } from '../features/reports/TemplateCard';
import { useCreateReport } from '../features/reports/useCreateReport';
import { useTemplates } from '../features/reports/useTemplates';

interface ReportCreatePageProps {
  client: ApiClient;
}

const STEPS = ['Şablon seçimi', 'Tutanak bilgileri'] as const;
const FORM_FIELDS = ['title', 'note'] as const;

/** Sinirlar api-contract.yaml → CreateReportRequest ile birebirdir (CLAUDE.md §3.6). */
const TITLE_MAX_LENGTH = 200;
const NOTE_MAX_LENGTH = 5000;

/** Sozlesme "tam olarak 3 kayit" garanti eder; iskelet sayisi bunu yansitir (design.md). */
const TEMPLATE_SKELETON_COUNT = 3;
const TEMPLATE_LIST_ERROR_MESSAGE = 'Şablonlar yüklenemedi';

export function ReportCreatePage({ client }: ReportCreatePageProps): React.JSX.Element {
  const navigate = useNavigate();
  const templatesQuery = useTemplates(client);
  const createDraft = useCreateReport(client);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  const templates = templatesQuery.data ?? [];
  // Secim, listenin GUNCEL halinden turetilir: sablon sunucuda gecersizlestiginde (kriter 7)
  // liste yeniden cekilir ve secim kendiliginden dusler — ayrica temizlemeye gerek kalmaz.
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;

  // Sozlesme disi bos liste savunmaci olarak hata sayilir (design.md empty durumu).
  const isTemplateListBroken =
    templatesQuery.isError || (!templatesQuery.isPending && templates.length === 0);
  const isSecondStepDisabled = selectedTemplate === null || createDraft.isPending;
  const canSubmit = selectedTemplate !== null && title.trim() !== '' && !createDraft.isPending;

  const formError = toReportFormError(createDraft.error, {
    knownFields: FORM_FIELDS,
    fallbackMessage: DRAFT_FALLBACK_MESSAGE,
  });
  const titleError = formError.fields.title;
  const noteError = formError.fields.note;

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (selectedTemplate === null) {
      return;
    }
    createDraft.mutate(
      { templateId: selectedTemplate.id, title, note },
      {
        onSuccess: (report) => {
          void navigate(`/reports/${report.id}`);
        },
        onError: (error) => {
          if (isTemplateInvalidError(error)) {
            void templatesQuery.refetch();
          }
        },
      },
    );
  };

  return (
    <main className="page report-create">
      <h1>Yeni Tutanak</h1>
      <StepIndicator steps={STEPS} activeIndex={selectedTemplate === null ? 0 : 1} />

      {/* Form-genel hatalar (404 TEMPLATE_NOT_FOUND, ag hatasi) sayfa ustunde banner'dir. */}
      {formError.banner !== null && (
        <p className="banner banner--danger" role="alert">
          {formError.banner}
        </p>
      )}

      {/* `noValidate`: dogrulamanin kaynagi sunucu sozlesmesidir — tarayici ve sunucu
          mesajlari ikilestirilmez (LoginPage ile ayni yaklasim). */}
      <form
        className="report-create__form"
        aria-label="Yeni tutanak formu"
        onSubmit={handleSubmit}
        noValidate
      >
        <fieldset className="report-create__step">
          <legend>1. Şablon seçin</legend>

          {templatesQuery.isPending && (
            <ul className="template-list" aria-hidden="true">
              {Array.from({ length: TEMPLATE_SKELETON_COUNT }, (_unused, index) => (
                <li
                  key={`iskelet-${String(index)}`}
                  className="template-card template-card--skeleton"
                  data-testid="sablon-iskeleti"
                />
              ))}
            </ul>
          )}

          {isTemplateListBroken && (
            <div className="banner banner--danger" role="alert">
              <p>{TEMPLATE_LIST_ERROR_MESSAGE}</p>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  void templatesQuery.refetch();
                }}
              >
                Tekrar Dene
              </button>
            </div>
          )}

          {templates.length > 0 && (
            <ul className="template-list" aria-label="Şablonlar">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={template.id === selectedTemplate?.id}
                  onSelect={setSelectedTemplateId}
                  disabled={createDraft.isPending}
                />
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset className="report-create__step">
          <legend>2. Tutanak bilgileri</legend>

          <div className="form-field">
            <label className="form-field__label" htmlFor="report-title">
              Başlık
            </label>
            <input
              id="report-title"
              className="form-field__input"
              type="text"
              value={title}
              required
              maxLength={TITLE_MAX_LENGTH}
              disabled={isSecondStepDisabled}
              aria-invalid={titleError === undefined ? undefined : true}
              aria-describedby={titleError === undefined ? undefined : 'report-title-error'}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
            />
            {titleError !== undefined && (
              <InlineFieldError id="report-title-error" message={titleError} />
            )}
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor="report-note">
              Not (opsiyonel)
            </label>
            <textarea
              id="report-note"
              className="form-field__input report-create__note"
              value={note}
              maxLength={NOTE_MAX_LENGTH}
              rows={5}
              disabled={isSecondStepDisabled}
              aria-invalid={noteError === undefined ? undefined : true}
              aria-describedby={
                noteError === undefined
                  ? 'report-note-counter'
                  : 'report-note-counter report-note-error'
              }
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
            {/* Karakter sayaci (design.md `Textarea` bileseni): sinira yaklasmayi gorunur kilar. */}
            <p className="form-field__hint" id="report-note-counter" aria-live="polite">
              {`${String(note.length)} / ${String(NOTE_MAX_LENGTH)}`}
            </p>
            {noteError !== undefined && (
              <InlineFieldError id="report-note-error" message={noteError} />
            )}
          </div>

          <button
            type="submit"
            className="button button--primary report-create__submit"
            disabled={!canSubmit}
          >
            {createDraft.isPending ? 'Taslak oluşturuluyor...' : 'Taslak Oluştur'}
          </button>
        </fieldset>
      </form>
    </main>
  );
}
