import { getStore } from "@netlify/blobs";

// Global download counter, persisted in Netlify Blobs.
// GET  /api/downloads  -> { count }           (current total, never below the seed)
// POST /api/downloads  -> { count }           (increment, then return new total)
//
// Seeded at 35 so the number starts from a sensible baseline even before the
// first real download is recorded.

const SEED = 35;
const KEY = "count";
const STORE = "download-metrics";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: CORS });
  }

  try {
    // Strong consistency so a read reflects the most recent write — a counter must
    // be read-after-write correct (the default eventual consistency lets rapid
    // increments read a stale value and lose counts).
    const store = getStore({ name: STORE, consistency: "strong" });

    let count = parseInt(await store.get(KEY), 10);
    if (!Number.isFinite(count) || count < SEED) count = SEED;

    if (req.method === "POST") {
      count += 1;
      await store.set(KEY, String(count));
    }

    return new Response(JSON.stringify({ count }), { headers: CORS });
  } catch (err) {
    // Never break the page — fall back to the seed on any storage error.
    return new Response(
      JSON.stringify({ count: SEED, error: String(err?.message || err) }),
      { headers: CORS, status: 200 }
    );
  }
};

export const config = { path: "/api/downloads" };
