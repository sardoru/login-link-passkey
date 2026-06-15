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
