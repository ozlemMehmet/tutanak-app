// TemplateCard — design.md §3 ReportCreatePage: secilebilir kart; secili durumda `primary`
// renginde 2px kenarlik + `surface-muted` zemin ve check ikonu (animasyonsuz, anlik degisim).
// Ikon kutuphanesi secilmedi (CLAUDE.md §6.1): tek renkli inline SVG `currentColor` kullanir.
import type { Template } from './reports.api';

interface TemplateCardProps {
  template: Template;
  isSelected: boolean;
  onSelect: (templateId: string) => void;
  /** Sablon listesi yeniden cekilirken/gonderim surerken secim degistirilemez. */
  disabled?: boolean;
}

/** Radio grubunun adi: tek secim davranisi tarayicidan gelir, elle yonetilmez. */
const TEMPLATE_RADIO_GROUP = 'template';

export function TemplateCard({
  template,
  isSelected,
  onSelect,
  disabled = false,
}: TemplateCardProps): React.JSX.Element {
  const className = isSelected ? 'template-card template-card--selected' : 'template-card';

  return (
    <li className={className}>
      {/* Etiket girdiyi sarar: kartin tamami dokunma hedefidir (min 44px, design.md §5). */}
      <label className="template-card__label">
        <input
          className="template-card__input"
          type="radio"
          name={TEMPLATE_RADIO_GROUP}
          value={template.id}
          checked={isSelected}
          disabled={disabled}
          onChange={() => {
            onSelect(template.id);
          }}
        />
        <span className="template-card__text">
          <span className="template-card__name">{template.name}</span>
          <span className="template-card__description">{template.description}</span>
        </span>
        {isSelected && (
          <svg
            className="template-card__check"
            data-testid="sablon-secili-ikonu"
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M3 8.5l3.5 3.5L13 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </label>
    </li>
  );
}
