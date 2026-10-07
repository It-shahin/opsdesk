'use client';

import {
  Wifi,
  WifiOff,
} from 'lucide-react';

import {
  useRealtime,
} from './realtime-provider';

export function RealtimeStatus() {
  const {
    isReady,
    error,
  } =
    useRealtime();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      title={
        isReady
          ? 'Realtime connected'
          : error ??
            'Realtime reconnecting'
      }
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"
    >
      {isReady ? (
        <span
          aria-hidden="true"
          className="size-2 rounded-full bg-emerald-500"
        />
      ) : error ? (
        <WifiOff
          aria-hidden="true"
          className="size-3.5"
        />
      ) : (
        <Wifi
          aria-hidden="true"
          className="size-3.5"
        />
      )}

      <span>
        {isReady
          ? 'Live'
          : 'Reconnecting…'}
      </span>
    </div>
  );
}
