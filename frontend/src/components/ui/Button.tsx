import type { ComponentProps } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-pop-accent text-white shadow-pop-button hover:brightness-105 active:translate-y-[2px]',
  secondary: 'bg-pop-surface text-pop-ink border border-pop-line hover:bg-pop-surface2',
  danger: 'bg-pop-err-bg text-pop-err-text border border-pop-err-text/30 hover:brightness-95',
};

/** `ComponentProps` (y no `ButtonHTMLAttributes`) para que acepte `ref` como prop, como en React 19. */
interface Props extends ComponentProps<'button'> {
  variant?: ButtonVariant;
}

export default function Button({ variant = 'primary', className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 h-11 px-5 rounded-pop font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
