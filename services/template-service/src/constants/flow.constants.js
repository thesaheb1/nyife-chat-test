'use strict';

const FLOW_CATEGORIES = [
  'LEAD_GENERATION',
  'LEAD_QUALIFICATION',
  'APPOINTMENT_BOOKING',
  'SLOT_BOOKING',
  'ORDER_PLACEMENT',
  'RE_ORDERING',
  'CUSTOMER_SUPPORT',
  'TICKET_CREATION',
  'PAYMENTS',
  'COLLECTIONS',
  'REGISTRATIONS',
  'APPLICATIONS',
  'DELIVERY_UPDATES',
  'ADDRESS_CAPTURE',
  'FEEDBACK',
  'SURVEYS',
  'OTHER',
];

const FLOW_STATUSES = ['DRAFT', 'PUBLISHED', 'DEPRECATED'];

const FLOW_COMPONENT_TYPES = [
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
  FLOW_STATUSES,
  FLOW_COMPONENT_TYPES,
  FLOW_FOOTER_ACTION_TYPES,
};
