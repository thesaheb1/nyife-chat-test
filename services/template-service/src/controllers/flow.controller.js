'use strict';

const flowService = require('../services/flow.service');
const { successResponse } = require('@nyife/shared-utils');
const {
  createFlowSchema,
  updateFlowSchema,
  flowIdSchema,
  listFlowsSchema,
  flowMetaActionSchema,
  syncFlowsSchema,
  listFlowSubmissionsSchema,
  dataExchangeSchema,
} = require('../validations/flow.validation');

async function createFlow(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const payload = createFlowSchema.parse(req.body || {});
  const flow = await flowService.createFlow(userId, payload);
  return successResponse(res, { flow }, 'Flow created successfully', 201);
}

async function listFlows(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const filters = listFlowsSchema.parse(req.query || {});
  const { flows, meta } = await flowService.listFlows(userId, filters);
  return successResponse(res, { flows }, 'Flows retrieved successfully', 200, meta);
}

async function getFlow(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { id } = flowIdSchema.parse(req.params);
  const flow = await flowService.getFlow(userId, id);
  return successResponse(res, { flow }, 'Flow retrieved successfully');
}

async function updateFlow(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { id } = flowIdSchema.parse(req.params);
  const payload = updateFlowSchema.parse(req.body || {});
  const flow = await flowService.updateFlow(userId, id, payload);
  return successResponse(res, { flow }, 'Flow updated successfully');
}

async function deleteFlow(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { id } = flowIdSchema.parse(req.params);
  await flowService.deleteFlow(userId, id);
  return successResponse(res, null, 'Flow deleted successfully');
}

async function duplicateFlow(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { id } = flowIdSchema.parse(req.params);
  const flow = await flowService.duplicateFlow(userId, id);
  return successResponse(res, { flow }, 'Flow duplicated successfully', 201);
}

async function saveFlowToMeta(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { id } = flowIdSchema.parse(req.params);
  const { waba_id } = flowMetaActionSchema.parse(req.body || {});
  const accessToken = req.headers['x-wa-access-token'] || null;
  const flow = await flowService.saveFlowToMeta(userId, id, accessToken, waba_id || null);
  return successResponse(res, { flow }, 'Flow saved to Meta successfully');
}

async function publishFlow(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { id } = flowIdSchema.parse(req.params);
  const { waba_id } = flowMetaActionSchema.parse(req.body || {});
  const accessToken = req.headers['x-wa-access-token'] || null;
  const flow = await flowService.publishFlow(userId, id, accessToken, waba_id || null);
  return successResponse(res, { flow }, 'Flow published successfully');
}

async function deprecateFlow(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { id } = flowIdSchema.parse(req.params);
  const accessToken = req.headers['x-wa-access-token'] || null;
  const flow = await flowService.deprecateFlow(userId, id, accessToken);
  return successResponse(res, { flow }, 'Flow deprecated successfully');
}

async function syncFlows(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { waba_id, force } = syncFlowsSchema.parse(req.body || {});
  const accessToken = req.headers['x-wa-access-token'] || null;
  const result = await flowService.syncFlows(userId, waba_id, accessToken, force);
  return successResponse(res, result, `Synced ${result.synced} flows from Meta`);
}

async function listSubmissions(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { id } = flowIdSchema.parse(req.params);
  const filters = listFlowSubmissionsSchema.parse(req.query || {});
  const { submissions, meta } = await flowService.listSubmissions(userId, id, filters);
  return successResponse(res, { submissions }, 'Flow submissions retrieved successfully', 200, meta);
}

async function handleDataExchange(req, res) {
  const userId = req.headers['x-user-id'] || req.headers['x-tenant-user-id'] || null;
  const payload = dataExchangeSchema.parse(req.body || {});
  const result = await flowService.handleDataExchange(userId, payload);
  return successResponse(res, result, 'Data exchange resolved successfully');
}

module.exports = {
  createFlow,
  listFlows,
  getFlow,
  updateFlow,
  deleteFlow,
  duplicateFlow,
  saveFlowToMeta,
  publishFlow,
  deprecateFlow,
  syncFlows,
  listSubmissions,
  handleDataExchange,
};
