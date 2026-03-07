'use strict';

const FLOW_STATE_PREFIX = 'automation:flow:';
const FLOW_TTL = 30 * 60; // 30 minutes
const {
  getComparableMessageCandidates,
  getPrimaryMessageText,
} = require('./messageContent');

/**
 * Gets active flow state from Redis for a user+contact pair.
 */
async function getFlowState(redis, userId, contactPhone) {
  if (!redis) return null;
  const key = `${FLOW_STATE_PREFIX}${userId}:${contactPhone}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Sets flow state in Redis with TTL.
 */
async function setFlowState(redis, userId, contactPhone, state) {
  if (!redis) return;
  const key = `${FLOW_STATE_PREFIX}${userId}:${contactPhone}`;
  await redis.set(key, JSON.stringify(state), 'EX', FLOW_TTL);
}

/**
 * Clears flow state from Redis.
 */
async function clearFlowState(redis, userId, contactPhone) {
  if (!redis) return;
  const key = `${FLOW_STATE_PREFIX}${userId}:${contactPhone}`;
  await redis.del(key);
}

/**
 * Finds a step in a flow by ID.
 */
function findStep(steps, stepId) {
  return steps.find((s) => s.id === stepId) || null;
}

/**
 * Executes a flow step and returns the next action.
 * Returns { actions: [{type, config}], nextStepId, waitForReply }
 */
function processFlowStep(step, message, collectedData) {
  if (!step) return { actions: [], nextStepId: null, waitForReply: false };

  const result = { actions: [], nextStepId: null, waitForReply: false };

  switch (step.type) {
    case 'send_message':
      result.actions.push({ type: 'send_message', config: step.config });
      result.nextStepId = step.next || null;
      break;

    case 'send_template':
      result.actions.push({ type: 'send_template', config: step.config });
      result.nextStepId = step.next || null;
      break;

    case 'send_flow':
      result.actions.push({ type: 'send_flow', config: step.config });
      result.nextStepId = step.next || null;
      break;

    case 'wait_for_reply':
      // This step was already waiting. The message IS the reply.
      // Store the reply text in collected data.
      collectedData[step.id] = getPrimaryMessageText(message);
      result.nextStepId = step.branches?.received || step.next || null;
      break;

    case 'condition': {
      const operator = step.config?.operator || 'contains';
      const value = step.config?.value || '';
      const candidates = getComparableMessageCandidates(message);
      const normalizedValue = String(value).toLowerCase();

      let conditionMet = false;
      switch (operator) {
        case 'equals':
          conditionMet = candidates.some((candidate) => candidate.toLowerCase() === normalizedValue);
          break;
        case 'contains':
          conditionMet = candidates.some((candidate) => candidate.toLowerCase().includes(normalizedValue));
          break;
        case 'starts_with':
          conditionMet = candidates.some((candidate) => candidate.toLowerCase().startsWith(normalizedValue));
          break;
        case 'regex': {
          try {
            const regex = new RegExp(value, 'i');
            conditionMet = candidates.some((candidate) => regex.test(candidate));
          } catch (e) {
            conditionMet = false;
          }
          break;
        }
        default:
          conditionMet = candidates.some((candidate) => candidate.toLowerCase().includes(normalizedValue));
      }

      result.nextStepId = conditionMet
        ? step.branches?.true || step.next
        : step.branches?.false || step.next;
      break;
    }

    case 'add_tag':
      result.actions.push({ type: 'add_tag', config: step.config });
      result.nextStepId = step.next || null;
      break;

    case 'call_webhook':
      result.actions.push({ type: 'call_webhook', config: step.config });
      result.nextStepId = step.next || null;
      break;

    case 'delay':
      result.actions.push({ type: 'delay', config: step.config });
      result.nextStepId = step.next || null;
      break;

    default:
      result.nextStepId = step.next || null;
  }

  return result;
}

module.exports = {
  getFlowState,
  setFlowState,
  clearFlowState,
  findStep,
  processFlowStep,
  FLOW_STATE_PREFIX,
  FLOW_TTL,
};
