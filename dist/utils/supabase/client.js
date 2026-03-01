"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = void 0;
var ssr_1 = require("@supabase/ssr");
var createClient = function () {
    return (0, ssr_1.createBrowserClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
};
exports.createClient = createClient;
// Debugging: Überprüfen, ob die Umgebungsvariablen geladen werden
console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Supabase Anon Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
