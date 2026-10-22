/**
 * Fotos sintéticas para las pruebas de la foto-tarjeta (feature 010). Se crean con `sharp` a partir de SVG, sin ruido
 * aleatorio, así que son deterministas. Cada función devuelve los bytes de la foto (PNG) y memoriza el resultado.
 */
import sharp from 'sharp';

const cache = new Map<string, Promise<Buffer>>();
const memo = (key: string, make: () => Promise<Buffer>): Promise<Buffer> => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key)!;
};

/** Un producto de prueba: una lata roja con franja amarilla y tapa gris. */
const can = (x: number, y: number, cw: number, ch: number): string =>
  `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="${cw * 0.08}" fill="#c0391b"/>` +
  `<rect x="${x}" y="${y + ch * 0.35}" width="${cw}" height="${ch * 0.3}" fill="#f2c230"/>` +
  `<ellipse cx="${x + cw / 2}" cy="${y}" rx="${cw / 2}" ry="${ch * 0.05}" fill="#8e8e93"/>`;

function scene(w: number, h: number, background: string, body: string, alpha = false): Promise<Buffer> {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${background}${body}</svg>`);
  const out = sharp(svg).png();
  return (alpha ? out : out.flatten({ background: '#ffffff' })).toBuffer();
}

const solid = (w: number, h: number, color: string) => `<rect width="${w}" height="${h}" fill="${color}"/>`;
const gradient = (w: number, h: number) =>
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#3a6ea5"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>`;

export const CARD_PHOTOS = {
  /** Producto centrado sobre fondo blanco liso: la separación del fondo debe aceptarse. */
  verticalPlain: () => memo('verticalPlain', () => scene(600, 900, solid(600, 900, '#ffffff'), can(170, 220, 260, 460))),
  horizontalPlain: () => memo('horizontalPlain', () => scene(900, 600, solid(900, 600, '#ffffff'), can(320, 120, 260, 360))),
  squarePlain: () => memo('squarePlain', () => scene(700, 700, solid(700, 700, '#f4f4f4'), can(230, 150, 240, 400))),
  /** PNG con transparencia real alrededor del producto. */
  transparent: () => memo('transparent', () => scene(500, 700, '', can(140, 160, 220, 380), true)),
  /** 40 × 40: más pequeña que la tarjeta. */
  tiny: () => memo('tiny', () => scene(40, 40, solid(40, 40, '#ffffff'), can(12, 8, 16, 26))),
  /** Fondo degradado: el borde no es uniforme. */
  gradient: () => memo('gradient', () => scene(600, 900, gradient(600, 900), can(170, 220, 260, 460))),
  /** El producto toca el borde de la foto. */
  cut: () => memo('cut', () => scene(600, 900, solid(600, 900, '#ffffff'), can(170, 300, 260, 700))),
  /** Dos productos separados. */
  two: () => memo('two', () => scene(900, 600, solid(900, 600, '#ffffff'), can(90, 150, 220, 330) + can(560, 150, 220, 330))),
  /** Producto casi del color del fondo (empaque blanco sobre blanco). */
  whiteOnWhite: () =>
    memo('whiteOnWhite', () => scene(600, 900, solid(600, 900, '#ffffff'), `<rect x="170" y="220" width="260" height="460" rx="20" fill="#fafafa"/>`)),
  /** El producto ocupa casi toda la foto. */
  fills: () =>
    memo('fills', () => scene(600, 900, solid(600, 900, '#ffffff'), `<rect x="12" y="12" width="576" height="876" rx="30" fill="#c0391b"/>`)),
} as const;

/** El color RGB medio de un recuadro de una imagen (`stats()` de sharp ignora `extract`, por eso se promedia a mano). */
export async function meanColor(
  image: Buffer,
  box: { left: number; top: number; width: number; height: number },
): Promise<[number, number, number]> {
  const { data, info } = await sharp(image).extract(box).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  const count = info.width * info.height;
  for (let i = 0; i < count; i++) for (let c = 0; c < 3; c++) sum[c]! += data[i * 3 + c]!;
  return [sum[0]! / count, sum[1]! / count, sum[2]! / count];
}
