import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { downloadUrlForProduct, siteConfig } from "@/lib/site";
import { productLabel, productPrefix, type ProductSlug } from "@/lib/products";

export type PurchaseEmailInput = {
  to: string;
  customerName?: string | null;
  product: ProductSlug;
  licenseKey: string;
  transactionId?: string | null;
  licenseId?: string | null;
};

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      (process.env.SMTP_FROM || process.env.SMTP_USER),
  );
}

function createTransport() {
  const port = Number(process.env.SMTP_PORT || "465");
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

function brandFor(product: ProductSlug) {
  if (product === "lab") {
    return {
      accent: "#6B4EAA",
      accentDark: "#4A3680",
      softBg: "#f5f0ff",
      softBorder: "#e5e0ed",
      label: productLabel("lab"),
      siteUrl: siteConfig.lab.url,
      keyPrefix: productPrefix("lab"),
      hubLabel: "Lab management software",
    };
  }
  return {
    accent: "#059669",
    accentDark: "#065f46",
    softBg: "#f0fdf4",
    softBorder: "#dcfce7",
    label: productLabel("clinic"),
    siteUrl: siteConfig.clinic.url,
    keyPrefix: productPrefix("clinic"),
    hubLabel: "Clinic management software",
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPurchaseEmailHtml(input: PurchaseEmailInput) {
  const brand = brandFor(input.product);
  const name = escapeHtml(input.customerName?.trim() || "there");
  const email = escapeHtml(input.to.trim().toLowerCase());
  const key = escapeHtml(input.licenseKey.trim().toUpperCase());
  const downloadUrl = downloadUrlForProduct(input.product);
  const txn = input.transactionId ? escapeHtml(input.transactionId) : null;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your ${brand.label} license</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:${brand.accent};padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.85);font-weight:600;">4Dental.app</p>
              <h1 style="margin:10px 0 0;font-size:26px;line-height:1.25;color:#ffffff;font-weight:700;">${brand.label}</h1>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">${brand.hubLabel}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hi ${name},</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
                Thank you for your purchase. Your license is ready. Use the email and key below to activate
                <strong style="color:${brand.accentDark};">${brand.label}</strong> on Windows.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.softBg};border:1px solid ${brand.softBorder};border-radius:12px;margin:0 0 24px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Item purchased</p>
                    <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:${brand.accentDark};">${brand.label} — Lifetime license</p>
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Email for activation</p>
                    <p style="margin:0 0 16px;font-size:15px;font-family:Consolas,Monaco,monospace;color:#111827;">${email}</p>
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">License key</p>
                    <p style="margin:0;font-size:18px;font-family:Consolas,Monaco,monospace;font-weight:700;letter-spacing:0.04em;color:${brand.accentDark};">${key}</p>
                    ${
                      txn
                        ? `<p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Order / transaction: ${txn}</p>`
                        : ""
                    }
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:10px;background:${brand.accent};">
                    <a href="${downloadUrl}" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                      Download ${brand.label}
                    </a>
                  </td>
                </tr>
              </table>

              <h2 style="margin:0 0 12px;font-size:16px;color:${brand.accentDark};">How to activate</h2>
              <ol style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:14px;line-height:1.7;">
                <li>Download and install ${brand.label} using the button above.</li>
                <li>Open the program — the license screen appears on first launch.</li>
                <li>Enter your purchase email (<strong>${email}</strong>) and license key (starts with <strong>${brand.keyPrefix}-</strong>).</li>
                <li>Stay online for activation and periodic license checks. After that you can work offline until the next check is due.</li>
              </ol>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
                Need help? Reply to this email or visit
                <a href="https://${siteConfig.domain}" style="color:${brand.accent};">${siteConfig.domain}</a>
                · Product site:
                <a href="${brand.siteUrl}" style="color:${brand.accent};">${brand.siteUrl.replace(/^https?:\/\//, "")}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#111827;padding:22px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#ffffff;">${siteConfig.name}</p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${year} 4Dental · Licenses delivered from ${escapeHtml(process.env.SMTP_FROM || "hello@4dental.app")}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPurchaseEmailText(input: PurchaseEmailInput) {
  const brand = brandFor(input.product);
  const name = input.customerName?.trim() || "there";
  const downloadUrl = downloadUrlForProduct(input.product);
  return [
    `Hi ${name},`,
    "",
    `Thank you for purchasing ${brand.label}.`,
    "",
    `Item: ${brand.label} — Lifetime license`,
    `Email for activation: ${input.to.trim().toLowerCase()}`,
    `License key: ${input.licenseKey.trim().toUpperCase()}`,
    input.transactionId ? `Transaction: ${input.transactionId}` : "",
    "",
    `Download: ${downloadUrl}`,
    "",
    "How to activate:",
    `1. Install ${brand.label}.`,
    "2. Open the app and enter your purchase email + license key.",
    `3. Key starts with ${brand.keyPrefix}-.`,
    "4. Internet is required to activate and for periodic checks.",
    "",
    `Help: https://${siteConfig.domain}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Sends license delivery email via 4dental.app SMTP.
 * Idempotent per license when licenseId is provided.
 */
export async function sendPurchaseLicenseEmail(input: PurchaseEmailInput) {
  const to = input.to?.trim().toLowerCase();
  if (!to || !to.includes("@") || to.endsWith("@checkout.local")) {
    return { sent: false, reason: "no_customer_email" as const };
  }
  if (!input.licenseKey?.trim()) {
    return { sent: false, reason: "no_key" as const };
  }
  if (!smtpConfigured()) {
    console.warn("[email] SMTP not configured — skipping license email");
    return { sent: false, reason: "smtp_not_configured" as const };
  }

  if (input.licenseId) {
    const existing = await prisma.license.findUnique({
      where: { id: input.licenseId },
      select: { licenseEmailSentAt: true },
    });
    if (existing?.licenseEmailSentAt) {
      return { sent: false, reason: "already_sent" as const };
    }
  }

  const brand = brandFor(input.product);
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const subject = `Your ${brand.label} license key`;

  try {
    const transport = createTransport();
    await transport.sendMail({
      from: `"${brand.label}" <${from}>`,
      to,
      replyTo: from,
      subject,
      text: buildPurchaseEmailText(input),
      html: buildPurchaseEmailHtml(input),
    });

    if (input.licenseId) {
      await prisma.license.update({
        where: { id: input.licenseId },
        data: { licenseEmailSentAt: new Date() },
      });
    }

    console.info("[email] license email sent", { to, product: input.product });
    return { sent: true as const };
  } catch (error) {
    console.error("[email] license email failed", error);
    return {
      sent: false as const,
      reason: "send_failed" as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
