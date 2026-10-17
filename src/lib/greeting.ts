/**
 * user-profile (iteration 8, design D9): "Hallo <Anzeigename>" only on the first page after signing in. The browser
 * remembers in a cookie which sign-in (its time) was greeted; a new sign-in has a new time and is greeted again.
 */
export const GREETED_COOKIE = 'pt_greeted';

export const shouldGreet = (cookie: string | undefined, authTime: number | undefined) =>
  !!authTime && cookie !== String(authTime);
