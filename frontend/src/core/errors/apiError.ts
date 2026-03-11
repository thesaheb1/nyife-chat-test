import type { ApiError } from '@/core/types';

const ERROR_CODE_MESSAGES: Record<string, string> = {
  SUBSCRIPTION_REQUIRED: 'An active subscription is required to continue.',
  WALLET_INSUFFICIENT: 'Recharge your wallet before sending this message.',
  MESSAGE_LIMIT_REACHED: 'You have reached your monthly message limit.',
  WHATSAPP_ACCOUNT_INACTIVE: 'This WhatsApp account is inactive. Reconnect it or choose another account.',
  API_TOKEN_INVALID: 'The API token is invalid, expired, or revoked.',
  FLOW_SEND_ROUTE_REQUIRED: 'Use the dedicated flow send option for WhatsApp Flow messages.',
  INVALID_MESSAGE_TYPE: 'Use the correct endpoint for this type of WhatsApp message.',
};

function getRawMessage(error: unknown) {
  return (
    (error as { response?: { data?: ApiError } })?.response?.data?.message
    || (error as Error | undefined)?.message
    || null
  );
}

function getErrorCode(error: unknown) {
  return (error as { response?: { data?: ApiError } })?.response?.data?.code || null;
}

function matchKnownMessage(message: string | null) {
  if (!message) {
    return null;
  }

  if (message.includes('No active subscription') || message.includes('active subscription is required')) {
    return ERROR_CODE_MESSAGES.SUBSCRIPTION_REQUIRED;
  }

  if (message.includes('Monthly message limit')) {
    return ERROR_CODE_MESSAGES.MESSAGE_LIMIT_REACHED;
  }

  if (message.includes('wallet balance') || message.includes('charge your wallet')) {
    return ERROR_CODE_MESSAGES.WALLET_INSUFFICIENT;
  }

  if (message.includes('WhatsApp account is inactive') || message.includes('cannot send new messages')) {
    return ERROR_CODE_MESSAGES.WHATSAPP_ACCOUNT_INACTIVE;
  }

  if (message.includes('Invalid API token')) {
    return ERROR_CODE_MESSAGES.API_TOKEN_INVALID;
  }

  return null;
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong.') {
  const code = getErrorCode(error);
  if (code && ERROR_CODE_MESSAGES[code]) {
    return ERROR_CODE_MESSAGES[code];
  }

  const rawMessage = getRawMessage(error);
  return matchKnownMessage(rawMessage) || rawMessage || fallback;
}
