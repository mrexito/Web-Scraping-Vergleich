"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServerSupabaseClient = void 0;
var supabase_js_1 = require("@supabase/supabase-js");
// Lade die Umgebungsvariablen für Supabase
var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
var supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Validierung der Umgebungsvariablen
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('❌ Supabase-URL oder Anon-Key fehlen in den Umgebungsvariablen.');
}
// Erstelle den Supabase-Client für Node.js
var createServerSupabaseClient = function () {
    return (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
};
exports.createServerSupabaseClient = createServerSupabaseClient;
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Supabase Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
