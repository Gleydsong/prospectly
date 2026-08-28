import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from './button';

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Paginação"
    >
      <p className="text-center text-sm text-[color:var(--ink-muted)] sm:text-left">
        {total} resultado{total === 1 ? '' : 's'} — página {page} de {totalPages}
      </p>
      <div className="flex justify-center gap-2 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
