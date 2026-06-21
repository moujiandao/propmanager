import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  verifyWebhookSignature,
  createRenewalSubmission,
  releaseSubmitter,
  getSignedDocuments,
} from "./client.js";

// ---- helpers -------------------------------------------------------------

const SECRET = "whsec_test_secret";

// Recreate exactly what DocuSeal signs: HMAC-SHA256(secret, `${ts}.${rawBody}`),
// hex-encoded, sent as the header `${ts}.${sig}`.
function signHeader(rawBody, secret = SECRET, ts = "1718900000") {
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  return `${ts}.${sig}`;
}

// Stub global fetch for one call; capture the request and return `payload`.
function stubFetch(payload, status = 200) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url, opts, body: opts.body ? JSON.parse(opts.body) : undefined });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (payload === undefined ? "" : JSON.stringify(payload)),
    };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

// ---- verifyWebhookSignature ---------------------------------------------

test("verifyWebhookSignature accepts a correctly signed body", () => {
  const body = JSON.stringify({ event_type: "form.completed", data: { id: 1 } });
  assert.equal(verifyWebhookSignature(body, signHeader(body), SECRET), true);
});

test("verifyWebhookSignature rejects a tampered body", () => {
  const body = JSON.stringify({ event_type: "form.completed" });
  const header = signHeader(body);
  const tampered = JSON.stringify({ event_type: "form.declined" });
  assert.equal(verifyWebhookSignature(tampered, header, SECRET), false);
});

test("verifyWebhookSignature rejects the wrong secret", () => {
  const body = "payload";
  assert.equal(verifyWebhookSignature(body, signHeader(body), "whsec_other"), false);
});

test("verifyWebhookSignature is bound to the timestamp (replay of body+sig under a new ts fails)", () => {
  const body = "payload";
  const header = signHeader(body, SECRET, "1718900000");
  // Swap only the timestamp portion; signature no longer matches.
  const forged = `1718999999.${header.split(".")[1]}`;
  assert.equal(verifyWebhookSignature(body, forged, SECRET), false);
});

test("verifyWebhookSignature rejects a header with no dot separator", () => {
  assert.equal(verifyWebhookSignature("payload", "no-dot-here", SECRET), false);
});

test("verifyWebhookSignature rejects non-hex / wrong-length signatures without throwing", () => {
  assert.equal(verifyWebhookSignature("payload", "1718900000.zzzz", SECRET), false);
  assert.equal(verifyWebhookSignature("payload", "1718900000.ab", SECRET), false);
});

test("verifyWebhookSignature returns false on missing inputs", () => {
  assert.equal(verifyWebhookSignature("", "ts.sig", SECRET), false);
  assert.equal(verifyWebhookSignature("body", "", SECRET), false);
  assert.equal(verifyWebhookSignature("body", "ts.sig", ""), false);
});

// ---- createRenewalSubmission --------------------------------------------

test("createRenewalSubmission suppresses email, preserves order, and maps submitters", async () => {
  const apiResponse = [
    { id: 11, submission_id: 99, email: "a@x.com", order: 0, slug: "s1", embed_src: "https://e/1" },
    { id: 12, submission_id: 99, email: "b@x.com", order: 0, slug: "s2", embed_src: "https://e/2" },
    { id: 13, submission_id: 99, email: "landlord@x.com", order: 1, slug: "s3", embed_src: "https://e/3" },
  ];
  const { calls, restore } = stubFetch(apiResponse);
  try {
    const out = await createRenewalSubmission({
      templateId: 7,
      submitters: [
        { email: "a@x.com", order: 0, values: { "Tenant Name": "A" } },
        { email: "b@x.com", order: 0, values: { "Tenant Name": "B" } },
        { email: "landlord@x.com", role: "Landlord", order: 1 },
      ],
    });

    // Request shape: the whole review-gate hinges on send_email:false + preserved order.
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/submissions$/);
    assert.equal(calls[0].opts.method, "POST");
    assert.equal(calls[0].body.template_id, 7);
    assert.equal(calls[0].body.send_email, false);
    assert.equal(calls[0].body.order, "preserved");
    assert.equal(calls[0].body.submitters.length, 3);
    assert.deepEqual(calls[0].body.submitters[0].values, { "Tenant Name": "A" });
    assert.equal(calls[0].body.submitters[2].role, "Landlord");
    // values defaults to {} when omitted.
    assert.deepEqual(calls[0].body.submitters[2].values, {});

    // Response mapping.
    assert.equal(out.submissionId, 99);
    assert.equal(out.submitters.length, 3);
    assert.deepEqual(out.submitters[0], {
      id: 11, email: "a@x.com", order: 0, slug: "s1", embedSrc: "https://e/1",
    });
  } finally {
    restore();
  }
});

// ---- releaseSubmitter ----------------------------------------------------

test("releaseSubmitter PUTs send_email:true to the submitter", async () => {
  const { calls, restore } = stubFetch({});
  try {
    const out = await releaseSubmitter(13);
    assert.deepEqual(out, { ok: true });
    assert.match(calls[0].url, /\/submitters\/13$/);
    assert.equal(calls[0].opts.method, "PUT");
    assert.equal(calls[0].body.send_email, true);
  } finally {
    restore();
  }
});

// ---- getSignedDocuments --------------------------------------------------

test("getSignedDocuments requests the merged PDF and maps name+url", async () => {
  const { calls, restore } = stubFetch({
    documents: [{ name: "renewal.pdf", url: "https://d/renewal.pdf", extra: "ignored" }],
  });
  try {
    const out = await getSignedDocuments(99);
    assert.match(calls[0].url, /\/submissions\/99\/documents\?merge=true$/);
    assert.deepEqual(out.documents, [{ name: "renewal.pdf", url: "https://d/renewal.pdf" }]);
  } finally {
    restore();
  }
});

// ---- error propagation ---------------------------------------------------

test("a non-2xx response throws with status and body", async () => {
  const { restore } = stubFetch({ error: "nope" }, 422);
  try {
    await assert.rejects(
      () => createRenewalSubmission({ templateId: 1, submitters: [] }),
      /failed \(422\)/,
    );
  } finally {
    restore();
  }
});
