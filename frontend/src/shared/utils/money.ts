const MONEY_SCALE = 100;
const MONEY_EPSILON = 1e-8;

export function isValidRupeeAmount(amount: number, options: { allowZero?: boolean } = {}) {
  const { allowZero = true } = options;

  if (!Number.isFinite(amount)) {
    return false;
  }

  if (allowZero ? amount < 0 : amount <= 0) {
    return false;
  }

  const scaledAmount = amount * MONEY_SCALE;
  return Math.abs(scaledAmount - Math.round(scaledAmount)) < MONEY_EPSILON;
}

export function rupeesToPaise(amount: number, options: { allowZero?: boolean } = {}) {
  const { allowZero = true } = options;

  if (!Number.isFinite(amount)) {
    throw new TypeError('Amount must be a finite number');
  }

  if (allowZero ? amount < 0 : amount <= 0) {
    throw new RangeError(
      allowZero ? 'Amount must be zero or greater' : 'Amount must be greater than zero'
    );
  }

  const scaledAmount = amount * MONEY_SCALE;
  const roundedAmount = Math.round(scaledAmount);

  if (Math.abs(scaledAmount - roundedAmount) >= MONEY_EPSILON) {
    throw new RangeError('Amount can have at most 2 decimal places');
  }

  return roundedAmount;
}

export function paiseToRupees(amountInPaise: number | null | undefined) {
  const numericAmount = Number(amountInPaise ?? 0);
  if (!Number.isFinite(numericAmount)) {
    return 0;
  }

  return numericAmount / MONEY_SCALE;
}
