// ---------------------------------------------------------------------------
// Shared email chrome — one branded table-based shell every auth email reuses
// (sign-in link, invite/welcome, waitlist receipt, waitlist approval).
// Edit BRAND, not this markup. Inline styles only: no <style>, no flexbox.
// ---------------------------------------------------------------------------

import { BRAND } from "./brand";
import { SITE_URL } from "./config";

export function logoSrc(): string {
  const u = BRAND.email.logoUrl;
  return u.startsWith("http") ? u : `${SITE_URL}${u}`;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ShellOptions {
  /** Hidden inbox-preview line. */
  preheader: string;
  title: string;
  heading: string;
  /** Paragraph HTML for the body (use `p()` below). */
  body: string;
  cta?: { label: string; url: string };
  /** Shown under the button as a copy-pasteable URL. */
  altUrl?: string;
  /** Small pill above the heading, e.g. "Invitation" or "10 seats". */
  badge?: string;
  /** Fine print above the footer rule. */
  footnote?: string;
}

export function p(html: string): string {
  const c = BRAND.email;
  return `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${c.body};">${html}</p>`;
}

export function emailShell(o: ShellOptions): string {
  const c = BRAND.email;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:${c.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.bg};padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${c.card};border:1px solid ${c.line};border-radius:16px;overflow:hidden;">
    <tr><td style="height:4px;background:${c.accent};"></td></tr>
    <tr><td style="padding:32px 36px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px;vertical-align:middle;">
          <img src="${logoSrc()}" width="44" height="44" alt="" style="display:block;border-radius:${c.logoRadius}px;">
        </td>
        <td style="vertical-align:middle;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;letter-spacing:0.5px;color:${c.ink};">${esc(BRAND.appName.toUpperCase())}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${c.accent};">${esc(BRAND.tagline)}</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:18px 36px 0;">
      ${
        o.badge
          ? `<div style="display:inline-block;margin:0 0 10px;padding:4px 10px;border:1px solid ${c.line};border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${c.accent};">${esc(o.badge)}</div>`
          : ""
      }
      <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:${c.ink};">${esc(o.heading)}</h1>
      ${o.body}
    </td></tr>
    ${
      o.cta
        ? `<tr><td style="padding:6px 36px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="border-radius:10px;background:${c.ink};">
        <a href="${o.cta.url}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
          ${esc(o.cta.label)} &nbsp;&rarr;
        </a>
      </td></tr></table>
    </td></tr>`
        : ""
    }
    ${
      o.altUrl
        ? `<tr><td style="padding:18px 36px 0;">
      <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${c.muted};">Or paste this link into your browser:</p>
      <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;line-height:1.5;color:${c.accent};word-break:break-all;">${o.altUrl}</p>
    </td></tr>`
        : ""
    }
    <tr><td style="padding:26px 36px 30px;">
      <hr style="border:none;border-top:1px solid ${c.line};margin:0 0 16px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${c.muted};">
        ${o.footnote ?? "If you didn&rsquo;t expect this email, you can safely ignore it."}
      </p>
    </td></tr>
  </table>
  <p style="max-width:480px;margin:16px auto 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${c.muted};text-align:center;">
    ${esc(BRAND.footerNote)} &middot; A ${esc(BRAND.product)} product
  </p>
</td></tr>
</table>
</body></html>`;
}

/** A boxed access code / key, monospaced and selectable. */
export function codeBlock(code: string): string {
  const c = BRAND.email;
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;"><tr>
    <td align="center" style="padding:14px 12px;border:1px dashed ${c.line};border-radius:12px;background:${c.bg};">
      <span style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;letter-spacing:3px;color:${c.ink};">${esc(code)}</span>
    </td></tr></table>`;
}
