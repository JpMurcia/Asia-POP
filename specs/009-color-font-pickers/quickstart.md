# Quickstart: validar los selectores de color y de fuente

Requisitos: `npm install` hecho y `frontend/dist` reconstruido (`npx vite build` en `frontend/`) antes de las pruebas de Chrome del backend.

## 1. Compatibilidad (lo primero)

Capturar la línea base de PDFs **antes** de tocar código y compararla al final (la de la 007 ya no sirve):

```bash
cd backend && BASELINE_DIR=<carpeta> npx tsx tests/fixtures/pdf-baseline.ts capture
cd backend && BASELINE_DIR=<carpeta> npx tsx tests/fixtures/pdf-baseline.ts compare
```

Esperado: 8 de 8 PDF **idénticos** (SC-001, FR-017). Esta feature no toca el render.

> **Punto de partida (T001)**: línea base capturada el 2026-10-22 con el commit `77f5690` (8 PDF: 4 plantillas × normal y largo); se compara en T024.

## 2. Cálculos puros

```bash
cd frontend && npx vitest run tests/template-colors.test.ts
```

Esperado: `normalizeHex` acepta `e91e8c`, `#E91E8C`, `#e91`; rechaza `#12` y `zzz`; `usedColors` no repite (`#abc` ≡ `#AABBCC`), omite lo que coincide con la paleta y respeta el orden de primer uso; la búsqueda ignora mayúsculas y tildes.

## 3. Selector de color

```bash
cd frontend && npx vitest run tests/color-picker.test.tsx
```

| Caso | Resultado |
|------|-----------|
| Plantilla con dos colores libres | «Colores de la plantilla» muestra la paleta y ambos, sin repetir |
| Elegir un color de la paleta | se guarda la clave; sigue a la paleta si cambia |
| Elegir un color libre | se guarda `#RRGGBB` en mayúsculas, un paso de deshacer |
| Elegir el color activo | no agrega paso |
| Escribir `e91e8c` o `#e91` + Enter | aplica el color |
| Escribir `#12` o `zzz` | mensaje «El código de color no es válido» y no cambia nada |
| Buscar «acento» o «azul» | solo las coincidencias; sin resultados: mensaje y «Limpiar búsqueda» |
| Más de 18 libres | «Ver todos (N)» |
| «Ninguno» / «Transparente» | siguen disponibles y marcadas |
| Cuentagotas | aparece solo con `EyeDropper`; aplica el color; Escape lo cancela |
| Selector gráfico | sigue disponible; arrastrar es un solo paso |
| Elemento bloqueado | el botón queda deshabilitado con su indicación |

## 4. Selector de fuente

```bash
cd frontend && npx vitest run tests/font-picker.test.tsx
```

| Caso | Resultado |
|------|-----------|
| Abrir el selector | cada familia escrita con su tipografía; la activa con marca |
| Orden | «Fuentes de la plantilla» primero, luego «Todas las fuentes» (las seis) |
| Elegir «Título» o «Cuerpo» | se guarda `title` o `body`, no la familia |
| Elegir una familia | se guarda la familia; elegir la activa no agrega paso |
| Buscar «zen» o «dm» | filtra sin importar mayúsculas ni tildes; sin resultados: mensaje |

## 5. Teclado y accesibilidad

Esperado: abrir con Enter, recorrer con Tab, aplicar con Enter, cerrar con Escape y volver el foco al botón; el botón y el panel anuncian el valor activo (SC-007, FR-018).

## 6. Regresión del inspector

```bash
cd frontend && npx vitest run && npx tsc --noEmit
cd backend && npx vitest run
```

Esperado: todo en verde; las pruebas que buscaban cuadritos y listas se actualizaron para abrir el selector (ninguna capacidad se pierde, SC-005).

## 7. Revisión manual (≈ 5 min)

1. Abrir una plantilla, seleccionar un título y abrir «Relleno».
2. Ver «Colores de la plantilla»; elegir uno; escribir `#E91E8C`; usar el cuentagotas sobre una foto.
3. Abrir «Fuente»: comprobar que se ven las seis y elegir una.
4. Guardar, recargar, generar el PDF y comparar con el lienzo.

## Resultados de la validación (2026-10-22)

| Verificación | Resultado |
|--------------|-----------|
| §1 Línea base byte a byte (T024) | 8 de 8 PDF **idénticos** a los capturados con el commit `77f5690` |
| §2–§5 Cálculos, selectores, teclado y accesibilidad | Pruebas verdes: frontend 890 y backend 1108 (`tsc` limpio en ambos); los archivos de Chrome que fallaron por carga pasan solos |
| SC-005 (ninguna capacidad se pierde) | Recorrido de cada descriptor de color y de fuente de cada tipo de elemento en las cinco plantillas base: paleta completa, selector gráfico y «Ninguno»/«Transparente» solo donde el campo las tiene |
| SC-008 (abrir y guardar no cambia nada) | Elegir el valor ya activo en cada propiedad de color y fuente de las cinco plantillas no cambia el estado ni lo marca como modificado |
| SC-006 (< 0,2 s) | Reunir los colores de una plantilla de 200 elementos tarda mucho menos de 100 ms (prueba con tope de 100 ms) |
| §7 Revisión manual (T027) | Hecha el 2026-10-22 en Chrome con datos temporales: «Colores de la plantilla» con la paleta y los libres usados, `#e91` propuesto como `#EE9911` y aplicado con Enter, `zzz` con «El código de color no es válido» sin cambiar el color, Escape cierra y devuelve el foco, cuentagotas visible (Chrome tiene `EyeDropper`; no se tomó un color real de la pantalla), selector de fuente con cada familia en su tipografía y ✓ en la activa, Bungee aplicada al lienzo, y con el elemento bloqueado ambos botones deshabilitados con su indicación. Pendiente: probar el cuentagotas sobre una foto real |

