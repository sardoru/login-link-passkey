import { Resend } from "resend";
import { resendConfig, SITE_URL, MAGIC_TTL_MIN } from "./config";
import { BRAND } from "./brand";

let resend: Resend | null = null;
function client(): Resend {
  if (!resend) resend = new Resend(resendConfig().apiKey);
  return resend;
}

function logoSrc(): string {
  const u = BRAND.email.logoUrl;
  return u.startsWith("http") ? u : `${SITE_URL}${u}`;
}

// Table-based, inline styles — the layout email clients actually render.
// Edit BRAND (name/tagline/colors/logo) rather than this markup.
function magicLinkHtml(url: string): string {
  const c = BRAND.email;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light"><title>Sign in to ${BRAND.appName}</title></head>
<body style="margin:0;padding:0;background:${c.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your secure sign-in link for ${BRAND.appName} — expires in ${MAGIC_TTL_MIN} minutes.</div>
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
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;letter-spacing:0.5px;color:${c.ink};">${BRAND.appName.toUpperCase()}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${c.accent};">${BRAND.tagline}</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:18px 36px 0;">
      <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;color:${c.ink};">Your sign-in link</h1>
      <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${c.body};">
        Tap the button below to sign in to ${BRAND.appName}. This link expires in
        ${MAGIC_TTL_MIN} minutes and can be used once.
      </p>
    </td></tr>
    <tr><td style="padding:0 36px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="border-radius:10px;background:${c.ink};">
        <a href="${url}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
          Sign in to ${BRAND.appName} &nbsp;&rarr;
        </a>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:18px 36px 0;">
      <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${c.muted};">Or paste this link into your browser:</p>
      <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;line-height:1.5;color:${c.accent};word-break:break-all;">${url}</p>
    </td></tr>
    <tr><td style="padding:26px 36px 30px;">
      <hr style="border:none;border-top:1px solid ${c.line};margin:0 0 16px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${c.muted};">
        If you didn&rsquo;t request this, you can safely ignore this email — no one can sign in without the link.
      </p>
    </td></tr>
  </table>
  <p style="max-width:480px;margin:16px auto 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${c.muted};text-align:center;">
    ${BRAND.footerNote} · A ${BRAND.product} product
  </p>
</td></tr>
</table>
</body></html>`;
}

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  const { from } = resendConfig();
  const { error } = await client().emails.send({
    from,
    to,
    subject: `Your sign-in link for ${BRAND.appName}`,
    html: magicLinkHtml(url),
    text: `Sign in to ${BRAND.appName}.\n\nOpen this link (expires in ${MAGIC_TTL_MIN} minutes, single use):\n${url}\n\nIf you didn't request this, ignore this email.`,
  });
  if (error) throw new Error(`Resend: ${error.message ?? "send failed"}`);
}
