// Server-side admin password check.
//
// The password lives ONLY in the Netlify environment variable ADMIN_PASSWORD
// (Site configuration -> Environment variables). It is never sent to the browser
// and never committed to the repo. The admin page POSTs the entered password here
// and only receives { ok: true|false } back.
//
// POST /api/admin-auth   body: { "password": "..." }  ->  { ok: boolean }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

// Constant-time string compare so response timing doesn't leak the password.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers: CORS });
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return new Response(
      JSON.stringify({ ok: false, error: "Admin password not configured. Set ADMIN_PASSWORD in Netlify env." }),
      { status: 503, headers: CORS }
    );
  }

  let password = "";
  try {
    const body = await req.json();
    password = String(body?.password ?? "");
  } catch { /* empty / bad body -> treated as wrong password */ }

  const ok = safeEqual(password, expected);
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 401, headers: CORS });
};

export const config = { path: "/api/admin-auth" };
