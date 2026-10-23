# Research: Elementos y formas estilo Canva

Sin incógnitas abiertas: lo que REA no pudo medir se resolvió con valores propios (marcados «no verificado»).

## R1. Cómo dibujar las formas nuevas

- **Decisión**: `<svg>` con viewBox en px del tamaño real de la caja (`elementSize`) y un `<path>` calculado por `shapePath(kind, w, h)`.
- **Razón**: `clip-path` recorta el borde y el resplandor; un SVG da relleno, trazo (con guiones) y `drop-shadow` en un solo elemento y se imprime vectorial en el PDF.
- **Alternativas**: `clip-path: polygon()` (pierde el borde), imágenes PNG (no vectorial, recursos externos), `border-radius` (solo rectángulos).
- **Sin cambio de bytes**: `rect`, `circle` y `pill` mantienen su CSS exacto.

## R2. Borde dentro de la caja

- **Decisión**: el contorno de la figura se calcula con la caja reducida en el grosor (`w − bw`, `h − bw`) y se traslada `bw / 2`.
- **Razón**: el trazo SVG se centra sobre el contorno; así queda dentro de la caja como el `border` CSS y no cambia el tamaño visible entre tipos.

## R3. Estilos de trazo

- **Decisión**: sólido sin `stroke-dasharray`; discontinuo `3·g 2·g`; punteado `0 2·g` con `stroke-linecap: round` (g = grosor, mínimo 1). En CSS (`rect`, `circle`, `pill`): `border-style: dashed | dotted`.
- **Razón**: se parece a lo que Canva ofrece (sólido, discontinuo, punteado) con una fórmula sola y proporcional al grosor.

## R4. Línea como `kind` de la forma

- **Decisión**: `ShapeEl.kind: 'line'`; color en `fill`, grosor en `bw` (mínimo 1 al dibujar), estilo en `bs`, extremos en `capStart` / `capEnd`.
- **Razón**: un tipo de elemento nuevo obligaría a tocar el esquema por tipo, el inspector, la precarga de fuentes, el panel de capas y las pruebas; un `kind` reutiliza todo (mover, girar, voltear, bloquear, duplicar).
- **Extremos**: tamaño `s = 3·g + 4` px; ocupan los extremos de la caja y la línea recorre el resto. Flecha = triángulo relleno con la punta en el borde; círculo, cuadrado y rombo = figuras de ancho `s` centradas en la línea.
- **No verificado**: grosor máximo (12) y tamaño de los extremos, elegidos por nosotros.

## R5. Voltear

- **Decisión**: `flipH` / `flipV` en forma (incluida línea) e imagen; `transform: rotate(rot) scale(sx, sy)` en el contenedor.
- **Razón**: un solo punto de aplicación para forma e imagen, también en el PDF; sin volteo el `transform` es el de hoy.
- **Texto, insignia y bloques**: no se voltean (Canva tampoco voltea el texto; los bloques son automáticos).

## R6. Bloquear proporción

- **Decisión**: `lockAspect` guardado con el elemento, efecto solo en el editor. `lockedSize(origin, patch)` es una función pura: dado el parche con solo `w` o solo `h`, devuelve el par que conserva `origin.h / origin.w` (relación en % de la hoja, que ya incluye la proporción de la página), recortado a los rangos de `RANGES.w` y `RANGES.h` conservando la relación.
- **Razón**: la relación en % es constante bajo cualquier zoom, y un único punto (el reductor) cubre la manija y los campos numéricos.

## R7. Enlace

- **Decisión**: `href` opcional (texto, insignia, forma, imagen); `''` = sin enlace; solo `^https?://\S+$`, máximo 2000 caracteres. Con enlace, el cuerpo va dentro de un `<a>` de caja completa (`position: absolute; inset: 0; color: inherit; text-decoration: none`), `target="_blank"` y `rel="noopener noreferrer"`.
- **Razón**: Chrome genera la anotación de enlace del PDF a partir del `<a>`; sin enlace el DOM no cambia. En el editor, `pointer-events: none` en los `<a>` evita navegar.
- **Seguridad**: se rechaza cualquier protocolo que no sea `http`/`https` (`javascript:`, `data:`, `file:`).

## R8. Compatibilidad

- Todos los campos son opcionales: una plantilla antigua se lee igual y los PDF de las 4 plantillas base salen **idénticos byte a byte** (línea base `%TEMP%\asiapop-baseline-013`, commit `8eacd38`).
- Los divisores de las plantillas base son `rect` delgados y no se migran.
