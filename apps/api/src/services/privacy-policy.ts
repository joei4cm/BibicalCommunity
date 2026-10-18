import { privacySettingsSchema, type PrivacySettings } from "@logoshome/shared";

/** Parse stored privacy. Corrupt JSON fails closed (null). Missing fields use schema defaults. */
export function readPrivacy(privacyJson: string | null | undefined): PrivacySettings | null {
  if (privacyJson == null || privacyJson.trim() === "") {
    return privacySettingsSchema.parse({});
  }
  try {
    return privacySettingsSchema.parse(JSON.parse(privacyJson));
  } catch {
    return null;
  }
}

/** Search hits must honor the matching discovery switch, not a single shared gate. */
export function discoveryAllowed(privacy: PrivacySettings, via: "uid" | "handle"): boolean {
  return via === "uid" ? privacy.discoverableByUid : privacy.discoverableByHandle;
}

/**
 * Friend requests are the message-request surface (DMs already require friendship).
 * church-only: shared church membership. admin-approved: requester is an admin of that church.
 */
export function messageRequestAllowed(input: {
  privacy: PrivacySettings;
  sharesChurch: boolean;
  requesterIsAdmin: boolean;
}): boolean {
  switch (input.privacy.allowMessageRequests) {
    case "everyone":
      return true;
    case "off":
      return false;
    case "church-only":
      return input.sharesChurch;
    case "admin-approved":
      return input.requesterIsAdmin;
    default:
      return false;
  }
}
