import type { ReactNode } from 'react';

export function ListingEmptyState({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-2 py-4 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
