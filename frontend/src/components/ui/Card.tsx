import type { HTMLAttributes } from 'react';

/** Tarjeta Pop: superficie blanca, borde crema, esquinas de 22 px y sombra sólida. */
export default function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-pop-surface border border-pop-line rounded-pop-lg shadow-pop-card p-5 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
