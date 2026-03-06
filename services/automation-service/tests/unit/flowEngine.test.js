'use strict';

const {
  getFlowState,
  setFlowState,
  clearFlowState,
  findStep,
  processFlowStep,
  FLOW_STATE_PREFIX,
  FLOW_TTL,
} = require('../../src/helpers/flowEngine');

describe('getFlowState', () => {
  it('should return parsed JSON from Redis', async () => {
    const state = { automationId: 'a1', currentStepId: 's1' };
    const redis = { get: jest.fn().mockResolvedValue(JSON.stringify(state)) };

    const result = await getFlowState(redis, 'user1', '+91123');
    expect(redis.get).toHaveBeenCalledWith(`${FLOW_STATE_PREFIX}user1:+91123`);
    expect(result).toEqual(state);
  });

  it('should return null when Redis is null', async () => {
    expect(await getFlowState(null, 'user1', '+91123')).toBeNull();
  });

  it('should return null on Redis miss', async () => {
    const redis = { get: jest.fn().mockResolvedValue(null) };
    expect(await getFlowState(redis, 'user1', '+91123')).toBeNull();
  });
});

describe('setFlowState', () => {
  it('should call redis.set with correct key and TTL', async () => {
    const redis = { set: jest.fn().mockResolvedValue('OK') };
    const state = { automationId: 'a1' };

    await setFlowState(redis, 'user1', '+91123', state);

    expect(redis.set).toHaveBeenCalledWith(
      `${FLOW_STATE_PREFIX}user1:+91123`,
      JSON.stringify(state),
      'EX',
      FLOW_TTL
    );
  });

  it('should handle null Redis gracefully', async () => {
    await expect(setFlowState(null, 'user1', '+91123', {})).resolves.toBeUndefined();
  });
});

describe('clearFlowState', () => {
  it('should call redis.del', async () => {
    const redis = { del: jest.fn().mockResolvedValue(1) };

    await clearFlowState(redis, 'user1', '+91123');

    expect(redis.del).toHaveBeenCalledWith(`${FLOW_STATE_PREFIX}user1:+91123`);
  });

  it('should handle null Redis', async () => {
    await expect(clearFlowState(null, 'user1', '+91123')).resolves.toBeUndefined();
  });
});

describe('findStep', () => {
  const steps = [
    { id: 'step1', type: 'send_message' },
    { id: 'step2', type: 'wait_for_reply' },
    { id: 'step3', type: 'condition' },
  ];

  it('should find step by id', () => {
    expect(findStep(steps, 'step2')).toEqual({ id: 'step2', type: 'wait_for_reply' });
  });

  it('should return null when not found', () => {
    expect(findStep(steps, 'nonexistent')).toBeNull();
  });
});

describe('processFlowStep', () => {
  it('should handle send_message step', () => {
    const step = { id: 's1', type: 'send_message', config: { text: 'Hello' }, next: 's2' };
    const result = processFlowStep(step, {}, {});

    expect(result.actions).toEqual([{ type: 'send_message', config: { text: 'Hello' } }]);
    expect(result.nextStepId).toBe('s2');
  });

  it('should handle send_template step', () => {
    const step = { id: 's1', type: 'send_template', config: { template_name: 'hello' }, next: 's2' };
    const result = processFlowStep(step, {}, {});

    expect(result.actions[0].type).toBe('send_template');
    expect(result.nextStepId).toBe('s2');
  });

  it('should handle wait_for_reply step', () => {
    const step = { id: 's1', type: 'wait_for_reply', branches: { received: 's2' } };
    const collectedData = {};
    const message = { text: { body: 'my reply' } };

    const result = processFlowStep(step, message, collectedData);

    expect(collectedData.s1).toBe('my reply');
    expect(result.nextStepId).toBe('s2');
  });

  it('should handle condition step - true branch', () => {
    const step = {
      id: 's1', type: 'condition',
      config: { operator: 'contains', value: 'yes' },
      branches: { true: 's2', false: 's3' },
    };
    const result = processFlowStep(step, { text: { body: 'Yes please' } }, {});

    expect(result.nextStepId).toBe('s2');
  });

  it('should handle condition step - false branch', () => {
    const step = {
      id: 's1', type: 'condition',
      config: { operator: 'equals', value: 'yes' },
      branches: { true: 's2', false: 's3' },
    };
    const result = processFlowStep(step, { text: { body: 'no' } }, {});

    expect(result.nextStepId).toBe('s3');
  });

  it('should handle condition step with regex', () => {
    const step = {
      id: 's1', type: 'condition',
      config: { operator: 'regex', value: '^\\d+$' },
      branches: { true: 's2', false: 's3' },
    };
    expect(processFlowStep(step, { text: { body: '12345' } }, {}).nextStepId).toBe('s2');
    expect(processFlowStep(step, { text: { body: 'abc' } }, {}).nextStepId).toBe('s3');
  });

  it('should handle add_tag step', () => {
    const step = { id: 's1', type: 'add_tag', config: { tag_id: 'tag-1' }, next: 's2' };
    const result = processFlowStep(step, {}, {});

    expect(result.actions).toEqual([{ type: 'add_tag', config: { tag_id: 'tag-1' } }]);
    expect(result.nextStepId).toBe('s2');
  });

  it('should handle delay step', () => {
    const step = { id: 's1', type: 'delay', config: { seconds: 5 }, next: 's2' };
    const result = processFlowStep(step, {}, {});

    expect(result.actions[0].type).toBe('delay');
    expect(result.nextStepId).toBe('s2');
  });

  it('should return empty result for null step', () => {
    const result = processFlowStep(null, {}, {});
    expect(result.actions).toEqual([]);
    expect(result.nextStepId).toBeNull();
  });

  it('should handle unknown type and pass to next', () => {
    const step = { id: 's1', type: 'unknown_type', next: 's2' };
    const result = processFlowStep(step, {}, {});

    expect(result.actions).toEqual([]);
    expect(result.nextStepId).toBe('s2');
  });
});
