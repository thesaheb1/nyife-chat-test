'use strict';

const { describePlaceholders } = require('./variableResolver');

function normalizeComponentType(type) {
  return typeof type === 'string' ? type.trim().toUpperCase() : '';
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildVariableRequirementsFromText(text, keyBuilder, labelBuilder, hint) {
  const { count } = describePlaceholders(text);

  return Array.from({ length: count }, (_, index) => {
    const placeholderIndex = index + 1;

    return {
      key: keyBuilder(placeholderIndex),
      label: labelBuilder(placeholderIndex),
      hint,
    };
  });
}

function buildMediaRequirement(key, label, hint, format) {
  return {
    key,
    label,
    hint,
    format,
    media_type: String(format || '').trim().toLowerCase(),
  };
}

function buildLocationRequirement(key, label, hint) {
  return {
    key,
    label,
    hint,
  };
}

function buildProductRequirement(key, label, hint) {
  return {
    key,
    label,
    hint,
  };
}

function templateRequiresCatalogSupport(template) {
  const components = Array.isArray(template?.components) ? template.components : [];

  return components.some((component) => {
    const componentType = normalizeComponentType(component?.type);
    const componentFormat = normalizeComponentType(component?.format);

    if (componentType === 'HEADER' && componentFormat === 'PRODUCT') {
      return true;
    }

    if (componentType === 'BUTTONS') {
      return (Array.isArray(component?.buttons) ? component.buttons : []).some((button) =>
        ['CATALOG', 'MPM', 'SPM'].includes(normalizeComponentType(button?.type))
      );
    }

    if (componentType === 'CAROUSEL') {
      const cards = Array.isArray(component?.cards) ? component.cards : [];

      return cards.some((card) =>
        (Array.isArray(card?.components) ? card.components : []).some((cardComponent) => {
          const cardComponentType = normalizeComponentType(cardComponent?.type);
          const cardFormat = normalizeComponentType(cardComponent?.format);

          if (cardComponentType === 'HEADER' && cardFormat === 'PRODUCT') {
            return true;
          }

          if (cardComponentType === 'BUTTONS') {
            return (Array.isArray(cardComponent?.buttons) ? cardComponent.buttons : []).some((button) =>
              ['CATALOG', 'MPM', 'SPM'].includes(normalizeComponentType(button?.type))
            );
          }

          return false;
        })
      );
    }

    return false;
  });
}

function extractTemplateBindingRequirements(template) {
  const components = Array.isArray(template?.components) ? template.components : [];
  const variables = [];
  const media = [];
  const locations = [];
  const products = [];

  components.forEach((component) => {
    const componentType = normalizeComponentType(component?.type);
    const componentFormat = normalizeComponentType(component?.format);

    if (componentType === 'HEADER') {
      if (componentFormat === 'TEXT') {
        variables.push(
          ...buildVariableRequirementsFromText(
            normalizeText(component?.text),
            (index) => `header_${index}`,
            (index) => `Header variable ${index}`,
            'WhatsApp template header'
          )
        );
      } else if (componentFormat === 'PRODUCT') {
        products.push(
          buildProductRequirement(
            'header_product',
            'Header product',
            'Top-level template product header'
          )
        );
      } else if (componentFormat === 'LOCATION') {
        locations.push(
          buildLocationRequirement(
            'header_location',
            'Header location',
            'Top-level template location header'
          )
        );
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(componentFormat)) {
        media.push(
          buildMediaRequirement(
            'header_media',
            'Header media',
            'Top-level template media header',
            componentFormat
          )
        );
      }
    }

    if (componentType === 'BODY') {
      variables.push(
        ...buildVariableRequirementsFromText(
          normalizeText(component?.text),
          (index) => `body_${index}`,
          (index) => `Body variable ${index}`,
          'WhatsApp template body'
        )
      );
    }

    if (componentType === 'BUTTONS') {
      const buttons = Array.isArray(component?.buttons) ? component.buttons : [];

      buttons.forEach((button, buttonIndex) => {
        if (normalizeComponentType(button?.type) !== 'URL') {
          return;
        }

        if (!describePlaceholders(normalizeText(button?.url)).count) {
          return;
        }

        variables.push({
          key: `button_url_${buttonIndex}`,
          label: `Button ${buttonIndex + 1} URL variable`,
          hint: 'Top-level URL button',
        });
      });
    }

    if (componentType === 'CAROUSEL') {
      const cards = Array.isArray(component?.cards) ? component.cards : [];

      cards.forEach((card, cardIndex) => {
        const cardComponents = Array.isArray(card?.components) ? card.components : [];

        cardComponents.forEach((cardComponent) => {
          const cardComponentType = normalizeComponentType(cardComponent?.type);
          const cardFormat = normalizeComponentType(cardComponent?.format);

          if (cardComponentType === 'HEADER') {
            if (['IMAGE', 'VIDEO'].includes(cardFormat)) {
              media.push(
                buildMediaRequirement(
                  `card_${cardIndex}_header_media`,
                  `Card ${cardIndex + 1} media`,
                  `Carousel card ${cardIndex + 1} media header`,
                  cardFormat
                )
              );
            } else if (cardFormat === 'PRODUCT') {
              products.push(
                buildProductRequirement(
                  `card_${cardIndex}_header_product`,
                  `Card ${cardIndex + 1} product`,
                  `Carousel card ${cardIndex + 1} product header`
                )
              );
            }
          }

          if (cardComponentType === 'BODY') {
            variables.push(
              ...buildVariableRequirementsFromText(
                normalizeText(cardComponent?.text),
                (index) => `card_${cardIndex}_body_${index}`,
                (index) => `Card ${cardIndex + 1} body variable ${index}`,
                `Carousel card ${cardIndex + 1} body`
              )
            );
          }

          if (cardComponentType === 'BUTTONS') {
            const buttons = Array.isArray(cardComponent?.buttons) ? cardComponent.buttons : [];

            buttons.forEach((button, buttonIndex) => {
              if (normalizeComponentType(button?.type) !== 'URL') {
                return;
              }

              if (!describePlaceholders(normalizeText(button?.url)).count) {
                return;
              }

              variables.push({
                key: `card_${cardIndex}_button_url_${buttonIndex}`,
                label: `Card ${cardIndex + 1} button ${buttonIndex + 1} URL variable`,
                hint: `Carousel card ${cardIndex + 1} URL button`,
              });
            });
          }
        });
      });
    }
  });

  return {
    variables,
    media,
    locations,
    products,
    requires_catalog_support: templateRequiresCatalogSupport(template),
  };
}

function normalizeVariableBindings(bindings) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(bindings).filter(([key]) => typeof key === 'string' && key.trim().length > 0)
  );
}

function normalizeMediaBindings(bindings) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(bindings).filter(([key, value]) => {
      if (typeof key !== 'string' || !key.trim()) {
        return false;
      }

      return Boolean(value && typeof value === 'object' && !Array.isArray(value));
    })
  );
}

function normalizeLocationBindings(bindings) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(bindings).flatMap(([key, value]) => {
      if (typeof key !== 'string' || !key.trim() || !value || typeof value !== 'object' || Array.isArray(value)) {
        return [];
      }

      const latitude = Number(value.latitude);
      const longitude = Number(value.longitude);
      const normalized = {
        ...(Number.isFinite(latitude) ? { latitude } : {}),
        ...(Number.isFinite(longitude) ? { longitude } : {}),
        ...(typeof value.name === 'string' && value.name.trim() ? { name: value.name.trim() } : {}),
        ...(typeof value.address === 'string' && value.address.trim() ? { address: value.address.trim() } : {}),
      };

      return [[key, normalized]];
    })
  );
}

function normalizeProductBindings(bindings) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(bindings).flatMap(([key, value]) => {
      if (typeof key !== 'string' || !key.trim() || !value || typeof value !== 'object' || Array.isArray(value)) {
        return [];
      }

      const productRetailerId = typeof value.product_retailer_id === 'string'
        ? value.product_retailer_id.trim()
        : '';

      if (!productRetailerId) {
        return [];
      }

      return [[key, { product_retailer_id: productRetailerId }]];
    })
  );
}

function normalizeStoredTemplateBindings(templateBindings, legacyVariablesMapping = null) {
  const normalizedBindings =
    templateBindings && typeof templateBindings === 'object' && !Array.isArray(templateBindings)
      ? templateBindings
      : {};

  const normalizedVariables = normalizeVariableBindings(
    normalizedBindings.variables && Object.keys(normalizedBindings.variables).length > 0
      ? normalizedBindings.variables
      : legacyVariablesMapping
  );
  const normalizedMedia = normalizeMediaBindings(normalizedBindings.media);
  const normalizedLocations = normalizeLocationBindings(normalizedBindings.locations);
  const normalizedProducts = normalizeProductBindings(normalizedBindings.products);

  return {
    variables: normalizedVariables,
    media: normalizedMedia,
    locations: normalizedLocations,
    products: normalizedProducts,
  };
}

function pruneTemplateBindings(templateBindings, requirements) {
  const normalizedBindings = normalizeStoredTemplateBindings(templateBindings);
  const allowedVariableKeys = new Set((requirements?.variables || []).map((field) => field.key));
  const allowedMediaKeys = new Set((requirements?.media || []).map((field) => field.key));
  const allowedLocationKeys = new Set((requirements?.locations || []).map((field) => field.key));
  const allowedProductKeys = new Set((requirements?.products || []).map((field) => field.key));

  return {
    variables: Object.fromEntries(
      Object.entries(normalizedBindings.variables).filter(([key]) => allowedVariableKeys.has(key))
    ),
    media: Object.fromEntries(
      Object.entries(normalizedBindings.media).filter(([key]) => allowedMediaKeys.has(key))
    ),
    locations: Object.fromEntries(
      Object.entries(normalizedBindings.locations).filter(([key]) => allowedLocationKeys.has(key))
    ),
    products: Object.fromEntries(
      Object.entries(normalizedBindings.products).filter(([key]) => allowedProductKeys.has(key))
    ),
  };
}

function isVariableBindingComplete(binding) {
  if (typeof binding === 'string') {
    return binding.trim().length > 0;
  }

  if (!binding || typeof binding !== 'object') {
    return false;
  }

  if (binding.mode === 'static') {
    return typeof binding.value === 'string' && binding.value.trim().length > 0;
  }

  if (binding.mode === 'dynamic') {
    return ['full_name', 'email', 'phone'].includes(String(binding.source || '').trim());
  }

  return false;
}

function isMediaBindingComplete(binding) {
  return Boolean(
    binding
    && typeof binding === 'object'
    && typeof binding.file_id === 'string'
    && binding.file_id.trim().length > 0
    && typeof binding.original_name === 'string'
    && binding.original_name.trim().length > 0
    && typeof binding.mime_type === 'string'
    && binding.mime_type.trim().length > 0
    && typeof binding.size === 'number'
    && binding.size >= 0
    && ['image', 'video', 'document'].includes(String(binding.media_type || '').trim())
  );
}

function isLocationBindingComplete(binding) {
  return Boolean(
    binding
    && typeof binding === 'object'
    && Number.isFinite(Number(binding.latitude))
    && Number.isFinite(Number(binding.longitude))
  );
}

function isProductBindingComplete(binding) {
  return Boolean(
    binding
    && typeof binding === 'object'
    && typeof binding.product_retailer_id === 'string'
    && binding.product_retailer_id.trim().length > 0
  );
}

function buildPersistedTemplateBindings(templateBindings, legacyVariablesMapping = null) {
  const normalized = normalizeStoredTemplateBindings(templateBindings, legacyVariablesMapping);

  if (
    !Object.keys(normalized.variables).length
    && !Object.keys(normalized.media).length
    && !Object.keys(normalized.locations).length
    && !Object.keys(normalized.products).length
  ) {
    return null;
  }

  return {
    ...(Object.keys(normalized.variables).length ? { variables: normalized.variables } : {}),
    ...(Object.keys(normalized.media).length ? { media: normalized.media } : {}),
    ...(Object.keys(normalized.locations).length ? { locations: normalized.locations } : {}),
    ...(Object.keys(normalized.products).length ? { products: normalized.products } : {}),
  };
}

function buildLegacyVariablesMapping(templateBindings, legacyVariablesMapping = null) {
  const normalized = normalizeStoredTemplateBindings(templateBindings, legacyVariablesMapping);
  return Object.keys(normalized.variables).length ? normalized.variables : null;
}

function validateTemplateBindings(requirements, templateBindings) {
  const normalized = normalizeStoredTemplateBindings(templateBindings);
  const issues = [];

  (requirements?.variables || []).forEach((field) => {
    if (!isVariableBindingComplete(normalized.variables[field.key])) {
      issues.push({
        field: `template_bindings.variables.${field.key}`,
        message: `${field.label} is required.`,
      });
    }
  });

  (requirements?.media || []).forEach((field) => {
    if (!isMediaBindingComplete(normalized.media[field.key])) {
      issues.push({
        field: `template_bindings.media.${field.key}`,
        message: `${field.label} is required.`,
      });
    }
  });

  (requirements?.locations || []).forEach((field) => {
    if (!isLocationBindingComplete(normalized.locations[field.key])) {
      issues.push({
        field: `template_bindings.locations.${field.key}`,
        message: `${field.label} is required.`,
      });
    }
  });

  (requirements?.products || []).forEach((field) => {
    if (!isProductBindingComplete(normalized.products[field.key])) {
      issues.push({
        field: `template_bindings.products.${field.key}`,
        message: `${field.label} is required.`,
      });
    }
  });

  return {
    isComplete: issues.length === 0,
    issues,
  };
}

module.exports = {
  buildLegacyVariablesMapping,
  buildPersistedTemplateBindings,
  extractTemplateBindingRequirements,
  normalizeStoredTemplateBindings,
  pruneTemplateBindings,
  templateRequiresCatalogSupport,
  validateTemplateBindings,
};
