// ReportCard — design.md §3 ReportListPage: title, templateName, StatusChip, photoCount,
// createdAt. Kartin TAMAMI detay rotasina baglidir (T-021 kriter 8).
import { Link } from 'react-router-dom';
import { formatStamp } from '../../lib/format-timestamp';
import type { Report } from './reports.api';
import { StatusChip } from './StatusChip';

interface ReportCardProps {
  report: Report;
}

export function ReportCard({ report }: ReportCardProps): React.JSX.Element {
  return (
    <li className="report-card">
      <Link className="report-card__link" to={`/reports/${report.id}`}>
        <span className="report-card__title">{report.title}</span>
        <span className="report-card__template">{report.templateName}</span>
        <span className="report-card__meta">
          <StatusChip status={report.status} />
          <span className="report-card__photos">{`${String(report.photoCount)} fotograf`}</span>
          {/* Damga sunucudan gelir; `dateTime` ham ISO degeri korur, metin okunur bicimdir. */}
          <time className="report-card__created" dateTime={report.createdAt}>
            {formatStamp(report.createdAt)}
          </time>
        </span>
      </Link>
    </li>
  );
}
