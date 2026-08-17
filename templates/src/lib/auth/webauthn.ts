import { RP_NAME } from "./config";

/** Derive the WebAuthn Relying Party id + expected origin from the request. */
export function getRP(request: Request): { rpID: string; origin: string; rpName: string } {
  const envRpId = process.env.AUTH_RP_ID;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    new URL(request.url).protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host;
  const rpID = envRpId ?? host.split(":")[0];
  const origin = `${proto}://${host}`;
  return { rpID, origin, rpName: RP_NAME };
}

export function toB64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(s, "base64url");
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}

/**
 * A human label for a freshly registered passkey — derived, never asked for.
 * "iPhone · Safari", "Mac · Chrome", "Windows Hello", "Security key", …
 * Good enough to tell two passkeys apart in a list; not an identity claim.
 */
export function deviceLabelFromRequest(
  request: Request,
  attachment?: "platform" | "cross-platform" | null
): string {
  const ua = request.headers.get("user-agent") ?? "";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /CrOS/.test(ua)
              ? "Chromebook"
              : /Linux/.test(ua)
                ? "Linux"
                : "Device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua) && !/Chromium/.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  if (attachment === "cross-platform") return `Security key · ${os}`;
  if (os === "Windows" && attachment === "platform") return "Windows Hello";
  return browser ? `${os} · ${browser}` : os;
}
