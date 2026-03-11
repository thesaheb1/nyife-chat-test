'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Op, QueryTypes } = require('sequelize');
const { Organization, TeamMember, Invitation, User, sequelize } = require('../models');
const { AppError, generateUUID, slugify, getPagination, getPaginationMeta } = require('@nyife/shared-utils');
const { TOPICS, publishEvent } = require('@nyife/shared-events');
const { createKafkaProducer } = require('@nyife/shared-config');

const BCRYPT_ROUNDS = 12;
const INVITATION_TTL_DAYS = 7;
function isLocalUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function resolveFrontendUrl() {
  const candidates = [
    process.env.PUBLIC_FRONTEND_URL,
    process.env.FRONTEND_PUBLIC_URL,
    process.env.FRONTEND_URL,
    process.env.APP_URL,
  ].filter(Boolean);

  if (!candidates.length) {
    return 'http://localhost:5173';
  }

  if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
    const publicCandidate = candidates.find((candidate) => !isLocalUrl(candidate));
    if (publicCandidate) {
      return publicCandidate;
    }
  }

  return candidates[0];
}

const FRONTEND_URL = resolveFrontendUrl();
const OWNER_RESOURCE_PERMISSIONS = [
  'dashboard',
  'contacts',
  'templates',
  'flows',
  'campaigns',
  'automations',
  'chat',
  'wallet',
  'support',
  'analytics',
  'settings',
  'billing',
  'subscription',
  'organizations',
  'team_members',
  'whatsapp',
  'developer',
];

let kafkaProducer = null;
const subscriptionServiceUrl = process.env.SUBSCRIPTION_SERVICE_URL || 'http://subscription-service:3003';

async function fetchActiveSubscription(scopeId) {
  if (!scopeId) {
    return null;
  }

  const response = await fetch(
    `${subscriptionServiceUrl}/api/v1/subscriptions/internal/active/${scopeId}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw AppError.internal(
      payload?.message || 'Unable to verify the current organization subscription.'
    );
  }

  const payload = await response.json().catch(() => null);
  return payload?.data?.subscription || null;
}

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

async function generateUniqueSlug(name) {
  const baseSlug = slugify(name);

  const existing = await Organization.findOne({
    where: { slug: baseSlug },
    paranoid: false,
  });

  if (!existing) {
    return baseSlug;
  }

  const suffix = generateUUID().substring(0, 8);
  const candidateSlug = `${baseSlug}-${suffix}`;

  const existingCandidate = await Organization.findOne({
    where: { slug: candidateSlug },
    paranoid: false,
  });

  if (!existingCandidate) {
    return candidateSlug;
  }

  return `${baseSlug}-${generateUUID().substring(0, 12)}`;
}

function buildOwnerPermissions() {
  return {
    resources: OWNER_RESOURCE_PERMISSIONS.reduce((acc, resource) => {
      acc[resource] = {
        create: true,
        read: true,
        update: true,
        delete: true,
      };
      return acc;
    }, {}),
  };
}

function paginateArray(items, page, limit) {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.max(1, Number(limit || 20));
  const offset = (safePage - 1) * safeLimit;
  const rows = items.slice(offset, offset + safeLimit);
  return {
    rows,
    meta: getPaginationMeta(items.length, safePage, safeLimit),
  };
}

async function ensureOwnerOrganization(userId, orgId) {
  const organization = await Organization.findOne({
    where: {
      id: orgId,
      user_id: userId,
    },
  });

  if (!organization) {
    throw AppError.notFound('Organization not found');
  }

  return organization;
}

async function resolveOwnerSubscriptionScopeOrganizationId(userId, requestedOrganizationId = null) {
  if (requestedOrganizationId) {
    const organization = await ensureOwnerOrganization(userId, requestedOrganizationId);
    return organization.id;
  }

  const organization = await Organization.findOne({
    where: {
      user_id: userId,
      status: 'active',
    },
    order: [['created_at', 'ASC']],
  });

  if (!organization) {
    throw AppError.forbidden('Create your default organization first before adding more organizations.');
  }

  return organization.id;
}

async function countOwnedOrganizations(userId) {
  return Organization.count({
    where: {
      user_id: userId,
      status: 'active',
    },
  });
}

async function countActiveTeamMembers(orgId) {
  return TeamMember.count({
    where: {
      organization_id: orgId,
      status: 'active',
    },
  });
}

async function countPendingInvitations(orgId) {
  return Invitation.count({
    where: {
      organization_id: orgId,
      status: 'pending',
      expires_at: {
        [Op.gt]: new Date(),
      },
    },
  });
}

async function countReservedTeamSeats(orgId) {
  const [activeMembers, pendingInvites] = await Promise.all([
    countActiveTeamMembers(orgId),
    countPendingInvitations(orgId),
  ]);

  return activeMembers + pendingInvites;
}

function getFiniteLimit(rawLimit) {
  const limit = Number(rawLimit || 0);
  return limit === 0 ? null : limit;
}

async function assertOrganizationCreationAllowed(ownerUserId, scopeOrganizationId) {
  const subscription = await fetchActiveSubscription(scopeOrganizationId);
  if (!subscription?.plan) {
    throw AppError.forbidden('An active subscription is required before creating another organization.');
  }

  const limit = getFiniteLimit(subscription.plan.max_organizations);
  const currentCount = await countOwnedOrganizations(ownerUserId);

  if (limit !== null && currentCount >= limit) {
    throw AppError.forbidden(
      `Your current plan allows up to ${limit} organization(s). Upgrade the plan to add another organization.`
    );
  }
}

async function assertTeamInviteAllowed(orgId, scopeOrganizationId) {
  const subscription = await fetchActiveSubscription(scopeOrganizationId);
  if (!subscription?.plan) {
    throw AppError.forbidden('An active subscription is required before inviting team members.');
  }

  const limit = getFiniteLimit(subscription.plan.max_team_members);
  const currentCount = await countReservedTeamSeats(orgId);

  if (limit !== null && currentCount >= limit) {
    throw AppError.forbidden(
      `Your current plan allows up to ${limit} team member(s) in this organization.`
    );
  }
}

async function syncTeamSeatUsage(scopeOrganizationId) {
  if (!scopeOrganizationId) {
    return null;
  }

  const subscription = await fetchActiveSubscription(scopeOrganizationId);
  if (!subscription?.plan) {
    return null;
  }

  const desiredUsage = await countReservedTeamSeats(scopeOrganizationId);
  const currentUsage = Number(subscription.usage?.team_members_used || 0);
  const delta = desiredUsage - currentUsage;

  if (delta === 0) {
    return { used: desiredUsage };
  }

  const response = await fetch(
    `${subscriptionServiceUrl}/api/v1/subscriptions/increment-usage/${scopeOrganizationId}`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resource: 'team_members',
        count: delta,
      }),
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw AppError.internal(
      payload?.message || 'Unable to update team-member usage right now.'
    );
  }

  return { used: desiredUsage };
}

async function clearAssignedConversationsForMember(orgId, memberUserId, transaction = null) {
  if (!orgId || !memberUserId) {
    return;
  }

  await sequelize.query(
    `UPDATE chat_conversations
     SET assigned_to = NULL,
         assigned_at = NULL,
         assigned_by = NULL,
         updated_at = NOW()
     WHERE user_id = :organizationId
       AND assigned_to = :memberUserId`,
    {
      replacements: {
        organizationId: orgId,
        memberUserId,
      },
      type: QueryTypes.UPDATE,
      transaction,
    }
  );
}

async function getAccessibleOrganizations(userId) {
  const [ownedOrganizations, memberships] = await Promise.all([
    Organization.findAll({
      where: { user_id: userId, status: 'active' },
      order: [['created_at', 'ASC']],
    }),
    TeamMember.findAll({
      where: { member_user_id: userId, status: 'active' },
      include: [
        {
          model: Organization,
          as: 'organization',
          required: true,
          where: { status: 'active' },
        },
      ],
      order: [['created_at', 'ASC']],
    }),
  ]);

  const organizations = [];
  const seen = new Set();

  for (const organization of ownedOrganizations) {
    seen.add(String(organization.id));
    organizations.push({
      organization,
      role: 'owner',
      permissions: buildOwnerPermissions(),
      membership: null,
    });
  }

  for (const membership of memberships) {
    if (!membership.organization || seen.has(String(membership.organization.id))) {
      continue;
    }
    seen.add(String(membership.organization.id));
    organizations.push({
      organization: membership.organization,
      role: 'team',
      permissions: membership.permissions || { resources: {} },
      membership,
    });
  }

  organizations.sort((left, right) => {
    if (left.role !== right.role) {
      return left.role === 'owner' ? -1 : 1;
    }
    return new Date(left.organization.created_at).getTime() - new Date(right.organization.created_at).getTime();
  });

  return organizations;
}

async function assertTeamReadAccess(userId, orgId) {
  const context = await resolveOrganizationContext(userId, orgId);

  if (context.role === 'owner') {
    return context;
  }

  const permission = context.permissions?.resources?.team_members?.read;
  if (!permission) {
    throw AppError.forbidden('You do not have permission to view team members in this organization.');
  }

  return context;
}

async function createOrganization(userId, currentOrganizationId, data, actorRole = 'user') {
  if (actorRole === 'team') {
    throw AppError.forbidden('Team members cannot create organizations.');
  }

  const scopeOrganizationId = await resolveOwnerSubscriptionScopeOrganizationId(userId, currentOrganizationId);
  await assertOrganizationCreationAllowed(userId, scopeOrganizationId);

  const slug = await generateUniqueSlug(data.name);
  const organizationId = generateUUID();
  const now = new Date();

  await sequelize.transaction(async (transaction) => {
    await Organization.create({
      id: organizationId,
      user_id: userId,
      name: data.name,
      description: data.description || null,
      logo_url: data.logo_url || null,
      slug,
      status: 'active',
    }, { transaction });

    await sequelize.query(
      `INSERT INTO wallet_wallets (id, user_id, balance, currency, created_at, updated_at)
       VALUES (:id, :userId, 0, 'INR', :now, :now)`,
      {
        replacements: {
          id: generateUUID(),
          userId: organizationId,
          now,
        },
        transaction,
      }
    );
  });

  return Organization.findByPk(organizationId);
}

async function listOrganizations(userId, page, limit) {
  const accessibleOrganizations = await getAccessibleOrganizations(userId);
  const serialized = accessibleOrganizations.map((entry) => ({
    ...entry.organization.toJSON(),
    organization_role: entry.role,
    permissions: entry.permissions,
  }));

  const { rows, meta } = paginateArray(serialized, page, limit);
  return { organizations: rows, meta };
}

async function getOrganization(userId, orgId) {
  const context = await resolveOrganizationContext(userId, orgId);

  const organization = await Organization.findOne({
    where: { id: context.organization.id },
    include: [
      {
        model: TeamMember,
        as: 'teamMembers',
        attributes: ['id', 'member_user_id', 'role_title', 'status', 'invited_at', 'joined_at', 'permissions'],
        required: false,
      },
    ],
  });

  if (!organization) {
    throw AppError.notFound('Organization not found');
  }

  return {
    ...organization.toJSON(),
    organization_role: context.role,
    permissions: context.permissions,
  };
}

async function updateOrganization(userId, orgId, data) {
  const organization = await ensureOwnerOrganization(userId, orgId);

  const updateData = { ...data };
  if (data.name && data.name !== organization.name) {
    updateData.slug = await generateUniqueSlug(data.name);
  }

  await organization.update(updateData);
  return organization;
}

async function deleteOrganization(userId, orgId) {
  const organization = await ensureOwnerOrganization(userId, orgId);

  await sequelize.transaction(async (transaction) => {
    await Invitation.destroy({
      where: { organization_id: orgId },
      transaction,
    });

    await TeamMember.destroy({
      where: { organization_id: orgId },
      transaction,
    });

    await organization.destroy({ transaction });
  });
}

function buildInviteLink(inviteToken) {
  return `${FRONTEND_URL.replace(/\/$/, '')}/organizations/invitations/accept?token=${encodeURIComponent(inviteToken)}`;
}

async function sendInviteEmail(organization, invitation) {
  try {
    const producer = await getKafkaProducer();
    if (!producer) {
      console.warn('[organization-service] Kafka producer not available, skipping invite email');
      return;
    }

    const inviterName = invitation.invited_by_user_id
      ? await User.findByPk(invitation.invited_by_user_id, {
          attributes: ['first_name', 'last_name'],
        }).then((user) => {
          const firstName = user?.first_name?.trim?.() || '';
          const lastName = user?.last_name?.trim?.() || '';
          return `${firstName} ${lastName}`.trim() || organization.name;
        }).catch(() => organization.name)
      : organization.name;

    await publishEvent(producer, TOPICS.EMAIL_SEND, invitation.email, {
      to: invitation.email,
      subject: `You've been invited to join ${organization.name}`,
      template: 'team_invite',
      templateData: {
        organizationName: organization.name,
        firstName: invitation.first_name,
        lastName: invitation.last_name,
        inviterName,
        role: invitation.role_title,
        inviteUrl: buildInviteLink(invitation.invite_token),
        expiresAt: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error('[organization-service] Failed to publish invite email event:', error.message);
  }
}

async function inviteTeamMember(userId, orgId, memberData, currentOrganizationId = null) {
  const organization = await ensureOwnerOrganization(userId, orgId);
  await assertTeamInviteAllowed(orgId, currentOrganizationId || orgId);
  const normalizedEmail = String(memberData.email).toLowerCase().trim();

  const [existingMember, existingInvitation, existingUser] = await Promise.all([
    User.findOne({ where: { email: normalizedEmail } }).then((memberUser) => {
      if (!memberUser) {
        return null;
      }
      return TeamMember.findOne({
        where: {
          organization_id: orgId,
          member_user_id: memberUser.id,
        },
        paranoid: false,
      });
    }),
    Invitation.findOne({
      where: {
        organization_id: orgId,
        email: normalizedEmail,
        status: 'pending',
        expires_at: { [Op.gt]: new Date() },
      },
      paranoid: false,
    }),
    User.findOne({ where: { email: normalizedEmail } }),
  ]);

  if (existingUser && String(existingUser.id) === String(userId)) {
    throw AppError.badRequest('You cannot invite yourself as a team member.');
  }

  if (existingUser && ['admin', 'super_admin'].includes(String(existingUser.role))) {
    throw AppError.forbidden('Platform admin accounts cannot be invited as team members.');
  }

  if (existingMember && !existingMember.deleted_at) {
    throw AppError.conflict('This user is already a member of the organization.');
  }

  if (existingInvitation) {
    throw AppError.conflict('A pending invitation already exists for this email.');
  }

  const inviteToken = crypto.randomBytes(32).toString('hex');
  const invitation = await Invitation.create({
    id: generateUUID(),
    organization_id: orgId,
    invited_by_user_id: userId,
    email: normalizedEmail,
    first_name: memberData.first_name,
    last_name: memberData.last_name,
    role_title: memberData.role_title,
    permissions: memberData.permissions,
    invite_token: inviteToken,
    status: 'pending',
    expires_at: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
  });

  await sendInviteEmail(organization, invitation);
  await syncTeamSeatUsage(orgId);
  return invitation;
}

async function createTeamMemberAccount(userId, orgId, memberData) {
  await ensureOwnerOrganization(userId, orgId);
  await assertTeamInviteAllowed(orgId, orgId);

  const normalizedEmail = String(memberData.email).toLowerCase().trim();
  const existingUser = await User.findOne({
    where: { email: normalizedEmail },
    paranoid: false,
  });

  if (existingUser) {
    if (['admin', 'super_admin'].includes(String(existingUser.role))) {
      throw AppError.forbidden('Platform admin accounts cannot be attached as team members.');
    }

    throw AppError.conflict(
      'This email already has a Nyife account. Use the invite flow for existing users.'
    );
  }

  const existingInvitation = await Invitation.findOne({
    where: {
      organization_id: orgId,
      email: normalizedEmail,
      status: 'pending',
      expires_at: { [Op.gt]: new Date() },
    },
    paranoid: false,
  });

  if (existingInvitation) {
    throw AppError.conflict('A pending invitation already exists for this email.');
  }

  const now = new Date();
  const created = await sequelize.transaction(async (transaction) => {
    const memberUserId = generateUUID();
    const hashedPassword = await bcrypt.hash(memberData.temporary_password, BCRYPT_ROUNDS);

    await sequelize.query(
      `INSERT INTO auth_users (
         id, email, password, must_change_password, first_name, last_name, role, status, email_verified_at, created_at, updated_at
       )
       VALUES (
         :id, :email, :password, true, :firstName, :lastName, 'team', 'active', :now, :now, :now
       )`,
      {
        replacements: {
          id: memberUserId,
          email: normalizedEmail,
          password: hashedPassword,
          firstName: memberData.first_name,
          lastName: memberData.last_name,
          now,
        },
        type: QueryTypes.INSERT,
        transaction,
      }
    );

    const teamMember = await TeamMember.create({
      id: generateUUID(),
      organization_id: orgId,
      user_id: userId,
      member_user_id: memberUserId,
      role_title: memberData.role_title,
      permissions: memberData.permissions,
      status: 'active',
      invited_at: now,
      joined_at: now,
    }, { transaction });

    return teamMember;
  });

  await syncTeamSeatUsage(orgId);

  return TeamMember.findOne({
    where: { id: created.id },
    include: [
      {
        model: User,
        as: 'member',
        attributes: ['id', 'email', 'first_name', 'last_name', 'status'],
      },
    ],
  });
}

async function listInvitations(userId, orgId, page, limit) {
  await ensureOwnerOrganization(userId, orgId);
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);

  await Invitation.update(
    { status: 'expired' },
    {
      where: {
        organization_id: orgId,
        status: 'pending',
        expires_at: { [Op.lte]: new Date() },
      },
    }
  );

  const { count, rows } = await Invitation.findAndCountAll({
    where: { organization_id: orgId },
    order: [['created_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
  });

  await syncTeamSeatUsage(orgId);

  return {
    invitations: rows,
    meta: getPaginationMeta(count, page, limit),
  };
}

async function resendInvitation(userId, orgId, invitationId) {
  const organization = await ensureOwnerOrganization(userId, orgId);

  const invitation = await Invitation.findOne({
    where: {
      id: invitationId,
      organization_id: orgId,
    },
  });

  if (!invitation) {
    throw AppError.notFound('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw AppError.badRequest('Only pending invitations can be resent.');
  }

  const now = new Date();
  await invitation.update({
    invite_token: crypto.randomBytes(32).toString('hex'),
    expires_at: new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
  });

  await sendInviteEmail(organization, invitation);
  return invitation;
}

async function revokeInvitation(userId, orgId, invitationId) {
  await ensureOwnerOrganization(userId, orgId);

  const invitation = await Invitation.findOne({
    where: {
      id: invitationId,
      organization_id: orgId,
    },
  });

  if (!invitation) {
    throw AppError.notFound('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw AppError.badRequest('Only pending invitations can be revoked.');
  }

  await invitation.update({ status: 'revoked' });
  await syncTeamSeatUsage(orgId);

  return invitation;
}

async function findInvitationByToken(token) {
  const invitation = await Invitation.findOne({
    where: {
      invite_token: token,
      status: 'pending',
    },
    include: [
      {
        model: Organization,
        as: 'organization',
        required: true,
      },
    ],
  });

  if (!invitation) {
    throw AppError.notFound('Invitation not found or already used.');
  }

  if (invitation.expires_at <= new Date()) {
    await invitation.update({ status: 'expired' });
    throw AppError.badRequest('This invitation has expired. Ask the organization owner to send a new one.');
  }

  return invitation;
}

async function acceptInvitation(authUserId, data) {
  const invitation = await findInvitationByToken(data.token);

  let user = null;
  const normalizedEmail = invitation.email.toLowerCase();

  if (authUserId) {
    user = await User.findByPk(authUserId, { paranoid: false });
    if (!user) {
      throw AppError.unauthorized('Authentication is required to accept this invitation.');
    }
    if (user.email.toLowerCase() !== normalizedEmail) {
      throw AppError.forbidden('This invitation belongs to a different email address.');
    }
    if (['admin', 'super_admin'].includes(String(user.role))) {
      throw AppError.forbidden('Platform admin accounts cannot be attached as team members.');
    }
  } else {
    if (!data.password) {
      throw AppError.badRequest('Set a password to finish accepting this invitation.');
    }

    const [existingUser] = await sequelize.query(
      'SELECT id FROM auth_users WHERE email = :email AND deleted_at IS NULL LIMIT 1',
      { replacements: { email: normalizedEmail }, type: QueryTypes.SELECT }
    );

    if (existingUser) {
      throw AppError.badRequest('This email already has an account. Log in first to accept the invitation.');
    }

    const userId = generateUUID();
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const now = new Date();

    await sequelize.query(
      `INSERT INTO auth_users (id, email, password, first_name, last_name, role, status, email_verified_at, created_at, updated_at)
       VALUES (:id, :email, :password, :firstName, :lastName, 'team', 'active', :now, :now, :now)`,
      {
        replacements: {
          id: userId,
          email: normalizedEmail,
          password: hashedPassword,
          firstName: invitation.first_name,
          lastName: invitation.last_name,
          now,
        },
        type: QueryTypes.INSERT,
      }
    );

    user = await User.findByPk(userId);
  }

  const [existingMembership] = await Promise.all([
    TeamMember.findOne({
      where: {
        organization_id: invitation.organization_id,
        member_user_id: user.id,
      },
      paranoid: false,
    }),
  ]);

  if (existingMembership && !existingMembership.deleted_at) {
    throw AppError.conflict('This account is already a member of the organization.');
  }

  await sequelize.transaction(async (transaction) => {
    if (existingMembership?.deleted_at) {
      await existingMembership.restore({ transaction });
      await existingMembership.update({
        role_title: invitation.role_title,
        permissions: invitation.permissions,
        status: 'active',
        joined_at: new Date(),
        invited_at: invitation.created_at,
      }, { transaction });
    } else if (!existingMembership) {
      await TeamMember.create({
        id: generateUUID(),
        organization_id: invitation.organization_id,
        user_id: invitation.invited_by_user_id,
        member_user_id: user.id,
        role_title: invitation.role_title,
        permissions: invitation.permissions,
        status: 'active',
        invited_at: invitation.created_at,
        joined_at: new Date(),
      }, { transaction });
    }

    await invitation.update({
      status: 'accepted',
      accepted_at: new Date(),
      accepted_user_id: user.id,
    }, { transaction });
  });

  await syncTeamSeatUsage(invitation.organization_id);

  return {
    invitation: invitation.toJSON(),
    organization: invitation.organization,
    member_user_id: user.id,
  };
}

async function listTeamMembers(userId, orgId, page, limit, filters = {}) {
  await assertTeamReadAccess(userId, orgId);

  const where = { organization_id: orgId };
  if (filters.status) {
    where.status = filters.status;
  }

  const include = [
    {
      model: User,
      as: 'member',
      attributes: ['id', 'email', 'first_name', 'last_name', 'status'],
    },
  ];

  if (filters.resource || filters.permission) {
    const members = await TeamMember.findAll({
      where,
      include,
      order: [['created_at', 'DESC']],
    });

    const filteredMembers = members.filter((member) => {
      if (!filters.resource) {
        return true;
      }

      return memberHasResourcePermission(
        member,
        filters.resource,
        filters.permission || 'read'
      );
    });

    const { rows, meta } = paginateArray(filteredMembers, page, limit);
    return {
      members: rows,
      meta,
    };
  }

  const { offset, limit: sanitizedLimit } = getPagination(page, limit);
  const { count, rows } = await TeamMember.findAndCountAll({
    where,
    include,
    order: [['created_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
  });

  return {
    members: rows,
    meta: getPaginationMeta(count, page, limit),
  };
}

async function updateTeamMember(userId, orgId, memberId, data) {
  await ensureOwnerOrganization(userId, orgId);

  const teamMember = await TeamMember.findOne({
    where: { id: memberId, organization_id: orgId },
  });

  if (!teamMember) {
    throw AppError.notFound('Team member not found');
  }

  if (data.status === 'active' && teamMember.status !== 'active') {
    await assertTeamInviteAllowed(orgId, orgId);
  }

  const updateData = { ...data };
  if (data.status === 'active' && teamMember.status === 'invited') {
    updateData.joined_at = new Date();
  }

  await teamMember.update(updateData);
  if (data.status === 'inactive' && teamMember.member_user_id) {
    await clearAssignedConversationsForMember(orgId, teamMember.member_user_id);
  }
  await syncTeamSeatUsage(orgId);
  return teamMember;
}

async function removeTeamMember(userId, orgId, memberId) {
  await ensureOwnerOrganization(userId, orgId);

  const [teamMember, pendingInvitation] = await Promise.all([
    TeamMember.findOne({
      where: { id: memberId, organization_id: orgId },
    }),
    Invitation.findOne({
      where: { id: memberId, organization_id: orgId, status: 'pending' },
    }),
  ]);

  if (pendingInvitation) {
    await pendingInvitation.update({ status: 'revoked' });
    await syncTeamSeatUsage(orgId);
    return;
  }

  if (!teamMember) {
    throw AppError.notFound('Team member not found');
  }

  await sequelize.transaction(async (transaction) => {
    await clearAssignedConversationsForMember(orgId, teamMember.member_user_id, transaction);
    await teamMember.destroy({ transaction });
  });

  await syncTeamSeatUsage(orgId);
}

function memberHasResourcePermission(member, resource, permission) {
  const resourcePermissions = member?.permissions?.resources?.[resource];
  if (!resourcePermissions) {
    return false;
  }

  if (permission === 'update') {
    return Boolean(resourcePermissions.update || resourcePermissions.read);
  }

  return Boolean(resourcePermissions[permission]);
}

async function resolveOrganizationContext(userId, requestedOrganizationId = null) {
  const accessibleOrganizations = await getAccessibleOrganizations(userId);

  if (!accessibleOrganizations.length) {
    throw AppError.forbidden('No accessible organization was found for this account.');
  }

  const selected = requestedOrganizationId
    ? accessibleOrganizations.find((entry) => String(entry.organization.id) === String(requestedOrganizationId))
    : accessibleOrganizations[0];

  if (!selected) {
    throw AppError.forbidden('You do not have access to the requested organization.');
  }

  return {
    organization: selected.organization,
    membership: selected.membership,
    role: selected.role,
    permissions: selected.permissions,
  };
}

async function validateTeamMemberAccess(ownerUserId, memberUserId, organizationId, resource = 'chat', permission = 'update') {
  const organization = await ensureOwnerOrganization(ownerUserId, organizationId);

  if (String(memberUserId) === String(ownerUserId)) {
    return {
      owner: true,
      member_user_id: ownerUserId,
      organization_id: organization.id,
      permissions: buildOwnerPermissions(),
      status: 'active',
    };
  }

  const membership = await TeamMember.findOne({
    where: {
      organization_id: organization.id,
      member_user_id: memberUserId,
      status: 'active',
    },
    include: [
      {
        model: User,
        as: 'member',
        attributes: ['id', 'email', 'first_name', 'last_name', 'status'],
        required: false,
      },
    ],
  });

  if (!membership) {
    throw AppError.forbidden('Selected team member is not active in this organization.');
  }

  if (!memberHasResourcePermission(membership, resource, permission)) {
    throw AppError.forbidden(`Selected team member does not have ${resource} ${permission} permission.`);
  }

  return {
    owner: false,
    member_user_id: membership.member_user_id,
    organization_id: membership.organization_id,
    role_title: membership.role_title,
    permissions: membership.permissions,
    status: membership.status,
    member: membership.member
      ? {
          id: membership.member.id,
          email: membership.member.email,
          first_name: membership.member.first_name,
          last_name: membership.member.last_name,
          status: membership.member.status,
        }
      : null,
  };
}

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
  createTeamMemberAccount,
  acceptInvitation,
  listTeamMembers,
  listInvitations,
  resendInvitation,
  revokeInvitation,
  updateTeamMember,
  removeTeamMember,
  resolveOrganizationContext,
  validateTeamMemberAccess,
  disconnectKafka,
};
