import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-public.ts";

type BillingAccount =
  | { customerId: string }
  | { error: string; status: number };

export async function billingAccount(request: Request): Promise<BillingAccount> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return { error: "Unauthorized", status: 401 };

  const headers = { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY };
  try {
    const session = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
    if (session.status === 401 || session.status === 403) {
      return { error: "Invalid session", status: 401 };
    }
    if (!session.ok) return { error: "Billing account lookup failed", status: 502 };

    const user = await session.json();
    if (typeof user?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(user.id)) {
      return { error: "Invalid session", status: 401 };
    }

    // Use the caller's token so Supabase also enforces subscription row ownership.
    const url = new URL("/rest/v1/subscriptions", SUPABASE_URL);
    url.searchParams.set("select", "stripe_customer_id");
    url.searchParams.set("user_id", `eq.${user.id}`);
    const response = await fetch(url, { headers });
    if (!response.ok) return { error: "Billing account lookup failed", status: 502 };

    const rows = await response.json();
    const customerId = Array.isArray(rows) && rows.length === 1 ? rows[0]?.stripe_customer_id : null;
    if (typeof customerId !== "string" || !/^cus_[A-Za-z0-9]+$/.test(customerId)) {
      return { error: "No billing account found for this user.", status: 404 };
    }
    return { customerId };
  } catch {
    return { error: "Billing account lookup failed", status: 502 };
  }
}
