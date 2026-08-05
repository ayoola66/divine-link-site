// Fetch a premium user's billing details FROM Stripe (name, email, phone, address they entered
// at checkout) so the app can display them without re-entry. Read-only: editing goes through the
// billing portal. Same security model as stripe-portal (validate Supabase token, use secret key).
//
// POST /api/stripe-customer
//   headers: Authorization: Bearer <supabase access token>
//   body:    { "customerId": "cus_..." }
//   -> { name, email, phone, address: { line1, line2, city, state, postal_code, country } }
//
// Requires Netlify env: STRIPE_SECRET_KEY.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const SUPABASE_URL = process.env.SUPABASE_URL || "https://qzjhjgkvvcamcqpdrgkf.supabase.co";
// Public anon key (safe to embed — same one shipped in the macOS app's SupabaseConfig.swift).
// Required by Supabase's /auth/v1/user as the `apikey` header; it identifies the CALLING
// PROJECT, not the user — it is NOT a substitute for the user's own bearer token below.
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6amhqZ2t2dmNhbWNxcGRyZ2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODM0NzMsImV4cCI6MjA4NTQ1OTQ3M30.IQYO9V99IO7hubM87nVL14l6qaxvjNTKllDz2sXk6aU";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "Not configured (STRIPE_SECRET_KEY missing)." }), { status: 503, headers: CORS });
  }

  // Require a valid Supabase session.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  try {
    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY } });
    if (who.status !== 200) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: CORS });
  } catch {
    return new Response(JSON.stringify({ error: "Auth check failed" }), { status: 502, headers: CORS });
  }

  let customerId = "";
  try { customerId = String((await req.json())?.customerId ?? ""); } catch {}
  if (!customerId.startsWith("cus_")) {
    return new Response(JSON.stringify({ error: "No billing account found." }), { status: 400, headers: CORS });
  }

  try {
    const res = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const c = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: c?.error?.message || "Could not fetch billing details." }), { status: 502, headers: CORS });
    }
    // Return only the safe display fields (no payment/card data).
    const out = {
      name: c.name ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      address: c.address
        ? {
            line1: c.address.line1 ?? null,
            line2: c.address.line2 ?? null,
            city: c.address.city ?? null,
            state: c.address.state ?? null,
            postal_code: c.address.postal_code ?? null,
            country: c.address.country ?? null,
          }
        : null,
    };
    return new Response(JSON.stringify(out), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 502, headers: CORS });
  }
};

export const config = { path: "/api/stripe-customer" };
