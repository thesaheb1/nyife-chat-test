import type {
  FlowCategory,
  FlowComponent,
  FlowComponentType,
  FlowDefinition,
  FlowOption,
  FlowScreen,
  FlowValidationDetail,
  MetaFlowComponent,
  MetaFlowDefinition,
} from '@/core/types';
import flowContract from '@shared-flow-contract';

export const flowCategories: Array<{ value: FlowCategory; label: string }> = [
  { value: 'SIGN_UP', label: 'Sign up' },
  { value: 'SIGN_IN', label: 'Sign in' },
  { value: 'LEAD_GENERATION', label: 'Lead generation' },
  { value: 'APPOINTMENT_BOOKING', label: 'Appointment booking' },
  { value: 'CONTACT_US', label: 'Contact us' },
  { value: 'CUSTOMER_SUPPORT', label: 'Customer support' },
  { value: 'SURVEY', label: 'Survey' },
  { value: 'OTHER', label: 'Other' },
];

export const flowComponentPalette: Array<{
  type: FlowComponentType;
  label: string;
  description: string;
}> = [
  { type: 'TextHeading', label: 'Heading', description: 'Large title at the top of the screen.' },
  { type: 'TextSubheading', label: 'Subheading', description: 'Short secondary heading.' },
  { type: 'TextBody', label: 'Body text', description: 'Paragraph or helper copy.' },
  { type: 'TextInput', label: 'Text input', description: 'Single-line input field.' },
  { type: 'TextArea', label: 'Text area', description: 'Long-form text response.' },
  { type: 'Dropdown', label: 'Dropdown', description: 'Single-select option list.' },
  { type: 'RadioButtonsGroup', label: 'Radio group', description: 'Single-select visible options.' },
  { type: 'CheckboxGroup', label: 'Checkbox group', description: 'Multi-select visible options.' },
  { type: 'DatePicker', label: 'Date picker', description: 'Date selection field.' },
  { type: 'Image', label: 'Image', description: 'Banner or illustrative image.' },
  { type: 'Footer', label: 'Footer CTA', description: 'Submit or navigate action button.' },
];

type FlowComponentCapabilities = {
  supportsName: boolean;
  supportsLabel: boolean;
  supportsHelperText: boolean;
  supportsRequired: boolean;
  supportsMinLength: boolean;
  supportsMaxLength: boolean;
  supportsDefaultValue: boolean;
  supportsOptions: boolean;
  supportsSelectionBounds: boolean;
  supportsPlaceholder: boolean;
};

const supportedVisualTypes = new Set<FlowComponentType>(flowContract.supportedVisualTypes as FlowComponentType[]);
export const flowComponentCapabilities = flowContract.componentCapabilities as Record<string, FlowComponentCapabilities>;
const flowCategoryStarters = flowContract.categoryStarters as Record<string, {
  screenId: string;
  title: string;
  titleFromName?: boolean;
  children: FlowComponent[];
}>;

const digitToAlpha: Record<string, string> = {
  '0': 'j',
  '1': 'a',
  '2': 'b',
  '3': 'c',
  '4': 'd',
  '5': 'e',
  '6': 'f',
  '7': 'g',
  '8': 'h',
  '9': 'i',
};

let screenSequence = 1;
let componentSequence = 1;

function cleanString(value: unknown, fallback = '') {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function numberToLetters(num: number) {
  let value = Number(num) || 1;
  let result = '';

  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }

  return result || 'A';
}

function resolvePrimaryCategory(category?: FlowCategory | FlowCategory[] | null): FlowCategory {
  if (Array.isArray(category) && category.length > 0) {
    return category[0];
  }

  if (category && !Array.isArray(category)) {
    return category;
  }

  return 'OTHER';
}

function sanitizeIdentifier(
  value: unknown,
  options: {
    prefix: string;
    uppercase?: boolean;
    maxLength?: number;
  }
) {
  const source = cleanString(value, options.prefix) || options.prefix;
  const cased = options.uppercase ? source.toUpperCase() : source.toLowerCase();
  const stripped = cased
    .replace(/[0-9]/g, (digit) => (
      options.uppercase
        ? digitToAlpha[digit].toUpperCase()
        : digitToAlpha[digit]
    ))
    .replace(/[^a-zA-Z_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  let normalized = stripped || options.prefix;
  if (!/^[A-Za-z]/.test(normalized)) {
    normalized = `${options.prefix}_${normalized}`;
  }
  if (options.uppercase && normalized === 'SUCCESS') {
    normalized = 'SUCCESS_SCREEN';
  }

  return normalized.slice(0, options.maxLength ?? 60);
}

function sanitizeScreenId(value: unknown, index = 0) {
  return sanitizeIdentifier(value || `SCREEN_${numberToLetters(index + 1)}`, {
    prefix: 'SCREEN',
    uppercase: true,
  });
}

function sanitizeFieldName(value: unknown, type: FlowComponentType | 'Form' | 'Field', index = 0) {
  const prefixByType: Record<string, string> = {
    TextInput: 'text_input',
    TextArea: 'text_area',
    Dropdown: 'dropdown',
    RadioButtonsGroup: 'radio',
    CheckboxGroup: 'checkbox',
    DatePicker: 'date',
    Footer: 'footer',
    Form: 'form',
    Field: 'field',
  };

  return sanitizeIdentifier(value || `${prefixByType[type] || 'field'}_${numberToLetters(index + 1)}`, {
    prefix: prefixByType[type] || 'field',
  });
}

function sanitizeOptionId(value: unknown, index = 0) {
  return sanitizeIdentifier(value || `option_${numberToLetters(index + 1)}`, {
    prefix: 'option',
  });
}

function nextScreenId() {
  const id = `SCREEN_${numberToLetters(screenSequence)}`;
  screenSequence += 1;
  return id;
}

function nextFieldName(prefix: string) {
  const name = `${prefix}_${numberToLetters(componentSequence).toLowerCase()}`;
  componentSequence += 1;
  return name;
}

function createOptions(prefix: string): FlowOption[] {
  return [
    { id: `${prefix}_option_a`, title: 'Option 1' },
    { id: `${prefix}_option_b`, title: 'Option 2' },
  ];
}

export function createFlowComponent(type: FlowComponentType): FlowComponent {
  switch (type) {
    case 'TextHeading':
      return { type, text: 'Screen title' };
    case 'TextSubheading':
      return { type, text: 'Short supporting line' };
    case 'TextBody':
      return { type, text: 'Use this space to explain what the customer should do next.' };
    case 'TextInput':
      return {
        type,
        name: nextFieldName('text_input'),
        label: 'Text input',
        helper_text: 'Collect a short response.',
        required: true,
      };
    case 'TextArea':
      return {
        type,
        name: nextFieldName('text_area'),
        label: 'Long answer',
        helper_text: 'Collect a longer response.',
      };
    case 'Dropdown':
      return {
        type,
        name: nextFieldName('dropdown'),
        label: 'Choose an option',
        options: createOptions('dropdown'),
      };
    case 'RadioButtonsGroup':
      return {
        type,
        name: nextFieldName('radio'),
        label: 'Choose one',
        options: createOptions('radio'),
      };
    case 'CheckboxGroup':
      return {
        type,
        name: nextFieldName('checkbox'),
        label: 'Choose one or more',
        options: createOptions('checkbox'),
        min_selections: 0,
        max_selections: 2,
      };
    case 'DatePicker':
      return {
        type,
        name: nextFieldName('date'),
        label: 'Pick a date',
      };
    case 'Image':
      return {
        type,
        image_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
        caption: 'Cover image',
      };
    case 'Footer':
      return {
        type,
        label: 'Continue',
        action: { type: 'complete' },
      };
    default:
      return { type };
  }
}

function createHeading(text: string): FlowComponent {
  return { type: 'TextHeading', text };
}

function createBody(text: string): FlowComponent {
  return { type: 'TextBody', text };
}

function createTextInputField(
  name: string,
  label: string,
  options: Partial<FlowComponent> = {}
): FlowComponent {
  return {
    type: 'TextInput',
    name,
    label,
    ...(cleanString(options.helper_text) ? { helper_text: cleanString(options.helper_text) } : {}),
    ...(options.required !== undefined ? { required: Boolean(options.required) } : {}),
    ...(options.min_length !== undefined ? { min_length: options.min_length } : {}),
    ...(options.max_length !== undefined ? { max_length: options.max_length } : {}),
  };
}

function createTextAreaField(
  name: string,
  label: string,
  options: Partial<FlowComponent> = {}
): FlowComponent {
  return {
    type: 'TextArea',
    name,
    label,
    ...(cleanString(options.helper_text) ? { helper_text: cleanString(options.helper_text) } : {}),
    ...(options.required !== undefined ? { required: Boolean(options.required) } : {}),
  };
}

function createDropdownField(
  name: string,
  label: string,
  options: FlowOption[],
  settings: Partial<FlowComponent> = {}
): FlowComponent {
  return {
    type: 'Dropdown',
    name,
    label,
    options,
    ...(cleanString(settings.helper_text) ? { helper_text: cleanString(settings.helper_text) } : {}),
    ...(settings.required !== undefined ? { required: Boolean(settings.required) } : {}),
  };
}

function createRadioField(
  name: string,
  label: string,
  options: FlowOption[],
  settings: Partial<FlowComponent> = {}
): FlowComponent {
  return {
    type: 'RadioButtonsGroup',
    name,
    label,
    options,
    ...(cleanString(settings.helper_text) ? { helper_text: cleanString(settings.helper_text) } : {}),
    ...(settings.required !== undefined ? { required: Boolean(settings.required) } : {}),
  };
}

function createDateField(
  name: string,
  label: string,
  settings: Partial<FlowComponent> = {}
): FlowComponent {
  return {
    type: 'DatePicker',
    name,
    label,
    ...(cleanString(settings.helper_text) ? { helper_text: cleanString(settings.helper_text) } : {}),
    ...(settings.required !== undefined ? { required: Boolean(settings.required) } : {}),
  };
}

function createFooter(label: string): FlowComponent {
  return {
    type: 'Footer',
    label,
    action: { type: 'complete' },
  };
}

function createStarterScreen(id: string, title: string, children: FlowComponent[]): FlowScreen {
  return {
    id,
    title,
    layout: {
      type: 'SingleColumnLayout',
      children,
    },
  };
}

export function getFlowComponentCapabilities(type: FlowComponentType) {
  return flowComponentCapabilities[type] || {
    supportsName: false,
    supportsLabel: false,
    supportsHelperText: false,
    supportsRequired: false,
    supportsMinLength: false,
    supportsMaxLength: false,
    supportsDefaultValue: false,
    supportsOptions: false,
    supportsSelectionBounds: false,
    supportsPlaceholder: false,
  };
}

function normalizeOption(option: unknown, index: number): FlowOption {
  const source = isPlainObject(option) ? option : { title: cleanString(option, `Option ${index + 1}`) };
  return {
    id: sanitizeOptionId(source.id || source.value || source.title, index),
    title: cleanString(source.title || source.label, `Option ${index + 1}`),
    ...(cleanString(source.description) ? { description: cleanString(source.description) } : {}),
    ...(source.value !== undefined ? { value: source.value as FlowOption['value'] } : {}),
  };
}

function normalizeFooterAction(
  action: unknown,
  fallbackTargetScreenId?: string
): NonNullable<FlowComponent['action']> {
  const source = isPlainObject(action) ? action : {};
  const actionType = cleanString(source.type || source.name).toLowerCase() === 'navigate'
    ? 'navigate'
    : 'complete';

  return {
    type: actionType,
    ...(actionType === 'navigate'
      ? {
        target_screen_id: sanitizeScreenId(
          source.target_screen_id
          || (isPlainObject(source.next) ? source.next.name : undefined)
          || fallbackTargetScreenId
          || 'SCREEN_NEXT'
        ),
      }
      : {}),
    ...(isPlainObject(source.payload) ? { payload: { ...source.payload } } : {}),
  };
}

function normalizeComponent(
  component: unknown,
  index: number,
  screenIds: string[]
): FlowComponent {
  const source = isPlainObject(component) ? component : { type: 'TextBody', text: cleanString(component) };
  const type = supportedVisualTypes.has((source.type as FlowComponentType) || 'TextBody')
    ? (source.type as FlowComponentType)
    : 'TextBody';

  if (type === 'TextHeading' || type === 'TextSubheading' || type === 'TextBody') {
    return {
      type,
      text: cleanString(source.text, type === 'TextHeading' ? 'Heading' : 'Text'),
    };
  }

  if (type === 'Image') {
    return {
      type,
      ...(cleanString(source.image_url || source.src) ? { image_url: cleanString(source.image_url || source.src) } : {}),
      ...(cleanString(source.caption) ? { caption: cleanString(source.caption) } : {}),
    };
  }

  if (type === 'Footer') {
    return {
      type,
      label: cleanString(source.label, 'Continue'),
      action: normalizeFooterAction(source.action || source['on-click-action'], screenIds[index + 1]),
    };
  }

  return {
    type,
    name: sanitizeFieldName(source.name, type, index),
    label: cleanString(source.label, sanitizeFieldName(source.name, type, index)),
    ...(getFlowComponentCapabilities(type).supportsHelperText && cleanString(source.helper_text || source['helper-text'])
      ? { helper_text: cleanString(source.helper_text || source['helper-text']) }
      : {}),
    ...(getFlowComponentCapabilities(type).supportsRequired && source.required !== undefined ? { required: Boolean(source.required) } : {}),
    ...(getFlowComponentCapabilities(type).supportsMinLength && (source.min_length !== undefined || source['min-chars'] !== undefined)
      ? { min_length: Number(source.min_length ?? source['min-chars']) || 0 }
      : {}),
    ...(getFlowComponentCapabilities(type).supportsMaxLength && (source.max_length !== undefined || source['max-chars'] !== undefined)
      ? { max_length: Number(source.max_length ?? source['max-chars']) || 0 }
      : {}),
    ...(getFlowComponentCapabilities(type).supportsDefaultValue && (source.default_value !== undefined || source['init-value'] !== undefined)
      ? { default_value: source.default_value ?? source['init-value'] }
      : {}),
    ...(getFlowComponentCapabilities(type).supportsOptions
      ? {
        options: (
          Array.isArray(source.options)
            ? source.options
            : Array.isArray(source['data-source'])
              ? source['data-source']
              : []
        ).map((option, optionIndex) => normalizeOption(option, optionIndex)),
      }
      : {}),
    ...(getFlowComponentCapabilities(type).supportsSelectionBounds && type === 'CheckboxGroup' && source.min_selections !== undefined
      ? { min_selections: Number(source.min_selections) || 0 }
      : {}),
    ...(getFlowComponentCapabilities(type).supportsSelectionBounds && type === 'CheckboxGroup' && source.max_selections !== undefined
      ? { max_selections: Number(source.max_selections) || 0 }
      : {}),
  };
}

function normalizeBuilderDefinition(definition: Partial<FlowDefinition> | MetaFlowDefinition | null | undefined, name?: string): FlowDefinition {
  const fallback = createFlowDefinition(name || 'Flow start');
  const source = isPlainObject(definition) ? definition : fallback;
  const rawScreens = Array.isArray(source.screens) && source.screens.length > 0
    ? source.screens
    : fallback.screens;
  const screenIds = rawScreens.map((screen, index) => sanitizeScreenId(screen?.id, index));

  return {
    version: cleanString(source.version, '7.1'),
    data_api_version: cleanString(source.data_api_version, '3.0'),
    routing_model: {
      START: [screenIds[0]],
    },
    screens: rawScreens.map((screen, screenIndex) => {
      const screenSource = isPlainObject(screen) ? screen : fallback.screens[0];
      const rawChildren = Array.isArray(screenSource.layout?.children)
        ? screenSource.layout.children
        : [];
      const children = rawChildren.map((component, componentIndex) => normalizeComponent(component, componentIndex, screenIds));

      if (!children.some((component) => component.type === 'Footer')) {
        children.push({
          type: 'Footer',
          label: 'Continue',
          action: {
            type: screenIndex < rawScreens.length - 1 ? 'navigate' : 'complete',
            ...(screenIndex < rawScreens.length - 1 ? { target_screen_id: screenIds[screenIndex + 1] } : {}),
          },
        });
      }

      return {
        id: screenIds[screenIndex],
        title: cleanString(screenSource.title, `Screen ${screenIndex + 1}`),
        terminal: Boolean(screenSource.terminal),
        refresh_on_back: Boolean(screenSource.refresh_on_back),
        layout: {
          type: 'SingleColumnLayout',
          children,
        },
      };
    }),
  };
}

function buildFormPayload(components: FlowComponent[]) {
  return components.reduce<Record<string, unknown>>((payload, component) => {
    if (component.type !== 'Footer' && component.name) {
      payload[component.name] = `\${form.${component.name}}`;
    }
    return payload;
  }, {});
}

function toCanonicalOption(option: FlowOption, index: number) {
  return {
    id: sanitizeOptionId(option.id || option.value || option.title, index),
    title: cleanString(option.title, `Option ${index + 1}`),
    ...(cleanString(option.description) ? { description: cleanString(option.description) } : {}),
    ...(option.value !== undefined ? { value: option.value } : {}),
  };
}

function toCanonicalComponent(
  component: FlowComponent,
  index: number,
  formPayload: Record<string, unknown>
): MetaFlowComponent {
  if (component.type === 'TextHeading' || component.type === 'TextSubheading' || component.type === 'TextBody') {
    return {
      type: component.type,
      text: cleanString(component.text, component.type === 'TextHeading' ? 'Heading' : 'Text'),
    };
  }

  if (component.type === 'Image') {
    return {
      type: 'Image',
      ...(cleanString(component.image_url) ? { src: cleanString(component.image_url) } : {}),
      ...(cleanString(component.caption) ? { caption: cleanString(component.caption) } : {}),
    };
  }

  if (component.type === 'Footer') {
    const actionType = component.action?.type === 'navigate' ? 'navigate' : 'complete';
    return {
      type: 'Footer',
      label: cleanString(component.label, 'Continue'),
      'on-click-action': {
        name: actionType,
        payload: component.action?.payload && Object.keys(component.action.payload).length > 0
          ? { ...component.action.payload }
          : formPayload,
        ...(actionType === 'navigate' && component.action?.target_screen_id
          ? {
            next: {
              name: sanitizeScreenId(component.action.target_screen_id),
            },
          }
          : {}),
      },
    };
  }

  return {
    type: component.type,
    name: sanitizeFieldName(component.name, component.type, index),
    label: cleanString(component.label, sanitizeFieldName(component.name, component.type, index)),
    ...(cleanString(component.helper_text) ? { 'helper-text': cleanString(component.helper_text) } : {}),
    ...(component.required !== undefined ? { required: Boolean(component.required) } : {}),
    ...(component.type === 'TextInput' && component.min_length !== undefined ? { 'min-chars': component.min_length } : {}),
    ...(component.type === 'TextInput' && component.max_length !== undefined ? { 'max-chars': component.max_length } : {}),
    ...(component.default_value !== undefined ? { 'init-value': component.default_value } : {}),
    ...((component.type === 'Dropdown' || component.type === 'RadioButtonsGroup' || component.type === 'CheckboxGroup')
      ? {
        'data-source': (component.options || []).map((option, optionIndex) => toCanonicalOption(option, optionIndex)),
      }
      : {}),
    ...(component.type === 'CheckboxGroup' && component.min_selections !== undefined
      ? { 'min-selected-items': component.min_selections }
      : {}),
    ...(component.type === 'CheckboxGroup' && component.max_selections !== undefined
      ? { 'max-selected-items': component.max_selections }
      : {}),
  };
}

function hasCanonicalMarkers(definition: MetaFlowDefinition | FlowDefinition | null | undefined) {
  if (!Array.isArray(definition?.screens)) {
    return false;
  }

  return definition.screens.some((screen) => (
    Array.isArray(screen?.layout?.children)
      ? screen.layout.children.some((component) => (
        component?.type === 'Form'
        || Object.prototype.hasOwnProperty.call(component, 'on-click-action')
        || Object.prototype.hasOwnProperty.call(component, 'data-source')
        || Object.prototype.hasOwnProperty.call(component, 'helper-text')
        || Object.prototype.hasOwnProperty.call(component, 'src')
      ))
      : false
  ));
}

export function compileMetaFlowDefinition(definition: FlowDefinition, name?: string): MetaFlowDefinition {
  const normalized = normalizeBuilderDefinition(definition, name);

  const screens = normalized.screens.map((screen) => {
    const displayChildren = screen.layout.children.filter((component) => !['TextInput', 'TextArea', 'Dropdown', 'RadioButtonsGroup', 'CheckboxGroup', 'DatePicker', 'Footer'].includes(component.type));
    const formChildren = screen.layout.children.filter((component) => ['TextInput', 'TextArea', 'Dropdown', 'RadioButtonsGroup', 'CheckboxGroup', 'DatePicker', 'Footer'].includes(component.type));
    const formPayload = buildFormPayload(formChildren);
    const nextScreenIds = unique(
      formChildren
        .filter((component) => component.type === 'Footer' && component.action?.type === 'navigate')
        .map((component) => component.action?.target_screen_id || '')
        .filter(Boolean)
    );

    return {
      id: screen.id,
      title: screen.title,
      ...(screen.refresh_on_back ? { refresh_on_back: true } : {}),
      ...(screen.terminal || nextScreenIds.length === 0 ? { terminal: true } : {}),
      layout: {
        type: 'SingleColumnLayout',
        children: [
          ...displayChildren.map((component, index) => toCanonicalComponent(component, index, formPayload)),
          ...(formChildren.length > 0
            ? [{
              type: 'Form',
              name: sanitizeFieldName(`form_${screen.id}`, 'Form'),
              children: formChildren.map((component, index) => toCanonicalComponent(component, index, formPayload)),
            } satisfies MetaFlowComponent]
            : []),
        ],
      },
    };
  });

  return {
    version: normalized.version,
    screens,
  };
}

function fromCanonicalComponent(component: MetaFlowComponent): FlowComponent {
  if (component.type === 'TextHeading' || component.type === 'TextSubheading' || component.type === 'TextBody') {
    return {
      type: component.type,
      text: cleanString(component.text),
    };
  }

  if (component.type === 'Image') {
    return {
      type: 'Image',
      image_url: cleanString(component.src),
      caption: cleanString(component.caption),
    };
  }

  if (component.type === 'Footer') {
    return {
      type: 'Footer',
      label: cleanString(component.label, 'Continue'),
      action: {
        type: cleanString(component['on-click-action']?.name).toLowerCase() === 'navigate' ? 'navigate' : 'complete',
        ...(cleanString(component['on-click-action']?.next?.name)
          ? { target_screen_id: sanitizeScreenId(component['on-click-action']?.next?.name) }
          : {}),
        ...(isPlainObject(component['on-click-action']?.payload)
          ? { payload: { ...component['on-click-action']?.payload } }
          : {}),
      },
    };
  }

  return {
    type: component.type as FlowComponentType,
    name: sanitizeFieldName(component.name, component.type as FlowComponentType),
    label: cleanString(component.label, component.name || component.type),
    ...(cleanString(component['helper-text']) ? { helper_text: cleanString(component['helper-text']) } : {}),
    ...(component.required !== undefined ? { required: Boolean(component.required) } : {}),
    ...(component.type === 'TextInput' && component['min-chars'] !== undefined
      ? { min_length: Number(component['min-chars']) || 0 }
      : {}),
    ...(component.type === 'TextInput' && component['max-chars'] !== undefined
      ? { max_length: Number(component['max-chars']) || 0 }
      : {}),
    ...(component['init-value'] !== undefined ? { default_value: component['init-value'] } : {}),
    ...(Array.isArray(component['data-source'])
      ? { options: component['data-source'].map((option, index) => normalizeOption(option, index)) }
      : {}),
    ...(component['min-selected-items'] !== undefined
      ? { min_selections: Number(component['min-selected-items']) || 0 }
      : {}),
    ...(component['max-selected-items'] !== undefined
      ? { max_selections: Number(component['max-selected-items']) || 0 }
      : {}),
  };
}

export function deriveBuilderStateFromMetaFlow(definition: MetaFlowDefinition | FlowDefinition | null | undefined): {
  supported: boolean;
  warning: string | null;
  issues: string[];
  definition: FlowDefinition;
} {
  if (!definition) {
    const fallback = createFlowDefinition('Flow start');
    return {
      supported: true,
      warning: null,
      issues: [],
      definition: fallback,
    };
  }

  if (!hasCanonicalMarkers(definition)) {
    return {
      supported: true,
      warning: null,
      issues: [],
      definition: normalizeBuilderDefinition(definition as FlowDefinition),
    };
  }

  const issues: string[] = [];
  const screens: FlowScreen[] = [];

  for (const [screenIndex, screen] of definition.screens.entries()) {
    const rawChildren = Array.isArray(screen.layout?.children) ? screen.layout.children : [];
    const visualChildren: FlowComponent[] = [];
    let formCount = 0;

    for (const child of rawChildren) {
      if (child.type === 'Form') {
        formCount += 1;
        if (formCount > 1) {
          issues.push(`Screen "${screen.id}" contains more than one Form wrapper.`);
          break;
        }

        const formChildren = Array.isArray(child.children) ? child.children : [];
        for (const formChild of formChildren) {
          if (!supportedVisualTypes.has(formChild.type as FlowComponentType) || !['TextInput', 'TextArea', 'Dropdown', 'RadioButtonsGroup', 'CheckboxGroup', 'DatePicker', 'Footer'].includes(formChild.type)) {
            issues.push(`Screen "${screen.id}" contains unsupported Form child "${formChild.type}".`);
            break;
          }
          visualChildren.push(fromCanonicalComponent(formChild));
        }

        continue;
      }

      if (!supportedVisualTypes.has(child.type as FlowComponentType) || ['TextInput', 'TextArea', 'Dropdown', 'RadioButtonsGroup', 'CheckboxGroup', 'DatePicker', 'Footer'].includes(child.type)) {
        issues.push(`Screen "${screen.id}" contains unsupported builder component "${child.type}".`);
        break;
      }

      visualChildren.push(fromCanonicalComponent(child as MetaFlowComponent));
    }

    if (issues.length > 0) {
      break;
    }

    screens.push({
      id: sanitizeScreenId(screen.id, screenIndex),
      title: cleanString(screen.title, `Screen ${screenIndex + 1}`),
      terminal: Boolean(screen.terminal),
      refresh_on_back: Boolean(screen.refresh_on_back),
      layout: {
        type: 'SingleColumnLayout',
        children: visualChildren,
      },
    });
  }

  const builderDefinition = issues.length === 0
    ? normalizeBuilderDefinition({
      version: cleanString(definition.version, '7.1'),
      data_api_version: cleanString(definition.data_api_version, '3.0'),
      routing_model: definition.routing_model,
      screens,
    })
    : createFlowDefinition('Flow start');

  return {
    supported: issues.length === 0,
    warning: issues.length > 0
      ? 'The visual builder only supports Nyife\'s static-flow subset for this flow. Continue in JSON mode to avoid losing unsupported Meta JSON.'
      : null,
    issues,
    definition: builderDefinition,
  };
}

export function createFlowScreen(title?: string): FlowScreen {
  const id = nextScreenId();
  return {
    id,
    title: title || `Screen ${screenSequence - 1}`,
    layout: {
      type: 'SingleColumnLayout',
      children: [
        createFlowComponent('TextHeading'),
        createFlowComponent('TextBody'),
        createFlowComponent('TextInput'),
        createFlowComponent('Footer'),
      ],
    },
  };
}

function materializeStarterComponent(component: FlowComponent): FlowComponent {
  switch (component.type) {
    case 'TextHeading':
      return createHeading(component.text || 'Heading');
    case 'TextBody':
      return createBody(component.text || 'Body text');
    case 'TextInput':
      return createTextInputField(component.name || nextFieldName('text_input'), component.label || 'Text input', component);
    case 'TextArea':
      return createTextAreaField(component.name || nextFieldName('text_area'), component.label || 'Long answer', component);
    case 'Dropdown':
      return createDropdownField(component.name || nextFieldName('dropdown'), component.label || 'Choose an option', deepClone(component.options || []), component);
    case 'RadioButtonsGroup':
      return createRadioField(component.name || nextFieldName('radio'), component.label || 'Choose one', deepClone(component.options || []), component);
    case 'CheckboxGroup':
      return {
        type: 'CheckboxGroup',
        name: component.name || nextFieldName('checkbox'),
        label: component.label || 'Choose one or more',
        options: deepClone(component.options || []),
        ...(cleanString(component.helper_text) ? { helper_text: cleanString(component.helper_text) } : {}),
        ...(component.required !== undefined ? { required: Boolean(component.required) } : {}),
        ...(component.min_selections !== undefined ? { min_selections: component.min_selections } : {}),
        ...(component.max_selections !== undefined ? { max_selections: component.max_selections } : {}),
      };
    case 'DatePicker':
      return createDateField(component.name || nextFieldName('date'), component.label || 'Pick a date', component);
    case 'Footer':
      return {
        ...createFooter(component.label || 'Continue'),
        action: component.action || { type: 'complete' },
      };
    case 'TextSubheading':
      return { type: 'TextSubheading', text: component.text || 'Subheading' };
    case 'Image':
      return {
        type: 'Image',
        ...(cleanString(component.image_url) ? { image_url: cleanString(component.image_url) } : {}),
        ...(cleanString(component.caption) ? { caption: cleanString(component.caption) } : {}),
      };
    default:
      return deepClone(component);
  }
}

function createCategoryStarterScreen(category: FlowCategory, name?: string): FlowScreen {
  const starter = flowCategoryStarters[category] || flowCategoryStarters.OTHER;
  const screenTitle = starter.titleFromName
    ? cleanString(name, starter.title)
    : starter.title;

  return createStarterScreen(
    starter.screenId || category,
    screenTitle,
    (starter.children || []).map((component) => materializeStarterComponent(component))
  );
}

export function createFlowDefinition(name?: string, category?: FlowCategory): FlowDefinition {
  const primaryCategory = resolvePrimaryCategory(category);
  const screen = createCategoryStarterScreen(primaryCategory, name);
  return {
    version: '7.1',
    data_api_version: '3.0',
    routing_model: {
      START: [screen.id],
    },
    screens: [screen],
  };
}

export function humanizeFlowCategory(category: FlowCategory) {
  const found = flowCategories.find((entry) => entry.value === category);
  return found?.label || category;
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) {
    return [...items];
  }

  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function validateFlowDefinition(definition: FlowDefinition) {
  const normalized = normalizeBuilderDefinition(definition);
  const issues: string[] = [];
  const screenIds = new Set<string>();
  const fieldNames = new Set<string>();

  if (!normalized.screens.length) {
    issues.push('At least one screen is required.');
  }

  normalized.screens.forEach((screen) => {
    if (screenIds.has(screen.id)) {
      issues.push(`Duplicate screen id "${screen.id}".`);
    }
    screenIds.add(screen.id);

    const footers = screen.layout.children.filter((component) => component.type === 'Footer');
    if (footers.length === 0) {
      issues.push(`Screen "${screen.id}" needs a footer CTA.`);
    }
    if (footers.length > 1) {
      issues.push(`Screen "${screen.id}" can only contain one footer CTA in the static builder.`);
    }

    screen.layout.children.forEach((component) => {
      if (component.name) {
        if (fieldNames.has(component.name)) {
          issues.push(`Duplicate field name "${component.name}".`);
        }
        fieldNames.add(component.name);
      }

      if (component.type === 'Footer' && component.action?.type === 'navigate' && component.action.target_screen_id) {
        if (!normalized.screens.some((candidate) => candidate.id === component.action?.target_screen_id)) {
          issues.push(`Footer target screen "${component.action.target_screen_id}" does not exist.`);
        }
      }

      if (
        (component.type === 'Dropdown' || component.type === 'RadioButtonsGroup' || component.type === 'CheckboxGroup')
        && (!component.options || component.options.length === 0)
      ) {
        issues.push(`Field "${component.label || component.name || component.type}" needs at least one option.`);
      }
    });
  });

  return unique(issues);
}

export function formatValidationDetail(detail: FlowValidationDetail | string) {
  if (typeof detail === 'string') {
    return detail;
  }

  const line = detail.line ? ` (line ${detail.line}${detail.column ? `, column ${detail.column}` : ''})` : '';
  const path = detail.path ? ` [${detail.path}]` : '';
  return `${detail.message}${line}${path}`;
}

export function getScreenDataExchangeConfig(
  dataExchangeConfig: Record<string, unknown> | null | undefined,
  screenId: string
) {
  const root = (dataExchangeConfig || {}) as Record<string, unknown>;
  return (root[screenId] || (root.screens as Record<string, unknown> | undefined)?.[screenId] || null) as Record<string, unknown> | null;
}
