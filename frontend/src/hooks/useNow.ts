import { useEffect, useState } from 'react';

/** La hora actual (ms), refrescada cada `intervalMs`, para textos como "hace 4 min" que envejecen solos. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * "hace menos de 1 min", "hace 4 min", "hace 2 h", "hace 3 d". Una fecha en el futuro (reloj adelantado) cuenta como
 * recién sincronizada; una fecha inválida devuelve `null` para que el llamador use su texto de siempre.
 */
export function timeAgo(iso: string, now: number): string | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const minutes = Math.floor(Math.max(0, now - then) / 60_000);
  if (minutes < 1) return 'hace menos de 1 min';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}
