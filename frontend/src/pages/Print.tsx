import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Template } from '../../../backend/src/catalog/template';
import type { CatalogPayload } from '../../../backend/src/catalog/types';
import { countBrokenProductImages } from '../print/broken-images';
import CatalogDocument from '../print/CatalogDocument';
import { loadTemplateAssets } from '../print/preload';
import { api, ApiError } from '../services/api';

declare global {
  interface Window {
    __printReady?: boolean;
    /** Fotos de producto que terminaron sin cargar; el renderizador aborta si es mayor que 0 (nunca un PDF con fotos rotas). */
    __printBrokenImages?: number;
  }
}

/** Espera a que todas las imágenes y fuentes estén listas. */
async function whenAssetsReady(template: Template): Promise<void> {
  await loadTemplateAssets(template);
  await document.fonts.ready;
  const pending = Array.from(document.images).filter((img) => !img.complete);
  await Promise.all(
    pending.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  );
}

/**
 * Vista que abre el navegador headless (y la vista previa). Marca `window.__printReady`
 * cuando el documento está completo para que Puppeteer exporte el PDF.
 */
export default function Print({ preview = false }: { preview?: boolean }) {
  const { prepareId } = useParams();
  const [payload, setPayload] = useState<CatalogPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<CatalogPayload>(`/api/catalog/payload/${prepareId}`)
      .then(setPayload)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo cargar el catálogo.'));
  }, [prepareId]);

  useEffect(() => {
    if (!payload) return;
    window.__printReady = false;
    window.__printBrokenImages = 0;
    // Espera un ciclo de render para que existan las imágenes en el DOM
    const t = setTimeout(() => {
      void whenAssetsReady(payload.template).then(() => {
        // Antes de marcar la página como lista: quien exporta el PDF lee este dato justo después
        window.__printBrokenImages = countBrokenProductImages();
        window.__printReady = true;
      });
    }, 0);
    return () => clearTimeout(t);
  }, [payload]);

  if (error) return <p className="p-6 text-red-700">{error}</p>;
  if (!payload) return <p className="p-6">Cargando…</p>;
  return (
    <div>
      {preview && (
        <p className="bg-yellow-100 text-yellow-900 text-sm text-center py-2">
          Vista previa del catálogo (así se verá el PDF).
        </p>
      )}
      <CatalogDocument payload={payload} />
    </div>
  );
}
