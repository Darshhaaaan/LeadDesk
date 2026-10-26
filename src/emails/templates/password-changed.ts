import { escapeHtml, paragraph, renderEmailLayout, renderEmailText } from '../layout';
import type { EmailBrand, RenderedEmail } from '../types';

export interface PasswordChangedEmailData {
  brand: EmailBrand;
  name: string;
  changedAt: Date;
  securityUrl: string;
  wasReset?: boolean;
}

const formatUtc = (date: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date) + ' UTC';

export const renderPasswordChangedEmail = ({
  brand,
  name,
  changedAt,
  securityUrl,
  wasReset = false,
}: PasswordChangedEmailData): RenderedEmail => {
  const safeName = escapeHtml(name);
  const changeLabel = wasReset ? 'reset' : 'changed';
  const subject = `Your ${brand.appName} password was ${changeLabel}`;
  const when = formatUtc(changedAt);

  const html = renderEmailLayout({
    brand,
    preheader: `Your password was ${changeLabel} on ${when}.`,
    heading: `Your password was ${changeLabel}`,
    contentHtml: [
      paragraph(`Hi ${safeName},`),
      paragraph(
        `The password for your ${escapeHtml(brand.appName)} account was ${changeLabel} on <strong>${escapeHtml(when)}</strong>. All existing sessions were signed out for your security.`
      ),
      paragraph('If you made this change, no further action is needed.'),
    ].join(''),
    ctaLabel: 'Review account security',
    ctaUrl: securityUrl,
    securityNote:
      'If you did not make this change, reset your password immediately using "Forgot password" on the sign-in page and contact support. Do not reuse this password on other sites.',
  });

  const text = renderEmailText({
    brand,
    heading: `Your password was ${changeLabel}`,
    bodyLines: [
      `Hi ${name},`,
      '',
      `The password for your ${brand.appName} account was ${changeLabel} on ${when}. All existing sessions were signed out for your security.`,
      '',
      'If you made this change, no further action is needed.',
    ],
    action: { label: 'Review account security', url: securityUrl },
    securityNote:
      'If you did not make this change, reset your password immediately using "Forgot password" on the sign-in page and contact support. Do not reuse this password on other sites.',
  });

  return { subject, html, text };
};
