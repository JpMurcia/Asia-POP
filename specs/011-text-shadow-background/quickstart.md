# Quickstart: validar sombra y fondo del texto

Requisitos: `npm install` hecho y `frontend/dist` reconstruido (`npx vite build` en `frontend/`) antes de las pruebas de Chrome del backend.

## 1. Compatibilidad (lo primero)

Capturar la línea base de PDFs **antes** de tocar código y compararla al final:

```bash
cd backend && BASELINE_DIR=<carpeta> npx tsx tests/fixtures/pdf-baseline.ts capture
cd backend && BASELINE_DIR=<carpeta> npx tsx tests/fixtures/pdf-baseline.ts compare
```

Esperado: 8 de 8 PDF **idénticos** (SC-001, FR-011): ninguna plantilla base usa los efectos.

## 2. Esquema y valores por defecto

```bash
cd backend && npx vitest run tests/unit/template-schema-011.test.ts
```

Esperado: una plantilla sin los campos se acepta; un valor fuera de rango (`shBlur: 99`, `bgAlpha: -1`) o un color inválido se rechaza con mensaje; los once campos sobreviven a guardar y leer (no los descarta zod).

## 3. Cálculos puros

```bash
cd frontend && npx vitest run tests/text-effects.test.ts
```

Esperado: `withAlpha('#FF0000', 50)` da `rgba(255,0,0,0.5)`; `transparent` y colores inválidos no fallan; el ángulo 0 produce `dx = dist, dy = 0` y el 90 `dx ≈ 0, dy = dist`; la sombra se arma después del resplandor.

## 4. Render e inspector

```bash
cd frontend && npx vitest run tests/text-shadow-background.test.tsx
```

Esperado: sin efectos, el HTML del texto es el de antes (sin `<span>` de fondo, sin `textShadow` nuevo); con sombra aparece en el estilo; con fondo aparece el `<span>`; los controles del inspector aparecen al encender cada interruptor, un cambio es un solo paso de deshacer, y con el elemento bloqueado están deshabilitados.

## 5. Fidelidad lienzo/PDF (Chrome real)

```bash
cd backend && npx vitest run tests/integration/pdf-template-fidelity.test.ts
```

Esperado: un texto con sombra y fondo se ve igual en el lienzo y en el PDF (misma posición y cortes de línea), incluido uno con datos insertables y texto largo.

## 6. Revisión manual

1. Abrir el editor con datos temporales (servidor aparte, `DATA_DIR` temporal).
2. Poner un título sobre una foto clara → **Sombra** → verlo legible en menos de 30 s (SC-003).
3. **Fondo** → variar redondez y separación con un texto de dos líneas → el fondo sigue cada línea.
4. Guardar, recargar, duplicar y deshacer → los parámetros se conservan (SC-006).
5. Panel «Elementos» → «Agregar subtítulo» → queda entre el título y el texto en tamaño.
6. Generar el PDF y compararlo con el lienzo.
