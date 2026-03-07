'use strict';

const { Op } = require('sequelize');
const { Organization, TeamMember, User, sequelize } = require('../models');
const { AppError, generateUUID, slugify, getPagination, getPaginationMeta } = require('@nyife/shared-utils');
const { TOPICS, publishEvent } = require('@nyife/shared-events');
const { createKafkaProducer } = require('@nyife/shared-config');

let kafkaProducer = null;

/**
 * Lazily initializes and returns the Kafka producer.
 * The producer is created once and reused for all subsequent calls.
 *
 * @returns {Promise<import('kafkajs').Producer>}
 */
async function getKafkaProducer() {
  if (!kafkaProducer) {
    try {
      kafkaProducer = await createKafkaProducer('organization-service');
    } catch (error) {
      console.error('[organization-service] Failed to create Kafka producer:', error.message);
      return null;
    }
  }
  return kafkaProducer;
}

/**
 * Generates a unique slug for an organization.
 * If the base slug already exists, appends a short random suffix.
 *
 * @param {string} name - The organization name to slugify
 * @returns {Promise<string>} A unique slug
 */
async function generateUniqueSlug(name) {
  const baseSlug = slugify(name);

  const existing = await Organization.findOne({
    where: { slug: baseSlug },
    paranoid: false,
  });

  if (!existing) {
    return baseSlug;
  }

  // Append a short random suffix to ensure uniqueness
  const suffix = generateUUID().substring(0, 8);
  const candidateSlug = `${baseSlug}-${suffix}`;

  // Final check (extremely unlikely to collide, but be safe)
  const existingCandidate = await Organization.findOne({
    where: { slug: candidateSlug },
    paranoid: false,
  });

  if (!existingCandidate) {
    return candidateSlug;
  }

  // Last resort: use full UUID segment
  return `${baseSlug}-${generateUUID().substring(0, 12)}`;
}

/**
 * Creates a new organization for the given user.
 *
 * @param {string} userId - The owner's user ID
 * @param {object} data - Organization data { name, description }
 * @returns {Promise<object>} The created organization
 */
async function createOrganization(userId, data) {
  const slug = await generateUniqueSlug(data.name);

  const organization = await Organization.create({
    id: generateUUID(),
    user_id: userId,
    name: data.name,
    description: data.description || null,
    slug,
    status: 'active',
  });

  return organization;
}

/**
 * Lists organizations belonging to the given user with pagination.
 *
 * @param {string} userId - The owner's user ID
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Records per page
 * @returns {Promise<{ organizations: object[], meta: object }>}
 */
async function listOrganizations(userId, page, limit) {
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);

  const { count, rows } = await Organization.findAndCountAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
  });

  const meta = getPaginationMeta(count, page, limit);

  return { organizations: rows, meta };
}

/**
 * Retrieves a single organization by ID, verifying it belongs to the user.
 *
 * @param {string} userId - The owner's user ID
 * @param {string} orgId - The organization ID
 * @returns {Promise<object>} The organization
 * @throws {AppError} 404 if not found
 */
async function getOrganization(userId, orgId) {
  const organization = await Organization.findOne({
    where: {
      id: orgId,
      user_id: userId,
    },
    include: [
      {
        model: TeamMember,
        as: 'teamMembers',
        attributes: ['id', 'member_user_id', 'role_title', 'status', 'invited_at', 'joined_at'],
        required: false,
      },
    ],
  });

  if (!organization) {
    throw AppError.notFound('Organization not found');
  }

  return organization;
}

/**
 * Updates an organization, verifying ownership first.
 *
 * @param {string} userId - The owner's user ID
 * @param {string} orgId - The organization ID
 * @param {object} data - Fields to update { name, description, status }
 * @returns {Promise<object>} The updated organization
 * @throws {AppError} 404 if not found
 */
async function updateOrganization(userId, orgId, data) {
  const organization = await Organization.findOne({
    where: {
      id: orgId,
      user_id: userId,
    },
  });

  if (!organization) {
    throw AppError.notFound('Organization not found');
  }

  // If name is being changed, regenerate the slug
  const updateData = { ...data };
  if (data.name && data.name !== organization.name) {
    updateData.slug = await generateUniqueSlug(data.name);
  }

  await organization.update(updateData);

  return organization;
}

/**
 * Soft-deletes an organization, verifying ownership first.
 *
 * @param {string} userId - The owner's user ID
 * @param {string} orgId - The organization ID
 * @returns {Promise<void>}
 * @throws {AppError} 404 if not found
 */
async function deleteOrganization(userId, orgId) {
  const organization = await Organization.findOne({
    where: {
      id: orgId,
      user_id: userId,
    },
  });

  if (!organization) {
    throw AppError.notFound('Organization not found');
  }

  // Soft-delete all team members in this organization, then the organization itself
  await sequelize.transaction(async (t) => {
    await TeamMember.destroy({
      where: { organization_id: orgId },
      transaction: t,
    });

    await organization.destroy({ transaction: t });
  });
}

/**
 * Invites a team member to an organization.
 * - Verifies the org belongs to the user (owner)
 * - Checks if the member is already part of the org
 * - Looks up or references the member by email in auth_users
 * - Creates the team member entry
 * - Publishes an email.send Kafka event for the invite
 *
 * @param {string} userId - The owner's user ID
 * @param {string} orgId - The organization ID
 * @param {object} memberData - { first_name, last_name, email, role_title, permissions }
 * @returns {Promise<object>} The created team member
 * @throws {AppError} 404 if org not found, 409 if member already exists
 */
async function inviteTeamMember(userId, orgId, memberData) {
  // Verify organization ownership
  const organization = await Organization.findOne({
    where: {
      id: orgId,
      user_id: userId,
    },
  });

  if (!organization) {
    throw AppError.notFound('Organization not found');
  }

  // Look up the member user by email in auth_users
  let memberUser = await User.findOne({
    where: { email: memberData.email },
  });

  // If the user does not exist in auth_users, we cannot invite them as a team member.
  // The invited person must have a registered account.
  if (!memberUser) {
    throw AppError.notFound(
      `No user found with email "${memberData.email}". The user must register an account first.`
    );
  }

  // Prevent inviting yourself
  if (memberUser.id === userId) {
    throw AppError.badRequest('You cannot invite yourself as a team member');
  }

  // Check if member already exists in this organization (including soft-deleted)
  const existingMember = await TeamMember.findOne({
    where: {
      organization_id: orgId,
      member_user_id: memberUser.id,
    },
    paranoid: false,
  });

  if (existingMember) {
    // If the existing member was soft-deleted, restore them
    if (existingMember.deleted_at) {
      await existingMember.restore();
      await existingMember.update({
        role_title: memberData.role_title,
        permissions: memberData.permissions,
        status: 'invited',
        invited_at: new Date(),
        joined_at: null,
      });

      // Send invite email via Kafka
      await sendInviteEmail(organization, memberData, memberUser);

      return existingMember;
    }

    throw AppError.conflict('This user is already a member of the organization');
  }

  // Create the team member entry
  const teamMember = await TeamMember.create({
    id: generateUUID(),
    organization_id: orgId,
    user_id: userId,
    member_user_id: memberUser.id,
    role_title: memberData.role_title,
    permissions: memberData.permissions,
    status: 'invited',
    invited_at: new Date(),
  });

  // Send invite email via Kafka
  await sendInviteEmail(organization, memberData, memberUser);

  return teamMember;
}

/**
 * Publishes an email.send Kafka event for a team member invitation.
 *
 * @param {object} organization - The organization record
 * @param {object} memberData - The invite data { first_name, last_name, email }
 * @param {object} memberUser - The resolved user record
 */
async function sendInviteEmail(organization, memberData, memberUser) {
  try {
    const producer = await getKafkaProducer();
    if (!producer) {
      console.warn('[organization-service] Kafka producer not available, skipping invite email');
      return;
    }

    await publishEvent(producer, TOPICS.EMAIL_SEND, memberUser.id, {
      to: memberData.email,
      subject: `You've been invited to join ${organization.name}`,
      template: 'team_invite',
      templateData: {
        organizationName: organization.name,
        firstName: memberData.first_name,
        lastName: memberData.last_name,
        roleTitle: memberData.role_title,
      },
    });
  } catch (error) {
    // Log but do not block the invite from being created
    console.error('[organization-service] Failed to publish invite email event:', error.message);
  }
}

/**
 * Lists team members of an organization with pagination.
 *
 * @param {string} userId - The owner's user ID (for ownership verification)
 * @param {string} orgId - The organization ID
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Records per page
 * @returns {Promise<{ members: object[], meta: object }>}
 * @throws {AppError} 404 if organization not found
 */
async function listTeamMembers(userId, orgId, page, limit) {
  // Verify organization ownership
  const organization = await Organization.findOne({
    where: {
      id: orgId,
      user_id: userId,
    },
  });

  if (!organization) {
    throw AppError.notFound('Organization not found');
  }

  const { offset, limit: sanitizedLimit } = getPagination(page, limit);

  const { count, rows } = await TeamMember.findAndCountAll({
    where: { organization_id: orgId },
    include: [
      {
        model: User,
        as: 'member',
        attributes: ['id', 'email', 'first_name', 'last_name', 'status'],
      },
    ],
    order: [['created_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
  });

  const meta = getPaginationMeta(count, page, limit);

  return { members: rows, meta };
}

/**
 * Updates a team member's role, permissions, or status.
 *
 * @param {string} userId - The owner's user ID
 * @param {string} orgId - The organization ID
 * @param {string} memberId - The team member ID
 * @param {object} data - Fields to update { role_title, permissions, status }
 * @returns {Promise<object>} The updated team member
 * @throws {AppError} 404 if org or member not found
 */
async function updateTeamMember(userId, orgId, memberId, data) {
  // Verify organization ownership
  const organization = await Organization.findOne({
    where: {
      id: orgId,
      user_id: userId,
    },
  });

  if (!organization) {
    throw AppError.notFound('Organization not found');
  }

  const teamMember = await TeamMember.findOne({
    where: {
      id: memberId,
      organization_id: orgId,
    },
  });

  if (!teamMember) {
    throw AppError.notFound('Team member not found');
  }

  // If status is changing to 'active', record the joined_at timestamp
  const updateData = { ...data };
  if (data.status === 'active' && teamMember.status === 'invited') {
    updateData.joined_at = new Date();
  }

  await teamMember.update(updateData);

  return teamMember;
}

/**
 * Removes (soft-deletes) a team member from an organization.
 *
 * @param {string} userId - The owner's user ID
 * @param {string} orgId - The organization ID
 * @param {string} memberId - The team member ID
 * @returns {Promise<void>}
 * @throws {AppError} 404 if org or member not found
 */
async function removeTeamMember(userId, orgId, memberId) {
  // Verify organization ownership
  const organization = await Organization.findOne({
    where: {
      id: orgId,
      user_id: userId,
    },
  });

  if (!organization) {
    throw AppError.notFound('Organization not found');
  }

  const teamMember = await TeamMember.findOne({
    where: {
      id: memberId,
      organization_id: orgId,
    },
  });

  if (!teamMember) {
    throw AppError.notFound('Team member not found');
  }

  await teamMember.destroy();
}

/**
 * Gracefully disconnects the Kafka producer.
 * Called during shutdown.
 */
async function disconnectKafka() {
  if (kafkaProducer) {
    try {
      await kafkaProducer.disconnect();
      console.log('[organization-service] Kafka producer disconnected');
    } catch (error) {
      console.error('[organization-service] Error disconnecting Kafka producer:', error.message);
    }
    kafkaProducer = null;
  }
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
  disconnectKafka,
};
