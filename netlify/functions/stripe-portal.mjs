// Create a Stripe Billing Portal session for a signed-in premium user, so they can update
// their billing address, payment method, invoices, and cancel/renew — all on Stripe's hosted,
// PCI-safe page. The app opens the returned URL in the browser.
//
// POST /api/stripe-portal
//   headers: Authorization: Bearer <supabase access token>
//   body:    { "customerId": "cus_..." }
//   -> { url }   (Stripe portal URL)
//
// Requires Netlify env: STRIPE_SECRET_KEY (owner adds), SUPABASE_URL (optional, has default).
// The Supabase token is validated against Supabase so only real logged-in users can create a
// session, and the Stripe portal only ever exposes the passed customer's own billing.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const SUPABASE_URL = process.env.SUPABASE_URL || "https://qzjhjgkvvcamcqpdrgkf.supabase.co";
const RETURN_URL = "https://divinelink.netlify.app/account-updated.html";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(
      JSON.stringify({ error: "Billing portal not configured. Set STRIPE_SECRET_KEY in Netlify env." }),
      { status: 503, headers: CORS }
    );
  }

  // Require a valid Supabase session — validate the token against Supabase.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  }
  try {
    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: token },
    });
    if (who.status !== 200) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: CORS });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Auth check failed" }), { status: 502, headers: CORS });
  }

  let customerId = "";
  try {
    customerId = String((await req.json())?.customerId ?? "");
  } catch { /* handled below */ }
  if (!customerId.startsWith("cus_")) {
    return new Response(JSON.stringify({ error: "No billing account found for this user." }), { status: 400, headers: CORS });
  }

  // Create the portal session via Stripe's REST API (no SDK dependency needed).
  try {
    const form = new URLSearchParams({ customer: customerId, return_url: RETURN_URL });
    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      return new Response(JSON.stringify({ error: data?.error?.message || "Could not open billing portal." }), { status: 502, headers: CORS });
    }
    return new Response(JSON.stringify({ url: data.url }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 502, headers: CORS });
  }
};

export const config = { path: "/api/stripe-portal" };
