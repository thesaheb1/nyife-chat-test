'use strict';

const contactService = require('../services/contact.service');
const { successResponse } = require('@nyife/shared-utils');
const {
  createContactSchema,
  updateContactSchema,
  listContactsSchema,
  bulkDeleteSchema,
  createTagSchema,
  updateTagSchema,
  addTagsSchema,
  createGroupSchema,
  updateGroupSchema,
  addGroupMembersSchema,
  removeGroupMembersSchema,
  idParamSchema,
  tagIdParamSchema,
  groupIdParamSchema,
  groupMembersListSchema,
} = require('../validations/contact.validation');

// ─── Contacts ────────────────────────────────────────────────────────────────

async function createContact(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const data = createContactSchema.parse(req.body);
  const contact = await contactService.createContact(userId, data);
  return successResponse(res, { contact }, 'Contact created successfully', 201);
}

async function listContacts(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const filters = listContactsSchema.parse(req.query);
  const result = await contactService.listContacts(userId, filters);
  return successResponse(res, { contacts: result.contacts }, 'Contacts retrieved successfully', 200, result.meta);
}

async function getContact(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const { id } = idParamSchema.parse(req.params);
  const contact = await contactService.getContact(userId, id);
  return successResponse(res, { contact }, 'Contact retrieved successfully');
}

async function updateContact(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const { id } = idParamSchema.parse(req.params);
  const data = updateContactSchema.parse(req.body);
  const contact = await contactService.updateContact(userId, id, data);
  return successResponse(res, { contact }, 'Contact updated successfully');
}

async function deleteContact(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const { id } = idParamSchema.parse(req.params);
  const result = await contactService.deleteContact(userId, id);
  return successResponse(res, result, 'Contact deleted successfully');
}

async function bulkDeleteContacts(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const { ids } = bulkDeleteSchema.parse(req.body);
  const result = await contactService.bulkDeleteContacts(userId, ids);
  return successResponse(res, result, `${result.deleted_count} contact(s) deleted successfully`);
}

async function importCsv(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'CSV file is required. Upload a file with field name "file".',
    });
  }

  // Create a readable stream from the uploaded buffer
  const { Readable } = require('stream');
  const fileStream = Readable.from(req.file.buffer);

  const result = await contactService.importCsv(userId, fileStream);
  return successResponse(res, result, 'CSV import completed', 200);
}

// ─── Tags ────────────────────────────────────────────────────────────────────

async function createTag(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const data = createTagSchema.parse(req.body);
  const tag = await contactService.createTag(userId, data);
  return successResponse(res, { tag }, 'Tag created successfully', 201);
}

async function listTags(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const tags = await contactService.listTags(userId);
  return successResponse(res, { tags }, 'Tags retrieved successfully');
}

async function updateTag(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const { id } = idParamSchema.parse(req.params);
  const data = updateTagSchema.parse(req.body);
  const tag = await contactService.updateTag(userId, id, data);
  return successResponse(res, { tag }, 'Tag updated successfully');
}

async function deleteTag(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const { id } = idParamSchema.parse(req.params);
  const result = await contactService.deleteTag(userId, id);
  return successResponse(res, result, 'Tag deleted successfully');
}

async function addTagsToContact(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const { id } = idParamSchema.parse(req.params);
  const { tag_ids } = addTagsSchema.parse(req.body);
  const contact = await contactService.addTagsToContact(userId, id, tag_ids);
  return successResponse(res, { contact }, 'Tags added to contact successfully');
}

async function removeTagFromContact(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const { id, tagId } = tagIdParamSchema.parse(req.params);
  const contact = await contactService.removeTagFromContact(userId, id, tagId);
  return successResponse(res, { contact }, 'Tag removed from contact successfully');
}

// ─── Groups ──────────────────────────────────────────────────────────────────

async function createGroup(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const data = createGroupSchema.parse(req.body);
  const group = await contactService.createGroup(userId, data);
  return successResponse(res, { group }, 'Group created successfully', 201);
}

async function listGroups(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const groups = await contactService.listGroups(userId);
  return successResponse(res, { groups }, 'Groups retrieved successfully');
}

async function getGroup(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const { id } = groupIdParamSchema.parse(req.params);
  const { page, limit } = groupMembersListSchema.parse(req.query);
  const result = await contactService.getGroup(userId, id, page, limit);
  return successResponse(res, { group: result.group, members: result.members }, 'Group retrieved successfully', 200, result.meta);
}

async function updateGroup(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const { id } = groupIdParamSchema.parse(req.params);
  const data = updateGroupSchema.parse(req.body);
  const group = await contactService.updateGroup(userId, id, data);
  return successResponse(res, { group }, 'Group updated successfully');
}

async function deleteGroup(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const { id } = groupIdParamSchema.parse(req.params);
  const result = await contactService.deleteGroup(userId, id);
  return successResponse(res, result, 'Group deleted successfully');
}

async function addGroupMembers(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const { id } = groupIdParamSchema.parse(req.params);
  const { contact_ids } = addGroupMembersSchema.parse(req.body);
  const result = await contactService.addGroupMembers(userId, id, contact_ids);
  return successResponse(res, result, 'Members added to group successfully');
}

async function removeGroupMembers(req, res) {
  const userId = req.headers['x-user-id'] || req.user.id;
  const { id } = groupIdParamSchema.parse(req.params);
  const { contact_ids } = removeGroupMembersSchema.parse(req.body);
  const result = await contactService.removeGroupMembers(userId, id, contact_ids);
  return successResponse(res, result, 'Members removed from group successfully');
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
