'use strict';

const { Op, QueryTypes } = require('sequelize');
const axios = require('axios');
const { Automation, AutomationLog, Webhook, sequelize } = require('../models');
const { AppError, getPagination, getPaginationMeta, generateUUID } = require('@nyife/shared-utils');
const { findMatchingAutomation, evaluateConditions } = require('../helpers/matcher');
const {
  getFlowState,
  setFlowState,
  clearFlowState,
  findStep,
  processFlowStep,
} = require('../helpers/flowEngine');
const { getPrimaryMessageText } = require('../helpers/messageContent');
const config = require('../config');

function normalizeInboundMessage(event) {
  if (!event || typeof event !== 'object') {
    return null;
  }

  if (event.event && typeof event.event === 'object') {
    return normalizeInboundMessage(event.event);
  }

  if (event.message && typeof event.message === 'object') {
    return event.message;
  }

  return event;
}

async function findOperationalWaAccountByPhoneNumberId(phoneNumberId) {
  const accounts = await sequelize.query(
    `SELECT id, user_id, waba_id, onboarding_status
     FROM wa_accounts
     WHERE phone_number_id = :phoneNumberId
       AND status = :status
       AND deleted_at IS NULL
     LIMIT 1`,
    {
      replacements: { phoneNumberId, status: 'active' },
      type: QueryTypes.SELECT,
    }
  );

  const account = accounts[0] || null;
  if (!account) {
    return null;
  }

  return account;
}

async function findOperationalWaAccountById(userId, waAccountId) {
  const accounts = await sequelize.query(
    `SELECT id, user_id, waba_id, onboarding_status
     FROM wa_accounts
     WHERE id = :waAccountId
       AND user_id = :userId
       AND status = :status
       AND deleted_at IS NULL
     LIMIT 1`,
    {
      replacements: {
        waAccountId,
        userId,
        status: 'active',
      },
      type: QueryTypes.SELECT,
    }
  );

  const account = accounts[0] || null;
  if (!account) {
    return null;
  }

  return account;
}

function buildWebhookSignature(secret, payload) {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

async function deliverWebhook(webhook, eventName, payload) {
  const webhookPayload = {
    event: eventName,
    webhook_id: webhook.id,
    webhook_name: webhook.name,
    triggered_at: new Date().toISOString(),
    data: payload,
  };

  const headers = {
    'Content-Type': 'application/json',
    ...(webhook.headers || {}),
  };

  if (webhook.secret) {
    headers['x-webhook-signature'] = buildWebhookSignature(webhook.secret, webhookPayload);
  }

  try {
    const response = await axios.post(webhook.url, webhookPayload, {
      headers,
      timeout: 10000,
    });

    await webhook.update({
      last_triggered_at: new Date(),
      failure_count: 0,
    });

    return response.status;
  } catch (err) {
    await webhook.update({
      failure_count: (webhook.failure_count || 0) + 1,
    });
    throw err;
  }
}

async function dispatchWebhookEvents(userId, eventName, payload) {
  const webhooks = (await Webhook.findAll({
    where: {
      user_id: userId,
      is_active: true,
    },
  })) || [];

  const matchingWebhooks = webhooks.filter(
    (webhook) => Array.isArray(webhook.events) && webhook.events.includes(eventName)
  );

  if (matchingWebhooks.length === 0) {
    return;
  }

  await Promise.allSettled(
    matchingWebhooks.map((webhook) => deliverWebhook(webhook, eventName, payload))
  );
}

// ────────────────────────────────────────────────
// Automation CRUD
// ────────────────────────────────────────────────

/**
 * Creates a new automation in draft status.
 */
async function createAutomation(userId, data) {
  const automation = await Automation.create({
    id: generateUUID(),
    user_id: userId,
    wa_account_id: data.wa_account_id,
    name: data.name,
    description: data.description || null,
    type: data.type,
    status: 'draft',
    trigger_config: data.trigger_config,
    action_config: data.action_config,
    priority: data.priority || 0,
    conditions: data.conditions || null,
    stats: { triggered_count: 0, last_triggered_at: null },
  });

  return automation;
}

/**
 * Lists automations for a user with pagination, status/type/search filters.
 */
async function listAutomations(userId, filters) {
  const { page, limit, status, type, search, wa_account_id } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);

  const where = { user_id: userId };

  if (status) {
    where.status = status;
  }

  if (type) {
    where.type = type;
  }

  if (wa_account_id) {
    where.wa_account_id = wa_account_id;
  }

  if (search) {
    where.name = { [Op.like]: `%${search}%` };
  }

  const { rows: automations, count: total } = await Automation.findAndCountAll({
    where,
    offset,
    limit: paginationLimit,
    order: [
      ['priority', 'DESC'],
      ['created_at', 'DESC'],
    ],
  });

  const meta = getPaginationMeta(total, page, limit);

  return { automations, meta };
}

/**
 * Gets a single automation by ID, scoped by user.
 */
async function getAutomation(userId, automationId) {
  const automation = await Automation.findOne({
    where: { id: automationId, user_id: userId },
  });

  if (!automation) {
    throw AppError.notFound('Automation not found');
  }

  return automation;
}

/**
 * Updates an automation.
 */
async function updateAutomation(userId, automationId, data) {
  const automation = await Automation.findOne({
    where: { id: automationId, user_id: userId },
  });

  if (!automation) {
    throw AppError.notFound('Automation not found');
  }

  await automation.update(data);
  await automation.reload();

  return automation;
}

/**
 * Soft-deletes an automation.
 */
async function deleteAutomation(userId, automationId) {
  const automation = await Automation.findOne({
    where: { id: automationId, user_id: userId },
  });

  if (!automation) {
    throw AppError.notFound('Automation not found');
  }

  await automation.destroy();

  return { id: automationId };
}

/**
 * Changes automation status (active/inactive/draft).
 */
async function updateAutomationStatus(userId, automationId, status) {
  const automation = await Automation.findOne({
    where: { id: automationId, user_id: userId },
  });

  if (!automation) {
    throw AppError.notFound('Automation not found');
  }

  await automation.update({ status });
  await automation.reload();

  return automation;
}

/**
 * Gets paginated automation logs for a specific automation.
 */
async function getAutomationLogs(userId, automationId, filters) {
  // Verify automation belongs to user
  const automation = await Automation.findOne({
    where: { id: automationId, user_id: userId },
    attributes: ['id'],
  });

  if (!automation) {
    throw AppError.notFound('Automation not found');
  }

  const { page, limit } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);

  const { rows: logs, count: total } = await AutomationLog.findAndCountAll({
    where: { automation_id: automationId },
    offset,
    limit: paginationLimit,
    order: [['created_at', 'DESC']],
  });

  const meta = getPaginationMeta(total, page, limit);

  return { logs, meta };
}

// ────────────────────────────────────────────────
// Inbound message processing (Kafka consumer)
// ────────────────────────────────────────────────

/**
 * Processes an inbound WhatsApp message for automation matching.
 * This is the core function called by the Kafka webhook.inbound consumer.
 *
 * Steps:
 * 1. Extract phone_number_id from payload, look up wa_account
 * 2. Check Redis for active flow state for this user+contact
 * 3. If active flow: continue flow execution
 * 4. If no active flow: load active automations, run matcher
 * 5. Execute matched automation action
 * 6. Log result and update stats
 */
async function processInboundMessage(payload, redis) {
  const phoneNumberId = payload.phoneNumberId || payload.phone_number_id;
  const message = normalizeInboundMessage(payload);

  if (!phoneNumberId || !message) {
    console.warn('[automation-service] Missing phoneNumberId or message event in payload');
    return null;
  }

  // 1. Find the WhatsApp account by phone_number_id (cross-service raw SQL query)
  let waAccount;
  try {
    waAccount = await findOperationalWaAccountByPhoneNumberId(phoneNumberId);
  } catch (err) {
    console.error('[automation-service] Failed to query wa_accounts:', err.message);
    return null;
  }

  if (!waAccount) {
    console.warn(
      `[automation-service] No operational wa_account found for phone_number_id=${phoneNumberId}`
    );
    return null;
  }
  const userId = waAccount.user_id;
  const waAccountId = waAccount.id;

  // Extract contact phone and message from the normalized inbound event
  const contactPhone = message.from || message.wa_id || '';

  if (!contactPhone) {
    console.warn('[automation-service] No contact phone in inbound message');
    return null;
  }

  await dispatchWebhookEvents(userId, 'message.received', {
    wa_account_id: waAccountId,
    waba_id: waAccount.waba_id,
    phone_number_id: phoneNumberId,
    contact_phone: contactPhone,
    message,
  });

  // 2. Check for active flow state in Redis
  const flowState = await getFlowState(redis, userId, contactPhone);

  if (flowState) {
    // 3. Continue existing flow
    return await continueFlow(redis, userId, waAccountId, contactPhone, message, flowState);
  }

  // 4. Load active automations for this user+wa_account, sorted by priority DESC
  const automations = await Automation.findAll({
    where: {
      user_id: userId,
      wa_account_id: waAccountId,
      status: 'active',
    },
    order: [['priority', 'DESC']],
  });

  if (automations.length === 0) {
    return null;
  }

  // 5. Run matcher to find first matching automation
  const matched = findMatchingAutomation(
    automations.map((a) => a.toJSON()),
    message
  );

  if (!matched) {
    return null;
  }

  // 6. Execute the matched automation
  return await executeAutomation(redis, userId, waAccountId, contactPhone, message, matched);
}

function matchesFlowSubmissionTrigger(automation, submission) {
  const trigger = automation.trigger_config || {};
  if (trigger.trigger_type !== 'flow_submission') {
    return false;
  }

  if (trigger.flow_id && trigger.flow_id !== submission.flowId && trigger.flow_id !== submission.flow_id) {
    return false;
  }

  if (trigger.screen_id && trigger.screen_id !== submission.screenId && trigger.screen_id !== submission.screen_id) {
    return false;
  }

  if (trigger.category) {
    const categories = Array.isArray(submission.categories) ? submission.categories : [];
    if (!categories.includes(trigger.category)) {
      return false;
    }
  }

  return evaluateConditions(automation.conditions || {}, {
    type: 'flow_submission',
    flow_submission: submission,
  });
}

async function processFlowSubmission(payload, redis) {
  const userId = payload.userId || payload.user_id;
  const waAccountId = payload.waAccountId || payload.wa_account_id;
  const contactPhone = payload.contactPhone || payload.contact_phone;

  if (!userId || !waAccountId || !contactPhone) {
    console.warn('[automation-service] Flow submission payload is missing required identifiers');
    return null;
  }

  const waAccount = await findOperationalWaAccountById(userId, waAccountId);
  if (!waAccount) {
    console.warn('[automation-service] Flow submission skipped because the WhatsApp account is not operational');
    return null;
  }

  await dispatchWebhookEvents(userId, 'flow.submitted', {
    wa_account_id: waAccountId,
    contact_phone: contactPhone,
    flow_id: payload.flowId || payload.flow_id || null,
    meta_flow_id: payload.metaFlowId || payload.meta_flow_id || null,
    screen_id: payload.screenId || payload.screen_id || null,
    submission: payload.payload || {},
  });

  const automations = await Automation.findAll({
    where: {
      user_id: userId,
      wa_account_id: waAccountId,
      status: 'active',
    },
    order: [['priority', 'DESC']],
  });

  const matched = automations
    .map((automation) => automation.toJSON())
    .find((automation) => matchesFlowSubmissionTrigger(automation, payload));

  if (!matched) {
    return null;
  }

  const syntheticMessage = {
    type: 'flow_submission',
    flow_submission: payload,
    text: {
      body: JSON.stringify(payload.payload || {}),
    },
  };

  return executeAutomation(redis, userId, waAccountId, contactPhone, syntheticMessage, matched);
}

/**
 * Executes a matched automation based on its type.
 */
async function executeAutomation(redis, userId, waAccountId, contactPhone, message, automation) {
  let logStatus = 'success';
  let errorMessage = null;
  let actionResult = null;

  try {
    switch (automation.type) {
      case 'basic_reply':
        actionResult = await executeBasicReply(userId, waAccountId, contactPhone, automation);
        break;

      case 'advanced_flow':
        actionResult = await executeAdvancedFlow(
          redis,
          userId,
          waAccountId,
          contactPhone,
          message,
          automation
        );
        break;

      case 'webhook_trigger':
        actionResult = await executeWebhookTrigger(
          userId,
          contactPhone,
          message,
          automation
        );
        break;

      case 'api_trigger':
        actionResult = await executeApiTrigger(
          userId,
          waAccountId,
          contactPhone,
          message,
          automation
        );
        break;

      default:
        errorMessage = `Unknown automation type: ${automation.type}`;
        logStatus = 'failed';
    }
  } catch (err) {
    logStatus = 'failed';
    errorMessage = err.message;
    console.error(
      `[automation-service] Failed to execute automation ${automation.id}:`,
      err.message
    );
  }

  // 7. Log the automation trigger result
  try {
    await AutomationLog.create({
      id: generateUUID(),
      automation_id: automation.id,
      user_id: userId,
      trigger_data: {
        message_type: message.type,
        message_text: getPrimaryMessageText(message),
        contact_phone: contactPhone,
      },
      action_result: actionResult,
      status: logStatus,
      error_message: errorMessage,
      contact_phone: contactPhone,
    });
  } catch (logErr) {
    console.error('[automation-service] Failed to create automation log:', logErr.message);
  }

  // 8. Update automation stats
  try {
    const currentStats = automation.stats || { triggered_count: 0, last_triggered_at: null };
    await Automation.update(
      {
        stats: {
          triggered_count: (currentStats.triggered_count || 0) + 1,
          last_triggered_at: new Date().toISOString(),
        },
      },
      { where: { id: automation.id } }
    );
  } catch (statsErr) {
    console.error('[automation-service] Failed to update automation stats:', statsErr.message);
  }

  await dispatchWebhookEvents(
    userId,
    logStatus === 'success' ? 'automation.triggered' : 'automation.failed',
    {
      automation_id: automation.id,
      automation_name: automation.name,
      automation_type: automation.type,
      wa_account_id: waAccountId,
      contact_phone: contactPhone,
      trigger_data: {
        message_type: message.type,
        message_text: getPrimaryMessageText(message),
      },
      action_result: actionResult,
      error_message: errorMessage,
    }
  );

  return { automationId: automation.id, status: logStatus, actionResult };
}

/**
 * Executes a basic reply automation — sends a message back via whatsapp-service.
 */
async function executeBasicReply(userId, waAccountId, contactPhone, automation) {
  const actionConfig = automation.action_config || {};
  const messageType = actionConfig.message_type || 'text';
  const content = actionConfig.content;

  if (!content) {
    throw new Error('Basic reply automation has no content configured');
  }

  const response = await axios.post(
    `${config.whatsappServiceUrl}/api/v1/whatsapp/send`,
    {
      wa_account_id: waAccountId,
      to: contactPhone,
      type: messageType,
      message: content,
    },
    {
      headers: { 'x-user-id': userId },
      timeout: 10000,
    }
  );

  return {
    type: 'basic_reply',
    message_type: messageType,
    sent: true,
    response_status: response.status,
  };
}

/**
 * Starts or continues an advanced flow automation.
 */
async function executeAdvancedFlow(redis, userId, waAccountId, contactPhone, message, automation) {
  const actionConfig = automation.action_config || {};
  const steps = actionConfig.steps || [];

  if (steps.length === 0) {
    throw new Error('Advanced flow automation has no steps configured');
  }

  // Start with the first step
  const firstStep = steps[0];
  const collectedData = {};

  const result = processFlowStep(firstStep, message, collectedData);

  // Execute any immediate actions
  for (const action of result.actions) {
    await executeFlowAction(userId, waAccountId, contactPhone, action);
  }

  // If there is a next step, check if it requires waiting for a reply
  if (result.nextStepId) {
    const nextStep = findStep(steps, result.nextStepId);

    if (nextStep && nextStep.type === 'wait_for_reply') {
      // Set flow state in Redis and wait for the next message
      await setFlowState(redis, userId, contactPhone, {
        automationId: automation.id,
        currentStepId: result.nextStepId,
        collectedData,
        waAccountId,
      });

      return {
        type: 'advanced_flow',
        started: true,
        waiting_for_reply: true,
        current_step: result.nextStepId,
      };
    }

    // Continue processing next steps synchronously (up to a limit to prevent infinite loops)
    let currentStepId = result.nextStepId;
    let iterations = 0;
    const maxIterations = 50;

    while (currentStepId && iterations < maxIterations) {
      iterations++;
      const currentStep = findStep(steps, currentStepId);

      if (!currentStep) break;

      if (currentStep.type === 'wait_for_reply') {
        // Save state and wait
        await setFlowState(redis, userId, contactPhone, {
          automationId: automation.id,
          currentStepId,
          collectedData,
          waAccountId,
        });

        return {
          type: 'advanced_flow',
          started: true,
          waiting_for_reply: true,
          current_step: currentStepId,
          steps_executed: iterations,
        };
      }

      const stepResult = processFlowStep(currentStep, message, collectedData);

      // Execute immediate actions
      for (const action of stepResult.actions) {
        await executeFlowAction(userId, waAccountId, contactPhone, action);
      }

      currentStepId = stepResult.nextStepId;
    }
  }

  return {
    type: 'advanced_flow',
    started: true,
    completed: true,
  };
}

/**
 * Continues an active flow from Redis state.
 */
async function continueFlow(redis, userId, waAccountId, contactPhone, message, flowState) {
  const { automationId, currentStepId, collectedData } = flowState;
  const effectiveWaAccountId = flowState.waAccountId || waAccountId;

  // Load the automation to get steps
  const automation = await Automation.findOne({
    where: { id: automationId, user_id: userId, status: 'active' },
  });

  if (!automation) {
    // Automation no longer active; clear flow state
    await clearFlowState(redis, userId, contactPhone);
    return null;
  }

  const steps = automation.action_config?.steps || [];
  const currentStep = findStep(steps, currentStepId);

  if (!currentStep) {
    await clearFlowState(redis, userId, contactPhone);
    return null;
  }

  // Process the current step with the new message (this is the reply we were waiting for)
  const result = processFlowStep(currentStep, message, collectedData || {});
  let logStatus = 'success';
  let errorMessage = null;

  try {
    // Execute immediate actions from this step
    for (const action of result.actions) {
      await executeFlowAction(userId, effectiveWaAccountId, contactPhone, action);
    }

    // Continue processing subsequent steps
    let nextStepId = result.nextStepId;
    let iterations = 0;
    const maxIterations = 50;

    while (nextStepId && iterations < maxIterations) {
      iterations++;
      const nextStep = findStep(steps, nextStepId);

      if (!nextStep) break;

      if (nextStep.type === 'wait_for_reply') {
        // Save updated state and wait again
        await setFlowState(redis, userId, contactPhone, {
          automationId,
          currentStepId: nextStepId,
          collectedData: collectedData || {},
          waAccountId: effectiveWaAccountId,
        });

        // Log this interaction
        await createFlowLog(
          automationId,
          userId,
          contactPhone,
          message,
          'success',
          null,
          { continued: true, waiting_for_reply: true, current_step: nextStepId }
        );

        // Update stats
        await incrementAutomationStats(automationId, automation.stats);

        return {
          automationId,
          status: 'success',
          actionResult: { type: 'advanced_flow', continued: true, waiting_for_reply: true },
        };
      }

      const stepResult = processFlowStep(nextStep, message, collectedData || {});

      for (const action of stepResult.actions) {
        await executeFlowAction(userId, effectiveWaAccountId, contactPhone, action);
      }

      nextStepId = stepResult.nextStepId;
    }

    // Flow completed — clear state
    await clearFlowState(redis, userId, contactPhone);
  } catch (err) {
    logStatus = 'failed';
    errorMessage = err.message;
    console.error(`[automation-service] Flow continuation error for automation ${automationId}:`, err.message);
    // Clear flow state on error to prevent stuck flows
    await clearFlowState(redis, userId, contactPhone);
  }

  // Log the flow continuation
  await createFlowLog(
    automationId,
    userId,
    contactPhone,
    message,
    logStatus,
    errorMessage,
    { continued: true, completed: logStatus === 'success' }
  );

  // Update stats
  await incrementAutomationStats(automationId, automation.stats);

  return { automationId, status: logStatus };
}

/**
 * Executes a single flow action (send_message, send_template, add_tag, call_webhook, delay).
 */
async function executeFlowAction(userId, waAccountId, contactPhone, action) {
  switch (action.type) {
    case 'send_message': {
      const msgConfig = action.config || {};
      await axios.post(
        `${config.whatsappServiceUrl}/api/v1/whatsapp/send`,
        {
          wa_account_id: waAccountId,
          to: contactPhone,
          type: msgConfig.message_type || 'text',
          message: msgConfig.content || msgConfig.text || '',
        },
        {
          headers: { 'x-user-id': userId },
          timeout: 10000,
        }
      );
      break;
    }

    case 'send_template': {
      const tmplConfig = action.config || {};
      await axios.post(
        `${config.whatsappServiceUrl}/api/v1/whatsapp/send`,
        {
          wa_account_id: waAccountId,
          to: contactPhone,
          type: 'template',
          message: {
            name: tmplConfig.template_name,
            language: {
              code: tmplConfig.template_language || 'en',
            },
            components: tmplConfig.components || [],
          },
        },
        {
          headers: { 'x-user-id': userId },
          timeout: 10000,
        }
      );
      break;
    }

    case 'send_flow': {
      const flowConfig = action.config || {};
      await axios.post(
        `${config.whatsappServiceUrl}/api/v1/whatsapp/send/flow`,
        {
          wa_account_id: waAccountId,
          to: contactPhone,
          flow_id: flowConfig.flow_id,
          flow_cta: flowConfig.flow_cta || 'Continue',
          flow_token: flowConfig.flow_token,
          flow_message_version: flowConfig.flow_message_version,
          flow_action: flowConfig.flow_action,
          flow_action_payload: flowConfig.flow_action_payload,
          body_text: flowConfig.body_text,
          header_text: flowConfig.header_text,
          footer_text: flowConfig.footer_text,
        },
        {
          headers: { 'x-user-id': userId },
          timeout: 10000,
        }
      );
      break;
    }

    case 'add_tag': {
      const tagConfig = action.config || {};
      if (tagConfig.tag_id) {
        try {
          await axios.post(
            `${config.contactServiceUrl}/api/v1/contacts/add-tag`,
            {
              phone: contactPhone,
              tag_id: tagConfig.tag_id,
            },
            {
              headers: { 'x-user-id': userId },
              timeout: 5000,
            }
          );
        } catch (err) {
          console.warn('[automation-service] Failed to add tag to contact:', err.message);
        }
      }
      break;
    }

    case 'call_webhook': {
      const whConfig = action.config || {};
      if (whConfig.url) {
        try {
          await axios.post(
            whConfig.url,
            {
              contact_phone: contactPhone,
              user_id: userId,
              wa_account_id: waAccountId,
              timestamp: new Date().toISOString(),
              data: whConfig.payload || {},
            },
            {
              headers: whConfig.headers || {},
              timeout: 10000,
            }
          );
        } catch (err) {
          console.warn('[automation-service] Flow webhook call failed:', err.message);
        }
      }
      break;
    }

    case 'delay': {
      const delayConfig = action.config || {};
      const delayMs = (delayConfig.seconds || 0) * 1000;
      if (delayMs > 0 && delayMs <= 30000) {
        // Max 30 seconds delay within a flow step
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      break;
    }

    default:
      console.warn(`[automation-service] Unknown flow action type: ${action.type}`);
  }
}

/**
 * Executes a webhook_trigger automation — POSTs to configured webhook URL.
 */
async function executeWebhookTrigger(userId, contactPhone, message, automation) {
  const actionConfig = automation.action_config || {};
  const webhookUrl = actionConfig.webhook_url;

  if (!webhookUrl) {
    throw new Error('Webhook trigger automation has no webhook_url configured');
  }

  const webhookPayload = {
    automation_id: automation.id,
    automation_name: automation.name,
    user_id: userId,
    contact_phone: contactPhone,
    message: {
      type: message.type,
      text: getPrimaryMessageText(message),
      timestamp: message.timestamp,
    },
    triggered_at: new Date().toISOString(),
  };

  const webhookHeaders = actionConfig.headers || {};
  if (actionConfig.secret) {
    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', actionConfig.secret)
      .update(JSON.stringify(webhookPayload))
      .digest('hex');
    webhookHeaders['x-webhook-signature'] = signature;
  }

  const response = await axios.post(webhookUrl, webhookPayload, {
    headers: {
      'Content-Type': 'application/json',
      ...webhookHeaders,
    },
    timeout: 10000,
  });

  return {
    type: 'webhook_trigger',
    url: webhookUrl,
    response_status: response.status,
    sent: true,
  };
}

/**
 * Executes an api_trigger automation — sends a message and/or calls an API endpoint.
 */
async function executeApiTrigger(userId, waAccountId, contactPhone, message, automation) {
  const actionConfig = automation.action_config || {};
  const results = [];

  // If there is a reply message configured, send it
  if (actionConfig.reply_content) {
    await axios.post(
      `${config.whatsappServiceUrl}/api/v1/whatsapp/send`,
      {
        wa_account_id: waAccountId,
        to: contactPhone,
        type: actionConfig.reply_type || 'text',
        message: actionConfig.reply_content,
      },
      {
        headers: { 'x-user-id': userId },
        timeout: 10000,
      }
    );
    results.push({ action: 'reply_sent', success: true });
  }

  // If there is an API endpoint configured, call it
  if (actionConfig.api_url) {
    const apiPayload = {
      automation_id: automation.id,
      user_id: userId,
      contact_phone: contactPhone,
      message: {
        type: message.type,
        text: getPrimaryMessageText(message),
      },
      ...(actionConfig.api_payload || {}),
    };

    const apiResponse = await axios({
      method: actionConfig.api_method || 'POST',
      url: actionConfig.api_url,
      data: apiPayload,
      headers: {
        'Content-Type': 'application/json',
        ...(actionConfig.api_headers || {}),
      },
      timeout: 10000,
    });

    results.push({
      action: 'api_called',
      url: actionConfig.api_url,
      response_status: apiResponse.status,
      success: true,
    });
  }

  return { type: 'api_trigger', results };
}

/**
 * Helper to create a flow log entry.
 */
async function createFlowLog(automationId, userId, contactPhone, message, status, errorMessage, actionResult) {
  try {
    await AutomationLog.create({
      id: generateUUID(),
      automation_id: automationId,
      user_id: userId,
      trigger_data: {
        message_type: message.type,
        message_text: getPrimaryMessageText(message),
        contact_phone: contactPhone,
      },
      action_result: actionResult,
      status,
      error_message: errorMessage,
      contact_phone: contactPhone,
    });
  } catch (err) {
    console.error('[automation-service] Failed to create flow log:', err.message);
  }
}

/**
 * Helper to increment automation triggered_count stats.
 */
async function incrementAutomationStats(automationId, currentStats) {
  try {
    await Automation.update(
      {
        stats: {
          triggered_count: ((currentStats || {}).triggered_count || 0) + 1,
          last_triggered_at: new Date().toISOString(),
        },
      },
      { where: { id: automationId } }
    );
  } catch (err) {
    console.error('[automation-service] Failed to update automation stats:', err.message);
  }
}

// ────────────────────────────────────────────────
// Webhook CRUD
// ────────────────────────────────────────────────

/**
 * Creates a new webhook.
 */
async function createWebhook(userId, data) {
  const webhook = await Webhook.create({
    id: generateUUID(),
    user_id: userId,
    name: data.name,
    url: data.url,
    events: data.events,
    secret: data.secret || null,
    headers: data.headers || null,
    is_active: true,
    failure_count: 0,
  });

  return webhook;
}

/**
 * Lists webhooks for a user with pagination.
 */
async function listWebhooks(userId, filters) {
  const { page, limit } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);

  const { rows: webhooks, count: total } = await Webhook.findAndCountAll({
    where: { user_id: userId },
    offset,
    limit: paginationLimit,
    order: [['created_at', 'DESC']],
  });

  const meta = getPaginationMeta(total, page, limit);

  return { webhooks, meta };
}

/**
 * Gets a single webhook by ID, scoped by user.
 */
async function getWebhook(userId, webhookId) {
  const webhook = await Webhook.findOne({
    where: { id: webhookId, user_id: userId },
  });

  if (!webhook) {
    throw AppError.notFound('Webhook not found');
  }

  return webhook;
}

/**
 * Updates a webhook.
 */
async function updateWebhook(userId, webhookId, data) {
  const webhook = await Webhook.findOne({
    where: { id: webhookId, user_id: userId },
  });

  if (!webhook) {
    throw AppError.notFound('Webhook not found');
  }

  await webhook.update(data);
  await webhook.reload();

  return webhook;
}

/**
 * Soft-deletes a webhook.
 */
async function deleteWebhook(userId, webhookId) {
  const webhook = await Webhook.findOne({
    where: { id: webhookId, user_id: userId },
  });

  if (!webhook) {
    throw AppError.notFound('Webhook not found');
  }

  await webhook.destroy();

  return { id: webhookId };
}

/**
 * Tests a webhook by sending a test payload.
 */
async function testWebhook(userId, webhookId) {
  const webhook = await Webhook.findOne({
    where: { id: webhookId, user_id: userId },
  });

  if (!webhook) {
    throw AppError.notFound('Webhook not found');
  }

  const testPayload = {
    event: 'test',
    webhook_id: webhook.id,
    webhook_name: webhook.name,
    user_id: userId,
    timestamp: new Date().toISOString(),
    message: 'This is a test webhook payload from Nyife automation service.',
  };

  const webhookHeaders = {
    'Content-Type': 'application/json',
    ...(webhook.headers || {}),
  };

  if (webhook.secret) {
    webhookHeaders['x-webhook-signature'] = buildWebhookSignature(webhook.secret, testPayload);
  }

  try {
    const response = await axios.post(webhook.url, testPayload, {
      headers: webhookHeaders,
      timeout: 10000,
    });

    // Reset failure count on success
    await webhook.update({
      last_triggered_at: new Date(),
      failure_count: 0,
    });

    return {
      success: true,
      response_status: response.status,
      response_data: response.data,
    };
  } catch (err) {
    // Increment failure count
    await webhook.update({
      failure_count: webhook.failure_count + 1,
    });

    throw AppError.badRequest(
      `Webhook test failed: ${err.response ? `HTTP ${err.response.status}` : err.message}`
    );
  }
}

module.exports = {
  // Automation CRUD
  createAutomation,
  listAutomations,
  getAutomation,
  updateAutomation,
  deleteAutomation,
  updateAutomationStatus,
  getAutomationLogs,

  // Core processing
  processInboundMessage,
  processFlowSubmission,

  // Webhook CRUD
  createWebhook,
  listWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
};
