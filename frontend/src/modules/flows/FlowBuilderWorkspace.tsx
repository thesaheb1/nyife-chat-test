import { LayoutPanelLeft, PanelsTopLeft, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { FlowComponent, FlowDefinition, FlowScreen } from '@/core/types';
import { FlowCanvasPanel } from './FlowCanvasPanel';
import { FlowInspectorSidebar } from './FlowInspectorSidebar';
import { FlowScreenRail } from './FlowScreenRail';

export function FlowBuilderWorkspace({
  compactLayout,
  flowDefinition,
  activeScreenId,
  activeScreen,
  selectedComponent,
  selectedComponentIndex,
  screensSheetOpen,
  inspectorSheetOpen,
  onScreensSheetOpenChange,
  onInspectorSheetOpenChange,
  onSelectScreen,
  onAddScreen,
  onMoveScreen,
  onRemoveScreen,
  onAddComponent,
  onSelectComponent,
  onMoveComponent,
  onRemoveComponent,
  onUpdateScreen,
  onUpdateComponent,
  onOpenPreview,
}: {
  compactLayout: boolean;
  flowDefinition: FlowDefinition;
  activeScreenId: string;
  activeScreen: FlowScreen | null;
  selectedComponent: FlowComponent | null;
  selectedComponentIndex: number | null;
  screensSheetOpen: boolean;
  inspectorSheetOpen: boolean;
  onScreensSheetOpenChange: (open: boolean) => void;
  onInspectorSheetOpenChange: (open: boolean) => void;
  onSelectScreen: (screenId: string) => void;
  onAddScreen: () => void;
  onMoveScreen: (fromIndex: number, toIndex: number) => void;
  onRemoveScreen: (screenId: string) => void;
  onAddComponent: (type: FlowComponent['type']) => void;
  onSelectComponent: (index: number | null) => void;
  onMoveComponent: (fromIndex: number, toIndex: number) => void;
  onRemoveComponent: (index: number) => void;
  onUpdateScreen: (updater: (screen: FlowScreen) => FlowScreen) => void;
  onUpdateComponent: (updater: (component: FlowComponent) => FlowComponent) => void;
  onOpenPreview: () => void;
}) {
  const screenRail = (
    <FlowScreenRail
      flowDefinition={flowDefinition}
      activeScreenId={activeScreenId}
      onSelect={onSelectScreen}
      onAdd={onAddScreen}
      onMove={onMoveScreen}
      onRemove={onRemoveScreen}
      onAddComponent={onAddComponent}
    />
  );

  const inspector = (
    <FlowInspectorSidebar
      activeScreen={activeScreen}
      selectedComponent={selectedComponent}
      screens={flowDefinition.screens}
      onUpdateScreen={onUpdateScreen}
      onUpdateComponent={onUpdateComponent}
    />
  );

  if (!compactLayout) {
    return (
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        {screenRail}
        <FlowCanvasPanel
          definition={flowDefinition}
          activeScreen={activeScreen}
          selectedComponentIndex={selectedComponentIndex}
          onSelect={onSelectComponent}
          onMoveComponent={onMoveComponent}
          onRemoveComponent={onRemoveComponent}
          onOpenPreview={onOpenPreview}
        />
        {inspector}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => onScreensSheetOpenChange(true)}>
          <PanelsTopLeft className="mr-2 h-4 w-4" />
          Screens
        </Button>
        <Button type="button" variant="outline" onClick={() => onInspectorSheetOpenChange(true)}>
          <Settings2 className="mr-2 h-4 w-4" />
          Inspector
        </Button>
      </div>

      <FlowCanvasPanel
        definition={flowDefinition}
        activeScreen={activeScreen}
        selectedComponentIndex={selectedComponentIndex}
        onSelect={onSelectComponent}
        onMoveComponent={onMoveComponent}
        onRemoveComponent={onRemoveComponent}
        onOpenPreview={onOpenPreview}
      />

      <Sheet open={screensSheetOpen} onOpenChange={onScreensSheetOpenChange}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle className="flex items-center gap-2">
              <LayoutPanelLeft className="h-4 w-4" />
              Screen rail
            </SheetTitle>
            <SheetDescription>
              Manage screens and add supported components without leaving the compact workspace.
            </SheetDescription>
          </SheetHeader>
          <div className="pt-4">
            {screenRail}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={inspectorSheetOpen} onOpenChange={onInspectorSheetOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Inspector
            </SheetTitle>
            <SheetDescription>
              Fine-tune the active screen and selected component from the same compact flow workspace.
            </SheetDescription>
          </SheetHeader>
          <div className="pt-4">
            {inspector}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
