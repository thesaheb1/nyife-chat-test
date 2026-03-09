import type { WaAccount } from '@/core/types';

export interface WhatsAppAccountOption {
  value: string;
  label: string;
  description?: string;
  waba_id: string;
  account: WaAccount;
}

export function getActiveWhatsAppAccounts(accounts: WaAccount[] | undefined) {
  return (accounts || []).filter((account) => account.status === 'active');
}

export function getWhatsAppAccountLabel(account: WaAccount | null | undefined) {
  if (!account) {
    return 'Disconnected account';
  }

  return account.verified_name || account.display_phone || account.waba_id;
}

export function getWhatsAppAccountDescription(account: WaAccount | null | undefined) {
  if (!account) {
    return '';
  }

  return [account.display_phone || null, account.verified_name ? account.waba_id : null]
    .filter(Boolean)
    .join(' / ');
}

export function buildActiveWhatsAppAccountOptions(accounts: WaAccount[] | undefined): WhatsAppAccountOption[] {
  return getActiveWhatsAppAccounts(accounts).map((account) => ({
    value: account.id,
    label: getWhatsAppAccountLabel(account),
    description: getWhatsAppAccountDescription(account),
    waba_id: account.waba_id,
    account,
  }));
}

export function findWhatsAppAccount(accounts: WaAccount[] | undefined, accountId: string | null | undefined) {
  if (!accountId) {
    return null;
  }

  return (accounts || []).find((account) => account.id === accountId) || null;
}
