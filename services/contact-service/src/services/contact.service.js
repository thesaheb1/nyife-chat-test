'use strict';

const csvParser = require('csv-parser');
const { Op } = require('sequelize');
const axios = require('axios');
const { Contact, Tag, ContactTag, Group, GroupMember, sequelize } = require('../models');
const { AppError, generateUUID, getPagination, getPaginationMeta } = require('@nyife/shared-utils');
const config = require('../config');

// E.164 phone regex for CSV validation
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

function isSubscriptionServiceUnavailable(err) {
  return [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ECONNRESET',
    'ETIMEDOUT',
    'EHOSTUNREACH',
  ].includes(err.code);
}

// ─── Subscription Limit Helpers ──────────────────────────────────────────────

async function checkSubscriptionLimit(userId, resource) {
  try {
    const response = await axios.get(
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/check-limit/${userId}/${resource}`,
      { timeout: 5000 }
    );
    return response.data.data; // { allowed, used, limit, remaining }
  } catch (err) {
    // If subscription service is unreachable, deny by default for safety
    if (isSubscriptionServiceUnavailable(err)) {
      throw AppError.internal('Subscription service is unavailable. Please try again later.');
    }
    if (err.response && err.response.status === 404) {
      return { allowed: false, used: 0, limit: 0, remaining: 0, message: 'No active subscription' };
    }
    throw err;
  }
}

async function incrementSubscriptionUsage(userId, resource, count = 1) {
  if (!count) {
    return;
  }

  try {
    await axios.post(
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/increment-usage/${userId}`,
      { resource, count },
      { timeout: 5000 }
    );
  } catch (err) {
    // Log but do not block if increment fails — usage is eventually consistent
    console.error(`[contact-service] Failed to increment subscription usage for user ${userId}:`, err.message);
  }
}

async function getActiveContactCount(userId) {
  return Contact.count({
    where: { user_id: userId },
  });
}

async function getContactCapacityState(userId) {
  const limitCheck = await checkSubscriptionLimit(userId, 'contacts');

  if (!limitCheck.allowed && limitCheck.limit === 0) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      isUnlimited: false,
      message: limitCheck.message || 'No active subscription',
    };
  }

  const activeContacts = await getActiveContactCount(userId);
  const isUnlimited = limitCheck.limit === 'unlimited';

  if (typeof limitCheck.used === 'number' && limitCheck.used !== activeContacts) {
    await incrementSubscriptionUsage(userId, 'contacts', activeContacts - limitCheck.used);
  }

  if (isUnlimited) {
    return {
      allowed: true,
      used: activeContacts,
      limit: 'unlimited',
      remaining: Infinity,
      isUnlimited: true,
    };
  }

  const limit = Number(limitCheck.limit || 0);

  return {
    allowed: activeContacts < limit,
    used: activeContacts,
    limit,
    remaining: Math.max(0, limit - activeContacts),
    isUnlimited: false,
  };
}

async function ensureContactCapacity(userId, additionalContacts = 1) {
  const state = await getContactCapacityState(userId);

  if (state.isUnlimited) {
    return state;
  }

  return {
    ...state,
    allowed: state.used + additionalContacts <= state.limit,
    remaining: Math.max(0, state.limit - state.used),
  };
}

async function syncContactUsage(userId) {
  return getContactCapacityState(userId);
}

const CONTACT_SAMPLE_CSV = [
  'phone,name,email,company,notes,tags,groups',
  '+919876543210,John Doe,john@example.com,Acme Corp,Important prospect,"VIP,Newsletter","March Leads,North Region"',
  '+14155552671,Jane Smith,jane@example.com,Design Studio,Prefers evening calls,"Warm Lead","Design Pipeline"',
].join('\n');

const GROUP_SAMPLE_CSV = [
  'group_name,group_description,contact_phone,contact_name,contact_email,contact_company,contact_notes',
  'March Leads,Imported from CSV,+919876543210,John Doe,john@example.com,Acme Corp,Interested in demo',
  'March Leads,Imported from CSV,+14155552671,Jane Smith,jane@example.com,Design Studio,Requested brochure',
  'VIP Customers,Priority outreach,+447700900123,Michael Lee,michael@example.com,Northwind,Repeat buyer',
].join('\n');

function normalizePhone(rawPhone) {
  let phone = String(rawPhone || '').trim();

  if (!phone.startsWith('+') && /^[1-9]\d{6,14}$/.test(phone)) {
    phone = `+${phone}`;
  }

  return phone;
}

function splitCsvList(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(/[|,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function parseCsvRows(fileStream) {
  const rows = [];

  await new Promise((resolve, reject) => {
    const stream = fileStream.pipe(csvParser({
      mapHeaders: ({ header }) => header.trim().toLowerCase(),
    }));

    stream.on('data', (row) => {
      rows.push(row);
    });

    stream.on('end', resolve);
    stream.on('error', (err) => reject(AppError.badRequest(`CSV parsing error: ${err.message}`)));
  });

  if (rows.length === 0) {
    throw AppError.badRequest('CSV file is empty or has no valid rows');
  }

  return rows;
}

async function ensureContactsOwnedByUser(userId, contactIds) {
  const contacts = await Contact.findAll({
    where: { id: { [Op.in]: contactIds }, user_id: userId },
    attributes: ['id'],
  });

  const validContactIds = contacts.map((contact) => contact.id);
  const invalidContactIds = contactIds.filter((id) => !validContactIds.includes(id));

  if (invalidContactIds.length > 0) {
    throw AppError.badRequest(`Contacts not found: ${invalidContactIds.join(', ')}`);
  }

  return validContactIds;
}

async function ensureGroupsOwnedByUser(userId, groupIds) {
  const groups = await Group.findAll({
    where: { id: { [Op.in]: groupIds }, user_id: userId },
    attributes: ['id'],
  });

  const validGroupIds = groups.map((group) => group.id);
  const invalidGroupIds = groupIds.filter((id) => !validGroupIds.includes(id));

  if (invalidGroupIds.length > 0) {
    throw AppError.badRequest(`Groups not found: ${invalidGroupIds.join(', ')}`);
  }

  return validGroupIds;
}

async function ensureTagsOwnedByUser(userId, tagIds) {
  const tags = await Tag.findAll({
    where: { id: { [Op.in]: tagIds }, user_id: userId },
    attributes: ['id'],
  });

  const validTagIds = tags.map((tag) => tag.id);
  const invalidTagIds = tagIds.filter((id) => !validTagIds.includes(id));

  if (invalidTagIds.length > 0) {
    throw AppError.badRequest(`Tags not found: ${invalidTagIds.join(', ')}`);
  }

  return validTagIds;
}

async function getOrCreateTagsByName(userId, tagNames, tagCache = new Map()) {
  const uniqueNames = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];
  const tagIds = [];

  for (const name of uniqueNames) {
    const cacheKey = name.toLowerCase();
    if (tagCache.has(cacheKey)) {
      tagIds.push(tagCache.get(cacheKey));
      continue;
    }

    let tag = await Tag.findOne({
      where: {
        user_id: userId,
        [Op.and]: [
          sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), cacheKey),
        ],
      },
      order: [['created_at', 'ASC']],
    });

    if (!tag) {
      tag = await Tag.create({
        id: generateUUID(),
        user_id: userId,
        name,
        color: '#3B82F6',
      });
    }

    tagCache.set(cacheKey, tag.id);
    tagIds.push(tag.id);
  }

  return tagIds;
}

async function getOrCreateGroupsByName(userId, groupsInput, groupCache = new Map()) {
  const groupIds = [];

  for (const groupEntry of groupsInput) {
    const name = groupEntry.name.trim();
    const cacheKey = name.toLowerCase();

    if (groupCache.has(cacheKey)) {
      groupIds.push(groupCache.get(cacheKey));
      continue;
    }

    let group = await Group.findOne({
      where: { user_id: userId, name },
      paranoid: false,
    });

    if (group) {
      if (group.deleted_at) {
        await group.restore();
        await group.update({
          description: groupEntry.description || group.description,
          type: 'static',
        });
      } else if (groupEntry.description && !group.description) {
        await group.update({ description: groupEntry.description });
      }
    } else {
      group = await Group.create({
        id: generateUUID(),
        user_id: userId,
        name,
        description: groupEntry.description || null,
        type: 'static',
        dynamic_filters: null,
        contact_count: 0,
      });
    }

    groupCache.set(cacheKey, group.id);
    groupIds.push(group.id);
  }

  return groupIds;
}

async function upsertImportedContact(userId, row, remainingState, tagCache, groupCache) {
  const phone = row.phone;
  const existing = await Contact.findOne({
    where: { user_id: userId, phone },
    paranoid: false,
  });

  let createdCount = 0;
  let restoredCount = 0;
  let updatedCount = 0;
  let contactId;

  if (existing) {
    if (existing.deleted_at) {
      if (!remainingState.isUnlimited && remainingState.createdCount >= remainingState.remaining) {
        throw AppError.forbidden('Subscription contact limit reached during import');
      }

      await existing.restore();
      await existing.update({
        name: row.name || existing.name,
        email: row.email || existing.email,
        company: row.company || existing.company,
        notes: row.notes || existing.notes,
        source: row.source,
        opted_in: true,
        opted_in_at: existing.opted_in_at || new Date(),
      });
      restoredCount = 1;
      remainingState.createdCount += 1;
      contactId = existing.id;
    } else {
      const updateFields = {};
      if (row.name && row.name !== existing.name) updateFields.name = row.name;
      if (row.email && row.email !== existing.email) updateFields.email = row.email;
      if (row.company && row.company !== existing.company) updateFields.company = row.company;
      if (row.notes && row.notes !== existing.notes) updateFields.notes = row.notes;
      if (Object.keys(updateFields).length > 0) {
        updateFields.source = row.source;
        await existing.update(updateFields);
      }
      updatedCount = 1;
      contactId = existing.id;
    }
  } else {
    if (!remainingState.isUnlimited && remainingState.createdCount >= remainingState.remaining) {
      throw AppError.forbidden('Subscription contact limit reached during import');
    }

    const contact = await Contact.create({
      id: generateUUID(),
      user_id: userId,
      phone,
      name: row.name,
      email: row.email,
      company: row.company,
      notes: row.notes,
      source: row.source,
      opted_in: true,
      opted_in_at: new Date(),
    });
    createdCount = 1;
    remainingState.createdCount += 1;
    contactId = contact.id;
  }

  if (row.tag_names?.length) {
    const tagIds = await getOrCreateTagsByName(userId, row.tag_names, tagCache);
    await assignTagsToContact(userId, contactId, tagIds);
  }

  if (row.group_names?.length) {
    const groupIds = await getOrCreateGroupsByName(
      userId,
      row.group_names.map((name) => ({ name, description: null })),
      groupCache
    );
    await bulkAssignContactsToGroups(userId, groupIds, [contactId]);
  }

  return {
    contactId,
    createdCount,
    restoredCount,
    updatedCount,
  };
}

// ─── Contacts ────────────────────────────────────────────────────────────────

async function createContact(userId, data) {
  // Check subscription limit for contacts
  const limitCheck = await ensureContactCapacity(userId, 1);
  if (!limitCheck.allowed) {
    throw AppError.forbidden('Contact limit reached for your subscription plan. Please upgrade to add more contacts.');
  }

  // Check unique constraint: user_id + phone
  const existing = await Contact.findOne({
    where: { user_id: userId, phone: data.phone },
    paranoid: false,
  });

  if (existing) {
    if (existing.deleted_at) {
      // Restore soft-deleted contact and update
      await existing.restore();
      await existing.update({
        name: data.name || existing.name,
        email: data.email || existing.email,
        company: data.company || existing.company,
        notes: data.notes || existing.notes,
        custom_fields: data.custom_fields || existing.custom_fields,
        source: 'manual',
      });

      // Handle tags if provided
      if (data.tag_ids && data.tag_ids.length > 0) {
        await assignTagsToContact(userId, existing.id, data.tag_ids);
      }

      // Increment usage
      await incrementSubscriptionUsage(userId, 'contacts', 1);

      return getContact(userId, existing.id);
    }
    throw AppError.conflict('A contact with this phone number already exists');
  }

  // Create the contact
  const contact = await Contact.create({
    id: generateUUID(),
    user_id: userId,
    phone: data.phone,
    name: data.name || null,
    email: data.email || null,
    company: data.company || null,
    notes: data.notes || null,
    custom_fields: data.custom_fields || null,
    source: 'manual',
    opted_in: true,
    opted_in_at: new Date(),
  });

  // Handle tags if provided
  if (data.tag_ids && data.tag_ids.length > 0) {
    await assignTagsToContact(userId, contact.id, data.tag_ids);
  }

  // Increment subscription usage
  await incrementSubscriptionUsage(userId, 'contacts', 1);

  return getContact(userId, contact.id);
}

async function listContacts(userId, filters) {
  const { page, limit, search, ids, tag_id, tag_ids, group_id, opted_in, source, date_from, date_to } = filters;
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);

  const where = { user_id: userId };
  const parsedIds = ids
    ? ids.split(',').map((id) => id.trim()).filter(Boolean)
    : [];
  const parsedTagIds = tag_ids
    ? tag_ids.split(',').map((id) => id.trim()).filter(Boolean)
    : [];

  if (parsedIds.length > 0) {
    where.id = { [Op.in]: parsedIds };
  }

  // Search by phone, name, or email
  if (search) {
    where[Op.or] = [
      { phone: { [Op.like]: `%${search}%` } },
      { name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ];
  }

  // Filter by opted_in status
  if (opted_in !== undefined) {
    where.opted_in = opted_in;
  }

  // Filter by source
  if (source) {
    where.source = source;
  }

  // Filter by date range
  if (date_from) {
    where.created_at = { ...(where.created_at || {}), [Op.gte]: date_from };
  }
  if (date_to) {
    where.created_at = { ...(where.created_at || {}), [Op.lte]: date_to };
  }

  const includeOptions = [
    {
      model: Tag,
      as: 'tags',
      attributes: ['id', 'name', 'color'],
      through: { attributes: [] },
    },
    {
      model: Group,
      as: 'groups',
      attributes: ['id', 'name', 'type'],
      through: { attributes: [] },
      required: false,
    },
  ];

  // Filter by tag: join through contact_tags
  if (tag_id || parsedTagIds.length > 0) {
    includeOptions[0].where = tag_id
      ? { id: tag_id }
      : { id: { [Op.in]: parsedTagIds } };
    includeOptions[0].required = true;
  }

  // Filter by group: join through group_members
  if (group_id) {
    includeOptions[1].where = { id: group_id };
    includeOptions[1].required = true;
  }

  const { count, rows } = await Contact.findAndCountAll({
    where,
    include: includeOptions,
    order: [['created_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
    distinct: true, // Needed for accurate count with joins
  });

  return {
    contacts: rows,
    meta: getPaginationMeta(count, page, limit),
  };
}

async function getContact(userId, contactId) {
  const contact = await Contact.findOne({
    where: { id: contactId, user_id: userId },
    include: [
      {
        model: Tag,
        as: 'tags',
        attributes: ['id', 'name', 'color'],
        through: { attributes: [] },
      },
      {
        model: Group,
        as: 'groups',
        attributes: ['id', 'name', 'type'],
        through: { attributes: [] },
      },
    ],
  });

  if (!contact) {
    throw AppError.notFound('Contact not found');
  }

  return contact;
}

async function updateContact(userId, contactId, data) {
  const contact = await Contact.findOne({
    where: { id: contactId, user_id: userId },
  });

  if (!contact) {
    throw AppError.notFound('Contact not found');
  }

  // If phone is being changed, check for uniqueness
  if (data.phone && data.phone !== contact.phone) {
    const existingWithPhone = await Contact.findOne({
      where: { user_id: userId, phone: data.phone, id: { [Op.ne]: contactId } },
    });
    if (existingWithPhone) {
      throw AppError.conflict('A contact with this phone number already exists');
    }
  }

  // Build update object with only provided fields
  const updateFields = {};
  const allowedFields = ['phone', 'name', 'email', 'company', 'notes', 'custom_fields', 'whatsapp_name', 'opted_in'];
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateFields[field] = data[field];
    }
  }

  // Track opted_in change
  if (data.opted_in !== undefined && data.opted_in !== contact.opted_in) {
    if (data.opted_in) {
      updateFields.opted_in_at = new Date();
    }
  }

  await contact.update(updateFields);

  return getContact(userId, contactId);
}

async function deleteContact(userId, contactId) {
  const contact = await Contact.findOne({
    where: { id: contactId, user_id: userId },
  });

  if (!contact) {
    throw AppError.notFound('Contact not found');
  }

  // Get affected groups BEFORE deleting junction records
  const affectedGroupMembers = await GroupMember.findAll({
    where: { contact_id: contactId },
    attributes: ['group_id'],
    raw: true,
  });

  // Remove junction records before soft deleting
  await ContactTag.destroy({ where: { contact_id: contactId } });
  await GroupMember.destroy({ where: { contact_id: contactId } });

  // Soft delete the contact
  await contact.destroy();

  // Recalculate contact_count for affected groups
  if (affectedGroupMembers.length > 0) {
    const groupIds = [...new Set(affectedGroupMembers.map((gm) => gm.group_id))];
    await recalculateGroupCounts(groupIds);
  }

  await syncContactUsage(userId);

  return { id: contactId };
}

async function bulkDeleteContacts(userId, ids) {
  // Verify all contacts belong to this user
  const contacts = await Contact.findAll({
    where: { id: { [Op.in]: ids }, user_id: userId },
    attributes: ['id'],
  });

  const foundIds = contacts.map((c) => c.id);
  const missingIds = ids.filter((id) => !foundIds.includes(id));

  if (foundIds.length === 0) {
    throw AppError.notFound('No matching contacts found');
  }

  // Get affected groups before deletion
  const affectedGroupMembers = await GroupMember.findAll({
    where: { contact_id: { [Op.in]: foundIds } },
    attributes: ['group_id'],
    raw: true,
  });

  // Remove junction records
  await ContactTag.destroy({ where: { contact_id: { [Op.in]: foundIds } } });
  await GroupMember.destroy({ where: { contact_id: { [Op.in]: foundIds } } });

  // Soft delete contacts
  await Contact.destroy({ where: { id: { [Op.in]: foundIds }, user_id: userId } });

  // Recalculate group counts
  if (affectedGroupMembers.length > 0) {
    const groupIds = [...new Set(affectedGroupMembers.map((gm) => gm.group_id))];
    await recalculateGroupCounts(groupIds);
  }

  await syncContactUsage(userId);

  return {
    deleted_count: foundIds.length,
    skipped_count: missingIds.length,
    skipped_ids: missingIds,
  };
}

// ─── CSV Import ──────────────────────────────────────────────────────────────

async function importCsv(userId, fileStream) {
  const limitCheck = await getContactCapacityState(userId);
  if (!limitCheck.isUnlimited && limitCheck.remaining <= 0) {
    throw AppError.forbidden('Contact limit reached for your subscription plan. Please upgrade to import contacts.');
  }

  const results = {
    total: 0,
    created: 0,
    restored: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };
  const rows = await parseCsvRows(fileStream);
  results.total = rows.length;

  const validRows = [];
  const seenPhones = new Set();
  const tagCache = new Map();
  const groupCache = new Map();
  const remainingState = {
    remaining: limitCheck.isUnlimited ? Infinity : limitCheck.remaining,
    isUnlimited: limitCheck.isUnlimited,
    createdCount: 0,
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const phone = normalizePhone(row.phone || row.phone_number || row.mobile || row.number || row.whatsapp);

    if (!E164_REGEX.test(phone)) {
      results.errors.push({
        row: rowNumber,
        phone: phone || '(empty)',
        reason: 'Invalid phone number format. Must be E.164 (e.g., +919876543210)',
      });
      results.skipped++;
      continue;
    }

    if (seenPhones.has(phone)) {
      results.errors.push({
        row: rowNumber,
        phone,
        reason: 'Duplicate phone number within CSV file',
      });
      results.skipped++;
      continue;
    }

    seenPhones.add(phone);

    validRows.push({
      phone,
      name: String(row.name || row.full_name || row.contact_name || '').trim() || null,
      email: String(row.email || row.email_address || '').trim() || null,
      company: String(row.company || row.organization || row.org || '').trim() || null,
      notes: String(row.notes || row.note || row.comment || '').trim() || null,
      tag_names: splitCsvList(row.tags || row.tag_names || row.labels),
      group_names: splitCsvList(row.groups || row.group_names || row.segments),
      source: 'csv_import',
    });
  }

  for (const row of validRows) {
    try {
      const outcome = await upsertImportedContact(userId, row, remainingState, tagCache, groupCache);
      results.created += outcome.createdCount;
      results.restored += outcome.restoredCount;
      results.updated += outcome.updatedCount;
    } catch (err) {
      results.errors.push({
        row: null,
        phone: row.phone,
        reason: err.message,
      });
      results.skipped++;
    }
  }

  if (remainingState.createdCount > 0) {
    await incrementSubscriptionUsage(userId, 'contacts', remainingState.createdCount);
  }

  return results;
}

// ─── Tags ────────────────────────────────────────────────────────────────────

async function createTag(userId, data) {
  // Check uniqueness of tag name for this user
  const existing = await Tag.findOne({
    where: { user_id: userId, name: data.name },
  });

  if (existing) {
    throw AppError.conflict('A tag with this name already exists');
  }

  const tag = await Tag.create({
    id: generateUUID(),
    user_id: userId,
    name: data.name,
    color: data.color || '#3B82F6',
  });

  return tag;
}

async function listTags(userId) {
  const tags = await Tag.findAll({
    where: { user_id: userId },
    order: [['name', 'ASC']],
    attributes: {
      include: [
        [
          sequelize.literal(
            '(SELECT COUNT(*) FROM contact_contact_tags WHERE contact_contact_tags.tag_id = Tag.id)'
          ),
          'contact_count',
        ],
      ],
    },
  });

  return tags;
}

async function updateTag(userId, tagId, data) {
  const tag = await Tag.findOne({
    where: { id: tagId, user_id: userId },
  });

  if (!tag) {
    throw AppError.notFound('Tag not found');
  }

  // If name is being changed, check uniqueness
  if (data.name && data.name !== tag.name) {
    const existing = await Tag.findOne({
      where: { user_id: userId, name: data.name, id: { [Op.ne]: tagId } },
    });
    if (existing) {
      throw AppError.conflict('A tag with this name already exists');
    }
  }

  const updateFields = {};
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.color !== undefined) updateFields.color = data.color;

  await tag.update(updateFields);

  return tag;
}

async function deleteTag(userId, tagId) {
  const tag = await Tag.findOne({
    where: { id: tagId, user_id: userId },
  });

  if (!tag) {
    throw AppError.notFound('Tag not found');
  }

  // Remove all contact-tag junction records for this tag
  await ContactTag.destroy({ where: { tag_id: tagId } });

  // Delete the tag (hard delete since tags don't have paranoid)
  await tag.destroy();

  return { id: tagId };
}

async function addTagsToContact(userId, contactId, tagIds) {
  // Verify contact exists and belongs to user
  const contact = await Contact.findOne({
    where: { id: contactId, user_id: userId },
  });

  if (!contact) {
    throw AppError.notFound('Contact not found');
  }

  // Verify all tags belong to the user
  const tags = await Tag.findAll({
    where: { id: { [Op.in]: tagIds }, user_id: userId },
    attributes: ['id'],
  });

  const validTagIds = tags.map((t) => t.id);
  const invalidTagIds = tagIds.filter((id) => !validTagIds.includes(id));

  if (invalidTagIds.length > 0) {
    throw AppError.badRequest(`Tags not found: ${invalidTagIds.join(', ')}`);
  }

  // Use bulkCreate with ignoreDuplicates to handle existing associations
  const records = validTagIds.map((tagId) => ({
    contact_id: contactId,
    tag_id: tagId,
  }));

  await ContactTag.bulkCreate(records, { ignoreDuplicates: true });

  return getContact(userId, contactId);
}

async function addTagByPhone(userId, phone, tagId) {
  let contact = await Contact.findOne({
    where: { user_id: userId, phone },
    paranoid: false,
  });

  if (!contact) {
    const limitCheck = await ensureContactCapacity(userId, 1);
    if (!limitCheck.allowed) {
      throw AppError.forbidden(
        'Contact limit reached for your subscription plan. Please upgrade to add more contacts.'
      );
    }

    contact = await Contact.create({
      id: generateUUID(),
      user_id: userId,
      phone,
      source: 'whatsapp_incoming',
      opted_in: true,
      opted_in_at: new Date(),
    });

    await incrementSubscriptionUsage(userId, 'contacts', 1);
  } else if (contact.deleted_at) {
    const limitCheck = await ensureContactCapacity(userId, 1);
    if (!limitCheck.allowed) {
      throw AppError.forbidden(
        'Contact limit reached for your subscription plan. Please upgrade to add more contacts.'
      );
    }

    await contact.restore();
    await contact.update({
      source: contact.source || 'whatsapp_incoming',
      opted_in: true,
      opted_in_at: contact.opted_in_at || new Date(),
    });
    await incrementSubscriptionUsage(userId, 'contacts', 1);
  }

  return addTagsToContact(userId, contact.id, [tagId]);
}

async function removeTagFromContact(userId, contactId, tagId) {
  // Verify contact exists and belongs to user
  const contact = await Contact.findOne({
    where: { id: contactId, user_id: userId },
  });

  if (!contact) {
    throw AppError.notFound('Contact not found');
  }

  const deleted = await ContactTag.destroy({
    where: { contact_id: contactId, tag_id: tagId },
  });

  if (deleted === 0) {
    throw AppError.notFound('Tag is not assigned to this contact');
  }

  return getContact(userId, contactId);
}

// ─── Groups ──────────────────────────────────────────────────────────────────

async function bulkAssignTagsToContacts(userId, contactIds, tagIds) {
  const validContactIds = await ensureContactsOwnedByUser(userId, contactIds);
  const validTagIds = await ensureTagsOwnedByUser(userId, tagIds);

  const existingAssignments = await ContactTag.findAll({
    where: {
      contact_id: { [Op.in]: validContactIds },
      tag_id: { [Op.in]: validTagIds },
    },
    raw: true,
  });

  const existingKeys = new Set(existingAssignments.map((item) => `${item.contact_id}:${item.tag_id}`));
  const records = [];

  for (const contactId of validContactIds) {
    for (const tagId of validTagIds) {
      const key = `${contactId}:${tagId}`;
      if (!existingKeys.has(key)) {
        records.push({ contact_id: contactId, tag_id: tagId });
      }
    }
  }

  if (records.length > 0) {
    await ContactTag.bulkCreate(records, { ignoreDuplicates: true });
  }

  return {
    contact_count: validContactIds.length,
    tag_count: validTagIds.length,
    added_count: records.length,
  };
}

async function bulkRemoveTagsFromContacts(userId, contactIds, tagIds) {
  const validContactIds = await ensureContactsOwnedByUser(userId, contactIds);
  const validTagIds = await ensureTagsOwnedByUser(userId, tagIds);

  const removedCount = await ContactTag.destroy({
    where: {
      contact_id: { [Op.in]: validContactIds },
      tag_id: { [Op.in]: validTagIds },
    },
  });

  return {
    contact_count: validContactIds.length,
    tag_count: validTagIds.length,
    removed_count: removedCount,
  };
}

async function importGroupsCsv(userId, fileStream) {
  const limitCheck = await getContactCapacityState(userId);
  if (!limitCheck.isUnlimited && limitCheck.remaining <= 0) {
    throw AppError.forbidden('Contact limit reached for your subscription plan. Please upgrade to import groups.');
  }

  const rows = await parseCsvRows(fileStream);
  const results = {
    total: rows.length,
    groups_created: 0,
    contacts_created: 0,
    contacts_restored: 0,
    contacts_updated: 0,
    memberships_added: 0,
    skipped: 0,
    errors: [],
  };

  const groupCache = new Map();
  const tagCache = new Map();
  const createdGroupIds = new Set();
  const remainingState = {
    remaining: limitCheck.isUnlimited ? Infinity : limitCheck.remaining,
    isUnlimited: limitCheck.isUnlimited,
    createdCount: 0,
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const groupName = String(row.group_name || row.name || row.group || '').trim();
    const groupDescription = String(row.group_description || row.description || '').trim() || null;
    const phone = normalizePhone(row.contact_phone || row.phone || row.mobile || row.number);
    const groupCacheKey = groupName.toLowerCase();

    if (!groupName) {
      results.errors.push({
        row: rowNumber,
        phone: phone || '(empty)',
        reason: 'Group name is required',
      });
      results.skipped++;
      continue;
    }

    if (!E164_REGEX.test(phone)) {
      results.errors.push({
        row: rowNumber,
        phone: phone || '(empty)',
        reason: 'Contact phone must be in E.164 format',
      });
      results.skipped++;
      continue;
    }

    try {
      const groupExisted = groupCache.has(groupCacheKey)
        ? true
        : Boolean(await Group.findOne({
            where: { user_id: userId, name: groupName },
            paranoid: false,
            attributes: ['id'],
          }));

      const [groupId] = await getOrCreateGroupsByName(
        userId,
        [{ name: groupName, description: groupDescription }],
        groupCache
      );

      if (!createdGroupIds.has(groupId) && !groupExisted) {
        results.groups_created += 1;
        createdGroupIds.add(groupId);
      }

      const outcome = await upsertImportedContact(
        userId,
        {
          phone,
          name: String(row.contact_name || row.name || '').trim() || null,
          email: String(row.contact_email || row.email || '').trim() || null,
          company: String(row.contact_company || row.company || '').trim() || null,
          notes: String(row.contact_notes || row.notes || '').trim() || null,
          tag_names: splitCsvList(row.tags || row.tag_names || row.labels),
          group_names: [],
          source: 'csv_import',
        },
        remainingState,
        tagCache,
        groupCache
      );

      const assignmentResult = await bulkAssignContactsToGroups(userId, [groupId], [outcome.contactId]);

      results.contacts_created += outcome.createdCount;
      results.contacts_restored += outcome.restoredCount;
      results.contacts_updated += outcome.updatedCount;
      results.memberships_added += assignmentResult.added_count;
    } catch (err) {
      results.errors.push({
        row: rowNumber,
        phone,
        reason: err.message,
      });
      results.skipped++;
    }
  }

  if (remainingState.createdCount > 0) {
    await incrementSubscriptionUsage(userId, 'contacts', remainingState.createdCount);
  }

  return results;
}

function getContactCsvSample() {
  return CONTACT_SAMPLE_CSV;
}

function getGroupCsvSample() {
  return GROUP_SAMPLE_CSV;
}

async function createGroup(userId, data) {
  const existing = await Group.findOne({
    where: { user_id: userId, name: data.name },
    paranoid: false,
  });

  if (existing && !existing.deleted_at) {
    throw AppError.conflict('A group with this name already exists');
  }

  const contactIds = Array.isArray(data.contact_ids) ? data.contact_ids : [];
  const validContactIds = contactIds.length > 0
    ? await ensureContactsOwnedByUser(userId, contactIds)
    : [];

  let group;
  if (existing && existing.deleted_at) {
    await existing.restore();
    await existing.update({
      description: data.description || null,
      type: data.type || 'static',
      dynamic_filters: data.dynamic_filters || null,
      contact_count: 0,
    });
    group = existing;
  } else {
    group = await Group.create({
      id: generateUUID(),
      user_id: userId,
      name: data.name,
      description: data.description || null,
      type: data.type || 'static',
      dynamic_filters: data.dynamic_filters || null,
      contact_count: 0,
    });
  }

  if (validContactIds.length > 0) {
    await addGroupMembers(userId, group.id, validContactIds);
  }

  return Group.findByPk(group.id);
}

async function listGroups(userId, filters = {}) {
  const { page = 1, limit = 20, search } = filters;
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);
  const where = { user_id: userId };

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
    ];
  }

  const { count, rows } = await Group.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
  });

  return {
    groups: rows,
    meta: getPaginationMeta(count, page, limit),
  };
}

async function getGroup(userId, groupId, page = 1, limit = 20) {
  const group = await Group.findOne({
    where: { id: groupId, user_id: userId },
  });

  if (!group) {
    throw AppError.notFound('Group not found');
  }

  // Get paginated members
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);

  const { count, rows: members } = await Contact.findAndCountAll({
    include: [
      {
        model: Group,
        as: 'groups',
        attributes: [],
        through: { attributes: ['added_at'] },
        where: { id: groupId },
        required: true,
      },
      {
        model: Tag,
        as: 'tags',
        attributes: ['id', 'name', 'color'],
        through: { attributes: [] },
      },
    ],
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
    distinct: true,
  });

  return {
    group,
    members,
    meta: getPaginationMeta(count, page, limit),
  };
}

async function updateGroup(userId, groupId, data) {
  const group = await Group.findOne({
    where: { id: groupId, user_id: userId },
  });

  if (!group) {
    throw AppError.notFound('Group not found');
  }

  if (data.name && data.name !== group.name) {
    const existing = await Group.findOne({
      where: { user_id: userId, name: data.name, id: { [Op.ne]: groupId } },
    });

    if (existing) {
      throw AppError.conflict('A group with this name already exists');
    }
  }

  const updateFields = {};
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.description !== undefined) updateFields.description = data.description;
  if (data.dynamic_filters !== undefined) updateFields.dynamic_filters = data.dynamic_filters;

  await group.update(updateFields);

  return group;
}

async function deleteGroup(userId, groupId) {
  const group = await Group.findOne({
    where: { id: groupId, user_id: userId },
  });

  if (!group) {
    throw AppError.notFound('Group not found');
  }

  // Remove all group member junction records
  await GroupMember.destroy({ where: { group_id: groupId } });

  // Soft delete the group
  await group.destroy();

  return { id: groupId };
}

async function addGroupMembers(userId, groupId, contactIds) {
  // Verify group exists and belongs to user
  const group = await Group.findOne({
    where: { id: groupId, user_id: userId },
  });

  if (!group) {
    throw AppError.notFound('Group not found');
  }

  const validContactIds = await ensureContactsOwnedByUser(userId, contactIds);

  // Use bulkCreate with ignoreDuplicates to handle existing memberships
  const records = validContactIds.map((contactId) => ({
    contact_id: contactId,
    group_id: groupId,
    added_at: new Date(),
  }));

  await GroupMember.bulkCreate(records, { ignoreDuplicates: true });

  // Recalculate contact_count
  const memberCount = await GroupMember.count({ where: { group_id: groupId } });
  await group.update({ contact_count: memberCount });

  return {
    group_id: groupId,
    added_count: validContactIds.length,
    contact_count: memberCount,
  };
}

async function removeGroupMembers(userId, groupId, contactIds) {
  // Verify group exists and belongs to user
  const group = await Group.findOne({
    where: { id: groupId, user_id: userId },
  });

  if (!group) {
    throw AppError.notFound('Group not found');
  }

  const deletedCount = await GroupMember.destroy({
    where: {
      group_id: groupId,
      contact_id: { [Op.in]: contactIds },
    },
  });

  // Recalculate contact_count
  const memberCount = await GroupMember.count({ where: { group_id: groupId } });
  await group.update({ contact_count: memberCount });

  return {
    group_id: groupId,
    removed_count: deletedCount,
    contact_count: memberCount,
  };
}

async function bulkAssignContactsToGroups(userId, groupIds, contactIds) {
  const validGroupIds = await ensureGroupsOwnedByUser(userId, groupIds);
  const validContactIds = await ensureContactsOwnedByUser(userId, contactIds);

  const existingMemberships = await GroupMember.findAll({
    where: {
      group_id: { [Op.in]: validGroupIds },
      contact_id: { [Op.in]: validContactIds },
    },
    raw: true,
  });

  const existingKeys = new Set(existingMemberships.map((item) => `${item.group_id}:${item.contact_id}`));
  const records = [];

  for (const groupId of validGroupIds) {
    for (const contactId of validContactIds) {
      const key = `${groupId}:${contactId}`;
      if (!existingKeys.has(key)) {
        records.push({
          group_id: groupId,
          contact_id: contactId,
          added_at: new Date(),
        });
      }
    }
  }

  if (records.length > 0) {
    await GroupMember.bulkCreate(records, { ignoreDuplicates: true });
    await recalculateGroupCounts(validGroupIds);
  }

  return {
    group_count: validGroupIds.length,
    contact_count: validContactIds.length,
    added_count: records.length,
  };
}

async function bulkRemoveContactsFromGroups(userId, groupIds, contactIds) {
  const validGroupIds = await ensureGroupsOwnedByUser(userId, groupIds);
  const validContactIds = await ensureContactsOwnedByUser(userId, contactIds);

  const removedCount = await GroupMember.destroy({
    where: {
      group_id: { [Op.in]: validGroupIds },
      contact_id: { [Op.in]: validContactIds },
    },
  });

  if (removedCount > 0) {
    await recalculateGroupCounts(validGroupIds);
  }

  return {
    group_count: validGroupIds.length,
    contact_count: validContactIds.length,
    removed_count: removedCount,
  };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

async function assignTagsToContact(userId, contactId, tagIds) {
  // Verify all tags belong to the user
  const tags = await Tag.findAll({
    where: { id: { [Op.in]: tagIds }, user_id: userId },
    attributes: ['id'],
  });

  const validTagIds = tags.map((t) => t.id);

  if (validTagIds.length > 0) {
    const records = validTagIds.map((tagId) => ({
      contact_id: contactId,
      tag_id: tagId,
    }));

    await ContactTag.bulkCreate(records, { ignoreDuplicates: true });
  }
}

async function recalculateGroupCounts(groupIds) {
  for (const groupId of groupIds) {
    const memberCount = await GroupMember.count({ where: { group_id: groupId } });
    await Group.update({ contact_count: memberCount }, { where: { id: groupId } });
  }
}

module.exports = {
  createContact,
  listContacts,
  getContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
  importCsv,
  importGroupsCsv,
  getContactCsvSample,
  getGroupCsvSample,
  createTag,
  listTags,
  updateTag,
  deleteTag,
  addTagsToContact,
  addTagByPhone,
  removeTagFromContact,
  bulkAssignTagsToContacts,
  bulkRemoveTagsFromContacts,
  createGroup,
  listGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  addGroupMembers,
  removeGroupMembers,
  bulkAssignContactsToGroups,
  bulkRemoveContactsFromGroups,
};
