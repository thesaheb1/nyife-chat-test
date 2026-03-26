'use strict';

const PLACEHOLDER_REGEX = /\{\{(\d+)\}\}/g;

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeExampleValues(value) {
  if (Array.isArray(value)) {
    return value.map((item) => trimString(item));
  }

  const singleValue = trimString(value);
  return singleValue ? [singleValue] : [];
}

function extractPlaceholderNumbers(text) {
  const input = trimString(text);
  if (!input) {
    return [];
  }

  return Array.from(input.matchAll(PLACEHOLDER_REGEX))
    .map((match) => Number(match[1] || 0))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function describePlaceholders(text) {
  const occurrences = extractPlaceholderNumbers(text);
  const uniqueNumbers = [...new Set(occurrences)].sort((left, right) => left - right);
  const expectedNumbers = uniqueNumbers.length
    ? Array.from({ length: uniqueNumbers[uniqueNumbers.length - 1] }, (_, index) => index + 1)
    : [];
  const isSequential =
    uniqueNumbers.length === expectedNumbers.length
    && uniqueNumbers.every((value, index) => value === expectedNumbers[index]);

  return {
    occurrences,
    uniqueNumbers,
    count: uniqueNumbers.length,
    isSequential,
  };
}

function readHeaderTextExamples(component) {
  return normalizeExampleValues(component?.example?.header_text);
}

function readBodyTextExamples(component) {
  if (Array.isArray(component?.example?.body_text) && Array.isArray(component.example.body_text[0])) {
    return normalizeExampleValues(component.example.body_text[0]);
  }

  return [];
}

function readButtonExampleValues(button) {
  return normalizeExampleValues(button?.example);
}

function buildHeaderTextExample(headerText, exampleValues) {
  const placeholders = describePlaceholders(headerText);
  if (!placeholders.count) {
    return undefined;
  }

  const normalizedValues = normalizeExampleValues(exampleValues);
  return normalizedValues.length ? normalizedValues : undefined;
}

function buildBodyTextExample(bodyText, exampleValues) {
  const placeholders = describePlaceholders(bodyText);
  if (!placeholders.count) {
    return undefined;
  }

  const normalizedValues = normalizeExampleValues(exampleValues);
  return normalizedValues.length ? [normalizedValues] : undefined;
}

function validateTextExamples({
  text,
  exampleValues,
  field,
  label,
  errors,
  addError,
}) {
  const placeholders = describePlaceholders(text);
  if (!placeholders.count) {
    return;
  }

  if (!placeholders.isSequential) {
    addError(
      errors,
      field,
      `${label} variables must be numbered sequentially without gaps, starting at {{1}}.`
    );
    return;
  }

  const normalizedValues = normalizeExampleValues(exampleValues);
  if (normalizedValues.length !== placeholders.count || normalizedValues.some((value) => !value)) {
    addError(
      errors,
      field,
      `${label} uses ${placeholders.count} variable(s), so provide ${placeholders.count} non-empty sample value(s).`
    );
  }
}

function validateButtonUrlExamples({
  url,
  exampleValues,
  field,
  errors,
  addError,
}) {
  validateTextExamples({
    text: url,
    exampleValues,
    field,
    label: 'URL button',
    errors,
    addError,
  });
}

module.exports = {
  buildBodyTextExample,
  buildHeaderTextExample,
  describePlaceholders,
  normalizeExampleValues,
  readBodyTextExamples,
  readButtonExampleValues,
  readHeaderTextExamples,
  validateButtonUrlExamples,
  validateTextExamples,
};
