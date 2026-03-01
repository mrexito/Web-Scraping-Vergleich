import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export const createClient = (request: NextRequest) => {
  // Create an unmodified response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Prüfen, ob die Umgebungsvariablen gesetzt sind
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase-Umgebungsvariablen sind nicht definiert');
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Setze die Cookies direkt auf die Response
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          // Entferne die Cookies, indem expires auf einen vergangenen Zeitpunkt gesetzt wird
          response.cookies.set({
            name,
            value: '',
            expires: new Date(0),
            ...options,
          });
        },
      },
    }
  );

  return { supabase, response };
};
