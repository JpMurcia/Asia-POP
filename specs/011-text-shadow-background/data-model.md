# Data Model: Sombra y fondo del texto

No hay tablas ni migraciones. Todo vive en el JSON de la plantilla (`catalog_template.doc_json`, `version: 1`).

## TextEl (elemento de texto) — campos nuevos, todos opcionales

| Campo | Tipo | Rango | Por defecto si falta |
|-------|------|-------|----------------------|
| `shadow` | booleano | — | `false` (sin sombra) |
| `shDist` | número | 0 – 50 px | 6 |
| `shAngle` | número | −180 – 180° (0 = derecha, 90 = abajo) | 45 |
| `shBlur` | número | 0 – 50 px | 6 |
| `shAlpha` | número | 0 – 100 | 50 |
| `shColor` | `ColorRef` | clave de paleta o `#RRGGBB` | `#000000` |
| `bg` | booleano | — | `false` (sin fondo) |
| `bgRadius` | número | 0 – 50 px | 8 |
| `bgPad` | número | 0 – 40 px | 8 |
| `bgAlpha` | número | 0 – 100 | 100 |
| `bgColor` | `ColorRef` | clave de paleta o `#RRGGBB` | `bg` (color de papel de la paleta) |

## `TEXT_EFFECT_DEFAULTS`

Constante junto a `TEXT_DEFAULTS`, con los valores de la columna «Por defecto». Es el único lugar donde viven.

## `RANGES`

Se agregan `shDist`, `shAngle`, `shBlur`, `alpha` (compartido por `shAlpha` y `bgAlpha`), `bgRadius` y `bgPad` con los rangos de la tabla.

## Reglas de validación (zod, `template.schema.ts`)

- Cada campo se declara `.optional()`; los numéricos con `num(RANGES.x, 'El …')` y los colores con `colorRef`, con el mismo tipo de mensaje que el resto («La distancia de la sombra…», «La transparencia del fondo…»).
- Un valor fuera de rango o un color inválido se rechaza al guardar (FR-013).
- `z.object` descarta las claves desconocidas: los once campos **deben** declararse o se perderían al guardar.
- No se valida que los parámetros vengan solo con el interruptor encendido: un parámetro guardado con el interruptor apagado se conserva (permite apagar y volver a encender sin perder los ajustes).

## Compatibilidad

- Una plantilla sin estos campos se lee como «sin efectos» y se dibuja **exactamente** como antes (no se agrega ningún elemento HTML). Las 4 plantillas base no los usan.
- Duplicar, copiar y pegar un texto conserva los campos (se clona el elemento entero).
- Sin conversión ni migración.

## Estado del editor (no se guarda)

- Nada nuevo. Cada cambio de un control es un parche plano; un parche que no cambia el valor no agrega paso de historial y un arrastre del deslizador se agrupa por `mergeKey` (patrón de la 008).

## Render (derivado, no se guarda)

- **Sombra**: `dx = shDist·cos(shAngle)`, `dy = shDist·sin(shAngle)`; `textShadow: «dx dy blur color»` con el color con su transparencia aplicada, añadido después del resplandor si lo hay.
- **Fondo**: `<span>` en línea con `background: withAlpha(color, bgAlpha)`, `padding: bgPad`, `borderRadius: bgRadius`, `boxDecorationBreak: clone`. Todas las medidas en px se multiplican por `--fit`.
