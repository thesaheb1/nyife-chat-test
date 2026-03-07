import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FlowEdgeHandle, FlowStepType } from '../builder';

export interface AutomationCanvasNodeData extends Record<string, unknown> {
  kind: 'entry' | 'step';
  type: FlowStepType | 'entry';
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tint: string;
  badge: string;
  handles: Array<{ id: FlowEdgeHandle; label: string }>;
}

function HandleRail({
  handles,
  side,
}: {
  handles: Array<{ id: FlowEdgeHandle; label: string }>;
  side: 'left' | 'right';
}) {
  const topOffsets =
    handles.length === 1
      ? ['50%']
      : handles.length === 2
        ? ['36%', '64%']
        : ['24%', '50%', '76%'];

  return (
    <>
      {handles.map((handle, index) => {
        return (
          <div
            key={`${side}-${handle.id}`}
            className={cn(
              'pointer-events-none absolute z-10 flex items-center gap-2',
              side === 'right' ? '-right-[5.25rem]' : '-left-[5.25rem] flex-row-reverse'
            )}
            style={{ top: topOffsets[index], transform: 'translateY(-50%)' }}
          >
            <span className="rounded-full border border-border/60 bg-background/95 px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground shadow-sm">
              {handle.label}
            </span>
            <Handle
              type={side === 'right' ? 'source' : 'target'}
              id={handle.id}
              position={side === 'right' ? Position.Right : Position.Left}
              className="pointer-events-auto !h-3 !w-3 !border-2 !border-background !bg-primary shadow-sm"
              style={{ top: '50%' }}
            />
          </div>
        );
      })}
    </>
  );
}

export function AutomationFlowNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as AutomationCanvasNodeData;
  const Icon = nodeData.icon;

  return (
    <div
      className={cn(
        'relative w-72 rounded-3xl border bg-card/95 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.45)] backdrop-blur',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border/70'
      )}
    >
      {nodeData.kind === 'step' && (
        <HandleRail handles={[{ id: 'next', label: 'Input' }]} side="left" />
      )}
      <HandleRail handles={nodeData.handles} side="right" />

      <div className={cn('rounded-[1.35rem] bg-gradient-to-br p-4', nodeData.tint)}>
        <div className="flex items-start gap-3">
          <div className={cn('rounded-2xl border px-3 py-3 shadow-sm', nodeData.badge)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">{nodeData.title}</p>
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]', nodeData.badge)}>
                {nodeData.type === 'entry' ? 'Start' : nodeData.type.replaceAll('_', ' ')}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {nodeData.subtitle}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
