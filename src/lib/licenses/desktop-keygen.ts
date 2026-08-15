import { createHmac } from "crypto";

/**
 * Desktop app license keygen — same algorithm as:
 * - dlab-ou-main/dentist-desktop/electron/license/index.cjs (4Dental Clinic)
 * - dlab-ou-main/dental-lab-desktop/electron/license/index.cjs (4Dental Lab)
 *
 * Both products currently share the same HMAC secret and key format:
 *   base64url(JSON payload) + "." + base64url(HMAC-SHA256)
 */
export const LICENSE_TYPES = {
  trial: 7,
  month: 30,
  year: 365,
  lifetime: null,
} as const;

export type DesktopLicenseType = keyof typeof LICENSE_TYPES;

function getLicenseSecret() {
  return (
    process.env.DESKTOP_LICENSE_SECRET ||
    "DentalLabManager-2024-SecureKey-7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c"
  );
}

function sign(payload: Record<string, unknown>, secret: string) {
  // Must match desktop: JSON.stringify(payload) with this key insertion order
  const str = JSON.stringify(payload);
  return createHmac("sha256", secret).update(str).digest("base64url");
}

export type DesktopLicensePayload = {
  userName: string;
  hardwareId: string;
  type: DesktopLicenseType;
  expiresAt: number | null;
  createdAt: number;
};

/**
 * Generate an activation key the desktop apps accept when pasted at startup.
 * Clinic and Lab use the same crypto today (shared secret + format).
 */
export function generateDesktopLicenseKey(input: {
  userName: string;
  hardwareId: string;
  type?: DesktopLicenseType;
  createdAt?: number;
}): { key: string; payload: DesktopLicensePayload } {
  const type = input.type ?? "lifetime";
  const days = LICENSE_TYPES[type];
  const createdAt = input.createdAt ?? Date.now();
  const expiresAt = days === null ? null : createdAt + days * 24 * 60 * 60 * 1000;

  // Property order is part of the signature — do not reorder.
  const payload: DesktopLicensePayload = {
    userName: String(input.userName || "").trim(),
    hardwareId: String(input.hardwareId || "").trim(),
    type,
    expiresAt,
    createdAt,
  };

  const secret = getLicenseSecret();
  const signature = sign(payload, secret);
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return { key: `${encoded}.${signature}`, payload };
}

export function validateDesktopLicenseKey(
  licenseStr: string,
  currentHardwareId?: string | null,
): { valid: true; payload: DesktopLicensePayload } | { valid: false; error: string } {
  if (!licenseStr || typeof licenseStr !== "string") {
    return { valid: false, error: "No license provided" };
  }
  const parts = licenseStr.trim().split(".");
  if (parts.length !== 2) return { valid: false, error: "Invalid license format" };

  const [encoded, signature] = parts;
  let payload: DesktopLicensePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return { valid: false, error: "Invalid license format" };
  }

  const expectedSig = sign(payload as unknown as Record<string, unknown>, getLicenseSecret());
  if (signature !== expectedSig) return { valid: false, error: "Invalid license signature" };

  if (
    payload.hardwareId &&
    currentHardwareId &&
    payload.hardwareId !== currentHardwareId
  ) {
    return { valid: false, error: "License is for a different computer" };
  }

  if (payload.expiresAt !== null && Date.now() > payload.expiresAt) {
    return { valid: false, error: "License has expired" };
  }

  return { valid: true, payload };
}
