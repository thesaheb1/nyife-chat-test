import type { FlowAvailableAction, FlowStatus, WhatsAppFlow } from '@/core/types';

export const FLOW_ACTION_KEYS = ['view', 'edit', 'publish', 'delete', 'clone', 'deprecate'] as const;

const FLOW_ACTIONS_BY_STATUS: Record<FlowStatus, FlowAvailableAction[]> = {
  DRAFT: ['view', 'edit', 'publish', 'delete'],
  PUBLISHED: ['view', 'clone', 'deprecate'],
  THROTTLED: ['view', 'clone', 'deprecate'],
  BLOCKED: ['view', 'clone', 'deprecate'],
  DEPRECATED: ['view', 'clone'],
};

export const FLOW_ACTION_LABELS: Record<FlowAvailableAction, string> = {
  view: 'View details',
  edit: 'Edit',
  publish: 'Publish',
  delete: 'Delete',
  clone: 'Clone',
  deprecate: 'Deprecate',
};

export function getFlowAvailableActions(flow: Pick<WhatsAppFlow, 'status' | 'available_actions'> | null | undefined) {
  const declared = flow?.available_actions?.filter(
    (action): action is FlowAvailableAction => FLOW_ACTION_KEYS.includes(action as FlowAvailableAction)
  );

  if (declared?.length) {
    return Array.from(new Set<FlowAvailableAction>(declared.includes('view') ? declared : ['view', ...declared]));
  }

  const status = flow?.status || 'DRAFT';
  return FLOW_ACTIONS_BY_STATUS[status] || FLOW_ACTIONS_BY_STATUS.DRAFT;
}

export function hasFlowAction(
  flow: Pick<WhatsAppFlow, 'status' | 'available_actions'> | null | undefined,
  action: FlowAvailableAction
) {
  return getFlowAvailableActions(flow).includes(action);
}

export function getVisibleLifecycleActions(
  flow: Pick<WhatsAppFlow, 'status' | 'available_actions'> | null | undefined
) {
  return getFlowAvailableActions(flow).filter((action) => action !== 'view');
}
