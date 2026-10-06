import { BsChevronLeft, BsChevronRight } from 'react-icons/bs';

export default function Pagination({ page, totalPages, onChange, disabled }) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="button button--ghost"
        onClick={() => onChange(page - 1)}
        disabled={disabled || page <= 1}
      >
        <BsChevronLeft aria-hidden="true" /> Previous
      </button>
      <span className="pagination__status" aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="button button--ghost"
        onClick={() => onChange(page + 1)}
        disabled={disabled || page >= totalPages}
      >
        Next <BsChevronRight aria-hidden="true" />
      </button>
    </nav>
  );
}
