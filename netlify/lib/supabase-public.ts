export const SUPABASE_URL = process.env.SUPABASE_URL || "https://qzjhjgkvvcamcqpdrgkf.supabase.co";
// Public anon key (safe to embed — same one shipped in the macOS app's SupabaseConfig.swift).
// Required by Supabase's /auth/v1/user as the `apikey` header; it identifies the CALLING
// PROJECT, not the user — it is NOT a substitute for the user's own bearer token below.
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6amhqZ2t2dmNhbWNxcGRyZ2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODM0NzMsImV4cCI6MjA4NTQ1OTQ3M30.IQYO9V99IO7hubM87nVL14l6qaxvjNTKllDz2sXk6aU";
