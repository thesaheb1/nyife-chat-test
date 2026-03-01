'use strict';

const { successResponse, errorResponse } = require('@nyife/shared-utils');
const userService = require('../services/user.service');
const {
  updateProfileSchema,
  changePasswordSchema,
  updateSettingsSchema,
  createApiTokenSchema,
} = require('../validations/user.validation');

// ---------------------------------------------------------------------------
// Profile controllers
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/users/profile
 * Returns the authenticated user's profile from auth_users.
 */
const getProfile = async (req, res) => {
  const userId = req.user.id;
  const profile = await userService.getProfile(userId);
  return successResponse(res, profile, 'Profile retrieved successfully');
};

/**
 * PUT /api/v1/users/profile
 * Updates the authenticated user's profile (first_name, last_name, phone).
 */
const updateProfile = async (req, res) => {
  const userId = req.user.id;
  const validated = updateProfileSchema.parse(req.body);
  const updatedProfile = await userService.updateProfile(userId, validated);
  return successResponse(res, updatedProfile, 'Profile updated successfully');
};

/**
 * PUT /api/v1/users/password
 * Changes the authenticated user's password after verifying the current one.
 */
const changePassword = async (req, res) => {
  const userId = req.user.id;
  const validated = changePasswordSchema.parse(req.body);
  await userService.changePassword(userId, validated.current_password, validated.new_password);
  return successResponse(res, null, 'Password changed successfully');
};

// ---------------------------------------------------------------------------
// Settings controllers
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/users/settings
 * Returns the authenticated user's settings (creates defaults if none exist).
 */
const getSettings = async (req, res) => {
  const userId = req.user.id;
  const settings = await userService.getSettings(userId);
  return successResponse(res, settings, 'Settings retrieved successfully');
};

/**
 * PUT /api/v1/users/settings
 * Updates the authenticated user's settings (partial update).
 */
const updateSettings = async (req, res) => {
  const userId = req.user.id;
  const validated = updateSettingsSchema.parse(req.body);
  const updatedSettings = await userService.updateSettings(userId, validated);
  return successResponse(res, updatedSettings, 'Settings updated successfully');
};

// ---------------------------------------------------------------------------
// API Token controllers
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/users/api-tokens
 * Creates a new API token. Returns the full raw token ONCE.
 */
const createApiToken = async (req, res) => {
  const userId = req.user.id;
  const validated = createApiTokenSchema.parse(req.body);

  const { token, tokenRecord } = await userService.createApiToken(
    userId,
    validated.name,
    validated.permissions || null,
    validated.expires_at || null
  );

  // Build response — include the raw token only in the creation response
  const responseData = {
    id: tokenRecord.id,
    name: tokenRecord.name,
    token,
    token_prefix: tokenRecord.token_prefix,
    permissions: tokenRecord.permissions,
    expires_at: tokenRecord.expires_at,
    is_active: tokenRecord.is_active,
    created_at: tokenRecord.created_at,
  };

  return successResponse(res, responseData, 'API token created successfully. Store the token securely — it will not be shown again.', 201);
};

/**
 * GET /api/v1/users/api-tokens
 * Lists the authenticated user's API tokens with pagination (prefix only, no hash).
 */
const listApiTokens = async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const { tokens, meta } = await userService.listApiTokens(userId, page, limit);
  return successResponse(res, tokens, 'API tokens retrieved successfully', 200, meta);
};

/**
 * DELETE /api/v1/users/api-tokens/:id
 * Revokes (deactivates) an API token.
 */
const revokeApiToken = async (req, res) => {
  const userId = req.user.id;
  const tokenId = req.params.id;

  const revokedToken = await userService.revokeApiToken(userId, tokenId);

  const responseData = {
    id: revokedToken.id,
    name: revokedToken.name,
    token_prefix: revokedToken.token_prefix,
    is_active: revokedToken.is_active,
  };

  return successResponse(res, responseData, 'API token revoked successfully');
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getSettings,
  updateSettings,
  createApiToken,
  listApiTokens,
  revokeApiToken,
};
