'use strict';

const FLOW_CATEGORIES = [
  'SIGN_UP',
  'SIGN_IN',
  'LEAD_GENERATION',
  'APPOINTMENT_BOOKING',
  'CONTACT_US',
  'CUSTOMER_SUPPORT',
  'SURVEY',
  'OTHER',
];

const FLOW_STATUSES = ['DRAFT', 'PUBLISHED', 'THROTTLED', 'BLOCKED', 'DEPRECATED'];

const FLOW_CATEGORY_ALIASES = {
  LEAD_QUALIFICATION: 'LEAD_GENERATION',
  SLOT_BOOKING: 'APPOINTMENT_BOOKING',
  TICKET_CREATION: 'CUSTOMER_SUPPORT',
  SURVEYS: 'SURVEY',
};

const FLOW_COMPONENT_TYPES = [
  'Form',
  'TextHeading',
  'TextSubheading',
  'TextBody',
  'TextInput',
  'TextArea',
  'Dropdown',
  'RadioButtonsGroup',
  'CheckboxGroup',
  'DatePicker',
  'Image',
  'Footer',
];

const FLOW_FOOTER_ACTION_TYPES = ['complete', 'navigate'];

module.exports = {
  FLOW_CATEGORIES,
  FLOW_CATEGORY_ALIASES,
  FLOW_STATUSES,
  FLOW_COMPONENT_TYPES,
  FLOW_FOOTER_ACTION_TYPES,
};
