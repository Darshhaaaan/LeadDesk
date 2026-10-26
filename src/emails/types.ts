export interface EmailBrand {
  appName: string;
  supportEmail?: string;
  frontendUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
