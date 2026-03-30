import type { Template } from '@/core/types';
import { describeTemplateVariables } from '@/modules/templates/templateExamples';

export type CampaignVariableSource = 'full_name' | 'email' | 'phone';

export type CampaignVariableBinding =
  | {
      mode: 'static';
      value: string;
    }
  | {
      mode: 'dynamic';
      source: CampaignVariableSource;
    };

export interface CampaignVariableField {
  key: string;
  label: string;
  hint: string;
}

function normalizeComponentType(type: unknown) {
  return typeof type === 'string' ? type.trim().toUpperCase() : '';
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildFieldsFromText(text: string, keyBuilder: (index: number) => string, labelBuilder: (index: number) => string, hint: string) {
  const { count } = describeTemplateVariables(text);

  return Array.from({ length: count }, (_, index) => ({
    key: keyBuilder(index + 1),
    label: labelBuilder(index + 1),
    hint,
  }));
}

export function extractCampaignTemplateVariables(template: Template | null | undefined): CampaignVariableField[] {
  if (!template) {
    return [];
  }

  const components = Array.isArray(template.components)
    ? template.components as Array<Record<string, unknown>>
    : [];
  const fields: CampaignVariableField[] = [];

  components.forEach((component) => {
    const componentType = normalizeComponentType(component.type);

    if (componentType === 'HEADER' && normalizeComponentType(component.format) === 'TEXT') {
      fields.push(
        ...buildFieldsFromText(
          textValue(component.text),
          (index) => `header_${index}`,
          (index) => `Header variable ${index}`,
          'WhatsApp template header'
        )
      );
    }

    if (componentType === 'BODY') {
      fields.push(
        ...buildFieldsFromText(
          textValue(component.text),
          (index) => `body_${index}`,
          (index) => `Body variable ${index}`,
          'WhatsApp template body'
        )
      );
    }

    if (componentType === 'BUTTONS') {
      const buttons = Array.isArray(component.buttons)
        ? component.buttons as Array<Record<string, unknown>>
        : [];

      buttons.forEach((button, buttonIndex) => {
        if (normalizeComponentType(button.type) !== 'URL') {
          return;
        }

        if (!describeTemplateVariables(textValue(button.url)).count) {
          return;
        }

        fields.push({
          key: `button_url_${buttonIndex}`,
          label: `Button ${buttonIndex + 1} URL variable`,
          hint: 'Top-level URL button',
        });
      });
    }

    if (componentType === 'CAROUSEL') {
      const cards = Array.isArray(component.cards)
        ? component.cards as Array<{ components?: Array<Record<string, unknown>> }>
        : [];

      cards.forEach((card, cardIndex) => {
        (card.components || []).forEach((cardComponent) => {
          const cardComponentType = normalizeComponentType(cardComponent.type);

          if (cardComponentType === 'BODY') {
            fields.push(
              ...buildFieldsFromText(
                textValue(cardComponent.text),
                (index) => `card_${cardIndex}_body_${index}`,
                (index) => `Card ${cardIndex + 1} body variable ${index}`,
                `Carousel card ${cardIndex + 1} body`
              )
            );
          }

          if (cardComponentType === 'BUTTONS') {
            const buttons = Array.isArray(cardComponent.buttons)
              ? cardComponent.buttons as Array<Record<string, unknown>>
              : [];

            buttons.forEach((button, buttonIndex) => {
              if (normalizeComponentType(button.type) !== 'URL') {
                return;
              }

              if (!describeTemplateVariables(textValue(button.url)).count) {
                return;
              }

              fields.push({
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

  return fields;
}

export function pruneCampaignVariableBindings(
  bindings: Record<string, CampaignVariableBinding> | undefined,
  fields: CampaignVariableField[]
) {
  if (!bindings) {
    return {};
  }

  const allowedKeys = new Set(fields.map((field) => field.key));
  return Object.fromEntries(
    Object.entries(bindings).filter(([key]) => allowedKeys.has(key))
  );
}

export function areCampaignVariableBindingsComplete(
  fields: CampaignVariableField[],
  bindings: Record<string, CampaignVariableBinding> | undefined
) {
  return fields.every((field) => {
    const binding = bindings?.[field.key];
    if (!binding) {
      return false;
    }

    if (binding.mode === 'static') {
      return typeof binding.value === 'string' && binding.value.trim().length > 0;
    }

    return binding.mode === 'dynamic' && Boolean(binding.source);
  });
}
