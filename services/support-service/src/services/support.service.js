'use strict';

const { Op, QueryTypes } = require('sequelize');
const jwt = require('jsonwebtoken');
const { Ticket, TicketReply, TicketRead, sequelize } = require('../models');
const config = require('../config');
const {
  AppError,
  getPagination,
  getPaginationMeta,
  generateUUID,
  hasPermission,
  normalizeOrganizationPermissions,
  normalizeAdminPermissions,
} = require('@nyife/shared-utils');
const { TOPICS, publishEvent } = require('@nyife/shared-events');

const USER_ROOM_PREFIX = 'support:user:';
const ADMIN_ROOM_PREFIX = 'support:admin:';
const TICKET_ROOM_PREFIX = 'support:ticket:';
const DEFAULT_MESSAGE_PAGE_LIMIT = 30;
const MAX_MESSAGE_PAGE_LIMIT = 100;
const ROOT_MESSAGE_KIND = 'root';
const REPLY_MESSAGE_KIND = 'reply';
const ADMIN_ACTOR_TYPE = 'admin';
const USER_ACTOR_TYPE = 'user';
const TERMINAL_TICKET_STATUSES = new Set(['resolved', 'closed']);
const TICKET_LOCKED_CODE = 'SUPPORT_TICKET_LOCKED';

function buildUserRoom(userId) {
  return `${USER_ROOM_PREFIX}${userId}`;
}

function buildAdminRoom(userId) {
  return `${ADMIN_ROOM_PREFIX}${userId}`;
}

function buildTicketRoom(ticketId) {
  return `${TICKET_ROOM_PREFIX}${ticketId}`;
}

function isTerminalTicketStatus(status) {
  return TERMINAL_TICKET_STATUSES.has(status);
}

function assertTicketReplyAllowed(ticket) {
  if (isTerminalTicketStatus(ticket.status)) {
    throw AppError.conflict(
      'This ticket is locked for replies until an admin reopens it.',
      TICKET_LOCKED_CODE
    );
  }
}

function parseJsonField(value) {
  if (!value) {
    return value ?? null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
}

function buildMessagePreview(body) {
  if (!body) {
    return null;
  }

  const normalized = String(body).replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 255) : null;
}

function buildTicketNumberBase() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `NYF-TKT-${year}${month}${day}-${random}`;
}

async function generateTicketNumber() {
  let candidate = buildTicketNumberBase();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await Ticket.findOne({
      where: { ticket_number: candidate },
      attributes: ['id'],
      paranoid: false,
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${buildTicketNumberBase()}-${generateUUID().slice(0, 4).toUpperCase()}`;
  }

  return `${buildTicketNumberBase()}-${generateUUID().slice(0, 6).toUpperCase()}`;
}

function ensureValidPageLimit(limit) {
  const value = Number(limit || DEFAULT_MESSAGE_PAGE_LIMIT);
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_MESSAGE_PAGE_LIMIT;
  }
  return Math.min(value, MAX_MESSAGE_PAGE_LIMIT);
}

function buildUserViewer(actorUserId, organizationId) {
  return {
    actor_type: USER_ACTOR_TYPE,
    actor_id: actorUserId,
    user_id: actorUserId,
    organization_id: organizationId,
    is_super_admin: false,
    is_admin: false,
  };
}

function buildAdminViewer(actor) {
  const adminUserId = actor?.user?.id || actor?.user_id || actor?.id || null;

  if (!adminUserId) {
    throw AppError.unauthorized('Authentication is required to access support.', 'AUTH_REQUIRED');
  }

  return {
    actor_type: ADMIN_ACTOR_TYPE,
    actor_id: adminUserId,
    user_id: adminUserId,
    is_super_admin: actor?.is_super_admin === true,
    is_admin: true,
    permissions: normalizeAdminPermissions(actor?.permissions, { includeReserved: true }),
    role: actor?.role || null,
    raw_actor: actor,
  };
}

function dedupeIds(ids = []) {
  return Array.from(
    new Set(ids.filter((value) => typeof value === 'string' && value.trim().length > 0))
  );
}

function serializeUserSummary(row, prefix = '') {
  const id = row[`${prefix}id`] ?? row.id ?? null;
  if (!id) {
    return null;
  }

  return {
    id,
    email: row[`${prefix}email`] ?? null,
    first_name: row[`${prefix}first_name`] ?? null,
    last_name: row[`${prefix}last_name`] ?? null,
    phone: row[`${prefix}phone`] ?? null,
    avatar_url: row[`${prefix}avatar_url`] ?? null,
    role: row[`${prefix}role`] ?? null,
    status: row[`${prefix}status`] ?? null,
    full_name:
      [row[`${prefix}first_name`] ?? null, row[`${prefix}last_name`] ?? null]
        .filter(Boolean)
        .join(' ')
        .trim() || null,
  };
}

function serializeOrganizationSummary(row, prefix = 'organization_') {
  const id = row[`${prefix}id`] ?? null;
  if (!id) {
    return null;
  }

  return {
    id,
    name: row[`${prefix}name`] ?? null,
    slug: row[`${prefix}slug`] ?? null,
    status: row[`${prefix}status`] ?? null,
    logo_url: row[`${prefix}logo_url`] ?? null,
  };
}

function serializeTicket(row) {
  return {
    id: row.id,
    ticket_number: row.ticket_number,
    user_id: row.user_id,
    organization_id: row.organization_id,
    subject: row.subject,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    assigned_to: row.assigned_to || null,
    assigned_at: row.assigned_at || null,
    resolved_at: row.resolved_at || null,
    closed_at: row.closed_at || null,
    satisfaction_rating:
      row.satisfaction_rating === null || row.satisfaction_rating === undefined
        ? null
        : Number(row.satisfaction_rating),
    satisfaction_feedback: row.satisfaction_feedback || null,
    last_message_at: row.last_message_at || row.updated_at || row.created_at,
    last_message_preview: row.last_message_preview || buildMessagePreview(row.description),
    unread_count: Number(row.unread_count || 0),
    message_count: Number(row.message_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: row.creator_id ? serializeUserSummary(row, 'creator_') : null,
    assigned_admin: row.assigned_admin_id ? serializeUserSummary(row, 'assigned_admin_') : null,
    organization: serializeOrganizationSummary(row),
    can_rate:
      ['resolved', 'closed'].includes(row.status) &&
      (row.satisfaction_rating === null || row.satisfaction_rating === undefined),
  };
}

function serializeMessage(row) {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    user_id: row.user_id,
    reply_type: row.reply_type,
    message_kind: row.message_kind || REPLY_MESSAGE_KIND,
    body: row.body,
    attachments: parseJsonField(row.attachments) || null,
    created_at: row.created_at,
    sender: row.sender_id ? serializeUserSummary(row, 'sender_') : null,
  };
}

function getInclusiveDateBounds(dateFrom, dateTo) {
  const bounds = {};

  if (dateFrom) {
    const parsedFrom = new Date(dateFrom);
    if (!Number.isNaN(parsedFrom.getTime())) {
      bounds.from = parsedFrom;
    }
  }

  if (dateTo) {
    const parsedTo = new Date(dateTo);
    if (!Number.isNaN(parsedTo.getTime())) {
      parsedTo.setHours(23, 59, 59, 999);
      bounds.to = parsedTo;
    }
  }

  return bounds;
}

async function publishSupportEvent(kafkaProducer, topic, key, payload) {
  if (!kafkaProducer) {
    return;
  }

  try {
    await publishEvent(kafkaProducer, topic, key, payload);
  } catch (error) {
    console.error('[support-service] Failed to publish support event:', error.message);
  }
}

async function sendNotification(kafkaProducer, userId, notificationData) {
  if (!kafkaProducer || !userId) {
    return;
  }

  try {
    await publishEvent(kafkaProducer, TOPICS.NOTIFICATION_SEND, userId, {
      userId,
      type: notificationData.type || 'in_app',
      title: notificationData.title,
      body: notificationData.body,
      data: notificationData.data || {},
      channel: notificationData.channel || 'support',
    });
  } catch (err) {
    console.error('[support-service] Failed to publish notification:', err.message);
  }
}

function runDetachedSideEffect(label, effectPromise) {
  Promise.resolve(effectPromise).catch((error) => {
    console.error(`[support-service] ${label} failed:`, error?.message || error);
  });
}

async function findTicketById(ticketId, options = {}) {
  const { transaction = null, includeDeleted = false } = options;
  return Ticket.findOne({
    where: includeDeleted ? { id: ticketId } : { id: ticketId, deleted_at: null },
    transaction,
  });
}

async function getActiveSupportSubAdminByUserId(userId) {
  const [row] = await sequelize.query(
    `SELECT
       sa.user_id,
       sa.role_id,
       sa.status AS sub_admin_status,
       ar.title AS role_title,
       ar.permissions AS role_permissions,
       au.id AS user_id_lookup,
       au.email,
       au.first_name,
       au.last_name,
       au.phone,
       au.avatar_url,
       au.role,
       au.status AS user_status
     FROM admin_sub_admins AS sa
     INNER JOIN admin_roles AS ar
       ON ar.id = sa.role_id
     INNER JOIN auth_users AS au
       ON au.id = sa.user_id
      AND au.deleted_at IS NULL
     WHERE sa.user_id = :userId
       AND sa.deleted_at IS NULL
       AND sa.status = 'active'
     LIMIT 1`,
    {
      replacements: { userId },
      type: QueryTypes.SELECT,
    }
  );

  if (!row) {
    return null;
  }

  const permissions = normalizeAdminPermissions(parseJsonField(row.role_permissions));

  if (!hasPermission(permissions, 'support', 'read')) {
    return null;
  }

  return {
    user: {
      id: row.user_id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      phone: row.phone,
      avatar_url: row.avatar_url,
      role: row.role,
      status: row.user_status,
    },
    actor_type: 'sub_admin',
    is_super_admin: false,
    permissions,
    role: {
      id: row.role_id,
      title: row.role_title,
      permissions,
    },
    sub_admin: {
      user_id: row.user_id,
      role_id: row.role_id,
      status: row.sub_admin_status,
    },
  };
}

async function getSupportAdminViewerByUserId(userId) {
  const [user] = await sequelize.query(
    `SELECT id, email, role, status
     FROM auth_users
     WHERE id = :userId
       AND deleted_at IS NULL
     LIMIT 1`,
    {
      replacements: { userId },
      type: QueryTypes.SELECT,
    }
  );

  if (!user) {
    return null;
  }

  if (user.role === 'super_admin') {
    return buildAdminViewer({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      is_super_admin: true,
      permissions: { resources: { support: { create: true, read: true, update: true, delete: true } } },
    });
  }

  const actor = await getActiveSupportSubAdminByUserId(userId);
  return actor ? buildAdminViewer(actor) : null;
}

async function resolveRealtimeActor(token) {
  const decoded = jwt.verify(token, config.jwt.secret);
  const userId = decoded.id || decoded.userId;
  const userRole = decoded.role;

  if (!userId) {
    throw AppError.unauthorized('Authentication required', 'AUTH_REQUIRED');
  }

  if (userRole === 'super_admin') {
    return {
      mode: ADMIN_ACTOR_TYPE,
      actor: {
        user: {
          id: userId,
          role: userRole,
          email: decoded.email || null,
        },
        actor_type: 'super_admin',
        is_super_admin: true,
        permissions: normalizeAdminPermissions(
          { resources: { support: { create: true, read: true, update: true, delete: true } } },
          { includeReserved: true }
        ),
      },
    };
  }

  if (userRole === 'admin') {
    const actor = await getActiveSupportSubAdminByUserId(userId);
    if (!actor) {
      throw AppError.forbidden('You do not have access to the support desk.', 'INSUFFICIENT_PERMISSIONS');
    }

    return {
      mode: ADMIN_ACTOR_TYPE,
      actor,
    };
  }

  return {
    mode: USER_ACTOR_TYPE,
    actor: {
      user: {
        id: userId,
        role: userRole,
        email: decoded.email || null,
      },
      actor_type: USER_ACTOR_TYPE,
    },
  };
}

async function getOrganizationSupportAudienceUserIds(organizationId) {
  const rows = await sequelize.query(
    `SELECT
       owner.user_id AS member_user_id,
       NULL AS permissions,
       'owner' AS member_type
     FROM org_organizations AS owner
     INNER JOIN auth_users AS auth_user
       ON auth_user.id = owner.user_id
      AND auth_user.deleted_at IS NULL
      AND auth_user.status = 'active'
     WHERE owner.id = :organizationId
       AND owner.deleted_at IS NULL
       AND owner.status = 'active'
     UNION ALL
     SELECT
       tm.member_user_id,
       tm.permissions,
       'team' AS member_type
     FROM org_team_members AS tm
     INNER JOIN auth_users AS auth_user
       ON auth_user.id = tm.member_user_id
      AND auth_user.deleted_at IS NULL
      AND auth_user.status = 'active'
     WHERE tm.organization_id = :organizationId
       AND tm.deleted_at IS NULL
       AND tm.status = 'active'`,
    {
      replacements: { organizationId },
      type: QueryTypes.SELECT,
    }
  );

  const audience = rows
    .filter((row) => {
      if (row.member_type === 'owner') {
        return true;
      }

      const permissions = normalizeOrganizationPermissions(parseJsonField(row.permissions));
      return hasPermission(permissions, 'support', 'read');
    })
    .map((row) => row.member_user_id);

  return dedupeIds(audience);
}

async function getSuperAdminUserIds() {
  const rows = await sequelize.query(
    `SELECT id
     FROM auth_users
     WHERE role = 'super_admin'
       AND deleted_at IS NULL
       AND status = 'active'`,
    { type: QueryTypes.SELECT }
  );

  return rows.map((row) => row.id);
}

async function getTicketAudience(ticket) {
  const [userIds, superAdminIds] = await Promise.all([
    getOrganizationSupportAudienceUserIds(ticket.organization_id),
    getSuperAdminUserIds(),
  ]);

  const adminIds = ticket.assigned_to
    ? dedupeIds([...superAdminIds, ticket.assigned_to])
    : dedupeIds(superAdminIds);

  return {
    userIds,
    adminIds,
  };
}

async function emitUnreadBadgeUpdate(io, roomType, userId, unreadCount, organizationId = null) {
  if (!io || !userId) {
    return;
  }

  const room = roomType === ADMIN_ACTOR_TYPE ? buildAdminRoom(userId) : buildUserRoom(userId);
  io.to(room).emit('support:badge.updated', {
    unread_count: unreadCount,
    actor_type: roomType,
    organization_id: organizationId,
  });
}

async function emitUnreadBadgeUpdates(io, ticket) {
  if (!io || !ticket) {
    return;
  }

  const { userIds, adminIds } = await getTicketAudience(ticket);

  await Promise.all([
    ...userIds.map(async (userId) => {
      const unreadCount = await getUnreadCountForViewer(buildUserViewer(userId, ticket.organization_id));
      await emitUnreadBadgeUpdate(io, USER_ACTOR_TYPE, userId, unreadCount, ticket.organization_id);
    }),
    ...adminIds.map(async (userId) => {
      const actor = await getSupportAdminViewerByUserId(userId);
      const unreadCount = actor ? await getUnreadCountForViewer(actor) : 0;
      await emitUnreadBadgeUpdate(io, ADMIN_ACTOR_TYPE, userId, unreadCount, ticket.organization_id);
    }),
  ]);
}

async function upsertReadState(ticketId, actorId, actorType, messageId, messageCreatedAt, transaction = null) {
  const now = new Date();

  await sequelize.query(
    `INSERT INTO support_ticket_reads (
       id,
       ticket_id,
       actor_id,
       actor_type,
       last_read_message_id,
       last_read_at,
       created_at,
       updated_at
     )
     VALUES (
       :id,
       :ticketId,
       :actorId,
       :actorType,
       :messageId,
       :lastReadAt,
       :createdAt,
       :updatedAt
     )
     ON DUPLICATE KEY UPDATE
       last_read_message_id = VALUES(last_read_message_id),
       last_read_at = VALUES(last_read_at),
       updated_at = VALUES(updated_at)`,
    {
      replacements: {
        id: generateUUID(),
        ticketId,
        actorId,
        actorType,
        messageId,
        lastReadAt: messageCreatedAt,
        createdAt: now,
        updatedAt: now,
      },
      type: QueryTypes.INSERT,
      transaction,
    }
  );
}

async function getLatestMessageForTicket(ticketId, transaction = null) {
  const [message] = await sequelize.query(
    `SELECT id, created_at
     FROM support_ticket_replies
     WHERE ticket_id = :ticketId
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    {
      replacements: { ticketId },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  return message || null;
}

async function getUnreadCountForViewer(viewer) {
  const replacements = {
    actorId: viewer.actor_id,
    actorType: viewer.actor_type,
  };

  const conditions = ['ticket.deleted_at IS NULL'];

  if (viewer.actor_type === USER_ACTOR_TYPE) {
    conditions.push('ticket.organization_id = :organizationId');
    replacements.organizationId = viewer.organization_id;
  } else if (!viewer.is_super_admin) {
    conditions.push('ticket.assigned_to = :assignedTo');
    replacements.assignedTo = viewer.user_id;
  }

  const [row] = await sequelize.query(
    `SELECT COUNT(*) AS total
     FROM support_ticket_replies AS reply
     INNER JOIN support_tickets AS ticket
       ON ticket.id = reply.ticket_id
     LEFT JOIN support_ticket_reads AS read_state
       ON read_state.ticket_id = ticket.id
      AND read_state.actor_id = :actorId
      AND read_state.actor_type = :actorType
     WHERE ${conditions.join(' AND ')}
       AND reply.user_id <> :actorId
       AND (
         read_state.last_read_at IS NULL
         OR reply.created_at > read_state.last_read_at
       )`,
    {
      replacements,
      type: QueryTypes.SELECT,
    }
  );

  return Number(row?.total || 0);
}

function buildUserTicketListWhere(viewer, filters, replacements) {
  const conditions = ['ticket.deleted_at IS NULL', 'ticket.organization_id = :organizationId'];
  replacements.organizationId = viewer.organization_id;

  if (filters.status) {
    conditions.push('ticket.status = :status');
    replacements.status = filters.status;
  }

  if (filters.category) {
    conditions.push('ticket.category = :category');
    replacements.category = filters.category;
  }

  if (filters.search) {
    conditions.push(
      '(ticket.subject LIKE :search OR ticket.ticket_number LIKE :search OR ticket.last_message_preview LIKE :search)'
    );
    replacements.search = `%${filters.search}%`;
  }

  if (filters.unread === true) {
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM support_ticket_replies AS unread_reply
        LEFT JOIN support_ticket_reads AS unread_state
          ON unread_state.ticket_id = ticket.id
         AND unread_state.actor_id = :actorId
         AND unread_state.actor_type = :actorType
        WHERE unread_reply.ticket_id = ticket.id
          AND unread_reply.user_id <> :actorId
          AND (
            unread_state.last_read_at IS NULL
            OR unread_reply.created_at > unread_state.last_read_at
          )
      )`
    );
  }

  return conditions;
}

function buildAdminTicketListWhere(viewer, filters, replacements) {
  const conditions = ['ticket.deleted_at IS NULL'];

  if (!viewer.is_super_admin) {
    conditions.push('ticket.assigned_to = :assignedTo');
    replacements.assignedTo = viewer.user_id;
  }

  if (filters.status) {
    conditions.push('ticket.status = :status');
    replacements.status = filters.status;
  }

  if (filters.priority) {
    conditions.push('ticket.priority = :priority');
    replacements.priority = filters.priority;
  }

  if (filters.category) {
    conditions.push('ticket.category = :category');
    replacements.category = filters.category;
  }

  if (filters.assigned_to) {
    conditions.push('ticket.assigned_to = :filterAssignedTo');
    replacements.filterAssignedTo = filters.assigned_to;
  }

  if (filters.user_id) {
    conditions.push('ticket.user_id = :userId');
    replacements.userId = filters.user_id;
  }

  if (filters.organization_id) {
    conditions.push('ticket.organization_id = :organizationId');
    replacements.organizationId = filters.organization_id;
  }

  if (filters.search) {
    conditions.push(
      `(
        ticket.subject LIKE :search
        OR ticket.ticket_number LIKE :search
        OR ticket.description LIKE :search
        OR ticket.last_message_preview LIKE :search
        OR creator.email LIKE :search
        OR creator.first_name LIKE :search
        OR creator.last_name LIKE :search
      )`
    );
    replacements.search = `%${filters.search}%`;
  }

  if (filters.unread === true) {
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM support_ticket_replies AS unread_reply
        LEFT JOIN support_ticket_reads AS unread_state
          ON unread_state.ticket_id = ticket.id
         AND unread_state.actor_id = :actorId
         AND unread_state.actor_type = :actorType
        WHERE unread_reply.ticket_id = ticket.id
          AND unread_reply.user_id <> :actorId
          AND (
            unread_state.last_read_at IS NULL
            OR unread_reply.created_at > unread_state.last_read_at
          )
      )`
    );
  }

  const bounds = getInclusiveDateBounds(filters.date_from, filters.date_to);
  if (bounds.from) {
    conditions.push('ticket.created_at >= :dateFrom');
    replacements.dateFrom = bounds.from;
  }
  if (bounds.to) {
    conditions.push('ticket.created_at <= :dateTo');
    replacements.dateTo = bounds.to;
  }

  return conditions;
}

async function assertUserTicketAccess(viewer, ticketId) {
  const ticket = await findTicketById(ticketId);
  if (!ticket || ticket.organization_id !== viewer.organization_id) {
    throw AppError.notFound('Ticket not found');
  }

  return ticket;
}

async function assertAdminTicketAccess(viewer, ticketId) {
  const ticket = await findTicketById(ticketId);
  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  if (!viewer.is_super_admin && ticket.assigned_to !== viewer.user_id) {
    throw AppError.forbidden('You do not have access to this ticket.', 'INSUFFICIENT_PERMISSIONS');
  }

  return ticket;
}

async function getThreadMessages(ticketId, page = 1, limit = DEFAULT_MESSAGE_PAGE_LIMIT) {
  const safeLimit = ensureValidPageLimit(limit);
  const { offset, limit: paginationLimit } = getPagination(page, safeLimit);

  const [countRow] = await sequelize.query(
    `SELECT COUNT(*) AS total
     FROM support_ticket_replies
     WHERE ticket_id = :ticketId`,
    {
      replacements: { ticketId },
      type: QueryTypes.SELECT,
    }
  );

  const rows = await sequelize.query(
    `SELECT
       reply.*,
       sender.id AS sender_id,
       sender.email AS sender_email,
       sender.first_name AS sender_first_name,
       sender.last_name AS sender_last_name,
       sender.phone AS sender_phone,
       sender.avatar_url AS sender_avatar_url,
       sender.role AS sender_role,
       sender.status AS sender_status
     FROM support_ticket_replies AS reply
     LEFT JOIN auth_users AS sender
       ON sender.id = reply.user_id
      AND sender.deleted_at IS NULL
     WHERE reply.ticket_id = :ticketId
     ORDER BY reply.created_at DESC, reply.id DESC
     LIMIT :limit OFFSET :offset`,
    {
      replacements: {
        ticketId,
        limit: paginationLimit,
        offset,
      },
      type: QueryTypes.SELECT,
    }
  );

  return {
    messages: rows.reverse().map(serializeMessage),
    meta: getPaginationMeta(Number(countRow?.total || 0), Number(page || 1), safeLimit),
  };
}

async function getTicketBootstrap(ticketId) {
  const [row] = await sequelize.query(
    `SELECT
       ticket.*,
       creator.id AS creator_id,
       creator.email AS creator_email,
       creator.first_name AS creator_first_name,
       creator.last_name AS creator_last_name,
       creator.phone AS creator_phone,
       creator.avatar_url AS creator_avatar_url,
       creator.role AS creator_role,
       creator.status AS creator_status,
       organization.id AS organization_id,
       organization.name AS organization_name,
       organization.slug AS organization_slug,
       organization.status AS organization_status,
       organization.logo_url AS organization_logo_url,
       assigned_admin.id AS assigned_admin_id,
       assigned_admin.email AS assigned_admin_email,
       assigned_admin.first_name AS assigned_admin_first_name,
       assigned_admin.last_name AS assigned_admin_last_name,
       assigned_admin.phone AS assigned_admin_phone,
       assigned_admin.avatar_url AS assigned_admin_avatar_url,
       assigned_admin.role AS assigned_admin_role,
       assigned_admin.status AS assigned_admin_status,
       (
         SELECT COUNT(*)
         FROM support_ticket_replies AS reply
         WHERE reply.ticket_id = ticket.id
       ) AS message_count
     FROM support_tickets AS ticket
     LEFT JOIN auth_users AS creator
       ON creator.id = ticket.user_id
      AND creator.deleted_at IS NULL
     LEFT JOIN org_organizations AS organization
       ON organization.id = ticket.organization_id
      AND organization.deleted_at IS NULL
     LEFT JOIN auth_users AS assigned_admin
       ON assigned_admin.id = ticket.assigned_to
      AND assigned_admin.deleted_at IS NULL
     WHERE ticket.id = :ticketId
       AND ticket.deleted_at IS NULL
     LIMIT 1`,
    {
      replacements: { ticketId },
      type: QueryTypes.SELECT,
    }
  );

  if (!row) {
    throw AppError.notFound('Ticket not found');
  }

  return serializeTicket({
    ...row,
    unread_count: 0,
  });
}

async function getAssignableAdmins() {
  const rows = await sequelize.query(
    `SELECT
       sub_admin.user_id,
       sub_admin.last_login_at,
       sub_admin.created_at,
       role.id AS role_id,
       role.title AS role_title,
       role.permissions AS role_permissions,
       user.id AS auth_user_id,
       user.email,
       user.first_name,
       user.last_name,
       user.phone,
       user.avatar_url,
       user.status
     FROM admin_sub_admins AS sub_admin
     INNER JOIN admin_roles AS role
       ON role.id = sub_admin.role_id
     INNER JOIN auth_users AS user
       ON user.id = sub_admin.user_id
      AND user.deleted_at IS NULL
     WHERE sub_admin.deleted_at IS NULL
       AND sub_admin.status = 'active'
       AND user.status = 'active'
     ORDER BY user.first_name ASC, user.last_name ASC, user.email ASC`,
    { type: QueryTypes.SELECT }
  );

  return rows
    .map((row) => {
      const permissions = normalizeAdminPermissions(parseJsonField(row.role_permissions));
      if (!hasPermission(permissions, 'support', 'read')) {
        return null;
      }

      return {
        user_id: row.user_id,
        role_id: row.role_id,
        role_title: row.role_title,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        phone: row.phone,
        avatar_url: row.avatar_url,
        status: row.status,
        last_login_at: row.last_login_at,
      };
    })
    .filter(Boolean);
}

async function assertAssignableSubAdminUserId(adminUserId) {
  const admins = await getAssignableAdmins();
  const matched = admins.find((admin) => admin.user_id === adminUserId);
  if (!matched) {
    throw AppError.badRequest('Select an active sub-admin with support access.');
  }

  return matched;
}

async function emitTicketLifecycle(io, eventName, ticket, payload = {}) {
  if (!io || !ticket) {
    return;
  }

  const { userIds, adminIds } = await getTicketAudience(ticket);
  const ticketPayload = {
    ticket_id: ticket.id,
    organization_id: ticket.organization_id,
    ...payload,
  };

  io.to(buildTicketRoom(ticket.id)).emit(eventName, ticketPayload);

  userIds.forEach((userId) => {
    io.to(buildUserRoom(userId)).emit('support:ticket.updated', ticketPayload);
  });

  adminIds.forEach((userId) => {
    io.to(buildAdminRoom(userId)).emit('support:ticket.updated', ticketPayload);
  });
}

async function createTicket(actorUserId, organizationId, data, io, kafkaProducer) {
  const ticketNumber = await generateTicketNumber();
  const now = new Date();

  const result = await sequelize.transaction(async (transaction) => {
    const ticket = await Ticket.create(
      {
        id: generateUUID(),
        ticket_number: ticketNumber,
        user_id: actorUserId,
        organization_id: organizationId,
        subject: data.subject,
        description: data.description,
        category: data.category,
        priority: data.priority || 'medium',
        status: 'open',
        last_message_at: now,
        last_message_preview: buildMessagePreview(data.description),
      },
      { transaction }
    );

    const rootMessage = await TicketReply.create(
      {
        id: generateUUID(),
        ticket_id: ticket.id,
        user_id: actorUserId,
        reply_type: 'user',
        message_kind: ROOT_MESSAGE_KIND,
        body: data.description,
        attachments: data.attachments || null,
      },
      { transaction }
    );

    await upsertReadState(
      ticket.id,
      actorUserId,
      USER_ACTOR_TYPE,
      rootMessage.id,
      rootMessage.created_at,
      transaction
    );

    return {
      ticket,
      rootMessage,
    };
  });

  const bootstrap = await getTicketBootstrap(result.ticket.id);
  const { messages, meta } = await getThreadMessages(result.ticket.id, 1, DEFAULT_MESSAGE_PAGE_LIMIT);

  await Promise.all([
    emitTicketLifecycle(io, 'support:ticket.updated', result.ticket, {
      ticket: bootstrap,
      reason: 'created',
    }),
    emitUnreadBadgeUpdates(io, result.ticket),
  ]);

  runDetachedSideEffect(
    'support ticket created notification',
    sendNotification(kafkaProducer, actorUserId, {
      type: 'in_app',
      title: 'Support ticket created',
      body: `Ticket #${ticketNumber} has been created.`,
      data: { ticketId: result.ticket.id, ticketNumber, action: 'support_ticket_created' },
      channel: 'support',
    })
  );
  runDetachedSideEffect(
    'support ticket created event',
    publishSupportEvent(kafkaProducer, TOPICS.SUPPORT_TICKET_CREATED, result.ticket.id, {
      ticketId: result.ticket.id,
      ticketNumber,
      organizationId,
      userId: actorUserId,
      status: 'open',
      timestamp: now.toISOString(),
    })
  );

  return {
    ticket: bootstrap,
    messages,
    messages_meta: meta,
  };
}

async function listUserTickets(viewer, filters) {
  const { page = 1, limit = 20 } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);
  const replacements = {
    actorId: viewer.actor_id,
    actorType: viewer.actor_type,
    limit: paginationLimit,
    offset,
  };

  const conditions = buildUserTicketListWhere(viewer, filters, replacements);
  const whereClause = conditions.join(' AND ');

  const [countRow] = await sequelize.query(
    `SELECT COUNT(*) AS total
     FROM support_tickets AS ticket
     WHERE ${whereClause}`,
    {
      replacements,
      type: QueryTypes.SELECT,
    }
  );

  const rows = await sequelize.query(
    `SELECT
       ticket.*,
       organization.id AS organization_id,
       organization.name AS organization_name,
       organization.slug AS organization_slug,
       organization.status AS organization_status,
       organization.logo_url AS organization_logo_url,
       (
         SELECT COUNT(*)
         FROM support_ticket_replies AS reply
         WHERE reply.ticket_id = ticket.id
       ) AS message_count,
       (
         SELECT COUNT(*)
         FROM support_ticket_replies AS reply
         LEFT JOIN support_ticket_reads AS read_state
           ON read_state.ticket_id = ticket.id
          AND read_state.actor_id = :actorId
          AND read_state.actor_type = :actorType
         WHERE reply.ticket_id = ticket.id
           AND reply.user_id <> :actorId
           AND (
             read_state.last_read_at IS NULL
             OR reply.created_at > read_state.last_read_at
           )
       ) AS unread_count
     FROM support_tickets AS ticket
     LEFT JOIN org_organizations AS organization
       ON organization.id = ticket.organization_id
      AND organization.deleted_at IS NULL
     WHERE ${whereClause}
     ORDER BY ticket.last_message_at DESC, ticket.created_at DESC
     LIMIT :limit OFFSET :offset`,
    {
      replacements,
      type: QueryTypes.SELECT,
    }
  );

  return {
    tickets: rows.map(serializeTicket),
    meta: getPaginationMeta(Number(countRow?.total || 0), Number(page || 1), Number(limit || 20)),
  };
}

async function getUserTicket(viewer, ticketId) {
  await assertUserTicketAccess(viewer, ticketId);
  const ticket = await getTicketBootstrap(ticketId);
  const { messages, meta } = await getThreadMessages(ticketId, 1, DEFAULT_MESSAGE_PAGE_LIMIT);
  ticket.unread_count = await getUnreadCountForSingleTicket(viewer, ticketId);

  return {
    ticket,
    messages,
    messages_meta: meta,
  };
}

async function getUnreadCountForSingleTicket(viewer, ticketId) {
  const [row] = await sequelize.query(
    `SELECT COUNT(*) AS total
     FROM support_ticket_replies AS reply
     LEFT JOIN support_ticket_reads AS read_state
       ON read_state.ticket_id = :ticketId
      AND read_state.actor_id = :actorId
      AND read_state.actor_type = :actorType
     WHERE reply.ticket_id = :ticketId
       AND reply.user_id <> :actorId
       AND (
         read_state.last_read_at IS NULL
         OR reply.created_at > read_state.last_read_at
       )`,
    {
      replacements: {
        ticketId,
        actorId: viewer.actor_id,
        actorType: viewer.actor_type,
      },
      type: QueryTypes.SELECT,
    }
  );

  return Number(row?.total || 0);
}

async function getUserTicketMessages(viewer, ticketId, filters) {
  await assertUserTicketAccess(viewer, ticketId);
  return getThreadMessages(ticketId, filters.page, filters.limit);
}

async function markTicketRead(viewer, ticketId, io) {
  const ticket =
    viewer.actor_type === USER_ACTOR_TYPE
      ? await assertUserTicketAccess(viewer, ticketId)
      : await assertAdminTicketAccess(viewer, ticketId);

  const latestMessage = await getLatestMessageForTicket(ticket.id);
  if (latestMessage) {
    await upsertReadState(
      ticket.id,
      viewer.actor_id,
      viewer.actor_type,
      latestMessage.id,
      latestMessage.created_at
    );
  }

  const unreadCount = await getUnreadCountForViewer(viewer);

  if (io) {
    const room = viewer.actor_type === ADMIN_ACTOR_TYPE
      ? buildAdminRoom(viewer.user_id)
      : buildUserRoom(viewer.user_id);

    io.to(room).emit('support:badge.updated', {
      unread_count: unreadCount,
      actor_type: viewer.actor_type,
      organization_id: ticket.organization_id,
    });
    io.to(buildTicketRoom(ticket.id)).emit('support:thread.read', {
      ticket_id: ticket.id,
      actor_id: viewer.actor_id,
      actor_type: viewer.actor_type,
    });
  }

  return {
    ticket_id: ticket.id,
    unread_count: unreadCount,
  };
}

async function replyToTicket(viewer, ticketId, data, io, kafkaProducer) {
  const ticket = await assertUserTicketAccess(viewer, ticketId);
  assertTicketReplyAllowed(ticket);

  const now = new Date();
  const result = await sequelize.transaction(async (transaction) => {
    const reply = await TicketReply.create(
      {
        id: generateUUID(),
        ticket_id: ticket.id,
        user_id: viewer.user_id,
        reply_type: 'user',
        message_kind: REPLY_MESSAGE_KIND,
        body: data.body,
        attachments: data.attachments || null,
      },
      { transaction }
    );

    const updateData = {
      last_message_at: reply.created_at || now,
      last_message_preview: buildMessagePreview(data.body),
    };

    if (ticket.status === 'waiting_on_user') {
      updateData.status = 'open';
      updateData.resolved_at = null;
      updateData.closed_at = null;
    }

    await ticket.update(updateData, { transaction });

    await upsertReadState(
      ticket.id,
      viewer.actor_id,
      viewer.actor_type,
      reply.id,
      reply.created_at,
      transaction
    );

    return reply;
  });

  const ticketAfter = await getTicketBootstrap(ticket.id);
  const replyRow = (
    await sequelize.query(
      `SELECT
         reply.*,
         sender.id AS sender_id,
         sender.email AS sender_email,
         sender.first_name AS sender_first_name,
         sender.last_name AS sender_last_name,
         sender.phone AS sender_phone,
         sender.avatar_url AS sender_avatar_url,
         sender.role AS sender_role,
         sender.status AS sender_status
       FROM support_ticket_replies AS reply
       LEFT JOIN auth_users AS sender
         ON sender.id = reply.user_id
        AND sender.deleted_at IS NULL
       WHERE reply.id = :replyId
       LIMIT 1`,
      {
        replacements: { replyId: result.id },
        type: QueryTypes.SELECT,
      }
    )
  )[0];
  const serializedReply = serializeMessage(replyRow);

  await Promise.all([
    emitTicketLifecycle(io, 'support:message.created', ticket, {
      ticket: ticketAfter,
      message: serializedReply,
    }),
    emitUnreadBadgeUpdates(io, ticket),
  ]);

  runDetachedSideEffect(
    'support user reply notification',
    sendNotification(kafkaProducer, ticket.assigned_to, {
      type: 'in_app',
      title: 'New support reply',
      body: `A new user reply was added to ticket #${ticket.ticket_number}.`,
      data: { ticketId: ticket.id, ticketNumber: ticket.ticket_number, action: 'support_user_reply' },
      channel: 'support',
    })
  );
  runDetachedSideEffect(
    'support user reply event',
    publishSupportEvent(kafkaProducer, TOPICS.SUPPORT_MESSAGE_CREATED, ticket.id, {
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      organizationId: ticket.organization_id,
      userId: viewer.user_id,
      messageId: result.id,
      replyType: 'user',
      timestamp: now.toISOString(),
    })
  );

  return {
    reply: serializedReply,
    ticket: ticketAfter,
  };
}

async function closeTicket(viewer, ticketId, io, kafkaProducer) {
  const ticket = await assertUserTicketAccess(viewer, ticketId);

  if (ticket.status === 'closed') {
    throw AppError.badRequest('Ticket is already closed.');
  }

  const now = new Date();
  await ticket.update({
    status: 'closed',
    closed_at: now,
  });

  const ticketAfter = await getTicketBootstrap(ticket.id);

  await Promise.all([
    emitTicketLifecycle(io, 'support:status.updated', ticket, {
      ticket: ticketAfter,
      status: 'closed',
    }),
    emitUnreadBadgeUpdates(io, ticket),
  ]);

  runDetachedSideEffect(
    'support ticket closed event',
    publishSupportEvent(kafkaProducer, TOPICS.SUPPORT_TICKET_STATUS_UPDATED, ticket.id, {
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      organizationId: ticket.organization_id,
      status: 'closed',
      actorId: viewer.user_id,
      actorType: USER_ACTOR_TYPE,
      timestamp: now.toISOString(),
    })
  );

  return ticketAfter;
}

async function rateTicket(viewer, ticketId, data, io, kafkaProducer) {
  const ticket = await assertUserTicketAccess(viewer, ticketId);

  if (!['resolved', 'closed'].includes(ticket.status)) {
    throw AppError.badRequest('Ticket can only be rated after it has been resolved or closed.');
  }

  if (ticket.satisfaction_rating !== null && ticket.satisfaction_rating !== undefined) {
    throw AppError.badRequest('This ticket has already been rated.');
  }

  await ticket.update({
    satisfaction_rating: data.satisfaction_rating,
    satisfaction_feedback: data.satisfaction_feedback || null,
  });

  const ticketAfter = await getTicketBootstrap(ticket.id);

  await Promise.all([
    emitTicketLifecycle(io, 'support:ticket.updated', ticket, {
      ticket: ticketAfter,
      reason: 'rated',
    }),
  ]);

  runDetachedSideEffect(
    'support ticket rated event',
    publishSupportEvent(kafkaProducer, TOPICS.SUPPORT_TICKET_RATED, ticket.id, {
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      organizationId: ticket.organization_id,
      userId: viewer.user_id,
      rating: data.satisfaction_rating,
      timestamp: new Date().toISOString(),
    })
  );

  return ticketAfter;
}

async function getUserUnreadCount(viewer) {
  return getUnreadCountForViewer(viewer);
}

async function adminListTickets(viewer, filters) {
  const { page = 1, limit = 20 } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);
  const replacements = {
    actorId: viewer.actor_id,
    actorType: viewer.actor_type,
    limit: paginationLimit,
    offset,
  };

  const conditions = buildAdminTicketListWhere(viewer, filters, replacements);
  const whereClause = conditions.join(' AND ');

  const [countRow] = await sequelize.query(
    `SELECT COUNT(*) AS total
     FROM support_tickets AS ticket
     LEFT JOIN auth_users AS creator
       ON creator.id = ticket.user_id
      AND creator.deleted_at IS NULL
     LEFT JOIN org_organizations AS organization
       ON organization.id = ticket.organization_id
      AND organization.deleted_at IS NULL
     WHERE ${whereClause}`,
    {
      replacements,
      type: QueryTypes.SELECT,
    }
  );

  const rows = await sequelize.query(
    `SELECT
       ticket.*,
       creator.id AS creator_id,
       creator.email AS creator_email,
       creator.first_name AS creator_first_name,
       creator.last_name AS creator_last_name,
       creator.phone AS creator_phone,
       creator.avatar_url AS creator_avatar_url,
       creator.role AS creator_role,
       creator.status AS creator_status,
       organization.id AS organization_id,
       organization.name AS organization_name,
       organization.slug AS organization_slug,
       organization.status AS organization_status,
       organization.logo_url AS organization_logo_url,
       assigned_admin.id AS assigned_admin_id,
       assigned_admin.email AS assigned_admin_email,
       assigned_admin.first_name AS assigned_admin_first_name,
       assigned_admin.last_name AS assigned_admin_last_name,
       assigned_admin.phone AS assigned_admin_phone,
       assigned_admin.avatar_url AS assigned_admin_avatar_url,
       assigned_admin.role AS assigned_admin_role,
       assigned_admin.status AS assigned_admin_status,
       (
         SELECT COUNT(*)
         FROM support_ticket_replies AS reply
         WHERE reply.ticket_id = ticket.id
       ) AS message_count,
       (
         SELECT COUNT(*)
         FROM support_ticket_replies AS reply
         LEFT JOIN support_ticket_reads AS read_state
           ON read_state.ticket_id = ticket.id
          AND read_state.actor_id = :actorId
          AND read_state.actor_type = :actorType
         WHERE reply.ticket_id = ticket.id
           AND reply.user_id <> :actorId
           AND (
             read_state.last_read_at IS NULL
             OR reply.created_at > read_state.last_read_at
           )
       ) AS unread_count
     FROM support_tickets AS ticket
     LEFT JOIN auth_users AS creator
       ON creator.id = ticket.user_id
      AND creator.deleted_at IS NULL
     LEFT JOIN org_organizations AS organization
       ON organization.id = ticket.organization_id
      AND organization.deleted_at IS NULL
     LEFT JOIN auth_users AS assigned_admin
       ON assigned_admin.id = ticket.assigned_to
      AND assigned_admin.deleted_at IS NULL
     WHERE ${whereClause}
     ORDER BY ticket.last_message_at DESC, ticket.created_at DESC
     LIMIT :limit OFFSET :offset`,
    {
      replacements,
      type: QueryTypes.SELECT,
    }
  );

  return {
    tickets: rows.map(serializeTicket),
    meta: getPaginationMeta(Number(countRow?.total || 0), Number(page || 1), Number(limit || 20)),
  };
}

async function adminGetTicket(viewer, ticketId) {
  await assertAdminTicketAccess(viewer, ticketId);
  const ticket = await getTicketBootstrap(ticketId);
  const { messages, meta } = await getThreadMessages(ticketId, 1, DEFAULT_MESSAGE_PAGE_LIMIT);
  ticket.unread_count = await getUnreadCountForSingleTicket(viewer, ticketId);

  return {
    ticket,
    messages,
    messages_meta: meta,
  };
}

async function adminGetTicketMessages(viewer, ticketId, filters) {
  await assertAdminTicketAccess(viewer, ticketId);
  return getThreadMessages(ticketId, filters.page, filters.limit);
}

async function adminReplyToTicket(viewer, ticketId, data, io, kafkaProducer) {
  const ticket = await assertAdminTicketAccess(viewer, ticketId);
  assertTicketReplyAllowed(ticket);

  const now = new Date();
  const result = await sequelize.transaction(async (transaction) => {
    const reply = await TicketReply.create(
      {
        id: generateUUID(),
        ticket_id: ticket.id,
        user_id: viewer.user_id,
        reply_type: 'admin',
        message_kind: REPLY_MESSAGE_KIND,
        body: data.body,
        attachments: data.attachments || null,
      },
      { transaction }
    );

    const updateData = {
      last_message_at: reply.created_at || now,
      last_message_preview: buildMessagePreview(data.body),
    };

    if (['open', 'in_progress'].includes(ticket.status)) {
      updateData.status = 'waiting_on_user';
      updateData.closed_at = null;
    }

    if (!ticket.assigned_to) {
      updateData.assigned_to = viewer.user_id;
      updateData.assigned_at = now;
    }

    await ticket.update(updateData, { transaction });

    await upsertReadState(
      ticket.id,
      viewer.actor_id,
      viewer.actor_type,
      reply.id,
      reply.created_at,
      transaction
    );

    return reply;
  });

  const ticketAfter = await getTicketBootstrap(ticket.id);
  const replyRow = (
    await sequelize.query(
      `SELECT
         reply.*,
         sender.id AS sender_id,
         sender.email AS sender_email,
         sender.first_name AS sender_first_name,
         sender.last_name AS sender_last_name,
         sender.phone AS sender_phone,
         sender.avatar_url AS sender_avatar_url,
         sender.role AS sender_role,
         sender.status AS sender_status
       FROM support_ticket_replies AS reply
       LEFT JOIN auth_users AS sender
         ON sender.id = reply.user_id
        AND sender.deleted_at IS NULL
       WHERE reply.id = :replyId
       LIMIT 1`,
      {
        replacements: { replyId: result.id },
        type: QueryTypes.SELECT,
      }
    )
  )[0];
  const serializedReply = serializeMessage(replyRow);

  await Promise.all([
    emitTicketLifecycle(io, 'support:message.created', ticket, {
      ticket: ticketAfter,
      message: serializedReply,
    }),
    emitUnreadBadgeUpdates(io, ticket),
  ]);

  runDetachedSideEffect(
    'support admin reply notification',
    sendNotification(kafkaProducer, ticket.user_id, {
      type: 'in_app',
      title: 'Support replied',
      body: `A new reply was added to ticket #${ticket.ticket_number}.`,
      data: { ticketId: ticket.id, ticketNumber: ticket.ticket_number, action: 'support_admin_reply' },
      channel: 'support',
    })
  );
  runDetachedSideEffect(
    'support admin reply event',
    publishSupportEvent(kafkaProducer, TOPICS.SUPPORT_MESSAGE_CREATED, ticket.id, {
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      organizationId: ticket.organization_id,
      userId: viewer.user_id,
      messageId: result.id,
      replyType: 'admin',
      timestamp: now.toISOString(),
    })
  );

  return {
    reply: serializedReply,
    ticket: ticketAfter,
  };
}

async function assignTicket(viewer, ticketId, adminUserId, io, kafkaProducer) {
  const ticket = await assertAdminTicketAccess(viewer, ticketId);

  if (ticket.status === 'closed') {
    throw AppError.badRequest('Cannot assign a closed ticket.');
  }

  await assertAssignableSubAdminUserId(adminUserId);

  const now = new Date();
  await ticket.update({
    assigned_to: adminUserId,
    assigned_at: now,
    status: ticket.status === 'open' ? 'in_progress' : ticket.status,
  });

  const ticketAfter = await getTicketBootstrap(ticket.id);

  await Promise.all([
    emitTicketLifecycle(io, 'support:assignment.updated', ticket, {
      ticket: ticketAfter,
      assigned_to: adminUserId,
    }),
    emitUnreadBadgeUpdates(io, ticket),
  ]);

  runDetachedSideEffect(
    'support ticket assigned notification',
    sendNotification(kafkaProducer, adminUserId, {
      type: 'in_app',
      title: 'Support ticket assigned',
      body: `Ticket #${ticket.ticket_number} has been assigned to you.`,
      data: { ticketId: ticket.id, ticketNumber: ticket.ticket_number, action: 'support_assigned' },
      channel: 'support',
    })
  );
  runDetachedSideEffect(
    'support ticket assigned event',
    publishSupportEvent(kafkaProducer, TOPICS.SUPPORT_TICKET_ASSIGNED, ticket.id, {
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      organizationId: ticket.organization_id,
      assignedTo: adminUserId,
      actorId: viewer.user_id,
      actorType: ADMIN_ACTOR_TYPE,
      timestamp: now.toISOString(),
    })
  );

  return ticketAfter;
}

async function updateTicketStatus(viewer, ticketId, status, io, kafkaProducer) {
  const ticket = await assertAdminTicketAccess(viewer, ticketId);
  const now = new Date();
  const updateData = { status };
  const isReopen = isTerminalTicketStatus(ticket.status) && !isTerminalTicketStatus(status);

  if (status === 'resolved') {
    updateData.resolved_at = now;
    updateData.closed_at = null;
  } else if (status === 'closed') {
    updateData.closed_at = now;
  } else {
    updateData.resolved_at = null;
    updateData.closed_at = null;
  }

  if (isReopen) {
    updateData.satisfaction_rating = null;
    updateData.satisfaction_feedback = null;
  }

  await ticket.update(updateData);
  const ticketAfter = await getTicketBootstrap(ticket.id);

  await Promise.all([
    emitTicketLifecycle(io, 'support:status.updated', ticket, {
      ticket: ticketAfter,
      status,
    }),
    emitUnreadBadgeUpdates(io, ticket),
  ]);

  runDetachedSideEffect(
    'support admin status event',
    publishSupportEvent(kafkaProducer, TOPICS.SUPPORT_TICKET_STATUS_UPDATED, ticket.id, {
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      organizationId: ticket.organization_id,
      status,
      actorId: viewer.user_id,
      actorType: ADMIN_ACTOR_TYPE,
      timestamp: now.toISOString(),
    })
  );

  return ticketAfter;
}

async function deleteTicket(viewer, ticketId, io, kafkaProducer) {
  const ticket = await assertAdminTicketAccess(viewer, ticketId);
  const now = new Date();

  await ticket.update({
    deleted_at: now,
    deleted_by: viewer.user_id,
  });

  await Promise.all([
    emitTicketLifecycle(io, 'support:ticket.updated', ticket, {
      ticket_id: ticket.id,
      reason: 'deleted',
    }),
    emitUnreadBadgeUpdates(io, ticket),
  ]);

  runDetachedSideEffect(
    'support ticket deleted event',
    publishSupportEvent(kafkaProducer, TOPICS.SUPPORT_TICKET_DELETED, ticket.id, {
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      organizationId: ticket.organization_id,
      deletedBy: viewer.user_id,
      actorType: ADMIN_ACTOR_TYPE,
      timestamp: now.toISOString(),
    })
  );

  return { id: ticket.id };
}

async function getTicketsByUser(viewer, userId, filters) {
  return adminListTickets(viewer, {
    ...filters,
    user_id: userId,
  });
}

async function getAdminUnreadCount(viewer) {
  return getUnreadCountForViewer(viewer);
}

async function assertSocketTicketAccess(socketActor, ticketId, organizationId = null) {
  if (socketActor.mode === USER_ACTOR_TYPE) {
    if (!organizationId) {
      throw AppError.forbidden('Select an organization before opening support.', 'ORG_CONTEXT_REQUIRED');
    }

    const viewer = buildUserViewer(socketActor.actor.user.id, organizationId);
    const ticket = await assertUserTicketAccess(viewer, ticketId);
    return { viewer, ticket };
  }

  const viewer = buildAdminViewer(socketActor.actor);
  const ticket = await assertAdminTicketAccess(viewer, ticketId);
  return { viewer, ticket };
}

module.exports = {
  USER_ROOM_PREFIX,
  ADMIN_ROOM_PREFIX,
  TICKET_ROOM_PREFIX,
  buildUserRoom,
  buildAdminRoom,
  buildTicketRoom,
  buildUserViewer,
  buildAdminViewer,
  resolveRealtimeActor,
  assertSocketTicketAccess,
  createTicket,
  listUserTickets,
  getUserTicket,
  getUserTicketMessages,
  markTicketRead,
  replyToTicket,
  closeTicket,
  rateTicket,
  getUserUnreadCount,
  adminListTickets,
  adminGetTicket,
  adminGetTicketMessages,
  adminReplyToTicket,
  assignTicket,
  updateTicketStatus,
  deleteTicket,
  getAssignableAdmins,
  getTicketsByUser,
  getAdminUnreadCount,
  getSupportAdminViewerByUserId,
};
