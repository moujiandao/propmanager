// DocuSeal API client — plain ESM, mirrors the fetch/error idiom used elsewhere
// in the project (throw on non-2xx with the response body in the message). Used
// by the renewal API routes to create submissions, release signer invites, pull
// signed PDFs, and verify inbound webhook signatures.
//
// Auth: DocuSeal uses an 'X-Auth-Token' header (NOT a Bearer token).
import crypto from "crypto";

const BASE_URL = process.env.DOCUSEAL_BASE_URL || "https://api.docuseal.com";
const API_KEY = process.env.DOCUSEAL_API_KEY;

// Single fetch wrapper: sets auth + JSON headers, throws on non-2xx with the raw
// response body in the message so callers/logs see DocuSeal's actual error.
async function docusealFetch(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "X-Auth-Token": API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`DocuSeal ${method} ${path} failed (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

/**
 * Create a renewal submission with signer emails suppressed (send_email:false)
 * so the landlord can review the filled draft before invites go out.
 * @param {object} opts
 * @param {string|number} opts.templateId  DocuSeal template id
 * @param {Array<{email:string, role?:string, order:number, values?:object}>} opts.submitters
 * @returns {Promise<{submissionId, submitters:Array<{id,email,order,slug,embedSrc}>}>}
 */
export async function createRenewalSubmission({ templateId, submitters } = {}) {
  const data = await docusealFetch("/submissions", {
    method: "POST",
    body: {
      template_id: templateId,
      send_email: false,
      order: "preserved",
      submitters: (submitters || []).map((s) => ({
        email: s.email,
        ...(s.role ? { role: s.role } : {}),
        order: s.order,
        values: s.values || {},
      })),
    },
  });

  // /submissions returns an array of submitter objects; submission id is shared.
  const list = Array.isArray(data) ? data : data.submitters || [];
  const submissionId = Array.isArray(data)
    ? list[0]?.submission_id
    : data.id ?? list[0]?.submission_id;

  return {
    submissionId,
    submitters: list.map((s) => ({
      id: s.id,
      email: s.email,
      order: s.order,
      slug: s.slug,
      embedSrc: s.embed_src,
    })),
  };
}

/**
 * Release a single submitter's invite (the review gate). DocuSeal emails this
 * submitter their signing link. Higher-order countersigners are auto-notified
 * once lower orders complete.
 * @param {string|number} submitterId
 * @returns {Promise<{ok:true}>}
 */
export async function releaseSubmitter(submitterId) {
  await docusealFetch(`/submitters/${submitterId}`, {
    method: "PUT",
    body: { send_email: true },
  });
  return { ok: true };
}

/**
 * Fetch the merged signed PDF(s) for a completed submission.
 * @param {string|number} submissionId
 * @returns {Promise<{documents:Array<{name,url}>}>}
 */
export async function getSignedDocuments(submissionId) {
  const data = await docusealFetch(
    `/submissions/${submissionId}/documents?merge=true`,
  );
  const documents = (data.documents || []).map((d) => ({
    name: d.name,
    url: d.url,
  }));
  return { documents };
}

/**
 * Verify a DocuSeal webhook signature. Header format is 'timestamp.signature';
 * signature = HMAC-SHA256(secret, timestamp + '.' + rawBody), hex-encoded.
 * Compared constant-time. Secret looks like 'whsec_...'.
 * @param {string} rawBody          raw request body (request.text())
 * @param {string} signatureHeader  value of the X-Docuseal-Signature header
 * @param {string} secret           webhook signing secret (whsec_...)
 * @returns {boolean}
 */
export function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!rawBody || !signatureHeader || !secret) return false;

  // Header is 'timestamp.signature'. The timestamp has no dots, the signature is
  // hex, so split on the first dot only.
  const dot = signatureHeader.indexOf(".");
  if (dot < 0) return false;
  const timestamp = signatureHeader.slice(0, dot);
  const signature = signatureHeader.slice(dot + 1);
  if (!timestamp || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  // Constant-time compare; length mismatch short-circuits (timingSafeEqual throws
  // on unequal-length buffers).
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
