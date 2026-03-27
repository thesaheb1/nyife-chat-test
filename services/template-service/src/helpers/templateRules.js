'use strict';

const { AppError } = require('@nyife/shared-utils');
const {
  META_TEMPLATE_LANGUAGE_CODES,
  META_TEMPLATE_STATUSES,
  TEMPLATE_QUALITY_SCORES,
} = require('../constants/template.constants');
const {
  readBodyTextExamples,
  readButtonExampleValues,
  readHeaderTextExamples,
  validateButtonUrlExamples,
  validateTextExamples,
} = require('./templateExamples');

const BODY_TEXT_LIMIT = 1024;
const HEADER_TEXT_LIMIT = 60;
const FOOTER_TEXT_LIMIT = 60;
const BUTTON_TEXT_LIMIT = 25;
const BUTTON_TEXT_VARIABLE_REGEX = /\{\{[^{}]+\}\}/;
const BUTTON_TEXT_NEWLINE_REGEX = /[\r\n]/;
const BUTTON_TEXT_FORMATTING_REGEX = /[*_~`]/;
const BUTTON_TEXT_EMOJI_REGEX = /[\p{Extended_Pictographic}\uFE0F]/u;
const MAX_STANDARD_BUTTONS = 10;
const MAX_CAROUSEL_BUTTONS = 2;
const MAX_CAROUSEL_CARDS = 10;
const MIN_CAROUSEL_CARDS = 2;
const MAX_URL_BUTTONS = 2;
const MAX_PHONE_NUMBER_BUTTONS = 1;
const MAX_AUTH_SUPPORTED_APPS = 5;
const EDITABLE_META_STATUSES = new Set(['APPROVED', 'REJECTED', 'PAUSED']);
const PENDING_META_STATUSES = new Set(['PENDING', 'IN_APPEAL', 'APPEAL_REQUESTED', 'PENDING_DELETION']);
const DISABLED_META_STATUSES = new Set(['DISABLED', 'DELETED', 'ARCHIVED', 'LIMIT_EXCEEDED']);
const DELETE_ALLOWED_META_STATUSES = new Set([
  ...EDITABLE_META_STATUSES,
  ...PENDING_META_STATUSES,
  ...DISABLED_META_STATUSES,
]);
const TEMPLATE_MEDIA_RULES = {
  IMAGE: {
    label: 'Image',
    mimeTypes: ['image/jpeg', 'image/png'],
    maxSizeBytes: 5 * 1024 * 1024,
  },
  VIDEO: {
    label: 'Video',
    mimeTypes: ['video/mp4', 'video/3gpp', 'video/3gp'],
    maxSizeBytes: 16 * 1024 * 1024,
  },
  DOCUMENT: {
    label: 'Document',
    mimeTypes: [
      'text/plain',
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    maxSizeBytes: 100 * 1024 * 1024,
  },
};

function normalizeComponentType(type) {
  return String(type || '').toUpperCase();
}

function textValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getButtonLabelFormatError(value, label = 'Button text') {
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

function isQuickReplyButton(button) {
  return normalizeComponentType(button?.type) === 'QUICK_REPLY';
}

function normalizeMetaButtonOrder(buttons) {
  const list = Array.isArray(buttons) ? buttons : [];
  if (list.length < 2) {
    return list;
  }

  const quickReplies = [];
  const otherButtons = [];

  for (const button of list) {
    if (isQuickReplyButton(button)) {
      quickReplies.push(button);
    } else {
      otherButtons.push(button);
    }
  }

  if (!quickReplies.length || !otherButtons.length) {
    return list;
  }

  return isQuickReplyButton(list[0])
    ? [...quickReplies, ...otherButtons]
    : [...otherButtons, ...quickReplies];
}

function hasSupportedQuickReplyGrouping(buttons) {
  const list = Array.isArray(buttons) ? buttons : [];
  let groupTransitions = 0;
  let previousGroup = null;

  for (const button of list) {
    const nextGroup = isQuickReplyButton(button) ? 'quick_reply' : 'non_quick_reply';
    if (previousGroup && previousGroup !== nextGroup) {
      groupTransitions += 1;
    }
    previousGroup = nextGroup;
  }

  return groupTransitions <= 1;
}

function normalizeMetaTemplateStatus(status) {
  const normalized = textValue(status).toUpperCase();
  return META_TEMPLATE_STATUSES.includes(normalized) ? normalized : null;
}

function normalizeTemplateQualityScore(score) {
  const normalized = textValue(score).toUpperCase();
  return TEMPLATE_QUALITY_SCORES.includes(normalized) ? normalized : null;
}

function resolveTemplateMetaStatus(template) {
  const normalizedMetaStatus = normalizeMetaTemplateStatus(template?.meta_status_raw);
  if (normalizedMetaStatus) {
    return normalizedMetaStatus;
  }

  const rawMetaStatus = textValue(template?.meta_status_raw).toUpperCase();
  if (rawMetaStatus) {
    return rawMetaStatus;
  }

  const status = textValue(template?.status).toLowerCase();
  if (status === 'approved') {
    return 'APPROVED';
  }
  // Older synced rows can be missing meta_template_id even though Meta already owns
  // the template. We still treat clearly Meta-managed lifecycle states as immutable,
  // but keep local rejected drafts editable/publishable by only inferring REJECTED
  // when a concrete Meta template ID exists.
  if (status === 'rejected' && template?.meta_template_id) {
    return 'REJECTED';
  }
  if (status === 'paused') {
    return 'PAUSED';
  }
  if (status === 'disabled') {
    return 'DISABLED';
  }
  if (status === 'pending') {
    return 'PENDING';
  }

  return null;
}

function deriveLocalTemplateStatus(metaStatus, fallbackStatus = null) {
  const normalizedMetaStatus = normalizeMetaTemplateStatus(metaStatus);
  if (normalizedMetaStatus === 'APPROVED') {
    return 'approved';
  }
  if (normalizedMetaStatus === 'REJECTED') {
    return 'rejected';
  }
  if (normalizedMetaStatus === 'PAUSED') {
    return 'paused';
  }
  if (DISABLED_META_STATUSES.has(normalizedMetaStatus)) {
    return 'disabled';
  }
  if (PENDING_META_STATUSES.has(normalizedMetaStatus)) {
    return 'pending';
  }

  return String(fallbackStatus || 'draft').toLowerCase();
}

function isUnpublishedTemplate(template) {
  return !template?.meta_template_id;
}

function canPublishTemplate(template) {
  const status = String(template?.status || '').toLowerCase();
  return isUnpublishedTemplate(template) && (status === 'draft' || status === 'rejected');
}

function canEditTemplate(template) {
  if (canPublishTemplate(template)) {
    return true;
  }

  return EDITABLE_META_STATUSES.has(resolveTemplateMetaStatus(template));
}

function canDeleteTemplate(template) {
  const metaStatus = resolveTemplateMetaStatus(template);
  if (!metaStatus) {
    return true;
  }

  return DELETE_ALLOWED_META_STATUSES.has(metaStatus);
}

function canSyncTemplate(template) {
  return Boolean(
    resolveTemplateMetaStatus(template)
    || template?.meta_template_id
    || template?.wa_account_id
    || template?.waba_id
  );
}

function addError(errors, field, message) {
  errors.push({ field, message });
}

function getComponent(components, type) {
  return components.find((component) => normalizeComponentType(component.type) === type) || null;
}

function hasHeaderMedia(component) {
  return Boolean(
    component?.media_asset?.file_id
    || component?.media_asset?.header_handle
    || component?.example?.header_handle?.length
  );
}

function validateHeaderMediaAsset(component, field, errors) {
  const format = normalizeComponentType(component?.format);
  const rule = TEMPLATE_MEDIA_RULES[format];
  const mediaAsset = component?.media_asset;

  if (!rule || !mediaAsset) {
    return;
  }

  const mimeType = textValue(mediaAsset.mime_type);
  if (mimeType && !rule.mimeTypes.includes(mimeType)) {
    addError(errors, `${field}.media_asset.mime_type`, `${rule.label} headers support ${rule.mimeTypes.join(', ')} only.`);
  }

  if (typeof mediaAsset.size === 'number' && mediaAsset.size > rule.maxSizeBytes) {
    addError(errors, `${field}.media_asset.size`, `${rule.label} headers must be ${Math.round(rule.maxSizeBytes / (1024 * 1024))} MB or smaller.`);
  }
}

function validateHeader(component, field, errors) {
  if (!component) {
    return;
  }

  const format = normalizeComponentType(component.format);
  if (!format) {
    addError(errors, `${field}.format`, 'Header format is required.');
    return;
  }

  if (format === 'TEXT') {
    const text = textValue(component.text);
    if (!text) {
      addError(errors, `${field}.text`, 'Header text is required when the header format is TEXT.');
    } else if (text.length > HEADER_TEXT_LIMIT) {
      addError(errors, `${field}.text`, `Header text must be ${HEADER_TEXT_LIMIT} characters or fewer.`);
    }
    validateTextExamples({
      text,
      exampleValues: readHeaderTextExamples(component),
      field: `${field}.example.header_text`,
      label: 'Header text',
      errors,
      addError,
    });
    return;
  }

  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format) && !hasHeaderMedia(component)) {
    addError(errors, field, `A ${format.toLowerCase()} header requires an uploaded sample file.`);
  }

  validateHeaderMediaAsset(component, field, errors);
}

function validateStandardBody(component, field, errors) {
  const text = textValue(component?.text);
  if (!text) {
    addError(errors, `${field}.text`, 'Body text is required.');
    return;
  }

  if (text.length > BODY_TEXT_LIMIT) {
    addError(errors, `${field}.text`, `Body text must be ${BODY_TEXT_LIMIT} characters or fewer.`);
  }

  validateTextExamples({
    text,
    exampleValues: readBodyTextExamples(component),
    field: `${field}.example.body_text`,
    label: 'Body text',
    errors,
    addError,
  });
}

function validateStandardFooter(component, field, errors) {
  if (!component) {
    return;
  }

  const text = textValue(component.text);
  if (text.length > FOOTER_TEXT_LIMIT) {
    addError(errors, `${field}.text`, `Footer text must be ${FOOTER_TEXT_LIMIT} characters or fewer.`);
  }
}

function validateFlowJson(flowJson, field, errors) {
  if (!flowJson) {
    return;
  }

  try {
    const parsed = JSON.parse(flowJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      addError(errors, field, 'Flow JSON must be a valid JSON object.');
    }
  } catch {
    addError(errors, field, 'Flow JSON must be valid JSON.');
  }
}

function validateButtons(buttons, options, field, errors) {
  const {
    allowedTypes,
    maxButtons = MAX_STANDARD_BUTTONS,
    requireAtLeastOne = false,
    exactButtonCount,
  } = options;

  const list = Array.isArray(buttons) ? buttons : [];

  if (requireAtLeastOne && list.length === 0) {
    addError(errors, field, 'At least one button is required.');
    return;
  }

  if (typeof exactButtonCount === 'number' && list.length !== exactButtonCount) {
    addError(errors, field, `Exactly ${exactButtonCount} button(s) are required.`);
  }

  if (list.length > maxButtons) {
    addError(errors, field, `No more than ${maxButtons} button(s) are allowed.`);
  }

  let urlPhoneCount = 0;
  let urlCount = 0;
  let phoneNumberCount = 0;

  list.forEach((button, index) => {
    const type = normalizeComponentType(button.type);
    const buttonField = `${field}.${index}`;

    if (!allowedTypes.includes(type)) {
      addError(errors, `${buttonField}.type`, `Button type ${type} is not allowed for this template type.`);
      return;
    }

    const text = textValue(button.text);
    if (type !== 'OTP') {
      if (!text) {
        addError(errors, `${buttonField}.text`, 'Button text is required.');
      } else if (text.length > BUTTON_TEXT_LIMIT) {
        addError(errors, `${buttonField}.text`, `Button text must be ${BUTTON_TEXT_LIMIT} characters or fewer.`);
      }

      const buttonTextFormatError = getButtonLabelFormatError(button.text);
      if (buttonTextFormatError) {
        addError(errors, `${buttonField}.text`, buttonTextFormatError);
      }
    }

    if (type === 'OTP') {
      if (text) {
        addError(errors, `${buttonField}.text`, 'Authentication OTP button text is managed by Meta and is not supported.');
      }
      if (textValue(button.autofill_text)) {
        addError(errors, `${buttonField}.autofill_text`, 'Authentication autofill_text is managed by Meta previews and is not supported in template creation.');
      }
    }

    if (type === 'URL') {
      urlPhoneCount += 1;
      urlCount += 1;
      const buttonUrl = textValue(button.url);
      if (!buttonUrl) {
        addError(errors, `${buttonField}.url`, 'URL buttons require a destination URL.');
      } else {
        validateButtonUrlExamples({
          url: buttonUrl,
          exampleValues: readButtonExampleValues(button),
          field: `${buttonField}.example`,
          errors,
          addError,
        });
      }
    }

    if (type === 'PHONE_NUMBER') {
      urlPhoneCount += 1;
      phoneNumberCount += 1;
      const phoneNumber = textValue(button.phone_number);
      if (!phoneNumber) {
        addError(errors, `${buttonField}.phone_number`, 'Phone buttons require a phone number.');
      } else if (!/^\+?[1-9]\d{6,14}$/.test(phoneNumber)) {
        addError(errors, `${buttonField}.phone_number`, 'Phone number must be in international format.');
      }
    }

    if (type === 'FLOW') {
      const flowId = textValue(button.flow_id);
      const flowName = textValue(button.flow_name);
      const flowJson = textValue(button.flow_json);
      const configuredReferences = [flowId, flowName, flowJson].filter(Boolean);

      if (configuredReferences.length === 0) {
        addError(errors, `${buttonField}.flow_id`, 'Flow buttons require a linked flow ID, flow name, or flow JSON.');
      }

      if (configuredReferences.length > 1) {
        addError(errors, buttonField, 'Provide only one flow reference: flow_id, flow_name, or flow_json.');
      }

      const flowAction = textValue(button.flow_action);
      if (!flowAction) {
        addError(errors, `${buttonField}.flow_action`, 'Flow buttons require a flow action.');
      } else if (!['navigate', 'data_exchange'].includes(flowAction)) {
        addError(errors, `${buttonField}.flow_action`, 'Flow action must be navigate or data_exchange.');
      }

      if (flowAction === 'navigate' && !textValue(button.navigate_screen)) {
        addError(errors, `${buttonField}.navigate_screen`, 'Navigate flow buttons require a screen ID.');
      }

      validateFlowJson(flowJson, `${buttonField}.flow_json`, errors);
    }

    if (type === 'OTP') {
      const otpType = textValue(button.otp_type);
      if (!otpType) {
        addError(errors, `${buttonField}.otp_type`, 'Authentication templates require an OTP button type.');
      }

      if (otpType && !['COPY_CODE', 'ONE_TAP', 'ZERO_TAP'].includes(otpType)) {
        addError(errors, `${buttonField}.otp_type`, 'OTP type must be COPY_CODE, ONE_TAP, or ZERO_TAP.');
      }

      const supportedApps = Array.isArray(button.supported_apps) ? button.supported_apps : [];
      const hasLegacySupportedApp = textValue(button.package_name) || textValue(button.signature_hash);

      if (supportedApps.length > MAX_AUTH_SUPPORTED_APPS) {
        addError(errors, `${buttonField}.supported_apps`, `Meta allows up to ${MAX_AUTH_SUPPORTED_APPS} supported Android apps per authentication button.`);
      }

      if (otpType === 'COPY_CODE') {
        if (supportedApps.some((app) => textValue(app.package_name) || textValue(app.signature_hash)) || hasLegacySupportedApp) {
          addError(errors, `${buttonField}.supported_apps`, 'Copy code authentication templates do not support Android app bindings.');
        }
      }

      if (otpType && otpType !== 'COPY_CODE') {
        const effectiveApps = supportedApps.length
          ? supportedApps
          : [{ package_name: button.package_name, signature_hash: button.signature_hash }];

        if (!effectiveApps.length) {
          addError(errors, `${buttonField}.supported_apps`, 'One-tap and zero-tap authentication templates require at least one supported Android app.');
        }

        effectiveApps.forEach((app, appIndex) => {
          if (!textValue(app.package_name)) {
            addError(errors, `${buttonField}.supported_apps.${appIndex}.package_name`, 'One-tap and zero-tap OTP buttons require an Android package name.');
          }
          if (!textValue(app.signature_hash)) {
            addError(errors, `${buttonField}.supported_apps.${appIndex}.signature_hash`, 'One-tap and zero-tap OTP buttons require a signature hash.');
          }
        });
      }
    }
  });

  if (urlPhoneCount > 2) {
    addError(errors, field, 'A template can include at most 2 URL and phone CTA buttons.');
  }

  if (urlCount > MAX_URL_BUTTONS) {
    addError(errors, field, `A template can include at most ${MAX_URL_BUTTONS} URL button(s).`);
  }

  if (phoneNumberCount > MAX_PHONE_NUMBER_BUTTONS) {
    addError(errors, field, 'A template can include at most 1 phone number button.');
  }

  const supportsMixedStandardButtons = allowedTypes.includes('QUICK_REPLY')
    && (allowedTypes.includes('URL') || allowedTypes.includes('PHONE_NUMBER'));

  if (supportsMixedStandardButtons && !hasSupportedQuickReplyGrouping(list)) {
    addError(
      errors,
      field,
      'Quick reply buttons must stay grouped together. Use quick replies first or last when mixing them with URL or phone CTA buttons.'
    );
  }
}

function buildCarouselCardSignature(cardComponents) {
  const normalizedCardComponents = Array.isArray(cardComponents) ? cardComponents : [];
  const componentTypes = normalizedCardComponents
    .map((component) => normalizeComponentType(component.type))
    .filter(Boolean);
  const buttons = getComponent(normalizedCardComponents, 'BUTTONS')?.buttons;
  const buttonTypes = Array.isArray(buttons)
    ? buttons.map((button) => normalizeComponentType(button.type)).filter(Boolean)
    : [];

  return `${componentTypes.join('|')}::${buttonTypes.join('|')}`;
}

function assertTemplateBusinessRules(template) {
  const errors = [];
  const components = Array.isArray(template.components) ? template.components : [];
  const header = getComponent(components, 'HEADER');
  const body = getComponent(components, 'BODY');
  const footer = getComponent(components, 'FOOTER');
  const buttonsComponent = getComponent(components, 'BUTTONS');
  const carousel = getComponent(components, 'CAROUSEL');
  const buttons = Array.isArray(buttonsComponent?.buttons) ? buttonsComponent.buttons : [];

  if (!META_TEMPLATE_LANGUAGE_CODES.includes(template.language)) {
    addError(errors, 'language', 'Language must be one of the Meta-supported WhatsApp template locales.');
  }

  if (template.waba_id && !/^\d+$/.test(String(template.waba_id))) {
    addError(errors, 'waba_id', 'WABA ID must contain only digits.');
  }

  if (template.category === 'AUTHENTICATION' && template.type !== 'authentication') {
    addError(errors, 'type', 'Authentication category templates must use the authentication template type.');
  }

  switch (template.type) {
    case 'standard':
      validateHeader(header, 'components.header', errors);
      validateStandardBody(body, 'components.body', errors);
      validateStandardFooter(footer, 'components.footer', errors);
      if (carousel) {
        addError(errors, 'components.carousel', 'Standard templates cannot include carousel cards.');
      }
      validateButtons(buttons, {
        allowedTypes: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'],
      }, 'components.buttons', errors);
      break;

    case 'authentication':
      if (template.category !== 'AUTHENTICATION') {
        addError(errors, 'category', 'Authentication templates must use the AUTHENTICATION category.');
      }

      if (header) {
        addError(errors, 'components.header', 'Authentication templates do not support headers.');
      }

      if (!body) {
        addError(errors, 'components.body', 'Authentication templates require a BODY component.');
      } else if (body.text !== undefined && textValue(body.text)) {
        addError(errors, 'components.body.text', 'Authentication body text is managed by Meta and should not be customized.');
      }

      if (footer) {
        if (footer.text !== undefined && textValue(footer.text)) {
          addError(errors, 'components.footer.text', 'Authentication footer text is managed through code_expiration_minutes only.');
        }

        const expiration = Number(footer.code_expiration_minutes);
        if (!Number.isInteger(expiration) || expiration < 1 || expiration > 90) {
          addError(errors, 'components.footer.code_expiration_minutes', 'Code expiration must be an integer between 1 and 90 minutes.');
        }
      }

      validateButtons(buttons, {
        allowedTypes: ['OTP'],
        exactButtonCount: 1,
        requireAtLeastOne: true,
        maxButtons: 1,
      }, 'components.buttons', errors);
      break;

    case 'carousel':
      if (template.category !== 'MARKETING') {
        addError(errors, 'category', 'Carousel templates must use the MARKETING category.');
      }

      if (!carousel) {
        addError(errors, 'components.carousel', 'Carousel templates require a CAROUSEL component.');
        break;
      }

      if (!body) {
        addError(errors, 'components.body', 'Carousel templates require a top-level BODY component.');
      } else {
        validateStandardBody(body, 'components.body', errors);
      }

      if (header || footer || buttons.length) {
        addError(errors, 'components', 'Carousel templates can include only BODY and CAROUSEL at the top level.');
      }

      if (!Array.isArray(carousel.cards) || carousel.cards.length < MIN_CAROUSEL_CARDS || carousel.cards.length > MAX_CAROUSEL_CARDS) {
        addError(
          errors,
          'components.carousel.cards',
          `Carousel templates require between ${MIN_CAROUSEL_CARDS} and ${MAX_CAROUSEL_CARDS} cards.`
        );
        break;
      }

      const cardBodyPresence = [];
      let baselineCardSignature = null;

      carousel.cards.forEach((card, index) => {
        const cardComponents = Array.isArray(card.components) ? card.components : [];
        const cardHeader = getComponent(cardComponents, 'HEADER');
        const cardBody = getComponent(cardComponents, 'BODY');
        const cardFooter = getComponent(cardComponents, 'FOOTER');
        const cardButtons = getComponent(cardComponents, 'BUTTONS')?.buttons;
        const baseField = `components.carousel.cards.${index}`;

        if (!cardHeader) {
          addError(errors, `${baseField}.header`, 'Each carousel card requires a media header.');
        } else {
          const headerFormat = normalizeComponentType(cardHeader.format);
          if (!['IMAGE', 'VIDEO'].includes(headerFormat)) {
            addError(errors, `${baseField}.header.format`, 'Carousel card headers must use IMAGE or VIDEO.');
          }
          if (textValue(cardHeader.text)) {
            addError(errors, `${baseField}.header.text`, 'Carousel card headers do not support text.');
          }
          if (!hasHeaderMedia(cardHeader)) {
            addError(errors, `${baseField}.header`, 'Each carousel card header requires an uploaded sample file.');
          }
          validateHeaderMediaAsset(cardHeader, `${baseField}.header`, errors);
        }

        if (cardFooter) {
          addError(errors, `${baseField}.footer`, 'Carousel cards do not support footer text.');
        }

        cardBodyPresence.push(Boolean(cardBody && textValue(cardBody.text)));
        if (cardBody && textValue(cardBody.text)) {
          validateStandardBody(cardBody, `${baseField}.body`, errors);
        }

        validateButtons(cardButtons, {
          allowedTypes: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'],
          maxButtons: MAX_CAROUSEL_BUTTONS,
        }, `${baseField}.buttons`, errors);

        const cardSignature = buildCarouselCardSignature(cardComponents);
        if (!baselineCardSignature) {
          baselineCardSignature = cardSignature;
        } else if (cardSignature !== baselineCardSignature) {
          addError(
            errors,
            baseField,
            'All carousel cards must use the same component structure and button combination.'
          );
        }
      });

      const hasAnyCardBody = cardBodyPresence.some(Boolean);
      const hasMissingCardBody = cardBodyPresence.some((present) => !present);
      if (hasAnyCardBody && hasMissingCardBody) {
        addError(errors, 'components.carousel.cards', 'If one carousel card has body text, every carousel card must have body text.');
      }
      break;

    case 'flow':
      if (header) {
        addError(errors, 'components.header', 'Meta flow template examples do not include headers.');
      }
      if (footer) {
        addError(errors, 'components.footer', 'Meta flow template examples do not include footers.');
      }
      validateStandardBody(body, 'components.body', errors);
      validateButtons(buttons, {
        allowedTypes: ['FLOW'],
        exactButtonCount: 1,
        requireAtLeastOne: true,
        maxButtons: 1,
      }, 'components.buttons', errors);
      break;

    case 'list_menu':
      validateHeader(header, 'components.header', errors);
      validateStandardBody(body, 'components.body', errors);
      validateStandardFooter(footer, 'components.footer', errors);
      validateButtons(buttons, {
        allowedTypes: ['CATALOG', 'MPM'],
        exactButtonCount: 1,
        requireAtLeastOne: true,
        maxButtons: 1,
      }, 'components.buttons', errors);
      break;

    default:
      addError(errors, 'type', 'Unsupported template type.');
      break;
  }

  if (errors.length) {
    throw AppError.badRequest('Template definition is invalid for the selected template type.', errors);
  }
}

function getTemplateAvailableActions(template) {
  const actions = new Set(['view']);

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

module.exports = {
  assertTemplateBusinessRules,
  getTemplateAvailableActions,
  normalizeMetaTemplateStatus,
  normalizeTemplateQualityScore,
  resolveTemplateMetaStatus,
  deriveLocalTemplateStatus,
  canPublishTemplate,
  canEditTemplate,
  canDeleteTemplate,
  canSyncTemplate,
  normalizeMetaButtonOrder,
};
