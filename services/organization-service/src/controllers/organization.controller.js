'use strict';

const { successResponse } = require('@nyife/shared-utils');
const organizationService = require('../services/organization.service');
const {
  createOrgSchema,
  updateOrgSchema,
  inviteMemberSchema,
  updateMemberSchema,
  createMemberAccountSchema,
  orgIdParamSchema,
  memberIdParamSchema,
  invitationIdParamSchema,
  listMembersQuerySchema,
  listInvitationsQuerySchema,
  internalValidateTeamMemberSchema,
  acceptInvitationSchema,
  resolveOrgContextSchema,
} = require('../validations/organization.validation');

/**
 * POST /api/v1/organizations
 * Creates a new organization for the authenticated user.
 */
async function createOrganization(req, res) {
  const validatedBody = createOrgSchema.parse(req.body);
  const userId = req.user.id;

  const organization = await organizationService.createOrganization(
    userId,
    req.organizationId || req.headers['x-organization-id'] || null,
    validatedBody,
    req.user.organizationRole || req.user.role
  );

  return successResponse(res, organization, 'Organization created successfully', 201);
}

/**
 * GET /api/v1/organizations
 * Lists all organizations belonging to the authenticated user (paginated).
 */
async function listOrganizations(req, res) {
  const userId = req.user.id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const { organizations, meta } = await organizationService.listOrganizations(userId, page, limit);

  return successResponse(res, organizations, 'Organizations retrieved successfully', 200, meta);
}

/**
 * GET /api/v1/organizations/:id
 * Retrieves a single organization by ID.
 */
async function getOrganization(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const userId = req.user.id;

  const organization = await organizationService.getOrganization(userId, id);

  return successResponse(res, organization, 'Organization retrieved successfully');
}

/**
 * PUT /api/v1/organizations/:id
 * Updates an organization.
 */
async function updateOrganization(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const validatedBody = updateOrgSchema.parse(req.body);
  const userId = req.user.id;

  const organization = await organizationService.updateOrganization(userId, id, validatedBody);

  return successResponse(res, organization, 'Organization updated successfully');
}

/**
 * DELETE /api/v1/organizations/:id
 * Soft-deletes an organization.
 */
async function deleteOrganization(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const userId = req.user.id;

  await organizationService.deleteOrganization(userId, id);

  return successResponse(res, null, 'Organization deleted successfully');
}

/**
 * POST /api/v1/organizations/:id/members
 * Invites a team member to an organization.
 */
async function inviteTeamMember(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const validatedBody = inviteMemberSchema.parse(req.body);
  const userId = req.user.id;

  const member = await organizationService.inviteTeamMember(
    userId,
    id,
    validatedBody,
    req.organizationId || req.headers['x-organization-id'] || id
  );

  return successResponse(res, member, 'Team invitation sent successfully', 201);
}

async function createTeamMemberAccount(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const validatedBody = createMemberAccountSchema.parse(req.body);
  const userId = req.user.id;

  const member = await organizationService.createTeamMemberAccount(userId, id, validatedBody);

  return successResponse(
    res,
    member,
    'Team account created successfully. Share the temporary password securely with the team member.',
    201
  );
}

async function acceptInvitation(req, res) {
  const validatedBody = acceptInvitationSchema.parse(req.body);
  const result = await organizationService.acceptInvitation(req.user?.id || null, validatedBody);
  return successResponse(res, result, 'Invitation accepted successfully');
}

async function getMyOrganizations(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const { organizations, meta } = await organizationService.listOrganizations(req.user.id, page, limit);
  return successResponse(res, organizations, 'Organizations retrieved successfully', 200, meta);
}

/**
 * GET /api/v1/organizations/:id/members
 * Lists team members of an organization (paginated).
 */
async function listTeamMembers(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const userId = req.user.id;
  const filters = listMembersQuerySchema.parse(req.query);

  const { members, meta } = await organizationService.listTeamMembers(
    userId,
    id,
    filters.page,
    filters.limit,
    filters
  );

  return successResponse(res, members, 'Team members retrieved successfully', 200, meta);
}

async function listInvitations(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const { page, limit } = listInvitationsQuerySchema.parse(req.query);
  const invitations = await organizationService.listInvitations(req.user.id, id, page, limit);
  return successResponse(res, invitations.invitations, 'Invitations retrieved successfully', 200, invitations.meta);
}

async function resendInvitation(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const { invitationId } = invitationIdParamSchema.parse(req.params);
  const invitation = await organizationService.resendInvitation(req.user.id, id, invitationId);
  return successResponse(res, invitation, 'Invitation resent successfully');
}

async function revokeInvitation(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const { invitationId } = invitationIdParamSchema.parse(req.params);
  await organizationService.revokeInvitation(req.user.id, id, invitationId);
  return successResponse(res, null, 'Invitation revoked successfully');
}

async function deleteInvitation(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const { invitationId } = invitationIdParamSchema.parse(req.params);
  await organizationService.deleteInvitation(req.user.id, id, invitationId);
  return successResponse(res, null, 'Invitation deleted successfully');
}

/**
 * PUT /api/v1/organizations/:id/members/:memberId
 * Updates a team member's role, permissions, or status.
 */
async function updateTeamMember(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const { memberId } = memberIdParamSchema.parse(req.params);
  const validatedBody = updateMemberSchema.parse(req.body);
  const userId = req.user.id;

  const member = await organizationService.updateTeamMember(userId, id, memberId, validatedBody);

  return successResponse(res, member, 'Team member updated successfully');
}

/**
 * DELETE /api/v1/organizations/:id/members/:memberId
 * Permanently removes a team member from an organization.
 */
async function removeTeamMember(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const { memberId } = memberIdParamSchema.parse(req.params);
  const userId = req.user.id;

  await organizationService.removeTeamMember(userId, id, memberId);

  return successResponse(res, null, 'Team member removed successfully');
}

async function validateTeamMemberAccess(req, res) {
  const userId = req.user?.id || req.headers['x-user-id'];
  const data = internalValidateTeamMemberSchema.parse(req.body);

  const member = await organizationService.validateTeamMemberAccess(
    userId,
    data.member_user_id,
    req.body.organization_id || req.headers['x-organization-id'],
    data.resource,
    data.permission
  );

  return successResponse(res, { member }, 'Team member validated successfully');
}

async function resolveOrganizationContext(req, res) {
  const data = resolveOrgContextSchema.parse(req.body);
  const context = await organizationService.resolveOrganizationContext(data.user_id, data.organization_id || null);
  return successResponse(res, context, 'Organization context resolved successfully');
}

module.exports = {
  createOrganization,
  listOrganizations,
  getMyOrganizations,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  inviteTeamMember,
  createTeamMemberAccount,
  acceptInvitation,
  listTeamMembers,
  listInvitations,
  resendInvitation,
  revokeInvitation,
  deleteInvitation,
  updateTeamMember,
  removeTeamMember,
  resolveOrganizationContext,
  validateTeamMemberAccess,
};
