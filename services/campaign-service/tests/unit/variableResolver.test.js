'use strict';

const { getNestedValue, resolveVariables, buildTemplateComponents } = require('../../src/helpers/variableResolver');

describe('getNestedValue', () => {
  it('should return simple key value', () => {
    expect(getNestedValue({ name: 'John' }, 'name')).toBe('John');
  });

  it('should return nested dot path value', () => {
    expect(getNestedValue({ address: { city: 'Mumbai' } }, 'address.city')).toBe('Mumbai');
  });

  it('should return undefined for missing path', () => {
    expect(getNestedValue({ name: 'John' }, 'address.city')).toBeUndefined();
  });

  it('should handle deeply nested paths', () => {
    const obj = { a: { b: { c: { d: 'deep' } } } };
    expect(getNestedValue(obj, 'a.b.c.d')).toBe('deep');
  });
});

describe('resolveVariables', () => {
  it('should map placeholder indices to contact fields', () => {
    const contact = { name: 'John', phone: '+911234567890' };
    const mapping = { '1': 'name', '2': 'phone' };

    const result = resolveVariables(contact, mapping);

    expect(result).toEqual({ '1': 'John', '2': '+911234567890' });
  });

  it('should handle nested field paths', () => {
    const contact = { metadata: { city: 'Mumbai' } };
    const mapping = { '1': 'metadata.city' };

    const result = resolveVariables(contact, mapping);
    expect(result['1']).toBe('Mumbai');
  });

  it('should return empty string for missing fields', () => {
    const contact = { name: 'John' };
    const mapping = { '1': 'email' };

    const result = resolveVariables(contact, mapping);
    expect(result['1']).toBe('');
  });

  it('should handle null mapping', () => {
    const result = resolveVariables({ name: 'John' }, null);
    expect(result).toEqual({});
  });

  it('should handle empty mapping', () => {
    const result = resolveVariables({ name: 'John' }, {});
    expect(result).toEqual({});
  });
});

describe('buildTemplateComponents', () => {
  it('should build header component when header_1 present', () => {
    const template = { components: [{ type: 'HEADER', format: 'TEXT' }] };
    const vars = { header_1: 'Welcome' };

    const result = buildTemplateComponents(template, vars);

    expect(result).toEqual([
      { type: 'header', parameters: [{ type: 'text', text: 'Welcome' }] },
    ]);
  });

  it('should build body params for numeric keys', () => {
    const template = { components: [{ type: 'BODY' }] };
    const vars = { '1': 'John', '2': 'Mumbai' };

    const result = buildTemplateComponents(template, vars);

    expect(result).toEqual([
      { type: 'body', parameters: [
        { type: 'text', text: 'John' },
        { type: 'text', text: 'Mumbai' },
      ] },
    ]);
  });

  it('should return empty array when no vars match', () => {
    const template = { components: [] };
    const vars = {};

    expect(buildTemplateComponents(template, vars)).toEqual([]);
  });

  it('should handle missing components array', () => {
    expect(buildTemplateComponents({}, {})).toEqual([]);
  });

  it('should build both header and body', () => {
    const template = { components: [
      { type: 'HEADER', format: 'TEXT' },
      { type: 'BODY' },
    ] };
    const vars = { header_1: 'Hi', '1': 'John' };

    const result = buildTemplateComponents(template, vars);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('header');
    expect(result[1].type).toBe('body');
  });
});
