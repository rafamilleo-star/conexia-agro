import { createClient } from "@supabase/supabase-js";

// Credenciais hardcoded — chave pública anon, seguro para frontend
const supabaseUrl = "https://goopogicgwqqovmphqrj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvb3BvZ2ljZ3dxcW92bXBocXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDUxMDUsImV4cCI6MjA5NTIyMTEwNX0.-JMUl5-c1L6Hpf2i_blneSs1KAgZln8JBlBbt7Ql24o";

export const supabase = createClient(supabaseUrl, supabaseKey);
