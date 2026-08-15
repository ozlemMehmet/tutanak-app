// Tutanak durum rozeti (design.md §4.5 `StatusChip`): etkilesimsiz, tek durumlu.
// Tonlar sartnameden gelir: draft notr (`surface-muted`/`text-muted`), shared `primary`,
// approved `success`. Renk TEK basina anlam tasimaz; etiket metni her zaman gorunur (§5).
import type { ReportStatus } from './reports.api';

interface StatusChipProps {
  status: ReportStatus;
}

const CHIP_BY_STATUS: Record<ReportStatus, { label: string; tone: string }> = {
  draft: { label: 'Taslak', tone: 'neutral' },
  shared: { label: 'Paylasildi', tone: 'primary' },
  approved: { label: 'Onaylandi', tone: 'success' },
};

export function StatusChip({ status }: StatusChipProps): React.JSX.Element {
  const chip = CHIP_BY_STATUS[status];
  return <span className={`status-chip status-chip--${chip.tone}`}>{chip.label}</span>;
}
