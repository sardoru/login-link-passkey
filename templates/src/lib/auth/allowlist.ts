import { allowedEmails } from "./config";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

/** True if the email may sign in. An empty allow-list means open access. */
export function isEmailAllowed(email: string): boolean {
  const list = allowedEmails();
  if (list.length === 0) return true;
  return list.includes(normalizeEmail(email));
}
