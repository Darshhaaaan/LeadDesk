const NOTICE_KEY = 'leadapp:auth-notice';

export const setAuthNotice = (message: string): void => {
  try {
    sessionStorage.setItem(NOTICE_KEY, message);
  } catch {
    // Storage can be unavailable in hardened browsers; the notice is optional.
  }
};

export const consumeAuthNotice = (): string | null => {
  try {
    const message = sessionStorage.getItem(NOTICE_KEY);
    if (message) {
      sessionStorage.removeItem(NOTICE_KEY);
    }
    return message;
  } catch {
    return null;
  }
};
