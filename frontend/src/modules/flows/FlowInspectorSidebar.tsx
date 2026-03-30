import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FlowComponent, FlowScreen } from '@/core/types';
import { FlowComponentInspector } from './FlowComponentInspector';

export function FlowInspectorSidebar({
  activeScreen,
  selectedComponent,
  screens,
  onUpdateScreen,
  onUpdateComponent,
}: {
  activeScreen: FlowScreen | null;
  selectedComponent: FlowComponent | null;
  screens: FlowScreen[];
  onUpdateScreen: (updater: (screen: FlowScreen) => FlowScreen) => void;
  onUpdateComponent: (updater: (component: FlowComponent) => FlowComponent) => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="rounded-3xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {selectedComponent ? 'Component inspector' : 'Screen settings'}
          </CardTitle>
          <CardDescription>
            {selectedComponent
              ? 'Edit the selected block properties.'
              : 'Update the active screen title and identifier.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeScreen && !selectedComponent ? (
            <>
              <div className="space-y-2">
                <Label>Screen title</Label>
                <Input
                  value={activeScreen.title}
                  onChange={(event) => onUpdateScreen((screen) => ({ ...screen, title: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Screen ID</Label>
                <Input
                  value={activeScreen.id}
                  onChange={(event) => onUpdateScreen((screen) => ({
                    ...screen,
                    id: event.target.value.toUpperCase().replace(/[^A-Z_]/g, '_'),
                  }))}
                />
              </div>
            </>
          ) : null}

          {selectedComponent ? (
            <FlowComponentInspector
              component={selectedComponent}
              screens={screens}
              onChange={onUpdateComponent}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-dashed shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Builder scope</CardTitle>
          <CardDescription>
            Keep this builder aligned with Meta’s static-flow contract for this production round.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3 rounded-2xl border bg-muted/30 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              Advanced endpoint-powered data exchange stays out of scope here. If an imported flow exceeds the supported builder subset, Nyife keeps it safely in JSON mode.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
