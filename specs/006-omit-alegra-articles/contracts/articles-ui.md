# Contrato: pantalla Artículos de Alegra y cambios en Generar, Sin categoría e Inicio

**Feature**: `006-omit-alegra-articles` | **Base**: las pantallas de 001–005 | **Idioma**: español (Colombia), sin términos técnicos

Los textos de este documento son los que debe mostrar la interfaz. Estilo, espaciado y tokens: los de los componentes de `ui` y de la pantalla Sin categoría (que es la más parecida).

## 1. Menú lateral y ruta

- Entrada nueva **«Artículos de Alegra»**, justo después de «Sin categoría» y antes de «Contenido propio». Ruta `/articulos`.
- Sin contador en el menú (el de «Sin categoría» no cambia de significado).
- Orden resultante: Inicio · Conexión Alegra · Sin categoría · **Artículos de Alegra** · Contenido propio · Combos · Generar catálogo · Historial · Apariencia.

## 2. Pantalla «Artículos de Alegra» (Historias 1 y 2; FR-001 a FR-003, FR-011, FR-015)

**Encabezado**: título «Artículos de Alegra»; subtítulo «Elige los artículos de Alegra que no quieres en el catálogo.»

**Nota** (texto atenuado, debajo del encabezado): «Omitir un artículo solo se guarda aquí: no cambia nada en Alegra. Los artículos omitidos quedan fuera de todos los catálogos hasta que los vuelvas a incluir.»

**Resumen** (siempre visible, con `aria-live="polite"`): «{total} artículos · {omitidos} omitidos». Con 1: «1 artículo · 1 omitido».

**Controles**

| Control | Texto | Comportamiento |
| --- | --- | --- |
| Campo de búsqueda | Etiqueta «Buscar por nombre»; marcador «Escribe parte del nombre» | Filtra al escribir; no distingue mayúsculas ni tildes («jamon» encuentra «Jamón») |
| Selector | Etiqueta «Sección»; opciones «Todas las secciones», cada sección (por nombre) y «Sin categoría» si hay artículos sin sección | Filtra por la sección que muestra cada fila |
| Vistas | «Todos ({n})» · «Omitidos ({m})» (grupo de dos botones de opción, una sola selección; «Todos» al abrir) | Los conteos se calculan con la búsqueda y la sección elegidas: dicen cuántos hay **en cada vista** (FR-003) |

**Fila de artículo**

```
Ramen picante                                   [Omitir]
RAMEN · $9.000  [Agotado]
```

- Nombre en negrita; debajo, la sección (o «Sin categoría»), el precio con formato de pesos y, si está agotado, la etiqueta **«Agotado»**.
- Si está omitido: etiqueta **«Omitido»** junto al nombre, texto atenuado y el botón dice **«Volver a incluir»**; si no, el botón dice **«Omitir»**.
- Nombre accesible del botón: «Omitir {nombre}» / «Volver a incluir {nombre}».
- **Nota de combos** (solo en filas omitidas que se usan en combos): «Está en el combo «{combo}». El combo no cambia.» y, con varios, «Está en los combos «{a}» y «{b}». Los combos no cambian.» (FR-011). No bloquea nada.

**Comportamiento**

- Pulsar el botón cambia la fila **al instante** (sin botón de guardar) y guarda con una petición; si falla, la fila vuelve a su estado anterior y aparece, arriba de la lista, una alerta de error: «No se pudo guardar el cambio. Inténtalo de nuevo.» (FR-002).
- Cada cambio exitoso avisa al resumen de Inicio (igual que las demás pantallas) para que sus números se actualicen.
- Si al volver a incluir (o al omitir) la fila sale de la vista actual, el foco pasa a la fila siguiente o, si no hay, al selector de vistas.
- Las filas conservan el orden por nombre; omitir no las reordena.

**Estados**

| Estado | Texto |
| --- | --- |
| Cargando | «Cargando…» |
| Sin resultados (búsqueda o sección sin coincidencias) | «Ningún artículo coincide con la búsqueda.» |
| Vista «Omitidos» vacía, sin búsqueda ni sección | «No has omitido ningún artículo.» |
| Alegra sin configurar o sin respuesta (FR-015) | Alerta de error con el mensaje del servidor («Primero configura la conexión con Alegra.» / «No se pudo conectar con Alegra.»), debajo «Revisa la conexión con Alegra» (enlace a `/alegra`) y el botón **«Reintentar»**. No se muestra lista |
| Alegra sin artículos activos | «Alegra no tiene artículos activos.» |

## 3. Generar: aviso de omitidos (Historia 2, FR-008)

En la tarjeta **Revisión**, justo debajo de la línea de conteos y antes de los avisos de problemas, un aviso **informativo** (tono `info`, nuevo en `Alert`; no es advertencia porque es una decisión de la persona). Solo aparece si `report.omittedByChoice` no está vacío.

> **3 artículos omitidos por ti**
> • Ramen picante
> • Té verde
> • Bolsa de regalo
> No saldrán en el catálogo. **Administrar artículos** *(enlace a `/articulos`)*

- Título con singular y plural: «1 artículo omitido por ti» / «{n} artículos omitidos por ti».
- La lista muestra hasta 30 nombres; si hay más, una última línea «y {k} más».
- La línea de conteos («{n} productos incluidos · {m} omitidos · {k} con badge AGOTADO») **no cambia**: «omitidos» sigue significando sin foto o sin sección.
- Los omitidos no aparecen en los avisos de sin categoría, sin imagen ni foto no obtenida (FR-009).
- **Cambio después de preparar** (FR-012): al pulsar «2. Generar PDF» con una lista cambiada, la alerta de error existente muestra «Cambiaste los artículos omitidos después de preparar. Vuelve a preparar el catálogo para aplicar el cambio.» y no se inicia ninguna generación. Pulsar «1. Preparar y revisar» actualiza todo.
- El aviso de **Sin categoría** de Generar (`UncategorizedAlert`) cuenta solo los pendientes no omitidos.

## 4. Sin categoría (Historia 3, FR-009)

- Un ítem omitido sin sección asignada muestra la etiqueta **«Omitido»** (neutral) en lugar de «Pendiente», y **no** cuenta en «{n} pendientes de asignar».
- Si ya no queda ningún pendiente pero hay omitidos sin sección, el resumen dice «No quedan pendientes de asignar» (en lugar de «Todos tienen sección asignada», que dejaría de ser cierto). Sin omitidos, los textos son los de hoy.
- Se agrega bajo la nota existente, solo si hay algún omitido en la lista: «Los artículos omitidos no necesitan sección: no saldrán en el catálogo.»
- El selector de sección de un omitido sigue disponible: la asignación se conserva y vuelve a aplicar si se lo incluye de nuevo.

## 5. Inicio (FR-010)

Solo cambia la **nota** de la tarjeta «Productos activos en Alegra» (el valor no cambia): con omitidos, «{n} omitidos del catálogo · Sincronizado hace {t}» (con 1: «1 omitido del catálogo · …»); sin omitidos, la nota de hoy. La tarjeta «Agotados» cuenta solo los no omitidos (su nota «Salen con badge AGOTADO» sigue siendo cierta).

## 6. Accesibilidad

- Búsqueda, selector y vistas con etiqueta asociada; los botones de fila con nombre accesible por artículo.
- El resumen y las alertas de error usan los roles existentes (`status` para estado, `alert` para errores).
- Operable solo con teclado; el orden de tabulación es: búsqueda, sección, vistas, filas.

## Pruebas de este contrato (frontend)

En `frontend/tests/articles.test.tsx`, `generate.test.tsx`, `screens.test.tsx`, `home.test.tsx` y `sidebar.test.tsx`:

1. La entrada «Artículos de Alegra» aparece en el menú, en su posición.
2. La lista muestra nombre, sección o «Sin categoría», precio con formato y «Agotado»; el resumen cuenta bien.
3. La búsqueda ignora mayúsculas y tildes; el selector filtra por sección; «Omitidos» muestra solo los omitidos y los conteos de las vistas siguen la búsqueda.
4. «Omitir» envía `PUT /api/catalog/omitted/:id` y cambia la fila al instante; «Volver a incluir» envía `DELETE`. Si la petición falla, la fila vuelve y se ve el error.
5. Una fila omitida con combos muestra la nota (singular y plural); una sin combos no.
6. Alegra sin configurar o caída: alerta con el mensaje, enlace a la conexión y «Reintentar»; sin lista.
7. Generar: con omitidos aparece el aviso con título en singular/plural, nombres y enlace; sin omitidos no aparece; más de 30 muestran «y N más».
8. Generar: un `409 omitted_changed` al generar muestra el mensaje en la alerta de error.
9. Sin categoría: la etiqueta «Omitido», el conteo de pendientes sin omitidos y los dos textos del resumen.
10. Inicio: la nota de «Productos activos en Alegra» con omitidos (singular y plural) y sin ellos.
