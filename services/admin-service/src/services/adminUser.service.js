'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const axios = require('axios');
const FormData = require('form-data');
const { QueryTypes, Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const { sequelize, AdminUserInvitation } = require('../models');
const { AppError } = require('@nyife/shared-middleware');
const {
  getPagination,
  getPaginationMeta,
  slugify,
  generateInvitationToken,
  calculateInvitationExpiry,
  hasPermission,
} = require('@nyife/shared-utils');
const config = require('../config');

const BCRYPT_ROUNDS = 12;
const INVITATION_TTL_DAYS = 7;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeEmail(email) {
  return normalizeText(email).toLowerCase();
}

function normalizePhone(phone) {
  const value = normalizeText(phone);
  return value || null;
}

function buildUserInviteLink(inviteToken) {
  return `${config.frontendUrl.replace(/\/$/, '')}/users/invitations/accept?token=${encodeURIComponent(inviteToken)}`;
}

function buildUserAvatarProxyUrl(userId) {
  return `${config.frontendUrl.replace(/\/$/, '')}/api/v1/admin/users/avatar/${encodeURIComponent(userId)}`;
}

function normalizeReturnedAvatarUrl(userId, avatarUrl) {
  if (!avatarUrl) {
    return null;
  }

  if (String(avatarUrl).startsWith('media://')) {
    return buildUserAvatarProxyUrl(userId);
  }

  return avatarUrl;
}

function extractAvatarMediaId(avatarUrl) {
  if (!avatarUrl || !String(avatarUrl).startsWith('media://')) {
    return null;
  }

  return String(avatarUrl).slice('media://'.length) || null;
}

async function findUserById(userId, attributes = 'id, email, first_name, last_name, phone, avatar_url, role, status, must_change_password, email_verified_at, last_login_at, created_at, updated_at') {
  const [user] = await sequelize.query(
    `SELECT ${attributes}
     FROM auth_users
     WHERE id = :userId
       AND deleted_at IS NULL
     LIMIT 1`,
    { replacements: { userId }, type: QueryTypes.SELECT }
  );

  return user || null;
}

async function findUserByEmail(email, attributes = 'id, email, role, status') {
  const [user] = await sequelize.query(
    `SELECT ${attributes}
     FROM auth_users
     WHERE email = :email
       AND deleted_at IS NULL
     LIMIT 1`,
    { replacements: { email }, type: QueryTypes.SELECT }
  );

  return user || null;
}

async function createDefaultOrganizationForUser(userId, transaction = null) {
  const now = new Date();
  const organizationId = crypto.randomUUID();
  const walletId = crypto.randomUUID();
  const slug = slugify(`default-${userId.slice(0, 8)}`);

  await sequelize.query(
    `INSERT INTO org_organizations (id, user_id, name, slug, description, status, logo_url, created_at, updated_at)
     VALUES (:organizationId, :userId, 'default', :slug, 'default organization', 'active', NULL, :now, :now)`,
    {
      replacements: {
        organizationId,
        userId,
        slug,
        now,
      },
      transaction,
    }
  );

  await sequelize.query(
    `INSERT INTO wallet_wallets (id, user_id, balance, currency, created_at, updated_at)
     VALUES (:walletId, :organizationId, 0, 'INR', :now, :now)`,
    {
      replacements: {
        walletId,
        organizationId,
        now,
      },
      transaction,
    }
  );

  const [organization] = await sequelize.query(
    `SELECT id, user_id, name, slug, description, logo_url, status, created_at, updated_at
     FROM org_organizations
     WHERE id = :organizationId
     LIMIT 1`,
    {
      replacements: { organizationId },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  return organization;
}

async function listOrganizationsForUser(userId) {
  let organizations = await sequelize.query(
    `SELECT
        o.id,
        o.user_id,
        o.name,
        o.slug,
        o.description,
        o.logo_url,
        o.status,
        o.created_at,
        o.updated_at,
        COALESCE((
          SELECT w.balance
          FROM wallet_wallets AS w
          WHERE w.user_id = o.id
          LIMIT 1
        ), 0) AS wallet_balance,
        (
          SELECT p.name
          FROM sub_subscriptions AS s
          LEFT JOIN sub_plans AS p ON p.id = s.plan_id
          WHERE s.user_id = o.id
            AND s.status = 'active'
          ORDER BY s.created_at DESC
          LIMIT 1
        ) AS current_plan,
        (
          SELECT s.status
          FROM sub_subscriptions AS s
          WHERE s.user_id = o.id
            AND s.status = 'active'
          ORDER BY s.created_at DESC
          LIMIT 1
        ) AS subscription_status,
        (
          SELECT COUNT(*)
          FROM org_team_members AS tm
          WHERE tm.organization_id = o.id
            AND tm.deleted_at IS NULL
        ) AS team_members_count
      FROM org_organizations AS o
      WHERE o.user_id = :userId
        AND o.deleted_at IS NULL
      ORDER BY o.created_at ASC`,
    {
      replacements: { userId },
      type: QueryTypes.SELECT,
    }
  );

  if (!organizations.length) {
    const organization = await createDefaultOrganizationForUser(userId);
    organizations = [organization];
  }

  return organizations.map((organization) => ({
    ...organization,
    wallet_balance: Number(organization.wallet_balance || 0),
    team_members_count: Number(organization.team_members_count || 0),
  }));
}

async function resolveUserBusinessScope(userId, requestedOrganizationId = null) {
  const user = await findUserById(userId, 'id, email, role, status');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role !== 'user') {
    return {
      user,
      scope_id: user.id,
      organization: null,
    };
  }

  const organizations = await listOrganizationsForUser(user.id);
  const organization = requestedOrganizationId
    ? organizations.find((entry) => entry.id === requestedOrganizationId)
    : organizations[0] || null;

  if (!organization) {
    throw new AppError('Organization not found for this user', 404);
  }

  return {
    user,
    scope_id: organization.id,
    organization,
  };
}

async function expirePendingUserInvitations() {
  await AdminUserInvitation.update(
    { status: 'expired' },
    {
      where: {
        status: 'pending',
        expires_at: {
          [Op.lte]: new Date(),
        },
      },
    }
  );
}

async function sendUserInviteEmail(invitation, kafkaProducer = null) {
  if (!kafkaProducer) {
    return;
  }

  const { publishEvent, TOPICS } = require('@nyife/shared-events');

  await publishEvent(kafkaProducer, TOPICS.EMAIL_SEND, invitation.email, {
    to: invitation.email,
    subject: `You've been invited to join Nyife`,
    template: 'user_account_invite',
    templateData: {
      firstName: invitation.first_name,
      lastName: invitation.last_name,
      inviteUrl: buildUserInviteLink(invitation.invite_token),
      expiresAt: invitation.expires_at,
    },
  });
}

async function findPendingUserInvitationByToken(token) {
  await expirePendingUserInvitations();

  const invitation = await AdminUserInvitation.findOne({
    where: {
      invite_token: token,
      status: 'pending',
    },
  });

  if (!invitation) {
    throw new AppError('Invitation not found or already used', 404);
  }

  if (invitation.expires_at <= new Date()) {
    await invitation.update({ status: 'expired' });
    throw new AppError('This invitation has expired. Ask the admin to send a new one.', 400);
  }

  return invitation;
}

async function invalidateUserAuthState(userId, appLocals = {}, options = {}) {
  if (appLocals.redis) {
    try {
      await appLocals.redis.del(`user:${userId}`);
    } catch (error) {
      console.warn('[admin-user-service] Failed to invalidate user cache:', error.message);
    }
  }

  if (options.revokeRefreshTokens) {
    await sequelize.query(
      `UPDATE auth_refresh_tokens
       SET is_revoked = true,
           updated_at = NOW()
       WHERE user_id = :userId
         AND is_revoked = false`,
      {
        replacements: { userId },
        type: QueryTypes.UPDATE,
      }
    );
  }
}

function canReadAdminSection(actor, resource) {
  if (!actor) {
    return false;
  }

  if (actor.is_super_admin) {
    return true;
  }

  return hasPermission(actor.permissions, resource, 'read');
}

function buildListUsersSearchClause(search, replacements) {
  if (!search) {
    return null;
  }

  replacements.search = `%${String(search).trim().toLowerCase()}%`;

  return `(
    LOWER(u.first_name) LIKE :search
    OR LOWER(u.last_name) LIKE :search
    OR LOWER(CONCAT_WS(' ', u.first_name, u.last_name)) LIKE :search
    OR LOWER(u.email) LIKE :search
    OR LOWER(COALESCE(u.phone, '')) LIKE :search
    OR EXISTS (
      SELECT 1
      FROM org_organizations AS o_search
      WHERE o_search.user_id = u.id
        AND o_search.deleted_at IS NULL
        AND LOWER(o_search.name) LIKE :search
    )
    OR EXISTS (
      SELECT 1
      FROM org_team_members AS tm_search
      INNER JOIN org_organizations AS org_search
        ON org_search.id = tm_search.organization_id
      INNER JOIN auth_users AS tm_user
        ON tm_user.id = tm_search.member_user_id
      WHERE org_search.user_id = u.id
        AND org_search.deleted_at IS NULL
        AND tm_search.deleted_at IS NULL
        AND (
          LOWER(tm_user.first_name) LIKE :search
          OR LOWER(tm_user.last_name) LIKE :search
          OR LOWER(CONCAT_WS(' ', tm_user.first_name, tm_user.last_name)) LIKE :search
          OR LOWER(tm_user.email) LIKE :search
          OR LOWER(COALESCE(tm_user.phone, '')) LIKE :search
        )
    )
  )`;
}

function mapUserRow(row) {
  return {
    ...row,
    wallet_balance: Number(row.wallet_balance || 0),
    organizations_count: Number(row.organizations_count || 0),
    avatar_url: normalizeReturnedAvatarUrl(row.id, row.avatar_url),
  };
}

async function listUsers(filters) {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    plan,
    date_from,
    date_to,
  } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);

  const whereClauses = ["u.role = 'user'", 'u.deleted_at IS NULL'];
  const replacements = {};

  const searchClause = buildListUsersSearchClause(search, replacements);
  if (searchClause) {
    whereClauses.push(searchClause);
  }

  if (status) {
    whereClauses.push('u.status = :status');
    replacements.status = status;
  }

  if (plan) {
    whereClauses.push(
      `EXISTS (
        SELECT 1
        FROM org_organizations AS o_plan
        INNER JOIN sub_subscriptions AS s_plan
          ON s_plan.user_id = o_plan.id
        WHERE o_plan.user_id = u.id
          AND o_plan.deleted_at IS NULL
          AND s_plan.status = 'active'
          AND s_plan.plan_id = :planId
      )`
    );
    replacements.planId = plan;
  }

  if (date_from) {
    whereClauses.push('u.created_at >= :date_from');
    replacements.date_from = date_from;
  }

  if (date_to) {
    whereClauses.push('u.created_at < DATE_ADD(:date_to, INTERVAL 1 DAY)');
    replacements.date_to = date_to;
  }

  const whereSQL = whereClauses.join(' AND ');

  const [countResult] = await sequelize.query(
    `SELECT COUNT(*) AS total
     FROM auth_users AS u
     WHERE ${whereSQL}`,
    {
      replacements,
      type: QueryTypes.SELECT,
    }
  );
  const total = Number(countResult.total || 0);

  const rows = await sequelize.query(
    `SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.avatar_url,
        u.role,
        u.status,
        u.must_change_password,
        u.email_verified_at,
        u.last_login_at,
        u.login_count,
        u.created_at,
        u.updated_at,
        (
          SELECT COUNT(*)
          FROM org_organizations AS o
          WHERE o.user_id = u.id
            AND o.deleted_at IS NULL
        ) AS organizations_count,
        COALESCE((
          SELECT w.balance
          FROM org_organizations AS o
          INNER JOIN wallet_wallets AS w ON w.user_id = o.id
          WHERE o.user_id = u.id
            AND o.deleted_at IS NULL
          ORDER BY o.created_at ASC
          LIMIT 1
        ), 0) AS wallet_balance,
        (
          SELECT p.name
          FROM org_organizations AS o
          INNER JOIN sub_subscriptions AS s ON s.user_id = o.id
          LEFT JOIN sub_plans AS p ON p.id = s.plan_id
          WHERE o.user_id = u.id
            AND o.deleted_at IS NULL
            AND s.status = 'active'
          ORDER BY o.created_at ASC, s.created_at DESC
          LIMIT 1
        ) AS current_plan,
        (
          SELECT s.status
          FROM org_organizations AS o
          INNER JOIN sub_subscriptions AS s ON s.user_id = o.id
          WHERE o.user_id = u.id
            AND o.deleted_at IS NULL
            AND s.status = 'active'
          ORDER BY o.created_at ASC, s.created_at DESC
          LIMIT 1
        ) AS subscription_status
      FROM auth_users AS u
      WHERE ${whereSQL}
      ORDER BY u.created_at DESC
      LIMIT :limit OFFSET :offset`,
    {
      replacements: { ...replacements, limit: safeLimit, offset },
      type: QueryTypes.SELECT,
    }
  );

  return {
    data: rows.map(mapUserRow),
    meta: getPaginationMeta(total, page, limit),
  };
}

async function getUser(userId) {
  const user = await findUserById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const organizations = user.role === 'user' ? await listOrganizationsForUser(userId) : [];
  const primaryOrganization = organizations[0] || null;

  return mapUserRow({
    ...user,
    organizations_count: organizations.length,
    wallet_balance: primaryOrganization?.wallet_balance || 0,
    current_plan: primaryOrganization?.current_plan || null,
    subscription_status: primaryOrganization?.subscription_status || null,
    primary_organization: primaryOrganization,
  });
}

async function getUserDashboard(userId, actor, organizationId = null) {
  const user = await findUserById(
    userId,
    'id, email, first_name, last_name, phone, avatar_url, role, status, must_change_password, email_verified_at, last_login_at, created_at, updated_at'
  );

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role !== 'user') {
    throw new AppError('Only platform users can be viewed in this dashboard', 400);
  }

  const organizations = await listOrganizationsForUser(user.id);
  const selectedOrganization = organizationId
    ? organizations.find((organization) => organization.id === organizationId)
    : organizations[0] || null;

  if (!selectedOrganization) {
    throw new AppError('Organization not found for this user', 404);
  }

  let supportTicketsCount = 0;
  try {
    const [supportCountRow] = await sequelize.query(
      `SELECT COUNT(*) AS total
       FROM support_tickets
       WHERE user_id = :userId
         AND organization_id = :organizationId
         AND deleted_at IS NULL`,
      {
        replacements: {
          userId: user.id,
          organizationId: selectedOrganization.id,
        },
        type: QueryTypes.SELECT,
      }
    );
    supportTicketsCount = Number(supportCountRow?.total || 0);
  } catch (_error) {
    supportTicketsCount = 0;
  }

  return {
    user: mapUserRow({
      ...user,
      organizations_count: organizations.length,
      wallet_balance: selectedOrganization.wallet_balance || 0,
      current_plan: selectedOrganization.current_plan || null,
      subscription_status: selectedOrganization.subscription_status || null,
    }),
    organizations,
    selected_organization: {
      ...selectedOrganization,
      support_tickets_count: supportTicketsCount,
      analytics_scope_id: selectedOrganization.id,
    },
    invitation: null,
    sections: {
      support: canReadAdminSection(actor, 'support'),
      analytics: canReadAdminSection(actor, 'analytics'),
    },
  };
}

async function getUserTeamMembers(userId, filters = {}) {
  const { page = 1, limit = 20, organization_id = null } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);
  const scope = await resolveUserBusinessScope(userId, organization_id);

  if (!scope.organization) {
    return {
      data: [],
      meta: getPaginationMeta(0, page, limit),
      organization: null,
    };
  }

  const [countResult] = await sequelize.query(
    `SELECT COUNT(*) AS total
     FROM org_team_members AS tm
     WHERE tm.organization_id = :organizationId
       AND tm.deleted_at IS NULL`,
    {
      replacements: { organizationId: scope.organization.id },
      type: QueryTypes.SELECT,
    }
  );

  const total = Number(countResult?.total || 0);
  const teamMembers = await sequelize.query(
    `SELECT
        tm.id,
        tm.member_user_id,
        tm.role_title,
        tm.status,
        tm.invited_at,
        tm.joined_at,
        tm.permissions,
        member.first_name,
        member.last_name,
        member.email,
        member.phone
      FROM org_team_members AS tm
      INNER JOIN auth_users AS member
        ON member.id = tm.member_user_id
      WHERE tm.organization_id = :organizationId
        AND tm.deleted_at IS NULL
      ORDER BY tm.created_at DESC
      LIMIT :limit OFFSET :offset`,
    {
      replacements: {
        organizationId: scope.organization.id,
        limit: safeLimit,
        offset,
      },
      type: QueryTypes.SELECT,
    }
  );

  return {
    data: teamMembers.map((member) => ({
      ...member,
      permissions:
        typeof member.permissions === 'string'
          ? JSON.parse(member.permissions)
          : member.permissions,
    })),
    meta: getPaginationMeta(total, page, limit),
    organization: scope.organization,
  };
}

async function createUser(data, appLocals = {}) {
  const first_name = normalizeText(data.first_name);
  const last_name = normalizeText(data.last_name);
  const normalizedEmail = normalizeEmail(data.email);
  const phone = normalizePhone(data.phone);

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw new AppError('A user with this email already exists', 409);
  }

  const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const userId = uuidv4();
  const now = new Date();

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `INSERT INTO auth_users (
          id,
          email,
          password,
          must_change_password,
          first_name,
          last_name,
          phone,
          role,
          status,
          email_verified_at,
          created_at,
          updated_at
        )
       VALUES (
          :id,
          :email,
          :password,
          true,
          :first_name,
          :last_name,
          :phone,
          'user',
          'active',
          :now,
          :now,
          :now
       )`,
      {
        replacements: {
          id: userId,
          email: normalizedEmail,
          password: hashedPassword,
          first_name,
          last_name,
          phone,
          now,
        },
        type: QueryTypes.INSERT,
        transaction,
      }
    );

    await createDefaultOrganizationForUser(userId, transaction);
  });

  await invalidateUserAuthState(userId, appLocals);

  return getUser(userId);
}

async function inviteUser(data, invitedBy, appLocals = {}) {
  const first_name = normalizeText(data.first_name);
  const last_name = normalizeText(data.last_name);
  const normalizedEmail = normalizeEmail(data.email);
  const phone = normalizePhone(data.phone);

  await expirePendingUserInvitations();

  const [existingUser, existingInvitation] = await Promise.all([
    findUserByEmail(normalizedEmail),
    AdminUserInvitation.findOne({
      where: {
        email: normalizedEmail,
        status: 'pending',
        expires_at: { [Op.gt]: new Date() },
      },
      paranoid: false,
    }),
  ]);

  if (existingUser) {
    throw new AppError('A user with this email already exists', 409);
  }

  if (existingInvitation) {
    throw new AppError('A pending invitation already exists for this email', 409);
  }

  const invitation = await AdminUserInvitation.create({
    email: normalizedEmail,
    first_name,
    last_name,
    phone,
    invited_by_user_id: invitedBy,
    invite_token: generateInvitationToken(),
    expires_at: calculateInvitationExpiry(INVITATION_TTL_DAYS),
  });

  try {
    await sendUserInviteEmail(invitation, appLocals.kafkaProducer || null);
  } catch (error) {
    console.error('[admin-user-service] Failed to publish user invitation email:', error.message);
  }

  return invitation.toJSON();
}

async function listUserInvitations(filters) {
  const { page = 1, limit = 20 } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);

  await expirePendingUserInvitations();

  const { count, rows } = await AdminUserInvitation.findAndCountAll({
    order: [['created_at', 'DESC']],
    offset,
    limit: safeLimit,
  });

  return {
    data: rows.map((invitation) => invitation.toJSON()),
    meta: getPaginationMeta(count, page, limit),
  };
}

async function resendUserInvitation(invitationId, invitedBy, appLocals = {}) {
  await expirePendingUserInvitations();

  const invitation = await AdminUserInvitation.findByPk(invitationId);

  if (!invitation) {
    throw new AppError('Invitation not found', 404);
  }

  if (invitation.status !== 'pending') {
    throw new AppError('Only pending invitations can be resent', 400);
  }

  await invitation.update({
    invited_by_user_id: invitedBy,
    invite_token: generateInvitationToken(),
    expires_at: calculateInvitationExpiry(INVITATION_TTL_DAYS),
  });

  try {
    await sendUserInviteEmail(invitation, appLocals.kafkaProducer || null);
  } catch (error) {
    console.error('[admin-user-service] Failed to publish resent user invitation email:', error.message);
  }

  return invitation.toJSON();
}

async function revokeUserInvitation(invitationId) {
  const invitation = await AdminUserInvitation.findByPk(invitationId);

  if (!invitation) {
    throw new AppError('Invitation not found', 404);
  }

  if (invitation.status !== 'pending') {
    throw new AppError('Only pending invitations can be revoked', 400);
  }

  await invitation.update({ status: 'revoked' });
  return invitation.toJSON();
}

async function validateUserInvitation(token) {
  const invitation = await findPendingUserInvitationByToken(token);

  return {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      first_name: invitation.first_name,
      last_name: invitation.last_name,
      phone: invitation.phone,
      expires_at: invitation.expires_at,
      status: invitation.status,
    },
  };
}

async function acceptUserInvitation(data) {
  const invitation = await findPendingUserInvitationByToken(data.token);
  const normalizedEmail = normalizeEmail(invitation.email);

  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new AppError('This email already has a Nyife account. Ask the admin to sign in or update the existing account instead.', 400);
  }

  const userId = uuidv4();
  const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const now = new Date();

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `INSERT INTO auth_users (
          id,
          email,
          password,
          must_change_password,
          first_name,
          last_name,
          phone,
          role,
          status,
          email_verified_at,
          created_at,
          updated_at
        )
       VALUES (
          :id,
          :email,
          :password,
          false,
          :first_name,
          :last_name,
          :phone,
          'user',
          'active',
          :now,
          :now,
          :now
       )`,
      {
        replacements: {
          id: userId,
          email: normalizedEmail,
          password: hashedPassword,
          first_name: invitation.first_name,
          last_name: invitation.last_name,
          phone: invitation.phone || null,
          now,
        },
        type: QueryTypes.INSERT,
        transaction,
      }
    );

    await createDefaultOrganizationForUser(userId, transaction);

    await invitation.update(
      {
        status: 'accepted',
        accepted_at: now,
        accepted_user_id: userId,
      },
      { transaction }
    );
  });

  return {
    invitation: {
      id: invitation.id,
      email: invitation.email,
    },
  };
}

async function updateUser(userId, data, appLocals = {}) {
  const user = await findUserById(userId, 'id, email, first_name, last_name, phone, avatar_url, role, status');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role !== 'user') {
    throw new AppError('Only platform users can be edited in this module', 400);
  }

  const updates = {};
  let shouldRevokeRefreshTokens = false;

  if (data.first_name !== undefined) {
    updates.first_name = normalizeText(data.first_name);
  }

  if (data.last_name !== undefined) {
    updates.last_name = normalizeText(data.last_name);
  }

  if (data.phone !== undefined) {
    updates.phone = data.phone === null ? null : normalizePhone(data.phone);
  }

  if (data.email !== undefined) {
    const nextEmail = normalizeEmail(data.email);
    if (nextEmail !== normalizeEmail(user.email)) {
      const existingUser = await findUserByEmail(nextEmail);
      if (existingUser && existingUser.id !== user.id) {
        throw new AppError('A user with this email already exists', 409);
      }
      updates.email = nextEmail;
      updates.email_verified_at = new Date();
      shouldRevokeRefreshTokens = true;
    }
  }

  if (data.remove_avatar) {
    updates.avatar_url = null;
  } else if (Object.prototype.hasOwnProperty.call(data, 'avatar_url')) {
    updates.avatar_url = data.avatar_url || null;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid fields provided for update', 400);
  }

  updates.updated_at = new Date();

  await sequelize.query(
    `UPDATE auth_users
     SET ${Object.keys(updates).map((field) => `${field} = :${field}`).join(', ')}
     WHERE id = :userId
       AND deleted_at IS NULL`,
    {
      replacements: {
        userId,
        ...updates,
      },
      type: QueryTypes.UPDATE,
    }
  );

  await invalidateUserAuthState(userId, appLocals, {
    revokeRefreshTokens: shouldRevokeRefreshTokens,
  });

  return getUser(userId);
}

async function updateUserStatus(userId, status, appLocals = {}) {
  const user = await findUserById(userId, 'id, role, status');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role !== 'user') {
    throw new AppError('Only platform users can be updated in this module', 400);
  }

  const now = new Date();
  await sequelize.query(
    `UPDATE auth_users
     SET status = :status,
         updated_at = :now
     WHERE id = :userId
       AND deleted_at IS NULL`,
    {
      replacements: {
        userId,
        status,
        now,
      },
      type: QueryTypes.UPDATE,
    }
  );

  await invalidateUserAuthState(userId, appLocals, {
    revokeRefreshTokens: status !== 'active',
  });

  return { id: userId, status, updated_at: now };
}

async function deleteUser(userId, appLocals = {}) {
  const user = await findUserById(userId, 'id, role');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role !== 'user') {
    throw new AppError('Cannot delete admin users through this endpoint', 403);
  }

  const organizations = await listOrganizationsForUser(userId);
  const organizationIds = organizations.map((organization) => organization.id);

  if (organizationIds.length) {
    const [activeSubscription] = await sequelize.query(
      `SELECT id
       FROM sub_subscriptions
       WHERE user_id IN (:organizationIds)
         AND status IN ('active', 'pending')
       LIMIT 1`,
      {
        replacements: { organizationIds },
        type: QueryTypes.SELECT,
      }
    );

    if (activeSubscription) {
      throw new AppError('Cannot delete user with an active or pending subscription. Cancel it first.', 400);
    }

    const walletRows = await sequelize.query(
      `SELECT balance
       FROM wallet_wallets
       WHERE user_id IN (:organizationIds)`,
      {
        replacements: { organizationIds },
        type: QueryTypes.SELECT,
      }
    );

    if (walletRows.some((wallet) => Number(wallet.balance || 0) !== 0)) {
      throw new AppError('Cannot delete user with non-zero wallet balance. Bring every organization wallet to zero first.', 400);
    }
  }

  const now = new Date();

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `UPDATE auth_users
       SET status = 'inactive',
           deleted_at = :now,
           updated_at = :now
       WHERE id = :userId`,
      {
        replacements: { userId, now },
        type: QueryTypes.UPDATE,
        transaction,
      }
    );

    await sequelize.query(
      `UPDATE org_organizations
       SET status = 'inactive',
           deleted_at = :now,
           updated_at = :now
       WHERE user_id = :userId
         AND deleted_at IS NULL`,
      {
        replacements: { userId, now },
        type: QueryTypes.UPDATE,
        transaction,
      }
    );
  });

  await invalidateUserAuthState(userId, appLocals, { revokeRefreshTokens: true });
}

async function creditWallet(userId, amount, remarks, adminUserId, organizationId = null) {
  const scope = await resolveUserBusinessScope(userId, organizationId);

  try {
    const response = await axios.post(
      `${config.walletServiceUrl}/api/v1/wallet/admin/credit`,
      {
        user_id: scope.scope_id,
        amount,
        remarks,
        admin_user_id: adminUserId,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': adminUserId,
          'x-user-role': 'super_admin',
        },
        timeout: 10000,
      }
    );

    return {
      ...(response.data.data || response.data),
      user_id: userId,
      organization_id: scope.organization?.id || null,
    };
  } catch (err) {
    if (err.response) {
      throw new AppError(
        err.response.data.message || 'Failed to credit wallet',
        err.response.status
      );
    }
    throw new AppError('Wallet service is unavailable', 503);
  }
}

async function debitWallet(userId, amount, remarks, adminUserId, organizationId = null) {
  const scope = await resolveUserBusinessScope(userId, organizationId);

  try {
    const response = await axios.post(
      `${config.walletServiceUrl}/api/v1/wallet/admin/debit`,
      {
        user_id: scope.scope_id,
        amount,
        remarks,
        admin_user_id: adminUserId,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': adminUserId,
          'x-user-role': 'super_admin',
        },
        timeout: 10000,
      }
    );

    return {
      ...(response.data.data || response.data),
      user_id: userId,
      organization_id: scope.organization?.id || null,
    };
  } catch (err) {
    if (err.response) {
      throw new AppError(
        err.response.data.message || 'Failed to debit wallet',
        err.response.status
      );
    }
    throw new AppError('Wallet service is unavailable', 503);
  }
}

async function getUserTransactions(userId, filters) {
  const { page = 1, limit = 20, organization_id = null } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);
  const scope = await resolveUserBusinessScope(userId, organization_id);
  const scopeId = scope.scope_id;

  try {
    const [countResult] = await sequelize.query(
      'SELECT COUNT(*) AS total FROM wallet_transactions WHERE user_id = :scopeId',
      { replacements: { scopeId }, type: QueryTypes.SELECT }
    );
    const total = parseInt(countResult.total, 10);

    const transactions = await sequelize.query(
      `SELECT id, type, amount, balance_after, description, reference_id, reference_type, created_at
       FROM wallet_transactions
       WHERE user_id = :scopeId
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { scopeId, limit: safeLimit, offset },
        type: QueryTypes.SELECT,
      }
    );

    return {
      data: transactions,
      meta: getPaginationMeta(total, page, limit),
      organization: scope.organization,
    };
  } catch (_err) {
    return {
      data: [],
      meta: getPaginationMeta(0, page, limit),
      organization: scope.organization,
    };
  }
}

async function getUserSubscriptions(userId, filters) {
  const { page = 1, limit = 20, organization_id = null } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);
  const scope = await resolveUserBusinessScope(userId, organization_id);
  const scopeId = scope.scope_id;

  try {
    const [countResult] = await sequelize.query(
      'SELECT COUNT(*) AS total FROM sub_subscriptions WHERE user_id = :scopeId',
      { replacements: { scopeId }, type: QueryTypes.SELECT }
    );
    const total = parseInt(countResult.total, 10);

    const subscriptions = await sequelize.query(
      `SELECT
          s.id,
          s.plan_id,
          s.status,
          s.starts_at,
          s.expires_at,
          s.created_at,
          p.name AS plan_name,
          p.type AS plan_type,
          p.price AS plan_price
       FROM sub_subscriptions AS s
       LEFT JOIN sub_plans AS p ON p.id = s.plan_id
       WHERE s.user_id = :scopeId
       ORDER BY s.created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { scopeId, limit: safeLimit, offset },
        type: QueryTypes.SELECT,
      }
    );

    return {
      data: subscriptions,
      meta: getPaginationMeta(total, page, limit),
      organization: scope.organization,
    };
  } catch (_err) {
    return {
      data: [],
      meta: getPaginationMeta(0, page, limit),
      organization: scope.organization,
    };
  }
}

async function getUserInvoices(userId, filters) {
  const { page = 1, limit = 20, organization_id = null } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);
  const scope = await resolveUserBusinessScope(userId, organization_id);
  const scopeId = scope.scope_id;

  try {
    const [countResult] = await sequelize.query(
      'SELECT COUNT(*) AS total FROM wallet_invoices WHERE user_id = :scopeId',
      { replacements: { scopeId }, type: QueryTypes.SELECT }
    );
    const total = parseInt(countResult.total, 10);

    const invoices = await sequelize.query(
      `SELECT
          id,
          invoice_number,
          type,
          amount,
          tax_amount,
          total_amount,
          status,
          payment_method,
          paid_at,
          created_at
       FROM wallet_invoices
       WHERE user_id = :scopeId
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { scopeId, limit: safeLimit, offset },
        type: QueryTypes.SELECT,
      }
    );

    return {
      data: invoices,
      meta: getPaginationMeta(total, page, limit),
      organization: scope.organization,
    };
  } catch (_err) {
    return {
      data: [],
      meta: getPaginationMeta(0, page, limit),
      organization: scope.organization,
    };
  }
}

async function uploadUserAvatar(userId, file, appLocals = {}) {
  const user = await findUserById(userId, 'id, avatar_url, role');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role !== 'user') {
    throw new AppError('Only platform users can have avatars managed in this module', 400);
  }

  if (!file) {
    throw new AppError('Avatar file is required', 400);
  }

  if (!config.mediaServiceUrl) {
    throw new AppError('Media service is unavailable right now', 503);
  }

  const formData = new FormData();
  formData.append('file', file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  const response = await axios.post(
    `${config.mediaServiceUrl}/api/v1/media/upload`,
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        'x-user-id': userId,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 15000,
    }
  );

  const fileId = response.data?.data?.id;
  if (!fileId) {
    throw new AppError('Avatar upload failed', 502);
  }

  await sequelize.query(
    `UPDATE auth_users
     SET avatar_url = :avatarUrl,
         updated_at = NOW()
     WHERE id = :userId
       AND deleted_at IS NULL`,
    {
      replacements: {
        userId,
        avatarUrl: `media://${fileId}`,
      },
      type: QueryTypes.UPDATE,
    }
  );

  await invalidateUserAuthState(userId, appLocals);

  return {
    avatar_url: buildUserAvatarProxyUrl(userId),
    file_id: fileId,
  };
}

async function removeUserAvatar(userId, appLocals = {}) {
  const user = await findUserById(userId, 'id, avatar_url, role');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role !== 'user') {
    throw new AppError('Only platform users can have avatars managed in this module', 400);
  }

  const mediaId = extractAvatarMediaId(user.avatar_url);
  if (mediaId && config.mediaServiceUrl) {
    try {
      await axios.delete(`${config.mediaServiceUrl}/api/v1/media/${mediaId}`, {
        headers: {
          'x-user-id': userId,
        },
        timeout: 10000,
      });
    } catch (error) {
      console.warn('[admin-user-service] Failed to delete avatar media record:', error.message);
    }
  }

  await sequelize.query(
    `UPDATE auth_users
     SET avatar_url = NULL,
         updated_at = NOW()
     WHERE id = :userId
       AND deleted_at IS NULL`,
    {
      replacements: { userId },
      type: QueryTypes.UPDATE,
    }
  );

  await invalidateUserAuthState(userId, appLocals);

  return {
    avatar_url: null,
  };
}

async function streamUserAvatar(userId) {
  const user = await findUserById(userId, 'id, avatar_url, role');

  if (!user || user.role !== 'user') {
    throw new AppError('Avatar not found', 404);
  }

  const mediaId = extractAvatarMediaId(user.avatar_url);
  if (!mediaId) {
    throw new AppError('Avatar not found', 404);
  }

  const response = await axios.get(
    `${config.mediaServiceUrl}/api/v1/media/${mediaId}/download`,
    {
      headers: {
        'x-user-id': userId,
      },
      responseType: 'stream',
      timeout: 15000,
    }
  );

  return response;
}

module.exports = {
  listUsers,
  getUser,
  getUserDashboard,
  getUserTeamMembers,
  createUser,
  inviteUser,
  listUserInvitations,
  resendUserInvitation,
  revokeUserInvitation,
  validateUserInvitation,
  acceptUserInvitation,
  updateUser,
  updateUserStatus,
  deleteUser,
  creditWallet,
  debitWallet,
  getUserTransactions,
  getUserSubscriptions,
  getUserInvoices,
  uploadUserAvatar,
  removeUserAvatar,
  streamUserAvatar,
};
