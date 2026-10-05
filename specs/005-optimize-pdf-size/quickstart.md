# Quickstart: validar el PDF liviano

**Feature**: `005-optimize-pdf-size` | Guía de validación; los tipos y las reglas están en [data-model.md](./data-model.md) y en [contracts/](./contracts/), y las medidas de partida en [research.md](./research.md) §0.

## Prerrequisitos

- Node.js 22 y dependencias instaladas (`npm install` en la raíz; trae `sharp` con su binario para Windows).
- Escenarios 1 a 4: ninguno más (usan el simulador y fotos sintéticas).
- Escenarios 5 a 8: la conexión real con Alegra guardada en la app y el catálogo real. Son **manuales y de solo lectura**; nunca se automatizan contra la cuenta real.
- **Punto de partida a recordar** (de 004): PDF real de **156,4 MB**, 66 páginas, 182 fotos, 16,2 s para generar, 20,8 s para preparar.

## Arranque

```bash
npm run build
npm start        # http://127.0.0.1:<PORT>
```

Si hay un servidor ya en marcha desde antes de los cambios, **reinícialo**: en la validación de 004 el puerto 3000 seguía ejecutando el código anterior.

Simulador de Alegra para probar a mano. Por defecto sirve fotos sintéticas pesadas (PNG y JPEG de varios MB, una de ellas PNG con fondo transparente), así que la diferencia de peso entre las dos calidades se ve sin preparar nada más. Con `MOCK_IMG=/ruta/a/una-foto.jpg` todas las fotos pasan a ser esa imagen (para revisar el diseño con una foto real):

```bash
npx tsx backend/tests/fixtures/dev-mock.ts
```

y arrancar la app con `ALEGRA_BASE_URL=http://127.0.0.1:3920`.

## Pruebas automáticas

```bash
npm test                      # backend y frontend
npm run typecheck -w backend
npm run lint
npm run test:pdf              # incluye la comparación de ambas calidades con Chrome real
```

## Escenarios

| # | Escenario | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Pruebas en verde | Comandos de la sección anterior | Todo pasa. Incluye: 150 ppp calculados desde cada plantilla base y desde un bloque agrandado, reducción sin agrandar, JPEG frente a PNG con transparencia, «nunca más pesada», foto dañada y GIF, reemplazo de direcciones sin mutar el payload, Original intacto, copias temporales borradas, tamaño en el trabajo y el historial, y en Chrome real: Optimizada pesa menos y conserva texto y páginas |
| 2 | Opción en Generar | Abrir **Generar catálogo** | Aparece **Calidad del PDF** con **Optimizada · Recomendada** marcada y **Original**, con sus textos de ayuda (FR-001, FR-002). Cambiar la calidad no dispara ninguna petición y no cambia la revisión ni la vista previa |
| 3 | Dos calidades con el simulador | Preparar una vez; generar con **Optimizada**; volver a generar la misma preparación con **Original** | La primera muestra el paso «Optimizando fotos» y termina con un archivo mucho más liviano que la segunda; ambas tienen las mismas páginas, productos, precios e indicaciones AGOTADO (FR-005, SC-003) |
| 4 | Tamaño en pantalla e Historial | Tras el escenario 3, mirar la alerta de éxito y abrir **Historial** | «Catálogo generado · X MB» con el tamaño correcto; el Historial muestra la columna **Tamaño** de ambos catálogos y «—» si se borra un archivo de `data/output/` (FR-011, SC-005) |
| 5 | Medir antes de optimizar (cuenta real) | **Preparar y revisar** con la cuenta real; **Generar** con calidad **Original** | Cuenta de siempre (revisión sin cambios). Anotar el **tamaño** (≈ 156 MB; SC-007 admite ±5 %) y el **tiempo** de preparar y generar |
| 6 | Generar optimizado (cuenta real) | Con la misma preparación, **Generar** con **Optimizada** y con Neón Noche | Peso **≤ 25 MB** (SC-001; estimado ~20 MB); preparar + generar en **< 2 min** (SC-004); sin aviso de tamaño. Con los 10 últimos catálogos optimizados, `data/output/` no supera 250 MB (SC-006) |
| 7 | Revisión visual (cuenta real) | Abrir los dos PDF y comparar las **66 páginas** a tamaño normal de pantalla; imprimir una página A4 de cada uno; comparar Neón Noche optimizada con `docs/Cat.pdf` | 0 fotos con pérdida visible (SC-002); portadas, páginas de producto y políticas iguales (FR-005); Neón Noche conserva el aspecto de `docs/Cat.pdf` (principio IV); la persona responsable lo aprueba para enviarlo a clientes (SC-008) |
| 8 | Transparencia y copias temporales | Buscar productos con foto de fondo transparente (64 en la cuenta real) y compararlos en ambas calidades, con una plantilla de tarjeta oscura (Neón Noche) y otra blanca; luego mirar `data/pdf-photos/` | Los recortes se ven igual en ambas calidades, sin caja blanca ni negra (FR-006). `data/pdf-photos/` queda **vacía** después de generar, también tras una generación fallida (borrar un archivo de `data/image-cache/` antes de generar) |

## Criterios de salida

- Los 8 escenarios pasan y `npm test` queda en verde.
- El peso del PDF real en calidad Optimizada es de **25 MB o menos**. Si no lo fuera: se aplica la palanca de reserva de [research.md](./research.md) §3 (aplanar sobre el color de la tarjeta) **o** se consulta al responsable antes de bajar de 150 ppp, como pide la spec (*Clarifications*).
- Los números del escenario 5 (antes) y 6 (después) quedan en un `validation.md` de esta feature, **sin** nombres de productos, direcciones de fotos ni credenciales (regla de datos reales de la constitución).
- Ningún dato real de la tienda quedó en commits ni en la documentación.
