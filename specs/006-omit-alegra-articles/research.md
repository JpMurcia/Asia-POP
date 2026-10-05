# Investigación: Omitir artículos de Alegra del catálogo

**Feature**: `006-omit-alegra-articles` | **Fecha**: 2026-10-05

El Contexto Técnico del plan no dejó ningún `NEEDS CLARIFICATION` (la única decisión de alcance, permanente o por generación, se resolvió en la spec). Lo que sí hacía falta antes de diseñar era **leer cómo fluyen hoy los artículos de Alegra hasta el PDF**, porque la feature no agrega un paso nuevo sino una regla que debe valer en todos los lugares que cuentan o muestran productos. No hay experimentos ni mediciones: todo lo de abajo se verificó leyendo el código.

## 0. Lo encontrado en el código

| Hallazgo | Dónde | Consecuencia para el diseño |
| --- | --- | --- |
| `buildCatalog` es la **única fuente de reglas** del catálogo: lo usan `prepare` (Generar) y el resumen de Inicio con las mismas entradas locales (`loadLocalInputs`) | `catalog-builder.ts`, `catalog.service.ts`, `panel-summary.ts` | La regla de omitir va aquí, y la lista llega por `loadLocalInputs`: así vista previa, PDF, revisión y Inicio no pueden divergir (FR-010) |
| El resumen de Inicio calcula **por su cuenta** `products` y `soldOut` sobre todos los activos, sin pasar por el constructor | `panel-summary.ts` (`real.length`, `real.filter(i => i.soldOut)`) | Hay que tocarlo: `soldOut` debe excluir los omitidos (la tarjeta dice «Salen con badge AGOTADO»). `products` es «Productos activos en Alegra» y **no** baja; se agrega `omitted` |
| Los combos resuelven sus componentes con `alegraById`, construido con **todos** los ítems | `catalog-builder.ts` | Si se filtrara la lista de ítems antes de construir, un componente omitido pasaría a «Producto no disponible» y el combo mostraría AGOTADO por error (viola FR-011). La omisión debe aplicarse **dentro** del bucle de ítems, no antes |
| `loadLocalInputs` se evalúa **una vez, al preparar**; las opciones posteriores reconstruyen con esa instantánea | `catalog.service.ts` (`input`, `build`) | Un cambio de la lista después de preparar no llega a la preparación: hay que detectarlo (FR-012) |
| La pantalla Generar guarda `prepared` en estado local de la ruta | `Generate.tsx`, `App.tsx` | Al salir de Generar (por ejemplo a Artículos de Alegra) y volver, el estado se pierde y hay que preparar de nuevo: el caso «mismo navegador» ya queda cubierto. El caso que sí puede ocurrir es **otra pestaña** que cambie la lista mientras Generar sigue abierta con una preparación |
| Cualquier petición que no sea `GET` y termine bien invalida el resumen de Inicio | `app.ts` | Los endpoints nuevos no necesitan invalidar nada a mano |
| `prepare` descarga la foto de **todos** los ítems (20,8 s con 182 fotos) antes de construir | `catalog.service.ts` | Un omitido no necesita su foto: no descargarla ahorra tiempo y espacio en el caché |
| La pantalla de combos lista todos los activos de Alegra para elegir componentes | `bundles.routes.ts` | No cambia: un artículo omitido sigue siendo un componente válido (FR-011) |
| `UncategorizedAlert` (en Generar) y la pantalla Sin categoría deciden «pendiente» con `!assignedSectionKey` | `UncategorizedAlert.tsx`, `Uncategorized.tsx` | Ambos deben ignorar los omitidos (FR-009). El contador de la barra lateral ya viene de `omittedNoSection`, que se corrige solo |

## 1. Dónde se aplica la regla

- **Decisión**: en `buildCatalog`, con una entrada nueva `omittedIds: Set<string>`. Es lo primero que se evalúa para un ítem, justo después de descartar a los padres de variantes: un ítem omitido no se clasifica, no se reporta y no entra a ninguna sección. Se anota en `report.omittedByChoice`.
- **Razón**: una sola regla para todos los consumidores (hallazgo 1). Como `omittedIds` viaja con `loadLocalInputs`, `prepare` y el resumen de Inicio la reciben sin código extra.
- **Alternativas descartadas**: (a) **filtrar `items` antes de construir**: rompe los combos (hallazgo 3) y el informe no sabría qué nombres informar. (b) **Filtrar el payload ya construido**: las páginas se agrupan de 3 en 3, las secciones vacías ya existirían y los conteos y la estructura saldrían mal. (c) **Filtrar al renderizar**: duplica la regla y deja desalineados vista previa, PDF y números.

## 2. Dónde se guarda

- **Decisión**: tabla nueva `omitted_item (alegra_item_id TEXT PRIMARY KEY)`, en la migración `004_omitted_items.sql`, con un repositorio `OmittedItemRepo` junto a `OverrideRepo`.
- **Razón**: es el mismo patrón y la misma naturaleza que `category_override` (una marca local sobre un ítem de Alegra, solo local, nunca escribe en Alegra: principio I). Una migración de una tabla es lo más simple y consistente con las tres que ya existen.
- **Alternativas descartadas**: (a) **una columna o fila en `category_override`**: esa tabla significa «ítem sin categoría → sección» y su clave de sección es obligatoria; mezclar los dos conceptos confunde. (b) **Un JSON dentro de los ajustes del negocio**: no se puede consultar ni actualizar un artículo sin reescribir todo, y rompe la costumbre de tablas con clave. (c) **Un archivo suelto en `data/`**: otra forma de persistir fuera del esquema, sin transacciones. (d) **Guardar también el nombre del artículo**: solo serviría para mostrarlo sin conexión, algo que la spec no pide (la pantalla requiere Alegra); si Alegra cambia el nombre, el guardado quedaría desactualizado.

## 3. Identidad y entradas que ya no existen

- **Decisión**: la clave es el identificador del artículo en Alegra, tal como lo entrega el mapeo actual (texto). Nombre, precio, categoría y disponibilidad pueden cambiar sin deshacer la omisión (FR-006).
- **Entradas obsoletas**: si el artículo deja de estar activo, su fila **se conserva** pero la pantalla no lo lista y nadie lo cuenta (los totales se calculan sobre los activos que existen); si vuelve a estar activo, sigue omitido (edge case de la spec). No hay limpieza automática: la tabla crece solo con lo que la persona omite y no hay nada que mantener (principio VI).

## 4. Que el PDF use la lista que se revisó (FR-012)

- **Decisión**: al preparar se guarda en la preparación una **firma** de la lista de omitidos (los identificadores ordenados y unidos). `generate` calcula la firma vigente y, si difiere, responde **409 `omitted_changed`** con el mensaje «Cambiaste los artículos omitidos después de preparar. Vuelve a preparar el catálogo para aplicar el cambio.», sin iniciar ningún trabajo. La pantalla ya muestra los errores de `generate` en su alerta, así que no necesita código nuevo para este caso.
- **Razón**: la revisión que ve la persona es una instantánea (hallazgo 4) y lo que importa es que el PDF sea exactamente lo que revisó (principio II). Comparar la firma es barato, no consulta Alegra y no cambia el modelo de preparación.
- **Alternativas descartadas**: (a) **leer la lista al generar y construir con ella**: la revisión mostrada podría no coincidir con el PDF sin que la persona lo sepa, justo lo que FR-012 prohíbe. (b) **Reconstruir sola la preparación**: tardaría ~20 s (descarga de fotos) escondidos tras el botón y cambiaría la revisión sin avisar. (c) **No hacer nada, como hoy con las asignaciones de «Sin categoría»**: es el comportamiento que FR-012 descarta explícitamente para esta feature.
- **Alcance**: el 409 es solo para la lista de omitidos. Las asignaciones de «Sin categoría» conservan su comportamiento actual (se aplican al preparar); cambiarlo es otra feature.

## 5. Informe de revisión y conteos

- **Decisión**: `ReviewReport` gana `omittedByChoice: { itemId, name }[]`, **global** como `uncategorized`: lista todos los omitidos activos de Alegra, estén o no en las secciones seleccionadas (SC-004: el número debe ser el que la persona marcó). `counts.omitted` **no cambia** de significado (sin foto + sin sección): el Historial y la tarjeta «Último catálogo» de Inicio siguen mostrando «omitidos» en el sentido de hoy.
- **Razón**: FR-008 pide que las dos cosas se distingan. Mezclar la decisión de la persona con los problemas haría que «14 omitidos» dejara de significar «14 productos con un problema por resolver».
- **Alternativa descartada**: sumar los omitidos a `counts.omitted`. Cambiaría lo que dicen el Historial y Generar y obligaría a reescribir sus pruebas por un beneficio nulo.

## 6. Fotos y avisos

- **Decisión**: `prepare` no descarga la foto de un omitido, y el constructor los excluye de `photos.informed` para que `allFailed` («no se pudo obtener ninguna foto») no se calcule con artículos que ya no importan.
- **Razón**: FR-009 exige cero avisos por un omitido; además evita descargas inútiles. La exclusión en el constructor es la regla; la de `prepare` es solo una optimización.
- **Riesgo evaluado**: ninguno para el caché de fotos: no se borra nada, simplemente no se agregan fotos nuevas de artículos omitidos.

## 7. Inicio

| Tarjeta | Antes | Con la feature |
| --- | --- | --- |
| Productos activos en Alegra | Todos los activos | **Igual** (es un dato de Alegra). La nota pasa a incluir «N omitidos del catálogo» cuando hay |
| Agotados | Todos los agotados | Solo los **no omitidos** (la nota dice «Salen con badge AGOTADO») |
| Sin categoría | `omittedNoSection` | Igual: el constructor ya excluye a los omitidos |
| Páginas estimadas / Secciones | Del constructor | Igual: el constructor ya excluye a los omitidos |

`PanelSummary.stats` gana `omitted` (omitidos que están activos hoy en Alegra).

## 8. La pantalla «Artículos de Alegra»

- **Decisión**: una página nueva (`/articulos`, entrada de menú «Artículos de Alegra» después de «Sin categoría»). Una sola consulta en vivo (`GET /api/catalog/articles`) trae los ~200 artículos con su marca de omitido; la búsqueda, el filtro por sección y el filtro «Omitidos» se aplican **en el navegador**, sin ir al servidor en cada tecla (SC-009: < 1 s).
- **Cómo se decide la sección que se muestra**: la categoría del artículo; si no tiene, la sección que la persona le asignó en «Sin categoría»; si tampoco, «Sin categoría». Es la misma regla con la que el constructor lo ubicaría.
- **Combos**: cada artículo trae los **nombres de los combos** que lo usan como componente; la fila omitida los muestra como nota informativa (FR-011), sin bloquear nada.
- **Guardado**: `PUT` y `DELETE` por artículo, idempotentes. La pantalla marca el cambio de inmediato y lo revierte con un mensaje si el servidor falla (FR-002: sin botón de guardar).
- **Alternativas descartadas**: (a) **filtrar en el servidor** con parámetros de consulta: 200 filas caben sin problema en el navegador y una búsqueda por tecla sería más lenta y más compleja. (b) **Paginación o virtualización**: con 200 filas no hace falta (principio VI). (c) **Incluir la foto en cada fila**: ayuda a reconocer el artículo, pero obliga a servir las fotos de 200 artículos y no la pide la spec; el nombre, la sección y el precio bastan.

## 9. «Sin categoría» y la alerta de Generar

- **Decisión**: `GET /api/catalog/uncategorized` agrega `omitted` a cada ítem. La pantalla lo muestra con la etiqueta «Omitido» y no lo cuenta como pendiente; `UncategorizedAlert` los excluye del conteo.
- **Razón**: FR-009 y la historia 3. La asignación de sección de un omitido se conserva (si se lo vuelve a incluir, vuelve a aplicar).

## 10. Aviso informativo en Generar

- **Decisión**: la lista de «omitidos por ti» va en un aviso **informativo**, no de advertencia: es una decisión de la persona, no un problema. `Alert` gana un tono `info` (colores neutros del tema, rol de estado).
- **Alternativa descartada**: reutilizar `warning`. Pintaría de amarillo algo que la persona decidió y la acostumbraría a ignorar los avisos amarillos.

## 11. Lo que no se hace (principio VI)

Omitir por regla (nombre, precio, categoría), omitir en bloque, omisión con fecha, omisión solo por generación, registro de qué se omitió en cada catálogo del Historial, nombre guardado junto a la marca y limpieza de entradas viejas. Todo está en «Fuera de alcance» de la spec o es consecuencia de ella.

## 12. Medición con datos reales

Manual, de solo lectura y sin llevar nombres de productos a la documentación (principios I y III y regla de datos reales). Las pruebas automáticas usan el simulador de Alegra (principio V). Detalle en [quickstart.md](./quickstart.md).
