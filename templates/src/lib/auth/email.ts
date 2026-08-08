import { Resend } from "resend";
import { resendConfig, MAGIC_TTL_MIN } from "./config";
import { BRAND } from "./brand";
import { emailShell, p, esc } from "./email-shell";

let resend: Resend | null = null;
function client(): Resend {
  if (!resend) resend = new Resend(resendConfig().apiKey);
  return resend;
}

/** Send through the project's Resend key. Every auth email funnels through here. */
export async function send(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<void> {
  const { from } = resendConfig();
  const { error } = await client().emails.send({
    from,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
  });
  if (error) throw new Error(`Resend: ${error.message ?? "send failed"}`);
}

// Export for previewing in a browser — see reference/email-design.md.
export function magicLinkHtml(url: string): string {
  return emailShell({
    preheader: `Your secure sign-in link for ${BRAND.appName} — expires in ${MAGIC_TTL_MIN} minutes.`,
    title: `Sign in to ${BRAND.appName}`,
    heading: "Your sign-in link",
    body: p(
      `Tap the button below to sign in to ${esc(BRAND.appName)}. This link expires in ${MAGIC_TTL_MIN} minutes and can be used once.`
    ),
    cta: { label: `Sign in to ${BRAND.appName}`, url },
    altUrl: url,
    footnote:
      "If you didn&rsquo;t request this, you can safely ignore this email — no one can sign in without the link.",
  });
}

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  await send({
    to,
    subject: `Your sign-in link for ${BRAND.appName}`,
    html: magicLinkHtml(url),
    text: `Sign in to ${BRAND.appName}.\n\nOpen this link (expires in ${MAGIC_TTL_MIN} minutes, single use):\n${url}\n\nIf you didn't request this, ignore this email.`,
  });
}
