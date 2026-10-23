# Data Model: Texto estilo Canva

No hay tablas ni migraciones. Todo vive en el JSON de la plantilla (`catalog_template.doc_json`, `version: 1`).

## TextEl — campos nuevos, todos opcionales

| Campo | Tipo | Rango / valores | Por defecto si falta |
|-------|------|-----------------|----------------------|
| `italic` | booleano | — | `false` |
| `underline` | booleano | — | `false` |
| `align` (ya existía) | `'left' \| 'center' \| 'right'` | **+ `'justify'`** | `center` (el valor ya es obligatorio) |
| `list` | `'none' \| 'bullet' \| 'number'` | — | `none` |
| `bright` | booleano | Brillo | `false` |
| `echo` | booleano | Eco | `false` |
| `misalign` | booleano | Desalineado | `false` |
| `glitch` | booleano | Distorsión | `false` |
| `hollow` | booleano | Sin relleno | `false` |
| `fxColor` | `ColorRef` | color de Brillo, Eco, Desalineado y primera copia de Distorsión | `a1` |
| `fxColor2` | `ColorRef` | segunda copia de Distorsión | `a2` |
| `fxDist` | número | 0 – 40 px (Eco, Desalineado, Distorsión) | 6 |
| `fxI` | número | 0 – 100 (intensidad del Brillo) | 50 |
| `curve` | número | −100 – 100 (0 = recto) | `0` |

Los parámetros `fx*` son **compartidos** entre los efectos que los usan (decisión de simplicidad); cada efecto lee solo los suyos.

## `TEXT_EFFECT_DEFAULTS` (ampliada)

Se agregan `fxColor: 'a1'`, `fxColor2: 'a2'`, `fxDist: 6`, `fxI: 50`. Único lugar donde viven.

## `RANGES`

Se agregan `fxDist: [0, 40]`, `fxI: [0, 100]` y `curve: [-100, 100]`.

## Reglas de validación (zod)

- Booleanos con el mensaje «Debe ser verdadero o falso.»; numéricos con `num(RANGES.x, 'La …')`; colores con `colorRef`; `list` con `oneOf`.
- `align` acepta también `'justify'`.
- Los campos **deben** declararse: `z.object` descarta las claves desconocidas.
- Un parámetro guardado con su efecto apagado se conserva (apagar y volver a encender no pierde los ajustes).

## Orden de dibujo (derivado, no se guarda)

`text-shadow` de atrás hacia delante: resplandor neón → brillo → eco → desalineado → distorsión → sombra. El fondo (`bg`) es un `<span>` detrás del texto. `hollow` pone el relleno `transparent` y dibuja el borde con el contorno del texto (si no hay contorno, usa el color del texto y 2 px).

## Estado del editor (no se guarda)

- `styleBrush`: `Partial<TextEl> | null` — el estilo copiado mientras la brocha está activa.

## Estilo copiable (`STYLE_KEYS`)

`font, size, weight, color, align, upper, ls, lh, strike, vAlign, italic, underline, list, stroke, strokeW, glow, shadow, shDist, shAngle, shBlur, shAlpha, shColor, bg, bgRadius, bgPad, bgAlpha, bgColor, bright, echo, misalign, glitch, hollow, fxColor, fxColor2, fxDist, fxI, curve`.

**Nunca se copian**: `id, name, text, x, y, w, h, rot, opacity, visible, locked`.

## Compatibilidad

- Una plantilla sin estos campos se lee como «sin formato nuevo» y se dibuja igual que antes (sin nodos extra).
- Duplicar y copiar/pegar conservan los campos (se clona o se parchea el elemento).
