import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface ListingTabDefinition {
  value: string;
  label: string;
  icon?: LucideIcon;
}

export function ListingTabsShell({
  value,
  onValueChange,
  tabs,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  tabs: ListingTabDefinition[];
  children: ReactNode;
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="space-y-4">
      <TabsList>
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <TabsTrigger key={tab.value} value={tab.value}>
              {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {children}
    </Tabs>
  );
}
