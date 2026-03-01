'use strict';

/**
 * Matches an incoming message against a list of automations.
 * Automations should already be sorted by priority DESC.
 * Returns the first matching automation or null.
 */
function findMatchingAutomation(automations, message) {
  const messageText = (message.text?.body || message.text || '').toString();
  const messageType = message.type || 'text';

  for (const automation of automations) {
    const trigger = automation.trigger_config || {};
    const triggerType = trigger.trigger_type;
    const triggerValue = trigger.trigger_value || '';
    const matchCase = trigger.match_case !== undefined ? trigger.match_case : false;

    let matched = false;

    switch (triggerType) {
      case 'exact': {
        const text = matchCase ? messageText : messageText.toLowerCase();
        const value = matchCase ? triggerValue : triggerValue.toLowerCase();
        matched = text === value;
        break;
      }
      case 'contains': {
        const text = matchCase ? messageText : messageText.toLowerCase();
        const value = matchCase ? triggerValue : triggerValue.toLowerCase();
        matched = text.includes(value);
        break;
      }
      case 'keyword': {
        // Same as contains for backward compat
        const text = matchCase ? messageText : messageText.toLowerCase();
        const value = matchCase ? triggerValue : triggerValue.toLowerCase();
        matched = text.includes(value);
        break;
      }
      case 'regex': {
        try {
          const flags = matchCase ? '' : 'i';
          const regex = new RegExp(triggerValue, flags);
          matched = regex.test(messageText);
        } catch (e) {
          // Invalid regex — skip
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

    // Check additional conditions if present
    if (matched && automation.conditions) {
      matched = evaluateConditions(automation.conditions, message);
    }

    if (matched) {
      return automation;
    }
  }

  return null;
}

/**
 * Evaluates additional conditions for an automation.
 */
function evaluateConditions(conditions, message) {
  // Time-of-day condition
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
