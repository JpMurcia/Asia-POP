# Quickstart: validar el texto estilo Canva

Requisitos: `npm install` hecho y `frontend/dist` reconstruido (`npx vite build` en `frontend/`) antes de las pruebas de Chrome del backend.

## 1. Compatibilidad (lo primero)

```bash
cd backend && BASELINE_DIR=<carpeta> npx tsx tests/fixtures/pdf-baseline.ts capture   # antes de tocar código
cd backend && BASELINE_DIR=<carpeta> npx tsx tests/fixtures/pdf-baseline.ts compare   # al final
```

Esperado: 8 de 8 PDF **idénticos** (SC-001).

## 2. Esquema

```bash
cd backend && npx vitest run tests/unit/template-schema-012.test.ts
```

Esperado: plantilla sin campos válida; los campos nuevos sobreviven a validar; fuera de rango o color inválido se rechazan; `align: 'justify'` se acepta.

## 3. Cálculos puros

```bash
cd frontend && npx vitest run tests/text-format.test.ts tests/text-effects.test.ts
```

Esperado: `listLines` numera solo líneas no vacías; `arcPath` da recto con 0 y arco hacia arriba/abajo según el signo; `effectsCss` respeta el orden fijo; `pickStyle` no copia contenido, posición, tamaño ni nombre.

## 4. Render, cuadrícula y copiar estilo

```bash
cd frontend && npx vitest run tests/text-styles-012.test.tsx tests/text-shadow-background.test.tsx
```

## 5. Fidelidad lienzo/PDF (Chrome real)

```bash
cd backend && npx vitest run tests/integration/pdf-template-fidelity.test.ts -t "feature 012"
```

Esperado: cursiva, subrayado, justificado, lista, cada efecto, todos a la vez y curvar se ven igual en el lienzo y en el PDF.

## 6. Revisión manual

1. Abrir el editor con datos temporales (servidor aparte, `DATA_DIR` temporal).
2. Un texto de tres líneas: cursiva, subrayado, justificado, viñetas, numerada.
3. Panel «Efectos»: probar cada celda, combinar dos, «Ninguno».
4. Curvar un título a +60 y −60.
5. Copiar estilo de un texto a otro; deshacer en un paso.
6. Guardar, recargar, generar el PDF y comparar con el lienzo.
