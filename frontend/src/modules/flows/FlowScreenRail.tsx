import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FlowComponent, FlowDefinition } from '@/core/types';
import { flowComponentPalette } from './flowUtils';

export function FlowScreenRail({
  flowDefinition,
  activeScreenId,
  readOnly,
  onSelect,
  onAdd,
  onMove,
  onRemove,
  onAddComponent,
}: {
  flowDefinition: FlowDefinition;
  activeScreenId: string;
  readOnly?: boolean;
  onSelect: (screenId: string) => void;
  onAdd: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (screenId: string) => void;
  onAddComponent: (type: FlowComponent['type']) => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="rounded-3xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Screens</CardTitle>
            <CardDescription>Organize the flow journey.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={onAdd} disabled={readOnly}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {flowDefinition.screens.map((screen, index) => (
            <div
              key={screen.id}
              className={cn(
                'rounded-2xl border p-3 transition-colors',
                activeScreenId === screen.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-muted/30'
              )}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onSelect(screen.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{screen.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{screen.id}</p>
                  </div>
                  <Badge variant="outline">{screen.layout.children.length}</Badge>
                </div>
              </button>

              <div className="mt-3 flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={readOnly || index === 0}
                  onClick={() => onMove(index, index - 1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={readOnly || index === flowDefinition.screens.length - 1}
                  onClick={() => onMove(index, index + 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  disabled={readOnly}
                  onClick={() => onRemove(screen.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Component library</CardTitle>
          <CardDescription>Add supported static-flow blocks to the active screen.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {flowComponentPalette.map((item) => (
            <Button
              key={item.type}
              type="button"
              variant="outline"
              className="h-auto items-start justify-start rounded-2xl px-3 py-3 text-left whitespace-normal"
              disabled={readOnly}
              onClick={() => onAddComponent(item.type)}
            >
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
