import type { CreateAutomationFormData } from './validations';

export type TriggerType =
  | 'exact'
  | 'contains'
  | 'keyword'
  | 'regex'
  | 'message_type'
  | 'fallback'
  | 'flow_submission';
export type FlowRuntimeStepType =
  | 'send_message'
  | 'send_template'
  | 'send_flow'
  | 'wait_for_reply'
  | 'condition'
  | 'add_tag'
  | 'call_webhook'
  | 'delay';
export type FlowStepType = FlowRuntimeStepType | 'send_interactive';
export type FlowEdgeHandle = 'next' | 'received' | 'true' | 'false' | `button_${number}`;
export type EditorMode = 'builder' | 'json';

export interface TriggerBuilderState {
  trigger_type: TriggerType;
  trigger_value: string;
  match_case: boolean;
  flow_id: string;
  flow_screen_id: string;
  flow_category: string;
}

export interface TimeWindowState {
  enabled: boolean;
  from_hour: string;
  to_hour: string;
}

export interface BasicReplyActionState {
  body: string;
}

export interface WebhookActionState {
  webhook_url: string;
  secret: string;
  headersText: string;
}

export interface ApiActionState {
  api_url: string;
  api_method: 'POST' | 'GET' | 'PUT' | 'PATCH';
  api_headers_text: string;
  api_payload_text: string;
  reply_body: string;
}

export interface FlowStepState {
  id: string;
  type: FlowStepType;
  message_body: string;
  template_name: string;
  template_language: string;
  template_components_text: string;
  flow_id: string;
  flow_cta: string;
  flow_token: string;
  flow_action: 'navigate' | 'data_exchange';
  flow_screen_id: string;
  flow_action_payload_text: string;
  condition_operator: 'equals' | 'contains' | 'starts_with' | 'regex';
  condition_value: string;
  received_step: string;
  true_step: string;
  false_step: string;
  default_step: string;
  tag_id: string;
  webhook_url: string;
  webhook_headers_text: string;
  delay_seconds: string;
  media_type: 'none' | 'image' | 'video' | 'document';
  media_url: string;
  media_caption: string;
  header_text: string;
  footer_text: string;
  button_items_text: string;
}

export interface FlowCanvasPosition {
  x: number;
  y: number;
}

export interface FlowEditorNodeState extends FlowStepState {
  title: string;
  position: FlowCanvasPosition;
}

export interface FlowEditorEdgeState {
  id: string;
  source: string;
  target: string;
  sourceHandle?: FlowEdgeHandle;
}

export interface FlowEditorState {
  entryPosition: FlowCanvasPosition;
  nodes: FlowEditorNodeState[];
  edges: FlowEditorEdgeState[];
}

export interface FlowHandleDefinition {
  id: FlowEdgeHandle;
  label: string;
}

interface StoredFlowEditorMetadata {
  version?: number;
  flow?: Partial<FlowEditorState>;
  entryPosition?: FlowCanvasPosition;
  nodes?: Array<Partial<FlowEditorNodeState> & { id: string }>;
  edges?: FlowEditorEdgeState[];
}

interface RuntimeStep {
  id: string;
  type: FlowRuntimeStepType;
  config?: Record<string, unknown>;
  next?: string | null;
  branches?: Record<string, string>;
}

interface CompiledNodeResult {
  visualNodeId: string;
  entryStepId: string;
  steps: RuntimeStep[];
}

export const SUPPORTED_FLOW_STEP_TYPES: FlowStepType[] = [
  'send_message',
  'send_interactive',
  'send_template',
  'send_flow',
  'wait_for_reply',
  'condition',
  'add_tag',
  'call_webhook',
  'delay',
];

const SUPPORTED_RUNTIME_STEP_TYPES: FlowRuntimeStepType[] = [
  'send_message',
  'send_template',
  'send_flow',
  'wait_for_reply',
  'condition',
  'add_tag',
  'call_webhook',
  'delay',
];

export const FLOW_ENTRY_ID = 'entry';
export const FLOW_EDITOR_VERSION = 2;
export const MAX_INTERACTIVE_BUTTONS = 3;

const DEFAULT_ENTRY_POSITION: FlowCanvasPosition = { x: 120, y: 280 };
const DEFAULT_FIRST_NODE_POSITION: FlowCanvasPosition = { x: 420, y: 220 };
const LAYOUT_X_GAP = 360;
const LAYOUT_Y_GAP = 220;
const DEFAULT_INTERACTIVE_BUTTONS = 'Track order\nTalk to agent';
const BUTTON_TITLE_LIMIT = 20;

let flowStepSequence = 0;

const DEFAULT_NODE_TITLES: Record<FlowStepType, string> = {
  send_message: 'Message',
  send_interactive: 'Media + buttons',
  send_template: 'Template',
  send_flow: 'WhatsApp Flow',
  wait_for_reply: 'Wait for reply',
  condition: 'Condition',
  add_tag: 'Add tag',
  call_webhook: 'Webhook',
  delay: 'Delay',
};

function isFinitePosition(position: unknown): position is FlowCanvasPosition {
  return Boolean(
    position
      && typeof position === 'object'
      && Number.isFinite((position as FlowCanvasPosition).x)
      && Number.isFinite((position as FlowCanvasPosition).y)
  );
}

function normalizePosition(position: unknown, fallback: FlowCanvasPosition): FlowCanvasPosition {
  if (!isFinitePosition(position)) {
    return fallback;
  }

  return {
    x: Number((position as FlowCanvasPosition).x),
    y: Number((position as FlowCanvasPosition).y),
  };
}

function getNumericSuffix(value: string) {
  const match = value.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function syncFlowStepSequence(ids: string[]) {
  const maxSuffix = ids.reduce((max, id) => Math.max(max, getNumericSuffix(id)), 0);
  flowStepSequence = Math.max(flowStepSequence, maxSuffix);
}

function getDefaultNodeTitle(type: FlowStepType) {
  return DEFAULT_NODE_TITLES[type];
}

function makeButtonHandle(index: number) {
  return `button_${index}` as FlowEdgeHandle;
}

function isButtonHandle(handle: string): handle is `button_${number}` {
  return /^button_\d+$/.test(handle);
}

function normalizeEdgeHandle(handle: unknown): FlowEdgeHandle {
  if (typeof handle !== 'string') {
    return 'next';
  }

  if (handle === 'next' || handle === 'received' || handle === 'true' || handle === 'false') {
    return handle;
  }

  if (isButtonHandle(handle)) {
    return handle;
  }

  return 'next';
}

function normalizeMultilineText(value: unknown) {
  return String(value || '').replace(/\r/g, '');
}

export function parseButtonItems(value: string, label = 'Buttons') {
  const trimmed = normalizeMultilineText(value).trim();
  if (!trimmed) {
    return [];
  }

  let items: string[];
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON array or newline separated list.`);
    }

    items = parsed.map((item) => String(item || '').trim()).filter(Boolean);
  } else {
    items = trimmed
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (items.length > MAX_INTERACTIVE_BUTTONS) {
    throw new Error(`${label} supports up to ${MAX_INTERACTIVE_BUTTONS} buttons.`);
  }

  const tooLong = items.find((item) => item.length > BUTTON_TITLE_LIMIT);
  if (tooLong) {
    throw new Error(`Button labels must be ${BUTTON_TITLE_LIMIT} characters or fewer.`);
  }

  return items;
}

export function getFlowNodeButtons(node: Pick<FlowStepState, 'button_items_text'>) {
  try {
    return parseButtonItems(node.button_items_text);
  } catch {
    return [];
  }
}

export function getFlowNodeHandles(
  node: Pick<FlowEditorNodeState, 'type' | 'button_items_text'> | 'entry'
): FlowHandleDefinition[] {
  if (node === 'entry') {
    return [{ id: 'next', label: 'Start flow' }];
  }

  if (node.type === 'condition') {
    return [
      { id: 'true', label: 'Yes' },
      { id: 'false', label: 'No' },
      { id: 'next', label: 'Fallback' },
    ];
  }

  if (node.type === 'wait_for_reply') {
    return [
      { id: 'received', label: 'On reply' },
      { id: 'next', label: 'Fallback' },
    ];
  }

  if (node.type === 'send_interactive') {
    return [
      ...getFlowNodeButtons(node).map((label, index) => ({
        id: makeButtonHandle(index),
        label,
      })),
      { id: 'next', label: 'Other reply' },
    ];
  }

  return [{ id: 'next', label: 'Next' }];
}

function getVisualNodeTargets(
  node: FlowEditorNodeState,
  edgesBySource: Map<string, Map<FlowEdgeHandle, string>>
) {
  const targets = edgesBySource.get(node.id);
  if (!targets) {
    return [];
  }

  return getFlowNodeHandles(node)
    .map((handle) => targets.get(handle.id))
    .filter((target): target is string => Boolean(target));
}

function createEdgeId(source: string, target: string, sourceHandle: FlowEdgeHandle = 'next') {
  return `${source}:${sourceHandle}:${target}`;
}

export function createFlowStepId(type: FlowStepType = 'send_message') {
  flowStepSequence += 1;
  return `${type}_${flowStepSequence}`;
}

export function createFlowStep(type: FlowStepType = 'send_message'): FlowStepState {
  return {
    id: createFlowStepId(type),
    type,
    message_body: '',
    template_name: '',
    template_language: 'en_US',
    template_components_text: '[]',
    flow_id: '',
    flow_cta: 'Continue',
    flow_token: '',
    flow_action: 'navigate',
    flow_screen_id: '',
    flow_action_payload_text: '{}',
    condition_operator: 'contains',
    condition_value: '',
    received_step: '',
    true_step: '',
    false_step: '',
    default_step: '',
    tag_id: '',
    webhook_url: '',
    webhook_headers_text: '{}',
    delay_seconds: '5',
    media_type: 'none',
    media_url: '',
    media_caption: '',
    header_text: '',
    footer_text: '',
    button_items_text: type === 'send_interactive' ? DEFAULT_INTERACTIVE_BUTTONS : '',
  };
}

export function createFlowNode(
  type: FlowStepType = 'send_message',
  position: FlowCanvasPosition = DEFAULT_FIRST_NODE_POSITION
): FlowEditorNodeState {
  return {
    ...createFlowStep(type),
    title: getDefaultNodeTitle(type),
    position,
  };
}

export function createFlowEdge(
  source: string,
  target: string,
  sourceHandle: FlowEdgeHandle = 'next'
): FlowEditorEdgeState {
  return {
    id: createEdgeId(source, target, sourceHandle),
    source,
    target,
    sourceHandle,
  };
}

function normalizeNodeState(
  node: Partial<FlowEditorNodeState>,
  index: number,
  fallbackPosition: FlowCanvasPosition
): FlowEditorNodeState {
  const rawType = (typeof node.type === 'string' ? node.type : 'send_message') as FlowStepType;
  const type = SUPPORTED_FLOW_STEP_TYPES.includes(rawType) ? rawType : 'send_message';
  const state = createFlowNode(type, normalizePosition(node.position, fallbackPosition));
  state.id = typeof node.id === 'string' && node.id.trim() ? node.id.trim() : createFlowStepId(type);
  state.type = type;
  state.title = typeof node.title === 'string' && node.title.trim() ? node.title.trim() : getDefaultNodeTitle(type);
  state.message_body = String(node.message_body || '');
  state.template_name = String(node.template_name || '');
  state.template_language = String(node.template_language || 'en_US');
  state.template_components_text = normalizeMultilineText(node.template_components_text || '[]') || '[]';
  state.flow_id = String(node.flow_id || '');
  state.flow_cta = String(node.flow_cta || 'Continue');
  state.flow_token = String(node.flow_token || '');
  state.flow_action = String(node.flow_action || 'navigate') === 'data_exchange' ? 'data_exchange' : 'navigate';
  state.flow_screen_id = String(node.flow_screen_id || '');
  state.flow_action_payload_text = normalizeMultilineText(node.flow_action_payload_text || '{}') || '{}';
  state.condition_operator = (node.condition_operator as FlowStepState['condition_operator']) || 'contains';
  state.condition_value = String(node.condition_value || '');
  state.received_step = String(node.received_step || '');
  state.true_step = String(node.true_step || '');
  state.false_step = String(node.false_step || '');
  state.default_step = String(node.default_step || '');
  state.tag_id = String(node.tag_id || '');
  state.webhook_url = String(node.webhook_url || '');
  state.webhook_headers_text = normalizeMultilineText(node.webhook_headers_text || '{}') || '{}';
  state.delay_seconds = String(node.delay_seconds || '5');
  const mediaType = String(node.media_type || 'none');
  state.media_type =
    mediaType === 'image' || mediaType === 'video' || mediaType === 'document' ? mediaType : 'none';
  state.media_url = String(node.media_url || '');
  state.media_caption = String(node.media_caption || '');
  state.header_text = String(node.header_text || '');
  state.footer_text = String(node.footer_text || '');
  state.button_items_text = normalizeMultilineText(
    node.button_items_text || (type === 'send_interactive' ? DEFAULT_INTERACTIVE_BUTTONS : '')
  );
  state.position = normalizePosition(node.position, {
    x: fallbackPosition.x + index * 40,
    y: fallbackPosition.y + index * 24,
  });
  return state;
}

function normalizeFlowEditorState(flowEditor: Partial<FlowEditorState> | null | undefined): FlowEditorState {
  const rawNodes = Array.isArray(flowEditor?.nodes) ? flowEditor.nodes : [];
  const nodes = rawNodes.length > 0
    ? rawNodes.map((node, index) =>
      normalizeNodeState(node, index, {
        x: DEFAULT_FIRST_NODE_POSITION.x + index * 40,
        y: DEFAULT_FIRST_NODE_POSITION.y + index * 24,
      })
    )
    : [createFlowNode('send_message', { ...DEFAULT_FIRST_NODE_POSITION })];

  syncFlowStepSequence(nodes.map((node) => node.id));

  const edges = Array.isArray(flowEditor?.edges)
    ? flowEditor.edges
      .filter((edge) => edge && typeof edge === 'object')
      .map((edge) => ({
        id: typeof edge.id === 'string' && edge.id ? edge.id : createEdgeId(
          String(edge.source || ''),
          String(edge.target || ''),
          normalizeEdgeHandle(edge.sourceHandle)
        ),
        source: String(edge.source || ''),
        target: String(edge.target || ''),
        sourceHandle: normalizeEdgeHandle(edge.sourceHandle),
      }))
      .filter((edge) => edge.source && edge.target)
    : [createFlowEdge(FLOW_ENTRY_ID, nodes[0].id)];

  return {
    entryPosition: normalizePosition(flowEditor?.entryPosition, DEFAULT_ENTRY_POSITION),
    nodes,
    edges,
  };
}

export function autoLayoutFlowEditor(editor: FlowEditorState) {
  const normalized = normalizeFlowEditorState(editor);
  const adjacency = new Map<string, string[]>();
  const level = new Map<string, number>();
  const entryTarget = normalized.edges.find((edge) => edge.source === FLOW_ENTRY_ID)?.target;

  for (const node of normalized.nodes) {
    adjacency.set(node.id, getVisualNodeTargets(node, createEdgeLookup(normalized.edges)));
  }

  if (entryTarget) {
    const queue: Array<{ id: string; depth: number }> = [{ id: entryTarget, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.id)) {
        continue;
      }

      visited.add(current.id);
      level.set(current.id, current.depth);

      for (const target of adjacency.get(current.id) || []) {
        if (!visited.has(target)) {
          queue.push({ id: target, depth: current.depth + 1 });
        }
      }
    }
  }

  const columns = new Map<number, string[]>();
  for (const node of normalized.nodes) {
    const depth = level.get(node.id) ?? 0;
    const bucket = columns.get(depth) || [];
    bucket.push(node.id);
    columns.set(depth, bucket);
  }

  return {
    ...normalized,
    entryPosition: { x: 120, y: 300 },
    nodes: normalized.nodes.map((node) => {
      const depth = level.get(node.id) ?? 0;
      const row = columns.get(depth)?.indexOf(node.id) ?? 0;
      return {
        ...node,
        position: {
          x: 420 + depth * LAYOUT_X_GAP,
          y: 120 + row * LAYOUT_Y_GAP,
        },
      };
    }),
  };
}

export function createDefaultFlowEditorState(): FlowEditorState {
  const firstNode = createFlowNode('send_message', { ...DEFAULT_FIRST_NODE_POSITION });
  return {
    entryPosition: { ...DEFAULT_ENTRY_POSITION },
    nodes: [firstNode],
    edges: [createFlowEdge(FLOW_ENTRY_ID, firstNode.id)],
  };
}

export function createDefaultJsonConfigs() {
  return {
    trigger: JSON.stringify({ trigger_type: 'keyword', trigger_value: 'hello', match_case: false }, null, 2),
    action: JSON.stringify({ message_type: 'text', content: { body: 'Hi! How can I help?' } }, null, 2),
  };
}

export function parseJsonObject(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsed as Record<string, unknown>;
}

export function parseJsonArray(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array.`);
  }

  return parsed;
}

export function buildTriggerConfig(trigger: TriggerBuilderState) {
  if (trigger.trigger_type === 'fallback') {
    return { trigger_type: 'fallback' };
  }

  if (trigger.trigger_type === 'flow_submission') {
    return {
      trigger_type: 'flow_submission',
      flow_id: trigger.flow_id.trim() || undefined,
      screen_id: trigger.flow_screen_id.trim() || undefined,
      category: trigger.flow_category.trim() || undefined,
    };
  }

  return {
    trigger_type: trigger.trigger_type,
    trigger_value: trigger.trigger_value.trim(),
    match_case: trigger.match_case,
  };
}

export function buildConditions(timeWindow: TimeWindowState) {
  if (!timeWindow.enabled) {
    return undefined;
  }

  if (timeWindow.from_hour === '' || timeWindow.to_hour === '') {
    throw new Error('Both start and end hours are required when time conditions are enabled.');
  }

  return {
    time_of_day: {
      from_hour: Number(timeWindow.from_hour),
      to_hour: Number(timeWindow.to_hour),
    },
  };
}

function buildFlowEditorMetadata(flowEditor: FlowEditorState) {
  return {
    version: FLOW_EDITOR_VERSION,
    flow: normalizeFlowEditorState(flowEditor),
  };
}

function createEdgeLookup(edges: FlowEditorEdgeState[]) {
  const lookup = new Map<string, Map<FlowEdgeHandle, string>>();
  for (const edge of edges) {
    const source = edge.source.trim();
    const target = edge.target.trim();
    if (!source || !target) {
      continue;
    }

    const handle = normalizeEdgeHandle(edge.sourceHandle);
    const sourceMap = lookup.get(source) || new Map<FlowEdgeHandle, string>();
    sourceMap.set(handle, target);
    lookup.set(source, sourceMap);
  }
  return lookup;
}

function createOutgoingEdgeMap(flowEditor: FlowEditorState) {
  const normalized = normalizeFlowEditorState(flowEditor);
  const nodeMap = new Map(normalized.nodes.map((node) => [node.id, node]));

  if (nodeMap.size === 0) {
    throw new Error('Add at least one flow node.');
  }

  if (nodeMap.size !== normalized.nodes.length) {
    throw new Error('Each flow node ID must be unique.');
  }

  const edgesBySource = new Map<string, Map<FlowEdgeHandle, string>>();

  for (const edge of normalized.edges) {
    const source = edge.source.trim();
    const target = edge.target.trim();
    const handle = normalizeEdgeHandle(edge.sourceHandle);

    if (!target || !nodeMap.has(target)) {
      throw new Error('Every flow connection must target a valid node.');
    }

    if (source !== FLOW_ENTRY_ID && !nodeMap.has(source)) {
      throw new Error('Every flow connection must start from a valid node.');
    }

    if (source === target) {
      throw new Error('Flow nodes cannot connect to themselves.');
    }

    const allowedHandles = source === FLOW_ENTRY_ID
      ? getFlowNodeHandles('entry').map((item) => item.id)
      : getFlowNodeHandles(nodeMap.get(source)!).map((item) => item.id);

    if (!allowedHandles.includes(handle)) {
      throw new Error(`Connection handle "${handle}" is not allowed for ${source}.`);
    }

    const sourceMap = edgesBySource.get(source) || new Map<FlowEdgeHandle, string>();
    if (sourceMap.has(handle)) {
      throw new Error(`Only one connection is allowed from the "${handle}" output of ${source}.`);
    }

    sourceMap.set(handle, target);
    edgesBySource.set(source, sourceMap);
  }

  const startTarget = edgesBySource.get(FLOW_ENTRY_ID)?.get('next');
  if (!startTarget) {
    throw new Error('Connect the Start node to the first step in your flow.');
  }

  const reachable = new Set<string>();
  const order: string[] = [];
  const queue: string[] = [startTarget];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || reachable.has(current)) {
      continue;
    }

    reachable.add(current);
    order.push(current);

    const node = nodeMap.get(current);
    if (!node) {
      continue;
    }

    for (const target of getVisualNodeTargets(node, edgesBySource)) {
      if (!reachable.has(target)) {
        queue.push(target);
      }
    }
  }

  const disconnected = normalized.nodes.filter((node) => !reachable.has(node.id));
  if (disconnected.length > 0) {
    throw new Error(
      `Connect every flow node to Start. Disconnected nodes: ${disconnected.map((node) => node.title).join(', ')}.`
    );
  }

  return { normalized, nodeMap, edgesBySource, order };
}

function getEdgeTarget(
  edgesBySource: Map<string, Map<FlowEdgeHandle, string>>,
  sourceId: string,
  handle: FlowEdgeHandle = 'next'
) {
  return edgesBySource.get(sourceId)?.get(handle) || null;
}

function buildSendMessageConfig(node: FlowEditorNodeState) {
  if (node.media_type !== 'none') {
    if (!node.media_url.trim()) {
      throw new Error(`Node "${node.title}" needs a media URL.`);
    }

    const content: Record<string, unknown> = {
      link: node.media_url.trim(),
    };
    const caption = node.media_caption.trim() || node.message_body.trim();
    if (caption) {
      content.caption = caption;
    }

    return {
      message_type: node.media_type,
      content,
    };
  }

  if (!node.message_body.trim()) {
    throw new Error(`Node "${node.title}" needs a message body.`);
  }

  return {
    message_type: 'text',
    content: {
      body: node.message_body.trim(),
    },
  };
}

function buildInteractivePayload(node: FlowEditorNodeState, buttons: string[]) {
  if (!node.message_body.trim()) {
    throw new Error(`Node "${node.title}" needs message text.`);
  }

  const payload: Record<string, unknown> = {
    type: 'button',
    body: {
      text: node.message_body.trim(),
    },
    action: {
      buttons: buttons.map((label, index) => ({
        type: 'reply',
        reply: {
          id: `${node.id}_button_${index}`,
          title: label,
        },
      })),
    },
  };

  if (node.media_type !== 'none') {
    if (!node.media_url.trim()) {
      throw new Error(`Node "${node.title}" needs a media URL.`);
    }

    const mediaKey = node.media_type;
    payload.header = {
      type: mediaKey,
      [mediaKey]: {
        link: node.media_url.trim(),
      },
    };
  } else if (node.header_text.trim()) {
    payload.header = {
      type: 'text',
      text: node.header_text.trim(),
    };
  }

  if (node.footer_text.trim()) {
    payload.footer = {
      text: node.footer_text.trim(),
    };
  }

  return payload;
}

function compileVisualNode(
  node: FlowEditorNodeState,
  edgesBySource: Map<string, Map<FlowEdgeHandle, string>>
): CompiledNodeResult {
  if (node.type === 'send_message') {
    return {
      visualNodeId: node.id,
      entryStepId: node.id,
      steps: [
        {
          id: node.id,
          type: 'send_message',
          config: buildSendMessageConfig(node),
          next: getEdgeTarget(edgesBySource, node.id, 'next'),
        },
      ],
    };
  }

  if (node.type === 'send_interactive') {
    const buttons = parseButtonItems(node.button_items_text, `Buttons for ${node.title}`);
    if (buttons.length === 0) {
      throw new Error(`Node "${node.title}" needs at least one reply button.`);
    }

    const sendStepId = `${node.id}__send`;
    const waitStepId = `${node.id}__wait`;
    const branchStepIds = buttons.map((_, index) => `${node.id}__branch_${index}`);
    const fallbackTarget = getEdgeTarget(edgesBySource, node.id, 'next');

    const steps: RuntimeStep[] = [
      {
        id: sendStepId,
        type: 'send_message',
        config: {
          message_type: 'interactive',
          content: buildInteractivePayload(node, buttons),
        },
        next: waitStepId,
      },
      {
        id: waitStepId,
        type: 'wait_for_reply',
        branches: {
          received: branchStepIds[0],
        },
        next: branchStepIds[0],
      },
    ];

    buttons.forEach((buttonLabel, index) => {
      const buttonTarget = getEdgeTarget(edgesBySource, node.id, makeButtonHandle(index)) || fallbackTarget;
      const nextCondition = branchStepIds[index + 1] || fallbackTarget;
      const branches: Record<string, string> = {};
      if (buttonTarget) {
        branches.true = buttonTarget;
      }

      steps.push({
        id: branchStepIds[index],
        type: 'condition',
        config: {
          operator: 'equals',
          value: buttonLabel,
        },
        branches: Object.keys(branches).length > 0 ? branches : undefined,
        next: nextCondition,
      });
    });

    return {
      visualNodeId: node.id,
      entryStepId: sendStepId,
      steps,
    };
  }

  if (node.type === 'send_template') {
    if (!node.template_name.trim()) {
      throw new Error(`Node "${node.title}" needs a template name.`);
    }

    return {
      visualNodeId: node.id,
      entryStepId: node.id,
      steps: [
        {
          id: node.id,
          type: 'send_template',
          config: {
            template_name: node.template_name.trim(),
            template_language: node.template_language.trim() || 'en_US',
            components: parseJsonArray(node.template_components_text, `Template components for ${node.title}`),
          },
          next: getEdgeTarget(edgesBySource, node.id, 'next'),
        },
      ],
    };
  }

  if (node.type === 'send_flow') {
    if (!node.flow_id.trim()) {
      throw new Error(`Node "${node.title}" needs a WhatsApp Flow.`);
    }

    const parsedPayload = parseJsonObject(
      node.flow_action_payload_text,
      `Flow action payload for ${node.title}`
    );

    const flowActionPayload =
      Object.keys(parsedPayload).length > 0
        ? parsedPayload
        : node.flow_action === 'navigate' && node.flow_screen_id.trim()
          ? { screen: node.flow_screen_id.trim() }
          : undefined;

    return {
      visualNodeId: node.id,
      entryStepId: node.id,
      steps: [
        {
          id: node.id,
          type: 'send_flow',
          config: {
            flow_id: node.flow_id.trim(),
            flow_cta: node.flow_cta.trim() || 'Continue',
            flow_token: node.flow_token.trim() || undefined,
            flow_message_version: '3',
            flow_action: node.flow_action,
            flow_action_payload: flowActionPayload,
            body_text: node.message_body.trim() || undefined,
            header_text: node.header_text.trim() || undefined,
            footer_text: node.footer_text.trim() || undefined,
          },
          next: getEdgeTarget(edgesBySource, node.id, 'next'),
        },
      ],
    };
  }

  if (node.type === 'wait_for_reply') {
    const receivedTarget = getEdgeTarget(edgesBySource, node.id, 'received');
    const fallbackTarget = getEdgeTarget(edgesBySource, node.id, 'next');
    return {
      visualNodeId: node.id,
      entryStepId: node.id,
      steps: [
        {
          id: node.id,
          type: 'wait_for_reply',
          branches: receivedTarget ? { received: receivedTarget } : undefined,
          next: fallbackTarget || receivedTarget,
        },
      ],
    };
  }

  if (node.type === 'condition') {
    if (!node.condition_value.trim()) {
      throw new Error(`Node "${node.title}" needs a condition value.`);
    }

    const branches: Record<string, string> = {};
    const trueTarget = getEdgeTarget(edgesBySource, node.id, 'true');
    const falseTarget = getEdgeTarget(edgesBySource, node.id, 'false');
    if (trueTarget) {
      branches.true = trueTarget;
    }
    if (falseTarget) {
      branches.false = falseTarget;
    }

    return {
      visualNodeId: node.id,
      entryStepId: node.id,
      steps: [
        {
          id: node.id,
          type: 'condition',
          config: {
            operator: node.condition_operator,
            value: node.condition_value.trim(),
          },
          branches: Object.keys(branches).length > 0 ? branches : undefined,
          next: getEdgeTarget(edgesBySource, node.id, 'next'),
        },
      ],
    };
  }

  if (node.type === 'add_tag') {
    if (!node.tag_id.trim()) {
      throw new Error(`Node "${node.title}" needs a tag.`);
    }

    return {
      visualNodeId: node.id,
      entryStepId: node.id,
      steps: [
        {
          id: node.id,
          type: 'add_tag',
          config: {
            tag_id: node.tag_id.trim(),
          },
          next: getEdgeTarget(edgesBySource, node.id, 'next'),
        },
      ],
    };
  }

  if (node.type === 'call_webhook') {
    if (!node.webhook_url.trim()) {
      throw new Error(`Node "${node.title}" needs a webhook URL.`);
    }

    return {
      visualNodeId: node.id,
      entryStepId: node.id,
      steps: [
        {
          id: node.id,
          type: 'call_webhook',
          config: {
            url: node.webhook_url.trim(),
            headers: parseJsonObject(node.webhook_headers_text, `Webhook headers for ${node.title}`),
          },
          next: getEdgeTarget(edgesBySource, node.id, 'next'),
        },
      ],
    };
  }

  const seconds = Number(node.delay_seconds || '0');
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 30) {
    throw new Error(`Node "${node.title}" needs a delay between 1 and 30 seconds.`);
  }

  return {
    visualNodeId: node.id,
    entryStepId: node.id,
    steps: [
      {
        id: node.id,
        type: 'delay',
        config: {
          seconds,
        },
        next: getEdgeTarget(edgesBySource, node.id, 'next'),
      },
    ],
  };
}

function resolveRuntimeReference(reference: string | null | undefined, entryStepMap: Map<string, string>) {
  if (!reference) {
    return null;
  }

  return entryStepMap.get(reference) || reference;
}

function resolveRuntimeStep(step: RuntimeStep, entryStepMap: Map<string, string>): RuntimeStep {
  const branches = step.branches
    ? Object.fromEntries(
      Object.entries(step.branches)
        .map(([key, value]) => [key, resolveRuntimeReference(value, entryStepMap)])
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
    )
    : undefined;

  return {
    ...step,
    next: resolveRuntimeReference(step.next, entryStepMap),
    branches: branches && Object.keys(branches).length > 0 ? branches : undefined,
  };
}

export function buildFlowSteps(flowEditor: FlowEditorState) {
  const { nodeMap, edgesBySource, order } = createOutgoingEdgeMap(flowEditor);
  const compiledNodes = order.map((stepId) => compileVisualNode(nodeMap.get(stepId)!, edgesBySource));
  const entryStepMap = new Map(compiledNodes.map((node) => [node.visualNodeId, node.entryStepId]));

  return compiledNodes
    .flatMap((node) => node.steps)
    .map((step) => resolveRuntimeStep(step, entryStepMap));
}

export function buildActionConfig(
  automationType: CreateAutomationFormData['type'],
  basicReply: BasicReplyActionState,
  webhookAction: WebhookActionState,
  apiAction: ApiActionState,
  flowEditor: FlowEditorState
) {
  if (automationType === 'basic_reply') {
    if (!basicReply.body.trim()) {
      throw new Error('Reply message is required.');
    }

    return {
      message_type: 'text',
      content: { body: basicReply.body.trim() },
    };
  }

  if (automationType === 'webhook_trigger') {
    if (!webhookAction.webhook_url.trim()) {
      throw new Error('Webhook URL is required.');
    }

    return {
      webhook_url: webhookAction.webhook_url.trim(),
      secret: webhookAction.secret.trim() || undefined,
      headers: parseJsonObject(webhookAction.headersText, 'Webhook headers'),
    };
  }

  if (automationType === 'api_trigger') {
    if (!apiAction.api_url.trim()) {
      throw new Error('API URL is required.');
    }

    return {
      api_url: apiAction.api_url.trim(),
      api_method: apiAction.api_method,
      api_headers: parseJsonObject(apiAction.api_headers_text, 'API headers'),
      api_payload: parseJsonObject(apiAction.api_payload_text, 'API payload'),
      reply_type: apiAction.reply_body.trim() ? 'text' : undefined,
      reply_content: apiAction.reply_body.trim() ? { body: apiAction.reply_body.trim() } : undefined,
    };
  }

  return {
    steps: buildFlowSteps(flowEditor),
    editor: buildFlowEditorMetadata(flowEditor),
  };
}

export function hydrateTriggerBuilder(triggerConfig: Record<string, unknown> | null | undefined): TriggerBuilderState {
  return {
    trigger_type: (triggerConfig?.trigger_type as TriggerType) || 'keyword',
    trigger_value: String(triggerConfig?.trigger_value || ''),
    match_case: Boolean(triggerConfig?.match_case),
    flow_id: String(triggerConfig?.flow_id || ''),
    flow_screen_id: String(triggerConfig?.screen_id || ''),
    flow_category: String(triggerConfig?.category || ''),
  };
}

export function hydrateTimeWindow(conditions: Record<string, unknown> | null | undefined): TimeWindowState {
  const timeOfDay = conditions?.time_of_day as { from_hour?: number; to_hour?: number } | undefined;
  if (!timeOfDay) {
    return { enabled: false, from_hour: '', to_hour: '' };
  }

  return {
    enabled: true,
    from_hour: timeOfDay.from_hour !== undefined ? String(timeOfDay.from_hour) : '',
    to_hour: timeOfDay.to_hour !== undefined ? String(timeOfDay.to_hour) : '',
  };
}

export function hydrateBasicReplyAction(actionConfig: Record<string, unknown> | null | undefined): BasicReplyActionState {
  const content = actionConfig?.content;
  if (content && typeof content === 'object' && !Array.isArray(content) && 'body' in content) {
    return { body: String((content as { body?: string }).body || '') };
  }

  return { body: typeof content === 'string' ? content : '' };
}

export function hydrateWebhookAction(actionConfig: Record<string, unknown> | null | undefined): WebhookActionState {
  return {
    webhook_url: String(actionConfig?.webhook_url || ''),
    secret: String(actionConfig?.secret || ''),
    headersText: JSON.stringify(actionConfig?.headers || {}, null, 2),
  };
}

export function hydrateApiAction(actionConfig: Record<string, unknown> | null | undefined): ApiActionState {
  const replyContent = actionConfig?.reply_content;

  return {
    api_url: String(actionConfig?.api_url || ''),
    api_method: ((actionConfig?.api_method as ApiActionState['api_method']) || 'POST'),
    api_headers_text: JSON.stringify(actionConfig?.api_headers || {}, null, 2),
    api_payload_text: JSON.stringify(actionConfig?.api_payload || {}, null, 2),
    reply_body:
      replyContent
      && typeof replyContent === 'object'
      && !Array.isArray(replyContent)
      && 'body' in replyContent
        ? String((replyContent as { body?: string }).body || '')
        : '',
  };
}

function createLayoutMap(steps: Array<Record<string, unknown>>) {
  const adjacency = new Map<string, string[]>();
  const levels = new Map<string, number>();
  const startId = String(steps[0]?.id || '');

  for (const step of steps) {
    const stepId = String(step.id || '');
    const type = step.type as FlowRuntimeStepType | undefined;
    const branches = (step.branches || {}) as Record<string, unknown>;
    const targets: string[] = [];

    if (type === 'condition') {
      if (typeof branches.true === 'string' && branches.true) {
        targets.push(branches.true);
      }
      if (typeof branches.false === 'string' && branches.false) {
        targets.push(branches.false);
      }
      if (typeof step.next === 'string' && step.next) {
        targets.push(String(step.next));
      }
    } else if (type === 'wait_for_reply') {
      if (typeof branches.received === 'string' && branches.received) {
        targets.push(branches.received);
      }
      if (typeof step.next === 'string' && step.next) {
        targets.push(String(step.next));
      }
    } else if (typeof step.next === 'string' && step.next) {
      targets.push(String(step.next));
    }

    adjacency.set(stepId, targets.filter(Boolean));
  }

  const queue: Array<{ id: string; depth: number }> = startId ? [{ id: startId, depth: 0 }] : [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) {
      continue;
    }

    visited.add(current.id);
    levels.set(current.id, current.depth);

    for (const target of adjacency.get(current.id) || []) {
      if (!visited.has(target)) {
        queue.push({ id: target, depth: current.depth + 1 });
      }
    }
  }

  const nodesByDepth = new Map<number, string[]>();
  for (const step of steps) {
    const id = String(step.id || '');
    const depth = levels.get(id) ?? 0;
    const bucket = nodesByDepth.get(depth) || [];
    bucket.push(id);
    nodesByDepth.set(depth, bucket);
  }

  const positions = new Map<string, FlowCanvasPosition>();
  for (const [depth, ids] of nodesByDepth.entries()) {
    ids.forEach((id, index) => {
      positions.set(id, {
        x: DEFAULT_FIRST_NODE_POSITION.x + depth * LAYOUT_X_GAP,
        y: 120 + index * LAYOUT_Y_GAP,
      });
    });
  }

  return positions;
}

function isInteractiveButtonPayload(content: unknown) {
  return Boolean(
    content
      && typeof content === 'object'
      && !Array.isArray(content)
      && (content as { type?: string }).type === 'button'
      && Array.isArray((content as { action?: { buttons?: unknown[] } }).action?.buttons)
  );
}

function hydrateFlowNode(
  stepData: Record<string, unknown>,
  index: number,
  position: FlowCanvasPosition,
  title?: string
) {
  const config = (stepData.config || {}) as Record<string, unknown>;
  const branches = (stepData.branches || {}) as Record<string, unknown>;
  const rawType = (stepData.type as FlowRuntimeStepType) || 'send_message';
  const type = SUPPORTED_RUNTIME_STEP_TYPES.includes(rawType) ? rawType : 'send_message';
  const messageType = String(config.message_type || 'text');

  const state = createFlowNode(
    type === 'send_message' && messageType === 'interactive' && isInteractiveButtonPayload(config.content)
      ? 'send_interactive'
      : type,
    position
  );

  state.id = String(stepData.id || `step_${index + 1}`);
  state.title = title || getDefaultNodeTitle(state.type);
  state.position = position;

  if (state.type === 'send_interactive') {
    const interactiveContent = (config.content || {}) as Record<string, unknown>;
    const header = (interactiveContent.header || {}) as Record<string, unknown>;
    const footer = (interactiveContent.footer || {}) as Record<string, unknown>;
    const action = (interactiveContent.action || {}) as { buttons?: Array<{ reply?: { title?: string } }> };
    const buttons = Array.isArray(action.buttons)
      ? action.buttons.map((button) => String(button.reply?.title || '')).filter(Boolean)
      : [];

    state.message_body = String((interactiveContent.body as { text?: string } | undefined)?.text || '');
    state.footer_text = String(footer.text || '');
    state.button_items_text = buttons.join('\n') || DEFAULT_INTERACTIVE_BUTTONS;

    if (header.type === 'text') {
      state.header_text = String(header.text || '');
    } else if (header.type === 'image' || header.type === 'video' || header.type === 'document') {
      state.media_type = header.type;
      state.media_url = String((header[header.type] as { link?: string } | undefined)?.link || '');
    }
  } else if (state.type === 'send_message') {
    if (messageType === 'image' || messageType === 'video' || messageType === 'document') {
      const mediaContent = (config.content || {}) as Record<string, unknown>;
      state.media_type = messageType;
      state.media_url = String(mediaContent.link || '');
      state.media_caption = String(mediaContent.caption || '');
      state.message_body = state.media_caption;
    } else {
      state.message_body =
        typeof config.content === 'object'
        && config.content !== null
        && 'body' in (config.content as Record<string, unknown>)
          ? String((config.content as { body?: string }).body || '')
          : String(config.text || '');
    }
  }

  state.template_name = String(config.template_name || '');
  state.template_language = String(config.template_language || 'en_US');
  state.template_components_text = JSON.stringify(config.components || [], null, 2);
  state.flow_id = String(config.flow_id || '');
  state.flow_cta = String(config.flow_cta || 'Continue');
  state.flow_token = String(config.flow_token || '');
  state.flow_action = String(config.flow_action || 'navigate') === 'data_exchange' ? 'data_exchange' : 'navigate';
  const flowActionPayload = (config.flow_action_payload || {}) as Record<string, unknown>;
  state.flow_screen_id = typeof flowActionPayload.screen === 'string' ? flowActionPayload.screen : '';
  state.flow_action_payload_text = JSON.stringify(flowActionPayload, null, 2);
  state.message_body = String(config.body_text || state.message_body || '');
  state.header_text = String(config.header_text || state.header_text || '');
  state.footer_text = String(config.footer_text || state.footer_text || '');
  state.condition_operator = (config.operator as FlowStepState['condition_operator']) || 'contains';
  state.condition_value = String(config.value || '');
  state.received_step = String(branches.received || '');
  state.true_step = String(branches.true || '');
  state.false_step = String(branches.false || '');
  state.default_step = String(stepData.next || '');
  state.tag_id = String(config.tag_id || '');
  state.webhook_url = String(config.url || '');
  state.webhook_headers_text = JSON.stringify(config.headers || {}, null, 2);
  state.delay_seconds = String(config.seconds || '5');

  return state;
}

function deriveEdgesFromSteps(steps: Array<Record<string, unknown>>) {
  const edges: FlowEditorEdgeState[] = [];
  if (steps.length === 0) {
    return edges;
  }

  const firstId = String(steps[0]?.id || '');
  if (firstId) {
    edges.push(createFlowEdge(FLOW_ENTRY_ID, firstId));
  }

  for (const step of steps) {
    const id = String(step.id || '');
    if (!id) {
      continue;
    }

    const type = step.type as FlowRuntimeStepType | undefined;
    const branches = (step.branches || {}) as Record<string, unknown>;
    const next = typeof step.next === 'string' ? step.next : null;

    if (type === 'condition') {
      if (typeof branches.true === 'string' && branches.true) {
        edges.push(createFlowEdge(id, branches.true, 'true'));
      }
      if (typeof branches.false === 'string' && branches.false) {
        edges.push(createFlowEdge(id, branches.false, 'false'));
      }
      if (next) {
        edges.push(createFlowEdge(id, next, 'next'));
      }
      continue;
    }

    if (type === 'wait_for_reply') {
      if (typeof branches.received === 'string' && branches.received) {
        edges.push(createFlowEdge(id, branches.received, 'received'));
      }
      if (next) {
        edges.push(createFlowEdge(id, next, 'next'));
      }
      continue;
    }

    if (next) {
      edges.push(createFlowEdge(id, next, 'next'));
    }
  }

  return edges;
}

function hydrateStoredFlow(editor: StoredFlowEditorMetadata | null | undefined) {
  if (!editor || editor.version !== FLOW_EDITOR_VERSION || !editor.flow) {
    return null;
  }

  const normalized = normalizeFlowEditorState(editor.flow);
  return {
    ...normalized,
    edges: normalized.edges.length > 0 ? normalized.edges : [createFlowEdge(FLOW_ENTRY_ID, normalized.nodes[0].id)],
  };
}

export function hydrateFlowEditor(actionConfig: Record<string, unknown> | null | undefined): FlowEditorState {
  const stored = hydrateStoredFlow((actionConfig?.editor || null) as StoredFlowEditorMetadata | null);
  if (stored) {
    return stored;
  }

  const steps = Array.isArray(actionConfig?.steps)
    ? (actionConfig?.steps as Array<Record<string, unknown>>)
    : [];

  if (steps.length === 0) {
    return createDefaultFlowEditorState();
  }

  const editor = (actionConfig?.editor || {}) as StoredFlowEditorMetadata;
  const layoutMap = createLayoutMap(steps);
  const editorNodes = new Map(
    Array.isArray(editor.nodes)
      ? editor.nodes
        .filter((node) => node && typeof node === 'object' && typeof node.id === 'string')
        .map((node) => [
          node.id,
          {
            title: typeof node.title === 'string' ? node.title : undefined,
            position: normalizePosition(node.position, layoutMap.get(node.id) || DEFAULT_FIRST_NODE_POSITION),
          },
        ])
      : []
  );

  syncFlowStepSequence(steps.map((step) => String(step.id || '')));

  const nodes = steps.map((step, index) => {
    const id = String(step.id || '');
    const metadata = editorNodes.get(id);
    return hydrateFlowNode(
      step,
      index,
      metadata?.position || layoutMap.get(id) || {
        x: DEFAULT_FIRST_NODE_POSITION.x + index * 40,
        y: DEFAULT_FIRST_NODE_POSITION.y + index * 24,
      },
      metadata?.title
    );
  });

  return {
    entryPosition: normalizePosition(editor.entryPosition, DEFAULT_ENTRY_POSITION),
    nodes,
    edges: deriveEdgesFromSteps(steps),
  };
}

export function hydrateFlowSteps(actionConfig: Record<string, unknown> | null | undefined): FlowStepState[] {
  return hydrateFlowEditor(actionConfig).nodes.map((node) => ({
    id: node.id,
    type: node.type,
    message_body: node.message_body,
    template_name: node.template_name,
    template_language: node.template_language,
    template_components_text: node.template_components_text,
    flow_id: node.flow_id,
    flow_cta: node.flow_cta,
    flow_token: node.flow_token,
    flow_action: node.flow_action,
    flow_screen_id: node.flow_screen_id,
    flow_action_payload_text: node.flow_action_payload_text,
    condition_operator: node.condition_operator,
    condition_value: node.condition_value,
    received_step: node.received_step,
    true_step: node.true_step,
    false_step: node.false_step,
    default_step: node.default_step,
    tag_id: node.tag_id,
    webhook_url: node.webhook_url,
    webhook_headers_text: node.webhook_headers_text,
    delay_seconds: node.delay_seconds,
    media_type: node.media_type,
    media_url: node.media_url,
    media_caption: node.media_caption,
    header_text: node.header_text,
    footer_text: node.footer_text,
    button_items_text: node.button_items_text,
  }));
}

export function hasUnsupportedBuilderConfig(
  automationType: CreateAutomationFormData['type'],
  triggerConfig: Record<string, unknown> | null | undefined,
  actionConfig: Record<string, unknown> | null | undefined
) {
  const triggerType = triggerConfig?.trigger_type as TriggerType | undefined;
  const supportedTriggerTypes: TriggerType[] = ['exact', 'contains', 'keyword', 'regex', 'message_type', 'fallback', 'flow_submission'];
  if (triggerType && !supportedTriggerTypes.includes(triggerType)) {
    return true;
  }

  if (automationType === 'basic_reply') {
    const messageType = actionConfig?.message_type;
    return Boolean(messageType && messageType !== 'text');
  }

  if (automationType === 'advanced_flow') {
    const editor = (actionConfig?.editor || null) as StoredFlowEditorMetadata | null;
    if (editor?.version === FLOW_EDITOR_VERSION && editor.flow) {
      return false;
    }

    const steps = Array.isArray(actionConfig?.steps)
      ? (actionConfig.steps as Array<Record<string, unknown>>)
      : [];

    return steps.some((step) => {
      const type = (step.type as FlowRuntimeStepType) || 'send_message';
      if (!SUPPORTED_RUNTIME_STEP_TYPES.includes(type)) {
        return true;
      }

      if (type === 'send_message') {
        const config = (step.config || {}) as Record<string, unknown>;
        const messageType = String(config.message_type || 'text');
        return !['text', 'image', 'video', 'document'].includes(messageType);
      }

      return false;
    });
  }

  return false;
}
