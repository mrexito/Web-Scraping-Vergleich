import { createClient } from '@supabase/supabase-js';
import { Database } from '@/database.types';

// Lade die Umgebungsvariablen für Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Validierung der Umgebungsvariablen
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Supabase-URL oder Anon-Key fehlen in den Umgebungsvariablen.');
}

// Erstelle den Supabase-Client für Node.js
export const createServerSupabaseClient = () => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
};

