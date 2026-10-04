import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Alert } from './ui';

/** Alerta en Generar catálogo: cuántos ítems de Alegra siguen sin categoría ni sección asignada. */
export default function UncategorizedAlert() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    api
      .get<{ items: { assignedSectionKey: string | null }[] }>('/api/catalog/uncategorized')
      .then((r) => setCount(r.items.filter((i) => !i.assignedSectionKey).length))
      .catch(() => setCount(0)); // sin conexión a Alegra: no hay nada que alertar aquí
  }, []);

  if (count === 0) return null;
  return (
    <Alert tone="warning">
      <b>{count}</b> producto(s) de Alegra no tienen categoría y no saldrán en el catálogo.{' '}
      <Link to="/sin-categoria" className="font-bold">
        Asignarles una sección
      </Link>
    </Alert>
  );
}
