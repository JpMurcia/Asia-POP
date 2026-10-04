import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

/** Campo de texto Pop con etiqueta, ayuda y error asociados. */
export default function Field({ label, hint, error, className = '', id, ...rest }: Props) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-semibold text-[13px]">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
        className={`h-11 px-3.5 rounded-pop border bg-pop-input text-pop-ink outline-none focus:border-pop-accent ${
          error ? 'border-pop-err-text' : 'border-pop-line'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <span id={`${inputId}-err`} className="text-xs text-pop-err-text">
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="text-xs text-pop-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
