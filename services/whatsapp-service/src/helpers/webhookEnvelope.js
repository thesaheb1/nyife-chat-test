'use strict';

const SUPPORTED_WEBHOOK_FIELDS = new Set([
  'messages',
  'message_template_status_update',
  'message_template_quality_update',
  'phone_number_quality_update',
  'account_update',
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isMetaWebhookEnvelope(body) {
  return Boolean(
    isObject(body)
      && body.object === 'whatsapp_business_account'
      && Array.isArray(body.entry)
  );
}

function mapLegacyMessageStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  switch (normalized) {
    case 'accepted':
    case 'queued':
      return 'queued';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'read':
      return 'read';
    case 'failed':
      return 'failed';
    default:
      return null;
  }
}

function inferFieldFromEventName(eventName) {
  const normalizedEvent = String(eventName || '').trim().toLowerCase();
  if (!normalizedEvent) {
    return null;
  }

  if (normalizedEvent.includes('template') && normalizedEvent.includes('quality')) {
    return 'message_template_quality_update';
  }
  if (normalizedEvent.includes('template')) {
    return 'message_template_status_update';
  }
  if (normalizedEvent.includes('phone') && normalizedEvent.includes('quality')) {
    return 'phone_number_quality_update';
  }
  if (normalizedEvent.includes('account')) {
    return 'account_update';
  }
  if (
    normalizedEvent.includes('message')
    || normalizedEvent.includes('status')
    || normalizedEvent.includes('delivery')
    || normalizedEvent.includes('read')
  ) {
    return 'messages';
  }

  return null;
}

function inferFieldFromValue(value) {
  if (!isObject(value)) {
    return null;
  }

  if (Array.isArray(value.messages) || Array.isArray(value.statuses) || isObject(value.metadata)) {
    return 'messages';
  }
  if (value.event || value.message_template_id || value.message_template_name || value.new_quality_score || value.previous_quality_score) {
    return 'message_template_status_update';
  }
  if (value.current_quality_score || value.new_quality_score || value.previous_quality_score) {
    return 'message_template_quality_update';
  }
  if (value.display_phone_number || value.quality_rating || value.messaging_limit_tier) {
    return 'phone_number_quality_update';
  }
  if (value.account_review_status || value.account_update_type || value.event_type === 'account_update') {
    return 'account_update';
  }

  return null;
}

function normalizeLegacyStatusValue(candidate, eventName) {
  if (!isObject(candidate) || !Array.isArray(candidate.messages) || candidate.messages.length === 0) {
    return candidate;
  }

  const normalizedEvent = String(eventName || '').trim().toLowerCase();
  const looksLikeLegacyStatusEvent =
    normalizedEvent.includes('message.sent')
    || normalizedEvent.includes('message.status')
    || normalizedEvent.includes('message.delivered')
    || normalizedEvent.includes('message.read')
    || normalizedEvent.includes('message.failed');

  if (!looksLikeLegacyStatusEvent) {
    return candidate;
  }

  const statuses = candidate.messages
    .map((message) => {
      const mappedStatus = mapLegacyMessageStatus(message?.message_status || candidate.chat?.status);
      if (!mappedStatus || !message?.id) {
        return null;
      }

      return {
        id: message.id,
        status: mappedStatus,
        recipient_id:
          candidate.contacts?.[0]?.wa_id
          || candidate.contacts?.[0]?.input
          || candidate.chat?.contact?.phone
          || null,
        timestamp:
          message.timestamp
          || candidate.chat?.updated_at
          || candidate.chat?.created_at
          || null,
      };
    })
    .filter(Boolean);

  if (!statuses.length) {
    return candidate;
  }

  return {
    ...candidate,
    statuses,
    messages: undefined,
  };
}

function buildLegacyCandidates(body) {
  return [
    body.data,
    body.data?.data,
    body.data?.data?.data,
    body.data?.value,
    body.change,
    body.payload,
    body,
  ];
}

function normalizeChangeCandidate(candidate, eventName) {
  if (!isObject(candidate)) {
    return null;
  }

  const normalizedCandidate = normalizeLegacyStatusValue(candidate, eventName);

  if (
    isObject(normalizedCandidate.data)
    && !normalizedCandidate.field
    && !normalizedCandidate.value
    && !Array.isArray(normalizedCandidate.changes)
    && !Array.isArray(normalizedCandidate.messages)
    && !Array.isArray(normalizedCandidate.statuses)
    && !isObject(normalizedCandidate.metadata)
  ) {
    const nestedChange = normalizeChangeCandidate(normalizedCandidate.data, eventName);
    if (nestedChange) {
      return nestedChange;
    }
  }

  if (Array.isArray(normalizedCandidate.changes) && normalizedCandidate.changes.length > 0) {
    const [firstChange] = normalizedCandidate.changes;
    if (isObject(firstChange) && firstChange.field && firstChange.value) {
      return {
        field: firstChange.field,
        value: firstChange.value,
        context: normalizedCandidate,
      };
    }
  }

  if (normalizedCandidate.field && normalizedCandidate.value) {
    return {
      field: normalizedCandidate.field,
      value: normalizedCandidate.value,
      context: normalizedCandidate,
    };
  }

  const inferredField = inferFieldFromValue(normalizedCandidate) || inferFieldFromEventName(eventName);
  if (!inferredField) {
    return null;
  }

  if (normalizedCandidate.value) {
    return {
      field: inferredField,
      value: normalizedCandidate.value,
      context: normalizedCandidate,
    };
  }

  return {
    field: inferredField,
    value: normalizedCandidate,
    context: normalizedCandidate,
  };
}

function resolveLegacyWabaId(body, candidate) {
  const sources = [
    candidate?.context,
    body?.data,
    body,
    candidate?.value,
  ];

  for (const source of sources) {
    if (!isObject(source)) {
      continue;
    }

    if (source.waba_id) {
      return String(source.waba_id);
    }
    if (source.wabaId) {
      return String(source.wabaId);
    }
    if (source.entry_id) {
      return String(source.entry_id);
    }
    if (source.entryId) {
      return String(source.entryId);
    }
  }

  return 'legacy-forwarded';
}

function normalizeWebhookEnvelope(body) {
  if (isMetaWebhookEnvelope(body)) {
    return {
      format: 'meta',
      eventName: null,
      envelope: body,
    };
  }

  if (!isObject(body)) {
    return null;
  }

  const eventName = body.event || body.event_name || null;
  const candidates = buildLegacyCandidates(body);

  for (const candidate of candidates) {
    const normalizedChange = normalizeChangeCandidate(candidate, eventName);
    if (!normalizedChange) {
      continue;
    }

    if (!SUPPORTED_WEBHOOK_FIELDS.has(normalizedChange.field)) {
      continue;
    }

    return {
      format: 'legacy_forwarded',
      eventName,
      envelope: {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: resolveLegacyWabaId(body, normalizedChange),
            changes: [
              {
                field: normalizedChange.field,
                value: normalizedChange.value,
              },
            ],
          },
        ],
      },
    };
  }

  return null;
}

module.exports = {
  SUPPORTED_WEBHOOK_FIELDS,
  isMetaWebhookEnvelope,
  normalizeWebhookEnvelope,
};
