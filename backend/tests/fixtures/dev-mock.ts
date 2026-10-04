/**
 * Alegra simulado para probar la app a mano:
 *   MOCK_IMG=ruta.png npx tsx backend/tests/fixtures/dev-mock.ts
 * Credenciales: tienda@example.com / tok_valido. Escucha en el puerto 3920.
 *
 * Las fotos se sirven como las de Alegra: `images: [{ id, name, url, favorite }]` y la descarga con
 * `Content-Type: binary/octet-stream`. Casos para revisar en la pantalla Generar:
 *   - «Doble foto» (id 8): dos fotos y la favorita es la segunda; debe verse la favorita (un JPEG rojo de 2×2 px).
 *   - «Foto prohibida» (id 9): la foto responde 403; aparece como «foto en Alegra que no se pudo obtener».
 *   - «Sin foto» (id 6): Alegra no informa fotos; aparece como «omitido por no tener imagen».
 *   - `MOCK_ALL_PHOTOS_FAIL=1`: todas las fotos responden 403; debe aparecer el aviso de problema general.
 *
 * Con `APP_URL` (la app ya arrancada con `ALEGRA_BASE_URL=http://127.0.0.1:3920`) deja además los datos propios que pide
 * el quickstart de la feature 003: una sección con texto de introducción, un producto propio, un producto agotado de
 * Alegra (Champong) y un combo con ese componente agotado:
 *   APP_URL=http://127.0.0.1:3000 npx tsx backend/tests/fixtures/dev-mock.ts
 * Usa SEED_USERNAME y SEED_PASSWORD si cambiaste el acceso (por defecto admin / AsiaPop2026).
 */
import http from 'node:http';
import { startAlegraMock } from './alegra-mock';

const mock = await startAlegraMock({
  categories: [
    { id: 'c1', name: 'RAMEN' },
    { id: 'c2', name: 'SNACKS' },
  ],
});
const allFail = process.env.MOCK_ALL_PHOTOS_FAIL === '1';
/** Foto con la forma real de Alegra (dirección firmada del CDN; aquí del simulador). */
const photo = (route: string, favorite: boolean, id = 1) => ({
  id,
  name: `foto-${id}.jpg`,
  url: `${mock.url}${allFail ? '/img/forbidden' : route}?Expires=9999999999&Signature=simulada&Key-Pair-Id=SIM`,
  favorite,
});
const base = {
  status: 'active',
  images: [photo('/img/generic.png', true)],
  description: 'Fideos instantáneos coreanos con caldo intenso y picante. Ideal para preparar rápido.',
};
mock.setItems([
  { ...base, id: '1', name: 'Shin Ramyun', price: 9000, category: { id: 'c1', name: 'RAMEN' } },
  { ...base, id: '2', name: 'Champong', price: 9000, category: { id: 'c1', name: 'RAMEN' }, inventory: { availableQuantity: 0, trackInventory: true } },
  { ...base, id: '3', name: 'Soon Veggie', price: 9000, category: { id: 'c1', name: 'RAMEN' } },
  { ...base, id: '4', name: 'Kimchi Bowl', price: 12000, category: { id: 'c1', name: 'RAMEN' } },
  { ...base, id: '5', name: 'Pepero', price: 15000, category: { id: 'c2', name: 'SNACKS' }, inventory: { availableQuantity: 8, trackInventory: true } },
  { ...base, id: '6', name: 'Sin foto', price: 5000, category: { id: 'c2', name: 'SNACKS' }, images: [] },
  { ...base, id: '7', name: 'Palillos', price: 800, category: null },
  // Dos fotos y la favorita es la segunda: debe verse la favorita, no la primera de la lista
  {
    ...base,
    id: '8',
    name: 'Doble foto',
    price: 7000,
    category: { id: 'c2', name: 'SNACKS' },
    images: [photo('/img/generic.png', false, 1), photo('/img/generic.jpg', true, 2)],
  },
  // La foto responde 403: Alegra la informa pero no se puede obtener
  { ...base, id: '9', name: 'Foto prohibida', price: 6000, category: { id: 'c2', name: 'SNACKS' }, images: [photo('/img/forbidden', true)] },
]);

// Reenvía el puerto fijo 3920 al servidor simulado
http
  .createServer((req, res) => {
    const target = new URL(req.url ?? '/', mock.url);
    http.get(target, { headers: req.headers }, (r) => {
      res.writeHead(r.statusCode ?? 500, r.headers);
      r.pipe(res);
    });
  })
  .listen(3920, '127.0.0.1', () => console.log('Alegra simulado en http://127.0.0.1:3920 (img en', mock.url, ')'));

const appUrl = process.env.APP_URL?.replace(/\/$/, '');
if (appUrl) {
  try {
    await seedApp(appUrl);
  } catch (e) {
    console.error('No se pudieron dejar los datos propios en la app:', e instanceof Error ? e.message : e);
  }
}

/** Crea por la API de la app los datos propios del quickstart (se puede ejecutar más de una vez: repite las que falten). */
async function seedApp(url: string): Promise<void> {
  // PNG de 1×1 (sirve como imagen de los productos propios)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const login = await fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: process.env.SEED_USERNAME ?? 'admin', password: process.env.SEED_PASSWORD ?? 'AsiaPop2026' }),
  });
  if (login.status !== 204) throw new Error(`no se pudo iniciar sesión (${login.status})`);
  const cookie = /sid=[^;]+/.exec(login.headers.get('set-cookie') ?? '')?.[0] ?? '';

  const call = async (method: string, path: string, body?: unknown, form?: FormData) => {
    const res = await fetch(`${url}${path}`, {
      method,
      headers: { Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
    return res.status === 204 ? undefined : ((await res.json()) as Record<string, unknown>);
  };
  const upload = (path: string) => {
    const form = new FormData();
    form.append('image', new Blob([png], { type: 'image/png' }), 'muestra.png');
    return call('PUT', path, undefined, form);
  };

  await call('PUT', '/api/settings/alegra', { email: 'tienda@example.com', apiToken: 'tok_valido' });

  const sections = (await call('GET', '/api/sections/custom')) as unknown as { id: string; name: string }[];
  let mochis = sections.find((s) => s.name === 'MOCHIS');
  if (!mochis) {
    mochis = (await call('POST', '/api/sections/custom', {
      name: 'MOCHIS',
      introText: '¿Qué es el mochi?\nPostre japonés de arroz glutinoso relleno de crema.\nElaborado bajo pedido.',
    })) as unknown as { id: string; name: string };
    const product = await call('POST', '/api/custom-products', {
      sectionId: mochis.id,
      name: 'Caja de mochis',
      description: 'Seis mochis rellenos de crema',
      price: 30000,
    });
    await upload(`/api/custom-products/${String(product!.id)}/image`);
    // Combo con un componente agotado en Alegra (Champong, id 2): pide la decisión "mantener u omitir" al generar
    const bundle = await call('POST', '/api/bundles', {
      sectionId: mochis.id,
      name: 'Combo regalo',
      description: 'Para sorprender',
      pricing: { type: 'discount', percent: 10 },
      components: [
        { source: 'alegra', productId: '2', quantity: 1 },
        { source: 'custom', productId: String(product!.id), quantity: 1 },
      ],
    });
    await upload(`/api/bundles/${String(bundle!.id)}/image`);
  }
  console.log('Datos propios listos en', url, '(sección MOCHIS con introducción, producto propio y combo con componente agotado)');
}
