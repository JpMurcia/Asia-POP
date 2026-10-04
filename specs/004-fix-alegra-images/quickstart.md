# Quickstart: validar las fotos de Alegra en el catálogo

**Feature**: `004-fix-alegra-images` | Guía de validación; el detalle de tipos y reglas está en [data-model.md](./data-model.md) y en [contracts/](./contracts/).

## Prerrequisitos

- Node.js 22 y dependencias instaladas (`npm install` en la raíz).
- Escenarios 1 a 4: ninguno más (usan el simulador).
- Escenarios 5 a 8: la conexión real con Alegra guardada en la app (pantalla Conexión Alegra). Son **manuales y de solo lectura**; nunca se automatizan contra la cuenta real.

## Arranque

```bash
npm run build
npm start        # http://127.0.0.1:<PORT>
```

Simulador de Alegra para probar a mano (tras esta feature sirve sus fotos como Alegra: tipo genérico y `favorite`; incluye un producto con foto prohibida y otro sin foto):

```bash
npx tsx backend/tests/fixtures/dev-mock.ts
```

y arrancar la app con `ALEGRA_BASE_URL=http://127.0.0.1:3920`.

## Pruebas automáticas

```bash
npm test                      # backend y frontend
npm run typecheck -w backend
npm run lint
npm run test:pdf              # incluye el aborto por foto rota
```

## Escenarios

| # | Escenario | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Pruebas en verde | Comandos de la sección anterior | Todo pasa. Incluye: fotos con tipo genérico aceptadas, favorita primero, candidatas en orden, un motivo por cada fallo, informe `photos`, aborto por foto rota |
| 2 | Fotos tipo Alegra con el simulador | Preparar el catálogo con el simulador | Los productos con foto aparecen incluidos (antes: todos omitidos). El producto "con foto prohibida" y el "sin foto" aparecen en avisos distintos |
| 3 | Elegir la favorita | En el simulador, producto con dos fotos donde la favorita es la segunda; generar y abrir la vista previa | Se ve la foto favorita, no la primera |
| 4 | Aviso general | Arrancar el simulador con todas las fotos prohibidas | Aviso de error destacado "No se pudo obtener ninguna foto de Alegra"; ninguna lista de productos "sin foto" para ellos |
| 5 | Preparar con la cuenta real | Generar catálogo → Preparar | `report.photos.informed` ≈ 181 y `obtained` ≥ 95 % de `informed` (SC-001). Los productos sin foto salen listados aparte con su causa (SC-002). Se lee en menos de 1 minuto (SC-003) |
| 6 | Generar el PDF real | Generar con Neón Noche y descargar | Listo en < 2 min (SC-006). Anotar el **tamaño del PDF** y el tiempo (riesgo de research §9) |
| 7 | Revisión visual completa | Abrir el PDF y mirar todas las páginas; comparar la estructura de Neón Noche con `docs/Cat.pdf` | 0 recuadros vacíos, rotos o deformados (SC-004); fotos verticales, horizontales y cuadradas llenan su recuadro; los agotados muestran foto + AGOTADO (SC-005); en los 4 productos con varias fotos se ve la favorita (SC-007) |
| 8 | Foto rota al renderizar | Preparar; borrar un archivo de `data/image-cache/`; pulsar Generar PDF | La generación falla con "No se pudo cargar la foto de 1 producto(s); no se generó el PDF." y no aparece ningún PDF nuevo en el historial |

## Criterios de salida

- Los 8 escenarios pasan y `npm test` queda en verde.
- El tamaño y el tiempo del escenario 6 quedan anotados. Si el PDF resulta excesivo (decenas de MB que impidan enviarlo), se abre una feature aparte para reducir fotos; no bloquea esta.
- `docs/Alegra integracion.md` actualizado con la estructura real de las fotos (FR-013).
- Ningún dato real de la tienda (nombres de productos, direcciones firmadas, token) quedó en commits ni en la documentación.
