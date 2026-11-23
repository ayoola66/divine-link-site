import { billingAccount } from "../lib/billing-account.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};


export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "Billing service is unavailable." }), { status: 503, headers: CORS });
  }

  const account = await billingAccount(req);
  if ("error" in account) {
    return new Response(JSON.stringify({ error: account.error }), { status: account.status, headers: CORS });
  }
  const { customerId } = account;

  try {
    const res = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const c = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Could not fetch billing details." }), { status: 502, headers: CORS });
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
  } catch {
    return new Response(JSON.stringify({ error: "Billing service is unavailable." }), { status: 502, headers: CORS });
  }
};

export const config = { path: "/api/stripe-customer" };
