export type StatusTone = 'ok' | 'warn' | 'error' | 'idle';

const TONES: Record<StatusTone, string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-pop-amber',
  error: 'bg-rose-400',
  idle: 'bg-pop-side-muted',
};

/** Punto de estado (conexión con Alegra). El significado también debe ir en texto junto al punto. */
export default function StatusDot({ tone }: { tone: StatusTone }) {
  return <span aria-hidden="true" className={`inline-block w-2 h-2 rounded-full ${TONES[tone]}`} />;
}
