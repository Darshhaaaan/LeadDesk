import { escapeHtml, paragraph, renderEmailLayout, renderEmailText } from '../layout';
import type { EmailBrand, RenderedEmail } from '../types';

export interface AccountDeletedEmailData {
  brand: EmailBrand;
  deletedAt: Date;
  registerUrl: string;
}

const formatUtc = (date: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date) + ' UTC';

export const renderAccountDeletedEmail = ({
  brand,
  deletedAt,
  registerUrl,
}: AccountDeletedEmailData): RenderedEmail => {
  const subject = `Your ${brand.appName} account has been deleted`;
  const when = formatUtc(deletedAt);

  const html = renderEmailLayout({
    brand,
    preheader: `Your account and its associated data were permanently deleted on ${when}.`,
    heading: 'Your account has been deleted',
    contentHtml: [
      paragraph('Hello,'),
      paragraph(
        `The ${escapeHtml(brand.appName)} account associated with this email address was permanently deleted on <strong>${escapeHtml(when)}</strong>.`
      ),
      paragraph(
        'Your leads, notes, follow-up dates, and account profile were removed. Password reset links were invalidated, and any signed-in sessions can no longer access the account.'
      ),
      paragraph('This action cannot be undone. If you would like to use the service again, you can create a new account.'),
    ].join(''),
    ctaLabel: 'Create a new account',
    ctaUrl: registerUrl,
    securityNote:
      'If you did not request this deletion, contact support immediately. Do not reuse your previous password if you believe it was compromised.',
  });

  const text = renderEmailText({
    brand,
    heading: 'Your account has been deleted',
    bodyLines: [
      'Hello,',
      '',
      `The ${brand.appName} account associated with this email address was permanently deleted on ${when}.`,
      '',
      'Your leads, notes, follow-up dates, and account profile were removed. Password reset links were invalidated, and any signed-in sessions can no longer access the account.',
      '',
      'This action cannot be undone. If you would like to use the service again, you can create a new account.',
    ],
    action: { label: 'Create a new account', url: registerUrl },
    securityNote:
      'If you did not request this deletion, contact support immediately. Do not reuse your previous password if you believe it was compromised.',
  });

  return { subject, html, text };
};
