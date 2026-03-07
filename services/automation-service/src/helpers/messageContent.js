'use strict';

function normalizeString(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function getComparableMessageCandidates(message) {
  const candidates = unique([
    normalizeString(message?.text?.body),
    typeof message?.text === 'string' ? normalizeString(message.text) : '',
    normalizeString(message?.button?.text),
    normalizeString(message?.button?.payload),
    normalizeString(message?.interactive?.button_reply?.title),
    normalizeString(message?.interactive?.button_reply?.id),
    normalizeString(message?.interactive?.list_reply?.title),
    normalizeString(message?.interactive?.list_reply?.description),
    normalizeString(message?.interactive?.list_reply?.id),
    normalizeString(message?.flow_submission?.screenId),
    normalizeString(message?.flow_submission?.screen_id),
    normalizeString(message?.flow_submission?.flowToken),
  ]);

  return candidates;
}

function getPrimaryMessageText(message) {
  const [primary = ''] = getComparableMessageCandidates(message);
  if (primary) {
    return primary;
  }

  if (message?.flow_submission?.payload) {
    try {
      return JSON.stringify(message.flow_submission.payload);
    } catch {
      return '';
    }
  }

  return '';
}

module.exports = {
  getComparableMessageCandidates,
  getPrimaryMessageText,
};
