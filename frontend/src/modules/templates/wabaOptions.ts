import type { WaAccount } from '@/core/types';
import type { TemplateSelectOption } from './TemplateOptionSelect';

export interface TemplateWabaOption extends TemplateSelectOption {
  value: string;
  waba_id: string;
  wa_account_id: string;
  accounts: WaAccount[];
}

function byMostRecentAccount(a: WaAccount, b: WaAccount) {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

export function buildTemplateWabaOptions(accounts: WaAccount[] | undefined): TemplateWabaOption[] {
  const groups = new Map<string, WaAccount[]>();

  for (const account of accounts || []) {
    if (account.status !== 'active') {
      continue;
    }

    const existing = groups.get(account.waba_id);
    if (existing) {
      existing.push(account);
    } else {
      groups.set(account.waba_id, [account]);
    }
  }

  return Array.from(groups.entries())
    .map(([wabaId, group]) => {
      const sortedAccounts = [...group].sort(byMostRecentAccount);
      const primaryAccount = sortedAccounts[0];
      const verifiedNames = Array.from(
        new Set(
          sortedAccounts
            .map((account) => account.verified_name?.trim())
            .filter((value): value is string => Boolean(value))
        )
      );

      return {
        value: wabaId,
        label: wabaId,
        description: [
          verifiedNames.length > 0 ? verifiedNames.join(', ') : null,
          `${sortedAccounts.length} connected ${sortedAccounts.length === 1 ? 'number' : 'numbers'}`,
        ]
          .filter(Boolean)
          .join(' / '),
        waba_id: wabaId,
        wa_account_id: primaryAccount.id,
        accounts: sortedAccounts,
      };
    })
    .sort((a, b) => a.waba_id.localeCompare(b.waba_id));
}

export function findTemplateWabaOption(
  options: TemplateWabaOption[],
  identifiers: {
    wabaId?: string | null;
    waAccountId?: string | null;
  }
) {
  if (identifiers.wabaId) {
    const byWaba = options.find((option) => option.waba_id === identifiers.wabaId);
    if (byWaba) {
      return byWaba;
    }
  }

  if (identifiers.waAccountId) {
    return (
      options.find((option) =>
        option.accounts.some((account) => account.id === identifiers.waAccountId)
      ) || null
    );
  }

  return null;
}
