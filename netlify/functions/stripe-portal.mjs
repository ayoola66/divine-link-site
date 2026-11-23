import { billingAccount } from "../lib/billing-account.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const RETURN_URL = "https://divinelink.netlify.app/account-updated.html";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(
      JSON.stringify({ error: "Billing service is unavailable." }),
      { status: 503, headers: CORS }
    );
  }

  const account = await billingAccount(req);
  if ("error" in account) {
    return new Response(JSON.stringify({ error: account.error }), { status: account.status, headers: CORS });
  }
  const { customerId } = account;

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
      return new Response(JSON.stringify({ error: "Could not open billing portal." }), { status: 502, headers: CORS });
    }
    return new Response(JSON.stringify({ url: data.url }), { status: 200, headers: CORS });
  } catch {
    return new Response(JSON.stringify({ error: "Billing service is unavailable." }), { status: 502, headers: CORS });
  }
};

export const config = { path: "/api/stripe-portal" };
