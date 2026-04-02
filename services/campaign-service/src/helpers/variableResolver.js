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

function getResolvedMediaBinding(resolvedMedia, key) {
  if (!resolvedMedia || typeof resolvedMedia !== 'object') {
    return null;
  }

  const binding = resolvedMedia[key];
  if (!binding || typeof binding !== 'object') {
    return null;
  }

  const mediaId = String(binding.id || binding.whatsapp_media_id || '').trim();
  if (!mediaId) {
    return null;
  }

  return {
    id: mediaId,
    media_type: String(binding.media_type || '').trim().toLowerCase(),
    original_name: String(binding.original_name || binding.filename || '').trim(),
  };
}

function getResolvedLocationBinding(resolvedLocations, key) {
  if (!resolvedLocations || typeof resolvedLocations !== 'object') {
    return null;
  }

  const binding = resolvedLocations[key];
  if (!binding || typeof binding !== 'object') {
    return null;
  }

  const latitude = Number(binding.latitude);
  const longitude = Number(binding.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    ...(typeof binding.name === 'string' && binding.name.trim() ? { name: binding.name.trim() } : {}),
    ...(typeof binding.address === 'string' && binding.address.trim() ? { address: binding.address.trim() } : {}),
  };
}

function buildHeaderMediaComponent(format, binding) {
  if (!binding) {
    return null;
  }

  const normalizedFormat = normalizeComponentType(format);
  if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(normalizedFormat)) {
    return null;
  }

  if (normalizedFormat === 'IMAGE') {
    return {
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: { id: binding.id },
        },
      ],
    };
  }

  if (normalizedFormat === 'VIDEO') {
    return {
      type: 'header',
      parameters: [
        {
          type: 'video',
          video: { id: binding.id },
        },
      ],
    };
  }

  const document = { id: binding.id };
  if (binding.original_name) {
    document.filename = binding.original_name;
  }

  return {
    type: 'header',
    parameters: [
      {
        type: 'document',
        document,
      },
    ],
  };
}

function buildHeaderLocationComponent(binding) {
  if (!binding) {
    return null;
  }

  return {
    type: 'header',
    parameters: [
      {
        type: 'location',
        location: {
          latitude: String(binding.latitude),
          longitude: String(binding.longitude),
          ...(binding.name ? { name: binding.name } : {}),
          ...(binding.address ? { address: binding.address } : {}),
        },
      },
    ],
  };
}

function getResolvedProductBinding(resolvedProducts, key) {
  if (!resolvedProducts || typeof resolvedProducts !== 'object') {
    return null;
  }

  const binding = resolvedProducts[key];
  if (!binding || typeof binding !== 'object') {
    return null;
  }

  const productRetailerId = String(binding.product_retailer_id || '').trim();
  if (!productRetailerId) {
    return null;
  }

  return {
    product_retailer_id: productRetailerId,
  };
}

function buildHeaderProductComponent(binding, format) {
  if (!binding) {
    return null;
  }

  if (normalizeComponentType(format) !== 'PRODUCT') {
    return null;
  }

  return {
    type: 'header',
    parameters: [
      {
        type: 'product',
        product: {
          product_retailer_id: binding.product_retailer_id,
        },
      },
    ],
  };
}

function buildCarouselCards(templateCards, resolvedVars, resolvedMedia, resolvedProducts) {
  return (Array.isArray(templateCards) ? templateCards : []).map((card, cardIndex) => {
    const cardComponents = [];
    const templateCardComponents = Array.isArray(card?.components) ? card.components : [];

    for (const component of templateCardComponents) {
      const componentType = normalizeComponentType(component?.type);

      if (componentType === 'HEADER') {
        const headerComponent =
          buildHeaderProductComponent(
            getResolvedProductBinding(resolvedProducts, `card_${cardIndex}_header_product`),
            component?.format
          )
          || buildHeaderMediaComponent(
            component?.format,
            getResolvedMediaBinding(resolvedMedia, `card_${cardIndex}_header_media`)
          );

        if (headerComponent) {
          cardComponents.push(headerComponent);
        }
      }

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
 * Supports top-level header/body parameters, media/location/product headers,
 * and carousel card body/URL/media/product components.
 *
 * @param {object} template - Template object with a `components` array
 * @param {object} resolvedVars - Resolved variables keyed by stable placeholder keys
 * @param {object} resolvedMedia - Resolved media keyed by stable media keys
 * @param {object} resolvedLocations - Resolved locations keyed by stable location keys
 * @param {object} resolvedProducts - Resolved products keyed by stable product keys
 * @returns {Array} Components array ready for Meta API
 */
function buildTemplateComponents(
  template,
  resolvedVars,
  resolvedMedia = {},
  resolvedLocations = {},
  resolvedProducts = {}
) {
  const components = [];
  const templateComponents = Array.isArray(template?.components) ? template.components : [];

  const headerDef = templateComponents.find((component) => normalizeComponentType(component?.type) === 'HEADER');
  if (headerDef) {
    const headerFormat = normalizeComponentType(headerDef.format);

    if (headerFormat === 'TEXT') {
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
    } else {
      const headerProductComponent = buildHeaderProductComponent(
        getResolvedProductBinding(resolvedProducts, 'header_product'),
        headerDef?.format
      );
      const headerLocationComponent = headerFormat === 'LOCATION'
        ? buildHeaderLocationComponent(getResolvedLocationBinding(resolvedLocations, 'header_location'))
        : null;
      const headerMediaComponent = buildHeaderMediaComponent(
        headerDef?.format,
        getResolvedMediaBinding(resolvedMedia, 'header_media')
      );

      if (headerProductComponent) {
        components.push(headerProductComponent);
      } else if (headerLocationComponent) {
        components.push(headerLocationComponent);
      } else if (headerMediaComponent) {
        components.push(headerMediaComponent);
      }
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
    const cards = buildCarouselCards(carouselDef?.cards, resolvedVars, resolvedMedia, resolvedProducts);
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
