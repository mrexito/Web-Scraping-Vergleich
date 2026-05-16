'use client';

/**
 * useRealtimeProviders.ts
 * =======================
 * Custom Hook für Live-Updates der Provider-Daten via Supabase Realtime.
 *
 * Funktionalität:
 *   - Abonniert Änderungen an den Tabellen courses, GymiProviders, CourseDetails
 *   - Triggert Re-Fetch beim Empfang eines Events
 *   - Liefert lastUpdate für UI-Anzeige
 *
 * Architektur-Entscheidung:
 *   Supabase Realtime nutzt die PostgreSQL-Replikation und WebSockets,
 *   um Datenbankänderungen ohne Polling an Clients zu pushen. Damit
 *   erfüllt das Portal die Topic-Anforderung N-5 (Real-time UI Updates).
 */

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/utils/supabase/client';

export function useRealtimeProviders() {
  const router = useRouter();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('provider-updates')
      .on(
        'postgres_changes',
        {event: '*', schema: 'public', table: 'courses'},
        (payload) => {
          console.log('[Realtime] Courses changed:', payload.eventType);
          setLastUpdate(new Date());
          router.refresh();
        },
      )
      .on(
        'postgres_changes',
        {event: '*', schema: 'public', table: 'GymiProviders'},
        (payload) => {
          console.log('[Realtime] GymiProviders changed:', payload.eventType);
          setLastUpdate(new Date());
          router.refresh();
        },
      )
      .on(
        'postgres_changes',
        {event: '*', schema: 'public', table: 'CourseDetails'},
        (payload) => {
          console.log('[Realtime] CourseDetails changed:', payload.eventType);
          setLastUpdate(new Date());
          router.refresh();
        },
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return {lastUpdate, isConnected};
}