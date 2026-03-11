'use strict';

const { Router } = require('express');
const { authenticate, authenticateOptional, organizationResolver, asyncHandler, requireActiveSubscription, rbac } = require('@nyife/shared-middleware');
const controller = require('../controllers/organization.controller');

const router = Router();

router.post('/internal/context/resolve', asyncHandler(controller.resolveOrganizationContext));
router.post('/internal/team-members/validate', asyncHandler(controller.validateTeamMemberAccess));
router.post('/invitations/accept', authenticateOptional, asyncHandler(controller.acceptInvitation));

router.use(authenticate);
router.use(organizationResolver);

// ---------------------------------------------------------------------------
// Organization CRUD
// ---------------------------------------------------------------------------

router.get('/me', asyncHandler(controller.getMyOrganizations));

// POST /api/v1/organizations — Create a new organization
router.post('/', rbac('organizations', 'create'), requireActiveSubscription('create organizations'), asyncHandler(controller.createOrganization));

// GET /api/v1/organizations — List user's organizations
router.get('/', rbac('organizations', 'read'), asyncHandler(controller.listOrganizations));

// GET /api/v1/organizations/:id — Get a single organization
router.get('/:id', rbac('organizations', 'read'), asyncHandler(controller.getOrganization));

// PUT /api/v1/organizations/:id — Update an organization
router.put('/:id', rbac('organizations', 'update'), requireActiveSubscription('update organizations'), asyncHandler(controller.updateOrganization));

// DELETE /api/v1/organizations/:id — Delete an organization (soft delete)
router.delete('/:id', rbac('organizations', 'delete'), requireActiveSubscription('delete organizations'), asyncHandler(controller.deleteOrganization));

// ---------------------------------------------------------------------------
// Team Member management (nested under organization)
// ---------------------------------------------------------------------------

// POST /api/v1/organizations/:id/members — Invite a team member
router.post('/:id/members', rbac('team_members', 'create'), requireActiveSubscription('invite team members'), asyncHandler(controller.inviteTeamMember));

router.post('/:id/members/create-account', rbac('team_members', 'create'), requireActiveSubscription('create team member accounts'), asyncHandler(controller.createTeamMemberAccount));

// GET /api/v1/organizations/:id/members — List team members
router.get('/:id/members', rbac('team_members', 'read'), asyncHandler(controller.listTeamMembers));

router.get('/:id/invitations', rbac('team_members', 'read'), asyncHandler(controller.listInvitations));

router.post('/:id/invitations/:invitationId/resend', rbac('team_members', 'create'), requireActiveSubscription('resend team invitations'), asyncHandler(controller.resendInvitation));

router.delete('/:id/invitations/:invitationId', rbac('team_members', 'delete'), requireActiveSubscription('revoke team invitations'), asyncHandler(controller.revokeInvitation));

// PUT /api/v1/organizations/:id/members/:memberId — Update a team member
router.put('/:id/members/:memberId', rbac('team_members', 'update'), requireActiveSubscription('update team members'), asyncHandler(controller.updateTeamMember));

// DELETE /api/v1/organizations/:id/members/:memberId — Remove a team member
router.delete('/:id/members/:memberId', rbac('team_members', 'delete'), requireActiveSubscription('remove team members'), asyncHandler(controller.removeTeamMember));

module.exports = router;
