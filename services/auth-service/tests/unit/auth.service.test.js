'use strict';

require('../setup');

const authService = require('../../src/services/auth.service');
const { User, RefreshToken, sequelize } = require('../../src/models');
const mockUserInstance = User.__mockInstance;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a fresh deep-clone of the mock user instance with all jest fns reset. */
function freshUser(overrides = {}) {
  const user = {
    ...mockUserInstance,
    ...overrides,
    toSafeJSON: jest.fn().mockReturnValue({
      id: overrides.id || mockUserInstance.id,
      email: overrides.email || mockUserInstance.email,
      first_name: overrides.first_name || mockUserInstance.first_name,
      last_name: overrides.last_name || mockUserInstance.last_name,
      role: overrides.role || mockUserInstance.role,
      status: overrides.status || mockUserInstance.status,
    }),
    comparePassword: jest.fn().mockResolvedValue(true),
    generateAccessToken: jest.fn().mockReturnValue('mock-access-token'),
    generateRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
    update: jest.fn().mockResolvedValue(true),
  };
  return user;
}

/** Reset all mocks between tests. */
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({
      data: {
        emails: [{ status: 'sent' }],
      },
    }),
  });

  // Default: unscoped().findOne returns null (no existing user)
  User.unscoped.mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) });
  // Default: scope('withPassword').findOne returns null
  User.scope.mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) });
  // Default: create returns a fresh mock user
  User.create.mockResolvedValue(freshUser());
  // Default: findByPk returns null
  User.findByPk.mockResolvedValue(null);
  // Default: RefreshToken
  RefreshToken.findOne.mockResolvedValue(null);
  RefreshToken.create.mockResolvedValue(true);
  RefreshToken.update.mockResolvedValue([1]);
  sequelize.query.mockResolvedValue([[], null]);
});

afterEach(() => {
  delete global.fetch;
});

// ===========================================================================
// register
// ===========================================================================
describe('authService.register', () => {
  const registerData = {
    email: 'new@example.com',
    password: 'Secret1!',
    first_name: 'New',
    last_name: 'User',
    phone: '+1234567890',
  };

  it('should create a user with correct fields and return user + emailVerificationToken', async () => {
    const created = freshUser({ email: 'new@example.com', first_name: 'New', last_name: 'User' });
    User.create.mockResolvedValue(created);

    const result = await authService.register(registerData);

    expect(User.create).toHaveBeenCalledTimes(1);
    const createArg = User.create.mock.calls[0][0];
    expect(createArg.email).toBe('new@example.com');
    expect(createArg.password).toBe('Secret1!');
    expect(createArg.first_name).toBe('New');
    expect(createArg.last_name).toBe('User');
    expect(createArg.phone).toBe('+1234567890');
    expect(createArg.role).toBe('user');
    expect(createArg.status).toBe('pending_verification');
    expect(createArg.email_verification_token).toBeDefined();
    expect(typeof createArg.email_verification_token).toBe('string');
    expect(createArg.email_verification_token.length).toBe(64); // 32 bytes hex

    expect(result.user).toBeDefined();
    expect(result.emailVerificationToken).toBeDefined();
    expect(typeof result.emailVerificationToken).toBe('string');
    expect(created.toSafeJSON).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://email-service:3013/api/v1/emails/send',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('should seed the default organization from the user first name', async () => {
    const created = freshUser({ id: 'user-uuid-1', email: 'new@example.com', first_name: 'New', last_name: 'User' });
    User.create.mockResolvedValue(created);

    await authService.register(registerData);

    expect(sequelize.query).toHaveBeenCalled();
    const [insertOrganizationSql, insertOrganizationOptions] = sequelize.query.mock.calls[0];
    expect(insertOrganizationSql).toContain('INSERT INTO org_organizations');
    expect(insertOrganizationOptions.replacements).toMatchObject({
      userId: 'user-uuid-1',
      name: "New's Org",
      description: "New's first organization",
      slug: 'seed-user-uui',
    });
  });

  it('should throw AppError.conflict when email already exists', async () => {
    const existing = freshUser();
    User.unscoped.mockReturnValue({ findOne: jest.fn().mockResolvedValue(existing) });

    await expect(authService.register(registerData)).rejects.toThrow('A user with this email already exists');
    await expect(authService.register(registerData)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('should roll back the new account when verification email sending fails', async () => {
    const created = freshUser({ id: 'user-uuid-1', email: 'new@example.com', first_name: 'New', last_name: 'User' });
    User.create.mockResolvedValue(created);
    sequelize.query
      .mockResolvedValueOnce([[], null])
      .mockResolvedValueOnce([[], null])
      .mockResolvedValueOnce([[], null])
      .mockResolvedValueOnce([[], null]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        data: {
          emails: [{ status: 'failed', error_message: 'SMTP rejected the recipient' }],
        },
      }),
    });

    await expect(authService.register(registerData)).rejects.toThrow('SMTP rejected the recipient');
    expect(User.destroy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-uuid-1' },
        force: true,
      })
    );
  });
});

// ===========================================================================
// verifyEmail
// ===========================================================================
describe('authService.verifyEmail', () => {
  it('should update user status to active and clear token fields', async () => {
    const user = freshUser({ status: 'pending_verification' });
    User.unscoped.mockReturnValue({ findOne: jest.fn().mockResolvedValue(user) });

    const result = await authService.verifyEmail('valid-token');

    expect(user.update).toHaveBeenCalledTimes(1);
    const updateArg = user.update.mock.calls[0][0];
    expect(updateArg.status).toBe('active');
    expect(updateArg.email_verification_token).toBeNull();
    expect(updateArg.email_verification_expires).toBeNull();
    expect(updateArg.email_verified_at).toBeInstanceOf(Date);
    expect(user.toSafeJSON).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should throw AppError.badRequest when token is invalid or expired', async () => {
    User.unscoped.mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) });

    await expect(authService.verifyEmail('bad-token')).rejects.toThrow('Invalid or expired verification token');
    await expect(authService.verifyEmail('bad-token')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('authService.resendVerificationEmail', () => {
  it('should refresh the token and send a new verification email for pending accounts', async () => {
    const user = freshUser({
      id: 'pending-user-1',
      email: 'pending@example.com',
      first_name: 'Pending',
      status: 'pending_verification',
      email_verified_at: null,
    });
    User.unscoped.mockReturnValue({ findOne: jest.fn().mockResolvedValue(user) });

    const result = await authService.resendVerificationEmail('pending-user-1');

    expect(user.update).toHaveBeenCalledWith(expect.objectContaining({
      email_verification_token: expect.any(String),
      email_verification_expires: expect.any(Date),
    }));
    expect(global.fetch).toHaveBeenCalled();
    expect(result.user.email).toBe('pending@example.com');
  });
});

// ===========================================================================
// login
// ===========================================================================
describe('authService.login', () => {
  const loginData = { email: 'user@example.com', password: 'Secret1!', ip: '127.0.0.1', userAgent: 'Jest' };

  it('should return tokens and user on successful login', async () => {
    const user = freshUser({ status: 'active', login_count: 3 });
    User.scope.mockReturnValue({ findOne: jest.fn().mockResolvedValue(user) });

    const result = await authService.login(loginData);

    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBe('mock-refresh-token');
    expect(result.user).toBeDefined();
    expect(user.comparePassword).toHaveBeenCalledWith('Secret1!');
    expect(user.generateAccessToken).toHaveBeenCalled();
    expect(user.generateRefreshToken).toHaveBeenCalled();
  });

  it('should create a RefreshToken record', async () => {
    const user = freshUser({ status: 'active', login_count: 0 });
    User.scope.mockReturnValue({ findOne: jest.fn().mockResolvedValue(user) });

    await authService.login(loginData);

    expect(RefreshToken.create).toHaveBeenCalledTimes(1);
    const createArg = RefreshToken.create.mock.calls[0][0];
    expect(createArg.user_id).toBe(user.id);
    expect(createArg.token).toBe('mock-refresh-token');
    expect(createArg.expires_at).toBeInstanceOf(Date);
    expect(createArg.device_info).toBe('Jest');
    expect(createArg.ip_address).toBe('127.0.0.1');
  });

  it('should update user login metadata', async () => {
    const user = freshUser({ status: 'active', login_count: 5 });
    User.scope.mockReturnValue({ findOne: jest.fn().mockResolvedValue(user) });

    await authService.login(loginData);

    expect(user.update).toHaveBeenCalled();
    const updateArg = user.update.mock.calls[0][0];
    expect(updateArg.last_login_at).toBeInstanceOf(Date);
    expect(updateArg.last_login_ip).toBe('127.0.0.1');
    expect(updateArg.login_count).toBe(6);
  });

  it('should throw AppError.unauthorized for non-existent user', async () => {
    User.scope.mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) });

    await expect(authService.login(loginData)).rejects.toThrow('Invalid email or password');
    await expect(authService.login(loginData)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should throw AppError.unauthorized for pending_verification status', async () => {
    const user = freshUser({ status: 'pending_verification' });
    User.scope.mockReturnValue({ findOne: jest.fn().mockResolvedValue(user) });

    await expect(authService.login(loginData)).rejects.toThrow('Please verify your email before logging in');
    await expect(authService.login(loginData)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should throw AppError.unauthorized for suspended status', async () => {
    const user = freshUser({ status: 'suspended' });
    User.scope.mockReturnValue({ findOne: jest.fn().mockResolvedValue(user) });

    await expect(authService.login(loginData)).rejects.toThrow('Your account has been suspended');
    await expect(authService.login(loginData)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should throw AppError.unauthorized for invalid password', async () => {
    const user = freshUser({ status: 'active' });
    user.comparePassword.mockResolvedValue(false);
    User.scope.mockReturnValue({ findOne: jest.fn().mockResolvedValue(user) });

    await expect(authService.login(loginData)).rejects.toThrow('Invalid email or password');
    await expect(authService.login(loginData)).rejects.toMatchObject({ statusCode: 401 });
  });
});

// ===========================================================================
// refreshAccessToken
// ===========================================================================
describe('authService.refreshAccessToken', () => {
  it('should return new token pair on valid refresh token', async () => {
    const user = freshUser({ status: 'active' });
    const storedToken = {
      user,
      device_info: 'Chrome',
      ip_address: '10.0.0.1',
      update: jest.fn().mockResolvedValue(true),
    };
    RefreshToken.findOne.mockResolvedValue(storedToken);

    const result = await authService.refreshAccessToken('valid-refresh-token');

    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBe('mock-refresh-token');
    expect(result.user).toBeDefined();
  });

  it('should revoke old token (rotation)', async () => {
    const user = freshUser({ status: 'active' });
    const storedToken = {
      user,
      device_info: 'Chrome',
      ip_address: '10.0.0.1',
      update: jest.fn().mockResolvedValue(true),
    };
    RefreshToken.findOne.mockResolvedValue(storedToken);

    await authService.refreshAccessToken('valid-refresh-token');

    expect(storedToken.update).toHaveBeenCalledWith({ is_revoked: true });
  });

  it('should create a new RefreshToken record', async () => {
    const user = freshUser({ status: 'active' });
    const storedToken = {
      user,
      device_info: 'Firefox',
      ip_address: '192.168.1.1',
      update: jest.fn().mockResolvedValue(true),
    };
    RefreshToken.findOne.mockResolvedValue(storedToken);

    await authService.refreshAccessToken('valid-refresh-token');

    expect(RefreshToken.create).toHaveBeenCalledTimes(1);
    const createArg = RefreshToken.create.mock.calls[0][0];
    expect(createArg.user_id).toBe(user.id);
    expect(createArg.token).toBe('mock-refresh-token');
    expect(createArg.device_info).toBe('Firefox');
    expect(createArg.ip_address).toBe('192.168.1.1');
  });

  it('should throw when refresh token is null', async () => {
    await expect(authService.refreshAccessToken(null)).rejects.toThrow('Refresh token is required');
    await expect(authService.refreshAccessToken(null)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should throw when refresh token is undefined', async () => {
    await expect(authService.refreshAccessToken(undefined)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should throw when token not found in database (expired/revoked)', async () => {
    RefreshToken.findOne.mockResolvedValue(null);

    await expect(authService.refreshAccessToken('unknown-token')).rejects.toThrow(
      'Invalid or expired refresh token'
    );
    await expect(authService.refreshAccessToken('unknown-token')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should throw when user account is not active', async () => {
    const user = freshUser({ status: 'suspended' });
    const storedToken = {
      user,
      device_info: null,
      ip_address: null,
      update: jest.fn().mockResolvedValue(true),
    };
    RefreshToken.findOne.mockResolvedValue(storedToken);

    await expect(authService.refreshAccessToken('some-token')).rejects.toThrow('User account is not active');
    await expect(authService.refreshAccessToken('some-token')).rejects.toMatchObject({ statusCode: 401 });
  });
});

// ===========================================================================
// logout
// ===========================================================================
describe('authService.logout', () => {
  it('should revoke the refresh token', async () => {
    await authService.logout('token-to-revoke');

    expect(RefreshToken.update).toHaveBeenCalledWith(
      { is_revoked: true },
      { where: { token: 'token-to-revoke' } }
    );
  });

  it('should do nothing when refresh token is null', async () => {
    await authService.logout(null);

    expect(RefreshToken.update).not.toHaveBeenCalled();
  });

  it('should do nothing when refresh token is undefined', async () => {
    await authService.logout(undefined);

    expect(RefreshToken.update).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// forgotPassword
// ===========================================================================
describe('authService.forgotPassword', () => {
  it('should return resetToken for existing user', async () => {
    const user = freshUser();
    User.unscoped.mockReturnValue({ findOne: jest.fn().mockResolvedValue(user) });

    const result = await authService.forgotPassword('user@example.com');

    expect(result.resetToken).toBeDefined();
    expect(typeof result.resetToken).toBe('string');
    expect(result.resetToken.length).toBe(64); // 32 bytes hex
    expect(result.userId).toBe(user.id);
    expect(result.email).toBe(user.email);
    expect(result.firstName).toBe(user.first_name);

    expect(user.update).toHaveBeenCalledTimes(1);
    const updateArg = user.update.mock.calls[0][0];
    expect(updateArg.password_reset_token).toBe(result.resetToken);
    expect(updateArg.password_reset_expires).toBeInstanceOf(Date);
  });

  it('should return { resetToken: null } for non-existent user (no enumeration)', async () => {
    User.unscoped.mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) });

    const result = await authService.forgotPassword('nobody@example.com');

    expect(result).toEqual({ resetToken: null });
  });
});

// ===========================================================================
// resetPassword
// ===========================================================================
describe('authService.resetPassword', () => {
  it('should update password, clear reset fields, and revoke all refresh tokens', async () => {
    const user = freshUser({ id: 'user-reset-id' });
    User.scope.mockReturnValue({ findOne: jest.fn().mockResolvedValue(user) });

    const result = await authService.resetPassword('valid-reset-token', 'NewPass1!');

    // Password updated
    expect(user.update).toHaveBeenCalledTimes(1);
    const updateArg = user.update.mock.calls[0][0];
    expect(updateArg.password).toBe('NewPass1!');
    expect(updateArg.password_reset_token).toBeNull();
    expect(updateArg.password_reset_expires).toBeNull();

    // All refresh tokens revoked
    expect(RefreshToken.update).toHaveBeenCalledWith(
      { is_revoked: true },
      { where: { user_id: 'user-reset-id' } }
    );

    expect(user.toSafeJSON).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should throw AppError.badRequest for invalid or expired token', async () => {
    User.scope.mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) });

    await expect(authService.resetPassword('bad-token', 'NewPass1!')).rejects.toThrow(
      'Invalid or expired reset token'
    );
    await expect(authService.resetPassword('bad-token', 'NewPass1!')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

// ===========================================================================
// getUserById
// ===========================================================================
describe('authService.getUserById', () => {
  it('should return user when found', async () => {
    const user = freshUser();
    User.findByPk.mockResolvedValue(user);

    const result = await authService.getUserById('user-uuid-1');

    expect(User.findByPk).toHaveBeenCalledWith('user-uuid-1');
    expect(user.toSafeJSON).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.id).toBe('user-uuid-1');
  });

  it('should throw AppError.notFound when user not found', async () => {
    User.findByPk.mockResolvedValue(null);

    await expect(authService.getUserById('nonexistent-id')).rejects.toThrow('User not found');
    await expect(authService.getUserById('nonexistent-id')).rejects.toMatchObject({ statusCode: 404 });
  });
});
