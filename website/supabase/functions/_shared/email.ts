// Shared Supabase Edge Function email service for Soravo transactional email.
// Server-only. Never import into browser bundles.

export const EMAIL_SENDER = "Soravo <account@notifications.soravo.xyz>";
export const EMAIL_REPLY_TO = "admin@soravo.xyz";
export const RESEND_API_URL = "https://api.resend.com/emails";
export const RESEND_TIMEOUT_MS = 15000;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface ProviderSendResult {
  ok: boolean;
  messageId?: string;
  retryable: boolean;
  statusCode: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface TemplateResult {
  subject: string;
  html: string;
  text: string;
}

function readEnv(name: string): string | undefined {
  try {
    const deno = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno;
    if (deno?.env?.get) return deno.env.get(name);
  } catch {}
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    return proc?.env?.[name];
  } catch {}
  return undefined;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function redactEmail(value: string | null | undefined): string {
  if (!value) return "<none>";
  const atIndex = value.indexOf("@");
  if (atIndex <= 1) return "***";
  return `${value.slice(0, 2)}***${value.slice(atIndex)}`;
}

function baseTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0;padding:0;background:#f7f7f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;"><tr><td align="center"><table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px;"><tr><td><p style="margin:0 0 16px;font-size:14px;font-weight:600;letter-spacing:0.02em;color:#163300;">Soravo</p><h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#0e0f0c;">${escapeHtml(title)}</h1>${bodyHtml}</td></tr></table><p style="margin:16px 0 0;font-size:12px;color:#6b6b6b;">Soravo transactional email. Reply to admin@soravo.xyz.</p></td></tr></table></body></html>`;
}

const templates: Record<string, (data: Record<string, unknown>) => TemplateResult> = {
  welcome: (data) => {
    const name = String(data.displayName ?? "there");
    return { subject: "Welcome to Soravo", html: baseTemplate("Welcome to Soravo", `<p>Hi ${escapeHtml(name)},</p><p>Thanks for creating your Soravo account. Your dictation stays on your device.</p>`), text: `Hi ${name},\n\nThanks for creating your Soravo account.\n` };
  },
  payment_receipt: (data) => {
    const plan = String(data.plan ?? "subscription");
    const amount = String(data.amountDisplay ?? "");
    const currency = String(data.currency ?? "USD");
    const reference = String(data.paymentReference ?? "");
    const date = String(data.date ?? new Date().toISOString());
    return { subject: "Payment received - Soravo", html: baseTemplate("Payment received", `<ul><li>Plan: ${escapeHtml(plan)}</li><li>Amount: ${escapeHtml(amount)} ${escapeHtml(currency)}</li><li>Reference: ${escapeHtml(reference)}</li><li>Date: ${escapeHtml(date)}</li></ul>`), text: `Plan: ${plan}\nAmount: ${amount} ${currency}\nReference: ${reference}\nDate: ${date}\n` };
  },
  subscription_activated: (data) => {
    const plan = String(data.plan ?? "subscription");
    return { subject: "Subscription activated - Soravo", html: baseTemplate("Subscription activated", `<p>Your Soravo ${escapeHtml(plan)} subscription is now active.</p>`), text: `Your Soravo ${plan} subscription is now active.` };
  },
  subscription_renewed: (data) => {
    const plan = String(data.plan ?? "subscription");
    const periodEnd = String(data.periodEnd ?? "");
    return { subject: "Subscription renewed - Soravo", html: baseTemplate("Subscription renewed", `<p>Your Soravo ${escapeHtml(plan)} subscription was renewed${periodEnd ? ` through ${escapeHtml(periodEnd)}` : ""}.</p>`), text: `Your Soravo ${plan} subscription was renewed${periodEnd ? ` through ${periodEnd}` : ""}.` };
  },
  subscription_payment_failed: (data) => {
    const plan = String(data.plan ?? "subscription");
    return { subject: "Payment failed - Soravo", html: baseTemplate("Payment failed", `<p>A payment for your Soravo ${escapeHtml(plan)} subscription failed. Please update your payment method.</p>`), text: `A payment for your Soravo ${plan} subscription failed. Please update your payment method.` };
  },
  subscription_expired: (data) => {
    const plan = String(data.plan ?? "subscription");
    return { subject: "Subscription expired - Soravo", html: baseTemplate("Subscription expired", `<p>Your Soravo ${escapeHtml(plan)} subscription has expired. Local history remains available.</p>`), text: `Your Soravo ${plan} subscription has expired. Local history remains available.` };
  },
  refund: (data) => {
    const reference = String(data.paymentReference ?? "");
    const amount = String(data.amountDisplay ?? "");
    const currency = String(data.currency ?? "USD");
    return { subject: "Refund processed - Soravo", html: baseTemplate("Refund processed", `<p>A refund has been processed${reference ? ` (${escapeHtml(reference)})` : ""}${amount ? `: ${escapeHtml(amount)} ${escapeHtml(currency)}` : ""}.</p>`), text: `A refund has been processed${reference ? ` (${reference})` : ""}${amount ? `: ${amount} ${currency}` : ""}.` };
  },
};

export function renderTemplate(templateKey: string, data: Record<string, unknown> = {}): TemplateResult {
  const renderer = templates[templateKey];
  if (!renderer) throw new Error(`Unknown email template: ${templateKey}`);
  return renderer(data);
}

export const emailTemplates = templates;

export function templateKeys(): string[] {
  return Object.keys(templates);
}

export async function sendResendEmail(message: EmailMessage): Promise<ProviderSendResult> {
  const apiKey = readEnv("RESEND_API_KEY");
  if (!apiKey) {
    return { ok: false, retryable: false, statusCode: 503, errorCode: "missing_api_key", errorMessage: "RESEND_API_KEY is not configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_SENDER,
        to: [message.to],
        reply_to: EMAIL_REPLY_TO,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
      }),
      signal: controller.signal,
    });

    const raw = await res.text();
    let parsed: unknown = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }

    const messageId =
      parsed && typeof parsed === "object" && "id" in (parsed as Record<string, unknown>)
        ? String((parsed as Record<string, unknown>).id)
        : undefined;

    if (res.ok) {
      if (!messageId) {
        return { ok: false, retryable: true, statusCode: res.status, errorCode: "malformed_response", errorMessage: "Provider response missing message id" };
      }
      return { ok: true, messageId, retryable: false, statusCode: res.status };
    }

    const errorCode =
      parsed && typeof parsed === "object" && "name" in (parsed as Record<string, unknown>)
        ? String((parsed as Record<string, unknown>).name)
        : parsed && typeof parsed === "object" && "error" in (parsed as Record<string, unknown>)
          ? String((parsed as Record<string, unknown>).error)
          : `http_${res.status}`;

    return { ok: false, retryable: res.status >= 500, statusCode: res.status, errorCode, errorMessage: res.statusText || errorCode };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, retryable: true, statusCode: 0, errorCode: aborted ? "timeout" : "network_error", errorMessage: aborted ? "Provider request timed out" : "Provider network error" };
  } finally {
    clearTimeout(timeout);
  }
}

export const sendEmail = sendResendEmail;
export const sendTransactionalEmail = sendResendEmail;
export const resendSendEmail = sendResendEmail;
export const renderEmail = renderTemplate;
