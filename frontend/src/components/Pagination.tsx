import React from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

type PageToken = number | "ellipsis";

function buildPageTokens(page: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const tokens: PageToken[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) {
    tokens.push("ellipsis");
  }

  for (let current = start; current <= end; current += 1) {
    tokens.push(current);
  }

  if (end < totalPages - 1) {
    tokens.push("ellipsis");
  }

  tokens.push(totalPages);
  return tokens;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps): React.ReactElement | null {
  if (totalPages <= 1) return null;

  const tokens = buildPageTokens(page, totalPages);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="rounded border border-white/10 bg-white/5 px-3 py-1 text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Anterior
      </button>

      {tokens.map((token, index) =>
        token === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-2 text-slate-500">
            ...
          </span>
        ) : (
          <button
            key={token}
            type="button"
            onClick={() => onPageChange(token)}
            className={`rounded border px-3 py-1 transition ${
              token === page
                ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-200"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {token}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="rounded border border-white/10 bg-white/5 px-3 py-1 text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Siguiente
      </button>
    </div>
  );
}
