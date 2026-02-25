import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
    if (_client) return _client;

    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    // Vercel UI copies can accidentally include newlines/spaces.
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\s+/g, "");

    if (!url || !key) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas");
    }

    _client = createClient(url, key, { auth: { persistSession: false } });
    return _client;
};

export const supabase = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        return (getSupabase() as any)[prop];
    },
});
