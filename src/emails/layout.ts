/**
 * Shared, table-based email layout.
 *
 * Email clients are deliberately conservative: this layout uses tables,
 * inline styles, web-safe fonts, and a max-width of 600px. A small style block
 * adds mobile spacing and dark-mode overrides (with !important so it can
 * override inline colors in supporting clients).
 */

import type { EmailBrand } from './types';

export type { EmailBrand } from './types';

export interface EmailLayoutOptions {
  brand: EmailBrand;
  preheader: string;
  heading: string;
  contentHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryText?: string;
  securityNote?: string;
}

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const footerSupport = (brand: EmailBrand): string => {
  if (!brand.supportEmail) {
    return 'Need help? Contact our support team.';
  }

  const email = escapeHtml(brand.supportEmail);
  return `Need help? Contact us at <a class="email-link" href="mailto:${email}" style="color:#4f46e5;text-decoration:underline;">${email}</a>.`;
};

export const renderEmailLayout = (options: EmailLayoutOptions): string => {
  const { brand } = options;
  const year = new Date().getUTCFullYear();
  const appName = escapeHtml(brand.appName);

  const cta =
    options.ctaLabel && options.ctaUrl
      ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;">
                <tr>
                  <td align="center" bgcolor="#4f46e5" style="border-radius:8px;">
                    <a href="${escapeHtml(options.ctaUrl)}" style="display:inline-block;padding:14px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">
                      ${escapeHtml(options.ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>`
      : '';

  const secondary = options.secondaryText
    ? `<p class="email-muted" style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#64748b;">${options.secondaryText}</p>`
    : '';

  const securityNote = options.securityNote
    ? `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-note-box" style="margin:24px 0 0;background-color:#f8fafc;border-left:4px solid #cbd5e1;border-radius:4px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p class="email-muted" style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#475569;">${options.securityNote}</p>
                  </td>
                </tr>
              </table>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(options.heading)}</title>
    <!--[if mso]>
    <style type="text/css">
      body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
    </style>
    <![endif]-->
    <style type="text/css">
      body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
      table { border-collapse: collapse; }
      img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      @media only screen and (max-width: 620px) {
        .email-card { width: 100% !important; }
        .email-pad { padding-left: 22px !important; padding-right: 22px !important; }
        .email-heading { font-size: 23px !important; line-height: 30px !important; }
      }
      @media (prefers-color-scheme: dark) {
        .email-bg { background-color: #0b1220 !important; }
        .email-card { background-color: #111827 !important; }
        .email-header { background-color: #312e81 !important; }
        .email-heading, .email-brand { color: #f8fafc !important; }
        .email-text { color: #cbd5e1 !important; }
        .email-muted, .email-footer { color: #94a3b8 !important; }
        .email-note-box { background-color: #1e293b !important; border-left-color: #475569 !important; }
        .email-link { color: #a5b4fc !important; }
        .email-divider { border-color: #1f2937 !important; }
      }
    </style>
  </head>
  <body class="email-bg" style="margin:0;padding:0;background-color:#eef2ff;">
    <div style="display:none;font-size:1px;color:#eef2ff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
      ${escapeHtml(options.preheader)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-bg" bgcolor="#eef2ff" style="background-color:#eef2ff;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="email-card" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
            <tr>
              <td class="email-header" bgcolor="#4f46e5" style="background-color:#4f46e5;padding:22px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="email-brand" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:19px;font-weight:700;letter-spacing:-0.2px;color:#ffffff;">
                      ${appName}
                    </td>
                    <td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#c7d2fe;">
                      Notifications
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:36px 32px 30px;">
                <h1 class="email-heading" style="margin:0 0 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;line-height:34px;font-weight:700;color:#0f172a;">
                  ${escapeHtml(options.heading)}
                </h1>
                <div class="email-text" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:26px;color:#334155;">
                  ${options.contentHtml}
                </div>
                ${cta}
                ${secondary}
                ${securityNote}
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:0 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr><td class="email-divider" style="border-top:1px solid #e2e8f0;font-size:0;line-height:0;">&nbsp;</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:24px 32px 30px;">
                <p class="email-footer" style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#64748b;">
                  ${footerSupport(brand)}
                </p>
                <p class="email-footer" style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:19px;color:#94a3b8;">
                  This is a transactional message from ${appName}. Please do not reply directly to this email.
                </p>
                <p class="email-footer" style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:19px;color:#94a3b8;">
                  &copy; ${year} ${appName}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

export interface EmailTextOptions {
  brand: EmailBrand;
  heading: string;
  bodyLines: string[];
  action?: { label: string; url: string };
  securityNote?: string;
}

export const renderEmailText = (options: EmailTextOptions): string => {
  const lines = [
    options.heading,
    '',
    ...options.bodyLines,
    '',
  ];

  if (options.action) {
    lines.push(`${options.action.label}: ${options.action.url}`, '');
  }

  if (options.securityNote) {
    lines.push(options.securityNote, '');
  }

  if (options.brand.supportEmail) {
    lines.push(`Need help? Contact ${options.brand.supportEmail}.`);
  } else {
    lines.push('Need help? Contact our support team.');
  }

  lines.push(
    '',
    `This is a transactional message from ${options.brand.appName}. Please do not reply directly to this email.`,
    `(c) ${new Date().getUTCFullYear()} ${options.brand.appName}. All rights reserved.`
  );

  return lines.join('\n');
};

export const paragraph = (html: string): string =>
  `<p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:26px;color:#334155;">${html}</p>`;

export const mutedParagraph = (html: string): string =>
  `<p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#64748b;">${html}</p>`;
