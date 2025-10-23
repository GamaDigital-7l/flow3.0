import { createClient } from '@supabase/supabase-js';

// A URL do Supabase no seu ambiente de desenvolvimento parece estar incorreta (phmswujlkrwjnaztgbdl).
// Usando a URL correta do projeto (hfbxokphlwojrsrqqxba) diretamente para resolver o erro de DNS.
const supabaseUrl = "https://hfbxokphlwojrsrqqxba.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmYnhva3BobHdvanJzcnFxeGJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDY3MTgsImV4cCI6MjA3NjU4MjcxOH0.vUs4fbzSJ15iR2BsM-mPiqpvGwbjCzwcPUif3o-mowo";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be defined");
}

export { supabaseUrl };
export const supabase = createClient(supabaseUrl, supabaseAnonKey);