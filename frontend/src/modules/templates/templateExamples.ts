const VARIABLE_TOKEN_REGEX = /\{\{(\d+)\}\}/g;

function trimValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeTemplateExampleValues(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => trimValue(item));
  }

  const singleValue = trimValue(value);
  return singleValue ? [singleValue] : [];
}

export function describeTemplateVariables(text: string) {
  const matches = Array.from((text || '').matchAll(VARIABLE_TOKEN_REGEX));
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

export function syncTemplateExampleValues(values: string[] | undefined, count: number) {
  const normalized = normalizeTemplateExampleValues(values);
  return Array.from({ length: count }, (_, index) => normalized[index] || '');
}

export function buildHeaderTextExample(text: string, values: string[]) {
  return describeTemplateVariables(text).count
    ? normalizeTemplateExampleValues(values).filter(Boolean)
    : undefined;
}

export function buildBodyTextExample(text: string, values: string[]) {
  const normalized = normalizeTemplateExampleValues(values).filter(Boolean);
  return describeTemplateVariables(text).count && normalized.length ? [normalized] : undefined;
}

export function readHeaderTextExamples(component: {
  example?: { header_text?: string[] };
} | null | undefined) {
  return normalizeTemplateExampleValues(component?.example?.header_text);
}

export function readBodyTextExamples(component: {
  example?: { body_text?: string[][] };
} | null | undefined) {
  return normalizeTemplateExampleValues(component?.example?.body_text?.[0]);
}

export function readButtonExampleValues(button: {
  example?: string | string[];
} | null | undefined) {
  return normalizeTemplateExampleValues(button?.example);
}

export function validateTemplateVariableExamples(text: string, values: string[], label: string) {
  const variables = describeTemplateVariables(text);
  if (!variables.count) {
    return null;
  }

  if (!variables.isSequential) {
    return `${label} variables must be numbered sequentially without gaps, starting at {{1}}.`;
  }

  const normalizedValues = normalizeTemplateExampleValues(values);
  if (normalizedValues.length !== variables.count || normalizedValues.some((value) => !value)) {
    return `${label} uses ${variables.count} variable(s), so provide ${variables.count} non-empty sample value(s).`;
  }

  return null;
}
