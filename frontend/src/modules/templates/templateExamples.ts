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
    occurrences: numbers,
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

function hasSupportedUrlButtonVariable(url: string) {
  const normalizedUrl = trimValue(url);
  const variables = describeTemplateVariables(normalizedUrl);

  if (!variables.count) {
    return false;
  }

  return variables.count === 1
    && variables.occurrences.length === 1
    && variables.isSequential
    && normalizedUrl.endsWith('{{1}}');
}

function isValidAbsoluteUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildUrlButtonExample(url: string, values: string[]) {
  if (!hasSupportedUrlButtonVariable(url)) {
    return undefined;
  }

  const normalized = normalizeTemplateExampleValues(values).filter(Boolean);
  return normalized.length ? [normalized[0]] : undefined;
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

export function validateUrlButtonExamples(url: string, values: string[], label = 'URL button') {
  const normalizedUrl = trimValue(url);
  const variables = describeTemplateVariables(normalizedUrl);
  const hasTrailingVariable = hasSupportedUrlButtonVariable(normalizedUrl);

  if (variables.count && !hasTrailingVariable) {
    return `${label} supports only one variable, and it must be appended to the end of the URL as {{1}}.`;
  }

  const urlToValidate = hasTrailingVariable
    ? normalizedUrl.slice(0, -'{{1}}'.length)
    : normalizedUrl;

  if (urlToValidate && !isValidAbsoluteUrl(urlToValidate)) {
    return `${label} must be a valid absolute URL.`;
  }

  if (!hasTrailingVariable) {
    return null;
  }

  const normalizedValues = normalizeTemplateExampleValues(values);
  if (normalizedValues.length !== 1 || !normalizedValues[0]) {
    return `${label} uses 1 variable, so provide 1 non-empty sample value.`;
  }

  return null;
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
