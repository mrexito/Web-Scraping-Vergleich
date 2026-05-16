'use client';

import {useEffect, useState} from 'react';
import {Wifi, WifiOff, RefreshCw} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useRealtimeProviders} from '@/hooks/useRealtimeProviders';
import {cn} from '@/lib/utils';

export function RealtimeIndicator() {
  const t = useTranslations('realtime');
  const {lastUpdate, isConnected} = useRealtimeProviders();
  const [mounted, setMounted] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (lastUpdate) {
      setShowFlash(true);
      const timeout = setTimeout(() => setShowFlash(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [lastUpdate]);

  if (!mounted) return null;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-CH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs shadow-md transition-all',
        showFlash
          ? 'border-success/40 bg-success/10 text-success'
          : isConnected
            ? 'border-border text-muted-foreground'
            : 'border-warning/40 bg-warning/5 text-warning',
      )}
      aria-live="polite"
    >
      {showFlash ? (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>{t('updated')}</span>
        </>
      ) : isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          <span>{t('live')}</span>
          {lastUpdate && (
            <span className="text-muted-foreground/60">
              · {formatTime(lastUpdate)}
            </span>
          )}
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>{t('disconnected')}</span>
        </>
      )}
    </div>
  );
}