import { escapeHtml, paragraph, renderEmailLayout, renderEmailText } from '../layout';
import type { EmailBrand, RenderedEmail } from '../types';

export interface WelcomeEmailData {
  brand: EmailBrand;
  name: string;
  dashboardUrl: string;
}

export const renderWelcomeEmail = ({ brand, name, dashboardUrl }: WelcomeEmailData): RenderedEmail => {
  const safeName = escapeHtml(name);
  const subject = `Welcome to ${brand.appName}`;

  const html = renderEmailLayout({
    brand,
    preheader: `Your ${brand.appName} account is ready.`,
    heading: `Welcome aboard, ${safeName}`,
    contentHtml: [
      paragraph(`Hi ${safeName},`),
      paragraph(
        `Your ${escapeHtml(brand.appName)} account is ready. Use your dashboard to add leads, track their status, and keep follow-ups from slipping through the cracks.`
      ),
      paragraph(
        'A good first step is to add your active prospects, set a follow-up date, and update each lead as the conversation progresses.'
      ),
    ].join(''),
    ctaLabel: 'Open your dashboard',
    ctaUrl: dashboardUrl,
    secondaryText: 'If the button does not work, paste the dashboard URL from this email into your browser.',
    securityNote:
      'If you did not create this account, contact support immediately. Never share your password or email links with anyone.',
  });

  const text = renderEmailText({
    brand,
    heading: `Welcome aboard, ${name}`,
    bodyLines: [
      `Hi ${name},`,
      '',
      `Your ${brand.appName} account is ready. Use your dashboard to add leads, track their status, and keep follow-ups from slipping through the cracks.`,
      '',
      'A good first step is to add your active prospects, set a follow-up date, and update each lead as the conversation progresses.',
    ],
    action: { label: 'Open your dashboard', url: dashboardUrl },
    securityNote:
      'If you did not create this account, contact support immediately. Never share your password or email links with anyone.',
  });

  return { subject, html, text };
};
