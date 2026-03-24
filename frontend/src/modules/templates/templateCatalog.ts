import type { Template, WaAccount } from '@/core/types';

export type TemplateActionKey = 'view' | 'edit' | 'publish' | 'sync' | 'delete';
export type TemplateQualityScore = NonNullable<Template['quality_score']>;
const EDITABLE_META_STATUSES = new Set(['APPROVED', 'REJECTED', 'PAUSED']);

export const TEMPLATE_CATEGORY_OPTIONS = [
  { label: 'Marketing', value: 'MARKETING' },
  { label: 'Utility', value: 'UTILITY' },
  { label: 'Authentication', value: 'AUTHENTICATION' },
] as const;

export const TEMPLATE_TYPE_OPTIONS = [
  {
    label: 'Standard',
    value: 'standard',
    description: 'Body, optional header/footer, and standard CTA or quick-reply buttons.',
  },
  {
    label: 'Authentication',
    value: 'authentication',
    description: 'OTP verification templates with strict Meta authentication rules.',
  },
  {
    label: 'Carousel',
    value: 'carousel',
    description: 'Multi-card templates for products, offers, or guided browsing flows.',
  },
  {
    label: 'Flow',
    value: 'flow',
    description: 'Launch a WhatsApp Flow directly from a single call-to-action button.',
  },
  {
    label: 'List Menu',
    value: 'list_menu',
    description: 'Commerce entry points for catalog or multi-product message menus.',
  },
] as const;

export const TEMPLATE_STATUS_LABELS: Record<Template['status'], string> = {
  draft: 'Draft',
  pending: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  paused: 'Paused',
  disabled: 'Disabled',
};

export const TEMPLATE_STATUS_CLASSES: Record<Template['status'], string> = {
  draft: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
  pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200',
  paused: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-200',
  disabled: 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200',
};

export const TEMPLATE_ACTION_LABELS: Record<TemplateActionKey, string> = {
  view: 'Preview template',
  edit: 'Edit template',
  publish: 'Submit to Meta',
  sync: 'Sync from Meta',
  delete: 'Delete template',
};

export const TEMPLATE_META_STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Meta approved',
  PENDING: 'Meta in review',
  PENDING_DELETION: 'Pending deletion',
  REJECTED: 'Meta rejected',
  PAUSED: 'Meta paused',
  DISABLED: 'Meta disabled',
  APPEAL_REQUESTED: 'Appeal requested',
};

export const TEMPLATE_META_STATUS_CLASSES: Record<string, string> = {
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  PENDING_DELETION: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-200',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200',
  PAUSED: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-200',
  DISABLED: 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200',
  APPEAL_REQUESTED: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-200',
};

export const TEMPLATE_QUALITY_LABELS: Record<TemplateQualityScore, string> = {
  GREEN: 'High quality',
  YELLOW: 'Medium quality',
  RED: 'Low quality',
  UNKNOWN: 'Quality pending',
};

export const TEMPLATE_QUALITY_CLASSES: Record<TemplateQualityScore, string> = {
  GREEN: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
  YELLOW: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  RED: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200',
  UNKNOWN: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
};

export const TEMPLATE_TYPE_LABELS: Record<Template['type'], string> = {
  standard: 'Standard',
  authentication: 'Authentication',
  carousel: 'Carousel',
  flow: 'Flow',
  list_menu: 'List Menu',
};

export const META_TEMPLATE_LANGUAGES = [
  { label: 'Afrikaans', value: 'af' },
  { label: 'Albanian', value: 'sq' },
  { label: 'Arabic', value: 'ar' },
  { label: 'Arabic (EGY)', value: 'ar_EG' },
  { label: 'Arabic (UAE)', value: 'ar_AE' },
  { label: 'Arabic (LBN)', value: 'ar_LB' },
  { label: 'Arabic (MAR)', value: 'ar_MA' },
  { label: 'Arabic (QAT)', value: 'ar_QA' },
  { label: 'Azerbaijani', value: 'az' },
  { label: 'Belarusian', value: 'be_BY' },
  { label: 'Bengali', value: 'bn' },
  { label: 'Bengali (IND)', value: 'bn_IN' },
  { label: 'Bulgarian', value: 'bg' },
  { label: 'Catalan', value: 'ca' },
  { label: 'Chinese (CHN)', value: 'zh_CN' },
  { label: 'Chinese (HKG)', value: 'zh_HK' },
  { label: 'Chinese (TAI)', value: 'zh_TW' },
  { label: 'Croatian', value: 'hr' },
  { label: 'Czech', value: 'cs' },
  { label: 'Danish', value: 'da' },
  { label: 'Dutch', value: 'nl' },
  { label: 'Dutch (BEL)', value: 'nl_BE' },
  { label: 'English', value: 'en' },
  { label: 'English (UK)', value: 'en_GB' },
  { label: 'English (US)', value: 'en_US' },
  { label: 'English (UAE)', value: 'en_AE' },
  { label: 'English (AUS)', value: 'en_AU' },
  { label: 'English (CAN)', value: 'en_CA' },
  { label: 'English (GHA)', value: 'en_GH' },
  { label: 'English (IRL)', value: 'en_IE' },
  { label: 'English (IND)', value: 'en_IN' },
  { label: 'English (JAM)', value: 'en_JM' },
  { label: 'English (MYS)', value: 'en_MY' },
  { label: 'English (NZL)', value: 'en_NZ' },
  { label: 'English (QAT)', value: 'en_QA' },
  { label: 'English (SGP)', value: 'en_SG' },
  { label: 'English (UGA)', value: 'en_UG' },
  { label: 'English (ZAF)', value: 'en_ZA' },
  { label: 'Estonian', value: 'et' },
  { label: 'Finnish', value: 'fi' },
  { label: 'French', value: 'fr' },
  { label: 'French (BEL)', value: 'fr_BE' },
  { label: 'French (CAN)', value: 'fr_CA' },
  { label: 'French (CHE)', value: 'fr_CH' },
  { label: 'French (CIV)', value: 'fr_CI' },
  { label: 'French (MAR)', value: 'fr_MA' },
  { label: 'Georgian', value: 'ka' },
  { label: 'German', value: 'de' },
  { label: 'German (AUT)', value: 'de_AT' },
  { label: 'German (CHE)', value: 'de_CH' },
  { label: 'Greek', value: 'el' },
  { label: 'Gujarati', value: 'gu' },
  { label: 'Hausa', value: 'ha' },
  { label: 'Hebrew', value: 'he' },
  { label: 'Hindi', value: 'hi' },
  { label: 'Hungarian', value: 'hu' },
  { label: 'Indonesian', value: 'id' },
  { label: 'Irish', value: 'ga' },
  { label: 'Italian', value: 'it' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Kannada', value: 'kn' },
  { label: 'Kazakh', value: 'kk' },
  { label: 'Kinyarwanda', value: 'rw_RW' },
  { label: 'Korean', value: 'ko' },
  { label: 'Kyrgyz (Kyrgyzstan)', value: 'ky_KG' },
  { label: 'Lao', value: 'lo' },
  { label: 'Latvian', value: 'lv' },
  { label: 'Lithuanian', value: 'lt' },
  { label: 'Macedonian', value: 'mk' },
  { label: 'Malay', value: 'ms' },
  { label: 'Malayalam', value: 'ml' },
  { label: 'Marathi', value: 'mr' },
  { label: 'Norwegian', value: 'nb' },
  { label: 'Pashto', value: 'ps_AF' },
  { label: 'Persian', value: 'fa' },
  { label: 'Polish', value: 'pl' },
  { label: 'Portuguese (BR)', value: 'pt_BR' },
  { label: 'Portuguese (POR)', value: 'pt_PT' },
  { label: 'Punjabi', value: 'pa' },
  { label: 'Romanian', value: 'ro' },
  { label: 'Russian', value: 'ru' },
  { label: 'Serbian', value: 'sr' },
  { label: 'Sinhala', value: 'si_LK' },
  { label: 'Slovak', value: 'sk' },
  { label: 'Slovenian', value: 'sl' },
  { label: 'Spanish', value: 'es' },
  { label: 'Spanish (ARG)', value: 'es_AR' },
  { label: 'Spanish (CHL)', value: 'es_CL' },
  { label: 'Spanish (COL)', value: 'es_CO' },
  { label: 'Spanish (CRI)', value: 'es_CR' },
  { label: 'Spanish (DOM)', value: 'es_DO' },
  { label: 'Spanish (ECU)', value: 'es_EC' },
  { label: 'Spanish (HND)', value: 'es_HN' },
  { label: 'Spanish (MEX)', value: 'es_MX' },
  { label: 'Spanish (PAN)', value: 'es_PA' },
  { label: 'Spanish (PER)', value: 'es_PE' },
  { label: 'Spanish (SPA)', value: 'es_ES' },
  { label: 'Spanish (URY)', value: 'es_UY' },
  { label: 'Swahili', value: 'sw' },
  { label: 'Swedish', value: 'sv' },
  { label: 'Tamil', value: 'ta' },
  { label: 'Telugu', value: 'te' },
  { label: 'Thai', value: 'th' },
  { label: 'Turkish', value: 'tr' },
  { label: 'Ukrainian', value: 'uk' },
  { label: 'Urdu', value: 'ur' },
  { label: 'Uzbek', value: 'uz' },
  { label: 'Vietnamese', value: 'vi' },
  { label: 'Zulu', value: 'zu' },
] as const;

export function resolveTemplateMetaStatus(
  template: Pick<Template, 'status' | 'meta_status_raw' | 'meta_template_id'> | null | undefined
) {
  const normalizedMetaStatus = template?.meta_status_raw?.trim().toUpperCase();
  if (normalizedMetaStatus) {
    return normalizedMetaStatus;
  }

  if (!template?.meta_template_id) {
    return null;
  }

  const compatibilityMap: Partial<Record<Template['status'], string>> = {
    pending: 'PENDING',
    approved: 'APPROVED',
    rejected: 'REJECTED',
    paused: 'PAUSED',
    disabled: 'DISABLED',
  };

  return compatibilityMap[template.status] || null;
}

export function canPublishTemplate(
  template: Pick<Template, 'status' | 'meta_template_id'> | null | undefined
) {
  return Boolean(template && !template.meta_template_id && ['draft', 'rejected'].includes(template.status));
}

export function canEditTemplate(
  template: Pick<Template, 'status' | 'meta_status_raw' | 'meta_template_id'> | null | undefined
) {
  if (canPublishTemplate(template)) {
    return true;
  }

  const effectiveMetaStatus = resolveTemplateMetaStatus(template);
  return effectiveMetaStatus ? EDITABLE_META_STATUSES.has(effectiveMetaStatus) : false;
}

export function canDeleteTemplate(
  template: Pick<Template, 'status' | 'meta_status_raw' | 'meta_template_id'> | null | undefined
) {
  return resolveTemplateMetaStatus(template) !== 'DISABLED';
}

export function canSyncTemplate(
  template: Pick<Template, 'wa_account_id' | 'waba_id'> | null | undefined
) {
  return Boolean(template?.wa_account_id || template?.waba_id);
}

export function getTemplateAvailableActions(template: Template): TemplateActionKey[] {
  const declared = template.available_actions?.filter(
    (action): action is TemplateActionKey => ['view', 'edit', 'publish', 'sync', 'delete'].includes(action)
  );

  const actions = new Set<TemplateActionKey>(declared?.length ? declared : ['view']);
  actions.add('view');

  if (canEditTemplate(template)) {
    actions.add('edit');
  }

  if (canPublishTemplate(template)) {
    actions.add('publish');
  }

  if (canSyncTemplate(template)) {
    actions.add('sync');
  }

  if (canDeleteTemplate(template)) {
    actions.add('delete');
  }

  return Array.from(actions);
}

export function getTemplateMetaStatusLabel(status: string | null) {
  if (!status) {
    return null;
  }

  return TEMPLATE_META_STATUS_LABELS[status] || status.replace(/_/g, ' ').toLowerCase();
}

export function buildTemplateWabaOptions(accounts: WaAccount[] | undefined) {
  return Array.from(
    new Map(
      (accounts || []).map((account) => [
        account.waba_id,
        {
          value: account.waba_id,
          label: account.waba_id,
          description: account.verified_name || undefined,
        },
      ])
    ).values()
  );
}

export function getTemplateLanguageLabel(code: string) {
  return META_TEMPLATE_LANGUAGES.find((language) => language.value === code)?.label || code;
}
