# Quickstart: validación de la feature 007

Escenarios para comprobar la feature de punta a punta. Formas en [data-model.md](./data-model.md) y contratos en [contracts/editor-actions.md](./contracts/editor-actions.md).

## Prerrequisitos

- Features 001 a 006 funcionando: `.env` con `SEED_USERNAME`, `SEED_PASSWORD`, `ENCRYPTION_KEY`; `npm install`.
- **Línea base capturada antes de cambiar el render** (tarea T001): el PDF de cada una de las 4 plantillas base generado con el código actual, con el servidor simulado de Alegra, en `specs/007-editor-align-text-tools/visual/baseline/`. Sin ella no hay con qué comparar SC-003.
- Una plantilla guardada **antes** de la feature en `data/app.db` (por ejemplo, Neón Noche con un título movido), para el escenario 6.

## Arranque

```bash
npm run build
npm start          # http://127.0.0.1:<PORT>
npm test           # backend y frontend
npm run test:pdf   # PDF real en Chrome
```

## Escenarios

1. **Alinear (US1, FR-001 a FR-005, SC-001, SC-002)**. En Portada selecciona un título y pulsa las seis acciones: su borde o centro coincide con el de la hoja y el otro eje no cambia (compara los números X/Y del inspector: Centrar horizontalmente da `X = (100 − Ancho) / 2`). Pulsa la misma acción dos veces: deshacer retrocede **un** paso. Repite con una imagen, una forma y el bloque de productos desbloqueado.
2. **Alinear bloqueado y casos borde (US1)**. Bloquea el título: los seis botones quedan deshabilitados con el aviso. Agranda una forma al 120 % de ancho y pulsa "Alinear a la izquierda": X = 0 y sobresale por la derecha sin cambiar de tamaño. Gira un elemento 30° y céntralo: se centra su caja sin rotar.
3. **Altura de línea (US2, FR-006 a FR-009)**. Agrega un texto de tres líneas (Intro entre líneas): el control muestra 1,05. Deslízalo a 0,8 y a 2,5 de un solo gesto: las líneas se juntan y se separan al instante, y deshacer vuelve a 1,05 en un paso. En un texto con `{telefonos}` sube la altura de línea: el texto se reduce para caber, nunca por debajo de 6 pt.
4. **Tachado (US3, FR-010 a FR-012, SC-006)**. Agrega "$25.000", actívale Tachado: una línea del color del texto lo atraviesa. Agrégale contorno, resplandor y mayúsculas: todo se conserva. Con un texto de dos líneas, ambas quedan tachadas. Cronometra componer "~~$25.000~~ $19.900" con dos textos: menos de 1 minuto.
5. **Persistencia y PDF (FR-013, FR-014, SC-004)**. Guarda, recarga: altura de línea, tachado y posiciones siguen iguales. Duplica el texto y la plantilla: se conservan. Genera el catálogo con esa plantilla: en el PDF el texto tiene los mismos cortes de línea, la misma separación y el mismo tachado que el lienzo y la vista previa.
6. **Compatibilidad (FR-015, SC-003)**. Sin tocar nada, abre la plantilla guardada antes de la feature: el indicador dice "Todo guardado" y sus textos se ven igual. Genera el PDF de las 4 plantillas base y compáralos página a página con la línea base: sin diferencias.
7. **Validación (FR-016)**. Cubierto por las pruebas de integración (`templates.test.ts`): `lh: 3`, `lh: "1.2"` y `strike: "sí"` responden `422 invalid_templates` con la ruta del campo y no cambian nada.

## Criterios de salida

- `npm test`, `npm run test:pdf` y `npm run lint` en verde.
- Escenarios 1 a 6 revisados a mano sin diferencias.
- Sin dependencias nuevas en `package.json`.
