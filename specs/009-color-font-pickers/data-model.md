# Data Model: Selectores de color y de fuente

No hay tablas, migraciones ni campos nuevos en la plantilla. Los formatos guardados no cambian; todo lo nuevo se **calcula** al abrir un selector y se descarta al cerrarlo.

## Formatos guardados (sin cambios)

| Dato | Tipo | Valores |
|------|------|---------|
| `ColorRef` | cadena | una clave de la paleta (`bg`, `a1`, `a2`, `a3`, `ink`, `paper`), `#RRGGBB`, `transparent` o `none` donde el campo lo permite |
| `FontRef` | cadena | `title`, `body` o una familia: `fredoka`, `poppins`, `bungee`, `zen`, `grotesk`, `serif` |

Regla de escritura (FR-004, FR-013): elegir un color de la paleta guarda **la clave**; elegir cualquier otro guarda `#RRGGBB` **en mayúsculas**; elegir «Título» o «Cuerpo» guarda la referencia, no la familia.

## Entidades calculadas

### ColorOption

| Campo | Descripción |
|-------|-------------|
| `value` | lo que se guardaría: clave de la paleta o `#RRGGBB` |
| `hex` | el color resuelto, `#RRGGBB` en mayúsculas (para la muestra y para comparar) |
| `label` | nombre visible: «Acento 1», «Rojo» o el propio código |
| `group` | `plantilla` (paleta + libres usados), `basico`, `ninguno` |

- **Activo**: la opción cuyo `value` es igual al del elemento; si el elemento guarda un `#RRGGBB` que coincide con un color de la paleta, se marca esa clave (se comparan códigos normalizados).
- **Libres usados**: `#RRGGBB` normalizados que aparecen en cualquier página (fondo o elemento) y **no** coinciden con un color de la paleta; sin repetir, en orden de primer uso; claves `text`, `name`, `id`, `src` excluidas. Hasta 18 visibles; el resto detrás de «Ver todos (N)».
- **Opciones especiales**: «Ninguno» (`none`) o «Transparente» (`transparent`) solo cuando el campo ya las tiene (descriptor `none`).

### FontOption

| Campo | Descripción |
|-------|-------------|
| `value` | `title`, `body` o la familia |
| `label` | «Título · Fredoka», «Cuerpo · Poppins» o el nombre de la familia |
| `stack` | la pila tipográfica con que se dibuja el nombre (`FONT_STACKS` de la familia resuelta) |
| `group` | `plantilla` («Título», «Cuerpo» y las familias que los elementos usan) o `todas` (las seis) |

- **Activa**: la opción cuyo `value` coincide con el del elemento; «Título» o «Cuerpo» solo si el elemento guarda esa referencia.
- Las familias de «Fuentes de la plantilla» salen de la propiedad `font` de textos e insignias de todas las páginas, sin repetir; pueden aparecer también en «Todas las fuentes».

## Normalización y búsqueda

- `normalizeHex(texto)` → `#RRGGBB` mayúsculas o `null`: acepta `#` opcional, 3 o 6 dígitos hexadecimales, mayúsculas o minúsculas, espacios alrededor.
- `foldText(texto)` → minúsculas y sin diacríticos (`NFD`); la búsqueda por nombre compara con «contiene».
- Colores básicos fijos (nombre → código): Rojo `#E53935`, Naranja `#FB8C00`, Amarillo `#FDD835`, Verde `#43A047`, Azul `#1E88E5`, Morado `#8E24AA`, Rosado `#EC407A`, Negro `#000000`, Gris `#9E9E9E`, Blanco `#FFFFFF`.

## Estado del selector (no se guarda)

| Estado | Valor inicial | Notas |
|--------|---------------|-------|
| abierto | `false` | un selector abierto a la vez en todo el inspector |
| texto de búsqueda | vacío | se limpia al cerrar |
| «Ver todos» | cerrado | por selector, solo si hay más de 18 libres |
| mensaje de código inválido | ninguno | se muestra y se borra al seguir escribiendo |

## Transiciones del historial

`elegir opción` → parche `{ [clave]: valor }` → (si ya es el valor activo: sin cambio, sin historial) → un paso de deshacer. Mover el selector gráfico dentro del panel se agrupa por `mergeKey` en un solo paso.
