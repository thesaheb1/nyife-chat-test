import type { Template } from '@/core/types';
import { normalizeTemplateExampleValues, validateTemplateVariableExamples, validateUrlButtonExamples } from './templateExamples';

export interface TemplatePublishCheck {
  label: string;
  tone: 'ready' | 'warning';
  detail: string;
}

function normalizeComponentType(type: unknown) {
  return typeof type === 'string' ? type.trim().toUpperCase() : '';
}

function hasHeaderMedia(component: Record<string, unknown> | null | undefined) {
  return Boolean(
    (component?.media_asset as { file_id?: string; header_handle?: string } | undefined)?.file_id
    || (component?.media_asset as { file_id?: string; header_handle?: string } | undefined)?.header_handle
    || (component?.example as { header_handle?: string[] } | undefined)?.header_handle?.length
  );
}

function collectMediaHeaderStats(
  components: Array<Record<string, unknown>> | undefined,
  stats: { total: number; missing: number }
) {
  for (const component of components || []) {
    const type = normalizeComponentType(component.type);

    if (type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(normalizeComponentType(component.format))) {
      stats.total += 1;
      if (!hasHeaderMedia(component)) {
        stats.missing += 1;
      }
    }

    if (type === 'CAROUSEL') {
      for (const card of (component.cards as Array<{ components?: Array<Record<string, unknown>> }> | undefined) || []) {
        collectMediaHeaderStats(card.components, stats);
      }
    }
  }
}

function collectVariableWarnings(components: Array<Record<string, unknown>> | undefined, warnings: string[]) {
  for (const component of components || []) {
    const type = normalizeComponentType(component.type);
    const text = typeof component.text === 'string' ? component.text : '';

    if (type === 'HEADER' && normalizeComponentType(component.format) === 'TEXT') {
      const message = validateTemplateVariableExamples(
        text,
        normalizeTemplateExampleValues((component.example as { header_text?: string[] } | undefined)?.header_text),
        'Header text'
      );
      if (message) {
        warnings.push(message);
      }
    }

    if (type === 'BODY') {
      const message = validateTemplateVariableExamples(
        text,
        normalizeTemplateExampleValues((component.example as { body_text?: string[][] } | undefined)?.body_text?.[0]),
        'Body text'
      );
      if (message) {
        warnings.push(message);
      }
    }

    if (type === 'BUTTONS') {
      for (const button of (component.buttons as Array<Record<string, unknown>> | undefined) || []) {
        if (normalizeComponentType(button.type) !== 'URL' || typeof button.url !== 'string') {
          continue;
        }

        const message = validateUrlButtonExamples(
          button.url,
          normalizeTemplateExampleValues(button.example),
          'URL button'
        );
        if (message) {
          warnings.push(message);
        }
      }
    }

    if (type === 'CAROUSEL') {
      for (const card of (component.cards as Array<{ components?: Array<Record<string, unknown>> }> | undefined) || []) {
        collectVariableWarnings(card.components, warnings);
      }
    }
  }
}

export function getTemplatePublishPreflight(template: Template | null | undefined): TemplatePublishCheck[] {
  if (!template) {
    return [];
  }

  const components = (template.components as Array<Record<string, unknown>> | undefined) || [];
  const checks: TemplatePublishCheck[] = [
    {
      label: 'Lifecycle',
      tone: 'ready',
      detail: 'Nyife publish will create the template on Meta and submit it for review immediately.',
    },
    {
      label: 'Routing',
      tone: 'ready',
      detail: 'Nyife will route this through the organization’s single active WhatsApp account/WABA.',
    },
    {
      label: 'Category',
      tone: 'ready',
      detail: 'Meta can auto-adjust the template category during review if needed.',
    },
  ];

  if (String(template.type || '').toLowerCase() === 'carousel') {
    const carousel = components.find((component) => normalizeComponentType(component.type) === 'CAROUSEL') as { cards?: unknown[] } | undefined;
    const cardCount = Array.isArray(carousel?.cards) ? carousel.cards.length : 0;
    checks.push({
      label: 'Card count',
      tone: cardCount >= 2 && cardCount <= 10 ? 'ready' : 'warning',
      detail: cardCount >= 2 && cardCount <= 10
        ? `Meta will lock this carousel to ${cardCount} card${cardCount === 1 ? '' : 's'} after approval.`
        : 'Carousel templates must define between 2 and 10 cards before publish.',
    });
  }

  const mediaHeaderStats = { total: 0, missing: 0 };
  collectMediaHeaderStats(components, mediaHeaderStats);
  if (mediaHeaderStats.total) {
    checks.push({
      label: 'Media samples',
      tone: mediaHeaderStats.missing ? 'warning' : 'ready',
      detail: mediaHeaderStats.missing
        ? 'One or more media headers are missing a sample file for Meta review.'
        : `${mediaHeaderStats.total} media header sample${mediaHeaderStats.total === 1 ? '' : 's'} ready for Meta upload.`,
    });
  }

  const variableWarnings: string[] = [];
  collectVariableWarnings(components, variableWarnings);
  checks.push({
    label: 'Variable samples',
    tone: variableWarnings.length ? 'warning' : 'ready',
    detail: variableWarnings.length
      ? variableWarnings[0]
      : 'All detected template variables have matching sample values.',
  });

  return checks;
}
