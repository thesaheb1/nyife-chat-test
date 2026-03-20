import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

export function ListingTableCard({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className='flex flex-col gap-4'>{children}</CardContent>
    </Card>
  );
}
