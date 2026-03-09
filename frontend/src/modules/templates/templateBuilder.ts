import type { Template } from '@/core/types';
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
}

export interface CarouselCardDraft {
  headerFormat: HeaderFormat;
  headerText: string;
  headerMedia: TemplateMediaAsset | null;
  bodyText: string;
  footerText: string;
  buttons: StandardButtonDraft[];
}

export interface TemplateDraft {
  name: string;
  display_name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  type: 'standard' | 'authentication' | 'carousel' | 'flow' | 'list_menu';
  waba_id: string;
  standard: {
    headerFormat: HeaderFormat;
    headerText: string;
    headerMedia: TemplateMediaAsset | null;
    bodyText: string;
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
  };
  carousel: {
    cards: CarouselCardDraft[];
  };
  flow: {
    bodyText: string;
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
    headerMedia: TemplateMediaAsset | null;
    bodyText: string;
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
});

const DEFAULT_CAROUSEL_CARD = (): CarouselCardDraft => ({
  headerFormat: 'IMAGE',
  headerText: '',
  headerMedia: null,
  bodyText: '',
  footerText: '',
  buttons: [
    {
      type: 'URL',
      text: '',
      url: '',
      phone_number: '',
    },
  ],
});

export function createEmptyTemplateDraft(): TemplateDraft {
  return {
    name: '',
    display_name: '',
    language: 'en_US',
    category: 'MARKETING',
    type: 'standard',
    waba_id: '',
    standard: {
      headerFormat: 'NONE',
      headerText: '',
      headerMedia: null,
      bodyText: '',
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
    },
    carousel: {
      cards: [DEFAULT_CAROUSEL_CARD(), DEFAULT_CAROUSEL_CARD()],
    },
    flow: {
      bodyText: '',
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
      headerMedia: null,
      bodyText: '',
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

function hydrateStandardButtons(rawButtons: Array<Record<string, unknown>> | undefined): StandardButtonDraft[] {
  const buttons = (rawButtons || [])
    .map((button) => ({
      type: (button.type as StandardButtonType) || 'QUICK_REPLY',
      text: trim(button.text),
      url: trim(button.url),
      phone_number: trim(button.phone_number),
    }))
    .filter((button) => ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'].includes(button.type));

  return buttons.length ? buttons : [DEFAULT_STANDARD_BUTTON()];
}

function normalizeHeaderMedia(component: TemplateComponent | null): TemplateMediaAsset | null {
  if (!component) {
    return null;
  }

  const mediaAsset = component.media_asset;
  if (mediaAsset && typeof mediaAsset === 'object') {
    return {
      ...mediaAsset,
      header_handle:
        mediaAsset.header_handle
        || (Array.isArray(component.example?.header_handle) ? component.example.header_handle[0] || null : null),
    };
  }

  const headerHandle = Array.isArray(component.example?.header_handle)
    ? component.example.header_handle[0] || null
    : null;

  if (!headerHandle) {
    return null;
  }

  return {
    file_id: '',
    original_name: '',
    mime_type: '',
    size: 0,
    type: 'other',
    header_handle: headerHandle,
  };
}

function hydrateHeader(component: TemplateComponent | null) {
  if (!component) {
    return {
      headerFormat: 'NONE' as HeaderFormat,
      headerText: '',
      headerMedia: null,
    };
  }

  const format = (component.format as HeaderFormat | undefined) || 'TEXT';
  return {
    headerFormat: format,
    headerText: trim(component.text),
    headerMedia: normalizeHeaderMedia(component),
  };
}

function buildHeaderComponent(
  headerFormat: HeaderFormat,
  headerText: string,
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
  }

  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && headerMedia) {
    component.media_asset = {
      file_id: headerMedia.file_id,
      original_name: headerMedia.original_name,
      mime_type: headerMedia.mime_type,
      size: headerMedia.size,
      type: headerMedia.type,
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
  const { headerFormat, headerText, headerMedia } = hydrateHeader(header);

  draft.name = template.name || '';
  draft.display_name = template.display_name || '';
  draft.language = template.language || 'en_US';
  draft.category = template.category;
  draft.type = template.type;
  draft.waba_id = template.waba_id || '';

  draft.standard = {
    headerFormat,
    headerText,
    headerMedia,
    bodyText: trim(body?.text),
    footerText: trim(footer?.text),
    buttons: hydrateStandardButtons(buttonsComponent?.buttons as Array<Record<string, unknown>> | undefined),
  };

  const authButton = Array.isArray(buttonsComponent?.buttons)
    ? (buttonsComponent.buttons[0] as Record<string, unknown> | undefined)
    : undefined;

  draft.authentication = {
    addSecurityRecommendation: Boolean(body?.add_security_recommendation),
    codeExpirationMinutes:
      typeof footer?.code_expiration_minutes === 'number' ? footer.code_expiration_minutes : 10,
    otpType: (authButton?.otp_type as TemplateDraft['authentication']['otpType']) || 'COPY_CODE',
    buttonText: trim(authButton?.text) || 'Copy code',
    autofillText: trim(authButton?.autofill_text),
    packageName: trim(authButton?.package_name),
    signatureHash: trim(authButton?.signature_hash),
  };

  draft.flow = {
    bodyText: trim(body?.text),
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
    headerMedia,
    bodyText: trim(body?.text),
    footerText: trim(footer?.text),
    buttonType: (authButton?.type as ListMenuButtonType) || 'CATALOG',
    buttonText: trim(authButton?.text) || 'View catalog',
    example: trim(authButton?.example),
  };

  if (carousel?.cards?.length) {
    draft.carousel.cards = carousel.cards.map((card) => {
      const cardComponents = Array.isArray(card.components) ? card.components : [];
      const cardHeader = getComponent(cardComponents, 'HEADER');
      const cardBody = getComponent(cardComponents, 'BODY');
      const cardFooter = getComponent(cardComponents, 'FOOTER');
      const cardButtons = getComponent(cardComponents, 'BUTTONS');
      const hydratedHeader = hydrateHeader(cardHeader);

      return {
        headerFormat: hydratedHeader.headerFormat,
        headerText: hydratedHeader.headerText,
        headerMedia: hydratedHeader.headerMedia,
        bodyText: trim(cardBody?.text),
        footerText: trim(cardFooter?.text),
        buttons: hydrateStandardButtons(cardButtons?.buttons as Array<Record<string, unknown>> | undefined),
      };
    });
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
    waba_id: trim(draft.waba_id) || undefined,
    components: [],
  };

  if (draft.type === 'standard') {
    const header = buildHeaderComponent(
      draft.standard.headerFormat,
      draft.standard.headerText,
      draft.standard.headerMedia
    );
    if (header) {
      payload.components.push(header as CreateTemplateFormData['components'][number]);
    }

    payload.components.push({
      type: 'BODY',
      text: trim(draft.standard.bodyText),
    });

    if (trim(draft.standard.footerText)) {
      payload.components.push({
        type: 'FOOTER',
        text: trim(draft.standard.footerText),
      });
    }

    const buttons = draft.standard.buttons
      .filter((button) => trim(button.text) || trim(button.url) || trim(button.phone_number))
      .map((button) => ({
        type: button.type,
        text: trim(button.text),
        ...(button.type === 'URL' ? { url: trim(button.url) } : {}),
        ...(button.type === 'PHONE_NUMBER' ? { phone_number: trim(button.phone_number) } : {}),
      }));

    if (buttons.length) {
      payload.components.push({
        type: 'BUTTONS',
        buttons,
      });
    }
  }

  if (draft.type === 'authentication') {
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
          otp_type: draft.authentication.otpType,
          text: trim(draft.authentication.buttonText),
          autofill_text: trim(draft.authentication.autofillText) || undefined,
          package_name: trim(draft.authentication.packageName) || undefined,
          signature_hash: trim(draft.authentication.signatureHash) || undefined,
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
      draft.listMenu.headerMedia
    );
    if (header) {
      payload.components.push(header as CreateTemplateFormData['components'][number]);
    }

    payload.components.push({
      type: 'BODY',
      text: trim(draft.listMenu.bodyText),
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
      type: 'CAROUSEL',
      cards: draft.carousel.cards.map((card) => {
        const cardComponents: CreateTemplateFormData['components'] = [];
        const header = buildHeaderComponent(card.headerFormat, card.headerText, card.headerMedia);
        if (header) {
          cardComponents.push(header as CreateTemplateFormData['components'][number]);
        }

        cardComponents.push({
          type: 'BODY',
          text: trim(card.bodyText),
        });

        if (trim(card.footerText)) {
          cardComponents.push({
            type: 'FOOTER',
            text: trim(card.footerText),
          });
        }

        const buttons = card.buttons
          .filter((button) => trim(button.text) || trim(button.url) || trim(button.phone_number))
          .map((button) => ({
            type: button.type,
            text: trim(button.text),
            ...(button.type === 'URL' ? { url: trim(button.url) } : {}),
            ...(button.type === 'PHONE_NUMBER' ? { phone_number: trim(button.phone_number) } : {}),
          }));

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
