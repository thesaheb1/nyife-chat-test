
import type { Template } from '@/core/types';
import {
  buildBodyTextExample,
  buildHeaderTextExample,
  buildUrlButtonExample,
  readBodyTextExamples,
  readButtonExampleValues,
  readHeaderTextExamples,
} from './templateExamples';
import type { CreateTemplateFormData } from './validations';

export type HeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
export type StandardButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
export type FlowActionType = 'navigate' | 'data_exchange';
export type ListMenuButtonType = 'CATALOG' | 'MPM';

export interface TemplateMediaAsset {
  file_id: string;
  original_name: string;
  mime_type: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'document' | 'other';
  preview_url?: string;
  width?: number;
  height?: number;
  aspect_ratio?: string;
  header_handle?: string | null;
}

export interface StandardButtonDraft {
  type: StandardButtonType;
  text: string;
  url: string;
  phone_number: string;
  example: string[];
}

export interface AuthenticationSupportedAppDraft {
  packageName: string;
  signatureHash: string;
}

export interface CarouselCardDraft {
  headerFormat: HeaderFormat;
  headerMedia: TemplateMediaAsset | null;
  bodyText: string;
  bodyTextExamples: string[];
  buttons: StandardButtonDraft[];
}

export interface TemplateDraft {
  name: string;
  display_name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  type: 'standard' | 'authentication' | 'carousel' | 'flow' | 'list_menu';
  wa_account_id: string;
  waba_id: string;
  standard: {
    headerFormat: HeaderFormat;
    headerText: string;
    headerTextExamples: string[];
    headerMedia: TemplateMediaAsset | null;
    bodyText: string;
    bodyTextExamples: string[];
    footerText: string;
    buttons: StandardButtonDraft[];
  };
  authentication: {
    addSecurityRecommendation: boolean;
    codeExpirationMinutes: number | '';
    otpType: 'COPY_CODE' | 'ONE_TAP' | 'ZERO_TAP';
    buttonText: string;
    autofillText: string;
    packageName: string;
    signatureHash: string;
    supportedApps: AuthenticationSupportedAppDraft[];
  };
  carousel: {
    bodyText: string;
    bodyTextExamples: string[];
    cards: CarouselCardDraft[];
  };
  flow: {
    bodyText: string;
    bodyTextExamples: string[];
    buttonText: string;
    flow_id: string;
    flow_name: string;
    flow_action: FlowActionType;
    navigate_screen: string;
    flow_json: string;
  };
  listMenu: {
    headerFormat: HeaderFormat;
    headerText: string;
    headerTextExamples: string[];
    headerMedia: TemplateMediaAsset | null;
    bodyText: string;
    bodyTextExamples: string[];
    footerText: string;
    buttonType: ListMenuButtonType;
    buttonText: string;
    example: string;
  };
}

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  example?: {
    header_handle?: string[];
    body_text?: string[][];
    header_text?: string[];
  };
  media_asset?: TemplateMediaAsset | null;
  buttons?: Array<Record<string, unknown>>;
  cards?: Array<{ components?: TemplateComponent[] }>;
  add_security_recommendation?: boolean;
  code_expiration_minutes?: number;
}

const DEFAULT_STANDARD_BUTTON = (): StandardButtonDraft => ({
  type: 'QUICK_REPLY',
  text: '',
  url: '',
  phone_number: '',
  example: [],
});

const DEFAULT_CAROUSEL_CARD = (): CarouselCardDraft => ({
  headerFormat: 'IMAGE',
  headerMedia: null,
  bodyText: '',
  bodyTextExamples: [],
  buttons: [
    {
      type: 'URL',
      text: '',
      url: '',
      phone_number: '',
      example: [],
    },
  ],
});

const DEFAULT_AUTH_SUPPORTED_APP = (): AuthenticationSupportedAppDraft => ({
  packageName: '',
  signatureHash: '',
});

export function createEmptyTemplateDraft(): TemplateDraft {
  return {
    name: '',
    display_name: '',
    language: 'en_US',
    category: 'MARKETING',
    type: 'standard',
    wa_account_id: '',
    waba_id: '',
    standard: {
      headerFormat: 'NONE',
      headerText: '',
      headerTextExamples: [],
      headerMedia: null,
      bodyText: '',
      bodyTextExamples: [],
      footerText: '',
      buttons: [DEFAULT_STANDARD_BUTTON()],
    },
    authentication: {
      addSecurityRecommendation: true,
      codeExpirationMinutes: 10,
      otpType: 'COPY_CODE',
      buttonText: 'Copy code',
      autofillText: '',
      packageName: '',
      signatureHash: '',
      supportedApps: [DEFAULT_AUTH_SUPPORTED_APP()],
    },
    carousel: {
      bodyText: '',
      bodyTextExamples: [],
      cards: [DEFAULT_CAROUSEL_CARD(), DEFAULT_CAROUSEL_CARD()],
    },
    flow: {
      bodyText: '',
      bodyTextExamples: [],
      buttonText: 'Open flow',
      flow_id: '',
      flow_name: '',
      flow_action: 'navigate',
      navigate_screen: '',
      flow_json: '',
    },
    listMenu: {
      headerFormat: 'NONE',
      headerText: '',
      headerTextExamples: [],
      headerMedia: null,
      bodyText: '',
      bodyTextExamples: [],
      footerText: '',
      buttonType: 'CATALOG',
      buttonText: 'View catalog',
      example: '',
    },
  };
}

function trim(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getComponents(template: Pick<Template, 'components'> | null | undefined) {
  return Array.isArray(template?.components) ? (template.components as TemplateComponent[]) : [];
}

function getComponent(components: TemplateComponent[], type: string) {
  return components.find((component) => String(component.type).toUpperCase() === type) || null;
}

export function buildTemplateMediaPreviewUrl(fileId: string) {
  return fileId ? `/api/v1/media/${encodeURIComponent(fileId)}/download` : undefined;
}

function isRemoteTemplateMediaUrl(value: unknown) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function inferTemplateMediaType(format: unknown): TemplateMediaAsset['type'] {
  switch (String(format || '').toUpperCase()) {
    case 'IMAGE':
      return 'image';
    case 'VIDEO':
      return 'video';
    case 'DOCUMENT':
      return 'document';
    default:
      return 'other';
  }
}

function deriveRemoteMediaName(format: unknown, url: string) {
  try {
    const pathname = new URL(url).pathname;
    const fileName = decodeURIComponent(pathname.split('/').pop() || '');
    if (fileName) {
      return fileName;
    }
  } catch {
    // Ignore URL parsing errors and fall back to a descriptive label.
  }

  return `${String(format || 'media').toLowerCase()} sample`;
}

export function resolveTemplateMediaSourceUrl(
  asset: Pick<TemplateMediaAsset, 'file_id' | 'preview_url' | 'header_handle'> | null | undefined
) {
  if (!asset) {
    return undefined;
  }

  if (asset.preview_url && !asset.preview_url.startsWith('blob:')) {
    return asset.preview_url;
  }

  if (asset.file_id) {
    return buildTemplateMediaPreviewUrl(asset.file_id);
  }

  if (isRemoteTemplateMediaUrl(asset.header_handle)) {
    return asset.header_handle?.trim();
  }

  return undefined;
}

function resolvePersistedPreviewUrl(asset: Pick<TemplateMediaAsset, 'file_id' | 'preview_url' | 'header_handle'>) {
  return resolveTemplateMediaSourceUrl(asset);
}

function isQuickReplyButton(button: Pick<StandardButtonDraft, 'type'>) {
  return button.type === 'QUICK_REPLY';
}

function normalizeStandardButtonsForMeta<T extends Pick<StandardButtonDraft, 'type'>>(buttons: T[]) {
  if (!Array.isArray(buttons) || buttons.length < 2) {
    return buttons;
  }

  const quickReplies = buttons.filter((button) => isQuickReplyButton(button));
  const otherButtons = buttons.filter((button) => !isQuickReplyButton(button));

  if (!quickReplies.length || !otherButtons.length) {
    return buttons;
  }

  return isQuickReplyButton(buttons[0])
    ? [...quickReplies, ...otherButtons]
    : [...otherButtons, ...quickReplies];
}

function buildStandardButtonsPayload(buttons: StandardButtonDraft[]) {
  return normalizeStandardButtonsForMeta(buttons)
    .filter((button) => trim(button.text) || trim(button.url) || trim(button.phone_number))
    .map((button) => ({
      type: button.type,
      text: trim(button.text),
      ...(button.type === 'URL' ? { url: trim(button.url) } : {}),
      ...(button.type === 'URL' && buildUrlButtonExample(button.url, button.example)
        ? { example: buildUrlButtonExample(button.url, button.example) }
        : {}),
      ...(button.type === 'PHONE_NUMBER' ? { phone_number: trim(button.phone_number) } : {}),
    }));
}

function hydrateStandardButtons(rawButtons: Array<Record<string, unknown>> | undefined): StandardButtonDraft[] {
  const buttons = normalizeStandardButtonsForMeta(
    (rawButtons || [])
      .map((button) => ({
        type: (button.type as StandardButtonType) || 'QUICK_REPLY',
        text: trim(button.text),
        url: trim(button.url),
        phone_number: trim(button.phone_number),
        example: readButtonExampleValues(button),
      }))
      .filter((button) => ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'].includes(button.type))
  );

  return buttons.length ? buttons : [DEFAULT_STANDARD_BUTTON()];
}

function normalizeHeaderMedia(component: TemplateComponent | null): TemplateMediaAsset | null {
  if (!component) {
    return null;
  }

  const headerHandle = Array.isArray(component.example?.header_handle)
    ? component.example.header_handle[0] || null
    : null;
  const mediaAsset = component.media_asset;

  if (mediaAsset && typeof mediaAsset === 'object') {
    const resolvedHeaderHandle = mediaAsset.header_handle || headerHandle;
    const previewUrl = resolvePersistedPreviewUrl({
      file_id: mediaAsset.file_id,
      preview_url: mediaAsset.preview_url,
      header_handle: resolvedHeaderHandle,
    });

    return {
      ...mediaAsset,
      preview_url: previewUrl,
      original_name:
        trim(mediaAsset.original_name)
        || (previewUrl && isRemoteTemplateMediaUrl(previewUrl) ? deriveRemoteMediaName(component.format, previewUrl) : ''),
      type:
        mediaAsset.type && mediaAsset.type !== 'other'
          ? mediaAsset.type
          : inferTemplateMediaType(component.format),
      header_handle: resolvedHeaderHandle,
    };
  }

  if (!headerHandle) {
    return null;
  }

  const previewUrl = resolveTemplateMediaSourceUrl({
    file_id: '',
    preview_url: undefined,
    header_handle: headerHandle,
  });

  return {
    file_id: '',
    original_name:
      previewUrl && isRemoteTemplateMediaUrl(previewUrl)
        ? deriveRemoteMediaName(component.format, previewUrl)
        : '',
    mime_type: '',
    size: 0,
    type: inferTemplateMediaType(component.format),
    ...(previewUrl ? { preview_url: previewUrl } : {}),
    header_handle: headerHandle,
  };
}

function hydrateHeader(component: TemplateComponent | null) {
  if (!component) {
    return {
      headerFormat: 'NONE' as HeaderFormat,
      headerText: '',
      headerTextExamples: [],
      headerMedia: null,
    };
  }

  const format = (component.format as HeaderFormat | undefined) || 'TEXT';
  return {
    headerFormat: format,
    headerText: trim(component.text),
    headerTextExamples: readHeaderTextExamples(component),
    headerMedia: normalizeHeaderMedia(component),
  };
}

function buildHeaderComponent(
  headerFormat: HeaderFormat,
  headerText: string,
  headerTextExamples: string[],
  headerMedia: TemplateMediaAsset | null
) {
  if (headerFormat === 'NONE') {
    return null;
  }

  const component: Record<string, unknown> = {
    type: 'HEADER',
    format: headerFormat,
  };

  if (headerFormat === 'TEXT' && trim(headerText)) {
    component.text = trim(headerText);
    const headerExample = buildHeaderTextExample(headerText, headerTextExamples);
    if (headerExample) {
      component.example = {
        header_text: headerExample,
      };
    }
  }

  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && headerMedia) {
    component.media_asset = {
      file_id: headerMedia.file_id,
      original_name: headerMedia.original_name,
      mime_type: headerMedia.mime_type,
      size: headerMedia.size,
      type: headerMedia.type,
      ...(resolvePersistedPreviewUrl(headerMedia) ? { preview_url: resolvePersistedPreviewUrl(headerMedia) } : {}),
      ...(headerMedia.width ? { width: headerMedia.width } : {}),
      ...(headerMedia.height ? { height: headerMedia.height } : {}),
      ...(headerMedia.aspect_ratio ? { aspect_ratio: headerMedia.aspect_ratio } : {}),
      ...(headerMedia.header_handle ? { header_handle: headerMedia.header_handle } : {}),
    };

    if (headerMedia.header_handle) {
      component.example = {
        header_handle: [headerMedia.header_handle],
      };
    }
  }

  return component;
}

function buildBodyExamplePayload(text: string, values: string[]) {
  const bodyExample = buildBodyTextExample(text, values);
  return bodyExample
    ? { body_text: bodyExample }
    : undefined;
}

export function hydrateTemplateDraft(template: Template | null | undefined): TemplateDraft {
  const draft = createEmptyTemplateDraft();

  if (!template) {
    return draft;
  }

  const components = getComponents(template);
  const header = getComponent(components, 'HEADER');
  const body = getComponent(components, 'BODY') || getComponent(components, 'body');
  const footer = getComponent(components, 'FOOTER');
  const buttonsComponent = getComponent(components, 'BUTTONS');
  const carousel = getComponent(components, 'CAROUSEL');
  const { headerFormat, headerText, headerTextExamples, headerMedia } = hydrateHeader(header);

  draft.name = template.name || '';
  draft.display_name = template.display_name || '';
  draft.language = template.language || 'en_US';
  draft.category = template.category;
  draft.type = template.type;
  draft.wa_account_id = template.wa_account_id || '';
  draft.waba_id = template.waba_id || '';

  draft.standard = {
    headerFormat,
    headerText,
    headerTextExamples,
    headerMedia,
    bodyText: trim(body?.text),
    bodyTextExamples: readBodyTextExamples(body),
    footerText: trim(footer?.text),
    buttons: hydrateStandardButtons(buttonsComponent?.buttons as Array<Record<string, unknown>> | undefined),
  };

  const authButton = Array.isArray(buttonsComponent?.buttons)
    ? (buttonsComponent.buttons[0] as Record<string, unknown> | undefined)
    : undefined;
  const supportedAuthApps = Array.isArray(authButton?.supported_apps)
    ? authButton.supported_apps
      .map((app) => ({
        packageName: trim((app as Record<string, unknown>)?.package_name),
        signatureHash: trim((app as Record<string, unknown>)?.signature_hash),
      }))
      .filter((app) => app.packageName || app.signatureHash)
    : [];
  const legacySupportedApp = trim(authButton?.package_name) || trim(authButton?.signature_hash)
    ? [{
      packageName: trim(authButton?.package_name),
      signatureHash: trim(authButton?.signature_hash),
    }]
    : [];
  const hydratedSupportedApps = supportedAuthApps.length ? supportedAuthApps : legacySupportedApp;
  const primarySupportedApp = hydratedSupportedApps[0];

  draft.authentication = {
    addSecurityRecommendation: Boolean(body?.add_security_recommendation),
    codeExpirationMinutes:
      typeof footer?.code_expiration_minutes === 'number' ? footer.code_expiration_minutes : 10,
    otpType: (authButton?.otp_type as TemplateDraft['authentication']['otpType']) || 'COPY_CODE',
    buttonText: trim(authButton?.text) || 'Copy code',
    autofillText: trim(authButton?.autofill_text),
    packageName: primarySupportedApp?.packageName || '',
    signatureHash: primarySupportedApp?.signatureHash || '',
    supportedApps: hydratedSupportedApps,
  };

  draft.flow = {
    bodyText: trim(body?.text),
    bodyTextExamples: readBodyTextExamples(body),
    buttonText: trim(authButton?.text) || 'Open flow',
    flow_id: trim(authButton?.flow_id),
    flow_name: trim(authButton?.flow_name),
    flow_action: (authButton?.flow_action as FlowActionType) || 'navigate',
    navigate_screen: trim(authButton?.navigate_screen),
    flow_json: trim(authButton?.flow_json),
  };

  draft.listMenu = {
    headerFormat,
    headerText,
    headerTextExamples,
    headerMedia,
    bodyText: trim(body?.text),
    bodyTextExamples: readBodyTextExamples(body),
    footerText: trim(footer?.text),
    buttonType: (authButton?.type as ListMenuButtonType) || 'CATALOG',
    buttonText: trim(authButton?.text) || 'View catalog',
    example: Array.isArray(authButton?.example)
      ? trim(authButton.example[0])
      : trim(authButton?.example),
  };

  if (carousel?.cards?.length) {
    draft.carousel = {
      bodyText: trim(body?.text),
      bodyTextExamples: readBodyTextExamples(body),
      cards: carousel.cards.map((card) => {
        const cardComponents = Array.isArray(card.components) ? card.components : [];
        const cardHeader = getComponent(cardComponents, 'HEADER');
        const cardBody = getComponent(cardComponents, 'BODY');
        const cardButtons = getComponent(cardComponents, 'BUTTONS');
        const hydratedHeader = hydrateHeader(cardHeader);

        return {
          headerFormat: hydratedHeader.headerFormat,
          headerMedia: hydratedHeader.headerMedia,
          bodyText: trim(cardBody?.text),
          bodyTextExamples: readBodyTextExamples(cardBody),
          buttons: hydrateStandardButtons(cardButtons?.buttons as Array<Record<string, unknown>> | undefined),
        };
      }),
    };
  }

  return draft;
}

export function buildTemplatePayload(draft: TemplateDraft): CreateTemplateFormData {
  const payload: CreateTemplateFormData = {
    name: trim(draft.name),
    display_name: trim(draft.display_name) || undefined,
    language: draft.language,
    category: draft.type === 'authentication' ? 'AUTHENTICATION' : draft.category,
    type: draft.type,
    components: [],
  };

  const resolvedWaAccountId = trim(draft.wa_account_id);
  if (resolvedWaAccountId) {
    payload.wa_account_id = resolvedWaAccountId;
  }

  if (draft.type === 'standard') {
    const header = buildHeaderComponent(
      draft.standard.headerFormat,
      draft.standard.headerText,
      draft.standard.headerTextExamples,
      draft.standard.headerMedia
    );
    if (header) {
      payload.components.push(header as CreateTemplateFormData['components'][number]);
    }

    payload.components.push({
      type: 'BODY',
      text: trim(draft.standard.bodyText),
      example: buildBodyExamplePayload(draft.standard.bodyText, draft.standard.bodyTextExamples),
    });

    if (trim(draft.standard.footerText)) {
      payload.components.push({
        type: 'FOOTER',
        text: trim(draft.standard.footerText),
      });
    }

    const buttons = buildStandardButtonsPayload(draft.standard.buttons);

    if (buttons.length) {
      payload.components.push({
        type: 'BUTTONS',
        buttons,
      });
    }
  }

  if (draft.type === 'authentication') {
    const otpType = draft.authentication.otpType;
    const usesAutofill = otpType !== 'COPY_CODE';
    const supportedApps = usesAutofill
      ? draft.authentication.supportedApps
        .map((app) => ({
          package_name: trim(app.packageName),
          signature_hash: trim(app.signatureHash),
        }))
        .filter((app) => app.package_name || app.signature_hash)
      : [];

    if (!supportedApps.length && usesAutofill && trim(draft.authentication.packageName) && trim(draft.authentication.signatureHash)) {
      supportedApps.push({
        package_name: trim(draft.authentication.packageName),
        signature_hash: trim(draft.authentication.signatureHash),
      });
    }

    payload.category = 'AUTHENTICATION';
    payload.components.push({
      type: 'BODY',
      add_security_recommendation: draft.authentication.addSecurityRecommendation,
    });

    if (draft.authentication.codeExpirationMinutes !== '') {
      payload.components.push({
        type: 'FOOTER',
        code_expiration_minutes: Number(draft.authentication.codeExpirationMinutes),
      });
    }

    payload.components.push({
      type: 'BUTTONS',
      buttons: [
        {
          type: 'OTP',
          otp_type: otpType,
          ...(usesAutofill && supportedApps.length ? { supported_apps: supportedApps } : {}),
        },
      ],
    });
  }

  if (draft.type === 'flow') {
    const resolvedFlowId = trim(draft.flow.flow_id) || undefined;
    const resolvedFlowName = resolvedFlowId ? undefined : trim(draft.flow.flow_name) || undefined;
    const resolvedFlowJson = resolvedFlowId || resolvedFlowName ? undefined : trim(draft.flow.flow_json) || undefined;

    payload.components.push({
      type: 'BODY',
      text: trim(draft.flow.bodyText),
      example: buildBodyExamplePayload(draft.flow.bodyText, draft.flow.bodyTextExamples),
    });

    payload.components.push({
      type: 'BUTTONS',
      buttons: [
        {
          type: 'FLOW',
          text: trim(draft.flow.buttonText),
          flow_id: resolvedFlowId,
          flow_name: resolvedFlowName,
          flow_action: draft.flow.flow_action,
          navigate_screen: trim(draft.flow.navigate_screen) || undefined,
          flow_json: resolvedFlowJson,
        },
      ],
    });
  }

  if (draft.type === 'list_menu') {
    const header = buildHeaderComponent(
      draft.listMenu.headerFormat,
      draft.listMenu.headerText,
      draft.listMenu.headerTextExamples,
      draft.listMenu.headerMedia
    );
    if (header) {
      payload.components.push(header as CreateTemplateFormData['components'][number]);
    }

    payload.components.push({
      type: 'BODY',
      text: trim(draft.listMenu.bodyText),
      example: buildBodyExamplePayload(draft.listMenu.bodyText, draft.listMenu.bodyTextExamples),
    });

    if (trim(draft.listMenu.footerText)) {
      payload.components.push({
        type: 'FOOTER',
        text: trim(draft.listMenu.footerText),
      });
    }

    payload.components.push({
      type: 'BUTTONS',
      buttons: [
        {
          type: draft.listMenu.buttonType,
          text: trim(draft.listMenu.buttonText),
          example: trim(draft.listMenu.example) || undefined,
        },
      ],
    });
  }

  if (draft.type === 'carousel') {
    payload.components.push({
      type: 'BODY',
      text: trim(draft.carousel.bodyText),
      example: buildBodyExamplePayload(draft.carousel.bodyText, draft.carousel.bodyTextExamples),
    });

    payload.components.push({
      type: 'CAROUSEL',
      cards: draft.carousel.cards.map((card) => {
        const cardComponents: CreateTemplateFormData['components'] = [];
        const header = buildHeaderComponent(
          card.headerFormat,
          '',
          [],
          card.headerMedia
        );
        if (header) {
          cardComponents.push(header as CreateTemplateFormData['components'][number]);
        }

        if (trim(card.bodyText)) {
          cardComponents.push({
            type: 'BODY',
            text: trim(card.bodyText),
            example: buildBodyExamplePayload(card.bodyText, card.bodyTextExamples),
          });
        }

        const buttons = buildStandardButtonsPayload(card.buttons);

        if (buttons.length) {
          cardComponents.push({
            type: 'BUTTONS',
            buttons,
          } as CreateTemplateFormData['components'][number]);
        }

        return { components: cardComponents };
      }),
    });
  }

  return payload;
}

export function addStandardButton(buttons: StandardButtonDraft[]) {
  return [...buttons, DEFAULT_STANDARD_BUTTON()];
}

export function addCarouselCard(cards: CarouselCardDraft[]) {
  return [...cards, DEFAULT_CAROUSEL_CARD()];
}
