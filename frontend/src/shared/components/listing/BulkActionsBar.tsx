import type { ReactNode } from 'react';

export function BulkActionsBar({
  selectedCount,
  children,
}: {
  selectedCount: number;
  children: ReactNode;
}) {
  return (
    <div className="w-max flex flex-wrap items-center gap-2 rounded-xl border bg-muted/25 p-3">
      <span className="text-sm font-medium">{selectedCount} selected</span>
      {children}
    </div>
  );
}
