import { ArrowDown, ArrowUp, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FlowDefinition, FlowScreen } from '@/core/types';
import { FlowComponentPreview } from './FlowComponentPreview';

export function FlowCanvasPanel({
  definition,
  activeScreen,
  selectedComponentIndex,
  onSelect,
  onMoveComponent,
  onRemoveComponent,
  onOpenPreview,
}: {
  definition: FlowDefinition;
  activeScreen: FlowScreen | null;
  selectedComponentIndex: number | null;
  onSelect: (index: number | null) => void;
  onMoveComponent: (fromIndex: number, toIndex: number) => void;
  onRemoveComponent: (index: number) => void;
  onOpenPreview: () => void;
}) {
  return (
    <Card className="rounded-3xl shadow-sm">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Builder canvas</CardTitle>
            <CardDescription>
              Arrange the active screen here. Use the preview workspace for the interactive local preview and official Meta preview access.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={onOpenPreview}>
            <Eye className="mr-2 h-4 w-4" />
            Open preview
          </Button>
        </div>
      </CardHeader>

      <CardContent className="bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-4 sm:p-6">
        <div className="mx-auto max-w-108 rounded-[34px] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60">
          <div className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-slate-200" />

          {activeScreen ? (
            <div className="space-y-3">
              <div className="rounded-[24px] bg-[#0f172a] px-4 py-3 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{activeScreen.title}</p>
                    <p className="truncate text-xs text-slate-300">{activeScreen.id}</p>
                  </div>
                  <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">
                    {activeScreen.layout.children.length} blocks
                  </Badge>
                </div>
              </div>

              {activeScreen.layout.children.map((component, index) => (
                <div
                  key={`${activeScreen.id}-${index}-${component.type}`}
                  className={cn(
                    'rounded-[24px] border p-4 transition-colors',
                    selectedComponentIndex === index
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 bg-white hover:border-primary/40'
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => onSelect(index)}
                  >
                    <div className="min-w-0">
                      <FlowComponentPreview component={component} />
                    </div>
                  </button>

                  <div className="mt-3 flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={index === 0}
                      onClick={() => onMoveComponent(index, index - 1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={index === activeScreen.layout.children.length - 1}
                      onClick={() => onMoveComponent(index, index + 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => onRemoveComponent(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed bg-white/90 px-6 py-12 text-center text-sm text-muted-foreground">
              Select a screen from the left rail, or add a new screen to begin building.
            </div>
          )}

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-dashed bg-white/80 px-4 py-3 text-xs text-muted-foreground">
            <span>{definition.screens.length} screen(s) in this flow</span>
            <span>Static-flow builder subset</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
