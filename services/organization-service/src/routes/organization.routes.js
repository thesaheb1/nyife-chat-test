'use strict';

const { Router } = require('express');
const { authenticate, tenantResolver, asyncHandler, requireActiveSubscription } = require('@nyife/shared-middleware');
const controller = require('../controllers/organization.controller');

const router = Router();

// All routes require authentication and tenant resolution
router.use(authenticate);
router.use(tenantResolver);

// ---------------------------------------------------------------------------
// Organization CRUD
// ---------------------------------------------------------------------------

// POST /api/v1/organizations — Create a new organization
router.post('/', requireActiveSubscription('create organizations'), asyncHandler(controller.createOrganization));

// GET /api/v1/organizations — List user's organizations
router.get('/', asyncHandler(controller.listOrganizations));

// GET /api/v1/organizations/:id — Get a single organization
router.get('/:id', asyncHandler(controller.getOrganization));

// PUT /api/v1/organizations/:id — Update an organization
router.put('/:id', requireActiveSubscription('update organizations'), asyncHandler(controller.updateOrganization));

// DELETE /api/v1/organizations/:id — Delete an organization (soft delete)
router.delete('/:id', requireActiveSubscription('delete organizations'), asyncHandler(controller.deleteOrganization));

// ---------------------------------------------------------------------------
// Team Member management (nested under organization)
// ---------------------------------------------------------------------------

// POST /api/v1/organizations/:id/members — Invite a team member
router.post('/:id/members', requireActiveSubscription('invite team members'), asyncHandler(controller.inviteTeamMember));

// GET /api/v1/organizations/:id/members — List team members
router.get('/:id/members', asyncHandler(controller.listTeamMembers));

// PUT /api/v1/organizations/:id/members/:memberId — Update a team member
router.put('/:id/members/:memberId', requireActiveSubscription('update team members'), asyncHandler(controller.updateTeamMember));

// DELETE /api/v1/organizations/:id/members/:memberId — Remove a team member
router.delete('/:id/members/:memberId', requireActiveSubscription('remove team members'), asyncHandler(controller.removeTeamMember));

// POST /api/v1/organizations/internal/team-members/validate — Internal chat assignment guard
router.post('/internal/team-members/validate', asyncHandler(controller.validateTeamMemberAccess));

module.exports = router;
