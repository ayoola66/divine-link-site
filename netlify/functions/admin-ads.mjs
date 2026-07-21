import crypto from "node:crypto";

// Token-gated CRUD proxy for the ads table. This is the ONLY path allowed to
// create/edit/delete ads. It verifies the admin session token (issued by
// /api/admin-auth) and then talks to Supabase with the SERVICE ROLE key, which lives
// only in Netlify env — never in the browser. Once Supabase RLS denies the anon key
// any direct write to `ads`, this function is the sole write path.
//
//   GET    /api/admin-ads          -> list all ads (admin view)
//   POST   /api/admin-ads          -> create   (body = ad JSON)
//   PATCH  /api/admin-ads?id=<id>  -> update   (body = fields JSON)
//   DELETE /api/admin-ads?id=<id>  -> delete
// All require header: Authorization: Bearer <token>

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const SUPABASE_URL = process.env.SUPABASE_URL || "https://qzjhjgkvvcamcqpdrgkf.supabase.co";

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function verifyToken(token, secret) {
  if (!token || token.indexOf(".") === -1) return false;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return false;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof p.exp === "number" && Date.now() < p.exp;
  } catch {
    return false;
  }
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });

  const secret = process.env.ADMIN_SESSION_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "Server not configured (need ADMIN_SESSION_SECRET + SUPABASE_SERVICE_ROLE_KEY in Netlify env)." }),
      { status: 503, headers: CORS }
    );
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!verifyToken(token, secret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  }

  const id = new URL(req.url).searchParams.get("id");
  const base = `${SUPABASE_URL}/rest/v1/ads`;
  const sbHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  try {
    let sbRes;
    if (req.method === "GET") {
      sbRes = await fetch(`${base}?order=created_at.desc`, { headers: sbHeaders });
    } else if (req.method === "POST") {
      const body = await req.text();
      sbRes = await fetch(base, { method: "POST", headers: { ...sbHeaders, Prefer: "return=representation" }, body });
    } else if (req.method === "PATCH") {
      if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: CORS });
      const body = await req.text();
      sbRes = await fetch(`${base}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { ...sbHeaders, Prefer: "return=representation" }, body });
    } else if (req.method === "DELETE") {
      if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: CORS });
      sbRes = await fetch(`${base}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: sbHeaders });
    } else {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });
    }

    const text = await sbRes.text();
    return new Response(text || "[]", { status: sbRes.status, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 502, headers: CORS });
  }
};

export const config = { path: "/api/admin-ads" };
