'use strict';

const { Router } = require('express');
const {
  authenticate,
  authenticateOptional,
  organizationResolver,
  organizationParamResolver,
  asyncHandler,
  requireActiveSubscription,
  rbac,
} = require('@nyife/shared-middleware');
const controller = require('../controllers/organization.controller');

const router = Router();

router.post('/internal/context/resolve', asyncHandler(controller.resolveOrganizationContext));
router.post('/internal/team-members/validate', asyncHandler(controller.validateTeamMemberAccess));
router.post('/invitations/accept', authenticateOptional, asyncHandler(controller.acceptInvitation));

router.use(authenticate);

router.get('/me', asyncHandler(controller.getMyOrganizations));
router.get('/', organizationResolver, rbac('organizations', 'read'), asyncHandler(controller.listOrganizations));

// ---------------------------------------------------------------------------
// Organization CRUD
// ---------------------------------------------------------------------------

// POST /api/v1/organizations — Create a new organization
router.post(
  '/',
  organizationResolver,
  rbac('organizations', 'create'),
  requireActiveSubscription('create organizations'),
  asyncHandler(controller.createOrganization)
);

// GET /api/v1/organizations/:id — Get a single organization
router.get('/:id', organizationParamResolver('id'), rbac('organizations', 'read'), asyncHandler(controller.getOrganization));

// PUT /api/v1/organizations/:id — Update an organization
router.put(
  '/:id',
  organizationParamResolver('id'),
  rbac('organizations', 'update'),
  requireActiveSubscription('update organizations'),
  asyncHandler(controller.updateOrganization)
);

// DELETE /api/v1/organizations/:id — Delete an organization (soft delete)
router.delete(
  '/:id',
  organizationParamResolver('id'),
  rbac('organizations', 'delete'),
  requireActiveSubscription('delete organizations'),
  asyncHandler(controller.deleteOrganization)
);

// ---------------------------------------------------------------------------
// Team Member management (nested under organization)
// ---------------------------------------------------------------------------

// POST /api/v1/organizations/:id/members — Invite a team member
router.post(
  '/:id/members',
  organizationParamResolver('id'),
  rbac('team_members', 'create'),
  requireActiveSubscription('invite team members'),
  asyncHandler(controller.inviteTeamMember)
);

router.post(
  '/:id/members/create-account',
  organizationParamResolver('id'),
  rbac('team_members', 'create'),
  requireActiveSubscription('create team member accounts'),
  asyncHandler(controller.createTeamMemberAccount)
);

// GET /api/v1/organizations/:id/members — List team members
router.get('/:id/members', organizationParamResolver('id'), rbac('team_members', 'read'), asyncHandler(controller.listTeamMembers));

router.get('/:id/invitations', organizationParamResolver('id'), rbac('team_members', 'read'), asyncHandler(controller.listInvitations));

router.post(
  '/:id/invitations/:invitationId/resend',
  organizationParamResolver('id'),
  rbac('team_members', 'create'),
  requireActiveSubscription('resend team invitations'),
  asyncHandler(controller.resendInvitation)
);

router.post(
  '/:id/invitations/:invitationId/revoke',
  organizationParamResolver('id'),
  rbac('team_members', 'delete'),
  requireActiveSubscription('revoke team invitations'),
  asyncHandler(controller.revokeInvitation)
);

router.delete(
  '/:id/invitations/:invitationId',
  organizationParamResolver('id'),
  rbac('team_members', 'delete'),
  requireActiveSubscription('delete team invitations'),
  asyncHandler(controller.deleteInvitation)
);

// PUT /api/v1/organizations/:id/members/:memberId — Update a team member
router.put(
  '/:id/members/:memberId',
  organizationParamResolver('id'),
  rbac('team_members', 'update'),
  requireActiveSubscription('update team members'),
  asyncHandler(controller.updateTeamMember)
);

// DELETE /api/v1/organizations/:id/members/:memberId — Remove a team member
router.delete(
  '/:id/members/:memberId',
  organizationParamResolver('id'),
  rbac('team_members', 'delete'),
  requireActiveSubscription('remove team members'),
  asyncHandler(controller.removeTeamMember)
);

module.exports = router;
