// /src/components/ui/DataTable.tsx
import React, { useMemo, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
export interface Column<T> {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  initialSortKey?: keyof T & string;
  initialSortDirection?: 'asc' | 'desc';
  onSortChange?: (key: keyof T & string, direction: 'asc' | 'desc') => void;
  onPageChange?: (page: number) => void;
  emptyMessage?: string;
}

// ── Sort Icons (inline SVG) ───────────────────────────────────────────────
const SortIcon = ({ direction }: { direction?: 'asc' | 'desc' }) => {
  if (!direction) {
    return (
      <svg className="ml-1 inline-block h-3 w-3 opacity-30" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M4 7l2 3 2-3M4 5l2-3 2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  if (direction === 'asc') {
    return (
      <svg className="ml-1 inline-block h-3 w-3 text-teal-600" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M4 7l2 3 2-3M4 5l2-3 2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  return (
    <svg className="ml-1 inline-block h-3 w-3 text-teal-600" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4 5l2-3 2 3M4 7l2 3 2-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

// ── Pagination Component ──────────────────────────────────────────────────
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = useMemo(() => {
    const range: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) range.push(i);
    } else {
      range.push(1);
      if (currentPage > 3) range.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) range.push(i);
      if (currentPage < totalPages - 2) range.push('ellipsis');
      range.push(totalPages);
    }
    return range;
  }, [currentPage, totalPages]);

  return (
    <nav className="mt-4 flex items-center justify-center gap-1" role="navigation" aria-label="Pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="rounded-md px-3 py-1 text-sm text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous page"
      >
        ‹ Prev
      </button>
      {pages.map((page, i) =>
        page === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-slate-400">…</span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            disabled={page === currentPage}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              page === currentPage
                ? 'bg-teal-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            aria-current={page === currentPage ? 'page' : undefined}
            aria-label={`Page ${page}`}
          >
            {page}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="rounded-md px-3 py-1 text-sm text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next page"
      >
        Next ›
      </button>
    </nav>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  pageSize = 20,
  initialSortKey,
  initialSortDirection = 'asc',
  onSortChange,
  onPageChange,
  emptyMessage = 'No data available.',
}: DataTableProps<T>) {
  // Sorting state
  const [sortKey, setSortKey] = useState<keyof T & string | undefined>(initialSortKey);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // ── Sorted data ──────────────────────────────────────────────────────
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      // Fallback to string comparison
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [data, sortKey, sortDirection]);

  // ── Paginated data ───────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Reset page when data changes
  const prevDataLength = React.useRef(data.length);
  if (data.length !== prevDataLength.current) {
    prevDataLength.current = data.length;
    setCurrentPage(1);
  }

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleSort = useCallback(
    (key: keyof T & string) => {
      let newDirection: 'asc' | 'desc' = 'asc';
      if (sortKey === key) {
        newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      }
      setSortKey(key);
      setSortDirection(newDirection);
      setCurrentPage(1);
      onSortChange?.(key, newDirection);
    },
    [sortKey, sortDirection, onSortChange]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      onPageChange?.(page);
    },
    [onPageChange]
  );

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* Table */}
      <table className="min-w-full divide-y divide-slate-200" role="table">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 ${
                  col.sortable ? 'cursor-pointer select-none hover:bg-slate-100' : ''
                }`}
                onClick={() => col.sortable && handleSort(col.key)}
                aria-sort={
                  sortKey === col.key
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    <SortIcon direction={sortKey === col.key ? sortDirection : undefined} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {paginatedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            paginatedData.map((row, rowIndex) => (
              <tr
                key={(row as { id?: unknown }).id ?? rowIndex}
                className="transition-colors hover:bg-slate-50"
              >
                {columns.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] as React.ReactNode) ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="border-t border-slate-200 px-4 py-3">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}

export default DataTable;