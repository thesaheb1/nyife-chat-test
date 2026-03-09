'use strict';

const { AppError } = require('@nyife/shared-utils');
const { META_TEMPLATE_LANGUAGE_CODES } = require('../constants/template.constants');

const BODY_TEXT_LIMIT = 1024;
const HEADER_TEXT_LIMIT = 60;
const FOOTER_TEXT_LIMIT = 60;
const BUTTON_TEXT_LIMIT = 25;
const MAX_STANDARD_BUTTONS = 10;
const MAX_CAROUSEL_BUTTONS = 2;
const MAX_CAROUSEL_CARDS = 10;
const MIN_CAROUSEL_CARDS = 2;
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

  list.forEach((button, index) => {
    const type = normalizeComponentType(button.type);
    const buttonField = `${field}.${index}`;

    if (!allowedTypes.includes(type)) {
      addError(errors, `${buttonField}.type`, `Button type ${type} is not allowed for this template type.`);
      return;
    }

    const text = textValue(button.text);
    if (!text) {
      addError(errors, `${buttonField}.text`, 'Button text is required.');
    } else if (text.length > BUTTON_TEXT_LIMIT) {
      addError(errors, `${buttonField}.text`, `Button text must be ${BUTTON_TEXT_LIMIT} characters or fewer.`);
    }

    if (type === 'URL') {
      urlPhoneCount += 1;
      if (!textValue(button.url)) {
        addError(errors, `${buttonField}.url`, 'URL buttons require a destination URL.');
      }
    }

    if (type === 'PHONE_NUMBER') {
      urlPhoneCount += 1;
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

      if (otpType && otpType !== 'COPY_CODE') {
        if (!textValue(button.package_name)) {
          addError(errors, `${buttonField}.package_name`, 'One-tap and zero-tap OTP buttons require an Android package name.');
        }
        if (!textValue(button.signature_hash)) {
          addError(errors, `${buttonField}.signature_hash`, 'One-tap and zero-tap OTP buttons require a signature hash.');
        }
      }
    }
  });

  if (urlPhoneCount > 2) {
    addError(errors, field, 'A template can include at most 2 URL and phone CTA buttons.');
  }
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
      } else {
        if (body.text !== undefined && textValue(body.text)) {
          addError(errors, 'components.body.text', 'Authentication body text is managed by Meta and should not be customized.');
        }
        if (typeof body.add_security_recommendation !== 'boolean') {
          addError(errors, 'components.body.add_security_recommendation', 'Authentication BODY must declare add_security_recommendation as true or false.');
        }
      }

      if (!footer) {
        addError(errors, 'components.footer', 'Authentication templates require a FOOTER component.');
      } else {
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
      if (!carousel) {
        addError(errors, 'components.carousel', 'Carousel templates require a CAROUSEL component.');
        break;
      }

      if (header || body || footer || buttons.length) {
        addError(errors, 'components', 'Carousel templates in Nyife should contain only carousel cards at the top level.');
      }

      if (!Array.isArray(carousel.cards) || carousel.cards.length < MIN_CAROUSEL_CARDS || carousel.cards.length > MAX_CAROUSEL_CARDS) {
        addError(
          errors,
          'components.carousel.cards',
          `Carousel templates require between ${MIN_CAROUSEL_CARDS} and ${MAX_CAROUSEL_CARDS} cards.`
        );
        break;
      }

      carousel.cards.forEach((card, index) => {
        const cardComponents = Array.isArray(card.components) ? card.components : [];
        const cardHeader = getComponent(cardComponents, 'HEADER');
        const cardBody = getComponent(cardComponents, 'BODY');
        const cardFooter = getComponent(cardComponents, 'FOOTER');
        const cardButtons = getComponent(cardComponents, 'BUTTONS')?.buttons;
        const baseField = `components.carousel.cards.${index}`;

        validateHeader(cardHeader, `${baseField}.header`, errors);
        validateStandardBody(cardBody, `${baseField}.body`, errors);
        validateStandardFooter(cardFooter, `${baseField}.footer`, errors);
        validateButtons(cardButtons, {
          allowedTypes: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'],
          maxButtons: MAX_CAROUSEL_BUTTONS,
        }, `${baseField}.buttons`, errors);
      });
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
  const status = String(template.status || '').toLowerCase();
  const actions = new Set(['view', 'delete']);

  if (status === 'draft' || status === 'rejected') {
    actions.add('edit');
    actions.add('publish');
  }

  if (template.waba_id) {
    actions.add('sync');
  }

  return Array.from(actions);
}

module.exports = {
  assertTemplateBusinessRules,
  getTemplateAvailableActions,
};
