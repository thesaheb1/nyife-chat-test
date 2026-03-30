import type { ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function FlowNoticeCard({
  title,
  description,
  tone = 'warning',
  children,
}: {
  title: string;
  description: string;
  tone?: 'warning' | 'info';
  children: ReactNode;
}) {
  const isWarning = tone === 'warning';
  const Icon = isWarning ? AlertTriangle : Info;

  return (
    <Card className={isWarning ? 'rounded-3xl border-amber-200 bg-amber-50/60' : 'rounded-3xl border-sky-200 bg-sky-50/70'}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Icon className={isWarning ? 'mt-0.5 h-5 w-5 text-amber-700' : 'mt-0.5 h-5 w-5 text-sky-700'} />
          <div className="space-y-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className={isWarning ? 'text-amber-900/80' : 'text-sky-950/80'}>
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={isWarning ? 'space-y-2 text-sm text-amber-900' : 'space-y-2 text-sm text-sky-950'}>
        {children}
      </CardContent>
    </Card>
  );
}
