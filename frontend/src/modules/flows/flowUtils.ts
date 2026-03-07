import type {
  FlowCategory,
  FlowComponent,
  FlowComponentType,
  FlowDefinition,
  FlowOption,
  FlowScreen,
} from '@/core/types';

export const flowCategories: Array<{ value: FlowCategory; label: string }> = [
  { value: 'LEAD_GENERATION', label: 'Lead generation' },
  { value: 'LEAD_QUALIFICATION', label: 'Lead qualification' },
  { value: 'APPOINTMENT_BOOKING', label: 'Appointment booking' },
  { value: 'SLOT_BOOKING', label: 'Slot booking' },
  { value: 'ORDER_PLACEMENT', label: 'Order placement' },
  { value: 'RE_ORDERING', label: 'Re-ordering' },
  { value: 'CUSTOMER_SUPPORT', label: 'Customer support' },
  { value: 'TICKET_CREATION', label: 'Ticket creation' },
  { value: 'PAYMENTS', label: 'Payments' },
  { value: 'COLLECTIONS', label: 'Collections' },
  { value: 'REGISTRATIONS', label: 'Registrations' },
  { value: 'APPLICATIONS', label: 'Applications' },
  { value: 'DELIVERY_UPDATES', label: 'Delivery updates' },
  { value: 'ADDRESS_CAPTURE', label: 'Address capture' },
  { value: 'FEEDBACK', label: 'Feedback' },
  { value: 'SURVEYS', label: 'Surveys' },
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

let screenSequence = 1;
let componentSequence = 1;

function nextScreenId() {
  const id = `SCREEN_${String(screenSequence).padStart(2, '0')}`;
  screenSequence += 1;
  return id;
}

function nextFieldName(prefix: string) {
  const name = `${prefix}_${componentSequence}`;
  componentSequence += 1;
  return name;
}

function createOptions(prefix: string): FlowOption[] {
  return [
    { id: `${prefix}_1`, title: 'Option 1' },
    { id: `${prefix}_2`, title: 'Option 2' },
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
        name: nextFieldName('text'),
        label: 'Text input',
        placeholder: 'Type here',
        required: true,
      };
    case 'TextArea':
      return {
        type,
        name: nextFieldName('textarea'),
        label: 'Long answer',
        placeholder: 'Share more details',
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
        createFlowComponent('Footer'),
      ],
    },
  };
}

export function createFlowDefinition(name?: string): FlowDefinition {
  const screen = createFlowScreen(name || 'Flow start');
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
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function validateFlowDefinition(definition: FlowDefinition) {
  const issues: string[] = [];
  const screenIds = new Set<string>();
  const fieldNames = new Set<string>();

  if (!definition.screens.length) {
    issues.push('At least one screen is required.');
  }

  definition.screens.forEach((screen) => {
    if (screenIds.has(screen.id)) {
      issues.push(`Duplicate screen id "${screen.id}".`);
    }
    screenIds.add(screen.id);

    screen.layout.children.forEach((component) => {
      if (component.name) {
        if (fieldNames.has(component.name)) {
          issues.push(`Duplicate field name "${component.name}".`);
        }
        fieldNames.add(component.name);
      }

      if (component.type === 'Footer' && component.action?.type === 'navigate' && component.action.target_screen_id) {
        if (!definition.screens.some((candidate) => candidate.id === component.action?.target_screen_id)) {
          issues.push(`Footer target screen "${component.action.target_screen_id}" does not exist.`);
        }
      }
    });
  });

  return issues;
}

export function getScreenDataExchangeConfig(
  dataExchangeConfig: Record<string, unknown> | null | undefined,
  screenId: string
) {
  const root = (dataExchangeConfig || {}) as Record<string, unknown>;
  return (root[screenId] || (root.screens as Record<string, unknown> | undefined)?.[screenId] || null) as Record<string, unknown> | null;
}
