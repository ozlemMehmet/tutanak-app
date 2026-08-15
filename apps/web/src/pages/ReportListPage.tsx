// ReportListPage (`/reports`) — design.md §3 ReportListPage sartnamesi (T-021).
// Ofis kullanicisinin ana sayfasi: kendi tutanaklarinin kart listesi, sticky arama kutusu,
// sayfalama ve yeni tutanak girisi. Sayfa yalnizca duzen/etkilesim kurar; veri cekme
// hook'a devredilir (CLAUDE.md §3.9).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiClient } from '../api/client';
import { Pagination } from '../components/Pagination';
import { ReportCard } from '../features/reports/ReportCard';
import { useReports } from '../features/reports/useReports';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface ReportListPageProps {
  client: ApiClient;
}

/** design.md §3: arama kutusu ~400ms debounce ile `q` gonderir. */
const SEARCH_DEBOUNCE_MS = 400;
/** api-contract.yaml → `GET /reports` `q` parametresi: maxLength 100. */
const SEARCH_MAX_LENGTH = 100;
/** design.md loading durumu: "3-5 iskelet kart". */
const SKELETON_COUNT = 3;
const LIST_ERROR_MESSAGE = 'Tutanaklar yuklenemedi';
const FIRST_PAGE = 1;

export function ReportListPage({ client }: ReportListPageProps): React.JSX.Element {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(FIRST_PAGE);

  const activeQuery = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS).trim();
  const reportsQuery = useReports(client, { q: activeQuery, page });

  // Sozlesme disi/eksik govdeye karsi savunma: sayfa cokmez, bos durum gosterilir.
  const items = reportsQuery.data?.items ?? [];
  const isEmpty = !reportsQuery.isPending && !reportsQuery.isError && items.length === 0;

  const handleSearchChange = (value: string): void => {
    setSearchTerm(value);
    // Yeni terim yeni bir sonuc kumesidir: 3. sayfada kalmak yanlislikla "sonuc yok"
    // durumu gosterirdi.
    setPage(FIRST_PAGE);
  };

  const handleClearSearch = (): void => {
    handleSearchChange('');
  };

  return (
    <main className="page report-list">
      <div className="report-list__header">
        <h1>Tutanaklarim</h1>
        {/* "+ Yeni Tutanak" her durumda (yukleme/hata/bos) DOM'da kalir — kriter 7. */}
        <Link className="button button--primary report-list__new" to="/reports/new">
          + Yeni Tutanak
        </Link>
      </div>

      <div className="report-list__search form-field">
        <label className="form-field__label" htmlFor="report-search">
          Tutanaklarda ara
        </label>
        <input
          id="report-search"
          className="form-field__input"
          type="search"
          value={searchTerm}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Baslik veya not icinde ara"
          onChange={(event) => {
            handleSearchChange(event.target.value);
          }}
        />
      </div>

      {reportsQuery.isPending && (
        <ul className="report-card-list" aria-hidden="true">
          {Array.from({ length: SKELETON_COUNT }, (_unused, index) => (
            <li
              key={`iskelet-${String(index)}`}
              className="report-card report-card--skeleton"
              data-testid="tutanak-iskeleti"
            />
          ))}
        </ul>
      )}

      {/* 401 bu ekranda ele ALINMAZ: oturum sonlanmasini `client.ts` + `RequireAuth`
          zinciri global olarak yonetir (ticket teknik notu). */}
      {reportsQuery.isError && (
        <div className="banner banner--danger" role="alert">
          <p>{LIST_ERROR_MESSAGE}</p>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              void reportsQuery.refetch();
            }}
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {isEmpty && activeQuery === '' && (
        <div className="empty-state">
          <p>Henuz tutanaginiz yok</p>
          <Link className="button button--primary" to="/reports/new">
            Ilk tutanagini olustur
          </Link>
        </div>
      )}

      {isEmpty && activeQuery !== '' && (
        <div className="empty-state">
          <p>{`'${activeQuery}' icin sonuc bulunamadi`}</p>
          <button type="button" className="button button--ghost" onClick={handleClearSearch}>
            Aramayi temizle
          </button>
        </div>
      )}

      {items.length > 0 && (
        <ul className="report-card-list" aria-label="Tutanaklar">
          {items.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </ul>
      )}

      {reportsQuery.data !== undefined && (
        <Pagination
          page={reportsQuery.data.page}
          pageSize={reportsQuery.data.pageSize}
          total={reportsQuery.data.total}
          onPageChange={setPage}
        />
      )}
    </main>
  );
}
