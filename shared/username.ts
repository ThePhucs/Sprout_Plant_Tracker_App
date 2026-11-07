// Supabase accounts need an email; users only ever see the username part.
export const EMAIL_DOMAIN = 'sprout.local';

export const normalizeUsername = (raw: string) => raw.trim().toLowerCase();

export const isValidUsername = (u: string) => /^[a-z0-9_]{3,20}$/.test(u);

export const usernameToEmail = (u: string) => `${normalizeUsername(u)}@${EMAIL_DOMAIN}`;
