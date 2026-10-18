/**
 * access-control: the browser remembers the last Entra sign-in address so Microsoft can skip the account picker
 * (login_hint). Only an address, never a token; "Anderes Konto" removes it and shows the picker again.
 */
export const LOGIN_HINT_COOKIE = 'pt_login_hint';
export const LOGIN_HINT_MAX_AGE = 365 * 24 * 60 * 60;

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export const loginHintFrom = (value: string | undefined) => {
  const v = value?.trim().toLowerCase();
  return v && v.length <= 254 && EMAIL.test(v) ? v : undefined;
};
