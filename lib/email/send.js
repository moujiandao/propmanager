// Single Resend send wrapper used by test-send, manual send, and the cron engine
// so every outbound email gets identical From / Reply-To / deliverability headers.
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_NAME = process.env.RESEND_FROM_NAME || "PropManager";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
// Verified subdomain that accepts inbound mail (MX → Resend). Enables reply correlation.
const REPLY_DOMAIN = process.env.RESEND_REPLY_DOMAIN || "";

// Build the per-message Reply-To used to correlate inbound replies back to the
// originating email_messages row via sub-addressing: reply+<id>@<reply-domain>.
export function replyToAddress(messageId) {
  if (!REPLY_DOMAIN || !messageId) return undefined;
  return `reply+${messageId}@${REPLY_DOMAIN}`;
}

/**
 * Send one email through Resend with deliverability defaults.
 * @param {object} opts
 * @param {string} opts.to            recipient address
 * @param {string} opts.subject
 * @param {string} opts.html          rendered HTML body
 * @param {string} opts.text          rendered plaintext body (multipart fallback)
 * @param {string} [opts.replyToMessageId] message id for reply sub-addressing
 * @param {object} [opts.tags]        Resend tags ({name,value}[] is built from this map)
 * @returns {Promise<{id?: string, error?: string}>}
 */
export async function sendEmail({ to, subject, html, text, replyToMessageId, tags } = {}) {
  if (!to || !subject) return { error: "missing to/subject" };

  const replyTo = replyToAddress(replyToMessageId);
  const headers = {
    // mailto unsubscribe — one-click URL added in Phase 4
    "List-Unsubscribe": `<mailto:unsubscribe@${REPLY_DOMAIN || FROM_EMAIL.split("@")[1]}>`,
  };

  const payload = {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    html,
    text: text || undefined,
    headers,
  };
  if (replyTo) payload.replyTo = replyTo;
  if (tags) payload.tags = Object.entries(tags).map(([name, value]) => ({ name, value: String(value) }));

  try {
    const { data, error } = await resend.emails.send(payload);
    if (error) return { error: error.message || String(error) };
    return { id: data?.id };
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}
