# Data Model: Generador de Catálogo PDF

**Feature**: [spec.md](./spec.md) | Persistencia: SQLite (`data/app.db`). Los datos de Alegra **no se almacenan**: se leen en cada generación (principio I). Los IDs de Alegra se guardan como `TEXT`.

## Entidades persistidas

### `alegra_connection` (una fila)
| Campo | Tipo | Reglas |
| --- | --- | --- |
| `id` | INTEGER PK | siempre 1 |
| `email` | TEXT NOT NULL | |
| `token_encrypted` | BLOB NOT NULL | AES-256-GCM (iv + tag + datos); nunca se devuelve por API |
| `last_tested_at` | TEXT (ISO) | actualizado en cada prueba exitosa |

### `business_settings` (una fila)
`store_name`, `phone_1`, `phone_2`, `address`, `terms_text` (JSON: lista de bloques título/texto, de `Cat.pdf` pág. 38), `cover_title`. Se inicializa con los valores de `Cat.pdf`.

### `section`
Secciones **propias** (MOCHIS, REGALOS). Las categorías de Alegra no se guardan aquí.
| Campo | Tipo | Reglas |
| --- | --- | --- |
| `id` | TEXT PK (uuid) | |
| `name` | TEXT NOT NULL UNIQUE | nombre visible, en mayúsculas |
| `intro_text` | TEXT NULL | texto de apertura opcional (ej. "¿Qué es el mochi?") |

### `section_order`
Orden global de secciones, mezcla Alegra y propias.
| Campo | Tipo | Reglas |
| --- | --- | --- |
| `section_key` | TEXT PK | `alegra:<categoryId>` o `custom:<sectionId>` |
| `position` | INTEGER NOT NULL | único; secciones sin fila van al final, por nombre |

### `custom_product`
| Campo | Tipo | Reglas |
| --- | --- | --- |
| `id` | TEXT PK (uuid) | |
| `section_id` | TEXT FK → `section.id` ON DELETE CASCADE | |
| `name` | TEXT NOT NULL | |
| `description` | TEXT NOT NULL DEFAULT '' | |
| `image_path` | TEXT NULL | archivo local; sin imagen → se omite en el catálogo |
| `price` | INTEGER NULL | pesos COP enteros; obligatorio si no hay opciones |
| `flavors` | TEXT NULL | JSON array de sabores |
| `sort_index` | INTEGER NOT NULL DEFAULT 0 | |

### `product_option`
Opciones con precio de un producto propio (ej. "Caja x 6 UND" $30.000).
`id`, `product_id` FK ON DELETE CASCADE, `label`, `price` INTEGER NOT NULL, `max_flavors` INTEGER NULL. **Regla**: un producto tiene `price` o al menos una opción.

### `bundle` (combo)
| Campo | Tipo | Reglas |
| --- | --- | --- |
| `id` | TEXT PK (uuid) | |
| `section_id` | TEXT FK → `section.id` | sección propia donde aparece |
| `name`, `description` | TEXT | |
| `image_path` | TEXT NULL | sin imagen → omitido |
| `pricing_type` | TEXT CHECK IN ('fixed','discount') | FR-024 |
| `fixed_price` | INTEGER NULL | requerido si `fixed` |
| `discount_percent` | REAL NULL | 0 < x ≤ 100, requerido si `discount` |

### `bundle_component`
`id`, `bundle_id` FK ON DELETE CASCADE, `source` CHECK IN ('alegra','custom'), `product_id` TEXT NOT NULL (id de Alegra opaco o uuid de `custom_product`), `quantity` INTEGER ≥ 1.
Un componente `custom` referencia `custom_product.id`; al eliminar ese producto se bloquea si está en un combo (error de validación).

### `category_override`
Asignación local de un ítem de Alegra sin categoría a una sección.
`alegra_item_id` TEXT PK, `section_key` TEXT NOT NULL (`alegra:<id>` o `custom:<id>`).

### `generated_catalog`
`id` (uuid), `created_at`, `file_path`, `included_count`, `omitted_count`, `params_json` (filtros, decisiones de combos, ocultar agotados). Se conservan los **10 más recientes**; el resto se elimina junto con su archivo.

## Estructuras en memoria (no persistidas)

### `CatalogPayload` (instantánea que consume la vista de impresión)
```text
CatalogPayload
├── config: { storeName, phones[], address, coverTitle, theme }
├── sections: Section[]
│   ├── key, name, source: 'alegra' | 'custom', introText?
│   └── pages: Page[]          // máx. 3 productos por página
│       └── items: CatalogItem[]
├── terms: { title, body }[]
└── generatedAt
```

### `CatalogItem` (unión)
- **AlegraItem**: `id`, `name`, `description`, `priceLabel` (`$9.000`), `imageUrl` (caché local), `soldOut`.
- **CustomItem**: `id`, `name`, `description`, `imageUrl`, `priceLabel?`, `options?[{label, priceLabel, maxFlavors?}]`, `flavors?`. Nunca `soldOut`.
- **BundleItem**: `id`, `name`, `description`, `imageUrl`, `priceLabel`, `components[{name, quantity}]`, `soldOut` (según decisión del usuario, FR-025).

### `ReviewReport` (resultado de `prepare`)
```text
ReviewReport
├── uncategorized: { itemId, name }[]                  // FR-016
├── omittedNoImage: { source, id, name }[]             // FR-012
├── omittedNoSection: { itemId, name }[]               // FR-018
├── soldOutBundles: { bundleId, name, soldOutComponents[] }[]  // FR-025
├── counts: { included, omitted, soldOut }
└── emptyCatalog: boolean
```

### `GenerationJob`
`id`, `status` (`idle|preparing|rendering|done|failed`), `step` (texto legible), `progress` (0-100), `error?`, `catalogId?`. Solo uno activo a la vez.

## Reglas de transformación (de la spec)

| Regla | Origen |
| --- | --- |
| `soldOut = trackInventory && availableQuantity <= 0` | FR-011 |
| ítem sin imagen (o con descarga fallida) → fuera del catálogo y listado en `omittedNoImage` | FR-012 |
| categoría sin ítems elegibles → sin portada de sección | FR-013 |
| 3 ítems por página, última página con 1-3 | FR-009 |
| precio combo `discount` = `round(Σ(precio_componente × cantidad) × (1 − %/100))`, redondeado al múltiplo de $100 más cercano | FR-024 |
| combo `soldOut` si algún componente de Alegra está agotado y el usuario eligió "mantener con sello"; si eligió "omitir", no aparece | FR-025 |
| ítem de Alegra con `category` vacío y sin override → `omittedNoSection` | FR-016/018 |

## Transiciones de estado

`GenerationJob`: `idle → preparing → (review pendiente) → rendering → done`; cualquier fallo → `failed` sin PDF parcial (principio II). Un nuevo trabajo solo se acepta desde `idle`, `done` o `failed`.
