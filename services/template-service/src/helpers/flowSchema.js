'use strict';

const {
  FLOW_COMPONENT_TYPES,
  FLOW_FOOTER_ACTION_TYPES,
} = require('../constants/flow.constants');
const flowContract = require('@nyife/shared-config/src/flowContract.json');

const DEFAULT_JSON_VERSION = '7.1';
const DEFAULT_DATA_API_VERSION = '3.0';
const SUPPORTED_VISUAL_TYPES = new Set(flowContract.supportedVisualTypes || FLOW_COMPONENT_TYPES.filter((type) => type !== 'Form'));
const FORM_CHILD_TYPES = new Set(flowContract.formChildTypes || []);
const COMPONENT_CAPABILITIES = flowContract.componentCapabilities || {};
const CATEGORY_STARTERS = flowContract.categoryStarters || {};
const DIGIT_TO_ALPHA = {
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

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function numberToLetters(num) {
  let value = Number(num) || 1;
  let result = '';

  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }

  return result || 'A';
}

function resolvePrimaryCategory(categories) {
  if (Array.isArray(categories) && categories.length > 0) {
    return cleanString(categories[0], 'OTHER').toUpperCase();
  }

  return cleanString(categories, 'OTHER').toUpperCase();
}

function sanitizeIdentifier(value, {
  prefix = 'id',
  uppercase = false,
  maxLength = 60,
} = {}) {
  const source = cleanString(value, prefix) || prefix;
  const cased = uppercase ? source.toUpperCase() : source.toLowerCase();
  const stripped = cased
    .replace(/[0-9]/g, (digit) => (
      uppercase
        ? DIGIT_TO_ALPHA[digit].toUpperCase()
        : DIGIT_TO_ALPHA[digit]
    ))
    .replace(/[^a-zA-Z_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  let normalized = stripped || prefix;
  if (!/^[A-Za-z]/.test(normalized)) {
    normalized = `${prefix}_${normalized}`;
  }
  if (uppercase && normalized === 'SUCCESS') {
    normalized = 'SUCCESS_SCREEN';
  }

  return normalized.slice(0, maxLength);
}

function sanitizeScreenId(value, index) {
  return sanitizeIdentifier(value || `SCREEN_${numberToLetters(index + 1)}`, {
    prefix: 'SCREEN',
    uppercase: true,
  });
}

function sanitizeFieldName(value, type, index) {
  const prefixByType = {
    TextInput: 'text_input',
    TextArea: 'text_area',
    Dropdown: 'dropdown',
    RadioButtonsGroup: 'radio',
    CheckboxGroup: 'checkbox',
    DatePicker: 'date',
    Footer: 'footer',
    Form: 'form',
  };

  return sanitizeIdentifier(value || `${prefixByType[type] || 'field'}_${numberToLetters(index + 1)}`, {
    prefix: prefixByType[type] || 'field',
    uppercase: false,
  });
}

function sanitizeOptionId(value, index) {
  return sanitizeIdentifier(value || `option_${numberToLetters(index + 1)}`, {
    prefix: 'option',
    uppercase: false,
  });
}

function hasCanonicalFlowMarkers(definition) {
  if (!Array.isArray(definition?.screens)) {
    return false;
  }

  return definition.screens.some((screen) => {
    const children = Array.isArray(screen?.layout?.children) ? screen.layout.children : [];
    return children.some((component) => (
      component?.type === 'Form'
      || Object.prototype.hasOwnProperty.call(component || {}, 'on-click-action')
      || Object.prototype.hasOwnProperty.call(component || {}, 'data-source')
      || Object.prototype.hasOwnProperty.call(component || {}, 'helper-text')
      || Object.prototype.hasOwnProperty.call(component || {}, 'src')
    ));
  });
}

function createTextHeading(text) {
  return { type: 'TextHeading', text };
}

function createTextBody(text) {
  return { type: 'TextBody', text };
}

function createTextInput(name, label, options = {}) {
  return {
    type: 'TextInput',
    name,
    label,
    ...(cleanString(options.helper_text) ? { helper_text: cleanString(options.helper_text) } : {}),
    ...(options.required !== undefined ? { required: Boolean(options.required) } : {}),
    ...(options.min_length !== undefined ? { min_length: Number(options.min_length) || 0 } : {}),
    ...(options.max_length !== undefined ? { max_length: Number(options.max_length) || 0 } : {}),
  };
}

function createTextArea(name, label, options = {}) {
  return {
    type: 'TextArea',
    name,
    label,
    ...(cleanString(options.helper_text) ? { helper_text: cleanString(options.helper_text) } : {}),
    ...(options.required !== undefined ? { required: Boolean(options.required) } : {}),
  };
}

function createDropdown(name, label, options, settings = {}) {
  return {
    type: 'Dropdown',
    name,
    label,
    options,
    ...(cleanString(settings.helper_text) ? { helper_text: cleanString(settings.helper_text) } : {}),
    ...(settings.required !== undefined ? { required: Boolean(settings.required) } : {}),
  };
}

function createRadioButtonsGroup(name, label, options, settings = {}) {
  return {
    type: 'RadioButtonsGroup',
    name,
    label,
    options,
    ...(cleanString(settings.helper_text) ? { helper_text: cleanString(settings.helper_text) } : {}),
    ...(settings.required !== undefined ? { required: Boolean(settings.required) } : {}),
  };
}

function createCheckboxGroup(name, label, options, settings = {}) {
  return {
    type: 'CheckboxGroup',
    name,
    label,
    options,
    ...(cleanString(settings.helper_text) ? { helper_text: cleanString(settings.helper_text) } : {}),
    ...(settings.required !== undefined ? { required: Boolean(settings.required) } : {}),
    ...(settings.min_selections !== undefined ? { min_selections: Number(settings.min_selections) || 0 } : {}),
    ...(settings.max_selections !== undefined ? { max_selections: Number(settings.max_selections) || 0 } : {}),
  };
}

function createDatePicker(name, label, settings = {}) {
  return {
    type: 'DatePicker',
    name,
    label,
    ...(cleanString(settings.helper_text) ? { helper_text: cleanString(settings.helper_text) } : {}),
    ...(settings.required !== undefined ? { required: Boolean(settings.required) } : {}),
  };
}

function createFooter(label) {
  return {
    type: 'Footer',
    label,
    action: {
      type: 'complete',
    },
  };
}

function getComponentCapabilities(type) {
  return COMPONENT_CAPABILITIES[type] || {};
}

function buildSingleScreenStarter(screenId, title, children) {
  return {
    version: DEFAULT_JSON_VERSION,
    data_api_version: DEFAULT_DATA_API_VERSION,
    routing_model: {
      START: [screenId],
    },
    screens: [
      {
        id: screenId,
        title,
        layout: {
          type: 'SingleColumnLayout',
          children,
        },
      },
    ],
  };
}

function createDefaultVisualDefinition(name, categories) {
  const primaryCategory = resolvePrimaryCategory(categories);
  const starter = CATEGORY_STARTERS[primaryCategory] || CATEGORY_STARTERS.OTHER;
  const title = starter.titleFromName
    ? cleanString(name, starter.title || 'General request')
    : cleanString(starter.title, cleanString(name, 'Flow start'));

  return buildSingleScreenStarter(
    starter.screenId || sanitizeScreenId(primaryCategory, 0),
    title,
    deepClone(Array.isArray(starter.children) ? starter.children : [])
  );
}

function createDefaultFlowDefinition(name, categories) {
  return compileVisualDefinition(createDefaultVisualDefinition(name, categories), {
    name,
  }).metaDefinition;
}

function normalizeLegacyOption(option, index) {
  const source = isPlainObject(option) ? option : { title: cleanString(option, `Option ${index + 1}`) };
  const normalized = {
    id: sanitizeOptionId(source.id || source.value || source.title, index),
    title: cleanString(source.title || source.label, `Option ${index + 1}`),
  };

  if (cleanString(source.description)) {
    normalized.description = cleanString(source.description);
  }

  if (source.value !== undefined) {
    normalized.value = source.value;
  }

  return normalized;
}

function normalizeLegacyAction(action, availableScreenIds) {
  const source = isPlainObject(action) ? action : {};
  const actionType = FLOW_FOOTER_ACTION_TYPES.includes(source.type)
    ? source.type
    : (cleanString(source.name).toLowerCase() === 'navigate' ? 'navigate' : 'complete');

  const normalized = {
    type: actionType,
  };

  if (actionType === 'navigate') {
    const targetScreenId = sanitizeScreenId(
      source.target_screen_id
      || source.targetScreenId
      || source.next?.name
      || availableScreenIds[0]
      || 'SCREEN_NEXT',
      0
    );

    normalized.target_screen_id = targetScreenId;
  }

  if (isPlainObject(source.payload)) {
    normalized.payload = deepClone(source.payload);
  }

  return normalized;
}

function normalizeLegacyComponent(component, screenIndex, componentIndex, availableScreenIds) {
  const source = isPlainObject(component) ? component : { type: 'TextBody', text: cleanString(component) };
  const type = FLOW_COMPONENT_TYPES.includes(source.type) ? source.type : 'TextBody';
  const normalized = { type };

  if (type === 'TextHeading' || type === 'TextSubheading' || type === 'TextBody') {
    normalized.text = cleanString(source.text, type === 'TextHeading' ? 'Heading' : 'Text');
    return normalized;
  }

  if (type === 'Image') {
    if (cleanString(source.src || source.image_url)) {
      normalized.image_url = cleanString(source.src || source.image_url);
    }
    if (cleanString(source.caption)) {
      normalized.caption = cleanString(source.caption);
    }
    return normalized;
  }

  if (type === 'Footer') {
    normalized.label = cleanString(source.label, 'Continue');
    normalized.action = normalizeLegacyAction(source.action || source['on-click-action'], availableScreenIds);
    return normalized;
  }

  normalized.name = sanitizeFieldName(source.name, type, componentIndex);
  normalized.label = cleanString(source.label, normalized.name);

  const capabilities = getComponentCapabilities(type);
  if (capabilities.supportsHelperText && cleanString(source.helper_text || source['helper-text'])) {
    normalized.helper_text = cleanString(source.helper_text || source['helper-text']);
  }
  if (capabilities.supportsRequired && source.required !== undefined) {
    normalized.required = Boolean(source.required);
  }
  if (capabilities.supportsMinLength && (source.min_length !== undefined || source['min-chars'] !== undefined)) {
    normalized.min_length = Number(source.min_length ?? source['min-chars']) || 0;
  }
  if (capabilities.supportsMaxLength && (source.max_length !== undefined || source['max-chars'] !== undefined)) {
    normalized.max_length = Number(source.max_length ?? source['max-chars']) || 0;
  }
  if (capabilities.supportsDefaultValue && (source.default_value !== undefined || source['init-value'] !== undefined)) {
    normalized.default_value = source.default_value ?? source['init-value'];
  }
  if (capabilities.supportsSelectionBounds && type === 'CheckboxGroup') {
    if (source.min_selections !== undefined) {
      normalized.min_selections = Number(source.min_selections) || 0;
    }
    if (source.max_selections !== undefined) {
      normalized.max_selections = Number(source.max_selections) || 0;
    }
  }
  if (capabilities.supportsOptions) {
    const options = Array.isArray(source.options)
      ? source.options
      : Array.isArray(source['data-source'])
        ? source['data-source']
        : [];
    normalized.options = options.map((option, index) => normalizeLegacyOption(option, index));
  }

  return normalized;
}

function normalizeVisualDefinition(definition, fallbackName) {
  const fallback = createDefaultVisualDefinition(fallbackName);
  const source = isPlainObject(definition) ? definition : fallback;
  const rawScreens = Array.isArray(source.screens) && source.screens.length > 0
    ? source.screens
    : fallback.screens;

  const screenIds = rawScreens.map((screen, index) => sanitizeScreenId(screen?.id, index));

  const normalizedScreens = rawScreens.map((screen, screenIndex) => {
    const sourceScreen = isPlainObject(screen) ? screen : fallback.screens[0];
    const rawChildren = Array.isArray(sourceScreen?.layout?.children)
      ? sourceScreen.layout.children
      : [];

    const children = rawChildren.map((component, componentIndex) => (
      normalizeLegacyComponent(component, screenIndex, componentIndex, screenIds)
    ));

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
      title: cleanString(sourceScreen.title, `Screen ${screenIndex + 1}`),
      terminal: Boolean(sourceScreen.terminal),
      refresh_on_back: Boolean(sourceScreen.refresh_on_back),
      layout: {
        type: 'SingleColumnLayout',
        children,
      },
    };
  });

  const routingModel = {
    START: [normalizedScreens[0].id],
  };

  return {
    version: cleanString(source.version, DEFAULT_JSON_VERSION),
    data_api_version: cleanString(source.data_api_version, DEFAULT_DATA_API_VERSION),
    routing_model: routingModel,
    screens: normalizedScreens,
  };
}

function buildFormPayload(components) {
  const payload = {};
  for (const component of components) {
    if (!component?.name || component.type === 'Footer') {
      continue;
    }
    payload[component.name] = `\${form.${component.name}}`;
  }
  return payload;
}

function toCanonicalOption(option, index) {
  const normalized = normalizeLegacyOption(option, index);
  const payload = {
    id: normalized.id,
    title: normalized.title,
  };

  if (normalized.description) {
    payload.description = normalized.description;
  }
  if (normalized.value !== undefined) {
    payload.value = normalized.value;
  }

  return payload;
}

function toCanonicalComponent(component, index, formPayload) {
  const source = normalizeLegacyComponent(component, 0, index, []);
  const type = source.type;

  if (type === 'TextHeading' || type === 'TextSubheading' || type === 'TextBody') {
    return {
      type,
      text: cleanString(source.text, type === 'TextHeading' ? 'Heading' : 'Text'),
    };
  }

  if (type === 'Image') {
    const normalized = {
      type,
    };
    if (cleanString(source.image_url)) {
      normalized.src = cleanString(source.image_url);
    }
    if (cleanString(source.caption)) {
      normalized.caption = cleanString(source.caption);
    }
    return normalized;
  }

  if (type === 'Footer') {
    const actionType = source.action?.type === 'navigate' ? 'navigate' : 'complete';
    const action = {
      name: actionType,
      payload: isPlainObject(source.action?.payload) && Object.keys(source.action.payload).length > 0
        ? deepClone(source.action.payload)
        : formPayload,
    };

    if (actionType === 'navigate') {
      action.next = {
        name: sanitizeScreenId(source.action?.target_screen_id, 0),
      };
    }

    return {
      type,
      label: cleanString(source.label, 'Continue'),
      'on-click-action': action,
    };
  }

  const normalized = {
    type,
    name: sanitizeFieldName(source.name, type, index),
    label: cleanString(source.label, sanitizeFieldName(source.name, type, index)),
  };

  if (cleanString(source.helper_text)) {
    normalized['helper-text'] = cleanString(source.helper_text);
  }
  if (source.required !== undefined) {
    normalized.required = Boolean(source.required);
  }
  if (type === 'TextInput' && source.min_length !== undefined) {
    normalized['min-chars'] = Number(source.min_length) || 0;
  }
  if (type === 'TextInput' && source.max_length !== undefined) {
    normalized['max-chars'] = Number(source.max_length) || 0;
  }
  if (source.default_value !== undefined) {
    normalized['init-value'] = source.default_value;
  }
  if (type === 'Dropdown' || type === 'RadioButtonsGroup' || type === 'CheckboxGroup') {
    normalized['data-source'] = (source.options || []).map((option, optionIndex) => toCanonicalOption(option, optionIndex));
  }
  if (type === 'CheckboxGroup') {
    if (source.min_selections !== undefined) {
      normalized['min-selected-items'] = Number(source.min_selections) || 0;
    }
    if (source.max_selections !== undefined) {
      normalized['max-selected-items'] = Number(source.max_selections) || 0;
    }
  }

  return normalized;
}

function compileVisualDefinition(definition, options = {}) {
  const visualDefinition = normalizeVisualDefinition(definition, options.name);

  const screens = visualDefinition.screens.map((screen) => {
    const displayChildren = [];
    const formChildren = [];

    for (const component of screen.layout.children) {
      if (FORM_CHILD_TYPES.has(component.type)) {
        formChildren.push(component);
        continue;
      }

      displayChildren.push(component);
    }

    const formPayload = buildFormPayload(formChildren);
    const layoutChildren = displayChildren.map((component, index) => (
      toCanonicalComponent(component, index, formPayload)
    ));

    if (formChildren.length > 0) {
      layoutChildren.push({
        type: 'Form',
        name: sanitizeFieldName(`form_${screen.id}`, 'Form', 0),
        children: formChildren.map((component, index) => toCanonicalComponent(component, index, formPayload)),
      });
    }

    const nextScreenIds = unique(
      formChildren
        .filter((component) => component.type === 'Footer' && component.action?.type === 'navigate')
        .map((component) => component.action?.target_screen_id)
        .filter((targetId) => targetId && targetId !== screen.id)
    );

    return {
      id: screen.id,
      title: screen.title,
      ...(screen.refresh_on_back ? { refresh_on_back: true } : {}),
      ...(screen.terminal || nextScreenIds.length === 0 ? { terminal: true } : {}),
      layout: {
        type: 'SingleColumnLayout',
        children: layoutChildren,
      },
    };
  });

  return {
    visualDefinition,
    metaDefinition: {
      version: visualDefinition.version,
      screens,
    },
  };
}

function normalizeCanonicalComponent(component, index) {
  const source = isPlainObject(component) ? deepClone(component) : { type: 'TextBody', text: '' };
  const normalized = {
    ...source,
    type: cleanString(source.type, 'TextBody'),
  };

  if (normalized.type === 'Image') {
    if (source.image_url && !source.src) {
      normalized.src = source.image_url;
      delete normalized.image_url;
    }
    return normalized;
  }

  if (normalized.type === 'Footer') {
    if (source.action && !source['on-click-action']) {
      const action = normalizeLegacyAction(source.action, []);
      normalized['on-click-action'] = {
        name: action.type,
        ...(action.type === 'navigate' ? { next: { name: action.target_screen_id } } : {}),
        ...(isPlainObject(action.payload) ? { payload: deepClone(action.payload) } : {}),
      };
      delete normalized.action;
    }

    if (!cleanString(normalized.label)) {
      normalized.label = 'Continue';
    }

    return normalized;
  }

  if (normalized.type === 'Form') {
    normalized.name = sanitizeFieldName(source.name || `form_${numberToLetters(index + 1)}`, 'Form', index);
    normalized.children = Array.isArray(source.children)
      ? source.children.map((child, childIndex) => normalizeCanonicalComponent(child, childIndex))
      : [];
    return normalized;
  }

  if (Object.prototype.hasOwnProperty.call(normalized, 'placeholder')) {
    delete normalized.placeholder;
  }

  if (source.helper_text && !source['helper-text']) {
    normalized['helper-text'] = source.helper_text;
    delete normalized.helper_text;
  }
  if (source.image_url && !source.src) {
    normalized.src = source.image_url;
    delete normalized.image_url;
  }
  if (Array.isArray(source.options) && !Array.isArray(source['data-source'])) {
    normalized['data-source'] = source.options.map((option, optionIndex) => toCanonicalOption(option, optionIndex));
    delete normalized.options;
  }
  if (source.action && !source['on-click-action']) {
    const action = normalizeLegacyAction(source.action, []);
    normalized['on-click-action'] = {
      name: action.type,
      ...(action.type === 'navigate' ? { next: { name: action.target_screen_id } } : {}),
      ...(isPlainObject(action.payload) ? { payload: deepClone(action.payload) } : {}),
    };
    delete normalized.action;
  }
  if (normalized.type === 'TextInput' && source.min_length !== undefined && source['min-chars'] === undefined) {
    normalized['min-chars'] = source.min_length;
    delete normalized.min_length;
  }
  if (normalized.type === 'TextInput' && source.max_length !== undefined && source['max-chars'] === undefined) {
    normalized['max-chars'] = source.max_length;
    delete normalized.max_length;
  }
  if (source.default_value !== undefined && source['init-value'] === undefined) {
    normalized['init-value'] = source.default_value;
    delete normalized.default_value;
  }
  if (normalized.name) {
    normalized.name = sanitizeFieldName(normalized.name, normalized.type, index);
  }
  if (Array.isArray(normalized['data-source'])) {
    normalized['data-source'] = normalized['data-source'].map((option, optionIndex) => toCanonicalOption(option, optionIndex));
  }

  return normalized;
}

function normalizeCanonicalDefinition(definition, fallbackName, fallbackCategories) {
  const fallback = createDefaultFlowDefinition(fallbackName, fallbackCategories);
  const source = isPlainObject(definition) ? deepClone(definition) : fallback;
  const rawScreens = Array.isArray(source.screens) && source.screens.length > 0
    ? source.screens
    : fallback.screens;

  const screens = rawScreens.map((screen, index) => {
    const sourceScreen = isPlainObject(screen) ? screen : fallback.screens[0];
    return {
      ...sourceScreen,
      id: sanitizeScreenId(sourceScreen.id, index),
      title: cleanString(sourceScreen.title, `Screen ${index + 1}`),
      layout: {
        type: 'SingleColumnLayout',
        children: Array.isArray(sourceScreen?.layout?.children)
          ? sourceScreen.layout.children.map((component, componentIndex) => normalizeCanonicalComponent(component, componentIndex))
          : [],
      },
    };
  });

  const routingModel = isPlainObject(source.routing_model)
    ? deepClone(source.routing_model)
    : undefined;

  return {
    ...source,
    version: cleanString(source.version, DEFAULT_JSON_VERSION),
    data_api_version: cleanString(source.data_api_version, DEFAULT_DATA_API_VERSION),
    ...(routingModel ? { routing_model: routingModel } : {}),
    screens,
  };
}

function convertCanonicalToVisualDefinition(definition, options = {}) {
  const normalized = normalizeCanonicalDefinition(definition, options.name, options.categories);
  const issues = [];
  const screens = [];

  for (const screen of normalized.screens) {
    const screenChildren = Array.isArray(screen?.layout?.children) ? screen.layout.children : [];
    const visualChildren = [];
    let formCount = 0;

    for (const component of screenChildren) {
      if (!isPlainObject(component)) {
        issues.push(`Screen "${screen.id}" contains an invalid component.`);
        continue;
      }

      if (component.type === 'Form') {
        formCount += 1;
        if (formCount > 1) {
          issues.push(`Screen "${screen.id}" contains more than one Form wrapper.`);
          break;
        }

        const formChildren = Array.isArray(component.children) ? component.children : [];
        for (const formChild of formChildren) {
          if (!FORM_CHILD_TYPES.has(formChild?.type)) {
            issues.push(`Screen "${screen.id}" contains unsupported Form child "${cleanString(formChild?.type, 'unknown')}".`);
            break;
          }

          visualChildren.push(convertCanonicalComponentToVisual(formChild));
        }

        continue;
      }

      if (!SUPPORTED_VISUAL_TYPES.has(component.type)) {
        issues.push(`Screen "${screen.id}" contains unsupported component "${cleanString(component.type, 'unknown')}".`);
        break;
      }

      visualChildren.push(convertCanonicalComponentToVisual(component));
    }

    if (issues.length > 0) {
      break;
    }

    screens.push({
      id: screen.id,
      title: cleanString(screen.title, screen.id),
      terminal: Boolean(screen.terminal),
      refresh_on_back: Boolean(screen.refresh_on_back),
      layout: {
        type: 'SingleColumnLayout',
        children: visualChildren,
      },
    });
  }

  return {
    supported: issues.length === 0,
    warning: issues.length > 0
      ? 'The visual builder only supports Nyife\'s static-flow subset for this flow. Continue in JSON mode to avoid losing unsupported Meta JSON.'
      : null,
    issues,
    visualDefinition: issues.length === 0
      ? {
        version: normalized.version,
        data_api_version: normalized.data_api_version,
        routing_model: normalized.routing_model,
        screens,
      }
      : null,
  };
}

function convertCanonicalComponentToVisual(component) {
  const normalized = normalizeCanonicalComponent(component, 0);

  if (normalized.type === 'TextHeading' || normalized.type === 'TextSubheading' || normalized.type === 'TextBody') {
    return {
      type: normalized.type,
      text: cleanString(normalized.text),
    };
  }

  if (normalized.type === 'Image') {
    return {
      type: 'Image',
      image_url: cleanString(normalized.src),
      caption: cleanString(normalized.caption),
    };
  }

  if (normalized.type === 'Footer') {
    return {
      type: 'Footer',
      label: cleanString(normalized.label, 'Continue'),
      action: {
        type: cleanString(normalized['on-click-action']?.name).toLowerCase() === 'navigate' ? 'navigate' : 'complete',
        ...(cleanString(normalized['on-click-action']?.next?.name)
          ? { target_screen_id: sanitizeScreenId(normalized['on-click-action'].next.name, 0) }
          : {}),
        ...(isPlainObject(normalized['on-click-action']?.payload)
          ? { payload: deepClone(normalized['on-click-action'].payload) }
          : {}),
      },
    };
  }

  return {
    type: normalized.type,
    name: sanitizeFieldName(normalized.name, normalized.type, 0),
    label: cleanString(normalized.label, normalized.name),
    helper_text: cleanString(normalized['helper-text']),
    required: Boolean(normalized.required),
    ...(normalized.type === 'TextInput' && normalized['min-chars'] !== undefined
      ? { min_length: Number(normalized['min-chars']) || 0 }
      : {}),
    ...(normalized.type === 'TextInput' && normalized['max-chars'] !== undefined
      ? { max_length: Number(normalized['max-chars']) || 0 }
      : {}),
    ...(normalized['init-value'] !== undefined ? { default_value: normalized['init-value'] } : {}),
    ...(Array.isArray(normalized['data-source'])
      ? { options: normalized['data-source'].map((option, index) => normalizeLegacyOption(option, index)) }
      : {}),
    ...(normalized['min-selected-items'] !== undefined
      ? { min_selections: Number(normalized['min-selected-items']) || 0 }
      : {}),
    ...(normalized['max-selected-items'] !== undefined
      ? { max_selections: Number(normalized['max-selected-items']) || 0 }
      : {}),
  };
}

function buildValidationDetails(validationErrors) {
  return validationErrors.map((message, index) => ({
    code: `local_validation_${index + 1}`,
    message,
  }));
}

function validateVisualDefinition(visualDefinition) {
  const errors = [];
  const screenIds = new Set();
  const fieldNames = new Set();

  if (!Array.isArray(visualDefinition?.screens) || visualDefinition.screens.length === 0) {
    errors.push('At least one screen is required.');
    return errors;
  }

  for (const screen of visualDefinition.screens) {
    if (screenIds.has(screen.id)) {
      errors.push(`Duplicate screen id "${screen.id}".`);
    }
    screenIds.add(screen.id);

    const components = Array.isArray(screen?.layout?.children) ? screen.layout.children : [];
    const footers = components.filter((component) => component.type === 'Footer');
    if (footers.length === 0) {
      errors.push(`Screen "${screen.id}" needs a footer CTA.`);
    }
    if (footers.length > 1) {
      errors.push(`Screen "${screen.id}" can only contain one footer CTA in the static builder.`);
    }

    for (const component of components) {
      if (component.name) {
        if (fieldNames.has(component.name)) {
          errors.push(`Duplicate field name "${component.name}".`);
        }
        fieldNames.add(component.name);
      }

      if (
        component.type === 'Footer'
        && component.action?.type === 'navigate'
        && component.action?.target_screen_id
        && !visualDefinition.screens.some((candidate) => candidate.id === component.action.target_screen_id)
      ) {
        errors.push(`Footer target screen "${component.action.target_screen_id}" does not exist.`);
      }

      if (
        (component.type === 'Dropdown' || component.type === 'RadioButtonsGroup' || component.type === 'CheckboxGroup')
        && (!Array.isArray(component.options) || component.options.length === 0)
      ) {
        errors.push(`Field "${component.name || component.label || component.type}" needs at least one option.`);
      }
    }
  }

  return unique(errors);
}

function validateFlowDefinition(definition, options = {}) {
  const fallbackName = options.name || 'Flow start';
  const fallbackCategories = options.categories || options.category;

  if (!definition) {
    const compiled = compileVisualDefinition(createDefaultVisualDefinition(fallbackName, fallbackCategories), {
      name: fallbackName,
    });
    const validationErrors = validateVisualDefinition(compiled.visualDefinition);
    return {
      normalized: compiled.metaDefinition,
      visualDefinition: compiled.visualDefinition,
      visualBuilderSupported: true,
      visualBuilderWarning: null,
      validationErrors,
      validationErrorDetails: buildValidationDetails(validationErrors),
    };
  }

  if (!hasCanonicalFlowMarkers(definition)) {
    const compiled = compileVisualDefinition(definition, {
      name: fallbackName,
    });
    const validationErrors = validateVisualDefinition(compiled.visualDefinition);
    return {
      normalized: compiled.metaDefinition,
      visualDefinition: compiled.visualDefinition,
      visualBuilderSupported: true,
      visualBuilderWarning: null,
      validationErrors,
      validationErrorDetails: buildValidationDetails(validationErrors),
    };
  }

  const normalized = normalizeCanonicalDefinition(definition, fallbackName, fallbackCategories);
  const builderState = convertCanonicalToVisualDefinition(normalized, {
    name: fallbackName,
    categories: fallbackCategories,
  });
  const validationErrors = builderState.supported
    ? validateVisualDefinition(builderState.visualDefinition)
    : [];
  const normalizedDefinition = builderState.supported
    ? compileVisualDefinition(builderState.visualDefinition, { name: fallbackName }).metaDefinition
    : normalized;

  return {
    normalized: normalizedDefinition,
    visualDefinition: builderState.visualDefinition,
    visualBuilderSupported: builderState.supported,
    visualBuilderWarning: builderState.warning,
    validationErrors,
    validationErrorDetails: buildValidationDetails(validationErrors),
  };
}

module.exports = {
  DEFAULT_JSON_VERSION,
  DEFAULT_DATA_API_VERSION,
  createDefaultFlowDefinition,
  normalizeVisualDefinition,
  compileVisualDefinition,
  convertCanonicalToVisualDefinition,
  validateFlowDefinition,
};
