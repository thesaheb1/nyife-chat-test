'use strict';

const {
  isValidRupeeAmount,
  rupeesToPaise,
  paiseToRupees,
} = require('../../src');

describe('money helpers', () => {
  it('converts rupees to paise for whole amounts', () => {
    expect(rupeesToPaise(100)).toBe(10000);
  });

  it('converts rupees to paise for decimal amounts', () => {
    expect(rupeesToPaise(99.5)).toBe(9950);
    expect(rupeesToPaise(0.8)).toBe(80);
  });

  it('converts paise back to rupees for form defaults', () => {
    expect(paiseToRupees(9950)).toBe(99.5);
  });

  it('rejects values with more than two decimal places', () => {
    expect(() => rupeesToPaise(12.345)).toThrow('Amount can have at most 2 decimal places');
    expect(isValidRupeeAmount(12.345)).toBe(false);
  });

  it('rejects negative values', () => {
    expect(() => rupeesToPaise(-1)).toThrow('Amount must be zero or greater');
    expect(isValidRupeeAmount(-1)).toBe(false);
  });
});
