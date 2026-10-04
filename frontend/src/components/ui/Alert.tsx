import type { HTMLAttributes } from 'react';

export type AlertTone = 'success' | 'warning' | 'error';

const TONES: Record<AlertTone, string> = {
  success: 'bg-pop-ok-bg text-pop-ok-text border-pop-ok-text/20',
  warning: 'bg-pop-warn-bg text-pop-warn-text border-pop-amber',
  error: 'bg-pop-err-bg text-pop-err-text border-pop-err-text/30',
};

interface Props extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  title?: string;
}

export default function Alert({ tone = 'warning', title, className = '', children, ...rest }: Props) {
  return (
    <div
      role={tone === 'success' ? 'status' : 'alert'}
      className={`rounded-pop border px-4 py-3 text-sm ${TONES[tone]} ${className}`}
      {...rest}
    >
      {title && <p className="font-bold mb-0.5">{title}</p>}
      {children}
    </div>
  );
}
