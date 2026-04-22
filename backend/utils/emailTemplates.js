'use strict';

const SITE_NAME = 'Husn-ul-Tilawat';

/**
 * Minimal table-based layout for Gmail compatibility; no external assets.
 */
function baseWrapper({ title, bodyHtml, footerNote }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px 28px;text-align:center;border-bottom:1px solid #e4e4e7;">
              <p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#b45309;font-weight:600;">${escapeHtml(SITE_NAME)}</p>
              <h1 style="margin:12px 0 0 0;font-size:20px;color:#18181b;font-weight:700;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;color:#3f3f46;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;">${footerNote}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function verificationEmailHtml(code) {
  const c = escapeHtml(code);
  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Thank you for signing up. Use the verification code below to activate your account:</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding:20px 16px;background:#fafaf9;border:1px dashed #d4d4d8;border-radius:6px;">
          <span style="font-size:28px;font-weight:700;letter-spacing:0.25em;font-family:ui-monospace,monospace;color:#14532d;">${c}</span>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0 0;">This code expires in <strong>15 minutes</strong>. Do not share it with anyone.</p>
    <p style="margin:16px 0 0 0;font-size:13px;color:#71717a;">If you did not create an account with ${escapeHtml(SITE_NAME)}, you can safely ignore this email.</p>
  `;
  const footerNote =
    'Security note: Husn-ul-Tilawat staff will never ask you for this code. Never share it in chat or over the phone.';
  return baseWrapper({
    title: 'Verify your email',
    bodyHtml,
    footerNote,
  });
}

function passwordResetEmailHtml(code) {
  const c = escapeHtml(code);
  const bodyHtml = `
    <p style="margin:0 0 16px 0;">We received a request to reset your password. Use the code below:</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding:20px 16px;background:#fafaf9;border:1px dashed #d4d4d8;border-radius:6px;">
          <span style="font-size:28px;font-weight:700;letter-spacing:0.25em;font-family:ui-monospace,monospace;color:#991b1b;">${c}</span>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0 0;">This code expires in <strong>15 minutes</strong>. After it expires, request a new reset from the login page.</p>
    <p style="margin:16px 0 0 0;font-size:13px;color:#71717a;">If you did not request a password reset, ignore this email — your password will stay the same.</p>
  `;
  const footerNote =
    'Security note: If you did not request this, consider changing your password after logging in and ensure your email account is secure.';
  return baseWrapper({
    title: 'Reset your password',
    bodyHtml,
    footerNote,
  });
}

module.exports = {
  SITE_NAME,
  verificationEmailHtml,
  passwordResetEmailHtml,
};
