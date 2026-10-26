import { escapeHtml, paragraph, renderEmailLayout, renderEmailText } from '../layout.ts';
import type { EmailBrand, RenderedEmail } from '../types.ts';

export interface PasswordResetEmailData {
  brand: EmailBrand;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export const renderPasswordResetEmail = ({
  brand,
  name,
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmailData): RenderedEmail => {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);
  const subject = `Reset your ${brand.appName} password`;

  const html = renderEmailLayout({
    brand,
    preheader: `Use this secure link within ${expiresInMinutes} minutes to reset your password.`,
    heading: 'Reset your password',
    contentHtml: [
      paragraph(`Hi ${safeName},`),
      paragraph(
        `We received a request to reset the password for your ${escapeHtml(brand.appName)} account. This link expires in ${expiresInMinutes} minutes and can only be used once.`
      ),
    ].join(''),
    ctaLabel: 'Reset password',
    ctaUrl: resetUrl,
    secondaryText: `If the button does not work, copy and paste this secure link into your browser:<br /><a class="email-link" href="${safeUrl}" style="color:#4f46e5;word-break:break-all;text-decoration:underline;">${safeUrl}</a>`,
    securityNote:
      'If you did not request this reset, you can safely ignore this email. Your password will not change. If you receive repeated reset emails you did not request, contact support.',
  });

  const text = renderEmailText({
    brand,
    heading: 'Reset your password',
    bodyLines: [
      `Hi ${name},`,
      '',
      `We received a request to reset the password for your ${brand.appName} account. This link expires in ${expiresInMinutes} minutes and can only be used once.`,
    ],
    action: { label: 'Reset password', url: resetUrl },
    securityNote:
      'If you did not request this reset, you can safely ignore this email. Your password will not change. If you receive repeated reset emails you did not request, contact support.',
  });

  return { subject, html, text };
};
