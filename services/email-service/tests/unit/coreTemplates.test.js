'use strict';

const {
  buildMissingCoreEmailTemplates,
  getCoreEmailTemplateNames,
} = require('../../src/bootstrap/coreTemplates');

describe('core email template bootstrap', () => {
  it('returns all core templates when none exist yet', () => {
    const missingTemplates = buildMissingCoreEmailTemplates([]);
    const coreTemplateNames = getCoreEmailTemplateNames();

    expect(missingTemplates.map((template) => template.name)).toEqual(coreTemplateNames);
  });

  it('still bootstraps verification templates when other templates already exist', () => {
    const missingTemplates = buildMissingCoreEmailTemplates([
      'sub_admin_invite',
      'user_account_invite',
    ]);
    const missingNames = missingTemplates.map((template) => template.name);

    expect(missingNames).toContain('email_verification');
    expect(missingNames).toContain('password_reset');
    expect(missingNames).toContain('welcome');
  });

  it('returns only the actually missing core templates', () => {
    const existingNames = getCoreEmailTemplateNames().filter((name) => name !== 'email_verification');
    const missingTemplates = buildMissingCoreEmailTemplates(existingNames);

    expect(missingTemplates).toHaveLength(1);
    expect(missingTemplates[0].name).toBe('email_verification');
  });
});
