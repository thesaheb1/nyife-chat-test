'use strict';

const { successResponse, errorResponse } = require('@nyife/shared-utils');
const adminService = require('../services/admin.service');
const {
  createSubAdminSchema,
  updateSubAdminSchema,
  listUsersSchema,
  createUserSchema,
  updateUserStatusSchema,
  walletActionSchema,
  createPlanSchema,
  updatePlanSchema,
  planStatusSchema,
  createCouponSchema,
  updateCouponSchema,
  createNotificationSchema,
  updateSettingsSchema,
  createRoleSchema,
  updateRoleSchema,
  idParamSchema,
  paginationSchema,
} = require('../validations/admin.validation');

// ===========================================================================
// SUB-ADMIN CONTROLLERS
// ===========================================================================

/**
 * POST /sub-admins
 * Creates a new sub-admin account.
 */
async function createSubAdmin(req, res) {
  const data = createSubAdminSchema.parse(req.body);
  const result = await adminService.createSubAdmin(data, req.adminUser.id);
  return successResponse(res, result, 'Sub-admin created successfully', 201);
}

/**
 * GET /sub-admins
 * Lists all sub-admins with pagination.
 */
async function listSubAdmins(req, res) {
  const filters = paginationSchema.parse(req.query);
  const { data, meta } = await adminService.listSubAdmins(filters);
  return successResponse(res, { sub_admins: data }, 'Sub-admins retrieved successfully', 200, meta);
}

/**
 * PUT /sub-admins/:id
 * Updates a sub-admin's role or status.
 */
async function updateSubAdmin(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const data = updateSubAdminSchema.parse(req.body);
  const result = await adminService.updateSubAdmin(id, data);
  return successResponse(res, result, 'Sub-admin updated successfully');
}

/**
 * DELETE /sub-admins/:id
 * Soft-deletes a sub-admin.
 */
async function deleteSubAdmin(req, res) {
  const { id } = idParamSchema.parse(req.params);
  await adminService.deleteSubAdmin(id);
  return successResponse(res, null, 'Sub-admin deleted successfully');
}

// ===========================================================================
// USER MANAGEMENT CONTROLLERS
// ===========================================================================

/**
 * GET /users
 * Lists platform users with pagination, search, and filters.
 */
async function listUsers(req, res) {
  const filters = listUsersSchema.parse(req.query);
  const { data, meta } = await adminService.listUsers(filters);
  return successResponse(res, { users: data }, 'Users retrieved successfully', 200, meta);
}

/**
 * GET /users/:id
 * Gets a single user with extended details.
 */
async function getUser(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const user = await adminService.getUser(id);
  return successResponse(res, user, 'User retrieved successfully');
}

/**
 * POST /users
 * Creates a new platform user (auto-verified).
 */
async function createUser(req, res) {
  const data = createUserSchema.parse(req.body);
  const result = await adminService.createUser(data);
  return successResponse(res, result, 'User created successfully', 201);
}

/**
 * PUT /users/:id/status
 * Updates a user's status.
 */
async function updateUserStatus(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { status } = updateUserStatusSchema.parse(req.body);
  const result = await adminService.updateUserStatus(id, status);
  return successResponse(res, result, 'User status updated successfully');
}

/**
 * DELETE /users/:id
 * Soft-deletes a user after safety checks.
 */
async function deleteUser(req, res) {
  const { id } = idParamSchema.parse(req.params);
  await adminService.deleteUser(id);
  return successResponse(res, null, 'User deleted successfully');
}

/**
 * POST /users/:id/wallet/credit
 * Credits a user's wallet.
 */
async function creditWallet(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { amount, remarks } = walletActionSchema.parse(req.body);
  const result = await adminService.creditWallet(id, amount, remarks, req.adminUser.id);
  return successResponse(res, result, 'Wallet credited successfully');
}

/**
 * POST /users/:id/wallet/debit
 * Debits a user's wallet.
 */
async function debitWallet(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { amount, remarks } = walletActionSchema.parse(req.body);
  const result = await adminService.debitWallet(id, amount, remarks, req.adminUser.id);
  return successResponse(res, result, 'Wallet debited successfully');
}

/**
 * GET /users/:id/transactions
 * Gets a user's wallet transactions.
 */
async function getUserTransactions(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const filters = paginationSchema.parse(req.query);
  const { data, meta } = await adminService.getUserTransactions(id, filters);
  return successResponse(res, { transactions: data }, 'Transactions retrieved successfully', 200, meta);
}

/**
 * GET /users/:id/subscriptions
 * Gets a user's subscription history.
 */
async function getUserSubscriptions(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const filters = paginationSchema.parse(req.query);
  const { data, meta } = await adminService.getUserSubscriptions(id, filters);
  return successResponse(res, { subscriptions: data }, 'Subscriptions retrieved successfully', 200, meta);
}

/**
 * GET /users/:id/invoices
 * Gets a user's invoices.
 */
async function getUserInvoices(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const filters = paginationSchema.parse(req.query);
  const { data, meta } = await adminService.getUserInvoices(id, filters);
  return successResponse(res, { invoices: data }, 'Invoices retrieved successfully', 200, meta);
}

// ===========================================================================
// PLAN CONTROLLERS
// ===========================================================================

/**
 * POST /plans
 * Creates a new subscription plan.
 */
async function createPlan(req, res) {
  const data = createPlanSchema.parse(req.body);
  const result = await adminService.createPlan(data);
  return successResponse(res, result, 'Plan created successfully', 201);
}

/**
 * GET /plans
 * Lists all plans with pagination.
 */
async function listPlans(req, res) {
  const filters = paginationSchema.parse(req.query);
  const { data, meta } = await adminService.listPlans(filters);
  return successResponse(res, { plans: data }, 'Plans retrieved successfully', 200, meta);
}

/**
 * GET /plans/:id
 * Gets a single plan.
 */
async function getPlan(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const plan = await adminService.getPlan(id);
  return successResponse(res, plan, 'Plan retrieved successfully');
}

/**
 * PUT /plans/:id
 * Updates a plan.
 */
async function updatePlan(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const data = updatePlanSchema.parse(req.body);
  const result = await adminService.updatePlan(id, data);
  return successResponse(res, result, 'Plan updated successfully');
}

/**
 * DELETE /plans/:id
 * Soft-deletes a plan.
 */
async function deletePlan(req, res) {
  const { id } = idParamSchema.parse(req.params);
  await adminService.deletePlan(id);
  return successResponse(res, null, 'Plan deleted successfully');
}

/**
 * PUT /plans/:id/status
 * Updates the active/inactive status of a plan.
 */
async function updatePlanStatus(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { is_active } = planStatusSchema.parse(req.body);
  const result = await adminService.updatePlanStatus(id, is_active);
  return successResponse(res, result, 'Plan status updated successfully');
}

// ===========================================================================
// COUPON CONTROLLERS
// ===========================================================================

/**
 * POST /coupons
 * Creates a new coupon.
 */
async function createCoupon(req, res) {
  const data = createCouponSchema.parse(req.body);
  const result = await adminService.createCoupon(data);
  return successResponse(res, result, 'Coupon created successfully', 201);
}

/**
 * GET /coupons
 * Lists all coupons with pagination.
 */
async function listCoupons(req, res) {
  const filters = paginationSchema.parse(req.query);
  const { data, meta } = await adminService.listCoupons(filters);
  return successResponse(res, { coupons: data }, 'Coupons retrieved successfully', 200, meta);
}

/**
 * GET /coupons/:id
 * Gets a single coupon.
 */
async function getCoupon(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const coupon = await adminService.getCoupon(id);
  return successResponse(res, coupon, 'Coupon retrieved successfully');
}

/**
 * PUT /coupons/:id
 * Updates a coupon.
 */
async function updateCoupon(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const data = updateCouponSchema.parse(req.body);
  const result = await adminService.updateCoupon(id, data);
  return successResponse(res, result, 'Coupon updated successfully');
}

/**
 * DELETE /coupons/:id
 * Soft-deletes a coupon.
 */
async function deleteCoupon(req, res) {
  const { id } = idParamSchema.parse(req.params);
  await adminService.deleteCoupon(id);
  return successResponse(res, null, 'Coupon deleted successfully');
}

// ===========================================================================
// NOTIFICATION CONTROLLERS
// ===========================================================================

/**
 * POST /notifications
 * Creates and sends a broadcast notification.
 */
async function createBroadcast(req, res) {
  const data = createNotificationSchema.parse(req.body);
  const kafkaProducer = req.app.locals.kafkaProducer || null;
  const result = await adminService.createBroadcast(data, req.adminUser.id, kafkaProducer);
  return successResponse(res, result, 'Broadcast notification sent successfully', 201);
}

/**
 * GET /notifications
 * Lists past broadcast notifications.
 */
async function listBroadcasts(req, res) {
  const filters = paginationSchema.parse(req.query);
  const { data, meta } = await adminService.listBroadcasts(filters);
  return successResponse(res, { notifications: data }, 'Broadcasts retrieved successfully', 200, meta);
}

// ===========================================================================
// SETTINGS CONTROLLERS
// ===========================================================================

/**
 * GET /settings
 * Gets all admin settings grouped by group.
 */
async function getAllSettings(req, res) {
  const settings = await adminService.getAllSettings();
  return successResponse(res, settings, 'Settings retrieved successfully');
}

/**
 * GET /settings/:group
 * Gets settings for a specific group.
 */
async function getSettingsByGroup(req, res) {
  const { group } = req.params;
  const settings = await adminService.getSettingsByGroup(group);
  return successResponse(res, settings, `Settings for "${group}" retrieved successfully`);
}

/**
 * PUT /settings/:group
 * Updates settings for a specific group.
 */
async function updateSettings(req, res) {
  const { group } = req.params;
  const data = updateSettingsSchema.parse(req.body);
  const result = await adminService.updateSettings(group, data, req.adminUser.id);
  return successResponse(res, result, `Settings for "${group}" updated successfully`);
}

/**
 * GET /settings/public (no auth)
 * Gets public settings for the frontend.
 */
async function getPublicSettings(_req, res) {
  const settings = await adminService.getPublicSettings();
  return successResponse(res, settings, 'Public settings retrieved successfully');
}

// ===========================================================================
// ROLE CONTROLLERS
// ===========================================================================

/**
 * POST /roles
 * Creates a new admin role.
 */
async function createRole(req, res) {
  const data = createRoleSchema.parse(req.body);
  const result = await adminService.createRole(data);
  return successResponse(res, result, 'Role created successfully', 201);
}

/**
 * GET /roles
 * Lists all admin roles.
 */
async function listRoles(_req, res) {
  const roles = await adminService.listRoles();
  return successResponse(res, { roles }, 'Roles retrieved successfully');
}

/**
 * PUT /roles/:id
 * Updates an admin role.
 */
async function updateRole(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const data = updateRoleSchema.parse(req.body);
  const result = await adminService.updateRole(id, data);
  return successResponse(res, result, 'Role updated successfully');
}

/**
 * DELETE /roles/:id
 * Deletes an admin role.
 */
async function deleteRole(req, res) {
  const { id } = idParamSchema.parse(req.params);
  await adminService.deleteRole(id);
  return successResponse(res, null, 'Role deleted successfully');
}

module.exports = {
  // Sub-admins
  createSubAdmin,
  listSubAdmins,
  updateSubAdmin,
  deleteSubAdmin,

  // Users
  listUsers,
  getUser,
  createUser,
  updateUserStatus,
  deleteUser,
  creditWallet,
  debitWallet,
  getUserTransactions,
  getUserSubscriptions,
  getUserInvoices,

  // Plans
  createPlan,
  listPlans,
  getPlan,
  updatePlan,
  deletePlan,
  updatePlanStatus,

  // Coupons
  createCoupon,
  listCoupons,
  getCoupon,
  updateCoupon,
  deleteCoupon,

  // Notifications
  createBroadcast,
  listBroadcasts,

  // Settings
  getAllSettings,
  getSettingsByGroup,
  updateSettings,
  getPublicSettings,

  // Roles
  createRole,
  listRoles,
  updateRole,
  deleteRole,
};
