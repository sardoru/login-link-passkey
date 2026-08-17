// Invite / welcome / waitlist emails. All sent with the project's Resend key
// (RESEND_API_KEY) from AUTH_EMAIL_FROM, on the shared branded shell.

import { BRAND } from "./brand";
import { INVITE_TTL_DAYS, MAGIC_TTL_MIN } from "./config";
import { emailShell, p, esc, codeBlock } from "./email-shell";
import { send } from "./email";

const days = () => `${INVITE_TTL_DAYS} day${INVITE_TTL_DAYS === 1 ? "" : "s"}`;

function greeting(name?: string | null): string {
  return name ? `Hi ${esc(name.split(" ")[0])} —` : "Hi —";
}

// ── Invite / welcome ────────────────────────────────────────────────────────

export function inviteHtml(o: {
  url: string;
  name?: string | null;
  inviterName?: string | null;
  roleLabel?: string | null;
}): string {
  const from = o.inviterName ? `${esc(o.inviterName)} invited you` : "You've been invited";
  return emailShell({
    preheader: `${from} to ${BRAND.appName}. Your invitation expires in ${days()}.`,
    title: `You're invited to ${BRAND.appName}`,
    heading: `Welcome to ${BRAND.appName}`,
    badge: "Invitation",
    body:
      p(`${greeting(o.name)} ${from} to join <strong>${esc(BRAND.appName)}</strong>${
        o.roleLabel ? ` as <strong>${esc(o.roleLabel)}</strong>` : ""
      }.`) +
      p(
        `Accept below to set up your account. No password to choose — you'll sign in with a secure link or a passkey (Face ID / Touch ID) from then on.`
      ) +
      p(
        `<span style="color:${BRAND.email.muted};font-size:13px;">This invitation expires in ${days()} and can be used once.</span>`
      ),
    cta: { label: "Accept your invitation", url: o.url },
    altUrl: o.url,
    footnote: `If this wasn&rsquo;t meant for you, you can ignore this email — the invitation expires on its own.`,
  });
}

export async function sendInviteEmail(o: {
  to: string;
  url: string;
  name?: string | null;
  inviterName?: string | null;
  roleLabel?: string | null;
}): Promise<void> {
  await send({
    to: o.to,
    subject: `You're invited to ${BRAND.appName}`,
    html: inviteHtml(o),
    text: `${o.inviterName ? `${o.inviterName} invited you` : "You've been invited"} to join ${BRAND.appName}${
      o.roleLabel ? ` as ${o.roleLabel}` : ""
    }.

Accept your invitation (expires in ${days()}, single use):
${o.url}

No password needed — you'll sign in with a secure link or a passkey.`,
  });
}

// ── Passkey setup (admin-initiated) ─────────────────────────────────────────

export function passkeySetupHtml(o: {
  url: string;
  name?: string | null;
  inviterName?: string | null;
}): string {
  const who = o.inviterName ? `${esc(o.inviterName)} asked you` : "You've been asked";
  return emailShell({
    preheader: `Add a passkey to ${BRAND.appName} — Face ID / Touch ID instead of email links.`,
    title: `Set up a passkey for ${BRAND.appName}`,
    heading: "Add a passkey",
    badge: "Passkey",
    body:
      p(`${greeting(o.name)} ${who} to add a <strong>passkey</strong> to your ${esc(BRAND.appName)} account.`) +
      p(
        `Open the link below <strong>on the device you want to sign in from</strong>. It signs you in, then offers a one-tap prompt to save a passkey with Face ID, Touch ID, or Windows Hello. No password, no device name to type.`
      ) +
      p(
        `<span style="color:${BRAND.email.muted};font-size:13px;">The link expires in ${MAGIC_TTL_MIN} minutes and can be used once. You can add more passkeys later from your account menu.</span>`
      ),
    cta: { label: "Sign in & add a passkey", url: o.url },
    altUrl: o.url,
    footnote: `If you weren&rsquo;t expecting this, you can ignore it — nothing changes on your account until you open the link.`,
  });
}

export async function sendPasskeySetupEmail(o: {
  to: string;
  url: string;
  name?: string | null;
  inviterName?: string | null;
}): Promise<void> {
  await send({
    to: o.to,
    subject: `Set up a passkey for ${BRAND.appName}`,
    html: passkeySetupHtml(o),
    text: `${o.inviterName ? `${o.inviterName} asked you` : "You've been asked"} to add a passkey to your ${BRAND.appName} account.

Open this link on the device you want to sign in from (expires in ${MAGIC_TTL_MIN} minutes, single use):
${o.url}

It signs you in and then offers a one-tap prompt to save a passkey (Face ID / Touch ID / Windows Hello).`,
  });
}

// ── Access code ─────────────────────────────────────────────────────────────

export function accessCodeHtml(o: {
  code: string;
  joinUrl: string;
  name?: string | null;
  roleLabel?: string | null;
}): string {
  return emailShell({
    preheader: `Your access code for ${BRAND.appName}: ${o.code}`,
    title: `Your ${BRAND.appName} access code`,
    heading: `Your access code`,
    badge: "Access code",
    body:
      p(`${greeting(o.name)} use this code to create your ${esc(BRAND.appName)} account.`) +
      codeBlock(o.code) +
      p(`Enter it on the join page along with your email — we'll verify your address and let you in.`),
    cta: { label: "Redeem your code", url: o.joinUrl },
    altUrl: o.joinUrl,
  });
}

export async function sendAccessCodeEmail(o: {
  to: string;
  code: string;
  joinUrl: string;
  name?: string | null;
}): Promise<void> {
  await send({
    to: o.to,
    subject: `Your access code for ${BRAND.appName}`,
    html: accessCodeHtml(o),
    text: `Your access code for ${BRAND.appName}: ${o.code}\n\nRedeem it here: ${o.joinUrl}`,
  });
}

// ── Waitlist ────────────────────────────────────────────────────────────────

export async function sendWaitlistReceiptEmail(o: {
  to: string;
  name?: string | null;
}): Promise<void> {
  const html = emailShell({
    preheader: `You're on the ${BRAND.appName} waitlist.`,
    title: `You're on the list`,
    heading: "You're on the list",
    badge: "Waitlist",
    body:
      p(`${greeting(o.name)} thanks for requesting access to <strong>${esc(BRAND.appName)}</strong>.`) +
      p(`We review requests as seats open up. You'll get an invitation by email the moment yours is approved — nothing else to do for now.`),
    footnote: "Didn&rsquo;t request access? Ignore this email and you won&rsquo;t hear from us again.",
  });
  await send({
    to: o.to,
    subject: `You're on the ${BRAND.appName} waitlist`,
    html,
    text: `Thanks for requesting access to ${BRAND.appName}. We'll email you an invitation when a seat opens up.`,
  });
}
