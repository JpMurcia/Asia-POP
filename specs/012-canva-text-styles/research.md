# Research: Texto estilo Canva

Evidencia de Canva: `docs/specs/rea-evidence/02-texto-seleccionado.png`, `03-efectos.png`, `10-panel-efectos.png` (solo interfaz dibujada; los rangos de los efectos **no** se midieron).

## D1. Efectos como indicadores combinables, no un selector único

- **Decisión**: un indicador booleano por efecto, combinables; «Ninguno» los apaga todos.
- **Razón**: ya existen Sombra, Fondo, Contorno y Neón como propiedades independientes (011 y anteriores) y las plantillas base usan el neón; un selector único obligaría a migrar. La cuadrícula las presenta como Canva y deja combinar (más flexible que Canva).
- **Alternativa descartada**: un campo `effect` único (rompe plantillas guardadas y la combinación sombra + fondo de la 011).

## D2. Parámetros compartidos

- **Decisión**: `fxColor`, `fxColor2`, `fxDist`, `fxI` compartidos por Brillo, Eco, Desalineado y Distorsión.
- **Razón**: evita ~16 campos; el efecto activo muestra solo los suyos. Si se activan dos efectos que comparten parámetro, comparten valor (se documenta).

## D3. Cómo se dibuja cada efecto (todo `text-shadow` o contorno)

| Efecto | Dibujo |
|---|---|
| Brillo | `0 0 (fxI·0,3)px c, 0 0 (fxI·0,6)px c` con `c = fxColor` (más suave que el neón, que tiene 10 y 24 px fijos) |
| Eco | tres copias hacia abajo-derecha a 1×, 2× y 3× `fxDist`, con 60 %, 40 % y 20 % de opacidad |
| Desalineado | dos copias de un color, a (+d, +d) y (−d, −d), con 60 % de opacidad |
| Distorsión | copia `fxColor` a (+d, 0) y copia `fxColor2` a (−d, 0), nítidas (efecto «glitch») |
| Sin relleno | `color: transparent` + borde del texto (`-webkit-text-stroke`) |

Medidas escaladas con `--fit`, igual que la sombra de la 011.

## D4. Justificado

- `text-align: justify` y la caja con ancho completo. La última línea queda a la izquierda (comportamiento de CSS y de Canva).

## D5. Listas

- **Decisión**: una línea no vacía = un elemento; marcador como texto («•» o «N.») con sangría francesa (`padding-left: 1.4em; text-indent: -1.4em`). Las líneas vacías se conservan como espacio sin marcador y no cuentan en la numeración.
- **Razón**: `list-style` depende del motor y de `display`; el texto es idéntico en lienzo y PDF.
- **Alternativa descartada**: `<ul>/<ol>` reales (cambian el flujo con `pre-wrap` y rompen la medida de `FitText`).

## D6. Curvar

- **Decisión**: `<svg>` de las dimensiones de la caja con un `<path>` de arco circular y `<text><textPath startOffset="50%" text-anchor="middle">`. La flecha (sagita) es `|curve|/100 · ancho · 0,35`; el signo decide si el arco sube o baja. Solo la primera línea.
- **Sombra**: `filter: drop-shadow` calculado desde la misma lista que `text-shadow` (Chrome no aplica `text-shadow` de forma fiable al texto SVG). El desenfoque se aproxima y se documenta.
- **Sin relleno / contorno**: `fill`, `stroke` y `paint-order` de SVG.
- **Sin `FitText`**: un texto curvo usa `el.size` tal cual.
- **Alternativas descartadas**: transformar cada letra con CSS (frágil con el kerning); canvas (no es texto en el PDF).

## D7. Copiar estilo

- **Decisión**: estado `styleBrush` en el reductor; la brocha se activa con un botón del inspector; con ella activa, un clic en otro texto del lienzo aplica `pickStyle(brush)` como un parche único; Escape o clic en vacío la cancela.
- **Razón**: reutiliza el parche y el historial existentes; no necesita portapapeles.

## D8. Cursiva sintética

- Las fuentes son locales y sin variante cursiva; `font-style: italic` inclina de forma sintética en el navegador y en Chrome sin cabeza (PDF). Se verifica en Chrome real.

## Riesgos

- **R1 — `FitText` con listas y justificado**: cambian la altura; `useFit` depende de los campos nuevos. Prueba en Chrome real con un texto con datos y lista.
- **R2 — Arco recortado por la caja**: el SVG usa `overflow: visible` para que el arco y la sombra no se corten.
- **R3 — Efectos que se pisan**: el orden fijo y una prueba que los activa todos a la vez (sin error, mismo resultado en lienzo y PDF).
- **R4 — Pruebas de la 011**: los interruptores «Sombra» y «Fondo» pasan a ser botones de la cuadrícula; hay que ajustarlas.
- **R5 — Vista previa «Ag» de la cuadrícula**: usa la misma función de estilos que el render real para no divergir.
