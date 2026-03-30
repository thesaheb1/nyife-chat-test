'use strict';

const VARIABLE_TOKEN_REGEX = /\{\{(\d+)\}\}/g;

function normalizeComponentType(type) {
  return typeof type === 'string' ? type.trim().toUpperCase() : '';
}

function normalizeText(value) {
  return typeof value === 'string' ? value : '';
}

function describePlaceholders(text) {
  const matches = Array.from(normalizeText(text).matchAll(VARIABLE_TOKEN_REGEX));
  const numbers = matches
    .map((match) => Number(match[1] || 0))
    .filter((value) => Number.isInteger(value) && value > 0);
  const uniqueNumbers = [...new Set(numbers)].sort((left, right) => left - right);
  const expected = uniqueNumbers.length
    ? Array.from({ length: uniqueNumbers[uniqueNumbers.length - 1] }, (_, index) => index + 1)
    : [];
  const isSequential =
    uniqueNumbers.length === expected.length
    && uniqueNumbers.every((value, index) => value === expected[index]);

  return {
    numbers,
    uniqueNumbers,
    count: uniqueNumbers.length,
    isSequential,
  };
}

/**
 * Resolves a nested value from an object using a dot-separated path.
 *
 * @param {object} obj - The source object
 * @param {string} path - Dot-separated path (e.g., 'name', 'custom_fields.city')
 * @returns {*} The value at the path, or undefined if not found
 */
function getNestedValue(obj, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => current?.[key], obj);
}

function resolveDynamicSource(contact, source) {
  switch (String(source || '').trim()) {
    case 'full_name':
      return contact?.name || contact?.whatsapp_name || '';
    case 'email':
      return contact?.email || '';
    case 'phone':
      return contact?.phone || contact?.phone_number || contact?.wa_id || '';
    default:
      return '';
  }
}

function resolveVariableBinding(contact, binding) {
  if (typeof binding === 'string') {
    return getNestedValue(contact, binding);
  }

  if (!binding || typeof binding !== 'object') {
    return '';
  }

  if (binding.mode === 'static') {
    return binding.value ?? '';
  }

  if (binding.mode === 'dynamic') {
    return resolveDynamicSource(contact, binding.source);
  }

  return '';
}

/**
 * Resolves template variables for a specific contact using the variables mapping.
 * Supports legacy string path mappings and structured static/dynamic bindings.
 *
 * @param {object} contact - The contact object with fields
 * @param {object} variablesMapping - Map of placeholder key to binding
 * @returns {object} Resolved variables keyed by placeholder key
 */
function resolveVariables(contact, variablesMapping) {
  const resolved = {};

  for (const [key, binding] of Object.entries(variablesMapping || {})) {
    const value = resolveVariableBinding(contact, binding);
    resolved[key] = value == null ? '' : String(value);

    // Backfill the stable top-level body key for older campaigns that stored "1", "2", etc.
    if (/^\d+$/.test(key) && resolved[`body_${key}`] === undefined) {
      resolved[`body_${key}`] = resolved[key];
    }
  }

  return resolved;
}

function getResolvedValue(resolvedVars, key, fallbackKeys = []) {
  if (Object.prototype.hasOwnProperty.call(resolvedVars || {}, key)) {
    return String(resolvedVars[key] ?? '');
  }

  for (const fallbackKey of fallbackKeys) {
    if (Object.prototype.hasOwnProperty.call(resolvedVars || {}, fallbackKey)) {
      return String(resolvedVars[fallbackKey] ?? '');
    }
  }

  return '';
}

function buildTextParameters(text, resolvedVars, keyBuilder, fallbackKeyBuilder = null) {
  const { count } = describePlaceholders(text);

  return Array.from({ length: count }, (_, index) => {
    const placeholderIndex = index + 1;
    const key = keyBuilder(placeholderIndex);
    const fallbackKeys = fallbackKeyBuilder ? [fallbackKeyBuilder(placeholderIndex)] : [];

    return {
      type: 'text',
      text: getResolvedValue(resolvedVars, key, fallbackKeys),
    };
  });
}

function buildUrlButtonComponents(buttons, resolvedVars, keyBuilder) {
  const components = [];

  (Array.isArray(buttons) ? buttons : []).forEach((button, buttonIndex) => {
    if (normalizeComponentType(button?.type) !== 'URL') {
      return;
    }

    if (!describePlaceholders(button?.url).count) {
      return;
    }

    components.push({
      type: 'button',
      sub_type: 'url',
      index: String(buttonIndex),
      parameters: [
        {
          type: 'text',
          text: getResolvedValue(resolvedVars, keyBuilder(buttonIndex)),
        },
      ],
    });
  });

  return components;
}

function buildCarouselCards(templateCards, resolvedVars) {
  return (Array.isArray(templateCards) ? templateCards : []).map((card, cardIndex) => {
    const cardComponents = [];

    for (const component of card?.components || []) {
      const componentType = normalizeComponentType(component?.type);

      if (componentType === 'BODY') {
        const bodyParameters = buildTextParameters(
          component?.text,
          resolvedVars,
          (placeholderIndex) => `card_${cardIndex}_body_${placeholderIndex}`
        );

        if (bodyParameters.length > 0) {
          cardComponents.push({
            type: 'body',
            parameters: bodyParameters,
          });
        }
      }

      if (componentType === 'BUTTONS') {
        cardComponents.push(
          ...buildUrlButtonComponents(
            component?.buttons,
            resolvedVars,
            (buttonIndex) => `card_${cardIndex}_button_url_${buttonIndex}`
          )
        );
      }
    }

    return {
      card_index: cardIndex,
      components: cardComponents,
    };
  }).filter((card) => card.components.length > 0);
}

/**
 * Builds the Meta API components array from a template definition and resolved variables.
 * Supports top-level header/body parameters, URL buttons, and carousel card body/URL parameters.
 *
 * @param {object} template - Template object with a `components` array
 * @param {object} resolvedVars - Resolved variables keyed by stable placeholder keys
 * @returns {Array} Components array ready for Meta API
 */
function buildTemplateComponents(template, resolvedVars) {
  const components = [];
  const templateComponents = Array.isArray(template?.components) ? template.components : [];

  const headerDef = templateComponents.find((component) => normalizeComponentType(component?.type) === 'HEADER');
  if (headerDef && normalizeComponentType(headerDef.format) === 'TEXT') {
    const headerParameters = buildTextParameters(
      headerDef?.text,
      resolvedVars,
      (placeholderIndex) => `header_${placeholderIndex}`
    );

    if (headerParameters.length > 0) {
      components.push({
        type: 'header',
        parameters: headerParameters,
      });
    }
  }

  const bodyDef = templateComponents.find((component) => normalizeComponentType(component?.type) === 'BODY');
  if (bodyDef) {
    const bodyParameters = buildTextParameters(
      bodyDef?.text,
      resolvedVars,
      (placeholderIndex) => `body_${placeholderIndex}`,
      (placeholderIndex) => String(placeholderIndex)
    );

    if (bodyParameters.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParameters,
      });
    }
  }

  const buttonsDef = templateComponents.find((component) => normalizeComponentType(component?.type) === 'BUTTONS');
  if (buttonsDef) {
    components.push(
      ...buildUrlButtonComponents(
        buttonsDef?.buttons,
        resolvedVars,
        (buttonIndex) => `button_url_${buttonIndex}`
      )
    );
  }

  const carouselDef = templateComponents.find((component) => normalizeComponentType(component?.type) === 'CAROUSEL');
  if (carouselDef) {
    const cards = buildCarouselCards(carouselDef?.cards, resolvedVars);
    if (cards.length > 0) {
      components.push({
        type: 'carousel',
        cards,
      });
    }
  }

  return components;
}

module.exports = {
  getNestedValue,
  describePlaceholders,
  resolveVariableBinding,
  resolveVariables,
  buildTemplateComponents,
};
