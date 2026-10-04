import type { HTMLAttributes } from 'react';

export type BadgeTone = 'amber' | 'alegra' | 'custom' | 'neutral';

const TONES: Record<BadgeTone, string> = {
  amber: 'bg-pop-amber text-pop-ink',
  alegra: 'bg-pop-alegra-bg text-pop-alegra-text',
  custom: 'bg-pop-custom-bg text-pop-custom-text',
  neutral: 'bg-pop-surface2 text-pop-muted',
};

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Contador o etiqueta de origen (píldora). */
export default function Badge({ tone = 'neutral', className = '', ...rest }: Props) {
  return (
    <span
      className={`inline-grid place-items-center min-w-[22px] h-[22px] px-2 rounded-full text-xs font-bold ${TONES[tone]} ${className}`}
      {...rest}
    />
  );
}
