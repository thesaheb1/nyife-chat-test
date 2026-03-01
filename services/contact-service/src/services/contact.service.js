'use strict';

const csvParser = require('csv-parser');
const { Op } = require('sequelize');
const axios = require('axios');
const { Contact, Tag, ContactTag, Group, GroupMember, sequelize } = require('../models');
const { AppError, generateUUID, getPagination, getPaginationMeta } = require('@nyife/shared-utils');
const config = require('../config');

// E.164 phone regex for CSV validation
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

// ─── Subscription Limit Helpers ──────────────────────────────────────────────

async function checkSubscriptionLimit(userId, resource) {
  try {
    const response = await axios.get(
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/check-limit/${userId}/${resource}`
    );
    return response.data.data; // { allowed, used, limit, remaining }
  } catch (err) {
    // If subscription service is unreachable, deny by default for safety
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw AppError.internal('Subscription service is unavailable. Please try again later.');
    }
    if (err.response && err.response.status === 404) {
      return { allowed: false, used: 0, limit: 0, remaining: 0, message: 'No active subscription' };
    }
    throw err;
  }
}

async function incrementSubscriptionUsage(userId, resource, count = 1) {
  try {
    await axios.post(
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/increment-usage/${userId}`,
      { resource, count }
    );
  } catch (err) {
    // Log but do not block if increment fails — usage is eventually consistent
    console.error(`[contact-service] Failed to increment subscription usage for user ${userId}:`, err.message);
  }
}

// ─── Contacts ────────────────────────────────────────────────────────────────

async function createContact(userId, data) {
  // Check subscription limit for contacts
  const limitCheck = await checkSubscriptionLimit(userId, 'contacts');
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
  const { page, limit, search, tag_id, group_id, opted_in, source, date_from, date_to } = filters;
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);

  const where = { user_id: userId };

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
  ];

  // Filter by tag: join through contact_tags
  if (tag_id) {
    includeOptions[0].where = { id: tag_id };
    includeOptions[0].required = true;
  }

  // Filter by group: join through group_members
  if (group_id) {
    includeOptions.push({
      model: Group,
      as: 'groups',
      attributes: [],
      through: { attributes: [] },
      where: { id: group_id },
      required: true,
    });
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

  return {
    deleted_count: foundIds.length,
    skipped_count: missingIds.length,
    skipped_ids: missingIds,
  };
}

// ─── CSV Import ──────────────────────────────────────────────────────────────

async function importCsv(userId, fileStream) {
  // Check subscription limit before import
  const limitCheck = await checkSubscriptionLimit(userId, 'contacts');
  if (!limitCheck.allowed) {
    throw AppError.forbidden('Contact limit reached for your subscription plan. Please upgrade to import contacts.');
  }

  const results = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const rows = [];

  // Parse CSV using csv-parser
  await new Promise((resolve, reject) => {
    const stream = fileStream.pipe(csvParser({
      mapHeaders: ({ header }) => header.trim().toLowerCase(),
    }));

    stream.on('data', (row) => {
      rows.push(row);
    });

    stream.on('end', () => {
      resolve();
    });

    stream.on('error', (err) => {
      reject(AppError.badRequest(`CSV parsing error: ${err.message}`));
    });
  });

  if (rows.length === 0) {
    throw AppError.badRequest('CSV file is empty or has no valid rows');
  }

  results.total = rows.length;

  // Check remaining subscription capacity
  const remainingAllowance = limitCheck.limit === 'unlimited'
    ? Infinity
    : (limitCheck.remaining || 0);

  // Validate and deduplicate rows
  const validRows = [];
  const seenPhones = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 because row 1 is header, data starts at row 2

    // Normalize phone: try to extract phone from common column names
    let phone = row.phone || row.phone_number || row.mobile || row.number || row.whatsapp || '';
    phone = phone.trim();

    // If phone doesn't start with +, skip
    if (!phone.startsWith('+')) {
      // Attempt to auto-prefix with + if it looks like an international number
      if (/^[1-9]\d{6,14}$/.test(phone)) {
        phone = `+${phone}`;
      }
    }

    // Validate E.164 format
    if (!E164_REGEX.test(phone)) {
      results.errors.push({
        row: rowNumber,
        phone: phone || '(empty)',
        reason: 'Invalid phone number format. Must be E.164 (e.g., +919876543210)',
      });
      results.skipped++;
      continue;
    }

    // Deduplicate within CSV
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
      name: (row.name || row.full_name || row.contact_name || '').trim() || null,
      email: (row.email || row.email_address || '').trim() || null,
      company: (row.company || row.organization || row.org || '').trim() || null,
      notes: (row.notes || row.note || row.comment || '').trim() || null,
    });
  }

  // Check subscription limit against valid rows to be created
  if (validRows.length === 0) {
    return results;
  }

  // Process in batches for efficiency
  const BATCH_SIZE = 100;
  let createdCount = 0;

  for (let batchStart = 0; batchStart < validRows.length; batchStart += BATCH_SIZE) {
    const batch = validRows.slice(batchStart, batchStart + BATCH_SIZE);

    // Get existing contacts for this batch
    const phones = batch.map((r) => r.phone);
    const existingContacts = await Contact.findAll({
      where: { user_id: userId, phone: { [Op.in]: phones } },
      paranoid: false,
      raw: true,
    });

    const existingMap = new Map(existingContacts.map((c) => [c.phone, c]));

    for (const row of batch) {
      const existing = existingMap.get(row.phone);

      if (existing) {
        if (existing.deleted_at) {
          // Restore soft-deleted and update
          await Contact.restore({ where: { id: existing.id } });
          await Contact.update(
            {
              name: row.name || existing.name,
              email: row.email || existing.email,
              company: row.company || existing.company,
              notes: row.notes || existing.notes,
              source: 'csv_import',
            },
            { where: { id: existing.id } }
          );
          results.updated++;
          createdCount++; // Counts as a restored/new contact for limit purposes
        } else {
          // Update existing active contact
          const updateFields = {};
          if (row.name && !existing.name) updateFields.name = row.name;
          if (row.email && !existing.email) updateFields.email = row.email;
          if (row.company && !existing.company) updateFields.company = row.company;
          if (row.notes && !existing.notes) updateFields.notes = row.notes;

          if (Object.keys(updateFields).length > 0) {
            await Contact.update(updateFields, { where: { id: existing.id } });
          }
          results.updated++;
        }
      } else {
        // Check if we still have remaining capacity
        if (remainingAllowance !== Infinity && createdCount >= remainingAllowance) {
          results.errors.push({
            row: null,
            phone: row.phone,
            reason: 'Subscription contact limit reached during import',
          });
          results.skipped++;
          continue;
        }

        // Create new contact
        try {
          await Contact.create({
            id: generateUUID(),
            user_id: userId,
            phone: row.phone,
            name: row.name,
            email: row.email,
            company: row.company,
            notes: row.notes,
            source: 'csv_import',
            opted_in: true,
            opted_in_at: new Date(),
          });
          results.created++;
          createdCount++;
        } catch (err) {
          // Handle unexpected duplicates (race conditions)
          if (err.name === 'SequelizeUniqueConstraintError') {
            results.errors.push({
              row: null,
              phone: row.phone,
              reason: 'Duplicate contact (already exists)',
            });
            results.skipped++;
          } else {
            results.errors.push({
              row: null,
              phone: row.phone,
              reason: `Database error: ${err.message}`,
            });
            results.skipped++;
          }
        }
      }
    }
  }

  // Increment subscription usage for newly created contacts
  if (createdCount > 0) {
    await incrementSubscriptionUsage(userId, 'contacts', createdCount);
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

async function createGroup(userId, data) {
  const group = await Group.create({
    id: generateUUID(),
    user_id: userId,
    name: data.name,
    description: data.description || null,
    type: data.type || 'static',
    dynamic_filters: data.dynamic_filters || null,
    contact_count: 0,
  });

  return group;
}

async function listGroups(userId) {
  const groups = await Group.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
  });

  return groups;
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

  // Verify all contacts belong to the user
  const contacts = await Contact.findAll({
    where: { id: { [Op.in]: contactIds }, user_id: userId },
    attributes: ['id'],
  });

  const validContactIds = contacts.map((c) => c.id);
  const invalidContactIds = contactIds.filter((id) => !validContactIds.includes(id));

  if (invalidContactIds.length > 0) {
    throw AppError.badRequest(`Contacts not found: ${invalidContactIds.join(', ')}`);
  }

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
  createTag,
  listTags,
  updateTag,
  deleteTag,
  addTagsToContact,
  removeTagFromContact,
  createGroup,
  listGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  addGroupMembers,
  removeGroupMembers,
};
