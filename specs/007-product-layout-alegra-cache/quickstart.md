# Quickstart de validación: Productos del catálogo más claros y datos de Alegra guardados

**Feature**: `007-product-layout-alegra-cache` | **Fecha**: 2026-10-10

Guía para comprobar la feature de punta a punta. Los escenarios 1 a 9 usan el **Alegra simulado** y no tocan la cuenta real. El escenario 10 usa la cuenta real, es **manual, de solo lectura y requiere confirmar antes con el responsable** (usa sus credenciales y descarga las fotos de su tienda a `data/image-cache/`, carpeta ignorada por git).

Detalle de rutas en [contracts/rest-api.md](./contracts/rest-api.md), de pantallas y textos en [contracts/ui.md](./contracts/ui.md), de formas de datos en [data-model.md](./data-model.md).

## Preparación

```bash
npm install
npm run build        # el servidor sirve frontend/dist
```

Servidor con datos temporales y Alegra simulado (el mismo método del README; corre desde una ruta **sin carpetas ocultas**, con punto, como `.claude/`, o Chrome responde «Not Found»):

```bash
# Terminal 1: Alegra simulado con 200 artículos en ~20 categorías (algunos de nombre largo), 150 ms de demora por petición e impresión de cada petición
MOCK_ITEMS=200 MOCK_DELAY_MS=150 MOCK_LOG=1 npx tsx backend/tests/fixtures/dev-mock.ts
# Terminal 2: la aplicación, con carpeta de datos temporal
DATA_DIR=/tmp/asiapop-007 PORT=3955 ALEGRA_BASE_URL=http://127.0.0.1:3920 npm start
```

Entra en <http://localhost:3955> (`admin` / `AsiaPop2026`). La conexión de prueba es `tienda@example.com` / `tok_valido`. `MOCK_ITEMS`, `MOCK_DELAY_MS` y `MOCK_LOG` son opciones nuevas del simulador (parte de esta feature).

## 1. Pruebas automáticas

```bash
npm test                 # backend y frontend
npm run lint
npm run test:pdf         # el PDF real con Chrome: nombre separado, texto completo, avisos
```

Resultado esperado: todo en verde. Con la suite de backend en paralelo, el cierre de Chrome en `pdf-render` puede agotar el tiempo de forma intermitente en Windows (ya documentado en el README); `npm run test:pdf` solo pasa siempre.

## 2. Tamaño de la zona y de la foto (Historia 1)

1. **Apariencia → Editor → Productos** y selecciona el bloque de productos.
2. La primera sección del inspector es **«Tamaño de los productos»**, con Ancho % y Alto % de la zona y de la foto.
3. Baja el ancho de la foto a 80: la foto se reduce al instante, el nombre, la burbuja y el precio la acompañan, los tres productos siguen dentro de la zona y sin encimarse.
4. Sube el alto de la foto a 150: se recorta al máximo y aparece «El alto máximo de la foto en esta zona es N %…»; la página no se rompe.
5. Baja el ancho de la zona a 20: queda en 40 con «La zona de productos debe medir al menos 40 % de ancho y 30 % de alto.»
6. Pulsa **Restaurar tamaños originales** (un solo paso de deshacer lo revierte) y comprueba que vuelve a la geometría de Neón Noche.
7. Repite con las distribuciones **Tarjetas** y **Lista**.
8. Guarda, **prepara y genera**: el PDF muestra los mismos tamaños que el lienzo y la vista previa.

## 3. Nombre separado y comparación con `Cat.pdf` (Historia 2)

```bash
OUT=capturas-007 TEMPLATE=neon npx tsx backend/tests/fixtures/visual-sample.ts
PDF=docs/Cat.pdf PAGES=4,5 OUT=capturas-007 npx tsx backend/tests/fixtures/pdf-pages.ts
```

1. En la página de productos de Neón Noche el nombre está en un **rótulo oscuro con texto neón y resplandor**, fuera de la burbuja y del marco de la foto; la burbuja trae solo la descripción.
2. Un producto propio con sabores y opciones largas muestra «Caja x 6 …» **completa** (partida en líneas si hace falta), sin «…».
3. Un combo y un producto de Alegra muestran el mismo rótulo. Un producto **sin descripción** no deja una burbuja vacía. Un producto **agotado** conserva visibles el nombre y el precio.
4. Cambia a **Dentro de la burbuja** en el inspector: el producto vuelve a verse como antes de la feature.
5. Las otras tres plantillas de fábrica **no cambiaron** de aspecto.
6. Compara la página con `docs/Cat.pdf` (pág. 4): el responsable aprueba que el nombre en neón se lee aparte de la descripción (SC-002).

## 4. Avisos de texto que no cabe

1. En **Combos** o **Contenido propio**, crea un producto de nombre y descripción en el máximo permitido y 6 sabores largos.
2. **Preparar y revisar → Generar PDF**.
3. Al terminar, bajo el aviso de éxito aparece «N producto(s) tienen texto que no cabe completo» con el nombre del producto. El PDF se genera igual.
4. Agranda la zona o la foto en Apariencia y genera de nuevo: el aviso desaparece (o baja el número).

## 5. Datos de Alegra guardados (Historia 3)

1. Con la carpeta de datos temporal (sin copia), **Conexión Alegra → guarda** `tienda@example.com` / `tok_valido`. La barra muestra «Actualizando desde Alegra… N artículos recibidos» y termina en «Datos de Alegra actualizados hace menos de 1 min.».
2. Abre **Artículos de Alegra, Sin categoría, Combos e Inicio**: cada una aparece en menos de 2 s y el simulador **no recibe peticiones nuevas** (la terminal de `dev-mock` no imprime nada).
3. **Reinicia** el servidor (Ctrl+C y `npm start`): las pantallas siguen mostrando los datos sin descargar.
4. Cambia un precio en el simulador y vuelve a abrir Artículos: **sigue el precio viejo**, con «actualizados hace N min». Pulsa **Actualizar desde Alegra**: el precio nuevo aparece y la lista se recarga sola.
5. Apaga el simulador y pulsa **Actualizar**: aparece «No se pudo actualizar desde Alegra: … Estás viendo los datos de hace N min.» y la lista **no cambia**. Enciéndelo y pulsa **Reintentar**.
6. Con el simulador apagado, **Preparar y revisar** falla con un mensaje claro y **no** se genera ningún PDF.
7. Enciéndelo, cambia otro precio, **Preparar y revisar → Generar**: el PDF sale con el precio nuevo y la copia queda actualizada (Inicio: «Sincronizado hace menos de 1 min»).
8. **Cambio de cuenta**: en la conexión cambia el correo por otro válido del simulador: se descartan los datos de la cuenta anterior y se descargan los de la nueva (aviso «Cambiaste de cuenta de Alegra…»). Guardar de nuevo la **misma** cuenta no descarga.
9. **Conexión existente sin copia**: borra solo `alegra_snapshot` (o abre una carpeta de datos que venga de la feature 006) y abre Artículos: aparece la pantalla de carga, se descarga una vez y la lista se muestra.

## 6. Artículos de Alegra: carga y categorías (Historia 4)

1. Con la copia vacía (escenario 5.9) y `MOCK_DELAY_MS=150`, abre **Artículos de Alegra**: antes de 1 s aparece la **pantalla de carga** («Descargando los artículos de Alegra», «N artículos recibidos», indicador de avance) con el mismo espacio que la lista; al terminar nada se mueve.
2. Con la copia hecha, la pantalla de carga **no** aparece.
3. Las etiquetas de categoría muestran la cantidad de cada una más «Todas» y «Sin categoría». Elige una: la lista y el «Mostrando N de M artículos» se actualizan en menos de 1 s.
4. Escribe una búsqueda y cambia a **Omitidos**: los números de las etiquetas cambian con ellas. «Limpiar filtros» vuelve a todo.
5. Encuentra todos los artículos de una categoría en 2 pasos y menos de 5 s (SC-009).
6. Omitir, volver a incluir, la nota de combos y la vista «Omitidos» funcionan **igual que en 006**.

## 7. Consejos y diseño (Historia 5)

1. En **Apariencia**, el botón **Consejos** está visible en la barra superior, en Editor y en Plantillas; encuéntralo sin ayuda en menos de 10 s (SC-010).
2. Ábrelo: 7 consejos; se cierra con «Cerrar», con Esc y pulsando fuera; el foco vuelve al botón.
3. Con **cambios sin guardar**, ábrelo y ciérralo: el estado sigue «Cambios sin guardar» y nada se perdió; Deshacer sigue funcionando.
4. A **1366 × 768** revisa **Artículos de Alegra** y **Apariencia**: espacios, alineación y jerarquía consistentes con el resto del panel, sin desbordes horizontales.

## 8. Rendimiento

- Con 200 artículos en el simulador: la pantalla de Artículos con copia aparece en menos de 2 s (SC-005); la descarga inicial termina en menos de 1 minuto (SC-006); buscar o filtrar responde en menos de 1 s.
- Preparar y generar tarda lo mismo que antes de la feature (no hay descarga extra: `prepare` guarda su propia descarga como copia).

## 9. Regresión (001 a 006)

- Sin cambiar ningún tamaño, el catálogo de Neón Noche tiene las mismas páginas, productos, precios, agotados y posiciones que antes (SC-004): compara el recuento de páginas y el texto del PDF (`npm run test:pdf`).
- Las plantillas guardadas antes de la feature se abren, se guardan y se generan sin errores; solo `neon` cambió su aspecto.
- La lista de **omitidos**, las asignaciones de «Sin categoría» y los combos siguen funcionando con los datos guardados.
- Alegra sigue en **solo lectura**: la prueba de `mock.requests` no registra métodos distintos de `GET`.

## 10. Cuenta real (manual, solo lectura; confirmar antes con el responsable)

Con la conexión que la aplicación ya tiene guardada, **en una copia de la carpeta de datos** o con respaldo de `data/app.db`:

1. Abre Artículos de Alegra por primera vez tras actualizar: se descarga **una vez** (≈ 197 artículos), con progreso, en menos de 1 minuto (SC-006).
2. Abre Artículos, Sin categoría, Combos e Inicio: cada una en menos de 2 s, sin consultar Alegra (SC-005).
3. **Preparar y revisar → Generar** con Neón Noche y calidad **Optimizada**: el PDF sigue pesando ≤ 25 MB y tarda lo mismo que antes; revisa las páginas de productos contra `docs/Cat.pdf` (nombre en neón separado, SC-002).
4. Revisa si Generar muestra productos con «texto que no cabe completo» y apunta cuáles (SC-003: 0 textos cortados sin aviso).
5. Registra los resultados **sin datos privados** (sin nombres de productos, direcciones firmadas ni credenciales) en `specs/007-product-layout-alegra-cache/validation.md`.
