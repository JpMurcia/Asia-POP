# Quickstart: validar los ajustes avanzados de texto

Requisitos: `npm install` hecho, `frontend/dist` reconstruido (`npx vite build` en `frontend/`) antes de las pruebas del backend que usan Chrome.

## 1. Compatibilidad (lo primero)

```bash
cd backend && npx vitest run tests/unit
cd backend && npx tsx tests/fixtures/pdf-baseline.ts
```

Esperado: los 8 PDF de la línea base de la 007 salen **idénticos** (SC-001, SC-007) y la plantilla `base` (010) también.

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
