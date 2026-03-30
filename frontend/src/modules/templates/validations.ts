import { z } from 'zod/v4';
import { optionalPhoneSchema } from '@/shared/utils/phone';
import { META_TEMPLATE_LANGUAGES, TEMPLATE_CATEGORY_OPTIONS, TEMPLATE_TYPE_OPTIONS } from './templateCatalog';
import { normalizeTemplateExampleValues, validateTemplateVariableExamples, validateUrlButtonExamples } from './templateExamples';
import { getTemplateMediaRule } from './templateMediaRules';

const TEMPLATE_CATEGORIES = TEMPLATE_CATEGORY_OPTIONS.map((option) => option.value) as [string, ...string[]];
const TEMPLATE_TYPES = TEMPLATE_TYPE_OPTIONS.map((option) => option.value) as [string, ...string[]];
const META_LANGUAGE_CODES = META_TEMPLATE_LANGUAGES.map((language) => language.value) as [string, ...string[]];
const HEADER_TEXT_LIMIT = 60;
const FOOTER_TEXT_LIMIT = 60;
const BUTTON_TEXT_LIMIT = 25;
const MAX_URL_BUTTONS = 2;
const MAX_PHONE_NUMBER_BUTTONS = 1;
const MAX_AUTH_SUPPORTED_APPS = 5;

const metaLanguageSchema = z.enum(META_LANGUAGE_CODES, {
  error: 'Language must match a Meta-supported WhatsApp template locale.',
});

const waAccountSchema = z
  .string()
  .uuid('Select a connected WhatsApp number.');

const buttonSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'OTP', 'FLOW', 'CATALOG', 'MPM']),
  text: z.string().trim().max(BUTTON_TEXT_LIMIT).optional(),
  url: z.string().trim().max(2000).optional(),
  phone_number: optionalPhoneSchema,
  example: z.union([z.string(), z.array(z.string())]).optional(),
  flow_id: z.string().trim().optional(),
  flow_name: z.string().trim().optional(),
  flow_action: z.enum(['navigate', 'data_exchange']).optional(),
  flow_json: z.string().trim().optional(),
  navigate_screen: z.string().trim().optional(),
  otp_type: z.enum(['COPY_CODE', 'ONE_TAP', 'ZERO_TAP']).optional(),
  autofill_text: z.string().trim().max(BUTTON_TEXT_LIMIT).optional(),
  package_name: z.string().trim().max(255).optional(),
  signature_hash: z.string().trim().max(255).optional(),
  supported_apps: z.array(z.object({
    package_name: z.string().trim().max(255).optional(),
    signature_hash: z.string().trim().max(255).optional(),
  })).max(MAX_AUTH_SUPPORTED_APPS).optional(),
});

type TemplateButton = z.infer<typeof buttonSchema>;

const mediaAssetSchema = z.object({
  file_id: z.string().trim().optional(),
  original_name: z.string().trim().optional(),
  mime_type: z.string().trim().optional(),
  size: z.number().nonnegative().optional(),
  type: z.enum(['image', 'video', 'audio', 'document', 'other']).optional(),
  preview_url: z.string().trim().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  aspect_ratio: z.string().trim().optional(),
  header_handle: z.string().trim().optional().nullable(),
});

const componentSchema: z.ZodType<{
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS' | 'CAROUSEL' | 'LIMITED_TIME_OFFER';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
  };
  media_asset?: z.infer<typeof mediaAssetSchema>;
  buttons?: TemplateButton[];
  cards?: Array<{ components?: Array<z.infer<typeof componentSchema>> }>;
  add_security_recommendation?: boolean;
  code_expiration_minutes?: number;
}> = z.lazy(() =>
  z.object({
    type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS', 'CAROUSEL', 'LIMITED_TIME_OFFER']),
    format: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION']).optional(),
    text: z.string().trim().max(1024).optional(),
    example: z.object({
      header_text: z.array(z.string()).optional(),
      body_text: z.array(z.array(z.string())).optional(),
      header_handle: z.array(z.string()).optional(),
    }).optional(),
    media_asset: mediaAssetSchema.optional(),
    buttons: z.array(buttonSchema).optional(),
    cards: z.array(z.object({
      components: z.array(componentSchema).optional(),
    })).optional(),
    add_security_recommendation: z.boolean().optional(),
    code_expiration_minutes: z.number().int().min(1).max(90).optional(),
  })
);

function getComponent(components: Array<z.infer<typeof componentSchema>>, type: string) {
  return components.find((component) => component.type === type) || null;
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ''));
}

const BUTTON_TEXT_VARIABLE_REGEX = /\{\{[^{}]+\}\}/;
const BUTTON_TEXT_NEWLINE_REGEX = /[\r\n]/;
const BUTTON_TEXT_FORMATTING_REGEX = /[*_~`]/;
const BUTTON_TEXT_EMOJI_REGEX = /[\p{Extended_Pictographic}\uFE0F]/u;

function getButtonLabelFormatError(value: unknown, label = 'Button text') {
  const raw = typeof value === 'string' ? value : '';
  const normalized = raw.trim();

  if (!normalized) {
    return null;
  }

  if (BUTTON_TEXT_NEWLINE_REGEX.test(raw)) {
    return `${label} cannot include line breaks.`;
  }

  if (BUTTON_TEXT_VARIABLE_REGEX.test(raw)) {
    return `${label} cannot include variables like {{1}}.`;
  }

  if (BUTTON_TEXT_EMOJI_REGEX.test(raw)) {
    return `${label} cannot include emojis.`;
  }

  if (BUTTON_TEXT_FORMATTING_REGEX.test(raw)) {
    return `${label} cannot include formatting characters such as *, _, ~, or \``;
  }

  return null;
}

function normalizeButtonType(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function isQuickReplyButton(button: Pick<TemplateButton, 'type'>) {
  return normalizeButtonType(button.type) === 'QUICK_REPLY';
}

function hasSupportedQuickReplyGrouping(buttons: TemplateButton[]) {
  let transitions = 0;
  let previousGroup: 'quick_reply' | 'non_quick_reply' | null = null;

  buttons.forEach((button) => {
    const nextGroup = isQuickReplyButton(button) ? 'quick_reply' : 'non_quick_reply';
    if (previousGroup && previousGroup !== nextGroup) {
      transitions += 1;
    }
    previousGroup = nextGroup;
  });

  return transitions <= 1;
}

function buildCarouselCardSignature(cardComponents: Array<z.infer<typeof componentSchema>>) {
  const componentTypes = cardComponents.map((component) => component.type);
  const buttonTypes = ((getComponent(cardComponents, 'BUTTONS')?.buttons as TemplateButton[] | undefined) || [])
    .map((button) => normalizeButtonType(button.type))
    .filter(Boolean);

  return `${componentTypes.join('|')}::${buttonTypes.join('|')}`;
}

function pushIssue(ctx: z.RefinementCtx, path: Array<string | number>, message: string) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path,
    message,
  });
}

function hasHeaderMedia(component: z.infer<typeof componentSchema> | null | undefined) {
  return Boolean(
    component?.media_asset?.file_id
    || component?.media_asset?.header_handle
    || component?.example?.header_handle?.length
  );
}

function validateVariableExamples(
  text: string,
  examples: unknown,
  ctx: z.RefinementCtx,
  path: Array<string | number>,
  label: string
) {
  const message = validateTemplateVariableExamples(
    text,
    normalizeTemplateExampleValues(examples),
    label
  );

  if (message) {
    pushIssue(ctx, path, message);
  }
}

function validateHeaderMedia(
  component: z.infer<typeof componentSchema> | null | undefined,
  ctx: z.RefinementCtx,
  path: Array<string | number>
) {
  if (!component?.format || !['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format)) {
    return;
  }

  const rule = getTemplateMediaRule(component.format);
  if (!rule || !component.media_asset) {
    return;
  }

  if (component.media_asset.mime_type && !rule.mimeTypes.includes(component.media_asset.mime_type)) {
    pushIssue(ctx, [...path, 'media_asset', 'mime_type'], `${rule.label} headers support ${rule.mimeTypes.join(', ')} only.`);
  }

  if (component.media_asset.size && component.media_asset.size > rule.maxSizeBytes) {
    pushIssue(ctx, [...path, 'media_asset', 'size'], `${rule.label} headers must be ${Math.round(rule.maxSizeBytes / (1024 * 1024))} MB or smaller.`);
  }
}

function validateButtons(
  buttons: TemplateButton[] | undefined,
  ctx: z.RefinementCtx,
  basePath: Array<string | number>,
  allowedTypes: TemplateButton['type'][],
  options: { exact?: number; max?: number; require?: boolean } = {}
) {
  const list = buttons || [];

  if (options.require && list.length === 0) {
    pushIssue(ctx, basePath, 'At least one button is required.');
    return;
  }

  if (typeof options.exact === 'number' && list.length !== options.exact) {
    pushIssue(ctx, basePath, `Exactly ${options.exact} button(s) are required.`);
  }

  if (typeof options.max === 'number' && list.length > options.max) {
    pushIssue(ctx, basePath, `No more than ${options.max} button(s) are allowed.`);
  }

  let urlPhoneCount = 0;
  let urlCount = 0;
  let phoneNumberCount = 0;

  list.forEach((button, index) => {
    if (!allowedTypes.includes(button.type)) {
      pushIssue(ctx, [...basePath, index, 'type'], `Button type ${button.type} is not allowed for this template type.`);
    }

    if (button.type !== 'OTP' && !textValue(button.text)) {
      pushIssue(ctx, [...basePath, index, 'text'], 'Button text is required.');
    }

    if (button.type !== 'OTP') {
      const buttonTextFormatError = getButtonLabelFormatError(button.text);
      if (buttonTextFormatError) {
        pushIssue(ctx, [...basePath, index, 'text'], buttonTextFormatError);
      }
    }

    if (button.type === 'OTP') {
      if (textValue(button.text)) {
        pushIssue(ctx, [...basePath, index, 'text'], 'Authentication OTP button text is managed by Meta and is not supported.');
      }
      if (textValue(button.autofill_text)) {
        pushIssue(ctx, [...basePath, index, 'autofill_text'], 'Authentication autofill_text is managed by Meta previews and is not supported in template creation.');
      }
    }

    if (button.type === 'URL') {
      const buttonUrl = textValue(button.url);
      urlPhoneCount += 1;
      urlCount += 1;
      if (!buttonUrl) {
        pushIssue(ctx, [...basePath, index, 'url'], 'URL buttons require a destination URL.');
      } else {
        const urlButtonMessage = validateUrlButtonExamples(
          buttonUrl,
          normalizeTemplateExampleValues(button.example),
          'URL button'
        );
        if (urlButtonMessage) {
          pushIssue(ctx, [...basePath, index, 'example'], urlButtonMessage);
        }
      }
    }

    if (button.type === 'PHONE_NUMBER') {
      urlPhoneCount += 1;
      phoneNumberCount += 1;
      if (!textValue(button.phone_number)) {
        pushIssue(ctx, [...basePath, index, 'phone_number'], 'Phone buttons require a phone number.');
      }
    }

    if (button.type === 'FLOW') {
      const flowReferences = [textValue(button.flow_id), textValue(button.flow_name), textValue(button.flow_json)].filter(Boolean);

      if (flowReferences.length === 0) {
        pushIssue(ctx, [...basePath, index], 'Flow buttons require a linked flow, flow name, or flow JSON.');
      }

      if (flowReferences.length > 1) {
        pushIssue(ctx, [...basePath, index], 'Provide only one flow reference: flow_id, flow_name, or flow_json.');
      }

      if (!textValue(button.flow_action)) {
        pushIssue(ctx, [...basePath, index, 'flow_action'], 'Flow buttons require a flow action.');
      }

      const canResolveNavigateScreenFromLinkedFlow = Boolean(textValue(button.flow_id) && isUuid(button.flow_id));
      if (button.flow_action === 'navigate' && !textValue(button.navigate_screen) && !canResolveNavigateScreenFromLinkedFlow) {
        pushIssue(ctx, [...basePath, index, 'navigate_screen'], 'Navigate flow buttons require a screen ID.');
      }

      if (textValue(button.flow_json)) {
        try {
          const parsed = JSON.parse(button.flow_json!);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            pushIssue(ctx, [...basePath, index, 'flow_json'], 'Flow payload must be a JSON object.');
          }
        } catch {
          pushIssue(ctx, [...basePath, index, 'flow_json'], 'Flow payload must be valid JSON.');
        }
      }
    }

    if (button.type === 'OTP') {
      if (!button.otp_type) {
        pushIssue(ctx, [...basePath, index, 'otp_type'], 'OTP button type is required.');
      }

      const supportedApps = Array.isArray(button.supported_apps) ? button.supported_apps : [];
      const hasLegacySupportedApp = textValue(button.package_name) || textValue(button.signature_hash);

      if (supportedApps.length > MAX_AUTH_SUPPORTED_APPS) {
        pushIssue(ctx, [...basePath, index, 'supported_apps'], `Meta allows up to ${MAX_AUTH_SUPPORTED_APPS} supported Android apps per authentication button.`);
      }

      if (button.otp_type === 'COPY_CODE') {
        if (supportedApps.some((app) => textValue(app.package_name) || textValue(app.signature_hash)) || hasLegacySupportedApp) {
          pushIssue(ctx, [...basePath, index, 'supported_apps'], 'Copy code authentication templates do not support Android app bindings.');
        }
      }

      if (button.otp_type && button.otp_type !== 'COPY_CODE') {
        const effectiveApps = supportedApps.length
          ? supportedApps
          : [{ package_name: button.package_name, signature_hash: button.signature_hash }];

        if (!effectiveApps.length) {
          pushIssue(ctx, [...basePath, index, 'supported_apps'], 'One-tap and zero-tap authentication templates require at least one supported Android app.');
        }

        effectiveApps.forEach((app, appIndex) => {
          if (!textValue(app.package_name)) {
            pushIssue(ctx, [...basePath, index, 'supported_apps', appIndex, 'package_name'], 'Package name is required for one-tap and zero-tap OTP buttons.');
          }
          if (!textValue(app.signature_hash)) {
            pushIssue(ctx, [...basePath, index, 'supported_apps', appIndex, 'signature_hash'], 'Signature hash is required for one-tap and zero-tap OTP buttons.');
          }
        });
      }
    }
  });

  if (urlPhoneCount > 2) {
    pushIssue(ctx, basePath, 'A template can include at most two URL or phone CTA buttons.');
  }

  if (urlCount > MAX_URL_BUTTONS) {
    pushIssue(ctx, basePath, `A template can include at most ${MAX_URL_BUTTONS} URL button(s).`);
  }

  if (phoneNumberCount > MAX_PHONE_NUMBER_BUTTONS) {
    pushIssue(ctx, basePath, 'A template can include at most 1 phone number button.');
  }

  const supportsMixedStandardButtons = allowedTypes.includes('QUICK_REPLY')
    && (allowedTypes.includes('URL') || allowedTypes.includes('PHONE_NUMBER'));

  if (supportsMixedStandardButtons && !hasSupportedQuickReplyGrouping(list)) {
    pushIssue(
      ctx,
      basePath,
      'Quick reply buttons must stay grouped together. Use quick replies first or last when mixing them with URL or phone CTA buttons.'
    );
  }
}

const baseTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(512).regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores only.'),
  display_name: z.string().trim().max(512).optional(),
  language: metaLanguageSchema,
  category: z.enum(TEMPLATE_CATEGORIES),
  type: z.enum(TEMPLATE_TYPES),
  components: z.array(componentSchema).min(1, 'At least one component is required'),
  example_values: z.record(z.string(), z.unknown()).optional(),
  wa_account_id: waAccountSchema.optional(),
});

function templateBusinessRules(schema: typeof baseTemplateSchema) {
  return schema.superRefine((data, ctx) => {
    const header = getComponent(data.components, 'HEADER');
    const body = getComponent(data.components, 'BODY');
    const footer = getComponent(data.components, 'FOOTER');
    const buttonsComponent = getComponent(data.components, 'BUTTONS');
    const carousel = getComponent(data.components, 'CAROUSEL');
    const buttons = buttonsComponent?.buttons;

    if (data.category === 'AUTHENTICATION' && data.type !== 'authentication') {
      pushIssue(ctx, ['type'], 'Authentication category templates must use the authentication template type.');
    }

    if (header?.format === 'TEXT' && !textValue(header.text)) {
      pushIssue(ctx, ['components'], 'Text headers require header text.');
    }

    const headerText = textValue(header?.text);
    if (header?.format === 'TEXT' && headerText.length > HEADER_TEXT_LIMIT) {
      pushIssue(ctx, ['components'], `Header text must be ${HEADER_TEXT_LIMIT} characters or fewer.`);
    }
    if (header?.format === 'TEXT' && headerText) {
      validateVariableExamples(
        headerText,
        header.example?.header_text,
        ctx,
        ['components', 'header', 'example', 'header_text'],
        'Header text'
      );
    }

    if (header?.format && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header.format) && !hasHeaderMedia(header)) {
      pushIssue(ctx, ['components'], 'Media headers require an uploaded sample file.');
    }
    validateHeaderMedia(header, ctx, ['components']);

    if (footer?.text && textValue(footer.text).length > FOOTER_TEXT_LIMIT) {
      pushIssue(ctx, ['components'], `Footer text must be ${FOOTER_TEXT_LIMIT} characters or fewer.`);
    }

    switch (data.type) {
      case 'standard':
        {
          const bodyText = textValue(body?.text);
          if (!bodyText) {
            pushIssue(ctx, ['components'], 'Standard templates require body text.');
          } else {
            validateVariableExamples(
              bodyText,
              body?.example?.body_text?.[0],
              ctx,
              ['components', 'body', 'example', 'body_text'],
              'Body text'
            );
          }
        }
        if (carousel) {
          pushIssue(ctx, ['components'], 'Standard templates cannot include carousel cards.');
        }
        validateButtons(buttons, ctx, ['components'], ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'], { max: 10 });
        break;

      case 'authentication':
        if (data.category !== 'AUTHENTICATION') {
          pushIssue(ctx, ['category'], 'Authentication templates must use the AUTHENTICATION category.');
        }
        if (header) {
          pushIssue(ctx, ['components'], 'Authentication templates do not support headers.');
        }
        if (!body) {
          pushIssue(ctx, ['components'], 'Authentication templates require a BODY component.');
        }
        if (body?.text) {
          pushIssue(ctx, ['components'], 'Authentication template body text is not user-defined in the Meta API examples.');
        }
        if (footer && footer.code_expiration_minutes === undefined) {
          pushIssue(ctx, ['components'], 'Authentication footer blocks require code_expiration_minutes.');
        }
        if (footer?.text) {
          pushIssue(ctx, ['components'], 'Authentication templates do not use custom footer text.');
        }
        if (footer?.code_expiration_minutes !== undefined && (footer.code_expiration_minutes < 1 || footer.code_expiration_minutes > 90)) {
          pushIssue(ctx, ['components'], 'Code expiration must be between 1 and 90 minutes.');
        }
        validateButtons(buttons, ctx, ['components'], ['OTP'], { exact: 1, require: true, max: 1 });
        break;

      case 'carousel':
        if (data.category !== 'MARKETING') {
          pushIssue(ctx, ['category'], 'Carousel templates must use the MARKETING category.');
        }
        {
          const bodyText = textValue(body?.text);
          if (!bodyText) {
            pushIssue(ctx, ['components'], 'Carousel templates require a top-level body text block.');
          } else {
            validateVariableExamples(
              bodyText,
              body?.example?.body_text?.[0],
              ctx,
              ['components', 'body', 'example', 'body_text'],
              'Carousel body text'
            );
          }
        }
        if (header || footer || buttonsComponent) {
          pushIssue(ctx, ['components'], 'Carousel templates can only include BODY and CAROUSEL at the top level.');
        }
        if (!carousel?.cards || carousel.cards.length < 2 || carousel.cards.length > 10) {
          pushIssue(ctx, ['components'], 'Carousel templates require between 2 and 10 cards.');
        } else {
          const bodyPresence: boolean[] = [];
          let baselineCardSignature: string | null = null;

          carousel.cards.forEach((card, index) => {
            const cardComponents = card.components || [];
            const cardHeader = getComponent(cardComponents, 'HEADER');
            const cardBody = getComponent(cardComponents, 'BODY');
            const cardFooter = getComponent(cardComponents, 'FOOTER');
            const cardButtons = getComponent(cardComponents, 'BUTTONS')?.buttons;
            const cardBodyText = textValue(cardBody?.text);

            if (!cardHeader) {
              pushIssue(ctx, ['components', index, 'header'], 'Each carousel card requires an image or video header.');
            } else {
              if (!cardHeader.format || !['IMAGE', 'VIDEO'].includes(cardHeader.format)) {
                pushIssue(ctx, ['components', index, 'header', 'format'], 'Carousel card headers must use IMAGE or VIDEO.');
              }
              if (textValue(cardHeader.text)) {
                pushIssue(ctx, ['components', index, 'header', 'text'], 'Carousel card headers do not support text.');
              }
              if (!hasHeaderMedia(cardHeader)) {
                pushIssue(ctx, ['components', index, 'header'], 'Each carousel card header requires an uploaded sample file.');
              }
              validateHeaderMedia(cardHeader, ctx, ['components', index, 'header']);
            }

            if (cardFooter) {
              pushIssue(ctx, ['components', index, 'footer'], 'Carousel cards do not support footer text.');
            }

            bodyPresence.push(Boolean(cardBodyText));
            if (cardBodyText) {
              validateVariableExamples(
                cardBodyText,
                cardBody?.example?.body_text?.[0],
                ctx,
                ['components', index, 'body', 'example', 'body_text'],
                'Card body text'
              );
            }

            validateButtons(cardButtons, ctx, ['components', index, 'buttons'], ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'], { max: 2 });

            const cardSignature = buildCarouselCardSignature(cardComponents);
            if (!baselineCardSignature) {
              baselineCardSignature = cardSignature;
            } else if (cardSignature !== baselineCardSignature) {
              pushIssue(ctx, ['components', index], 'All carousel cards must use the same component structure and button combination.');
            }
          });

          if (bodyPresence.some(Boolean) && bodyPresence.some((present) => !present)) {
            pushIssue(ctx, ['components'], 'If one carousel card includes body text, every carousel card must include body text.');
          }
        }
        break;

      case 'flow':
        if (header) {
          pushIssue(ctx, ['components'], 'Flow templates should not include headers.');
        }
        if (footer) {
          pushIssue(ctx, ['components'], 'Flow templates should not include footers.');
        }
        {
          const bodyText = textValue(body?.text);
          if (!bodyText) {
            pushIssue(ctx, ['components'], 'Flow templates require body text.');
          } else {
            validateVariableExamples(
              bodyText,
              body?.example?.body_text?.[0],
              ctx,
              ['components', 'body', 'example', 'body_text'],
              'Body text'
            );
          }
        }
        validateButtons(buttons, ctx, ['components'], ['FLOW'], { exact: 1, require: true, max: 1 });
        break;

      case 'list_menu':
        {
          const bodyText = textValue(body?.text);
          if (!bodyText) {
            pushIssue(ctx, ['components'], 'List menu templates require body text.');
          } else {
            validateVariableExamples(
              bodyText,
              body?.example?.body_text?.[0],
              ctx,
              ['components', 'body', 'example', 'body_text'],
              'Body text'
            );
          }
        }
        validateButtons(buttons, ctx, ['components'], ['CATALOG', 'MPM'], { exact: 1, require: true, max: 1 });
        break;

      default:
        break;
    }
  });
}

export const createTemplateSchema = templateBusinessRules(baseTemplateSchema);
export type CreateTemplateFormData = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema;
export type UpdateTemplateFormData = z.infer<typeof updateTemplateSchema>;

export const publishTemplateSchema = z.object({
  wa_account_id: waAccountSchema.optional(),
});

export const syncTemplatesSchema = z.object({
  wa_account_id: waAccountSchema.optional(),
});
