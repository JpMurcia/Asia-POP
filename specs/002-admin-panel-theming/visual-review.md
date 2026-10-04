# Revisión visual — feature 002

**Fecha**: 2026-10-03 · **Estado**: revisión técnica hecha; **falta la aprobación del responsable de la tienda** (SC-001 y SC-007, tareas T057 y T062).

Las capturas están en [`visual/`](./visual/). Se generaron con `backend/tests/fixtures/visual-sample.ts` (catálogo de muestra con Alegra simulado) y `backend/tests/fixtures/pdf-pages.ts` (páginas de `docs/Cat.pdf`); ver el README.

## Qué se comparó

| Captura | Qué muestra |
| --- | --- |
| `01-pdf-producto-tema-por-defecto.png` | Página de producto con el tema por defecto: anillo verde, etiqueta de precio oscura con borde naranja, pie con teléfonos y dirección, sello AGOTADO |
| `02-pdf-politicas-tema-por-defecto.png` | Página de políticas: encabezados en chips oscuros con texto rosa y pie |
| `03-pdf-textos-en-el-maximo.png` | Textos en el máximo permitido (nombre de sección de 60 caracteres, nombre de 120, descripciones, 4 opciones, 12 sabores, dirección de 160): todo cabe |
| `04-pdf-tema-personalizado.png` | Tema azul/amarillo/celeste/rojo: se recolorea el anillo, la etiqueta de precio y el pie |
| `05-referencia-cat-pdf-producto.png` / `06-referencia-cat-pdf-politicas.png` | Páginas 4 y 38 de `docs/Cat.pdf`, la referencia |
| `07-panel-inicio-1366.png` / `08-panel-apariencia-1366.png` | Panel con la dirección 1b "Pop" a 1366 px de ancho |

## Diferencias del PDF con `docs/Cat.pdf` (para decidir)

El tema por defecto (`#11052C`, `#FF007A`, `#00FF66`, `#FF9900`) **pinta elementos que Cat.pdf no tiene**, como anticipó el plan (research §2). Son diferencias intencionales de la spec, pero cambian el aspecto:

1. **Anillo verde `#00FF66`** de 4 px alrededor de la tarjeta de imagen. Cat.pdf usa una tarjeta negra sin borde de color.
2. **Etiqueta de precio**: fondo del color de fondo (`#11052C`) con borde naranja `#FF9900`. Cat.pdf usa una píldora malva semitransparente.
3. **Pie** con teléfonos y dirección en las páginas de producto y de políticas (FR-020). Cat.pdf no tiene pie en esas páginas; las portadas ya traían el bloque «Domicilios».
4. **Encabezados de políticas** como chips oscuros con texto rosa. Cat.pdf usa texto rosa sobre el fondo beige.
5. La **página de políticas** sigue siendo la de la feature 001 (tarjetas), distinta de la de Cat.pdf (caja beige única con viñetas y «para mochis» en el título). No es parte de esta feature; queda para la revisión final de 001 (T085).

Lo que sí coincide con Cat.pdf: máximo 3 productos por página con disposición alterna, burbuja beige con la descripción, sello AGOTADO diagonal, logo arriba a la derecha y portadas.

**Cómo ajustarlo si algo no gusta** (sin tocar componentes): cambiar los colores por defecto en `backend/src/catalog/theme.ts`, o editar el tema en Apariencia. Si se prefiere sin anillo, basta poner el acento 2 igual al color de fondo.

## Comprobaciones automáticas que respaldan esta revisión

- Ningún bloque de texto desborda su caja y ningún texto pisa el logo, el collage, el contacto, el pie ni la etiqueta de precio, con textos en el máximo permitido: `backend/tests/integration/print-overflow.test.ts`.
- Las páginas del PDF coinciden con la vista previa de estructura: `generation-options.test.ts`.
- El panel no desborda horizontalmente a 1366×768 ni a 1024 px en ninguna de sus 9 pantallas, con datos de longitud extrema: `panel-layout.test.ts`.

## Defectos encontrados y corregidos durante la revisión

- Los bloques de la burbuja de texto se encogían hasta desaparecer con textos largos (`flex-shrink`); ahora no se encogen y la letra se ajusta.
- La burbuja podía pisar la etiqueta de precio; su altura máxima bajó del 68 % al 61 %.
- El título de página con un nombre de sección largo pisaba el logo; ahora deja el espacio del logo y reduce la letra.
- Las opciones de un producto propio con etiqueta larga ocultaban el precio al cortarse; ahora se corta la etiqueta y el precio y el máximo de sabores siempre se ven.
- El texto de los enlaces-botón (por ejemplo «Descargar PDF» en Inicio) salía rosa sobre rosa porque la regla global de enlaces ganaba a las utilidades; pasó a la capa base.
- Un título de sección corto («RAMEN») se encogía al mínimo por una medición incorrecta del ajuste de texto; ahora se compara con el `max-height` real.

## Para cerrar T057 y T062

El responsable debe revisar las capturas (o abrir la aplicación y generar un catálogo) y confirmar:

- [ ] El panel coincide con el mockup 1b «Pop» (SC-001).
- [ ] El aspecto por defecto del PDF es aceptable, o indicar qué colores ajustar (SC-007).
