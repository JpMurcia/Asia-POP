# Quickstart: validar los ajustes avanzados de texto

Requisitos: `npm install` hecho, `frontend/dist` reconstruido (`npx vite build` en `frontend/`) antes de las pruebas del backend que usan Chrome.

## 1. Compatibilidad (lo primero)

```bash
cd backend && npx vitest run tests/unit
cd backend && npx tsx tests/fixtures/pdf-baseline.ts
```

Esperado: los 8 PDF de la línea base salen **idénticos** (SC-001, SC-007).

> **Cómo se compara (T001)**: la línea base de la 007 ya no sirve (es anterior a la 005). Se usa la herramienta de la 010: `BASELINE_DIR=<carpeta> npx tsx tests/fixtures/pdf-baseline.ts capture` con el código de **antes** y `… compare` con el de **ahora**. Punto de partida capturado el 2026-10-22 con el commit `4b4f704` (8 PDF: 4 plantillas × normal y largo); se compara en T027.

## 2. Modelo y esquema

```bash
cd backend && npx vitest run tests/unit/template-schema-008.test.ts
```

Esperado: `lh` acepta 0,5 y 2,5; rechaza 0,4 y 9; `ls` acepta −10 y 60; rechaza −11 y 61; `vAlign` acepta `top|middle|bottom`, rechaza otro valor y se conserva al guardar y leer; una plantilla sin `vAlign` se lee igual que antes.

## 3. Render

```bash
cd frontend && npx vitest run tests/text-advanced-settings.test.tsx
```

Esperado: sin `vAlign` la caja del texto no lleva `align-items` propio; `top` ⇒ `flex-start`, `bottom` ⇒ `flex-end`; `lh` 0,5 y `ls` 60 llegan al estilo del texto.

## 4. Inspector y editor

Esperado (mismas pruebas más `template-editor-inspector` y `template-editor-reducer` actualizadas):

| Caso | Resultado |
|------|-----------|
| Texto seleccionado | Panel «Configuración avanzada» cerrado, con los tres ajustes dentro y ninguno repetido en «Tipografía» |
| Abrir el panel, seleccionar otro texto | El panel sigue abierto |
| Seleccionar una forma o imagen | No hay panel |
| Escribir `1,37` o `1.37` en Altura de línea | Se guarda 1,37 |
| Escribir `9` o `0,1` | Se guarda 2,5 o 0,5 y se muestra el valor final |
| Escribir letras o dejar vacío | Se restaura el valor anterior |
| Arrastrar el deslizador | Un solo paso de deshacer |
| Escribir el mismo valor | Ningún paso nuevo |
| Texto bloqueado | Controles deshabilitados |
| Texto de una plantilla antigua | Anclaje activo «Centro» |

## 5. Fidelidad en Chrome (lienzo = PDF)

```bash
cd backend && npx vitest run tests/integration/pdf-template-fidelity.test.ts tests/integration/print-overflow.test.ts
```

Esperado: con altura de línea 0,5 / 1,37 / 2,5, espaciado −10 / 60 y anclaje arriba / centro / abajo, los cortes de línea y la posición del texto del PDF coinciden con los del lienzo en las plantillas base (SC-003), y un texto con ajuste automático sigue cabiendo en su caja.

## 6. Revisión manual (≈ 3 min)

1. Abrir una plantilla, seleccionar un título de varias líneas y abrir «Configuración avanzada».
2. Mover los tres ajustes; el lienzo cambia en menos de 0,2 s.
3. Guardar, recargar, generar el PDF y comparar con el lienzo.

## Resultados de la validación (2026-10-22)

| Verificación | Resultado |
|--------------|-----------|
| §1 Línea base byte a byte (T027) | 8 de 8 PDF **idénticos** a los capturados con el commit `4b4f704` |
| §2–§4 Esquema, render, inspector y panel | Pruebas verdes: frontend 798 y backend 1108 (`tsc` limpio en ambos) |
| §5 Fidelidad en Chrome | Altura de línea 0,5 / 1,37 / 2,5, espaciado −10 / 0 / 33,3 / 60 y anclaje arriba / centro / abajo coinciden con el documento; borde del texto a < 0,5 % de la caja |
| SC-005 (< 0,2 s) | Sin medición cronometrada: cada parche vuelve a dibujar solo el elemento editado (`TemplateElement` memorizado) |
| §6 Revisión manual (T029) | Hecha el 2026-10-22 en Chrome con datos temporales (servidor aparte, `DATA_DIR` nuevo, Alegra simulado): altura de línea `1,37` y `9` (⇒ 2,5), espaciado 60 y 4 px, anclaje Arriba/Abajo (texto pegado al borde a 0 px), guardar, recargar (valores y anclaje intactos) y vista previa con los mismos valores. Con altura 2,5 y espaciado 60 a la vez sobre un título largo la letra llega al mínimo del ajuste automático y el texto se sale de su caja: es la combinación extrema y se espera, no un fallo. Pendiente: generar el PDF con productos reales (cubierto por las pruebas de Chrome) y el cronometraje de SC-005 |

