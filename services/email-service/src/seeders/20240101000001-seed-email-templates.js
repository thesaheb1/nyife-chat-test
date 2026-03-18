'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
function buildCoreEmailTemplates(now = new Date()) {
  return [
      {
        id: uuidv4(),
        name: 'welcome',
        subject: 'Welcome to Nyife, {{name}}!',
        html_body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Nyife</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f7;color:#333333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background-color:#4F46E5;padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">Welcome to Nyife</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Thank you for joining Nyife! We are excited to have you on board. Here is how to get started:</p>
    <ol style="font-size:15px;line-height:1.8;padding-left:20px;margin:0 0 24px;">
      <li>Connect your WhatsApp Business account</li>
      <li>Import your contacts or create a new list</li>
      <li>Create your first message template</li>
      <li>Launch your first campaign</li>
    </ol>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background-color:#4F46E5;border-radius:6px;padding:14px 32px;text-align:center;">
      <a href="{{dashboardUrl}}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">Go to Dashboard</a>
    </td></tr>
    </table>
    <p style="font-size:14px;line-height:1.6;color:#666666;margin:24px 0 0;">If you have any questions, our support team is always here to help.</p>
  </td></tr>
  <tr><td style="background-color:#f8f8fa;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:#999999;margin:0;">Nyife - WhatsApp Marketing Platform</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        text_body: `Hi {{name}},

Welcome to Nyife! Thank you for joining us. Here is how to get started:

1. Connect your WhatsApp Business account
2. Import your contacts or create a new list
3. Create your first message template
4. Launch your first campaign

Visit your dashboard: {{dashboardUrl}}

If you have any questions, our support team is always here to help.

- The Nyife Team`,

        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'email_verification',
        subject: 'Verify your email address',
        html_body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verify Your Email</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f7;color:#333333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background-color:#4F46E5;padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">Verify Your Email</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Please click the button below to verify your email address and activate your account.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background-color:#4F46E5;border-radius:6px;padding:14px 32px;text-align:center;">
      <a href="{{verificationUrl}}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">Verify Email Address</a>
    </td></tr>
    </table>
    <p style="font-size:14px;line-height:1.6;color:#666666;margin:24px 0 0;">If you did not create an account on Nyife, you can safely ignore this email.</p>
    <p style="font-size:13px;line-height:1.6;color:#999999;margin:16px 0 0;">If the button does not work, copy and paste this link into your browser:<br><a href="{{verificationUrl}}" style="color:#4F46E5;">{{verificationUrl}}</a></p>
  </td></tr>
  <tr><td style="background-color:#f8f8fa;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:#999999;margin:0;">Nyife - WhatsApp Marketing Platform</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        text_body: `Hi {{name}},

Please verify your email address by clicking the link below:

{{verificationUrl}}

If you did not create an account on Nyife, you can safely ignore this email.

- The Nyife Team`,

        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'password_reset',
        subject: 'Reset your password',
        html_body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f7;color:#333333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background-color:#4F46E5;padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">Password Reset</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">We received a request to reset your password. Click the button below to choose a new password. This link will expire in {{expiresIn}} minutes.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background-color:#4F46E5;border-radius:6px;padding:14px 32px;text-align:center;">
      <a href="{{resetUrl}}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">Reset Password</a>
    </td></tr>
    </table>
    <p style="font-size:14px;line-height:1.6;color:#666666;margin:24px 0 0;">If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
    <p style="font-size:13px;line-height:1.6;color:#999999;margin:16px 0 0;">If the button does not work, copy and paste this link into your browser:<br><a href="{{resetUrl}}" style="color:#4F46E5;">{{resetUrl}}</a></p>
  </td></tr>
  <tr><td style="background-color:#f8f8fa;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:#999999;margin:0;">Nyife - WhatsApp Marketing Platform</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        text_body: `Hi {{name}},

We received a request to reset your password. Click the link below to choose a new password. This link will expire in {{expiresIn}} minutes.

{{resetUrl}}

If you did not request a password reset, please ignore this email. Your password will remain unchanged.

- The Nyife Team`,

        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'subscription_activated',
        subject: 'Your {{planName}} plan is now active',
        html_body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Subscription Activated</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f7;color:#333333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background-color:#4F46E5;padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">Subscription Activated</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Great news! Your <strong>{{planName}}</strong> plan is now active. Here are your plan details:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;">
      <tr style="background-color:#f8f8fa;">
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;border-bottom:1px solid #e0e0e0;">Plan</td>
        <td style="padding:12px 16px;font-size:14px;border-bottom:1px solid #e0e0e0;">{{planName}}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;border-bottom:1px solid #e0e0e0;">Billing Cycle</td>
        <td style="padding:12px 16px;font-size:14px;border-bottom:1px solid #e0e0e0;">{{billingCycle}}</td>
      </tr>
      <tr style="background-color:#f8f8fa;">
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;">Next Billing Date</td>
        <td style="padding:12px 16px;font-size:14px;">{{nextBillingDate}}</td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background-color:#4F46E5;border-radius:6px;padding:14px 32px;text-align:center;">
      <a href="{{dashboardUrl}}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">Go to Dashboard</a>
    </td></tr>
    </table>
  </td></tr>
  <tr><td style="background-color:#f8f8fa;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:#999999;margin:0;">Nyife - WhatsApp Marketing Platform</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        text_body: `Hi {{name}},

Great news! Your {{planName}} plan is now active.

Plan: {{planName}}
Billing Cycle: {{billingCycle}}
Next Billing Date: {{nextBillingDate}}

Visit your dashboard: {{dashboardUrl}}

- The Nyife Team`,

        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'subscription_expired',
        subject: 'Your {{planName}} plan has expired',
        html_body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Subscription Expired</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f7;color:#333333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background-color:#4F46E5;padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">Subscription Expired</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Your <strong>{{planName}}</strong> plan has expired. To continue using Nyife's features without interruption, please renew your subscription.</p>
    <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#991b1b;">Without an active plan, you will not be able to send campaigns or access premium features.</p>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background-color:#4F46E5;border-radius:6px;padding:14px 32px;text-align:center;">
      <a href="{{renewUrl}}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">Renew Subscription</a>
    </td></tr>
    </table>
    <p style="font-size:14px;line-height:1.6;color:#666666;margin:24px 0 0;">If you have any questions about renewal or upgrading, our support team is happy to help.</p>
  </td></tr>
  <tr><td style="background-color:#f8f8fa;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:#999999;margin:0;">Nyife - WhatsApp Marketing Platform</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        text_body: `Hi {{name}},

Your {{planName}} plan has expired. To continue using Nyife's features without interruption, please renew your subscription.

Without an active plan, you will not be able to send campaigns or access premium features.

Renew your subscription: {{renewUrl}}

If you have any questions about renewal or upgrading, our support team is happy to help.

- The Nyife Team`,

        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'wallet_recharged',
        subject: 'Wallet recharged successfully',
        html_body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Wallet Recharged</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f7;color:#333333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background-color:#4F46E5;padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">Wallet Recharged</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Your wallet has been recharged successfully. Here are the details:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;">
      <tr style="background-color:#f8f8fa;">
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;border-bottom:1px solid #e0e0e0;">Amount Added</td>
        <td style="padding:12px 16px;font-size:14px;border-bottom:1px solid #e0e0e0;">{{amount}}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;border-bottom:1px solid #e0e0e0;">New Balance</td>
        <td style="padding:12px 16px;font-size:14px;border-bottom:1px solid #e0e0e0;">{{balance}}</td>
      </tr>
      <tr style="background-color:#f8f8fa;">
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;">Transaction ID</td>
        <td style="padding:12px 16px;font-size:14px;">{{transactionId}}</td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background-color:#4F46E5;border-radius:6px;padding:14px 32px;text-align:center;">
      <a href="{{walletUrl}}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">View Wallet</a>
    </td></tr>
    </table>
  </td></tr>
  <tr><td style="background-color:#f8f8fa;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:#999999;margin:0;">Nyife - WhatsApp Marketing Platform</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        text_body: `Hi {{name}},

Your wallet has been recharged successfully.

Amount Added: {{amount}}
New Balance: {{balance}}
Transaction ID: {{transactionId}}

View your wallet: {{walletUrl}}

- The Nyife Team`,

        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'invoice',
        subject: 'Invoice #{{invoiceNumber}}',
        html_body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f7;color:#333333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background-color:#4F46E5;padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">Invoice #{{invoiceNumber}}</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Here is your invoice for your recent transaction on Nyife.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;">
      <tr style="background-color:#4F46E5;">
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;color:#ffffff;">Description</td>
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;color:#ffffff;text-align:right;">Amount</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:14px;border-bottom:1px solid #e0e0e0;">{{description}}</td>
        <td style="padding:12px 16px;font-size:14px;border-bottom:1px solid #e0e0e0;text-align:right;">{{amount}}</td>
      </tr>
      <tr style="background-color:#f8f8fa;">
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;border-bottom:1px solid #e0e0e0;">Tax</td>
        <td style="padding:12px 16px;font-size:14px;border-bottom:1px solid #e0e0e0;text-align:right;">{{tax}}</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;font-size:16px;font-weight:bold;">Total</td>
        <td style="padding:14px 16px;font-size:16px;font-weight:bold;text-align:right;color:#4F46E5;">{{total}}</td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="font-size:14px;color:#666666;">Invoice Date: {{invoiceDate}}</td>
        <td style="font-size:14px;color:#666666;text-align:right;">Payment Method: {{paymentMethod}}</td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background-color:#4F46E5;border-radius:6px;padding:14px 32px;text-align:center;">
      <a href="{{invoiceUrl}}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">Download Invoice</a>
    </td></tr>
    </table>
  </td></tr>
  <tr><td style="background-color:#f8f8fa;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:#999999;margin:0;">Nyife - WhatsApp Marketing Platform</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        text_body: `Hi {{name}},

Here is your invoice for your recent transaction on Nyife.

Invoice #{{invoiceNumber}}
Date: {{invoiceDate}}

Description: {{description}}
Amount: {{amount}}
Tax: {{tax}}
Total: {{total}}

Payment Method: {{paymentMethod}}

Download your invoice: {{invoiceUrl}}

- The Nyife Team`,

        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'campaign_completed',
        subject: 'Campaign "{{campaignName}}" completed',
        html_body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Campaign Completed</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f7;color:#333333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background-color:#4F46E5;padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">Campaign Completed</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Your campaign <strong>"{{campaignName}}"</strong> has been completed. Here is a summary of the results:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;">
      <tr style="background-color:#f8f8fa;">
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;border-bottom:1px solid #e0e0e0;">Total Recipients</td>
        <td style="padding:12px 16px;font-size:14px;border-bottom:1px solid #e0e0e0;text-align:right;">{{totalRecipients}}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;border-bottom:1px solid #e0e0e0;">Sent</td>
        <td style="padding:12px 16px;font-size:14px;border-bottom:1px solid #e0e0e0;text-align:right;color:#16a34a;">{{sentCount}}</td>
      </tr>
      <tr style="background-color:#f8f8fa;">
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;border-bottom:1px solid #e0e0e0;">Delivered</td>
        <td style="padding:12px 16px;font-size:14px;border-bottom:1px solid #e0e0e0;text-align:right;color:#16a34a;">{{deliveredCount}}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;border-bottom:1px solid #e0e0e0;">Read</td>
        <td style="padding:12px 16px;font-size:14px;border-bottom:1px solid #e0e0e0;text-align:right;color:#2563eb;">{{readCount}}</td>
      </tr>
      <tr style="background-color:#f8f8fa;">
        <td style="padding:12px 16px;font-size:14px;font-weight:bold;">Failed</td>
        <td style="padding:12px 16px;font-size:14px;text-align:right;color:#dc2626;">{{failedCount}}</td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background-color:#4F46E5;border-radius:6px;padding:14px 32px;text-align:center;">
      <a href="{{campaignUrl}}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">View Campaign Details</a>
    </td></tr>
    </table>
  </td></tr>
  <tr><td style="background-color:#f8f8fa;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:#999999;margin:0;">Nyife - WhatsApp Marketing Platform</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        text_body: `Hi {{name}},

Your campaign "{{campaignName}}" has been completed. Here is a summary:

Total Recipients: {{totalRecipients}}
Sent: {{sentCount}}
Delivered: {{deliveredCount}}
Read: {{readCount}}
Failed: {{failedCount}}

View campaign details: {{campaignUrl}}

- The Nyife Team`,

        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'support_reply',
        subject: 'Reply to your support ticket #{{ticketId}}',
        html_body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Support Reply</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f7;color:#333333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background-color:#4F46E5;padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">Support Ticket #{{ticketId}}</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">We have replied to your support ticket. Here is the response:</p>
    <div style="background-color:#f0f0ff;border-left:4px solid #4F46E5;border-radius:0 6px 6px 0;padding:20px;margin:0 0 24px;">
      <p style="font-size:15px;line-height:1.7;margin:0;color:#333333;">{{replyContent}}</p>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background-color:#4F46E5;border-radius:6px;padding:14px 32px;text-align:center;">
      <a href="{{ticketUrl}}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">View Full Conversation</a>
    </td></tr>
    </table>
    <p style="font-size:14px;line-height:1.6;color:#666666;margin:24px 0 0;">If you need further assistance, feel free to reply to this ticket directly from your dashboard.</p>
  </td></tr>
  <tr><td style="background-color:#f8f8fa;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:#999999;margin:0;">Nyife - WhatsApp Marketing Platform</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        text_body: `Hi {{name}},

We have replied to your support ticket #{{ticketId}}.

Reply:
{{replyContent}}

View full conversation: {{ticketUrl}}

If you need further assistance, feel free to reply to this ticket directly from your dashboard.

- The Nyife Team`,

        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'team_invite',
        subject: "You've been invited to join {{organizationName}}",
        html_body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Team Invitation</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f7;color:#333333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background-color:#4F46E5;padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">Team Invitation</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi,</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;"><strong>{{inviterName}}</strong> has invited you to join <strong>{{organizationName}}</strong> on Nyife as a team member.</p>
    <div style="background-color:#f0f0ff;border-radius:6px;padding:20px;margin:0 0 24px;text-align:center;">
      <p style="font-size:14px;color:#666666;margin:0 0 4px;">Your Role</p>
      <p style="font-size:18px;font-weight:bold;color:#4F46E5;margin:0;">{{role}}</p>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background-color:#4F46E5;border-radius:6px;padding:14px 32px;text-align:center;">
      <a href="{{inviteUrl}}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">Accept Invitation</a>
    </td></tr>
    </table>
    <p style="font-size:14px;line-height:1.6;color:#666666;margin:24px 0 0;">This invitation will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.</p>
    <p style="font-size:13px;line-height:1.6;color:#999999;margin:16px 0 0;">If the button does not work, copy and paste this link into your browser:<br><a href="{{inviteUrl}}" style="color:#4F46E5;">{{inviteUrl}}</a></p>
  </td></tr>
  <tr><td style="background-color:#f8f8fa;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:#999999;margin:0;">Nyife - WhatsApp Marketing Platform</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        text_body: `Hi,

{{inviterName}} has invited you to join {{organizationName}} on Nyife as a team member.

Your Role: {{role}}

Accept the invitation: {{inviteUrl}}

This invitation will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.

- The Nyife Team`,

        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'sub_admin_invite',
        subject: "You've been invited to join Nyife admin",
        html_body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Invitation</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f7;color:#333333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background-color:#b91c1c;padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">Admin Invitation</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{firstName}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">You have been invited to join <strong>Nyife</strong> as a sub-admin.</p>
    <div style="background-color:#fff1f2;border-radius:6px;padding:20px;margin:0 0 24px;text-align:center;">
      <p style="font-size:14px;color:#666666;margin:0 0 4px;">Assigned Role</p>
      <p style="font-size:18px;font-weight:bold;color:#b91c1c;margin:0;">{{role}}</p>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background-color:#b91c1c;border-radius:6px;padding:14px 32px;text-align:center;">
      <a href="{{inviteUrl}}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">Accept Invitation</a>
    </td></tr>
    </table>
    <p style="font-size:14px;line-height:1.6;color:#666666;margin:24px 0 0;">This invitation will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.</p>
    <p style="font-size:13px;line-height:1.6;color:#999999;margin:16px 0 0;">If the button does not work, copy and paste this link into your browser:<br><a href="{{inviteUrl}}" style="color:#b91c1c;">{{inviteUrl}}</a></p>
  </td></tr>
  <tr><td style="background-color:#f8f8fa;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:#999999;margin:0;">Nyife Admin Console</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        text_body: `Hi {{firstName}},

You have been invited to join Nyife as a sub-admin.

Assigned Role: {{role}}

Accept the invitation: {{inviteUrl}}

This invitation will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.

- The Nyife Team`,

        is_active: true,
        created_at: now,
        updated_at: now,
      },
  ];
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const templates = buildCoreEmailTemplates(now);

    await queryInterface.bulkInsert('email_templates', templates);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('email_templates', null, {});
  },
};

module.exports.buildCoreEmailTemplates = buildCoreEmailTemplates;
