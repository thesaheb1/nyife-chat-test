'use strict';

const express = require('express');
const router = express.Router();

const { asyncHandler, authenticateOptional } = require('@nyife/shared-middleware');
const ctrl = require('../controllers/admin.controller');
const { adminRbac, superAdminOnly } = require('../middlewares/adminRbac');
const { avatarUpload } = require('../middlewares/upload');

// ===========================================================================
// Public invitation routes
// ===========================================================================
router.get('/invitations/validate', asyncHandler(ctrl.validateAdminInvitation));
router.post('/invitations/accept', authenticateOptional, asyncHandler(ctrl.acceptAdminInvitation));
router.get('/users/invitations/validate', asyncHandler(ctrl.validateUserInvitation));
router.post('/users/invitations/accept', asyncHandler(ctrl.acceptUserInvitation));
router.get('/users/avatar/:id', asyncHandler(ctrl.streamUserAvatar));

// ===========================================================================
// Authenticated authorization bootstrap
// ===========================================================================
router.get('/me/authorization', asyncHandler(ctrl.getMyAdminAuthorization));

// ===========================================================================
// Sub-admins (super admin only)
// ===========================================================================
router.post('/sub-admins', superAdminOnly, asyncHandler(ctrl.createSubAdmin));
router.get('/sub-admins', superAdminOnly, asyncHandler(ctrl.listSubAdmins));
router.post('/sub-admins/invitations', superAdminOnly, asyncHandler(ctrl.inviteSubAdmin));
router.get('/sub-admins/invitations', superAdminOnly, asyncHandler(ctrl.listSubAdminInvitations));
router.post('/sub-admins/invitations/:id/resend', superAdminOnly, asyncHandler(ctrl.resendSubAdminInvitation));
router.delete('/sub-admins/invitations/:id', superAdminOnly, asyncHandler(ctrl.revokeSubAdminInvitation));
router.put('/sub-admins/:id', superAdminOnly, asyncHandler(ctrl.updateSubAdmin));
router.delete('/sub-admins/:id', superAdminOnly, asyncHandler(ctrl.deleteSubAdmin));

// ===========================================================================
// Roles (super admin only)
// ===========================================================================
router.post('/roles', superAdminOnly, asyncHandler(ctrl.createRole));
router.get('/roles', superAdminOnly, asyncHandler(ctrl.listRoles));
router.put('/roles/:id', superAdminOnly, asyncHandler(ctrl.updateRole));
router.delete('/roles/:id', superAdminOnly, asyncHandler(ctrl.deleteRole));

// ===========================================================================
// Users (admin RBAC: users resource)
// ===========================================================================
router.get('/users', adminRbac('users', 'read'), asyncHandler(ctrl.listUsers));
router.post('/users', adminRbac('users', 'create'), asyncHandler(ctrl.createUser));
router.get('/users/invitations', adminRbac('users', 'read'), asyncHandler(ctrl.listUserInvitations));
router.post('/users/invitations', adminRbac('users', 'create'), asyncHandler(ctrl.inviteUser));
router.post('/users/invitations/:id/resend', adminRbac('users', 'create'), asyncHandler(ctrl.resendUserInvitation));
router.delete('/users/invitations/:id', adminRbac('users', 'delete'), asyncHandler(ctrl.revokeUserInvitation));
router.get('/users/:id/dashboard', adminRbac('users', 'read'), asyncHandler(ctrl.getUserDashboard));
router.get('/users/:id/team-members', adminRbac('users', 'read'), asyncHandler(ctrl.getUserTeamMembers));
router.get('/users/:id', adminRbac('users', 'read'), asyncHandler(ctrl.getUser));
router.put('/users/:id', adminRbac('users', 'update'), asyncHandler(ctrl.updateUser));
router.put('/users/:id/status', adminRbac('users', 'update'), asyncHandler(ctrl.updateUserStatus));
router.delete('/users/:id', adminRbac('users', 'delete'), asyncHandler(ctrl.deleteUser));
router.post('/users/:id/avatar', adminRbac('users', 'update'), avatarUpload.single('file'), asyncHandler(ctrl.uploadUserAvatar));
router.delete('/users/:id/avatar', adminRbac('users', 'update'), asyncHandler(ctrl.removeUserAvatar));
router.post('/users/:id/wallet/credit', adminRbac('users', 'update'), asyncHandler(ctrl.creditWallet));
router.post('/users/:id/wallet/debit', adminRbac('users', 'update'), asyncHandler(ctrl.debitWallet));
router.get('/users/:id/transactions', adminRbac('users', 'read'), asyncHandler(ctrl.getUserTransactions));
router.get('/users/:id/subscriptions', adminRbac('users', 'read'), asyncHandler(ctrl.getUserSubscriptions));
router.get('/users/:id/invoices', adminRbac('users', 'read'), asyncHandler(ctrl.getUserInvoices));

// ===========================================================================
// Plans (admin RBAC: plans resource)
// ===========================================================================
router.post('/plans', adminRbac('plans', 'create'), asyncHandler(ctrl.createPlan));
router.get('/plans', adminRbac('plans', 'read'), asyncHandler(ctrl.listPlans));
router.get('/plans/:id', adminRbac('plans', 'read'), asyncHandler(ctrl.getPlan));
router.put('/plans/:id', adminRbac('plans', 'update'), asyncHandler(ctrl.updatePlan));
router.delete('/plans/:id', adminRbac('plans', 'delete'), asyncHandler(ctrl.deletePlan));
router.put('/plans/:id/status', adminRbac('plans', 'update'), asyncHandler(ctrl.updatePlanStatus));

// ===========================================================================
// Coupons (admin RBAC: plans resource since related)
// ===========================================================================
router.post('/coupons', adminRbac('plans', 'create'), asyncHandler(ctrl.createCoupon));
router.get('/coupons', adminRbac('plans', 'read'), asyncHandler(ctrl.listCoupons));
router.get('/coupons/:id', adminRbac('plans', 'read'), asyncHandler(ctrl.getCoupon));
router.put('/coupons/:id', adminRbac('plans', 'update'), asyncHandler(ctrl.updateCoupon));
router.delete('/coupons/:id', adminRbac('plans', 'delete'), asyncHandler(ctrl.deleteCoupon));

// ===========================================================================
// Notifications (admin RBAC: notifications resource)
// ===========================================================================
router.post('/notifications', adminRbac('notifications', 'create'), asyncHandler(ctrl.createBroadcast));
router.get('/notifications', adminRbac('notifications', 'read'), asyncHandler(ctrl.listBroadcasts));
router.post('/email/send', adminRbac('emails', 'create'), asyncHandler(ctrl.sendAdminEmail));

// ===========================================================================
// Settings (admin RBAC: settings resource)
// ===========================================================================
router.get('/settings', adminRbac('settings', 'read'), asyncHandler(ctrl.getAllSettings));
router.get('/settings/:group', adminRbac('settings', 'read'), asyncHandler(ctrl.getSettingsByGroup));
router.put('/settings/:group', adminRbac('settings', 'update'), asyncHandler(ctrl.updateSettings));

module.exports = router;
