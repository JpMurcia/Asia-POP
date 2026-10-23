# Quickstart: validar «Elementos y formas estilo Canva»

## 1. Compatibilidad (lo primero)

1. Línea base de PDFs **antes** de tocar código (ya capturada): `BASELINE_DIR=%TEMP%\asiapop-baseline-013`, commit `8eacd38`, 8 PDF.
2. Al terminar: `npx vite build` en `frontend/` y `BASELINE_DIR=<esa carpeta> npx tsx tests/fixtures/pdf-baseline.ts compare` en `backend/` → las 8 salidas **idénticas** (SC-001).

## 2. Esquema

`npx vitest run tests/unit/template-schema-013.test.ts` en `backend/`: plantilla sin campos válida; los campos sobreviven; tipos de forma, `bs` y extremos aceptados; valores fuera de lista rechazados; `href` válido, vacío, con `javascript:`, sin protocolo, con espacios y de más de 2000 caracteres.

## 3. Cálculos puros

`npx vitest run tests/shapes.test.ts tests/lock-aspect.test.ts` en `frontend/`: contorno de cada figura dentro de la caja, geometría de la línea con y sin extremos, guiones por estilo; `lockedSize` con solo ancho, solo alto, recorte a los límites.

## 4. Render, inspector y panel

`npx vitest run tests/shapes-013.test.tsx` en `frontend/`: sin campos nuevos el marcado es el de siempre; cada figura se dibuja como `<svg>`; borde y guiones; línea con extremos; volteo con y sin giro; `<a>` solo con enlace; el inspector, el panel «Elementos», un cambio = un paso de deshacer y el bloqueo deshabilita.

## 5. Fidelidad lienzo/PDF (Chrome real)

`npx vitest run tests/integration/pdf-template-fidelity.test.ts -t "feature 013"` en `backend/`: cada figura, borde, línea con extremos, volteo con giro y un enlace (la anotación de enlace existe en el PDF) se ven igual en el lienzo y en el PDF.

## 6. Revisión manual

1. Abrir el editor con datos temporales (servidor aparte, `DATA_DIR` temporal).
2. «Elementos» → agregar cada forma nueva; cambiar el tipo, el relleno y el borde (sólido, discontinuo, punteado).
3. Agregar «Línea»: color, grosor, estilo y extremos; girarla.
4. Voltear una flecha y una imagen en cada eje.
5. Activar «Bloquear proporción» y redimensionar con la manija y con los campos.
6. Poner un enlace a un texto y a una imagen; en el editor solo selecciona.
7. Guardar, recargar, generar el PDF y comprobar el enlace con un lector de PDF.
