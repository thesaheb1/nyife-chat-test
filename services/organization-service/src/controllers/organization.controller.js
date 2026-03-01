'use strict';

const { successResponse } = require('@nyife/shared-utils');
const organizationService = require('../services/organization.service');
const {
  createOrgSchema,
  updateOrgSchema,
  inviteMemberSchema,
  updateMemberSchema,
  orgIdParamSchema,
  memberIdParamSchema,
} = require('../validations/organization.validation');

/**
 * POST /api/v1/organizations
 * Creates a new organization for the authenticated user.
 */
async function createOrganization(req, res) {
  const validatedBody = createOrgSchema.parse(req.body);
  const userId = req.tenantId;

  const organization = await organizationService.createOrganization(userId, validatedBody);

  return successResponse(res, organization, 'Organization created successfully', 201);
}

/**
 * GET /api/v1/organizations
 * Lists all organizations belonging to the authenticated user (paginated).
 */
async function listOrganizations(req, res) {
  const userId = req.tenantId;
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
  const userId = req.tenantId;

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
  const userId = req.tenantId;

  const organization = await organizationService.updateOrganization(userId, id, validatedBody);

  return successResponse(res, organization, 'Organization updated successfully');
}

/**
 * DELETE /api/v1/organizations/:id
 * Soft-deletes an organization.
 */
async function deleteOrganization(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const userId = req.tenantId;

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
  const userId = req.tenantId;

  const member = await organizationService.inviteTeamMember(userId, id, validatedBody);

  return successResponse(res, member, 'Team member invited successfully', 201);
}

/**
 * GET /api/v1/organizations/:id/members
 * Lists team members of an organization (paginated).
 */
async function listTeamMembers(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const userId = req.tenantId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const { members, meta } = await organizationService.listTeamMembers(userId, id, page, limit);

  return successResponse(res, members, 'Team members retrieved successfully', 200, meta);
}

/**
 * PUT /api/v1/organizations/:id/members/:memberId
 * Updates a team member's role, permissions, or status.
 */
async function updateTeamMember(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const { memberId } = memberIdParamSchema.parse(req.params);
  const validatedBody = updateMemberSchema.parse(req.body);
  const userId = req.tenantId;

  const member = await organizationService.updateTeamMember(userId, id, memberId, validatedBody);

  return successResponse(res, member, 'Team member updated successfully');
}

/**
 * DELETE /api/v1/organizations/:id/members/:memberId
 * Removes a team member from an organization (soft-delete).
 */
async function removeTeamMember(req, res) {
  const { id } = orgIdParamSchema.parse(req.params);
  const { memberId } = memberIdParamSchema.parse(req.params);
  const userId = req.tenantId;

  await organizationService.removeTeamMember(userId, id, memberId);

  return successResponse(res, null, 'Team member removed successfully');
}

module.exports = {
  createOrganization,
  listOrganizations,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  inviteTeamMember,
  listTeamMembers,
  updateTeamMember,
  removeTeamMember,
};
