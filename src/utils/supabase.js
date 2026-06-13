import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || "";
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);
// rebuild Sat Jun 13 13:37:22 UTC 2026
