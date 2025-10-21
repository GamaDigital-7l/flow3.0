import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be defined in .env file");
}

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY === "SUA_CHAVE_PUBLICA_VAPID_AQUI") {
  console.warn("VITE_VAPID_PUBLIC_KEY não está definida no seu arquivo .env. As notificações push não funcionarão até que seja configurada.");
}

export { supabaseUrl };
export const supabase = createClient(supabaseUrl, supabaseAnonKey);