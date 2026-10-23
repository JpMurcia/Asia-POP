# Research: Sombra y fondo del texto

Decisiones tomadas al planificar. Evidencia de Canva: `docs/specs/rea-evidence/10-panel-efectos.png` (solo la interfaz dibujada; los rangos de los efectos **no** se midieron).

## D1. Campos planos opcionales, no un objeto anidado

- **Decisión**: `shadow?: boolean`, `shDist`, `shAngle`, `shBlur`, `shAlpha`, `shColor`; `bg?: boolean`, `bgRadius`, `bgPad`, `bgAlpha`, `bgColor`.
- **Razón**: es el patrón de `lh`, `strike`, `vAlign` y `descLh`; el reductor del editor aplica parches planos y descarta los que no cambian nada (FR-012); los descriptores de campo del inspector (`range`, `color`, `toggle`) ya trabajan con una clave.
- **Alternativas**: objeto `{shadow: {...}}` (más ordenado, pero obliga a parches anidados y a otro caso en el historial); un solo campo `effect: 'none' | 'shadow' | 'bg'` (no permite combinar, FR-006).

## D2. Valores por defecto en un solo lugar

- **Decisión**: `TEXT_EFFECT_DEFAULTS` junto a `TEXT_DEFAULTS`: sombra `dist 6`, `angle 45` (0 = derecha, 90 = abajo), `blur 6`, `alpha 50`, color `#000000`; fondo `radius 8`, `pad 8`, `alpha 100`, color `bg` (clave de la paleta).
- **Razón**: al activar el interruptor solo se guarda `shadow: true`; el resto se lee del valor por defecto, como `lh`. Así la plantilla guarda solo lo que la persona cambió.
- **Observación**: la dirección se expresa como ángulo y el desplazamiento como distancia (patrón de Canva), y se convierten a `dx, dy` al dibujar.

## D3. Rangos (elección propia, no medidos)

| Campo | Rango | Paso de edición |
|---|---|---|
| `shDist` | 0 – 50 px | 1 |
| `shAngle` | −180 – 180° | 1 |
| `shBlur` | 0 – 50 px | 1 |
| `shAlpha`, `bgAlpha` | 0 – 100 | 1 |
| `bgRadius` | 0 – 50 px | 1 |
| `bgPad` | 0 – 40 px | 1 |

Las medidas en px se escalan con `--fit`, igual que el grosor del contorno, para que un texto reducido por `FitText` mantenga la proporción.

## D4. Transparencia como porcentaje, aplicada al color

- **Decisión**: ayudante puro `withAlpha(color, pct)` que convierte `#RRGGBB` a `rgba(r,g,b,a)`; `transparent` se queda como está.
- **Razón**: no se usa `opacity` (afectaría al texto entero) ni `color-mix` (el resultado debe ser idéntico en el lienzo y en el PDF sin depender de la versión del navegador).

## D5. Cómo dibujar el fondo

- **Decisión**: `<span>` en línea dentro de `.tpl-text`, con `background`, `padding` (`pad`), `border-radius` y `box-decoration-break: clone` (más su prefijo `-webkit-`).
- **Razón**: sigue cada línea de un texto de varias y se ajusta solo al contenido (FR-005). Un `background` en `.tpl-text` cubriría toda la caja, no el texto.
- **Sin efecto, sin `<span>`**: así el HTML y el PDF de hoy no cambian (FR-011).
- **Alternativas**: `::before` absoluto (no sigue varias líneas); `background` de la caja (cubre más de lo que el texto ocupa).

## D6. Sombra junto al resplandor

- **Decisión**: un solo `textShadow` con el resplandor primero y la sombra después, separados por coma. La sombra sale de las letras, no del fondo: una sombra de texto no pinta fuera de las letras.
- **Orden**: la sombra va **detrás** del resplandor para que el neón no quede tapado por una sombra oscura.

## D7. Estilos predeterminados

- **Hallazgo**: `ElementosPanel` ya ofrece «Agregar título» (fuente de título, 40 px, peso 700) y «Agregar texto» (fuente de cuerpo, 16 px, peso 400).
- **Decisión**: añadir «Agregar subtítulo» (fuente de cuerpo, 24 px, peso 700) para completar la jerarquía 40 / 24 / 16. No se crean estilos «vinculados»: un texto insertado es un texto normal (FR-008).
- **Alternativa descartada**: estilos globales editables de la plantilla (como los «estilos» de Canva): cambiaría el modelo y las plantillas; fuera de alcance (VI).

## D8. Panel de efectos

- **Decisión**: interruptores «Sombra» y «Fondo» con sus controles debajo, en la sección «Color y efectos». Apagar = «Ninguno».
- **Razón**: la cuadrícula con vista previa de Canva exige un componente nuevo y no aporta a quien edita pocas veces; se puede añadir después sin cambiar el modelo.

## Riesgos

- **R1 — `FitText` y el relleno del fondo**: el relleno lateral ensancha la línea y puede salirse de la caja o disparar la reducción de letra. Mitigación: incluir `shadow`, `bg`, `bgPad` en las dependencias de `useFit`, y una prueba con un texto de datos largo y fondo.
- **R2 — Sombra recortada en el borde de la página**: el PDF puede cortar un desenfoque que llega al borde. Mitigación: comprobarlo en la prueba de fidelidad; no se agrega margen extra.
- **R3 — Color `#RGB` o inválido**: `withAlpha` debe tolerarlo (devolver `transparent`). Cubierto en pruebas unitarias.
- **R4 — Texto bloqueado**: la 009 deshabilitó los selectores de color de un elemento bloqueado; los nuevos controles deben seguir esa regla.
