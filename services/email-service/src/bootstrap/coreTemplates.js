'use strict';

const coreTemplateSeeder = require('../seeders/20240101000001-seed-email-templates');

function getCoreEmailTemplateNames(now = new Date()) {
  return coreTemplateSeeder.buildCoreEmailTemplates(now).map((template) => template.name);
}

function buildMissingCoreEmailTemplates(existingTemplateNames = [], now = new Date()) {
  const existingNameSet = new Set(
    Array.isArray(existingTemplateNames)
      ? existingTemplateNames.filter((name) => typeof name === 'string' && name.trim())
      : []
  );

  return coreTemplateSeeder
    .buildCoreEmailTemplates(now)
    .filter((template) => !existingNameSet.has(template.name));
}

module.exports = {
  buildMissingCoreEmailTemplates,
  getCoreEmailTemplateNames,
};
