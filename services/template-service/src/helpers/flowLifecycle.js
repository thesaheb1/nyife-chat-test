'use strict';

const FLOW_ACTION_KEYS = ['view', 'edit', 'publish', 'delete', 'clone', 'deprecate'];

const FLOW_ACTIONS_BY_STATUS = {
  DRAFT: ['view', 'edit', 'publish', 'delete'],
  PUBLISHED: ['view', 'clone', 'deprecate'],
  THROTTLED: ['view', 'clone', 'deprecate'],
  BLOCKED: ['view', 'clone', 'deprecate'],
  DEPRECATED: ['view', 'clone'],
};

function normalizeFlowLifecycleStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();

  if (normalized.includes('BLOCK')) {
    return 'BLOCKED';
  }

  if (normalized.includes('THROTTL')) {
    return 'THROTTLED';
  }

  if (normalized.includes('DEPREC')) {
    return 'DEPRECATED';
  }

  if (normalized.includes('PUBLISH')) {
    return 'PUBLISHED';
  }

  return 'DRAFT';
}

function getDeclaredStatus(flowOrStatus) {
  if (!flowOrStatus) {
    return 'DRAFT';
  }

  if (typeof flowOrStatus === 'string') {
    return flowOrStatus;
  }

  return flowOrStatus.status || flowOrStatus.meta_status || 'DRAFT';
}

function getFlowAvailableActions(flowOrStatus) {
  const lifecycleStatus = normalizeFlowLifecycleStatus(getDeclaredStatus(flowOrStatus));
  return FLOW_ACTIONS_BY_STATUS[lifecycleStatus] || FLOW_ACTIONS_BY_STATUS.DRAFT;
}

function canEditFlow(flowOrStatus) {
  return getFlowAvailableActions(flowOrStatus).includes('edit');
}

function canPublishFlow(flowOrStatus) {
  return getFlowAvailableActions(flowOrStatus).includes('publish');
}

function canDeleteFlow(flowOrStatus) {
  return getFlowAvailableActions(flowOrStatus).includes('delete');
}

function canCloneFlow(flowOrStatus) {
  return getFlowAvailableActions(flowOrStatus).includes('clone');
}

function canDeprecateFlow(flowOrStatus) {
  return getFlowAvailableActions(flowOrStatus).includes('deprecate');
}

module.exports = {
  FLOW_ACTION_KEYS,
  FLOW_ACTIONS_BY_STATUS,
  normalizeFlowLifecycleStatus,
  getFlowAvailableActions,
  canEditFlow,
  canPublishFlow,
  canDeleteFlow,
  canCloneFlow,
  canDeprecateFlow,
};
