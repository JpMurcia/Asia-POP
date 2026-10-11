/**
 * Los consejos del botón «Consejos» de Apariencia (feature 007). Son datos, no interfaz: se pueden cambiar sin tocar el
 * panel. Cada uno describe algo que existe en el editor; si cambia el nombre de una sección o un botón, se cambia aquí.
 * Contrato: specs/007-product-layout-alegra-cache/contracts/ui.md §2.
 */
export interface EditorTip {
  /** La primera frase, en negrita. */
  title: string;
  body: string;
}

export const EDITOR_TIPS: readonly EditorTip[] = [
  {
    title: 'Más espacio para los productos.',
    body: 'Selecciona el bloque de productos y cambia el ancho y el alto de la zona o de la foto en «Tamaño de los productos».',
  },
  {
    title: 'El nombre en neón.',
    body: 'En «Nombre del producto» elige si va separado de la descripción o dentro de la burbuja, y cambia su color y su rótulo.',
  },
  {
    title: 'Si un texto no cabe,',
    body: 'el bloque lo avisa. Agranda la zona o la foto, o acorta el texto; el catálogo se genera igual.',
  },
  {
    title: 'Contraste.',
    body: 'El editor avisa cuando un color casi no se distingue del fondo. Revísalo antes de guardar.',
  },
  {
    title: 'Mover y cambiar el tamaño.',
    body: 'Los bloques automáticos están fijos: pulsa «Desbloquear» para arrastrarlos y usa la esquina para cambiar su tamaño.',
  },
  {
    title: 'Vista previa.',
    body: 'Pulsa «Vista previa» para ver la página sin guías ni selección.',
  },
  {
    title: 'Guardar.',
    body: 'Un solo «Guardar» aplica todas las plantillas. Usa «Usar» para elegir con cuál se genera.',
  },
];
