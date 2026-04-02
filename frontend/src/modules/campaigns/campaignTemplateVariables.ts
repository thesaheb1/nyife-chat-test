import type {
  CampaignLocationBinding,
  CampaignMediaBinding,
  CampaignProductBinding,
  Template,
} from '@/core/types';
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

export interface CampaignMediaField {
  key: string;
  label: string;
  hint: string;
  format: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  mediaType: CampaignMediaBinding['media_type'];
}

export interface CampaignLocationField {
  key: string;
  label: string;
  hint: string;
}

export interface CampaignProductField {
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

function buildMediaField(
  key: string,
  label: string,
  hint: string,
  format: 'IMAGE' | 'VIDEO' | 'DOCUMENT'
): CampaignMediaField {
  return {
    key,
    label,
    hint,
    format,
    mediaType: format.toLowerCase() as CampaignMediaBinding['media_type'],
  };
}

function buildProductField(key: string, label: string, hint: string): CampaignProductField {
  return {
    key,
    label,
    hint,
  };
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

export function extractCampaignTemplateMediaFields(template: Template | null | undefined): CampaignMediaField[] {
  if (!template) {
    return [];
  }

  const components = Array.isArray(template.components)
    ? template.components as Array<Record<string, unknown>>
    : [];
  const fields: CampaignMediaField[] = [];

  components.forEach((component) => {
    const componentType = normalizeComponentType(component.type);
    const componentFormat = normalizeComponentType(component.format);

    if (componentType === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(componentFormat)) {
      fields.push(
        buildMediaField(
          'header_media',
          'Header media',
          'Top-level template media header',
          componentFormat as CampaignMediaField['format']
        )
      );
    }

    if (componentType === 'CAROUSEL') {
      const cards = Array.isArray(component.cards)
        ? component.cards as Array<{ components?: Array<Record<string, unknown>> }>
        : [];

      cards.forEach((card, cardIndex) => {
        (card.components || []).forEach((cardComponent) => {
          const cardComponentType = normalizeComponentType(cardComponent.type);
          const cardFormat = normalizeComponentType(cardComponent.format);

          if (cardComponentType === 'HEADER' && ['IMAGE', 'VIDEO'].includes(cardFormat)) {
            fields.push(
              buildMediaField(
                `card_${cardIndex}_header_media`,
                `Card ${cardIndex + 1} media`,
                `Carousel card ${cardIndex + 1} media header`,
                cardFormat as CampaignMediaField['format']
              )
            );
          }
        });
      });
    }
  });

  return fields;
}

export function extractCampaignTemplateLocationFields(template: Template | null | undefined): CampaignLocationField[] {
  if (!template) {
    return [];
  }

  const components = Array.isArray(template.components)
    ? template.components as Array<Record<string, unknown>>
    : [];

  return components.flatMap((component) => {
    if (
      normalizeComponentType(component.type) === 'HEADER'
      && normalizeComponentType(component.format) === 'LOCATION'
    ) {
      return [{
        key: 'header_location',
        label: 'Header location',
        hint: 'Top-level template location header',
      }];
    }

    return [];
  });
}

export function extractCampaignTemplateProductFields(template: Template | null | undefined): CampaignProductField[] {
  if (!template) {
    return [];
  }

  const components = Array.isArray(template.components)
    ? template.components as Array<Record<string, unknown>>
    : [];
  const fields: CampaignProductField[] = [];

  components.forEach((component) => {
    const componentType = normalizeComponentType(component.type);
    const componentFormat = normalizeComponentType(component.format);

    if (componentType === 'HEADER' && componentFormat === 'PRODUCT') {
      fields.push(
        buildProductField(
          'header_product',
          'Header product',
          'Top-level template product header'
        )
      );
    }

    if (componentType === 'CAROUSEL') {
      const cards = Array.isArray(component.cards)
        ? component.cards as Array<{ components?: Array<Record<string, unknown>> }>
        : [];

      cards.forEach((card, cardIndex) => {
        (card.components || []).forEach((cardComponent) => {
          if (
            normalizeComponentType(cardComponent.type) === 'HEADER'
            && normalizeComponentType(cardComponent.format) === 'PRODUCT'
          ) {
            fields.push(
              buildProductField(
                `card_${cardIndex}_header_product`,
                `Card ${cardIndex + 1} product`,
                `Carousel card ${cardIndex + 1} product header`
              )
            );
          }
        });
      });
    }
  });

  return fields;
}

export function templateRequiresCatalogSupport(template: Template | null | undefined) {
  if (!template) {
    return false;
  }

  const components = Array.isArray(template.components)
    ? template.components as Array<Record<string, unknown>>
    : [];

  return components.some((component) => {
    const componentType = normalizeComponentType(component.type);
    const componentFormat = normalizeComponentType(component.format);

    if (componentType === 'HEADER' && componentFormat === 'PRODUCT') {
      return true;
    }

    if (componentType === 'BUTTONS') {
      const buttons = Array.isArray(component.buttons)
        ? component.buttons as Array<Record<string, unknown>>
        : [];

      return buttons.some((button) => ['CATALOG', 'MPM', 'SPM'].includes(normalizeComponentType(button.type)));
    }

    if (componentType === 'CAROUSEL') {
      const cards = Array.isArray(component.cards)
        ? component.cards as Array<{ components?: Array<Record<string, unknown>> }>
        : [];

      return cards.some((card) =>
        (card.components || []).some((cardComponent) => {
          const cardComponentType = normalizeComponentType(cardComponent.type);
          const cardFormat = normalizeComponentType(cardComponent.format);

          if (cardComponentType === 'HEADER' && cardFormat === 'PRODUCT') {
            return true;
          }

          if (cardComponentType === 'BUTTONS') {
            const buttons = Array.isArray(cardComponent.buttons)
              ? cardComponent.buttons as Array<Record<string, unknown>>
              : [];

            return buttons.some((button) => ['CATALOG', 'MPM', 'SPM'].includes(normalizeComponentType(button.type)));
          }

          return false;
        })
      );
    }

    return false;
  });
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

export function pruneCampaignMediaBindings(
  bindings: Record<string, CampaignMediaBinding> | undefined,
  fields: CampaignMediaField[]
) {
  if (!bindings) {
    return {};
  }

  const allowedKeys = new Set(fields.map((field) => field.key));
  return Object.fromEntries(
    Object.entries(bindings).filter(([key]) => allowedKeys.has(key))
  );
}

export function areCampaignMediaBindingsComplete(
  fields: CampaignMediaField[],
  bindings: Record<string, CampaignMediaBinding> | undefined
) {
  return fields.every((field) => {
    const binding = bindings?.[field.key];
    return Boolean(
      binding
      && typeof binding.file_id === 'string'
      && binding.file_id.trim().length > 0
      && binding.media_type === field.mediaType
      && typeof binding.original_name === 'string'
      && binding.original_name.trim().length > 0
      && typeof binding.mime_type === 'string'
      && binding.mime_type.trim().length > 0
      && typeof binding.size === 'number'
      && binding.size >= 0
    );
  });
}

export function pruneCampaignLocationBindings(
  bindings: Record<string, CampaignLocationBinding> | undefined,
  fields: CampaignLocationField[]
) {
  if (!bindings) {
    return {};
  }

  const allowedKeys = new Set(fields.map((field) => field.key));
  return Object.fromEntries(
    Object.entries(bindings).filter(([key]) => allowedKeys.has(key))
  );
}

export function areCampaignLocationBindingsComplete(
  fields: CampaignLocationField[],
  bindings: Record<string, CampaignLocationBinding> | undefined
) {
  return fields.every((field) => {
    const binding = bindings?.[field.key];
    return Boolean(
      binding
      && typeof binding.latitude === 'number'
      && Number.isFinite(binding.latitude)
      && typeof binding.longitude === 'number'
      && Number.isFinite(binding.longitude)
    );
  });
}

export function pruneCampaignProductBindings(
  bindings: Record<string, CampaignProductBinding> | undefined,
  fields: CampaignProductField[]
) {
  if (!bindings) {
    return {};
  }

  const allowedKeys = new Set(fields.map((field) => field.key));
  return Object.fromEntries(
    Object.entries(bindings).filter(([key]) => allowedKeys.has(key))
  );
}

export function areCampaignProductBindingsComplete(
  fields: CampaignProductField[],
  bindings: Record<string, CampaignProductBinding> | undefined
) {
  return fields.every((field) => {
    const binding = bindings?.[field.key];
    return Boolean(
      binding
      && typeof binding.product_retailer_id === 'string'
      && binding.product_retailer_id.trim().length > 0
    );
  });
}
