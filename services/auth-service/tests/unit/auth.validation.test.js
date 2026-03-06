'use strict';

const {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  oauthTokenSchema,
} = require('../../src/validations/auth.validation');

// ---------------------------------------------------------------------------
// registerSchema
// ---------------------------------------------------------------------------
describe('registerSchema', () => {
  const validData = {
    email: 'user@example.com',
    password: 'Strong1!pass',
    first_name: 'John',
    last_name: 'Doe',
    phone: '+1234567890',
  };

  it('should accept valid complete data', () => {
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('user@example.com');
    expect(result.data.first_name).toBe('John');
  });

  it('should accept valid data without optional phone', () => {
    const { phone, ...noPhone } = validData;
    const result = registerSchema.safeParse(noPhone);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = registerSchema.safeParse({ ...validData, email: 'not-an-email' });
    expect(result.success).toBe(false);
    const emailError = result.error.issues.find((i) => i.path.includes('email'));
    expect(emailError).toBeDefined();
  });

  it('should reject weak password without uppercase', () => {
    const result = registerSchema.safeParse({ ...validData, password: 'weakpass1!' });
    expect(result.success).toBe(false);
    const pwdError = result.error.issues.find((i) => i.path.includes('password'));
    expect(pwdError).toBeDefined();
  });

  it('should reject weak password without lowercase', () => {
    const result = registerSchema.safeParse({ ...validData, password: 'WEAKPASS1!' });
    expect(result.success).toBe(false);
  });

  it('should reject weak password without digit', () => {
    const result = registerSchema.safeParse({ ...validData, password: 'WeakPass!' });
    expect(result.success).toBe(false);
  });

  it('should reject weak password without special character', () => {
    const result = registerSchema.safeParse({ ...validData, password: 'WeakPass1' });
    expect(result.success).toBe(false);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({ ...validData, password: 'Aa1!' });
    expect(result.success).toBe(false);
  });

  it('should reject first_name shorter than 2 characters', () => {
    const result = registerSchema.safeParse({ ...validData, first_name: 'J' });
    expect(result.success).toBe(false);
    const nameError = result.error.issues.find((i) => i.path.includes('first_name'));
    expect(nameError).toBeDefined();
  });

  it('should lowercase email', () => {
    const result = registerSchema.safeParse({ ...validData, email: 'USER@Example.COM' });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('user@example.com');
  });

  it('should reject invalid phone format', () => {
    const result = registerSchema.safeParse({ ...validData, phone: '1234567890' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loginSchema
// ---------------------------------------------------------------------------
describe('loginSchema', () => {
  const validLogin = {
    email: 'user@example.com',
    password: 'anyPassword',
  };

  it('should accept valid login data', () => {
    const result = loginSchema.safeParse(validLogin);
    expect(result.success).toBe(true);
  });

  it('should reject missing password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({ email: 'bad-email', password: 'pass' });
    expect(result.success).toBe(false);
  });

  it('should reject missing email', () => {
    const result = loginSchema.safeParse({ password: 'pass' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verifyEmailSchema
// ---------------------------------------------------------------------------
describe('verifyEmailSchema', () => {
  it('should accept valid token', () => {
    const result = verifyEmailSchema.safeParse({ token: 'abc123def456' });
    expect(result.success).toBe(true);
  });

  it('should reject empty token', () => {
    const result = verifyEmailSchema.safeParse({ token: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing token', () => {
    const result = verifyEmailSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// forgotPasswordSchema
// ---------------------------------------------------------------------------
describe('forgotPasswordSchema', () => {
  it('should accept valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('should reject missing email', () => {
    const result = forgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resetPasswordSchema
// ---------------------------------------------------------------------------
describe('resetPasswordSchema', () => {
  it('should accept valid data', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'some-reset-token',
      new_password: 'NewStrong1!',
    });
    expect(result.success).toBe(true);
  });

  it('should reject weak password', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'some-reset-token',
      new_password: 'weak',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing token', () => {
    const result = resetPasswordSchema.safeParse({ new_password: 'Strong1!' });
    expect(result.success).toBe(false);
  });

  it('should reject empty token', () => {
    const result = resetPasswordSchema.safeParse({ token: '', new_password: 'Strong1!' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// oauthTokenSchema
// ---------------------------------------------------------------------------
describe('oauthTokenSchema', () => {
  it('should accept valid access token', () => {
    const result = oauthTokenSchema.safeParse({ access_token: 'ya29.some-google-token' });
    expect(result.success).toBe(true);
  });

  it('should reject empty token', () => {
    const result = oauthTokenSchema.safeParse({ access_token: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing access_token', () => {
    const result = oauthTokenSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
