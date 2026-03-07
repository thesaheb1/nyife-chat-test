import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  Copy,
  Grip,
  LocateFixed,
  MousePointerClick,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Tag, Template, WhatsAppFlow } from '@/core/types';
import {
  autoLayoutFlowEditor,
  createFlowEdge,
  createFlowNode,
  FLOW_ENTRY_ID,
  getFlowNodeButtons,
  getFlowNodeHandles,
  MAX_INTERACTIVE_BUTTONS,
  type FlowEdgeHandle,
  type FlowEditorNodeState,
  type FlowEditorState,
  type FlowStepType,
} from '../builder';
import { FLOW_ENTRY_META, FLOW_NODE_GROUPS, FLOW_NODE_META } from './config';

const DND_MIME_TYPE = 'application/nyife-flow-node';
const BOARD_HEIGHT = 780;
const BOARD_MIN_WIDTH = 1700;
const BOARD_MIN_HEIGHT = 980;
const BOARD_NODE_WIDTH = 300;
const BOARD_ENTRY_WIDTH = 220;
const BOARD_ENTRY_HEIGHT = 126;

type ConnectionDraft = {
  sourceId: string;
  handleId: FlowEdgeHandle;
} | null;

type DragState = {
  nodeId: string;
  pointerOffsetX: number;
  pointerOffsetY: number;
};

function truncate(value: string, limit = 96) {
  if (!value.trim()) {
    return '';
  }

  return value.length > limit ? `${value.slice(0, limit - 1)}...` : value;
}

function getNodeSummary(
  node: FlowEditorNodeState,
  templates: Template[],
  tags: Array<Tag & { contact_count: number }>,
  flows: WhatsAppFlow[]
) {
  if (node.type === 'send_message') {
    if (node.media_type !== 'none') {
      return `${node.media_type} reply${node.media_url ? ` from ${truncate(node.media_url, 42)}` : ''}`;
    }

    return truncate(node.message_body, 96) || 'Configure the WhatsApp message body.';
  }

  if (node.type === 'send_interactive') {
    const buttons = getFlowNodeButtons(node);
    const label = buttons.length > 0 ? buttons.join(' • ') : 'Reply buttons are empty';
    return truncate(label, 96);
  }

  if (node.type === 'send_template') {
    const selected = templates.find((template) => template.name === node.template_name);
    if (selected) {
      return `${selected.display_name || selected.name} • ${selected.language}`;
    }

    return node.template_name
      ? `${node.template_name} • ${node.template_language || 'en_US'}`
      : 'Choose an approved template for this tenant.';
  }

  if (node.type === 'send_flow') {
    const selected = flows.find((flow) => flow.id === node.flow_id);
    if (selected) {
      return `${selected.name} | CTA: ${node.flow_cta || 'Continue'}`;
    }

    return node.flow_id
      ? `${node.flow_id} | CTA: ${node.flow_cta || 'Continue'}`
      : 'Launch a WhatsApp Flow and continue the journey.';
  }

  if (node.type === 'wait_for_reply') {
    return 'Pause and wait for the next inbound WhatsApp message.';
  }

  if (node.type === 'condition') {
    return node.condition_value
      ? `${node.condition_operator.replaceAll('_', ' ')} "${truncate(node.condition_value, 40)}"`
      : 'Split this path using the latest inbound reply.';
  }

  if (node.type === 'add_tag') {
    const selected = tags.find((tag) => tag.id === node.tag_id);
    return selected ? `Apply CRM tag "${selected.name}"` : 'Update the contact profile with a tag.';
  }

  if (node.type === 'call_webhook') {
    return node.webhook_url || 'POST signed payloads to your app.';
  }

  return `${node.delay_seconds || '5'} second synchronous pause.`;
}

function getNodeHeight(node: FlowEditorNodeState) {
  if (node.type === 'send_interactive') {
    const buttons = Math.max(getFlowNodeButtons(node).length, 1);
    const mediaHeight = node.media_type !== 'none' ? 92 : 0;
    const footerHeight = node.footer_text.trim() ? 28 : 0;
    return 232 + buttons * 42 + mediaHeight + footerHeight;
  }

  if (node.type === 'send_template') {
    return 196;
  }

  if (node.type === 'send_flow') {
    return 216;
  }

  if (node.type === 'send_message' && node.media_type !== 'none') {
    return 214;
  }

  return 170;
}

function getHandleOffsets(node: FlowEditorNodeState) {
  const handles = getFlowNodeHandles(node);

  if (node.type === 'send_interactive') {
    const buttons = getFlowNodeButtons(node);
    const mediaHeight = node.media_type !== 'none' ? 92 : 0;
    const topBase = 138 + mediaHeight;
    return handles.map((handle, index) => ({
      id: handle.id,
      label: handle.label,
      top: handle.id === 'next' ? topBase + buttons.length * 42 + 18 : topBase + index * 42 + 18,
    }));
  }

  const nodeHeight = getNodeHeight(node);
  if (handles.length === 1) {
    return [{ ...handles[0], top: nodeHeight / 2 }];
  }

  const gap = nodeHeight / (handles.length + 1);
  return handles.map((handle, index) => ({
    id: handle.id,
    label: handle.label,
    top: gap * (index + 1),
  }));
}

function buildConnectorPath(start: { x: number; y: number }, end: { x: number; y: number }) {
  const curve = Math.max(70, Math.abs(end.x - start.x) * 0.45);
  return `M ${start.x} ${start.y} C ${start.x + curve} ${start.y}, ${end.x - curve} ${end.y}, ${end.x} ${end.y}`;
}

function getPreferredOutputHandle(selectedNodeId: string | null, nodes: FlowEditorNodeState[]) {
  if (!selectedNodeId) {
    return null;
  }

  if (selectedNodeId === FLOW_ENTRY_ID) {
    return 'next' as FlowEdgeHandle;
  }

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  if (!selectedNode) {
    return null;
  }

  const handles = getFlowNodeHandles(selectedNode);
  const fallbackHandle = handles.find((handle) => handle.id === 'next');
  if (fallbackHandle) {
    return fallbackHandle.id;
  }

  return handles.length === 1 ? handles[0].id : null;
}

function getSuggestedPosition(selectedNodeId: string | null, value: FlowEditorState) {
  if (selectedNodeId === FLOW_ENTRY_ID) {
    return {
      x: value.entryPosition.x + 320,
      y: value.entryPosition.y,
    };
  }

  const selectedNode = value.nodes.find((node) => node.id === selectedNodeId);
  if (selectedNode) {
    return {
      x: selectedNode.position.x + 360,
      y: selectedNode.position.y,
    };
  }

  return {
    x: 420 + (value.nodes.length % 3) * 40,
    y: 220 + value.nodes.length * 48,
  };
}

function getBoardSize(value: FlowEditorState) {
  let width = Math.max(BOARD_MIN_WIDTH, value.entryPosition.x + BOARD_ENTRY_WIDTH + 280);
  let height = Math.max(BOARD_MIN_HEIGHT, value.entryPosition.y + BOARD_ENTRY_HEIGHT + 220);

  for (const node of value.nodes) {
    width = Math.max(width, node.position.x + BOARD_NODE_WIDTH + 320);
    height = Math.max(height, node.position.y + getNodeHeight(node) + 260);
  }

  return { width, height };
}

function InspectorField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <Label>{label}</Label>
      {children}
      {description ? (
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

function FlowStartCard({
  activeConnection,
  onBeginConnection,
  onPointerDown,
  selected,
  style,
}: {
  activeConnection: ConnectionDraft;
  onBeginConnection: (handleId: FlowEdgeHandle) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  selected: boolean;
  style: CSSProperties;
}) {
  const EntryIcon = FLOW_ENTRY_META.icon;
  return (
    <div
      style={style}
      onPointerDown={onPointerDown}
      className={cn(
        'absolute rounded-[28px] border bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)]',
        selected ? 'border-emerald-500 ring-2 ring-emerald-500/15' : 'border-border/70'
      )}
    >
      <div className="absolute inset-y-5 left-0 w-1.5 rounded-full bg-emerald-600" />
      <div className="flex h-full flex-col justify-between p-5 pl-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-600 px-3 py-3 text-white shadow-sm">
              <EntryIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">{FLOW_ENTRY_META.label}</p>
              <p className="text-xs text-muted-foreground">Tenant-scoped trigger entry</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {['Hi', 'Hello', 'Help'].map((chip) => (
              <span key={chip} className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Drag blocks or click any tile to connect here.</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onBeginConnection('next');
            }}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border transition',
              activeConnection?.sourceId === FLOW_ENTRY_ID
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-emerald-200 bg-white text-emerald-700 hover:border-emerald-400'
            )}
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FlowNodeCard({
  node,
  summary,
  selected,
  activeConnection,
  isConnectionTarget,
  isDragging,
  connectedHandles,
  onBeginConnection,
  onConnectTarget,
  onPointerDown,
  onSelect,
}: {
  node: FlowEditorNodeState;
  summary: string;
  selected: boolean;
  activeConnection: ConnectionDraft;
  isConnectionTarget: boolean;
  isDragging: boolean;
  connectedHandles: Set<string>;
  onBeginConnection: (handleId: FlowEdgeHandle) => void;
  onConnectTarget: () => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onSelect: () => void;
}) {
  const meta = FLOW_NODE_META[node.type];
  const Icon = meta.icon;
  const buttons = getFlowNodeButtons(node);
  const handleOffsets = getHandleOffsets(node);
  const nodeHeight = getNodeHeight(node);

  return (
    <div
      style={{ width: BOARD_NODE_WIDTH, height: nodeHeight }}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      className={cn(
        'absolute rounded-[30px] border bg-white shadow-[0_20px_55px_-30px_rgba(15,23,42,0.35)] transition',
        selected ? 'border-emerald-500 ring-2 ring-emerald-500/15' : 'border-border/70',
        isConnectionTarget ? 'ring-2 ring-emerald-300/60' : '',
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      )}
    >
      <div className="absolute inset-y-5 left-0 w-1.5 rounded-full bg-emerald-600" />

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onConnectTarget();
        }}
        className={cn(
          'absolute -left-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition',
          activeConnection ? 'border-emerald-500 text-emerald-600' : 'border-border/60 text-muted-foreground'
        )}
      >
        <ArrowRight className="h-4 w-4 rotate-180" />
      </button>

      {handleOffsets.map((handle) => (
        <div
          key={handle.id}
          style={{ top: handle.top }}
          className="pointer-events-none absolute -right-[7.4rem] flex -translate-y-1/2 items-center gap-2"
        >
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm',
              connectedHandles.has(handle.id) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border/60 bg-white text-muted-foreground'
            )}
          >
            {handle.label}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onBeginConnection(handle.id);
            }}
            className={cn(
              'pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-sm transition',
              activeConnection?.sourceId === node.id && activeConnection.handleId === handle.id
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : connectedHandles.has(handle.id)
                  ? 'border-emerald-300 text-emerald-700'
                  : 'border-border/60 text-muted-foreground hover:border-emerald-400 hover:text-emerald-700'
            )}
          >
            <MousePointerClick className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div className="flex h-full flex-col p-5 pl-6">
        <div className="flex items-start gap-3">
          <div className={cn('rounded-2xl border px-3 py-3 shadow-sm', meta.badge)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="truncate text-sm font-semibold">{node.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{meta.label}</p>
              </div>
              <Grip className="h-4 w-4 text-muted-foreground/70" />
            </div>
          </div>
        </div>

        <div className={cn('mt-4 flex-1 rounded-[26px] bg-gradient-to-br p-4', meta.surface)}>
          {node.type === 'send_interactive' ? (
            <div className="space-y-3">
              {node.media_type !== 'none' ? (
                <div className="rounded-2xl border border-border/70 bg-white/85 p-2">
                  <div className="flex h-20 items-center justify-center rounded-xl bg-slate-100 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                    {node.media_type}
                  </div>
                </div>
              ) : null}
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-sm font-medium text-slate-900">{truncate(node.message_body, 120) || 'Interactive body'}</p>
                {node.footer_text.trim() ? (
                  <p className="mt-2 text-xs text-muted-foreground">{truncate(node.footer_text, 70)}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                {buttons.map((button) => (
                  <div key={button} className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700">
                    {button}
                  </div>
                ))}
                <div className="rounded-xl border border-dashed border-border/70 bg-white/80 px-3 py-2 text-xs text-muted-foreground">
                  Unmatched replies use the "Other reply" branch.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-sm font-medium text-slate-900">{summary}</p>
              </div>
              {node.type === 'send_template' ? (
                <div className="rounded-2xl border border-border/70 bg-white/85 px-4 py-3 text-xs text-muted-foreground">
                  Uses approved template language and component payloads.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PhonePreview({
  selectedNode,
  templates,
  tags,
  flows,
}: {
  selectedNode: FlowEditorNodeState | null;
  templates: Template[];
  tags: Array<Tag & { contact_count: number }>;
  flows: WhatsAppFlow[];
}) {
  const selectedTemplate = selectedNode && selectedNode.type === 'send_template'
    ? templates.find((template) => template.name === selectedNode.template_name)
    : null;
  const selectedFlow = selectedNode && selectedNode.type === 'send_flow'
    ? flows.find((flow) => flow.id === selectedNode.flow_id)
    : null;
  const selectedTag = selectedNode && selectedNode.type === 'add_tag'
    ? tags.find((tag) => tag.id === selectedNode.tag_id)
    : null;
  const interactiveButtons = selectedNode ? getFlowNodeButtons(selectedNode) : [];

  return (
    <div className="mx-auto w-[280px] rounded-[2.6rem] border-[10px] border-slate-950 bg-slate-950 p-1 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.6)]">
      <div className="overflow-hidden rounded-[2rem] bg-[#ece5dd]">
        <div className="bg-emerald-700 px-4 py-3 text-white">
          <div className="flex items-center justify-between text-xs">
            <span>9:41</span>
            <span>Nyife Demo</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
              N
            </div>
            <div>
              <p className="text-sm font-semibold">Nyife Automation</p>
              <p className="text-[11px] text-emerald-50/85">Production preview</p>
            </div>
          </div>
        </div>

        <div className="min-h-[500px] space-y-3 px-4 py-5">
          <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-md bg-[#dcf8c6] px-4 py-3 text-sm shadow-sm">
            {selectedNode ? 'Help' : 'Hi'}
          </div>

          {!selectedNode ? (
            <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm shadow-sm">
              Select a block to preview the WhatsApp output here.
            </div>
          ) : null}

          {selectedNode?.type === 'send_message' ? (
            <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white p-3 shadow-sm">
              {selectedNode.media_type !== 'none' ? (
                <div className="mb-3 h-32 rounded-xl bg-slate-100" />
              ) : null}
              <p className="text-sm text-slate-900">
                {selectedNode.media_type !== 'none'
                  ? selectedNode.media_caption || selectedNode.message_body || 'Media message'
                  : selectedNode.message_body || 'WhatsApp message body'}
              </p>
            </div>
          ) : null}

          {selectedNode?.type === 'send_interactive' ? (
            <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white p-3 shadow-sm">
              {selectedNode.media_type !== 'none' ? (
                <div className="mb-3 h-32 rounded-xl bg-slate-100" />
              ) : null}
              <p className="text-sm text-slate-900">{selectedNode.message_body || 'Interactive body'}</p>
              <div className="mt-3 space-y-1.5">
                {interactiveButtons.map((button) => (
                  <div key={button} className="rounded-lg border border-emerald-200 px-3 py-2 text-center text-sm font-medium text-emerald-700">
                    {button}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedNode?.type === 'send_template' ? (
            <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white p-3 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">
                {selectedTemplate?.display_name || selectedNode.template_name || 'Template'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedTemplate?.language || selectedNode.template_language || 'en_US'} • approved template
              </p>
            </div>
          ) : null}

          {selectedNode?.type === 'send_flow' ? (
            <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white p-3 shadow-sm">
              {selectedNode.header_text ? (
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {selectedNode.header_text}
                </p>
              ) : null}
              <p className="text-sm font-semibold text-slate-900">
                {selectedFlow?.name || selectedNode.flow_id || 'WhatsApp Flow'}
              </p>
              <p className="mt-2 text-sm text-slate-900">
                {selectedNode.message_body || 'Launch a form flow for this contact.'}
              </p>
              {selectedNode.footer_text ? (
                <p className="mt-2 text-xs text-muted-foreground">{selectedNode.footer_text}</p>
              ) : null}
              <div className="mt-3 rounded-lg border border-emerald-200 px-3 py-2 text-center text-sm font-medium text-emerald-700">
                {selectedNode.flow_cta || 'Continue'}
              </div>
            </div>
          ) : null}

          {selectedNode && !['send_message', 'send_interactive', 'send_template', 'send_flow'].includes(selectedNode.type) ? (
            <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm shadow-sm">
              {selectedNode.type === 'wait_for_reply' && 'The flow pauses here until the contact replies.'}
              {selectedNode.type === 'condition' && `Branching on: ${selectedNode.condition_operator} "${selectedNode.condition_value || 'value'}"`}
              {selectedNode.type === 'add_tag' && `Tag applied: ${selectedTag?.name || 'selected CRM tag'}`}
              {selectedNode.type === 'call_webhook' && `Webhook call: ${selectedNode.webhook_url || 'endpoint not set'}`}
              {selectedNode.type === 'delay' && `Delay: ${selectedNode.delay_seconds || '5'} seconds`}
            </div>
          ) : null}
        </div>

        <div className="border-t bg-white px-4 py-3 text-xs text-muted-foreground">
          Preview reflects the selected builder block only.
        </div>
      </div>
    </div>
  );
}

export function AutomationFlowEditor({
  value,
  onChange,
  templates,
  tags,
  flows,
}: {
  value: FlowEditorState;
  onChange: (next: FlowEditorState) => void;
  templates: Template[];
  tags: Array<Tag & { contact_count: number }>;
  flows: WhatsAppFlow[];
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(FLOW_ENTRY_ID);
  const [activeConnection, setActiveConnection] = useState<ConnectionDraft>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef(value);
  const dragStateRef = useRef<DragState | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const boardSize = useMemo(() => getBoardSize(value), [value]);
  const nodesById = useMemo(() => new Map(value.nodes.map((node) => [node.id, node])), [value.nodes]);
  const resolvedSelectedNodeId = selectedNodeId === FLOW_ENTRY_ID
    ? FLOW_ENTRY_ID
    : selectedNodeId && value.nodes.some((node) => node.id === selectedNodeId)
      ? selectedNodeId
      : value.nodes[0]?.id || FLOW_ENTRY_ID;
  const selectedNode = resolvedSelectedNodeId !== FLOW_ENTRY_ID ? nodesById.get(resolvedSelectedNodeId) || null : null;
  const approvedTemplates = useMemo(
    () => templates.filter((template) => template.status === 'approved'),
    [templates]
  );
  const availableFlows = useMemo(
    () => flows.filter((flow) => flow.status !== 'DEPRECATED'),
    [flows]
  );
  const selectedFlow = selectedNode?.type === 'send_flow'
    ? availableFlows.find((flow) => flow.id === selectedNode.flow_id) || null
    : null;

  const edgeLookup = useMemo(() => {
    const lookup = new Map<string, Set<string>>();
    for (const edge of value.edges) {
      const sourceSet = lookup.get(edge.source) || new Set<string>();
      sourceSet.add(edge.sourceHandle || 'next');
      lookup.set(edge.source, sourceSet);
    }
    return lookup;
  }, [value.edges]);

  const connectionPaths = useMemo(() => {
    return value.edges
      .map((edge) => {
        const sourceHandle = edge.sourceHandle || 'next';
        const sourceNode = edge.source === FLOW_ENTRY_ID ? null : nodesById.get(edge.source);
        const targetNode = nodesById.get(edge.target);
        if (!targetNode) {
          return null;
        }

        const sourcePoint = edge.source === FLOW_ENTRY_ID
          ? { x: value.entryPosition.x + BOARD_ENTRY_WIDTH, y: value.entryPosition.y + BOARD_ENTRY_HEIGHT / 2 }
          : (() => {
            if (!sourceNode) {
              return null;
            }
            const handleOffsets = getHandleOffsets(sourceNode);
            const handle = handleOffsets.find((item) => item.id === sourceHandle) || handleOffsets[0];
            return {
              x: sourceNode.position.x + BOARD_NODE_WIDTH,
              y: sourceNode.position.y + handle.top,
            };
          })();

        if (!sourcePoint) {
          return null;
        }

        const targetPoint = {
          x: targetNode.position.x,
          y: targetNode.position.y + getNodeHeight(targetNode) / 2,
        };

        return {
          id: edge.id,
          d: buildConnectorPath(sourcePoint, targetPoint),
        };
      })
      .filter((item): item is { id: string; d: string } => Boolean(item));
  }, [nodesById, value.edges, value.entryPosition]);

  const patchNode = (nodeId: string, updates: Partial<FlowEditorNodeState>) => {
    const currentNode = valueRef.current.nodes.find((node) => node.id === nodeId);
    if (!currentNode) {
      return;
    }

    const nextNode = { ...currentNode, ...updates };
    const validHandles = new Set(getFlowNodeHandles(nextNode).map((handle) => handle.id));
    const nextValue = {
      ...valueRef.current,
      nodes: valueRef.current.nodes.map((node) => (node.id === nodeId ? nextNode : node)),
      edges: valueRef.current.edges.filter((edge) => edge.source !== nodeId || validHandles.has(edge.sourceHandle || 'next')),
    };
    onChange(nextValue);

    if (activeConnection?.sourceId === nodeId && !validHandles.has(activeConnection.handleId)) {
      setActiveConnection(null);
    }
  };

  const addNode = (type: FlowStepType, position?: { x: number; y: number }) => {
    const nextValue = valueRef.current;
    const node = createFlowNode(type, position || getSuggestedPosition(resolvedSelectedNodeId, nextValue));
    const edges = [...nextValue.edges];
    const outputHandle = getPreferredOutputHandle(resolvedSelectedNodeId, nextValue.nodes);

    if (resolvedSelectedNodeId && outputHandle) {
      const alreadyLinked = edges.some(
        (edge) => edge.source === resolvedSelectedNodeId && (edge.sourceHandle || 'next') === outputHandle
      );

      if (!alreadyLinked) {
        edges.push(createFlowEdge(resolvedSelectedNodeId, node.id, outputHandle));
      }
    }

    onChange({
      ...nextValue,
      nodes: [...nextValue.nodes, node],
      edges,
    });
    setSelectedNodeId(node.id);
    setActiveConnection(null);
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) {
      return;
    }

    onChange({
      ...valueRef.current,
      nodes: valueRef.current.nodes.filter((node) => node.id !== selectedNode.id),
      edges: valueRef.current.edges.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id),
    });
    setSelectedNodeId(valueRef.current.nodes[0]?.id || FLOW_ENTRY_ID);
    setActiveConnection(null);
  };

  const duplicateSelectedNode = () => {
    if (!selectedNode) {
      return;
    }

    const duplicate = createFlowNode(selectedNode.type, {
      x: selectedNode.position.x + 48,
      y: selectedNode.position.y + 48,
    });

    onChange({
      ...valueRef.current,
      nodes: [
        ...valueRef.current.nodes,
        {
          ...selectedNode,
          ...duplicate,
          title: `${selectedNode.title} Copy`,
        },
      ],
    });
    setSelectedNodeId(duplicate.id);
  };

  const beginConnection = (sourceId: string, handleId: FlowEdgeHandle) => {
    setSelectedNodeId(sourceId);
    setActiveConnection((current) => {
      if (current?.sourceId === sourceId && current.handleId === handleId) {
        return null;
      }
      return { sourceId, handleId };
    });
  };

  const completeConnection = (targetId: string) => {
    if (!activeConnection || activeConnection.sourceId === targetId) {
      return;
    }

    const nextEdges = valueRef.current.edges.filter(
      (edge) => !(edge.source === activeConnection.sourceId && (edge.sourceHandle || 'next') === activeConnection.handleId)
    );
    nextEdges.push(createFlowEdge(activeConnection.sourceId, targetId, activeConnection.handleId));
    onChange({
      ...valueRef.current,
      edges: nextEdges,
    });
    setActiveConnection(null);
  };

  const centerOn = (x: number, y: number, width = BOARD_NODE_WIDTH, height = 180) => {
    const viewport = boardViewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      left: Math.max(0, x - viewport.clientWidth / 2 + width / 2),
      top: Math.max(0, y - viewport.clientHeight / 2 + height / 2),
      behavior: 'smooth',
    });
  };

  const centerSelection = () => {
    if (selectedNode) {
      centerOn(selectedNode.position.x, selectedNode.position.y, BOARD_NODE_WIDTH, getNodeHeight(selectedNode));
      return;
    }

    centerOn(value.entryPosition.x, value.entryPosition.y, BOARD_ENTRY_WIDTH, BOARD_ENTRY_HEIGHT);
  };

  useEffect(() => {
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const dragState = dragStateRef.current;
      const viewport = boardViewportRef.current;
      if (!dragState || !viewport) {
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const nextX = event.clientX - viewportRect.left + viewport.scrollLeft - dragState.pointerOffsetX;
      const nextY = event.clientY - viewportRect.top + viewport.scrollTop - dragState.pointerOffsetY;

      if (dragState.nodeId === FLOW_ENTRY_ID) {
        onChange({
          ...valueRef.current,
          entryPosition: {
            x: Math.max(80, nextX),
            y: Math.max(80, nextY),
          },
        });
        return;
      }

      onChange({
        ...valueRef.current,
        nodes: valueRef.current.nodes.map((node) => (
          node.id === dragState.nodeId
            ? {
              ...node,
              position: {
                x: Math.max(80, nextX),
                y: Math.max(80, nextY),
              },
            }
            : node
        )),
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      setDraggingNodeId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onChange]);

  const startDrag = (nodeId: string, position: { x: number; y: number }, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const viewport = boardViewportRef.current;
    if (!viewport) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - viewportRect.left + viewport.scrollLeft;
    const pointerY = event.clientY - viewportRect.top + viewport.scrollTop;
    dragStateRef.current = {
      nodeId,
      pointerOffsetX: pointerX - position.x,
      pointerOffsetY: pointerY - position.y,
    };
    setDraggingNodeId(nodeId);
  };

  const handleBoardDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData(DND_MIME_TYPE) as FlowStepType;
    if (!type) {
      return;
    }

    const viewport = boardViewportRef.current;
    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    addNode(type, {
      x: Math.max(80, event.clientX - rect.left + viewport.scrollLeft - BOARD_NODE_WIDTH / 2),
      y: Math.max(80, event.clientY - rect.top + viewport.scrollTop - 90),
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[30px] border bg-card/90 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Automation Studio</p>
            <h3 className="mt-1 text-lg font-semibold">Production WhatsApp journey builder</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Multi-tenant blocks, visual branching, and phone preview in a single canvas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeConnection ? (
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                Connecting {activeConnection.sourceId === FLOW_ENTRY_ID ? 'Flow Start' : nodesById.get(activeConnection.sourceId)?.title || 'Block'}
              </Badge>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => onChange(autoLayoutFlowEditor(value))}>
              <WandSparkles className="mr-2 h-4 w-4" />
              Auto arrange
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={centerSelection}>
              <LocateFixed className="mr-2 h-4 w-4" />
              Center
            </Button>
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[290px_minmax(0,1fr)_360px]">
          <div className="rounded-[28px] border bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Contents</p>
              <h4 className="mt-2 text-lg font-semibold">Journey blocks</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Click to insert from the selected block, or drag directly onto the board.
              </p>
            </div>

            <ScrollArea className="h-[730px] px-3 py-3">
              <div className="space-y-5">
                {FLOW_NODE_GROUPS.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <div className="px-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{group.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{group.description}</p>
                    </div>

                    <div className="grid gap-2">
                      {group.items.map((type) => {
                        const meta = FLOW_NODE_META[type];
                        const Icon = meta.icon;

                        return (
                          <button
                            key={type}
                            type="button"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData(DND_MIME_TYPE, type);
                              event.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={() => addNode(type)}
                            className="rounded-[24px] border bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm"
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn('rounded-2xl border px-3 py-3 shadow-sm', meta.badge)}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold">{meta.label}</p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{meta.description}</p>
                                  </div>
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                    drag
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="rounded-[30px] border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Canvas</p>
                <h4 className="mt-1 text-lg font-semibold">Visual journey map</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Click an output pin, then click another block&apos;s input to connect the path.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">Always visible start node</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">SVG branch lines</span>
              </div>
            </div>

            <div
              ref={boardViewportRef}
              className="relative overflow-auto rounded-b-[30px] bg-[#f4f7f4]"
              style={{ height: BOARD_HEIGHT }}
            >
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleBoardDrop}
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setSelectedNodeId(FLOW_ENTRY_ID);
                    setActiveConnection(null);
                  }
                }}
                className="relative"
                style={{
                  width: boardSize.width,
                  height: boardSize.height,
                  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15,23,42,0.08) 1px, transparent 0)',
                  backgroundSize: '28px 28px',
                }}
              >
                <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                  {connectionPaths.map((path) => (
                    <path
                      key={path.id}
                      d={path.d}
                      fill="none"
                      stroke="rgba(5, 150, 105, 0.55)"
                      strokeDasharray="6 8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  ))}
                </svg>

                <FlowStartCard
                  activeConnection={activeConnection}
                  onBeginConnection={(handleId) => beginConnection(FLOW_ENTRY_ID, handleId)}
                  onPointerDown={(event) => {
                    setSelectedNodeId(FLOW_ENTRY_ID);
                    startDrag(FLOW_ENTRY_ID, value.entryPosition, event);
                  }}
                  selected={resolvedSelectedNodeId === FLOW_ENTRY_ID}
                  style={{
                    left: value.entryPosition.x,
                    top: value.entryPosition.y,
                    width: BOARD_ENTRY_WIDTH,
                    height: BOARD_ENTRY_HEIGHT,
                  }}
                />

                {value.nodes.map((node) => (
                  <div
                    key={node.id}
                    style={{ left: node.position.x, top: node.position.y }}
                    className="absolute"
                  >
                    <FlowNodeCard
                      node={node}
                      summary={getNodeSummary(node, templates, tags, availableFlows)}
                      selected={resolvedSelectedNodeId === node.id}
                      activeConnection={activeConnection}
                      isConnectionTarget={Boolean(activeConnection && activeConnection.sourceId !== node.id)}
                      isDragging={draggingNodeId === node.id}
                      connectedHandles={edgeLookup.get(node.id) || new Set<string>()}
                      onBeginConnection={(handleId) => beginConnection(node.id, handleId)}
                      onConnectTarget={() => {
                        if (activeConnection) {
                          completeConnection(node.id);
                        } else {
                          setSelectedNodeId(node.id);
                        }
                      }}
                      onPointerDown={(event) => {
                        setSelectedNodeId(node.id);
                        startDrag(node.id, node.position, event);
                      }}
                      onSelect={() => setSelectedNodeId(node.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Inspector</p>
                  <h4 className="mt-1 text-lg font-semibold">
                    {selectedNode ? selectedNode.title : 'Flow settings'}
                  </h4>
                </div>
                {selectedNode ? (
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={duplicateSelectedNode}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={deleteSelectedNode}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>

              <ScrollArea className="h-[360px] px-5 py-5">
                {!selectedNode ? (
                  <div className="space-y-4 text-sm text-muted-foreground">
                    <div className="rounded-2xl border bg-slate-50 px-4 py-3">
                      Select a block to configure tenant-specific message payloads, templates, tags, and webhooks.
                    </div>
                    <div className="rounded-2xl border bg-emerald-50 px-4 py-3 text-emerald-800">
                      Start is always visible. Every block you add stays inside the same scoped automation graph.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <InspectorField label="Block Title">
                      <Input value={selectedNode.title} onChange={(event) => patchNode(selectedNode.id, { title: event.target.value })} />
                    </InspectorField>

                    {(selectedNode.type === 'send_message' || selectedNode.type === 'send_interactive') ? (
                      <InspectorField label={selectedNode.type === 'send_interactive' ? 'Header Media' : 'Message Type'}>
                        <Select
                          value={selectedNode.media_type}
                          onValueChange={(value) => patchNode(selectedNode.id, {
                            media_type: value as FlowEditorNodeState['media_type'],
                            media_url: value === 'none' ? '' : selectedNode.media_url,
                          })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{selectedNode.type === 'send_interactive' ? 'Text header' : 'Text only'}</SelectItem>
                            <SelectItem value="image">Image</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                            <SelectItem value="document">Document</SelectItem>
                          </SelectContent>
                        </Select>
                      </InspectorField>
                    ) : null}

                    {selectedNode.type === 'send_message' ? (
                      <InspectorField label={selectedNode.media_type === 'none' ? 'Message Body' : 'Caption'}>
                        <Textarea
                          rows={5}
                          value={selectedNode.media_type === 'none' ? selectedNode.message_body : selectedNode.media_caption}
                          onChange={(event) => patchNode(selectedNode.id, selectedNode.media_type === 'none'
                            ? { message_body: event.target.value }
                            : { media_caption: event.target.value, message_body: event.target.value })}
                        />
                      </InspectorField>
                    ) : null}

                    {selectedNode.type === 'send_interactive' ? (
                      <>
                        <InspectorField label="Header Text" description="Used when header media is not selected.">
                          <Input value={selectedNode.header_text} onChange={(event) => patchNode(selectedNode.id, { header_text: event.target.value })} />
                        </InspectorField>
                        <InspectorField label="Body Text">
                          <Textarea rows={4} value={selectedNode.message_body} onChange={(event) => patchNode(selectedNode.id, { message_body: event.target.value })} />
                        </InspectorField>
                        <InspectorField label="Footer Text">
                          <Input value={selectedNode.footer_text} onChange={(event) => patchNode(selectedNode.id, { footer_text: event.target.value })} />
                        </InspectorField>
                        <InspectorField label="Reply Buttons" description={`Up to ${MAX_INTERACTIVE_BUTTONS} lines. Each line creates a branch handle.`}>
                          <Textarea rows={5} value={selectedNode.button_items_text} onChange={(event) => patchNode(selectedNode.id, { button_items_text: event.target.value })} />
                        </InspectorField>
                      </>
                    ) : null}

                    {(selectedNode.type === 'send_message' || selectedNode.type === 'send_interactive') && selectedNode.media_type !== 'none' ? (
                      <InspectorField label="Media URL">
                        <Input value={selectedNode.media_url} onChange={(event) => patchNode(selectedNode.id, { media_url: event.target.value })} placeholder="https://..." />
                      </InspectorField>
                    ) : null}

                    {selectedNode.type === 'send_template' ? (
                      <>
                        <InspectorField label="Approved Template">
                          <Select value={selectedNode.template_name || '__manual__'} onValueChange={(value) => {
                            if (value === '__manual__') {
                              patchNode(selectedNode.id, { template_name: '', template_language: 'en_US' });
                              return;
                            }

                            const template = approvedTemplates.find((item) => item.name === value);
                            patchNode(selectedNode.id, {
                              template_name: value,
                              template_language: template?.language || 'en_US',
                              title: template?.display_name || selectedNode.title,
                            });
                          }}>
                            <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__manual__">Manual entry</SelectItem>
                              {approvedTemplates.map((template) => (
                                <SelectItem key={template.id} value={template.name}>
                                  {template.display_name || template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </InspectorField>
                        <InspectorField label="Template Name">
                          <Input value={selectedNode.template_name} onChange={(event) => patchNode(selectedNode.id, { template_name: event.target.value })} />
                        </InspectorField>
                        <InspectorField label="Language">
                          <Input value={selectedNode.template_language} onChange={(event) => patchNode(selectedNode.id, { template_language: event.target.value })} />
                        </InspectorField>
                        <InspectorField label="Components JSON">
                          <Textarea rows={6} className="font-mono text-xs" value={selectedNode.template_components_text} onChange={(event) => patchNode(selectedNode.id, { template_components_text: event.target.value })} />
                        </InspectorField>
                      </>
                    ) : null}

                    {selectedNode.type === 'send_flow' ? (
                      <>
                        <InspectorField label="WhatsApp Flow">
                          <Select value={selectedNode.flow_id || '__manual__'} onValueChange={(value) => {
                            if (value === '__manual__') {
                              patchNode(selectedNode.id, { flow_id: '', flow_screen_id: '' });
                              return;
                            }

                            const flow = availableFlows.find((item) => item.id === value);
                            patchNode(selectedNode.id, {
                              flow_id: value,
                              flow_screen_id: flow?.json_definition.screens[0]?.id || '',
                              title: flow?.name || selectedNode.title,
                            });
                          }}>
                            <SelectTrigger><SelectValue placeholder="Choose flow" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__manual__">Manual flow ID</SelectItem>
                              {availableFlows.map((flow) => (
                                <SelectItem key={flow.id} value={flow.id}>
                                  {flow.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </InspectorField>
                        <InspectorField label="Flow ID">
                          <Input value={selectedNode.flow_id} onChange={(event) => patchNode(selectedNode.id, { flow_id: event.target.value })} placeholder="Local Nyife flow id or remote Meta flow id" />
                        </InspectorField>
                        <InspectorField label="CTA Text">
                          <Input value={selectedNode.flow_cta} onChange={(event) => patchNode(selectedNode.id, { flow_cta: event.target.value })} placeholder="Continue" />
                        </InspectorField>
                        <InspectorField label="Flow Action">
                          <Select value={selectedNode.flow_action} onValueChange={(value) => patchNode(selectedNode.id, { flow_action: value as FlowEditorNodeState['flow_action'] })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="navigate">Navigate</SelectItem>
                              <SelectItem value="data_exchange">Data exchange</SelectItem>
                            </SelectContent>
                          </Select>
                        </InspectorField>
                        {selectedNode.flow_action === 'navigate' ? (
                          <InspectorField label="Start Screen" description="Optional. Leave empty to let WhatsApp open the default first screen.">
                            <Select value={selectedNode.flow_screen_id || '__none__'} onValueChange={(value) => patchNode(selectedNode.id, { flow_screen_id: value === '__none__' ? '' : value })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Default first screen</SelectItem>
                                {(selectedFlow?.json_definition.screens || []).map((screen) => (
                                  <SelectItem key={screen.id} value={screen.id}>
                                    {screen.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </InspectorField>
                        ) : null}
                        <InspectorField label="Flow Token" description="Optional custom token. Leave empty to let Nyife generate one.">
                          <Input value={selectedNode.flow_token} onChange={(event) => patchNode(selectedNode.id, { flow_token: event.target.value })} placeholder="Optional token" />
                        </InspectorField>
                        <InspectorField label="Header Text">
                          <Input value={selectedNode.header_text} onChange={(event) => patchNode(selectedNode.id, { header_text: event.target.value })} />
                        </InspectorField>
                        <InspectorField label="Body Text">
                          <Textarea rows={4} value={selectedNode.message_body} onChange={(event) => patchNode(selectedNode.id, { message_body: event.target.value })} />
                        </InspectorField>
                        <InspectorField label="Footer Text">
                          <Input value={selectedNode.footer_text} onChange={(event) => patchNode(selectedNode.id, { footer_text: event.target.value })} />
                        </InspectorField>
                        <InspectorField label="Action Payload JSON" description="Optional overrides. Leave as {} to use the selected start screen when applicable.">
                          <Textarea rows={6} className="font-mono text-xs" value={selectedNode.flow_action_payload_text} onChange={(event) => patchNode(selectedNode.id, { flow_action_payload_text: event.target.value })} />
                        </InspectorField>
                      </>
                    ) : null}

                    {selectedNode.type === 'condition' ? (
                      <>
                        <InspectorField label="Operator">
                          <Select value={selectedNode.condition_operator} onValueChange={(value) => patchNode(selectedNode.id, { condition_operator: value as FlowEditorNodeState['condition_operator'] })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                              <SelectItem value="starts_with">Starts With</SelectItem>
                              <SelectItem value="regex">Regex</SelectItem>
                            </SelectContent>
                          </Select>
                        </InspectorField>
                        <InspectorField label="Compare Against">
                          <Input value={selectedNode.condition_value} onChange={(event) => patchNode(selectedNode.id, { condition_value: event.target.value })} />
                        </InspectorField>
                      </>
                    ) : null}

                    {selectedNode.type === 'add_tag' ? (
                      <InspectorField label="CRM Tag">
                        <Select value={selectedNode.tag_id || '__none__'} onValueChange={(value) => patchNode(selectedNode.id, { tag_id: value === '__none__' ? '' : value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Select tag</SelectItem>
                            {tags.map((tag) => (
                              <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </InspectorField>
                    ) : null}

                    {selectedNode.type === 'call_webhook' ? (
                      <>
                        <InspectorField label="Webhook URL">
                          <Input value={selectedNode.webhook_url} onChange={(event) => patchNode(selectedNode.id, { webhook_url: event.target.value })} placeholder="https://example.com/hook" />
                        </InspectorField>
                        <InspectorField label="Headers JSON">
                          <Textarea rows={6} className="font-mono text-xs" value={selectedNode.webhook_headers_text} onChange={(event) => patchNode(selectedNode.id, { webhook_headers_text: event.target.value })} />
                        </InspectorField>
                      </>
                    ) : null}

                    {selectedNode.type === 'delay' ? (
                      <InspectorField label="Delay Seconds" description="Current runtime supports up to 30 seconds in a synchronous flow.">
                        <Input type="number" min="1" max="30" value={selectedNode.delay_seconds} onChange={(event) => patchNode(selectedNode.id, { delay_seconds: event.target.value })} />
                      </InspectorField>
                    ) : null}

                    {selectedNode.type === 'wait_for_reply' ? (
                      <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                        Use the canvas handles to route the received reply or fallback path.
                      </div>
                    ) : null}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="rounded-[28px] border bg-white shadow-sm">
              <div className="border-b px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Preview</p>
                <h4 className="mt-1 text-lg font-semibold">Phone preview</h4>
              </div>
              <div className="px-5 py-5">
                <PhonePreview selectedNode={selectedNode} templates={templates} tags={tags} flows={availableFlows} />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span>{value.nodes.length} blocks</span>
            <span>{value.edges.length} connectors</span>
            {activeConnection ? (
              <span className="text-emerald-700">Click any block input to finish the connection.</span>
            ) : (
              <span>Tip: select a block before clicking a tile to auto-connect from that block.</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={duplicateSelectedNode} disabled={!selectedNode}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={deleteSelectedNode} disabled={!selectedNode}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
