'use strict';

/**
 * Resolves a nested value from an object using a dot-separated path.
 *
 * @param {object} obj - The source object
 * @param {string} path - Dot-separated path (e.g., 'name', 'address.city')
 * @returns {*} The value at the path, or undefined if not found
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Resolves template variables for a specific contact using the variables mapping.
 * The variables_mapping maps template placeholder indices (e.g., "1", "2", "header_1")
 * to contact field paths (e.g., "name", "phone", "metadata.city").
 *
 * @param {object} contact - The contact object with fields
 * @param {object} variablesMapping - Map of placeholder index to contact field path
 * @returns {object} Resolved variables keyed by placeholder index
 */
function resolveVariables(contact, variablesMapping) {
  const resolved = {};
  for (const [index, fieldPath] of Object.entries(variablesMapping || {})) {
    resolved[index] = String(getNestedValue(contact, fieldPath) || '');
  }
  return resolved;
}

/**
 * Builds the Meta API components array from a template definition and resolved variables.
 * This produces the format needed for the WhatsApp Cloud API template message endpoint.
 *
 * @param {object} template - Template object with a `components` array
 * @param {object} resolvedVars - Resolved variables keyed by placeholder index
 * @returns {Array} Components array ready for Meta API
 */
function buildTemplateComponents(template, resolvedVars) {
  const components = [];
  const templateComponents = template.components || [];

  // Header variables
  const headerDef = templateComponents.find((c) => c.type === 'HEADER');
  if (headerDef && headerDef.format === 'TEXT' && resolvedVars.header_1) {
    components.push({
      type: 'header',
      parameters: [{ type: 'text', text: resolvedVars.header_1 }],
    });
  }

  // Body variables - collect all body_N keys in order (e.g., "1", "2", "3", ...)
  const bodyParams = [];
  let bodyIdx = 1;
  while (resolvedVars[String(bodyIdx)] !== undefined) {
    bodyParams.push({ type: 'text', text: resolvedVars[String(bodyIdx)] });
    bodyIdx++;
  }
  if (bodyParams.length > 0) {
    components.push({ type: 'body', parameters: bodyParams });
  }

  return components;
}

module.exports = { getNestedValue, resolveVariables, buildTemplateComponents };
