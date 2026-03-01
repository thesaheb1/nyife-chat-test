'use strict';

/**
 * Replaces all {{variableName}} placeholders in a template string with values from the data object.
 * If a variable is not found in data, it is replaced with an empty string.
 *
 * @param {string} templateString - The template string containing {{variable}} placeholders
 * @param {object} data - Key-value pairs for variable substitution
 * @returns {string} The rendered string with all placeholders resolved
 */
function renderTemplate(templateString, data) {
  if (!templateString) {
    return '';
  }

  const safeData = data || {};

  return templateString.replace(/\{\{(\w+)\}\}/g, (_match, variableName) => {
    const value = safeData[variableName];
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  });
}

/**
 * Takes an EmailTemplate record and a data object, and renders the subject, HTML body,
 * and text body with all variables resolved.
 *
 * @param {object} template - An EmailTemplate record with subject, html_body, and text_body fields
 * @param {object} data - Key-value pairs for variable substitution
 * @returns {{ subject: string, html: string, text: string }} Rendered email content
 */
function renderEmailFromTemplate(template, data) {
  const safeData = data || {};

  return {
    subject: renderTemplate(template.subject, safeData),
    html: renderTemplate(template.html_body, safeData),
    text: renderTemplate(template.text_body, safeData),
  };
}

module.exports = {
  renderTemplate,
  renderEmailFromTemplate,
};
