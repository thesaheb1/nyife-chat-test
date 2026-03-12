'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const existing = await queryInterface.sequelize.query(
      "SELECT id FROM email_templates WHERE name = 'user_account_invite' LIMIT 1",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (existing.length > 0) {
      return;
    }

    const now = new Date();

    await queryInterface.bulkInsert('email_templates', [
      {
        id: uuidv4(),
        name: 'user_account_invite',
        subject: "You've been invited to join Nyife",
        html_body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>User Invitation</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f7;color:#333333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background-color:#0f766e;padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">Welcome to Nyife</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{firstName}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">An admin invited you to join <strong>Nyife</strong>. Set your password to activate your account.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background-color:#0f766e;border-radius:6px;padding:14px 32px;text-align:center;">
      <a href="{{inviteUrl}}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">Accept Invitation</a>
    </td></tr>
    </table>
    <p style="font-size:14px;line-height:1.6;color:#666666;margin:24px 0 0;">This invitation will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.</p>
    <p style="font-size:13px;line-height:1.6;color:#999999;margin:16px 0 0;">If the button does not work, copy and paste this link into your browser:<br><a href="{{inviteUrl}}" style="color:#0f766e;">{{inviteUrl}}</a></p>
  </td></tr>
  <tr><td style="background-color:#f8f8fa;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:#999999;margin:0;">Nyife Platform</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        text_body: `Hi {{firstName}},

You have been invited to join Nyife.

Accept the invitation: {{inviteUrl}}

This invitation will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.

- The Nyife Team`,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('email_templates', { name: 'user_account_invite' }, {});
  },
};
