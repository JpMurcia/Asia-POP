# Data Model: Elementos y formas estilo Canva

Sin tablas ni migraciones: son campos **opcionales** de los elementos de la plantilla (JSON, `version: 1`). Ausente = como antes.

## Forma (`ShapeEl`)

| Campo | Tipo | Rango / valores | Por defecto si falta | Notas |
| --- | --- | --- | --- | --- |
| `kind` | enum | `rect` · `circle` · `pill` · **`triangle` · `diamond` · `star` · `burst` · `arrow` · `bubble` · `line`** | — (obligatorio, ya existía) | Los nuevos valores amplían el enum. |
| `bs` | enum | `solid` · `dashed` · `dotted` | `solid` | Estilo del borde (en `line`, de la línea). |
| `capStart`, `capEnd` | enum | `none` · `arrow` · `circle` · `square` · `diamond` | `none` | Solo con `kind: 'line'`. |
| `flipH`, `flipV` | boolean | — | `false` | Voltear horizontal y vertical. |
| `lockAspect` | boolean | — | `false` | Solo editor. |
| `href` | string | `''` o `http(s)://…` sin espacios, ≤ 2000 | sin enlace | |

Campos ya existentes con sentido nuevo en `kind: 'line'`: `fill` = color de la línea; `bw` = grosor (se dibuja con mínimo 1; el rango sigue siendo 0–12); `border`, `radius` y `glow` no se usan (se conservan si ya estaban).

## Imagen (`ImageEl`)

`flipH`, `flipV`, `lockAspect`, `href`: mismos tipos y valores que en la forma.

## Texto (`TextEl`) e insignia (`BadgeEl`)

Solo `href`.

## Constantes (únicas, en `template.ts`)

- `SHAPE_KINDS`, `BORDER_STYLES`, `LINE_CAPS` (listas cerradas, las comparten el esquema y el inspector).
- `LINK_MAX = 2000` y `LINK_RE = /^https?:\/\/\S+$/i`.
- `SHAPE_DEFAULTS = { bs: 'solid', capStart: 'none', capEnd: 'none' }`.

## Reglas de validación (esquema)

- Cada campo nuevo se declara en `template.schema.ts` (zod descarta las claves desconocidas).
- `href` fuera de `''` / `LINK_RE` o de más de 2000 caracteres → error «El enlace debe empezar con http:// o https:// y no tener espacios.»
- `flipH`, `flipV` y `lockAspect` solo en forma e imagen; no existen en los demás tipos.

## Estado del editor (no se guarda)

Ninguno nuevo: el bloqueo de proporción viaja con el elemento. El reductor deriva `w` / `h` cuando el elemento tiene `lockAspect` y el parche trae solo uno de los dos.

## Transiciones

- Cambiar `kind` de una forma conserva relleno, borde, grosor, posición y tamaño; una forma no se convierte en `line` desde el inspector (la línea se agrega desde «Elementos»).
- Quitar un enlace (campo vacío) elimina `href`.
