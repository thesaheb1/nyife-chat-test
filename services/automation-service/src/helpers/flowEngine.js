'use strict';

const FLOW_STATE_PREFIX = 'automation:flow:';
const FLOW_TTL = 30 * 60; // 30 minutes

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

    case 'wait_for_reply':
      // This step was already waiting. The message IS the reply.
      // Store the reply text in collected data.
      collectedData[step.id] = message.text?.body || message.text || '';
      result.nextStepId = step.branches?.received || step.next || null;
      break;

    case 'condition': {
      const operator = step.config?.operator || 'contains';
      const value = step.config?.value || '';
      const messageText = (message.text?.body || message.text || '').toLowerCase();

      let conditionMet = false;
      switch (operator) {
        case 'equals':
          conditionMet = messageText === value.toLowerCase();
          break;
        case 'contains':
          conditionMet = messageText.includes(value.toLowerCase());
          break;
        case 'starts_with':
          conditionMet = messageText.startsWith(value.toLowerCase());
          break;
        case 'regex': {
          try {
            conditionMet = new RegExp(value, 'i').test(messageText);
          } catch (e) {
            conditionMet = false;
          }
          break;
        }
        default:
          conditionMet = messageText.includes(value.toLowerCase());
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
