// Tutanak durum rozeti (design.md §4.5 `StatusChip`): etkilesimsiz, tek durumlu.
// Tonlar sartnameden gelir (token ciftleri `foreground`/`background` sirasindadir):
// draft notr (`text-muted`/`surface-muted`), shared (`primary`/`surface-muted`),
// approved (`on-success`/`success`).
// Renk TEK basina anlam tasimaz; etiket metni her zaman gorunur (§5).
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
