import crypto from "node:crypto";

// Server-side admin login. On the correct password it returns a short-lived signed
// session token; the admin dashboard then sends that token to /api/admin-ads for every
// create/edit/delete. The password lives ONLY in the ADMIN_PASSWORD env var and the
// token is signed with ADMIN_SESSION_SECRET — neither is ever exposed to the browser.
//
// POST /api/admin-auth   body: { "password": "..." }  ->  { ok, token }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const SESSION_HOURS = 8;

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// token = base64url(JSON{exp}) + "." + HMAC-SHA256(payload, secret)
function issueToken(secret) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_HOURS * 3600 * 1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return payload + "." + sig;
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers: CORS });
  }

  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!expected || !secret) {
    return new Response(
      JSON.stringify({ ok: false, error: "Admin auth not fully configured (need ADMIN_PASSWORD + ADMIN_SESSION_SECRET in Netlify env)." }),
      { status: 503, headers: CORS }
    );
  }

  let password = "";
  try {
    const body = await req.json();
    password = String(body?.password ?? "");
  } catch { /* bad body -> wrong password */ }

  if (!safeEqual(password, expected)) {
    return new Response(JSON.stringify({ ok: false }), { status: 401, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true, token: issueToken(secret) }), { status: 200, headers: CORS });
};

export const config = { path: "/api/admin-auth" };
