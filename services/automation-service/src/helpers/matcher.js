'use strict';

const {
  getComparableMessageCandidates,
} = require('./messageContent');

/**
 * Matches an incoming message against a list of automations.
 * Automations should already be sorted by priority DESC.
 * Returns the first matching automation or null.
 */
function findMatchingAutomation(automations, message) {
  const messageCandidates = getComparableMessageCandidates(message);
  const messageType = message.type || 'text';
  let fallbackAutomation = null;

  for (const automation of automations) {
    const trigger = automation.trigger_config || {};
    const triggerType = trigger.trigger_type;
    const triggerValue = trigger.trigger_value || '';
    const matchCase = trigger.match_case !== undefined ? trigger.match_case : false;

    if (triggerType === 'fallback' && !fallbackAutomation) {
      fallbackAutomation = automation;
      continue;
    }

    let matched = false;

    switch (triggerType) {
      case 'exact': {
        const value = matchCase ? triggerValue : triggerValue.toLowerCase();
        matched = messageCandidates.some((candidate) => {
          const text = matchCase ? candidate : candidate.toLowerCase();
          return text === value;
        });
        break;
      }
      case 'contains': {
        const value = matchCase ? triggerValue : triggerValue.toLowerCase();
        matched = messageCandidates.some((candidate) => {
          const text = matchCase ? candidate : candidate.toLowerCase();
          return text.includes(value);
        });
        break;
      }
      case 'keyword': {
        const value = matchCase ? triggerValue : triggerValue.toLowerCase();
        matched = messageCandidates.some((candidate) => {
          const text = matchCase ? candidate : candidate.toLowerCase();
          return text.includes(value);
        });
        break;
      }
      case 'regex': {
        try {
          const flags = matchCase ? '' : 'i';
          const regex = new RegExp(triggerValue, flags);
          matched = messageCandidates.some((candidate) => regex.test(candidate));
        } catch (e) {
          matched = false;
        }
        break;
      }
      case 'message_type': {
        matched = messageType === triggerValue;
        break;
      }
      default:
        matched = false;
    }

    if (matched && automation.conditions) {
      matched = evaluateConditions(automation.conditions, message);
    }

    if (matched) {
      return automation;
    }
  }

  if (fallbackAutomation && evaluateConditions(fallbackAutomation.conditions || {}, message)) {
    return fallbackAutomation;
  }

  return null;
}

/**
 * Evaluates additional conditions for an automation.
 */
function evaluateConditions(conditions, message) {
  if (conditions.time_of_day) {
    const now = new Date();
    const currentHour = now.getHours();
    const { from_hour, to_hour } = conditions.time_of_day;
    if (from_hour !== undefined && to_hour !== undefined) {
      if (currentHour < from_hour || currentHour >= to_hour) {
        return false;
      }
    }
  }
  return true;
}

module.exports = { findMatchingAutomation, evaluateConditions };
