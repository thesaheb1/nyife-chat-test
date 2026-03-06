'use strict';

const { findMatchingAutomation, evaluateConditions } = require('../../src/helpers/matcher');

function makeAuto(triggerType, triggerValue, overrides = {}) {
  return {
    id: `auto-${triggerType}`,
    trigger_config: {
      trigger_type: triggerType,
      trigger_value: triggerValue,
      match_case: overrides.match_case || false,
    },
    conditions: overrides.conditions || null,
    ...overrides,
  };
}

function makeMsg(text, type = 'text') {
  return { type, text: { body: text } };
}

describe('findMatchingAutomation', () => {
  it('should match exact (case insensitive)', () => {
    const autos = [makeAuto('exact', 'hello')];
    expect(findMatchingAutomation(autos, makeMsg('Hello'))).toBe(autos[0]);
  });

  it('should match exact (case sensitive)', () => {
    const autos = [makeAuto('exact', 'Hello', { match_case: true })];
    // "hello" should NOT match case-sensitive "Hello"
    expect(findMatchingAutomation(autos, makeMsg('hello'))).toBeNull();
    expect(findMatchingAutomation(autos, makeMsg('Hello'))).toBe(autos[0]);
  });

  it('should match contains', () => {
    const autos = [makeAuto('contains', 'help')];
    expect(findMatchingAutomation(autos, makeMsg('I need help please'))).toBe(autos[0]);
  });

  it('should match keyword (same as contains)', () => {
    const autos = [makeAuto('keyword', 'order')];
    expect(findMatchingAutomation(autos, makeMsg('Check my order status'))).toBe(autos[0]);
  });

  it('should match regex', () => {
    const autos = [makeAuto('regex', '^hi\\b')];
    expect(findMatchingAutomation(autos, makeMsg('hi there'))).toBe(autos[0]);
    expect(findMatchingAutomation(autos, makeMsg('this is high'))).toBeNull();
  });

  it('should match message_type', () => {
    const autos = [makeAuto('message_type', 'image')];
    expect(findMatchingAutomation(autos, makeMsg('', 'image'))).toBe(autos[0]);
    expect(findMatchingAutomation(autos, makeMsg('text', 'text'))).toBeNull();
  });

  it('should return null when no match', () => {
    const autos = [makeAuto('exact', 'goodbye')];
    expect(findMatchingAutomation(autos, makeMsg('hello'))).toBeNull();
  });

  it('should return first match (respects priority order)', () => {
    const autos = [
      makeAuto('contains', 'hi', { id: 'first' }),
      makeAuto('exact', 'hi there', { id: 'second' }),
    ];
    const result = findMatchingAutomation(autos, makeMsg('hi there'));
    expect(result.id).toBe('first');
  });

  it('should handle invalid regex gracefully', () => {
    const autos = [makeAuto('regex', '[invalid')];
    expect(findMatchingAutomation(autos, makeMsg('test'))).toBeNull();
  });

  it('should handle unknown trigger type', () => {
    const autos = [makeAuto('unknown', 'test')];
    expect(findMatchingAutomation(autos, makeMsg('test'))).toBeNull();
  });

  it('should evaluate time_of_day condition', () => {
    const currentHour = new Date().getHours();
    const autos = [makeAuto('exact', 'hello', {
      conditions: { time_of_day: { from_hour: currentHour, to_hour: currentHour + 1 } },
    })];
    expect(findMatchingAutomation(autos, makeMsg('hello'))).toBe(autos[0]);
  });

  it('should fail time_of_day condition when outside range', () => {
    const autos = [makeAuto('exact', 'hello', {
      conditions: { time_of_day: { from_hour: 25, to_hour: 26 } },
    })];
    expect(findMatchingAutomation(autos, makeMsg('hello'))).toBeNull();
  });
});

describe('evaluateConditions', () => {
  it('should return true with no relevant conditions', () => {
    expect(evaluateConditions({}, {})).toBe(true);
  });

  it('should return true with empty conditions', () => {
    expect(evaluateConditions({}, {})).toBe(true);
  });
});
