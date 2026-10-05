import type { HTMLAttributes } from 'react';

export type AlertTone = 'success' | 'warning' | 'error' | 'info';

const TONES: Record<AlertTone, string> = {
  success: 'bg-pop-ok-bg text-pop-ok-text border-pop-ok-text/20',
  warning: 'bg-pop-warn-bg text-pop-warn-text border-pop-amber',
  error: 'bg-pop-err-bg text-pop-err-text border-pop-err-text/30',
  /** Informativo: una decisión de la persona, no un problema (por ejemplo, los artículos que omitió). */
  info: 'bg-pop-surface2 text-pop-ink border-pop-line',
};

interface Props extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  title?: string;
}

export default function Alert({ tone = 'warning', title, className = '', children, ...rest }: Props) {
  return (
    <div
      role={tone === 'success' || tone === 'info' ? 'status' : 'alert'}
      className={`rounded-pop border px-4 py-3 text-sm ${TONES[tone]} ${className}`}
      {...rest}
    >
      {title && <p className="font-bold mb-0.5">{title}</p>}
      {children}
    </div>
  );
}
