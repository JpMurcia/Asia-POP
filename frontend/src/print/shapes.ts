import type { BorderStyle, LineCap, ShapeKind } from '../../../backend/src/catalog/template';

/**
 * Cálculos puros de las formas SVG (feature 013): los usan el lienzo y el PDF a través de `ShapeSvg`, así que nunca
 * divergen. Todas las medidas son px de la hoja lógica (el `viewBox` del `<svg>` es el tamaño real de la caja).
 */

const r2 = (v: number) => Math.round(v * 100) / 100;
const poly = (pts: readonly (readonly [number, number])[]) => `M${pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' L')} Z`;

/** Puntos de una estrella de `n` puntas (radio interior = `inner` × exterior), ajustados a la caja `w` × `h`. */
function starPoints(n: number, inner: number, w: number, h: number): [number, number][] {
  const raw: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 === 0 ? 1 : inner;
    raw.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return raw.map(([x, y]) => [((x - x0) / (x1 - x0)) * w, ((y - y0) / (y1 - y0)) * h]);
}

/** Contorno (`d` de un `<path>`) de una forma dentro de la caja `w` × `h`. Vacío para los tipos que no son SVG. */
export function shapePath(kind: ShapeKind, w: number, h: number): string {
  switch (kind) {
    case 'triangle':
      return poly([[w / 2, 0], [w, h], [0, h]]);
    case 'diamond':
      return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case 'star':
      return poly(starPoints(5, 0.382, w, h));
    case 'burst':
      return poly(starPoints(12, 0.74, w, h));
    case 'arrow':
      return poly([[0, h * 0.3], [w * 0.6, h * 0.3], [w * 0.6, 0], [w, h / 2], [w * 0.6, h], [w * 0.6, h * 0.7], [0, h * 0.7]]);
    case 'bubble': {
      const body = h * 0.8;
      const r = Math.min(w, body) * 0.18;
      return [
        `M${r2(r)},0 H${r2(w - r)} Q${r2(w)},0 ${r2(w)},${r2(r)} V${r2(body - r)} Q${r2(w)},${r2(body)} ${r2(w - r)},${r2(body)}`,
        `H${r2(w * 0.4)} L${r2(w * 0.15)},${r2(h)} L${r2(w * 0.2)},${r2(body)} H${r2(r)} Q0,${r2(body)} 0,${r2(body - r)} V${r2(r)} Q0,0 ${r2(r)},0 Z`,
      ].join(' ');
    }
    default:
      return '';
  }
}

/** Grosor efectivo de un trazo: mínimo 1 px. */
export const strokeOf = (bw: number) => Math.max(1, bw);

/**
 * Caja del contorno con el trazo hacia dentro: el trazo SVG se centra sobre el contorno, así que se reduce la caja en el
 * grosor y se desplaza medio grosor; el borde queda dentro del elemento, igual que el `border` CSS.
 */
export function insetBox(w: number, h: number, bw: number): { x: number; y: number; w: number; h: number } {
  const g = bw > 0 ? bw : 0;
  return { x: g / 2, y: g / 2, w: Math.max(0, w - g), h: Math.max(0, h - g) };
}

/** `stroke-dasharray` de un estilo de borde (sin valor = trazo continuo). El punteado se completa con puntas redondas. */
export function dashArray(bs: BorderStyle | undefined, bw: number): string | undefined {
  const g = strokeOf(bw);
  if (bs === 'dashed') return `${r2(g * 3)} ${r2(g * 2)}`;
  if (bs === 'dotted') return `0 ${r2(g * 2)}`;
  return undefined;
}

/** Tamaño de un extremo de línea: proporcional al grosor. */
export const capSize = (bw: number) => 3 * strokeOf(bw) + 4;

export interface CapGeometry {
  kind: Exclude<LineCap, 'none'>;
  side: 'start' | 'end';
  /** Esquina izquierda del cuadro del extremo y su tamaño (alto y ancho). */
  x: number;
  size: number;
}

export interface LineGeometry {
  /** Altura de la línea (centro de la caja). */
  y: number;
  /** Tramo central: empieza donde acaba el extremo inicial y termina donde empieza el final. */
  x1: number;
  x2: number;
  caps: CapGeometry[];
}

/** Línea horizontal en una caja `w` × `h`: los extremos ocupan `capSize` dentro de la caja y la línea recorre el resto. */
export function lineGeometry(w: number, h: number, bw: number, capStart: LineCap = 'none', capEnd: LineCap = 'none'): LineGeometry {
  const both = capStart !== 'none' && capEnd !== 'none';
  const size = Math.min(capSize(bw), both ? w / 2 : w);
  const caps: CapGeometry[] = [];
  if (capStart !== 'none') caps.push({ kind: capStart, side: 'start', x: 0, size });
  if (capEnd !== 'none') caps.push({ kind: capEnd, side: 'end', x: w - size, size });
  return { y: h / 2, x1: capStart !== 'none' ? size : 0, x2: capEnd !== 'none' ? w - size : w, caps };
}

/** Contorno de un extremo de línea, centrado en la altura `cy`. La flecha apunta hacia fuera de la línea. */
export function capPath(cap: CapGeometry, cy: number): string {
  const { x, size: s, kind, side } = cap;
  const half = s / 2;
  switch (kind) {
    case 'arrow':
      return side === 'end' ? poly([[x, cy - half], [x + s, cy], [x, cy + half]]) : poly([[x + s, cy - half], [x, cy], [x + s, cy + half]]);
    case 'square':
      return poly([[x, cy - half], [x + s, cy - half], [x + s, cy + half], [x, cy + half]]);
    case 'diamond':
      return poly([[x + half, cy - half], [x + s, cy], [x + half, cy + half], [x, cy]]);
    case 'circle':
      return `M${r2(x)},${r2(cy)} a${r2(half)},${r2(half)} 0 1,0 ${r2(s)},0 a${r2(half)},${r2(half)} 0 1,0 ${r2(-s)},0 Z`;
  }
}
