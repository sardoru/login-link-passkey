// ---------------------------------------------------------------------------
// WebAuthn registration ceremony, shared by the self-service route
// (/api/auth/passkey/register/*) and the admin on-behalf route
// (/api/admin/users/[id]/passkeys/*). Server-only.
// ---------------------------------------------------------------------------

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/server";
import { createPasskey, listPasskeys, type AuthUser } from "./db";
import { getRP, toB64url, deviceLabelFromRequest } from "./webauthn";

/** Options for registering a new passkey for `user`, excluding ones they already hold. */
export async function registrationOptionsFor(
  req: Request,
  user: Pick<AuthUser, "id" | "email">
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpID, rpName } = getRP(req);
  const existing = await listPasskeys(user.id);
  return generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: p.credential_id,
      transports: p.transports
        ? (p.transports.split(",") as AuthenticatorTransportFuture[])
        : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
}

/**
 * Verify the browser's attestation and persist the credential for `userId`.
 * Throws on any verification failure; the caller maps that to a 400.
 */
export async function finishRegistration(o: {
  req: Request;
  response: unknown;
  expectedChallenge: string;
  userId: string;
  /** Admin who enrolled it on the user's behalf; omit for self-enrolment. */
  createdBy?: string | null;
}): Promise<{ label: string }> {
  const { rpID, origin } = getRP(o.req);
  const verification = await verifyRegistrationResponse({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response: o.response as any,
    expectedChallenge: o.expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Could not verify passkey.");
  }
  const info = verification.registrationInfo;
  const cred = info.credential;
  const attachment = (o.response as { authenticatorAttachment?: string } | null)
    ?.authenticatorAttachment;
  const label = deviceLabelFromRequest(
    o.req,
    attachment === "platform" || attachment === "cross-platform" ? attachment : null
  );

  await createPasskey({
    userId: o.userId,
    credentialId: cred.id,
    publicKey: toB64url(cred.publicKey),
    counter: cred.counter,
    transports: cred.transports?.length ? cred.transports.join(",") : null,
    label,
    deviceType: info.credentialDeviceType ?? null,
    backedUp: info.credentialBackedUp ?? false,
    aaguid: info.aaguid ?? null,
    createdBy: o.createdBy ?? null,
  });
  return { label };
}
