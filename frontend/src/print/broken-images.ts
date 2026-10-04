/**
 * Cuenta las fotos de producto (`img.pb-img`) que terminaron de cargar sin imagen (`complete` y ancho natural 0).
 * Se acota a las fotos de producto a propósito: una imagen decorativa (por ejemplo, un SVG sin tamaño intrínseco)
 * también puede tener ancho natural 0 sin estar rota. Las que aún no terminaron de cargar no se cuentan.
 */
export function countBrokenProductImages(root: ParentNode = document): number {
  return Array.from(root.querySelectorAll<HTMLImageElement>('img.pb-img')).filter(
    (img) => img.complete && img.naturalWidth === 0,
  ).length;
}
