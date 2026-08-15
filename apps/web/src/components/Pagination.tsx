// Pagination (design.md §4.5): ok butonlari + sayfa gostergesi; ilk/son sayfada disabled.
// Sayfa sayisi YANITTAKI `total`/`pageSize` degerlerinden hesaplanir (T-021 kriter 5).
// Numarali buton listesi yerine ok butonlari secildi: `total` buyudukce DOM maliyeti sabit kalir.

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: PaginationProps): React.JSX.Element | null {
  // Sozlesme disi `pageSize: 0` yanitinda bolme yapilmaz; tek sayfa varsayilir.
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  // Tek sayfalik sonucta gezinilecek bir sey yoktur: kontrol hic render edilmez.
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label="Sayfalama">
      <button
        type="button"
        className="button button--ghost"
        disabled={page <= 1}
        onClick={() => {
          onPageChange(page - 1);
        }}
      >
        Onceki sayfa
      </button>
      <span className="pagination__status" aria-live="polite">
        {`Sayfa ${String(page)} / ${String(pageCount)}`}
      </span>
      <button
        type="button"
        className="button button--ghost"
        disabled={page >= pageCount}
        onClick={() => {
          onPageChange(page + 1);
        }}
      >
        Sonraki sayfa
      </button>
    </nav>
  );
}
