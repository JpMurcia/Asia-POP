# Quickstart: validar la omisión de artículos

**Feature**: `006-omit-alegra-articles` | Guía de validación; los tipos y las reglas están en [data-model.md](./data-model.md) y en [contracts/](./contracts/), y las decisiones en [research.md](./research.md).

## Prerrequisitos

- Node.js 22 y dependencias instaladas (`npm install` en la raíz).
- Escenarios 1 a 7: ninguno más (usan el simulador de Alegra).
- Escenario 8: la conexión real con Alegra guardada en la app. Es **manual y de solo lectura**; nunca se automatiza contra la cuenta real (principio V).
- **Punto de partida a recordar**: la cuenta real tiene 197 productos activos, 182 con foto y 66 páginas (de 004/005).
- **Las pruebas con Chrome real** (`npm run test:pdf` y las que abren la vista de impresión) fallan con «Not Found» si el repositorio está bajo una carpeta oculta como `.claude/worktrees/`: ejecútalas desde una ruta sin segmentos que empiecen por punto.

## Arranque

```bash
npm run build
npm start        # http://127.0.0.1:<PORT>
```

Si hay un servidor ya en marcha desde antes de los cambios, **reinícialo** (en 004 el puerto 3000 seguía con el código anterior). La migración `004_omitted_items.sql` se aplica sola al abrir la base.

Simulador de Alegra para probar a mano. Sirve dos secciones (RAMEN y SNACKS), «Champong» agotado, «Palillos» sin categoría, «Sin foto» sin foto y «Foto prohibida» con foto que no se descarga:

```bash
npx tsx backend/tests/fixtures/dev-mock.ts
```

y arrancar la app con `ALEGRA_BASE_URL=http://127.0.0.1:3920`. Con `APP_URL=http://127.0.0.1:3000` delante del comando deja además la sección MOCHIS y el «Combo regalo», cuyo componente de Alegra es Champong (lo necesitan los escenarios 5 y 6).

## Pruebas automáticas

```bash
npm test                      # backend y frontend
npm run typecheck -w backend
npm run lint
npm run test:pdf              # incluye: los omitidos no aparecen en el texto del PDF real
```

## Escenarios

| # | Escenario | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Pruebas en verde | Comandos de la sección anterior | Todo pasa. Incluye: el constructor excluye a los omitidos de secciones, avisos, agotados y cuentas de fotos; los combos no cambian; lista vacía = catálogo de hoy; la lista persiste entre reinicios; el `409 omitted_changed`; las fotos de omitidos no se descargan; y las pantallas de [contracts/articles-ui.md](./contracts/articles-ui.md) |
| 2 | Pantalla nueva | Abrir **Artículos de Alegra** (simulador) | Lista con nombre, sección o «Sin categoría», precio y «Agotado»; resumen «N artículos · 0 omitidos» (FR-001). Buscar «jamon» encuentra «Jamón»; el selector de sección filtra; los conteos de «Todos» y «Omitidos» siguen la búsqueda (FR-003) |
| 3 | Omitir y que persista | Omitir dos artículos de una misma sección; recargar la página; cerrar sesión y volver a entrar; reiniciar el servidor | Siguen omitidos en cada paso, sin pulsar nada para guardar (FR-002, FR-004, SC-003) |
| 4 | Generar sin ellos | **Preparar y revisar**; abrir la vista previa; **Generar PDF**; abrir el PDF | La revisión muestra «2 artículos omitidos por ti» con sus nombres y el enlace (FR-008); ni la vista previa ni el PDF los traen, ni siquiera con AGOTADO; el resto de la sección se reacomoda de a 3 por página (FR-005, SC-002). La línea «N omitidos» de siempre no cambia de significado |
| 5 | Coherencia | Omitir «Palillos» (sin categoría), «Sin foto» y «Champong» (agotado y componente del «Combo regalo»); mirar Sin categoría, Inicio, la revisión y el combo | Sin categoría los marca «Omitido» y su contador baja en el número de omitidos sin categoría; ningún aviso de sin foto/sin sección/agotado por ellos; Inicio dice «N omitidos del catálogo» sin cambiar «Productos activos en Alegra» y «Agotados» baja; el combo queda exactamente como antes (mismos componentes y precio, y sigue pidiendo la decisión por Champong porque está agotado **en Alegra**: omitir no cambia el stock); al omitir el componente la pantalla avisa en qué combo está (FR-009 a FR-011) |
| 6 | Sección que se vacía | Omitir todos los artículos de una sección | La sección desaparece de «Secciones a incluir», de Inicio y del PDF (sin portada ni páginas vacías); si se omite todo, Generar muestra «No hay productos para generar el catálogo.» (FR-013) |
| 7 | Cambio después de preparar | Preparar en una pestaña; en otra, omitir o incluir un artículo; volver a la primera y pulsar **Generar PDF** | Alerta «Cambiaste los artículos omitidos después de preparar…» y no se genera nada; **Preparar y revisar** de nuevo y **Generar PDF** ya funciona y el PDF coincide con la revisión (FR-012). Volver a incluir un artículo lo trae de vuelta en el siguiente catálogo (SC-006) |
| 8 | Cuenta real (manual, solo lectura) | Con la cuenta real: omitir 2 o 3 artículos que la persona responsable elija; **Preparar y revisar**; **Generar PDF**; revisar el PDF; luego volver a incluirlos | Ninguno de ellos aparece (buscar sus nombres en el PDF); el resto está intacto y se reacomoda; las páginas del resto son las de siempre salvo la sección afectada; Neón Noche conserva el aspecto de `docs/Cat.pdf` (principio IV: la feature no toca el diseño); la lista de «Artículos de Alegra» aparece en **< 10 s** y buscar/filtrar responde al instante (SC-009); la persona lo aprueba (SC-010). **No** se escriben nombres reales en la documentación |
| 9 | Sin Alegra | Detener el simulador y abrir **Artículos de Alegra** | Alerta con el mensaje, enlace a la conexión y «Reintentar»; no se muestra lista y los omitidos guardados siguen intactos (FR-015) |

## Criterios de salida

- Los 9 escenarios pasan y `npm test` queda en verde.
- Con la lista vacía, el catálogo real es el de antes de la feature: mismas páginas, productos, precios y AGOTADO (FR-014, SC-005). Se comprueba comparando el payload con y sin `omittedIds` vacío en pruebas y, a mano, el número de páginas del catálogo real antes y después de la feature.
- Ningún dato real de la tienda (nombres de productos, direcciones de fotos, credenciales) quedó en commits ni en la documentación; los números del escenario 8 se anotan, si se anotan, en un `validation.md` de esta feature **sin** nombres.
