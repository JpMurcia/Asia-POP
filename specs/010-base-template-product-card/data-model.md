# Data Model: Plantilla «Base AsianPop» y foto-tarjeta generada

**Feature**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Research**: [research.md](research.md)

**Sin cambios de esquema SQLite.** La plantilla sigue guardándose como JSON (`catalog_template.doc_json`, `version: 1`). Todo lo nuevo es **opcional** en lo guardado, de modo que una plantilla anterior se lee igual y se dibuja idéntica (FR-015, FR-022).

## 1. Cambios en el modelo de plantilla (`backend/src/catalog/template.ts`)

### 1.1 Listas ampliadas

| Constante | Hoy | Después | Efecto |
| --- | --- | --- | --- |
| `BASE_IDS` | `neon`, `pop`, `kawaii`, `kraft` | + **`base`** | Quinta plantilla de fábrica «Base AsianPop» |
| `NAME_STYLES` | `separado`, `burbuja` | + **`tarjeta`** | El nombre va dentro de la foto-tarjeta |
| `ProductsLayout` | `alternado`, `tarjetas`, `lista` | + **`base`** | Geometría medida de la base |
| `SoldOutStyle` | `sello`, `cinta`, `gris` | + **`diagonal`** | Texto AGOTADO girado −45° con neón |
| `IMAGE_KEYS` | `logo`, `collage`, `marble`, `coverbg`, `frame` | + **`sparkle`**, **`chat`** | Íconos propios (estrella y contacto) |
| `ImageKey` | clave incluida | clave incluida **o** `upload:<archivo>` | Logo e ilustraciones subidos |

### 1.2 Campos nuevos de `ProductsEl` (todos opcionales)

| Campo | Tipo | Valor si falta (= hoy) | Usa `base` | Descripción |
| --- | --- | --- | --- | --- |
| `cardStyle` | `'plana' \| 'tarjeta'` | `'plana'` | `'tarjeta'` | Con `tarjeta` la foto es la imagen compuesta por el servidor (R1) y el nombre se dibuja dentro |
| `priceGlow` | `boolean` | `false` | `true` | Neón del precio (intensidad 100 de la base) |
| `soldGlow` | `boolean` | `false` | `true` | Neón de la cinta AGOTADO (intensidad 50) |
| `bubbleShadow` | `boolean` | `false` | `true` | Sombra suave bajo la burbuja |
| `descLh` | `number` (0,8 a 2,5) | ausente = interlineado actual de la burbuja | `1.4` | Interlineado de la descripción |

Los campos **ya existentes** se reutilizan sin cambio: `layout`, `cardFill`, `ring`, `ringW`, `cardRadius`, `bubbleFill`, `bubbleRadius`, `textColor`, `priceFill`, `priceBorder`, `priceText`, `priceShape`, `sold`, `soldFill`, `photoW`, `photoH`, `nameStyle`, `nameColor`, `nameFill`, `nameGlow`.

### 1.3 Valores de la plantilla «Base AsianPop» (`id: 'base'`, `base: 'base'`)

**Paleta** (las seis claves del modelo):

| Clave | Valor | Uso |
| --- | --- | --- |
| `bg` | `#11052C` | Fondo oscuro de la tarjeta (misma base que Neón Noche) |
| `a1` | `#C04B0F` | Precio (naranja de la base) |
| `a2` | `#FF3131` | Cinta AGOTADO (rojo brillante) |
| `a3` | `#E7DECF` | Burbuja (beige de la base) |
| `ink` | `#000000` | Texto de títulos y descripción |
| `paper` | `#FAFAFA` | Fondo claro (mármol) |

**Tipografías**: título y cuerpo `poppins`.

**Bloque de productos** (página «Productos»): `layout: 'base'`, `cardStyle: 'tarjeta'`, `nameStyle: 'tarjeta'`, `nameColor: 'a1'` con `nameGlow: true`, `cardFill: 'bg'`, `cardRadius` ≈ 18 (esquinas redondeadas), `ringW: 0`, `bubbleFill: 'a3'`, `bubbleRadius: 51`, `bubbleShadow: true`, `textColor: 'ink'`, `priceFill: '#1F021D'`, `priceText: 'a1'`, `priceGlow: true`, `priceShape: 'pill'`, `sold: 'diagonal'`, `soldFill: 'a2'`, `soldGlow: true`, `descLh: 1.4`.

**Elementos de la página «Productos»**: fondo `marble`; título `CATÁLOGO {seccion}` en Poppins 32 negrita, mayúsculas, centrado (X 24,05 %, Y 2,56 %, ancho 51,95 %); logo cuadrado de 4,06 cm a 0,3 cm del borde superior y derecho; estrellas y manchas decorativas (`sparkle` y formas circulares con baja opacidad); el bloque automático de productos.

**Páginas «Portada» y «Portada de sección»**: fondo `coverbg` con título grande en mayúsculas (`{banner}` / `{seccion}`), logo, ilustración subida opcional y contacto «Domicilios» + `{telefonos}` con el ícono `chat`. Posiciones y tamaños definidos con diseño razonable (no medidos, R9). **Página «Políticas»**: igual que la de las otras plantillas con la paleta de `base`.

### 1.4 `normalizeProductsBlocks` (`template-presets.ts`)

Se amplía para completar los cinco campos nuevos con el valor de hoy en plantillas guardadas antes de esta feature. Sigue siendo **pura e idempotente**: no toca campos presentes y no escribe en la base de datos.

### 1.5 Validación (`template.schema.ts`)

- `cardStyle` ∈ `plana` | `tarjeta`; `priceGlow`, `soldGlow`, `bubbleShadow` booleanos; `descLh` dentro de `RANGES.lh`.
- `layout`, `nameStyle`, `sold` aceptan los valores nuevos.
- `ImageEl.src`: clave incluida o `^upload:[A-Za-z0-9._-]+$` (rechaza `..` y separadores).
- Un valor fuera de rango se rechaza al guardar con el mismo tipo de mensaje de validación de la 003 (FR de consistencia con 007 FR-016).

## 2. Geometría de la distribución `base` (`template-layout.ts`)

Entrada: ancho y alto del bloque (en unidades lógicas de la página) y las opciones existentes. Salida: el mismo `RowLayout[]` (`photo`, `bubble`, `price`, `align`, y `name` cuando corresponde). Fracciones de la hoja **(W = 21 cm, H = 29,7 cm)**:

| Elemento | Izquierda (filas 1 y 3) | Derecha (fila 2) |
| --- | --- | --- |
| `photo` (w × h) | 29,05 % × 27,04 % | igual |
| `photo` (x) | 14,95 % | ≈ 50,5 % |
| `photo` (y por fila) | ≈ 11,1 % · — · 68,6 % | ≈ 39,7 % (paso ≈ 28,7 %) |
| `bubble` (w × h) | 50,4 % × 17,3 % | igual |
| `bubble` (x) | 31,2 % | ≈ 12,9 % |
| `bubble` (y) | `photo.y` + 5,2 % | igual |
| `price` (w × h, centro x) | 16,4 % × 3,6 %, centro 60,1 % | centro ≈ 33,3 % |
| `price` (y) | `bubble.y` + 17,3 % | igual |
| `name` (con `nameStyle: 'tarjeta'`) | dentro de `photo`: franja superior del 18 % del alto, con margen del 5 % del ancho | igual |

Reglas: `align: 'center'` en ambas; con **1 o 2 productos** las filas se **centran verticalmente** en la hoja útil (sin huecos, FR-015). Las posiciones marcadas con ≈ se confirman con REA (research R4).

## 3. Entidades de ejecución (no se guardan en la base de datos)

### 3.1 `PhotoBackdrop`

`'marco' | 'sin-fondo'`. Opción de la generación (research R7). Por defecto `marco` («Dejar como está»).

### 3.2 `CardSpec` (entrada de la composición)

| Campo | Descripción |
| --- | --- |
| `source` | Archivo local de la foto (caché de Alegra o subida del responsable) |
| `w`, `h` | Píxeles de la tarjeta = recuadro de la foto a 150 ppp (`photoTarget` ampliado) |
| `fill` | Color de fondo de la tarjeta (`cardFill` resuelto con la paleta) |
| `backdrop` | `PhotoBackdrop` pedido |

### 3.3 `CardResult` (salida)

| Campo | Descripción |
| --- | --- |
| `url` | `/media/cards/<sha1>.jpg` |
| `used` | `'marco'` o `'sin-fondo'`: el modo que **realmente** se aplicó |
| `fellBack` | `true` si se pidió `sin-fondo` y se usó `marco`; con `reason`: `border_not_uniform` · `subject_too_small` · `subject_too_large` · `subject_cut` · `multiple_subjects` · `error` |

Reglas de la composición (determinista):
1. Lienzo `w × h` con el color `fill`.
2. Franja superior libre del 18 % del alto (para el nombre).
3. **`marco`**: fondo = la foto a todo el lienzo, desenfocada (σ ≈ 12 % del ancho) y oscurecida hacia `fill`; encima, la foto completa («inside», sin deformar) con marco claro `#F4EFE6` de ≈ 3 % del ancho y esquinas redondeadas, centrada en la zona inferior.
4. **`sin-fondo`**: el producto recortado (R2), centrado en la zona inferior sobre `fill`, aplanado y guardado como JPEG; si la confianza falla, se aplica `marco`.
5. JPEG calidad 88, submuestreo 4:4:4; cada `CardResult` se registra en la caché (clave en research R3).

### 3.4 `JobState.backdropFallbacks`

`{ item: string }[]` — productos cuya tarjeta cayó al modo seguro. Solo en `done`, solo si hay alguno, como `textOverflow` de la 007. La pantalla Generar los muestra como aviso («N fotos se dejaron con su fondo original»).

### 3.5 `TemplateImage` (subidas de imagen de plantilla)

| Campo | Descripción |
| --- | --- |
| `file` | Nombre seguro en `data/uploads/`, con prefijo `tpl-` |
| `name` | Nombre original saneado, para mostrar |
| `bytes`, `width`, `height` | Para el selector |

No hay tabla: se lista leyendo la carpeta, igual que las subidas de productos.

## 4. Reglas derivadas de la constitución

- **II**: productos sin foto siguen fuera; el texto «AGOTADO» es un nodo de texto real y buscable; formato de precio `$9.000`.
- **IV**: `ProductsBlock` es el único dibujante de productos; recibe la tarjeta como `imageUrl` por payload.
- **I**: nada se escribe en Alegra; las tarjetas son derivados locales y temporales.

## 5. Transiciones de estado

`prepare` (sin tarjetas) → `payload` (tarjetas componidas bajo demanda y cacheadas) → `generate` (mismo payload; informe de respaldos al terminar) → `done`. Cambiar el modo, la plantilla o la foto invalida solo las tarjetas afectadas por su clave de caché.
