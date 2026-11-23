import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../lib/supabase-public.ts";

export default async () => {
  const url = new URL("/rest/v1/ads?select=id&limit=1", SUPABASE_URL);
  const response = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(8000),
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error(`Supabase read failed with HTTP ${response.status}`);
  console.info("Supabase database read succeeded");
  return new Response(null, { status: 204 });
};

export const config = { schedule: "15 0,8,16 * * *" };
